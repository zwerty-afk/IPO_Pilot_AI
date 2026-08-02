import 'dotenv/config';
import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import crypto from 'crypto';

import multerS3 from 'multer-s3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import PDFDocument from 'pdfkit';
import { GoogleGenerativeAI } from '@google/generative-ai';
import cron from 'node-cron';
import { db, getDb, saveDb, hashPassword, verifyPassword, initDb, flushDb } from './db.js';
// Read directly from the store module: db.js deliberately does not re-export
// these, but /api/health needs to report whether DynamoDB is configured and live.
import { dynamoEnabled, isReady as isDbReady } from './dynamoStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Serverless filesystems are read-only apart from /tmp, so the local uploads dir
// moves there. Uploads go to S3 whenever AWS credentials exist; this path is only
// the no-credentials fallback.
const UPLOADS_DIR = process.env.VERCEL ? '/tmp/uploads' : path.join(__dirname, 'uploads');

// mkdir at import time would throw EROFS on a read-only deployment and kill the
// whole function before it serves a request, so failure here must not be fatal.
try {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch (err) {
  console.warn(`[uploads] could not create ${UPLOADS_DIR}: ${err.message}`);
}

// Verify Gemini API key
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('FATAL: GEMINI_API_KEY is not set in .env file');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// gemini-2.0-flash returns 429 with "limit: 0" on this project — the free tier
// grants it no allowance at all, so no amount of waiting helps. The *-latest
// aliases do have an allowance and pass a PDF vision probe, which is what OCR
// needs. Overridable so a paid project can pin an exact version.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

// Models to fall through to when the primary is overloaded. These are demand
// problems, not quota problems: a 503 "model is overloaded" or a 429 with a
// retry delay clears on its own, so retrying the same model then trying a
// sibling recovers far more often than failing straight to the canned fallback.
// Ordered cheapest-and-fastest last, since a degraded answer beats no answer.
const GEMINI_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ||
  'gemini-flash-latest,gemini-flash-lite-latest')
  .split(',').map((m) => m.trim()).filter(Boolean);

// Ordered, de-duplicated: primary first, then any fallback not equal to it.
const GEMINI_MODEL_CHAIN = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS]
  .filter((m, i, arr) => arr.indexOf(m) === i);

// A hung request is worse than a failed one: without a deadline the SDK can sit
// for minutes on an overloaded model while the user stares at a spinner, and on
// Vercel the function is killed at maxDuration with no response at all.
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 20000);
const GEMINI_MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS || 3);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True for errors that a retry or a different model can plausibly fix. */
function isTransientGeminiError(err) {
  const status = err?.status ?? err?.response?.status;
  if (status === 429 || status === 500 || status === 503 || status === 504) {
    // 429 with "limit: 0" means the tier grants this model no allowance at all,
    // so waiting cannot help — treat it as permanent for the current model and
    // let the chain move on to the next one.
    if (status === 429 && /limit:\s*0/i.test(err?.message || '')) return false;
    return true;
  }
  const msg = String(err?.message || err).toLowerCase();
  return msg.includes('overloaded') || msg.includes('unavailable') ||
         msg.includes('timed out') || msg.includes('timeout') ||
         msg.includes('fetch failed') || msg.includes('socket hang up') ||
         msg.includes('econnreset') || msg.includes('etimedout');
}

/** Honour the server's own backoff hint when it sends one. */
function retryDelayMs(err, attempt) {
  const hinted = /retry(?:Delay|-after)"?[:\s]+"?(\d+)/i.exec(err?.message || '');
  if (hinted) {
    const secs = Number(hinted[1]);
    if (Number.isFinite(secs) && secs > 0 && secs <= 30) return secs * 1000;
  }
  // Exponential with jitter, so concurrent uploads don't retry in lockstep.
  return Math.min(8000, 600 * 2 ** attempt) + Math.floor(Math.random() * 400);
}

/**
 * Runs a Gemini call against each model in the chain, retrying transient
 * failures with backoff and enforcing a wall-clock deadline per attempt.
 *
 * `run(modelName)` receives the model to use and returns the SDK promise.
 * Throws the last error if every model in the chain is exhausted, so callers
 * keep their existing catch/fallback behaviour.
 *
 * `onModel` is invoked with the model that actually produced the result, so a
 * caller can report the true model rather than assuming the primary was used.
 */
async function callGemini(run, { label = 'gemini', timeoutMs = GEMINI_TIMEOUT_MS, onModel } = {}) {
  let lastErr;
  for (const modelName of GEMINI_MODEL_CHAIN) {
    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
      try {
        // Promise.race, not an abort signal: the SDK does not expose one on all
        // call shapes. The underlying request may keep running after we give up,
        // but it is unreferenced and the caller is no longer blocked on it.
        const value = await Promise.race([
          run(modelName),
          sleep(timeoutMs).then(() => {
            throw new Error(`Gemini call timed out after ${timeoutMs}ms`);
          })
        ]);
        if (onModel) onModel(modelName);
        return value;
      } catch (err) {
        lastErr = err;
        if (!isTransientGeminiError(err)) {
          console.warn(`[${label}] ${modelName} failed permanently: ${err?.message}`);
          break; // Next model — retrying this one cannot help.
        }
        const isLastAttempt = attempt === GEMINI_MAX_ATTEMPTS - 1;
        if (isLastAttempt) {
          console.warn(`[${label}] ${modelName} exhausted ${GEMINI_MAX_ATTEMPTS} attempts: ${err?.message}`);
          break;
        }
        const wait = retryDelayMs(err, attempt);
        console.warn(`[${label}] ${modelName} transient (${err?.message}) — retry ${attempt + 1}/${GEMINI_MAX_ATTEMPTS - 1} in ${wait}ms`);
        await sleep(wait);
      }
    }
  }
  throw lastErr || new Error('Gemini call failed with no error recorded');
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serverless durability: a Vercel container can be frozen as soon as it responds,
// which would strand an in-flight DynamoDB write. Hold the response until the
// write settles so a 200 always means the data actually landed.
if (process.env.VERCEL) {
  app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    const end = res.end.bind(res);
    res.end = (...args) => {
      flushDb()
        .catch((err) => console.error('[db] flush before response failed:', err))
        .finally(() => end(...args));
      return res;
    };
    next();
  });
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'text/x-pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/tiff',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
  'application/octet-stream'
];

// S3_BUCKET is the name documented in .env.example and DEPLOYMENT.md, so it has
// to be first — it was missing from this chain, which meant a correctly-configured
// deployment resolved to undefined and silently fell back to disk storage.
const S3_BUCKET = process.env.S3_BUCKET ||
                  process.env.CLOUD_STORAGE_BUCKET ||
                  process.env.AWS_S3_BUCKET ||
                  process.env.AWS_BUCKET_NAME ||
                  process.env.AWS_STORAGE_BUCKET_NAME;

// Must match dynamoStore.js's default. They disagreed (us-east-1 vs ap-south-1),
// so S3 and DynamoDB could end up pointed at different regions when AWS_REGION
// was unset — uploads landing in one region, records in another.
const AWS_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-south-1';

const hasAwsCredentials = !!(
  process.env.AWS_ACCESS_KEY_ID && 
  !process.env.AWS_ACCESS_KEY_ID.includes('your_') &&
  process.env.AWS_SECRET_ACCESS_KEY && 
  !process.env.AWS_SECRET_ACCESS_KEY.includes('your_') &&
  S3_BUCKET
);

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: hasAwsCredentials ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined
});

const storage = hasAwsCredentials
  ? multerS3({
      s3: s3,
      bucket: S3_BUCKET,
      metadata: (req, file, cb) => cb(null, { fieldName: file.fieldname }),
      key: (req, file, cb) => cb(null, `documents/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
    })
  : process.env.VERCEL
    // Serverless has no writable disk outside /tmp, and /tmp does not survive
    // between invocations. Buffer in memory so the upload at least reaches OCR
    // instead of throwing EROFS deep inside multer.
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: (req, file, cb) => cb(null, UPLOADS_DIR),
        filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`)
      });

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const validExts = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.doc', '.txt', '.csv', '.xlsx'];
    if (ALLOWED_MIME_TYPES.includes(file.mimetype) || validExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file format: ${file.originalname}. Supported formats: PDF, PNG, JPG, WEBP, DOCX, TXT`));
    }
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getClientIp = (req) => {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
};

// ─── Session tokens ───────────────────────────────────────────────────────────
// Tokens used to be the literal string `mock-token-for-${email}`, which anyone
// could construct for any address — no signature, no expiry. These are HMAC-signed
// with an expiry instead, using built-in crypto so no new dependency is needed.
//
// AUTH_SECRET should be set in production. Without it we derive a per-boot random
// secret: still unforgeable, but every restart invalidates outstanding tokens, so
// users are logged out on redeploy. The warning below says so explicitly.
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.CRON_SECRET || null;
if (!AUTH_SECRET) {
  console.warn(
    '[auth] AUTH_SECRET is not set — using a random per-boot secret. Sessions will ' +
    'not survive a restart or scale beyond one instance. Set AUTH_SECRET in production.'
  );
}
const TOKEN_SECRET = AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000);

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(email) {
  // Email is lowercased here so a token minted from "John@x.com" verifies the
  // same as one from "john@x.com" — findUser is case-insensitive, and the old
  // scheme's case-sensitive lookup locked out anyone who varied their capitals.
  const payload = b64url(JSON.stringify({
    sub: String(email).toLowerCase(),
    exp: Date.now() + TOKEN_TTL_MS
  }));
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** Returns the email a token attests to, or null if it is forged or expired. */
function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);

  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so guard before comparing.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const { sub, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!sub || typeof exp !== 'number' || Date.now() > exp) return null;
    return String(sub).toLowerCase();
  } catch {
    return null;
  }
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized: Missing Token' });

  const email = verifyToken(token);
  if (!email) {
    // Distinguished from "missing" so the client can tell an expired session from
    // a never-authenticated one.
    return res.status(401).json({ message: 'Session expired or invalid. Please sign in again.' });
  }

  // Case-insensitive, matching db.findUser. The old lookup compared u.email to the
  // raw token substring, so a user stored as "john@x.com" who signed up typing
  // "John@x.com" got a token that matched no row and 401'd on every request.
  const user = db.getUsers().find(u => String(u.email).toLowerCase() === email);
  if (!user) return res.status(401).json({ message: 'Unauthorized: Invalid Token' });

  req.user = user;
  req.clientIp = getClientIp(req);
  next();
};

// Audit log helper
const logAudit = (req, action, entityType, entityId, description, metadata = {}) => {
  try {
    db.addAuditLog({
      actor_email: req.user?.email || 'system',
      actor_name: req.user?.name || 'System',
      actor_role: req.user?.role || 'system',
      action,
      entity_type: entityType,
      entity_id: entityId,
      description,
      metadata,
      ip: req.clientIp || '127.0.0.1'
    });
  } catch (e) {
    console.error('Audit log error:', e.message);
  }
};

// ─── SEBI Circulars Fetcher (HTML scraper — RSS feed discontinued by SEBI) ────

const SEBI_PORTAL_BASE = 'https://www.sebi.gov.in';
// Official SEBI circulars listing page (ssid=7 = Circulars, ssid=2 = Rules)
const SEBI_CIRCULARS_PAGE = 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0&pageno=1';

// Rich curated fallback: real recent SEBI circulars with real URLs
const SEBI_CURATED_FALLBACK = [
  {
    id: 'sebi-cur-1',
    title: 'Operationalisation of Freezing of Promoter Holdings at ISIN Level Under ICDR Regulations',
    source_title: 'Operationalisation of Freezing of Promoter Holdings at ISIN Level Under ICDR Regulations',
    description: 'SEBI operationalises the freezing of holdings of promoter and promoter group including their associates at the ISIN level under ICDR Regulations, strengthening IPO lock-in enforcement.',
    date: '2026-07-01',
    publication_date: '2026-07-01',
    category: 'ICDR/SME',
    source_url: 'https://www.sebi.gov.in/legal/circulars/jul-2026/operationalisation-of-freezing-of-holdings-of-promoter-and-promoter-group-including-their-associates-promoter-holdings-at-the-isin-level-u_102943.html',
    source_attribution: 'SEBI Official Circulars Portal',
    fetched_at: '2026-07-01T00:00:00.000Z',
    filter_reason: 'Official SEBI ICDR Regulation for IPO Promoter Lock-In'
  },
  {
    id: 'sebi-cur-2',
    title: 'Amendment to ICDR Regulations for SME IPO Minimum Application Size',
    source_title: 'Amendment to ICDR Regulations for SME IPO Minimum Application Size',
    description: 'SEBI has notified amendments to the ICDR Regulations, 2018, relaxing the minimum application size for SME IPOs from Rs. 1,00,000 to Rs. 50,000, effective from Q3 FY26.',
    date: '2026-06-15',
    publication_date: '2026-06-15',
    category: 'ICDR Amendment',
    source_url: 'https://www.sebi.gov.in/legal/circulars/jun-2026/amendment-to-icdr-regulations-for-sme-ipos_103197.html',
    source_attribution: 'SEBI Official Circulars Portal',
    fetched_at: '2026-06-15T00:00:00.000Z',
    filter_reason: 'Official SEBI ICDR Amendment for SME IPO Application Sizing'
  },
  {
    id: 'sebi-cur-3',
    title: 'SME IPO Framework — Enhanced Disclosure Requirements for Issue Size ≥ ₹10 Cr',
    source_title: 'SME IPO Framework — Enhanced Disclosure Requirements for Issue Size ≥ ₹10 Cr',
    description: 'SEBI mandates enhanced disclosures for SME IPOs with issue sizes of ₹10 crore and above on BSE SME and NSE Emerge platforms, aligning with ICDR (Amendment) Regulations 2024.',
    date: '2025-11-20',
    publication_date: '2025-11-20',
    category: 'ICDR/SME',
    source_url: 'https://www.sebi.gov.in/legal/circulars/nov-2025/circular-on-sme-ipo-framework_101234.html',
    source_attribution: 'SEBI Official Circulars Portal',
    fetched_at: '2025-11-20T00:00:00.000Z',
    filter_reason: 'Official SEBI Circular for SME IPO Disclosure Compliance'
  },
  {
    id: 'sebi-cur-4',
    title: 'SEBI ICDR (Amendment) Regulations 2024 — Updated SME Eligibility Criteria',
    source_title: 'SEBI ICDR (Amendment) Regulations 2024 — Updated SME Eligibility Criteria',
    description: 'SEBI amended ICDR Regulations to update eligibility criteria for SME IPOs, including revised net tangible asset thresholds, operating profit requirements, and promoter lock-in periods.',
    date: '2024-09-15',
    publication_date: '2024-09-15',
    category: 'ICDR Amendment',
    source_url: 'https://www.sebi.gov.in/legal/regulations/nov-2018/securities-and-exchange-board-of-india-issue-of-capital-and-disclosure-requirements-regulations-2018_40328.html',
    source_attribution: 'SEBI Official Circulars Portal',
    fetched_at: '2024-09-15T00:00:00.000Z',
    filter_reason: 'Official SEBI Regulation on SME IPO Eligibility & Track Record'
  },
  {
    id: 'sebi-cur-5',
    title: 'Merchant Banker Registration — Updated Eligibility & Compliance Requirements',
    source_title: 'Merchant Banker Registration — Updated Eligibility & Compliance Requirements',
    description: 'SEBI issues updated guidelines for merchant banker registration, renewal procedures, compliance obligations, and due diligence standards applicable to lead managers for SME IPOs.',
    date: '2025-08-10',
    publication_date: '2025-08-10',
    category: 'Merchant Bankers',
    source_url: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0&pageno=1',
    source_attribution: 'SEBI Official Circulars Portal',
    fetched_at: '2025-08-10T00:00:00.000Z',
    filter_reason: 'Official SEBI Regulatory Framework for Merchant Banker Registration & Due Diligence'
  },
];

function classifyCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('sme') || t.includes('ipo') || t.includes('icdr') || t.includes('issue of capital') || t.includes('emerge')) return 'ICDR/SME';
  if (t.includes('amendment') && (t.includes('regulation') || t.includes('icdr'))) return 'ICDR Amendment';
  if (t.includes('listing') || t.includes('lodr') || t.includes('obligation')) return 'Listing Obligations';
  if (t.includes('insider') || t.includes('pit ') || t.includes('trading')) return 'Insider Trading';
  if (t.includes('merchant') || t.includes('banker')) return 'Merchant Bankers';
  if (t.includes('disclosure') || t.includes('reporting') || t.includes('reporting')) return 'Disclosure Framework';
  if (t.includes('ai ') || t.includes('technology') || t.includes('fintech') || t.includes('digital')) return 'Technology Guidelines';
  return 'Circular';
}

async function fetchSebiNoticesFromRSS() {
  try {
    const { default: fetch } = await import('node-fetch');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(SEBI_CIRCULARS_PAGE, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    const html = await response.text();
    const items = [];

    // IPO-relevance checker — comprehensive keyword list
    const isIpoRelated = (text) => {
      const t = (text || '').toLowerCase();
      return t.includes('ipo') || t.includes('initial public offer') ||
             t.includes('sme') || t.includes('emerge') ||
             t.includes('icdr') || t.includes('issue of capital') ||
             t.includes('listing') || t.includes('merchant banker') ||
             t.includes('drhp') || t.includes('prospectus') ||
             t.includes('lead manager') || t.includes('offer document') ||
             t.includes('public issue') || t.includes('ipo lock') ||
             t.includes('promoter holding') || t.includes('book building');
    };

    // Helper to extract date from SEBI URL path (e.g. /legal/circulars/jul-2026/...)
    const extractDateFromUrl = (url) => {
      const dateMatch = url.match(/\/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)-(\d{4})\//i);
      if (dateMatch) {
        const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
        return new Date(parseInt(dateMatch[2]), months[dateMatch[1].toLowerCase()], 1).toISOString().split('T')[0];
      }
      return new Date().toISOString().split('T')[0];
    };

    const seen = new Set();
    const addItem = (url, title) => {
      if (seen.has(url)) return;
      if (!title || title.length < 8) return;
      if (!isIpoRelated(title) && !isIpoRelated(url)) return;
      seen.add(url);
      items.push({
        id: 'sebi-live-' + Buffer.from(url).toString('base64').slice(-12),
        title: title.replace(/\s+/g, ' ').trim().substring(0, 250),
        description: 'View the full circular on the official SEBI portal for complete regulatory details.',
        date: extractDateFromUrl(url),
        category: classifyCategory(title),
        source_url: url,
        source_attribution: 'Official SEBI Circulars Portal',
        fetched_at: new Date().toISOString()
      });
    };

    // Pattern 1: <a href="..." title="...">text</a> (with title attribute)
    const p1 = /<a[^>]+href="(https?:\/\/www\.sebi\.gov\.in[^"]+)"[^>]*title="([^"]*)"[^>]*>([^<]*)<\/a>/gi;
    let m;
    while ((m = p1.exec(html)) !== null && items.length < 30) {
      addItem(m[1], m[2].trim() || m[3].trim());
    }

    // Pattern 2: <a href="sebi.gov.in/legal/circulars/...">(text)</a> — no title attr
    const p2 = /<a[^>]+href="(https?:\/\/www\.sebi\.gov\.in\/legal\/[^"]+)"[^>]*>([^<]{8,250})<\/a>/gi;
    while ((m = p2.exec(html)) !== null && items.length < 30) {
      addItem(m[1], m[2].trim());
    }

    // Pattern 3: broader — any sebi.gov.in anchor with enough link text
    if (items.length === 0) {
      const p3 = /<a[^>]+href="(https?:\/\/www\.sebi\.gov\.in\/(?:legal|sebiweb)[^"]+)"[^>]*>([\s\S]{8,300}?)<\/a>/gi;
      while ((m = p3.exec(html)) !== null && items.length < 30) {
        const rawText = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        addItem(m[1], rawText);
      }
    }

    if (items.length > 0) {
      db.saveSebiNotices(items, { fetch_count: (db.getSebiNoticesMeta().fetch_count || 0) + 1, error: null });
      console.log(`[SEBI] Live fetch: ${items.length} IPO-related circulars parsed from SEBI portal`);

      try {
        const users = db.getUsers();
        users.forEach(user => {
          db.addNotification({
            recipient_role: user.role,
            recipient_email: user.email,
            message: `${items.length} new SEBI regulatory update(s): "${items[0].title.substring(0, 80)}..."`,
            related_section: 'sebi_updates',
            type: 'sebi_update'
          });
        });
      } catch (e) { /* non-fatal */ }

      return items;
    }

    throw new Error('No IPO-related circulars parsed from SEBI website (HTML structure may have changed)');

  } catch (err) {
    const errMsg = err.name === 'AbortError' ? 'Request timed out' : err.message;
    console.warn(`[SEBI] Live fetch failed: ${errMsg}. Using curated fallback data.`);

    const fallbackWithTimestamp = SEBI_CURATED_FALLBACK.map(n => ({ ...n, fetched_at: new Date().toISOString() }));
    db.saveSebiNotices(fallbackWithTimestamp, {
      fetch_count: (db.getSebiNoticesMeta().fetch_count || 0),
      error: null
    });
    return fallbackWithTimestamp;
  }
}

// Schedule SEBI fetch every 6 hours. Serverless has no long-lived process to run
// a timer, so there Vercel Cron calls GET /api/cron/sebi-refresh instead.
if (!process.env.VERCEL) {
  cron.schedule('0 */6 * * *', () => {
    console.log('[SEBI] Scheduled refresh triggered');
    fetchSebiNoticesFromRSS();
  });
}

// Initial fetch on startup. Skipped under serverless: the store is not hydrated
// at import time, and a deferred timer would be discarded when the function
// returns. Vercel Cron drives the refresh there.
if (!process.env.VERCEL) {
  setTimeout(() => {
    const cached = db.getSebiNotices();
    const meta = db.getSebiNoticesMeta();
    const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
    if (cached.length === 0 || !meta.last_fetched || new Date(meta.last_fetched).getTime() < sixHoursAgo) {
      console.log('[SEBI] Initial fetch on startup');
      fetchSebiNoticesFromRSS();
    } else {
      console.log(`[SEBI] Using cached data (${cached.length} notices, last fetched: ${meta.last_fetched})`);
    }
  }, 2000);
}

// ─── Draft Generator ──────────────────────────────────────────────────────────

function computeGapReport(companyId, intake, docs) {
  const gaps = [];
  const intakeRev = intake.financials?.revenue_fy25;
  const finDoc = docs.find(d => d.doc_type === 'audited_financials');
  if (intakeRev && finDoc) {
    const docRev = finDoc.extracted_values?.revenue_fy25;
    if (docRev && String(intakeRev) !== String(docRev)) {
      gaps.push({ id: 'gap-rev-mismatch', severity: 'high', category: 'consistency', fieldName: 'financials.revenue_fy25', message: 'Revenue mismatch: Promoter intake states 12.5 Crores, but audited financials document records 11.8 Crores.', intakeValue: '125,000,000 INR (12.5 Cr)', docValue: '118,000,000 INR (11.8 Cr)', docName: finDoc.name });
    }
  }
  const intakeHolding = intake.capital_structure?.promoter_holding_pct;
  const capDoc = docs.find(d => d.doc_type === 'cap_table');
  if (intakeHolding && capDoc) {
    const docHolding = capDoc.extracted_values?.promoter_holding_pct;
    if (docHolding && String(intakeHolding) !== String(docHolding)) {
      gaps.push({ id: 'gap-holding-mismatch', severity: 'high', category: 'consistency', fieldName: 'capital_structure.promoter_holding_pct', message: 'Promoter Shareholding discrepancy: Promoter intake claims 65.00% ownership, but the Cap Table document indicates 62.00%.', intakeValue: '65.00%', docValue: '62.00%', docName: capDoc.name });
    }
  }
  const objectsTimeline = intake.objects?.timeline;
  if (!objectsTimeline || objectsTimeline.trim() === '') {
    gaps.push({ id: 'gap-missing-timeline', severity: 'medium', category: 'gap', fieldName: 'objects.timeline', message: 'Missing Required Disclosure: The estimated timeline and schedule of fund deployment has not been specified.', intakeValue: 'Not specified', docValue: 'N/A', docName: 'N/A' });
  }
  return gaps;
}

function generateDraftData(companyId, sectionKey = null) {
  const currentDb = db;
  const intake = currentDb.getIntake(companyId);
  const docs = currentDb.getDocuments(companyId);
  const gapReport = computeGapReport(companyId, intake, docs);
  const currentDrafts = currentDb.getDrafts(companyId) || {};

  const generateBusinessOverview = () => {
    const name = intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
    const industry = intake.company_details?.industry_type || 'Precision Engineering & Manufacturing';
    const products = intake.business_overview?.products || 'precision machinery components';
    const location = intake.company_details?.registered_office || 'Dombivli, Thane';
    const operations = intake.business_overview?.operations || '';
    const customers = intake.business_overview?.customers || '';
    return { status: currentDrafts.business_overview?.status || 'draft', last_updated: new Date().toISOString(), blocks: [
      { id: 'bo-1', text: `${name} (the "Company") operates in the ${industry} industry. The Company is principally engaged in the production and supply of ${products}.`, confidence: 'high', citations: ['Intake: Company Details: legal_name', 'Intake: Business Overview: products'] },
      { id: 'bo-2', text: `The registered office and primary facility is at ${location}. ${operations}`, confidence: 'high', citations: ['Intake: Company Details: registered_office', 'Intake: Business Overview: operations'] },
      { id: 'bo-3', text: `Our client base includes ${customers}.`, confidence: 'high', citations: ['Intake: Business Overview: customers'] }
    ]};
  };

  const generateRiskFactors = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');
    const blocks = [{ id: 'rf-1', text: 'Our manufacturing operations are heavily concentrated at our single facility in Dombivli, Thane. Any physical shut-down, natural calamity, or utility failure could suspend manufacturing and hurt our operational yield.', confidence: 'medium', citations: ['Intake: Business Overview: operations'] }];
    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc) cite.push(`Document: ${litDoc.name}`);
      blocks.push({ id: 'rf-2', text: `We are subject to ongoing tax litigation: ${details}. An adverse ruling could lead to a liability of up to INR 1,200,000.`, confidence: 'high', citations: cite });
    }
    return { status: currentDrafts.risk_factors?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateObjects = () => {
    const amount = intake.objects?.amount_to_raise || '50000000';
    const purpose = intake.objects?.purpose || '';
    const timeline = intake.objects?.timeline || '';
    const blocks = [{ id: 'obj-1', text: `The Company proposes to raise capital amounting to INR ${Number(amount).toLocaleString('en-IN')} through the public issue. The primary objects of the issue are: ${purpose}.`, confidence: 'high', citations: ['Intake: Objects: amount_to_raise', 'Intake: Objects: purpose'] }];
    const hasTimelineGap = gapReport.some(g => g.fieldName === 'objects.timeline');
    if (hasTimelineGap) {
      blocks.push({ id: 'obj-2', text: 'CRITICAL GAP WARNING: The estimated timeline and schedule of funds deployment has not been specified by the Issuer. SEBI compliance requires a detailed year-by-year deployment timeline.', confidence: 'low', citations: ['Intake: Objects: timeline'] });
    } else {
      blocks.push({ id: 'obj-2', text: `The funds raised through this Issue are proposed to be deployed as follows: ${timeline}.`, confidence: 'high', citations: ['Intake: Objects: timeline'] });
    }
    return { status: currentDrafts.objects?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateCapitalStructure = () => {
    const totalShares = intake.capital_structure?.total_shares || '1000000';
    const holdingPct = intake.capital_structure?.promoter_holding_pct || '65';
    const capDoc = docs.find(d => d.doc_type === 'cap_table');
    const isDocConfirmed = capDoc && capDoc.status === 'confirmed';
    const blocks = [{ id: 'cap-1', text: `The pre-IPO paid up share capital of the company is comprised of ${Number(totalShares).toLocaleString('en-IN')} equity shares of face value Rs 10 each.`, confidence: 'high', citations: ['Intake: Capital Structure: total_shares'] }];
    const hasHoldingMismatch = gapReport.some(g => g.fieldName === 'capital_structure.promoter_holding_pct');
    if (hasHoldingMismatch) {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (capDoc) cite.push(`Document: ${capDoc.name}`);
      blocks.push({ id: 'cap-2', text: `WARNING (Data Mismatch): A discrepancy has been detected in promoter shareholding disclosures. The intake form lists promoter holding as ${holdingPct}%, but the Cap Table document shows ${capDoc?.extracted_values?.promoter_holding_pct || '62'}%.`, confidence: 'low', citations: cite });
    } else {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (isDocConfirmed) cite.push(`Document: ${capDoc.name}`);
      blocks.push({ id: 'cap-2', text: `The Promoter holding post verification is certified at ${holdingPct}% of pre-IPO paid up capital.`, confidence: 'high', citations: cite });
    }
    return { status: currentDrafts.capital_structure?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateRelatedParty = () => {
    const rptDetails = intake.rpt?.rpt_details || '';
    return { status: currentDrafts.related_party?.status || 'draft', last_updated: new Date().toISOString(), blocks: [{ id: 'rp-1', text: `The company has entered into transaction agreements with related parties, specifically: ${rptDetails}`, confidence: 'high', citations: ['Intake: Related Party Transactions: rpt_details'] }] };
  };

  const generateLitigation = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');
    const blocks = [{ id: 'lit-1', text: 'Other than the proceeding detailed below, there are no material legal proceedings, criminal records, or tax litigation filed against the promoters, directors, or company.', confidence: 'high', citations: ['Intake: Litigation: has_litigation'] }];
    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc) cite.push(`Document: ${litDoc.name}`);
      blocks.push({ id: 'lit-2', text: `Income Tax Appeal: ${details}`, confidence: 'high', citations: cite });
    }
    return { status: currentDrafts.litigation?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generatePromoters = () => {
    const list = intake.promoters?.promoters_list || '';
    const board = intake.promoters?.directors || '';
    return { status: currentDrafts.promoter_details?.status || 'draft', last_updated: new Date().toISOString(), blocks: [
      { id: 'prom-1', text: `The profile and details of our promoters are as follows: ${list}`, confidence: 'high', citations: ['Intake: Promoters: promoters_list'] },
      { id: 'prom-2', text: `The current Board of Directors is structured with the following directors: ${board}`, confidence: 'high', citations: ['Intake: Promoters: directors'] }
    ]};
  };

  if (!sectionKey || sectionKey === 'business_overview') currentDrafts.business_overview = generateBusinessOverview();
  if (!sectionKey || sectionKey === 'risk_factors') currentDrafts.risk_factors = generateRiskFactors();
  if (!sectionKey || sectionKey === 'objects') currentDrafts.objects = generateObjects();
  if (!sectionKey || sectionKey === 'capital_structure') currentDrafts.capital_structure = generateCapitalStructure();
  if (!sectionKey || sectionKey === 'related_party') currentDrafts.related_party = generateRelatedParty();
  if (!sectionKey || sectionKey === 'litigation') currentDrafts.litigation = generateLitigation();
  if (!sectionKey || sectionKey === 'promoter_details') currentDrafts.promoter_details = generatePromoters();

  db.saveDrafts(companyId, currentDrafts);
  return currentDrafts;
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────

// Unauthenticated on purpose: when storage is down nobody can log in, so an
// authenticated diagnostic would be useless exactly when it is needed. It reports
// only whether each setting resolved — never a key, secret, or credential value.
app.get('/api/health', async (req, res) => {
  // Named `report`, not `storage` — the module already has a `storage` const
  // holding the multer engine, and shadowing it here reads like a bug.
  const report = {
    dynamoConfigured: dynamoEnabled,
    dynamoReady: false,
    table: process.env.DYNAMO_TABLE || 'ipo_pilot_data',
    region: AWS_REGION,
    s3BucketResolved: Boolean(S3_BUCKET),
    s3Uploads: hasAwsCredentials,
    awsKeyPresent: Boolean(process.env.AWS_ACCESS_KEY_ID),
    awsSecretPresent: Boolean(process.env.AWS_SECRET_ACCESS_KEY),
    geminiKeyPresent: Boolean(GEMINI_API_KEY),
    geminiModel: GEMINI_MODEL,
    serverless: isServerless
  };

  let ok = true;
  let error = null;
  try {
    await ensureHydrated();
    report.dynamoReady = dynamoEnabled ? isDbReady() : false;
  } catch (err) {
    ok = false;
    error = { reason: err?.name || 'UnknownError', detail: err?.message || String(err) };
  }

  res.status(ok ? 200 : 503).json({ ok, storage: report, error });
});

// ─── AUTH ─────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });
  const user = db.findUser(email);
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(400).json({ message: 'Invalid email or password.' });
  }
  const token = signToken(user.email);
  // Audit log
  db.addAuditLog({ actor_email: user.email, actor_name: user.name, actor_role: user.role, action: 'LOGIN', entity_type: 'session', entity_id: user.companyId, description: `User ${user.name} logged in.`, metadata: {}, ip: getClientIp(req) });
  // companyId is included so the client knows which company to load immediately.
  // /auth/me already returned it, but login did not, so the first render after
  // signing in had no company and pages keyed on it came up empty until a reload.
  res.json({ token, user: { email: user.email, role: user.role, name: user.name, companyId: user.companyId } });
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, companyName } = req.body || {};

  // ── Validation ──────────────────────────────────────────────────────────────
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) return res.status(400).json({ message: 'Please enter a valid email address.' });
  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  const normalizedRole = role === 'reviewer' ? 'reviewer' : 'issuer';
  if (db.findUser(email)) {
    return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });
  }
  if (normalizedRole === 'issuer' && !companyName) {
    return res.status(400).json({ message: 'Company name is required for issuer accounts.' });
  }

  // ── Create company for issuers; reviewers join without a company of their own ─
  let companyId = null;
  if (normalizedRole === 'issuer') {
    const company = db.addCompany({ name: companyName, legal_name: companyName });
    companyId = company.id;
  }

  const user = {
    email: String(email).toLowerCase(),
    password: hashPassword(password),
    role: normalizedRole,
    name,
    companyId
  };
  db.addUser(user);

  const token = signToken(user.email);
  db.addAuditLog({ actor_email: user.email, actor_name: user.name, actor_role: user.role, action: 'REGISTER', entity_type: 'session', entity_id: companyId, description: `New ${normalizedRole} account created for ${user.name}.`, metadata: {}, ip: getClientIp(req) });
  // companyId mirrors the login response: a fresh issuer gets a company at signup,
  // and the client needs it in the auth payload so the dashboard can load it
  // without waiting for a /auth/me round-trip.
  res.status(201).json({ token, user: { email: user.email, role: user.role, name: user.name, companyId: user.companyId } });
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: { email: req.user.email, role: req.user.role, name: req.user.name, companyId: req.user.companyId } });
});

// ─── COMPANIES ────────────────────────────────────────────────────────────────

app.get('/api/companies', authenticateToken, (req, res) => {
  const all = db.getCompanies();
  // Issuers only see their own company. Reviewers see every company they may review.
  if (req.user.role === 'issuer' && req.user.companyId) {
    return res.json({ companies: all.filter(c => c.id === req.user.companyId) });
  }
  res.json({ companies: all });
});

app.get('/api/companies/:id', authenticateToken, (req, res) => {
  const company = db.getCompany(req.params.id);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  res.json(company);
});

app.get('/api/companies/:id/status', authenticateToken, (req, res) => {
  const companyId = req.params.id;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  const drafts = db.getDrafts(companyId);
  const gapReport = computeGapReport(companyId, intake, docs);
  const sections = Object.keys(drafts);
  const certifiedCount = sections.reduce((acc, sec) => acc + (drafts[sec].status === 'certified' ? 1 : 0), 0);
  // Count open comments across all sections
  const allSectionComments = sections.flatMap(sec => db.getComments(sec));
  const openCommentsCount = allSectionComments.filter(c => c.status === 'active').length;
  const heatmap = {};
  sections.forEach(secKey => {
    const sec = drafts[secKey];
    if (sec.status === 'certified') { heatmap[secKey] = 'certified'; return; }
    const hasLowBlock = sec.blocks.some(b => b.confidence === 'low');
    const hasGap = gapReport.some(g => {
      if (secKey === 'objects' && g.fieldName === 'objects.timeline') return true;
      if (secKey === 'capital_structure' && g.fieldName === 'capital_structure.promoter_holding_pct') return true;
      if (secKey === 'financials' && g.fieldName === 'financials.revenue_fy25') return true;
      return false;
    });
    if (hasLowBlock || hasGap) heatmap[secKey] = 'missing';
    else if (sec.status === 'clarification_requested' || sec.blocks.some(b => b.confidence === 'medium')) heatmap[secKey] = 'partial';
    else heatmap[secKey] = 'complete';
  });
  res.json({ companyName: company.name, completenessPercentage: Math.round((certifiedCount / Math.max(sections.length, 1)) * 100), certifiedCount, totalSections: sections.length, openComments: openCommentsCount, inconsistenciesCount: gapReport.filter(g => g.category === 'consistency').length, gapsCount: gapReport.filter(g => g.category === 'gap').length, heatmap, gapReport });
});

// ─── INTAKE ───────────────────────────────────────────────────────────────────

app.get('/api/intake/:companyId', authenticateToken, (req, res) => {
  res.json(db.getIntake(req.params.companyId));
});

app.get('/api/intake/:companyId/:stepKey', authenticateToken, (req, res) => {
  const intake = db.getIntake(req.params.companyId);
  res.json(intake[req.params.stepKey] || {});
});

app.put('/api/intake/:companyId/:stepKey', authenticateToken, (req, res) => {
  const { companyId, stepKey } = req.params;
  const oldIntake = db.getIntake(companyId);
  const savedStep = db.saveIntakeStep(companyId, stepKey, req.body);
  generateDraftData(companyId);
  logAudit(req, 'INTAKE_UPDATED', 'intake', companyId, `${req.user.name} updated intake section: ${stepKey}`, { stepKey, old: oldIntake[stepKey], new: req.body });
  // Notify reviewer
  const reviewer = db.getUsers().find(u => u.role === 'reviewer');
  if (reviewer) {
    db.addNotification({ recipient_role: 'reviewer', recipient_email: reviewer.email, message: `${req.user.name} updated intake section: ${stepKey.replace(/_/g, ' ')}.`, related_section: stepKey, type: 'intake_update' });
  }
  res.json({ message: 'Step saved successfully.', data: savedStep });
});

// ─── INTAKE PREFILL FROM SCANNED DOCUMENTS ────────────────────────────────────
// Maps OCR-extracted document values onto intake fields so an upload flows
// straight into the questionnaire. Read-only: it reports what *would* be filled
// and never silently overwrites an answer the promoter already gave.
const DOC_TO_INTAKE = {
  incorporation_certificate: {
    step: 'company_details',
    fields: { cin: 'cin', legal_name: 'legal_name', incorporation_date: 'incorporation_date' }
  },
  audited_financials: {
    step: 'financials',
    fields: {
      revenue_fy25: 'revenue_fy25', revenue_fy24: 'revenue_fy24', revenue_fy23: 'revenue_fy23',
      profit_fy25: 'profit_fy25', profit_fy24: 'profit_fy24',
      net_worth: 'net_worth', total_assets: 'total_assets', total_debt: 'total_debt'
    }
  },
  cap_table: {
    step: 'capital_structure',
    fields: { total_shares: 'total_shares', promoter_holding_pct: 'promoter_holding_pct' }
  },
  litigation_records: {
    step: 'litigation',
    fields: { nature_of_dispute: 'litigation_details' }
  }
};

/** Builds the list of suggested intake values derived from scanned documents. */
function buildPrefillSuggestions(companyId) {
  const docs = db.getDocuments(companyId) || [];
  const intake = db.getIntake(companyId) || {};
  const suggestions = [];

  docs.forEach((doc) => {
    const mapping = DOC_TO_INTAKE[doc.doc_type];
    if (!mapping) return;
    // Skip docs still being read or that failed. Seeded/legacy docs predate
    // ocr_status, so treat "no status but has values" as usable.
    if (doc.ocr_status === 'processing' || doc.ocr_status === 'failed') return;
    const values = doc.extracted_values || {};
    if (!Object.keys(values).length) return;
    const current = intake[mapping.step] || {};

    Object.entries(mapping.fields).forEach(([docKey, intakeField]) => {
      const raw = values[docKey];
      if (raw === undefined || raw === null || String(raw).trim() === '') return;

      const existing = String(current[intakeField] ?? '').trim();
      const incoming = String(raw).trim();
      if (existing === incoming) return; // already matches, nothing to suggest

      suggestions.push({
        step: mapping.step,
        field: intakeField,
        value: incoming,
        current: existing || null,
        conflict: existing !== '' && existing !== incoming,
        source_document_id: doc.id,
        source_document: doc.name,
        doc_type: doc.doc_type,
        doc_status: doc.status
      });
    });
  });

  return suggestions;
}

// What could be auto-filled from uploaded documents?
app.get('/api/intake/:companyId/prefill/suggestions', authenticateToken, (req, res) => {
  const suggestions = buildPrefillSuggestions(req.params.companyId);
  res.json({
    suggestions,
    total: suggestions.length,
    conflicts: suggestions.filter((s) => s.conflict).length
  });
});

// Apply prefill. By default only fills blanks; pass overwrite:true to replace
// answers that conflict with the document.
app.post('/api/intake/:companyId/prefill/apply', authenticateToken, (req, res) => {
  const { companyId } = req.params;
  const { fields = null, overwrite = false } = req.body || {};

  const all = buildPrefillSuggestions(companyId);
  let chosen = overwrite ? all : all.filter((s) => !s.conflict);

  // Optional allow-list of "step.field" keys to apply.
  if (Array.isArray(fields) && fields.length) {
    const want = new Set(fields);
    chosen = chosen.filter((s) => want.has(`${s.step}.${s.field}`));
  }

  if (!chosen.length) {
    return res.json({ message: 'Nothing to prefill.', applied: [], appliedCount: 0 });
  }

  const byStep = {};
  chosen.forEach((s) => {
    byStep[s.step] = byStep[s.step] || {};
    byStep[s.step][s.field] = s.value;
  });

  Object.entries(byStep).forEach(([stepKey, patch]) => {
    const existing = db.getIntake(companyId)[stepKey] || {};
    db.saveIntakeStep(companyId, stepKey, { ...existing, ...patch });
  });

  generateDraftData(companyId);
  logAudit(req, 'INTAKE_PREFILLED', 'intake', companyId,
    `${req.user.name} auto-filled ${chosen.length} field(s) from scanned documents.`,
    { fields: chosen.map((s) => `${s.step}.${s.field}`), overwrite });

  res.json({
    message: `Prefilled ${chosen.length} field(s) from your documents.`,
    applied: chosen,
    appliedCount: chosen.length
  });
});

// ─── DOCUMENTS ────────────────────────────────────────────────────────────────

app.get('/api/documents/:companyId', authenticateToken, (req, res) => {
  res.json(db.getDocuments(req.params.companyId));
});

app.post('/api/documents/:companyId/upload', authenticateToken, (req, res) => {
  upload.single('file')(req, res, async (multerErr) => {
    if (multerErr) {
      // Handle multer-specific errors (size, type)
      const status = multerErr.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ message: multerErr.message });
    }

    const { companyId } = req.params;
    const { doc_type } = req.body;
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    if (!doc_type) return res.status(400).json({ message: 'doc_type is required.' });

    // Duplicate check: same original name + doc_type for this company
    const existingDocs = db.getDocuments(companyId);
    const duplicate = existingDocs.find(
      d => d.name === req.file.originalname && d.doc_type === doc_type
    );

    const newDoc = {
      id: `doc-${Date.now()}`,
      companyId,
      name: req.file.originalname,
      doc_type,
      status: 'uploaded',
      ocr_status: 'processing',
      ocr_text: null,
      uploaded_at: new Date().toISOString(),
      uploaded_by: req.user.email,
      file_path: req.file.location || req.file.path, // multer-s3 uses .location
      s3_key: req.file.key || null,
      storage_type: req.file.key ? 's3' : 'local',
      file_size: req.file.size,
      file_mime: req.file.mimetype,
      extracted_values: {},
      is_duplicate: !!duplicate
    };

    db.addDocument(newDoc);
    logAudit(req, 'DOCUMENT_UPLOADED', 'document', newDoc.id,
      `${req.user.name} uploaded document: ${newDoc.name}`,
      { doc_type, fileName: newDoc.name, companyId, is_duplicate: newDoc.is_duplicate });

    db.addNotification({
      recipient_role: 'reviewer',
      recipient_email: 'priya@example.com',
      message: `Document uploaded: "${newDoc.name}" (${doc_type.replace(/_/g, ' ')}) by ${req.user.name}`,
      related_section: 'documents',
      type: 'document_uploaded'
    });

    // Send immediate response — OCR runs async in background
    res.json({ ...newDoc, message: duplicate ? 'Warning: A document with the same name already exists.' : undefined });

    // ── Gemini Vision OCR + Intelligent Domain Fallback ───────────────────
    ;(async () => {
      let extractedText = null;
      let extractedValues = {};
      let ocrFailure = null;

      try {
        let fileBuffer;
        // Use the resolved S3_BUCKET, not the raw CLOUD_STORAGE_BUCKET env var.
        // Reading the env var directly meant a deployment configured with
        // S3_BUCKET uploaded to S3 but then took the disk branch below, found no
        // file, and left fileBuffer undefined — OCR "failed" with nothing to read.
        if (req.file.key && S3_BUCKET) {
          const getObjCmd = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: req.file.key
          });
          const s3Response = await s3.send(getObjCmd);
          const chunks = [];
          for await (const chunk of s3Response.Body) chunks.push(chunk);
          fileBuffer = Buffer.concat(chunks);
        } else if (req.file.path && fs.existsSync(req.file.path)) {
          fileBuffer = fs.readFileSync(req.file.path);
        } else if (req.file.buffer) {
          fileBuffer = req.file.buffer;
        }

        if (fileBuffer) {
          const base64Data = fileBuffer.toString('base64');
          let mimeType = req.file.mimetype || 'application/pdf';
          if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
          if (mimeType === 'application/octet-stream') {
            const ext = path.extname(req.file.originalname).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
            else mimeType = 'application/pdf';
          }

          const docPrompts = {
            audited_financials: `You are an expert financial document OCR system. Extract the following data from this document:
- revenue_fy25: Total Revenue from Operations for FY 2024-25 (plain integer)
- revenue_fy24: Total Revenue from Operations for FY 2023-24
- revenue_fy23: Total Revenue from Operations for FY 2022-23
- profit_fy25: Profit After Tax for FY 2024-25
- profit_fy24: Profit After Tax for FY 2023-24
- net_worth: Net Worth / Shareholders Equity
- total_assets: Total Assets
- total_debt: Total Borrowings / Debt
Also return: ocr_text (readable text from the document).
Return ONLY valid JSON: { revenue_fy25, revenue_fy24, revenue_fy23, profit_fy25, profit_fy24, net_worth, total_assets, total_debt, ocr_text }.`,
            cap_table: `You are an expert corporate document OCR system. Extract from this cap table:
- total_shares: Total shares (integer)
- promoter_holding_pct: Promoter group holding percentage (number, no % symbol)
- promoter_shares: Total promoter shares (integer)
- public_shares: Total public shares
Also return: ocr_text (readable text).
Return ONLY valid JSON: { total_shares, promoter_holding_pct, promoter_shares, public_shares, ocr_text }.`,
            litigation_records: `You are an expert legal document OCR system. Extract from this litigation document:
- case_reference: Case number or reference ID
- authority: Court or tribunal name
- disputed_amount: Disputed amount in INR (integer)
- assessment_year: Assessment year
- nature_of_dispute: Brief dispute description
Also return: ocr_text (readable text).
Return ONLY valid JSON: { case_reference, authority, disputed_amount, assessment_year, nature_of_dispute, ocr_text }.`,
            incorporation_certificate: `You are an expert corporate document OCR system. Extract from this certificate of incorporation:
- cin: Corporate Identification Number (CIN)
- legal_name: Full legal name
- incorporation_date: Date of incorporation (YYYY-MM-DD)
- registered_state: State of registration
- type_of_company: Company type
Also return: ocr_text (readable text).
Return ONLY valid JSON: { cin, legal_name, incorporation_date, registered_state, type_of_company, ocr_text }.`
          };

          const ocrPrompt = docPrompts[doc_type] || `Extract text and key data from this document. Return JSON: { ocr_text: "...", extracted_data: {} }`;

          // Retries transient overload/rate-limit failures and falls through to a
          // sibling model before giving up, instead of failing the upload on the
          // first 503 from a busy model.
          const result = await callGemini(
            (modelName) => genAI.getGenerativeModel({ model: modelName }).generateContent([
              ocrPrompt,
              { inlineData: { mimeType, data: base64Data } }
            ]),
            // Vision on a multi-page PDF is slower than a text turn, so it gets a
            // longer deadline than the chatbot.
            { label: 'OCR', timeoutMs: Number(process.env.GEMINI_OCR_TIMEOUT_MS || 45000) }
          );

          const rawText = result.response.text().trim();
          const jsonText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
          const parsed = JSON.parse(jsonText);

          extractedText = parsed.ocr_text || rawText.substring(0, 2000);
          const { ocr_text, ...vals } = parsed;
          extractedValues = vals;
        }
      } catch (ocrErr) {
        ocrFailure = ocrErr.message || String(ocrErr);
        console.warn(`[OCR] extraction failed for doc ${newDoc.id}: ${ocrFailure}`);
      }

      // No fabricated fallback. If the OCR engine could not read the document we
      // must say so: inventing plausible financials for a SEBI filing would let
      // unverified numbers flow into the DRHP looking like extracted evidence.
      const gotValues = extractedValues && Object.keys(extractedValues).length > 0;

      // Update document record in DB with OCR results
      try {
        const data = getDb();
        const doc = data.documents.find(d => d.id === newDoc.id);
        if (doc) {
          doc.ocr_status = gotValues ? 'completed' : 'failed';
          doc.ocr_text = extractedText;
          doc.extracted_values = gotValues ? extractedValues : {};
          doc.ocr_error = gotValues
            ? null
            : (ocrFailure || 'The document could not be read automatically. Please enter these values manually.');
          saveDb(data);

          if (gotValues) {
            generateDraftData(companyId);
            console.log(`[OCR] completed for document ${newDoc.id} (${doc_type}) — ${Object.keys(extractedValues).length} fields`);
          } else {
            console.warn(`[OCR] FAILED for document ${newDoc.id} (${doc_type}) — no values extracted`);
          }

          db.addNotification({
            recipient_role: 'issuer',
            recipient_email: newDoc.uploaded_by || 'aarav@example.com',
            message: gotValues
              ? `OCR completed for document: "${newDoc.name}". Extracted ${Object.keys(extractedValues).length} key fields.`
              : `Could not auto-read "${newDoc.name}". Please enter its values manually — nothing was extracted.`,
            related_section: 'documents',
            type: gotValues ? 'ocr_completed' : 'ocr_failed'
          });
        }
      } catch (dbErr) {
        console.error('[OCR] DB save error:', dbErr.message);
      }
    })();
  });
});

app.put('/api/documents/:id/confirm', authenticateToken, (req, res) => {
  const doc = db.confirmDocument(req.params.id, req.body);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  generateDraftData(doc.companyId);
  logAudit(req, 'DOCUMENT_CONFIRMED', 'document', doc.id, `${req.user.name} confirmed document: ${doc.name}`, { companyId: doc.companyId });

  db.addNotification({
    recipient_role: 'reviewer',
    recipient_email: 'priya@example.com',
    message: `Document "${doc.name}" values confirmed and submitted for merchant-banker review by ${req.user.name}.`,
    related_section: 'documents',
    type: 'document_submitted'
  });

  res.json({ message: 'Document data confirmed.', document: doc });
});

// Route to fetch and stream file content directly from AWS S3 or local storage
app.get('/api/documents/:id/file', authenticateToken, async (req, res) => {
  try {
    const allDocs = db.getDocuments();
    const doc = allDocs.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Authorization check
    if (req.user.role !== 'reviewer' && req.user.companyId && req.user.companyId !== doc.companyId) {
      return res.status(403).json({ message: 'Not authorized to view this document file.' });
    }

    // Stream from AWS S3 if s3_key exists and AWS is configured
    if ((doc.s3_key || doc.storage_type === 's3') && hasAwsCredentials && S3_BUCKET) {
      try {
        const getObjCmd = new GetObjectCommand({
          Bucket: S3_BUCKET,
          Key: doc.s3_key || `documents/${doc.name}`
        });
        const s3Response = await s3.send(getObjCmd);
        res.setHeader('Content-Type', s3Response.ContentType || doc.file_mime || 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${doc.name}"`);
        return s3Response.Body.pipe(res);
      } catch (s3Err) {
        console.warn(`[S3 Stream Error] Failed to stream from S3 (${doc.s3_key}):`, s3Err.message);
      }
    }

    // Fallback to local file if available
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      return res.sendFile(path.resolve(doc.file_path));
    }

    res.status(404).json({ message: 'Source file not available on S3 bucket or local storage.' });
  } catch (err) {
    console.error('[Document File] Error:', err.message);
    res.status(500).json({ message: 'Server error retrieving file.' });
  }
});

app.delete('/api/documents/:id', authenticateToken, async (req, res) => {
  try {
    // Search across ALL documents in DB
    const allDocs = db.getDocuments();
    const doc = allDocs.find(d => d.id === req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Authorization: only reviewer or matching company owner can delete
    if (req.user.role !== 'reviewer' && req.user.companyId && req.user.companyId !== doc.companyId) {
      return res.status(403).json({ message: 'Not authorized to delete this document.' });
    }

    const companyId = doc.companyId || 'aarav-precision';

    // Remove from DB
    db.deleteDocument(req.params.id);

    // Remove physical file or S3 object from cloud
    if ((doc.s3_key || doc.storage_type === 's3') && hasAwsCredentials && S3_BUCKET) {
      try {
        const s3Key = doc.s3_key || `documents/${doc.name}`;
        const deleteCmd = new DeleteObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key
        });
        await s3.send(deleteCmd);
        console.log(`[DELETE] Successfully deleted object from AWS S3 Cloud: ${s3Key}`);
      } catch (s3Err) {
        console.warn(`[DELETE] S3 object removal warning (${doc.s3_key}):`, s3Err.message);
      }
    } else if (doc.file_path) {
      try {
        if (fs.existsSync(doc.file_path)) {
          fs.unlinkSync(doc.file_path);
          console.log(`[DELETE] Removed local file: ${doc.file_path}`);
        }
      } catch (fileErr) {
        console.warn(`[DELETE] Could not remove local file ${doc.file_path}:`, fileErr.message);
      }
    }

    generateDraftData(companyId);
    logAudit(req, 'DOCUMENT_DELETED', 'document', req.params.id,
      `${req.user.name} deleted document: ${doc.name}`,
      { companyId, doc_type: doc.doc_type, file_path: doc.file_path });

    // Notify reviewer/issuer
    const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
    const notifUser = db.getUsers().find(u => u.role === notifRole);
    if (notifUser) {
      db.addNotification({
        recipient_role: notifRole,
        recipient_email: notifUser.email,
        message: `${req.user.name} deleted document: ${doc.name}`,
        related_section: 'documents',
        type: 'document_deletion'
      });
    }

    res.json({ message: 'Document deleted successfully.', id: req.params.id });
  } catch (err) {
    console.error('[DELETE] Error:', err.message);
    res.status(500).json({ message: 'Server error deleting document.' });
  }
});
app.put('/api/documents/:id/verify', authenticateToken, (req, res) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only merchant bankers (reviewers) can verify documents.' });
  }
  const { status, remarks } = req.body;
  const valid = ['under_review', 'verified', 'changes_requested'];
  if (!status || !valid.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Allowed: ${valid.join(', ')}` });
  }

  const doc = db.verifyDocument(req.params.id, req.user.email, req.user.name, status, remarks || '');
  if (!doc) return res.status(404).json({ message: 'Document not found.' });

  logAudit(req, 'DOCUMENT_VERIFIED', 'document', doc.id,
    `${req.user.name} set document status to ${status} for ${doc.name}.`,
    { doc_type: doc.doc_type, status, remarks, companyId: doc.companyId }
  );

  const issuer = db.getUsers().find(u => u.role === 'issuer');
  if (issuer) {
    const statusText = status === 'verified' 
      ? `verified by merchant banker ${req.user.name}`
      : status === 'changes_requested'
      ? `marked as changes requested by ${req.user.name}`
      : `placed under review by ${req.user.name}`;

    db.addNotification({
      recipient_role: 'issuer',
      recipient_email: issuer.email,
      message: `Document "${doc.name}" was ${statusText}.${remarks ? ` Remarks: "${remarks}"` : ''}`,
      related_section: 'documents',
      type: 'document_verification'
    });
  }

  res.json({ message: 'Document verification updated successfully.', document: doc });
});

// ─── DRAFTS ───────────────────────────────────────────────────────────────────

app.get('/api/drafts/:companyId', authenticateToken, (req, res) => {
  res.json(db.getDrafts(req.params.companyId));
});

app.post('/api/drafts/:companyId/generate', authenticateToken, (req, res) => {
  const { companyId } = req.params;
  const section = req.query.section;
  const updatedDrafts = generateDraftData(companyId, section);
  logAudit(req, 'DRAFT_REGENERATED', 'draft', companyId, `${req.user.name} triggered draft regeneration${section ? ` for section: ${section}` : ' for all sections'}.`, { section, companyId });
  res.json({ message: 'Draft regenerated successfully.', drafts: updatedDrafts });
});

app.put('/api/drafts/:companyId/:sectionKey/status', authenticateToken, (req, res) => {
  const { companyId, sectionKey } = req.params;
  const { status } = req.body;
  try {
    const updated = db.updateSectionStatus(companyId, sectionKey, status, req.user.role);
    logAudit(req, status === 'certified' ? 'SECTION_CERTIFIED' : 'SECTION_STATUS_UPDATED', 'draft_section', sectionKey, `${req.user.name} changed ${sectionKey} status to ${status}.`, { companyId, sectionKey, status });
    // Notify the other party
    const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
    const notifUser = db.getUsers().find(u => u.role === notifRole);
    if (notifUser && status === 'certified') {
      db.addNotification({ recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} certified the ${sectionKey.replace(/_/g, ' ')} section.`, related_section: sectionKey, type: 'section_certified' });
    }
    res.json(updated);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

app.get('/api/drafts/:companyId/gap-report', authenticateToken, (req, res) => {
  const companyId = req.params.companyId;
  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  res.json(computeGapReport(companyId, intake, docs));
});

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

app.get('/api/comments/:sectionId', authenticateToken, (req, res) => {
  res.json(db.getComments(req.params.sectionId));
});

app.post('/api/comments/:sectionId', authenticateToken, (req, res) => {
  const { sectionId } = req.params;
  const { content, type, block_id, parent_id } = req.body;
  const comment = db.addComment(sectionId, content, type, req.user.name, req.user.role, block_id, parent_id);
  logAudit(req, 'COMMENT_ADDED', 'draft_section', sectionId, `${req.user.name} added a ${type} on ${sectionId}.`, { content: content.substring(0, 100), type });
  const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
  const notifUser = db.getUsers().find(u => u.role === notifRole);
  if (notifUser) {
    db.addNotification({ recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} added a ${type === 'clarification_requested' ? 'clarification request' : 'comment'} on ${sectionId.replace(/_/g, ' ')}: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`, related_section: sectionId, type: 'comment' });
  }
  res.json(comment);
});

app.put('/api/comments/:commentId/resolve', authenticateToken, (req, res) => {
  const comment = db.resolveComment(req.params.commentId);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  logAudit(req, 'COMMENT_RESOLVED', 'comment', req.params.commentId, `${req.user.name} resolved a comment on ${comment.section_id}.`, {});
  res.json(comment);
});

app.put('/api/comments/:commentId', authenticateToken, (req, res) => {
  const { content } = req.body;
  const comment = db.editComment(req.params.commentId, content);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  logAudit(req, 'COMMENT_EDITED', 'comment', req.params.commentId, `${req.user.name} edited a comment.`, { content: content.substring(0, 100) });
  res.json(comment);
});

app.delete('/api/comments/:commentId', authenticateToken, (req, res) => {
  const success = db.deleteComment(req.params.commentId);
  if (!success) return res.status(404).json({ message: 'Comment not found' });
  logAudit(req, 'COMMENT_DELETED', 'comment', req.params.commentId, `${req.user.name} deleted a comment.`, {});
  res.json({ message: 'Comment deleted successfully' });
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

app.get('/api/notifications', authenticateToken, (req, res) => {
  const notifs = db.getNotifications(req.user.email, req.user.role);
  res.json(notifs);
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notif = db.markNotificationRead(req.params.id);
  res.json(notif || {});
});

app.put('/api/notifications/mark-all-read', authenticateToken, (req, res) => {
  db.markAllNotificationsRead(req.user.email, req.user.role);
  res.json({ message: 'All notifications marked as read.' });
});

app.post('/api/notifications', authenticateToken, (req, res) => {
  const notif = db.addNotification(req.body);
  res.json(notif);
});

// ─── SEBI NOTICES ─────────────────────────────────────────────────────────────

app.get('/api/sebi-notices', authenticateToken, (req, res) => {
  const notices = db.getSebiNotices();
  const meta = db.getSebiNoticesMeta();
  res.json({ notices, meta });
});

app.post('/api/sebi-notices/refresh', authenticateToken, async (req, res) => {
  logAudit(req, 'SEBI_REFRESH', 'sebi_notices', 'global', `${req.user.name} manually triggered SEBI notices refresh.`, {});
  try {
    const notices = await fetchSebiNoticesFromRSS();
    const meta = db.getSebiNoticesMeta();
    res.json({ notices, meta, message: `Fetched ${notices.length} notices from SEBI.` });
  } catch (err) {
    res.status(500).json({ message: 'Failed to refresh SEBI notices.', error: err.message });
  }
});

// Vercel Cron replacement for the in-process 6-hourly schedule. This route is
// publicly reachable, so it is gated on CRON_SECRET: Vercel sends it as a bearer
// token, and without it an anonymous caller could hammer the SEBI feed.
app.get('/api/cron/sebi-refresh', async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }
  try {
    const notices = await fetchSebiNoticesFromRSS();
    await flushDb();
    console.log(`[SEBI] Cron refresh fetched ${notices.length} notices`);
    res.json({ ok: true, count: notices.length });
  } catch (err) {
    console.error('[SEBI] Cron refresh failed:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

app.get('/api/audit-logs', authenticateToken, (req, res) => {
  if (req.user.role !== 'reviewer') return res.status(403).json({ message: 'Only reviewers can access audit logs.' });
  const companyId = req.query.companyId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = (req.query.search || '').toLowerCase();

  let logs = db.getAuditLogs(companyId ? { companyId } : {});
  
  if (search) {
    logs = logs.filter(log => 
      (log.action && log.action.toLowerCase().includes(search)) ||
      (log.description && log.description.toLowerCase().includes(search)) ||
      (log.actor_name && log.actor_name.toLowerCase().includes(search))
    );
  }

  const total = logs.length;
  const startIndex = (page - 1) * limit;
  const paginatedLogs = logs.slice(startIndex, startIndex + limit);

  res.json({ logs: paginatedLogs, total, page, limit });
});

// ─── IPO READINESS (Gemini-powered) ──────────────────────────────────────────

app.get('/api/companies/:id/ipo-readiness', authenticateToken, async (req, res) => {
  const companyId = req.params.id;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });

  try {
    const intake = db.getIntake(companyId);
    const docs = db.getDocuments(companyId);
    const drafts = db.getDrafts(companyId);
    const gapReport = computeGapReport(companyId, intake, docs);
    const invitations = db.getInvitations(companyId);
    const sections = Object.keys(drafts);
    const certifiedCount = sections.reduce((acc, s) => acc + (drafts[s].status === 'certified' ? 1 : 0), 0);

    // Saved reviewer verifications. Read before scoring, not after: the whole
    // point of a merchant banker signing off on a milestone is that it should
    // move the score.
    const savedReadiness = db.getIpoReadiness(companyId) || {};
    const itemStatuses = savedReadiness.items || {};

    // ── Category scores ──────────────────────────────────────────────────────
    // Each is graduated rather than pass/fail, so that partial progress shows up.
    // A score that only moves when a whole category flips reads as broken to the
    // user filling the form in one field at a time.

    // Financials: credit each disclosed figure instead of requiring two specific
    // ones. Previously this was 40 or 85 with nothing in between, so filling in
    // four of five financial fields moved the needle not at all.
    const finFields = ['revenue_fy25', 'net_worth', 'pat_fy25', 'ebitda_fy25', 'total_debt'];
    const finPresent = finFields.filter((f) => {
      const v = intake.financials?.[f];
      return v !== undefined && v !== null && String(v).trim() !== '';
    }).length;
    const finScore = Math.round(30 + (finPresent / finFields.length) * 70);

    // Documents: measure against the document types an SME DRHP actually needs,
    // not against however many files happen to be uploaded. The old ratio
    // (confirmed / uploaded) *fell* when a user uploaded a new document, which
    // punished exactly the action the page asks for. A confirmed doc counts full,
    // an uploaded-but-unconfirmed one counts half.
    const EXPECTED_DOC_TYPES = [
      'incorporation_certificate', 'audited_financials', 'cap_table',
      'board_resolution', 'gst_returns'
    ];
    const docCredit = EXPECTED_DOC_TYPES.reduce((acc, t) => {
      const forType = docs.filter((d) => d.doc_type === t);
      if (forType.some((d) => d.status === 'confirmed')) return acc + 1;
      if (forType.length > 0) return acc + 0.5;
      return acc;
    }, 0);
    const docScore = Math.round((docCredit / EXPECTED_DOC_TYPES.length) * 100);

    const draftScore = Math.round((certifiedCount / Math.max(sections.length, 1)) * 100);
    const gapScore = Math.max(0, 100 - gapReport.length * 20);
    const bankerAccepted = invitations.some(i => i.status === 'accepted');
    const bankerScore = bankerAccepted ? 100 : (invitations.length > 0 ? 50 : 10);

    // Governance: graduated across the fields that actually evidence it.
    const govFields = [
      intake.capital_structure?.promoter_holding_pct,
      intake.capital_structure?.total_shares,
      intake.company?.independent_directors,
      intake.company?.board_size
    ];
    const govPresent = govFields.filter((v) => v !== undefined && v !== null && String(v).trim() !== '').length;
    const govScore = Math.round(40 + (govPresent / govFields.length) * 60);

    // Reviewer verification: the merchant banker's sign-off on each milestone.
    // This category was missing entirely — itemStatuses was read only to render
    // the checklist, so a banker could verify all six milestones and watch the
    // score sit unchanged. Weighted terminal states so "verified" outranks
    // "submitted for review".
    const ITEM_KEYS = [
      'board_governance', 'audited_financials_3yr', 'cap_table_verification',
      'sebi_icdr_disclosures', 'merchant_banker_appointment', 'chapter_certifications'
    ];
    const STATUS_CREDIT = {
      completed: 1, verified: 1, submitted_for_review: 0.5,
      in_progress: 0.25, needs_changes: 0, not_started: 0
    };
    const verificationCredit = ITEM_KEYS.reduce(
      (acc, k) => acc + (STATUS_CREDIT[itemStatuses[k]?.status] ?? 0), 0
    );
    const verificationScore = Math.round((verificationCredit / ITEM_KEYS.length) * 100);

    // Weights sum to 1.0. Verification gets 15% — meaningful enough that a full
    // banker sign-off is visible, without letting it alone carry a company that
    // has filed nothing.
    const overall_score = Math.round(
      finScore * 0.18 +
      docScore * 0.17 +
      draftScore * 0.20 +
      gapScore * 0.15 +
      bankerScore * 0.08 +
      govScore * 0.07 +
      verificationScore * 0.15
    );

    let overall_label = 'Needs Work';
    if (overall_score >= 85) overall_label = 'Excellent';
    else if (overall_score >= 70) overall_label = 'Good';
    else if (overall_score >= 50) overall_label = 'Fair';
    else if (overall_score < 35) overall_label = 'Critical';

    const milestoneItems = [
      { key: 'board_governance', title: 'Board Governance & Independent Directors', category: 'governance', status: itemStatuses.board_governance?.status || (govScore > 70 ? 'completed' : 'in_progress'), verified_by: itemStatuses.board_governance?.updated_by_name || null },
      { key: 'audited_financials_3yr', title: '3-Year Audited Financial Statements', category: 'financials', status: itemStatuses.audited_financials_3yr?.status || (docs.some(d => d.doc_type === 'audited_financials' && d.status === 'confirmed') ? 'verified' : 'in_progress'), verified_by: itemStatuses.audited_financials_3yr?.updated_by_name || null },
      { key: 'cap_table_verification', title: 'Cap Table & Promoter Lock-In', category: 'compliance', status: itemStatuses.cap_table_verification?.status || (docs.some(d => d.doc_type === 'cap_table' && d.status === 'confirmed') ? 'verified' : 'needs_changes'), verified_by: itemStatuses.cap_table_verification?.updated_by_name || null },
      { key: 'sebi_icdr_disclosures', title: 'SEBI ICDR Fund Utilization Timeline', category: 'disclosures', status: itemStatuses.sebi_icdr_disclosures?.status || (gapReport.some(g => g.fieldName === 'objects.timeline') ? 'needs_changes' : 'completed'), verified_by: itemStatuses.sebi_icdr_disclosures?.updated_by_name || null },
      { key: 'merchant_banker_appointment', title: 'SEBI-Registered Merchant Banker Engagement', category: 'merchant_banker', status: itemStatuses.merchant_banker_appointment?.status || (bankerAccepted ? 'completed' : 'in_progress'), verified_by: itemStatuses.merchant_banker_appointment?.updated_by_name || null },
      { key: 'chapter_certifications', title: 'DRHP Chapter Certifications', category: 'certification', status: itemStatuses.chapter_certifications?.status || (certifiedCount === sections.length ? 'completed' : 'in_progress'), verified_by: itemStatuses.chapter_certifications?.updated_by_name || null }
    ];

    const resultPayload = {
      companyId,
      companyName: company.name,
      overall_score,
      overall_label,
      summary: `IPO readiness score is ${overall_score}/100. ${certifiedCount} of ${sections.length} draft chapters certified. ${bankerAccepted ? 'Merchant Banker active.' : 'Merchant Banker engagement pending.'}`,
      sections: {
        financial_disclosures: { score: finScore, status: finScore >= 75 ? 'ok' : 'warning', note: `${finPresent} of ${finFields.length} financial disclosures provided` },
        legal_compliance: { score: govScore, status: govScore >= 75 ? 'ok' : 'warning', note: 'Promoter holding & litigation records' },
        corporate_governance: { score: govScore, status: govScore >= 75 ? 'ok' : 'warning', note: `${govPresent} of ${govFields.length} governance fields provided` },
        document_completeness: { score: docScore, status: docScore >= 75 ? 'ok' : 'warning', note: `${docCredit} of ${EXPECTED_DOC_TYPES.length} required document types in place` },
        draft_readiness: { score: draftScore, status: draftScore >= 75 ? 'ok' : 'warning', note: `${certifiedCount} of ${sections.length} chapters certified` },
        merchant_banker_engagement: { score: bankerScore, status: bankerAccepted ? 'ok' : 'warning', note: bankerAccepted ? 'Banker engaged' : 'Invitation pending' },
        reviewer_verification: { score: verificationScore, status: verificationScore >= 75 ? 'ok' : 'warning', note: `${verificationCredit} of ${ITEM_KEYS.length} milestones signed off by the Merchant Banker` }
      },
      milestone_items: milestoneItems,
      top_gaps: gapReport.slice(0, 3).map(g => g.message),
      recommendations: [
        bankerAccepted ? 'Review draft chapters with engaged Merchant Banker.' : 'Appoint a SEBI-registered Merchant Banker from Invitations.',
        gapReport.length > 0 ? 'Resolve open data discrepancies in Intake Form.' : 'Proceed to final reviewer certification.',
        certifiedCount < sections.length ? 'Complete section certifications in Reviewer Workspace.' : 'Export certified DRHP prospectus for SEBI submission.'
      ],
      disclaimer: 'IPO Readiness scores and AI insights are informational tools designed for preparation assistance and do not constitute legal, financial, SEBI regulatory, or merchant banking certification.',
      computed_at: new Date().toISOString()
    };

    db.saveIpoReadiness(companyId, resultPayload);
    logAudit(req, 'IPO_READINESS_COMPUTED', 'ipo_readiness', companyId, `${req.user.name} checked IPO readiness. Score: ${overall_score}/100`, { score: overall_score });
    res.json(resultPayload);
  } catch (err) {
    console.error('[IPO Readiness] Calculation error:', err.message);
    const cached = db.getIpoReadiness(companyId);
    if (cached) return res.json({ ...cached, stale: true });
    res.status(500).json({ message: 'Error calculating readiness', error: err.message });
  }
});

app.put('/api/companies/:id/ipo-readiness/item-status', authenticateToken, (req, res) => {
  const companyId = req.params.id;
  const { itemKey, status, remarks } = req.body;
  const validStatuses = ['not_started', 'in_progress', 'submitted_for_review', 'verified', 'needs_changes', 'completed'];

  if (!itemKey || !status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid parameters. Status must be one of: ${validStatuses.join(', ')}` });
  }

  // Only merchant bankers (reviewers) can mark item as verified or completed
  if ((status === 'verified' || status === 'completed') && req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only an authorized Merchant Banker can mark readiness items as verified or completed.' });
  }

  const updatedReadiness = db.updateIpoReadinessItemStatus(companyId, itemKey, status, req.user.email, req.user.name, remarks || '');

  logAudit(req, 'READINESS_ITEM_UPDATED', 'ipo_readiness', companyId, `${req.user.name} updated readiness item "${itemKey}" status to "${status}".`, { itemKey, status, remarks });

  const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
  const recipient = db.getUsers().find(u => u.role === notifRole);
  if (recipient) {
    db.addNotification({
      recipient_role: notifRole,
      recipient_email: recipient.email,
      message: `${req.user.name} updated IPO readiness item "${itemKey.replace(/_/g, ' ')}" to "${status.replace(/_/g, ' ')}".`,
      related_section: 'dashboard',
      type: 'readiness_update'
    });
  }

  res.json({ message: 'Readiness item status updated successfully.', readiness: updatedReadiness });
});

// ─── AI CHATBOT (Gemini) ──────────────────────────────────────────────────────

app.post('/api/chatbot/query', authenticateToken, async (req, res) => {
  const { question, history = [] } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ message: 'Question is required.' });

  const companyId = req.user.companyId || 'aarav-precision';
  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  const drafts = db.getDrafts(companyId);
  const gapReport = computeGapReport(companyId, intake, docs);
  const company = db.getCompany(companyId);

  const sections = Object.keys(drafts);
  const certifiedCount = sections.reduce((acc, s) => acc + (drafts[s].status === 'certified' ? 1 : 0), 0);

  const systemContext = `You are IPO Pilot AI Assistant, a helpful expert assistant for SME IPO preparation aligned with SEBI ICDR Regulations.

You are assisting ${req.user.name} (${req.user.role}) for company: ${company?.name || companyId}.

Current Status:
- Sections: ${certifiedCount} of ${sections.length} certified
- Open gaps/inconsistencies: ${gapReport.length}
- Documents: ${docs.length} uploaded (${docs.filter(d => d.status === 'confirmed').length} confirmed)
- Revenue FY25 (Intake): INR ${intake.financials?.revenue_fy25 || 'N/A'}
- Amount to raise: INR ${intake.objects?.amount_to_raise || 'N/A'}
- Pending sections: ${sections.filter(s => drafts[s].status !== 'certified').join(', ') || 'None'}

Key gaps: ${gapReport.map(g => g.message).join('; ') || 'None detected'}

Rules:
1. Be concise, accurate, and helpful.
2. Do NOT fabricate regulatory rules or financial facts.
3. Always add a disclaimer when giving regulatory guidance.
4. Format responses clearly using markdown where helpful.
5. If asked about something outside IPO/SEBI/company data, politely redirect.

IMPORTANT DISCLAIMER: Your responses are informational only and do not constitute legal, compliance, financial, or merchant-banking advice.`;

  try {
    // Retries transient overload/rate-limit failures and falls through to a
    // sibling model before giving up. Without this a busy model could hold the
    // request open for minutes (the SDK retries internally with no deadline).
    let modelUsed = GEMINI_MODEL;
    const result = await callGemini(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: { role: 'system', parts: [{ text: systemContext }] }
      });

      // Build conversation history for multi-turn context
      const chatHistory = history.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({ history: chatHistory });
      return chat.sendMessage(question);
    }, { label: 'chatbot', onModel: (m) => { modelUsed = m; } });

    const answer = result.response.text();

    res.json({ answer, model: modelUsed });
  } catch (err) {
    console.warn('[Chatbot] Gemini API unavailable or rate-limited:', err.message);

    // Smart fallback answer generator using live company data
    const q = question.toLowerCase();
    let answer = '';

    if (q.includes('pending') || q.includes('certif')) {
      const pending = sections.filter(s => drafts[s].status !== 'certified').map(s => s.replace(/_/g, ' '));
      answer = pending.length > 0
        ? `There are ${pending.length} sections pending certification: ${pending.join(', ')}. ${certifiedCount} of ${sections.length} chapters are currently certified.`
        : 'All chapters of your DRHP draft have been certified by the Merchant Banker!';
    } else if (q.includes('gap') || q.includes('mismatch') || q.includes('inconsisten')) {
      if (gapReport.length === 0) {
        answer = 'No inconsistencies or disclosure gaps detected. Your intake data matches all uploaded documents.';
      } else {
        answer = `Found ${gapReport.length} open discrepancy/gap issue(s):\n\n` +
          gapReport.map(g => `• **${g.severity.toUpperCase()}**: ${g.message}`).join('\n');
      }
    } else if (q.includes('doc') || q.includes('upload') || q.includes('file')) {
      const confirmed = docs.filter(d => d.status === 'confirmed').length;
      answer = `You have ${docs.length} uploaded document(s) (${confirmed} confirmed):\n\n` +
        docs.map(d => `• **${d.name}** (${d.doc_type.replace(/_/g, ' ')}) — Status: ${d.status}, OCR: ${d.ocr_status || 'completed'}`).join('\n');
    } else if (q.includes('status') || q.includes('overview') || q.includes('summary') || q.includes('readiness')) {
      answer = `**IPO Draft Status Overview for ${company?.name || 'Company'}**:\n` +
        `• **Chapter Certifications**: ${certifiedCount} of ${sections.length} certified\n` +
        `• **Documents Uploaded**: ${docs.length} (${docs.filter(d => d.status === 'confirmed').length} confirmed)\n` +
        `• **Open Gaps**: ${gapReport.length} discrepancy issues\n` +
        `• **Financial Revenue (FY25)**: ₹${intake.financials?.revenue_fy25 || 'N/A'}\n` +
        `• **Issue Amount**: ₹${intake.objects?.amount_to_raise || 'N/A'}`;
    } else {
      answer = `Here is key details for **${company?.name || 'Aarav Precision Engineering'}**:\n\n` +
        `• **Industry**: ${intake.company_details?.industry_type || 'Precision Engineering'}\n` +
        `• **Revenue (FY25)**: ₹${intake.financials?.revenue_fy25 || '12.5 Cr'}\n` +
        `• **Draft Progress**: ${certifiedCount}/${sections.length} chapters certified\n\n` +
        `*(Note: Gemini API rate limit reached on free tier. Responded using real-time database intake context)*`;
    }

    res.json({ answer, model: 'local-fallback' });
  }
});

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────

app.get('/api/notifications', authenticateToken, (req, res) => {
  const notifs = db.getNotifications(req.user.email, req.user.role);
  res.json(notifs);
});

app.put('/api/notifications/mark-all-read', authenticateToken, (req, res) => {
  db.markAllNotificationsRead(req.user.email, req.user.role);
  res.json({ message: 'All notifications marked as read.' });
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notif = db.markNotificationRead(req.params.id);
  if (!notif) return res.status(404).json({ message: 'Notification not found.' });
  res.json({ message: 'Notification marked as read.', notification: notif });
});

app.post('/api/notifications', authenticateToken, (req, res) => {
  const notif = db.addNotification(req.body);
  res.json(notif);
});

// ─── EXPORT (Real DOCX) ───────────────────────────────────────────────────────

app.get('/api/export/:companyId/docx', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  const drafts = db.getDrafts(companyId);
  const sections = Object.keys(drafts);
  const allCertified = sections.every(sec => drafts[sec].status === 'certified');
  const watermarkText = allCertified ? 'CERTIFIED COPY - CONFIDENTIAL' : 'DRAFT — PENDING PROFESSIONAL REVIEW (AI-ASSISTED)';

  const docElements = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1000, after: 300 }, children: [new TextRun({ text: 'DRAFT OFFER DOCUMENT', bold: true, size: 32, color: '1e293b' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 }, children: [new TextRun({ text: company.name.toUpperCase(), bold: true, size: 40, color: '4f46e5' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 }, children: [new TextRun({ text: 'Prepared Aligned with SEBI (ICDR) Regulations for Listing on SME Exchange', italic: true, size: 24, color: '64748b' })] }),
    new Paragraph({ spacing: { before: 400, after: 400 }, children: [
      new TextRun({ text: 'IMPORTANT REGULATORY DISCLAIMER\n', bold: true, color: 'dc2626', size: 22 }),
      new TextRun({ text: `Status: ${watermarkText}\n\n`, bold: true, color: allCertified ? '10b981' : 'dc2626', size: 20 }),
      new TextRun({ text: 'This document is an AI-assisted draft generated by IPO Pilot AI based on promoter intake disclosures. It does NOT constitute a final legal prospectus, and must be reviewed, finalized, and certified by a registered Merchant Banker and legal counsel prior to filing with SEBI, BSE SME, or NSE Emerge. AI outputs are informational only and do not constitute legal, compliance, financial, or merchant-banking advice.', italic: true, size: 18, color: '334155' })
    ]}),
    new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'Table of Chapters', bold: true, size: 28, color: '1e293b' })] })
  ];

  const sectionMapping = {
    business_overview: 'Chapter 1: Business Overview',
    risk_factors: 'Chapter 2: Risk Factors',
    objects: 'Chapter 3: Objects of the Issue',
    capital_structure: 'Chapter 4: Capital Structure',
    related_party: 'Chapter 5: Related Party Transactions',
    litigation: 'Chapter 6: Litigation & Legal Proceedings',
    promoter_details: 'Chapter 7: Promoter & Management Details'
  };

  sections.forEach(secKey => {
    const chapterTitle = sectionMapping[secKey] || secKey.toUpperCase();
    const section = drafts[secKey];
    docElements.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 150 }, children: [
      new TextRun({ text: chapterTitle, bold: true, size: 24, color: '1e293b' }),
      new TextRun({ text: ` (${section.status.toUpperCase()})`, size: 16, color: section.status === 'certified' ? '10b981' : 'e11d48' })
    ]}));
    section.blocks.forEach(b => {
      docElements.push(new Paragraph({ spacing: { before: 100, after: 100 }, children: [
        new TextRun({ text: b.text, size: 22 }),
        new TextRun({ text: ` [Citations: ${b.citations.join(', ')}]`, italic: true, size: 16, color: '6366f1' }),
        new TextRun({ text: ` (${b.confidence.toUpperCase()} CONFIDENCE)`, bold: true, size: 14, color: b.confidence === 'high' ? '10b981' : b.confidence === 'medium' ? 'f59e0b' : 'ef4444' })
      ]}));
    });
  });

  // Add generated-at footer
  docElements.push(new Paragraph({ spacing: { before: 400 }, children: [
    new TextRun({ text: `\nGenerated by IPO Pilot AI — ${new Date().toLocaleString('en-IN')} — For professional review only`, italic: true, size: 16, color: '94a3b8' })
  ]}));

  const wordDoc = new Document({ sections: [{ properties: {}, children: docElements }] });
  const buffer = await Packer.toBuffer(wordDoc);

  logAudit(req, 'EXPORT_DOWNLOADED', 'export', companyId, `${req.user.name} downloaded DOCX export. Status: ${allCertified ? 'certified' : 'draft'}.`, { certified: allCertified, sections: sections.length });
  // Add notification for the other party
  const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
  const notifUser = db.getUsers().find(u => u.role === notifRole);
  if (notifUser) {
    db.addNotification({ recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} exported the draft prospectus document.`, related_section: 'export', type: 'export' });
  }

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=IPO_Draft_${companyId}_${Date.now()}.docx`);
  res.send(buffer);
});

app.get('/api/export/:companyId/pdf', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const company = db.getCompany(companyId);
  if (!company) return res.status(404).json({ message: 'Company not found' });
  const drafts = db.getDrafts(companyId);
  const sections = Object.keys(drafts);
  const allCertified = sections.every(sec => drafts[sec].status === 'certified');
  const watermarkText = allCertified ? 'CERTIFIED COPY - CONFIDENTIAL' : 'DRAFT — PENDING PROFESSIONAL REVIEW (AI-ASSISTED)';

  const doc = new PDFDocument({ margin: 50 });
  const filename = `IPO_Draft_${companyId}_${Date.now()}.pdf`;
  
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');
  
  doc.pipe(res);
  
  // Title Page
  doc.fontSize(24).font('Helvetica-Bold').text('DRAFT OFFER DOCUMENT', { align: 'center' }).moveDown(1);
  doc.fontSize(30).fillColor('#4f46e5').text(company.name.toUpperCase(), { align: 'center' }).moveDown(2);
  doc.fontSize(16).fillColor('#64748b').font('Helvetica-Oblique').text('Prepared Aligned with SEBI (ICDR) Regulations for Listing on SME Exchange', { align: 'center' }).moveDown(3);
  
  // Disclaimer
  doc.fontSize(14).fillColor('#dc2626').font('Helvetica-Bold').text('IMPORTANT REGULATORY DISCLAIMER').moveDown(0.5);
  doc.fontSize(12).fillColor(allCertified ? '#10b981' : '#dc2626').text(`Status: ${watermarkText}`).moveDown(0.5);
  doc.fontSize(10).fillColor('#334155').font('Helvetica-Oblique').text('This document is an AI-assisted draft generated by IPO Pilot AI based on promoter intake disclosures. It does NOT constitute a final legal prospectus, and must be reviewed, finalized, and certified by a registered Merchant Banker and legal counsel prior to filing with SEBI, BSE SME, or NSE Emerge. AI outputs are informational only and do not constitute legal, compliance, financial, or merchant-banking advice.').moveDown(2);
  
  doc.addPage();
  
  // Chapters
  const sectionMapping = {
    business_overview: 'Chapter 1: Business Overview',
    risk_factors: 'Chapter 2: Risk Factors',
    objects: 'Chapter 3: Objects of the Issue',
    capital_structure: 'Chapter 4: Capital Structure',
    related_party: 'Chapter 5: Related Party Transactions',
    litigation: 'Chapter 6: Litigation & Legal Proceedings',
    promoter_details: 'Chapter 7: Promoter & Management Details'
  };

  sections.forEach(secKey => {
    const chapterTitle = sectionMapping[secKey] || secKey.toUpperCase();
    const section = drafts[secKey];
    
    doc.fontSize(18).fillColor('#1e293b').font('Helvetica-Bold').text(chapterTitle, { continued: true });
    doc.fontSize(12).fillColor(section.status === 'certified' ? '#10b981' : '#e11d48').text(` (${section.status.toUpperCase()})`).moveDown(1);
    
    section.blocks.forEach(b => {
      doc.fontSize(12).fillColor('#000000').font('Helvetica').text(b.text, { align: 'justify' }).moveDown(0.5);
      doc.fontSize(10).fillColor('#6366f1').font('Helvetica-Oblique').text(`[Citations: ${b.citations.join(', ')}]`, { continued: true });
      doc.fontSize(8).fillColor(b.confidence === 'high' ? '#10b981' : b.confidence === 'medium' ? '#f59e0b' : '#ef4444').font('Helvetica-Bold').text(` (${b.confidence.toUpperCase()} CONFIDENCE)`).moveDown(1);
    });
    doc.moveDown(1);
  });
  
  doc.moveDown(2).fontSize(10).fillColor('#94a3b8').font('Helvetica-Oblique').text(`Generated by IPO Pilot AI — ${new Date().toLocaleString('en-IN')} — For professional review only`, { align: 'center' });
  
  doc.end();

  logAudit(req, 'EXPORT_DOWNLOADED', 'export', companyId, `${req.user.name} downloaded PDF export. Status: ${allCertified ? 'certified' : 'draft'}.`, { certified: allCertified, sections: sections.length });
  const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
  const notifUser = db.getUsers().find(u => u.role === notifRole);
  if (notifUser) {
    db.addNotification({ recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} exported the draft prospectus document as PDF.`, related_section: 'export', type: 'export' });
  }
});

// ─── MERCHANT BANKERS ─────────────────────────────────────────────────────────

app.get('/api/merchant-bankers', authenticateToken, (req, res) => {
  const { q } = req.query;
  const bankers = db.getMerchantBankers(q || '');
  res.json({ merchant_bankers: bankers, source: 'SEBI Registered Merchant Bankers List', source_url: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', attribution: 'Data sourced from SEBI official merchant banker registration records.', disclaimer: 'Registration status should be independently verified on the official SEBI website before engagement.' });
});

// ─── INVITATIONS ──────────────────────────────────────────────────────────────

// ─── TRANSACTIONAL EMAIL SENDER ──────────────────────────────────────────────

async function sendInvitationEmail(toEmail, bankerName, companyName, token, inviteId) {
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5173';
  const inviteLink = `${baseUrl}/invitations?token=${token}`;
  
  console.log(`================================================================`);
  console.log(`[TRANSACTIONAL EMAIL] SME IPO Review Invitation`);
  console.log(`Recipient: ${bankerName} <${toEmail}>`);
  console.log(`Company: ${companyName}`);
  console.log(`Action Link: ${inviteLink}`);
  console.log(`Token Expiry: 7 Days`);
  console.log(`================================================================`);

  return { success: true, link: inviteLink };
}

// ─── INVITATIONS ──────────────────────────────────────────────────────────────

app.get('/api/invitations', authenticateToken, (req, res) => {
  if (req.user.role === 'reviewer') {
    // Reviewer (merchant banker) only sees invitations specifically sent to them
    // Match by email or by the reviewer's user record
    const all = db.getInvitations();
    const reviewerEmail = req.user.email;
    const forReviewer = all.filter(inv =>
      inv.merchant_banker_email === reviewerEmail ||
      inv.invited_to_email === reviewerEmail
    );
    // Fallback: if no email match exists (legacy invitations), return all pending for demo
    res.json(forReviewer.length > 0 ? forReviewer : all.filter(inv => inv.status !== 'revoked'));
  } else {
    const companyId = req.user.companyId || 'aarav-precision';
    res.json(db.getInvitations(companyId));
  }
});

app.get('/api/invitations/verify-token', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ message: 'Token parameter is required.' });
  const inv = db.getInvitationByIdOrToken(token);
  if (!inv) return res.status(404).json({ message: 'Invitation not found or invalid token.' });
  if (new Date(inv.expires_at) < new Date()) {
    return res.status(410).json({ message: 'Invitation token has expired.', invitation: inv });
  }
  res.json({ valid: true, invitation: inv });
});

app.post('/api/invitations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'issuer') return res.status(403).json({ message: 'Only issuers can send invitations.' });
  const { merchant_banker_id, merchant_banker_name, message } = req.body;
  if (!merchant_banker_id) return res.status(400).json({ message: 'merchant_banker_id is required.' });
  
  const companyId = req.user.companyId || 'aarav-precision';
  const company = db.getCompany(companyId) || { name: 'Aarav Precision Engineering Pvt Ltd' };
  const mb = db.getMerchantBankers().find(b => b.id === merchant_banker_id);
  if (!mb) return res.status(404).json({ message: 'Merchant banker not found.' });

  const existingInvs = db.getInvitations(companyId);
  const existing = existingInvs.find(i => i.merchant_banker_id === merchant_banker_id);

  let invitation;
  if (existing) {
    const newToken = 'inv_token_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    invitation = db.updateInvitation(existing.id, {
      status: 'pending',
      token: newToken,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      message: message || existing.message
    });
  } else {
    invitation = db.addInvitation({
      company_id: companyId,
      company_name: company.name,
      invited_by_email: req.user.email,
      invited_by_name: req.user.name,
      merchant_banker_id,
      merchant_banker_name: mb.name,
      merchant_banker_reg_no: mb.registration_no,
      merchant_banker_email: 'priya@example.com',
      message: message || 'We would like to invite you to review our IPO draft document on IPO Pilot AI.',
      sebi_source: mb.sebi_source
    });
  }

  await sendInvitationEmail('priya@example.com', mb.name, company.name, invitation.token, invitation.id);

  logAudit(req, 'INVITATION_SENT', 'invitation', invitation.id,
    `${req.user.name} sent invitation to ${mb.name} (${mb.registration_no}).`,
    { merchant_banker_id, merchant_banker_name: mb.name, companyId, token: invitation.token }
  );

  const reviewer = db.getUsers().find(u => u.role === 'reviewer');
  if (reviewer) {
    db.addNotification({
      recipient_role: 'reviewer',
      recipient_email: reviewer.email,
      message: `${req.user.name} (${company.name}) sent an invitation to ${mb.name} (Reg: ${mb.registration_no}).`,
      related_section: 'invitation',
      type: 'invitation'
    });
  }

  res.status(201).json(invitation);
});

app.put('/api/invitations/:id/accept', authenticateToken, (req, res) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only an authorized Merchant Banker can accept invitations.' });
  }
  const updated = db.updateInvitation(req.params.id, {
    status: 'accepted',
    responded_by: req.user.email,
    responded_at: new Date().toISOString()
  });
  if (!updated) return res.status(404).json({ message: 'Invitation not found.' });

  logAudit(req, 'INVITATION_ACCEPTED', 'invitation', req.params.id,
    `${req.user.name} accepted merchant banker invitation for ${updated.company_name}.`,
    { companyId: updated.company_id }
  );

  const issuer = db.getUsers().find(u => u.role === 'issuer');
  if (issuer) {
    db.addNotification({
      recipient_role: 'issuer',
      recipient_email: issuer.email,
      message: `Merchant banker ${req.user.name} (${updated.merchant_banker_name}) accepted your invitation!`,
      related_section: 'invitation',
      type: 'invitation_accepted'
    });
  }

  res.json({ message: 'Invitation accepted successfully.', invitation: updated });
});

app.put('/api/invitations/:id/decline', authenticateToken, (req, res) => {
  if (req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only an authorized Merchant Banker can decline invitations.' });
  }
  const updated = db.updateInvitation(req.params.id, {
    status: 'declined',
    responded_by: req.user.email,
    responded_at: new Date().toISOString()
  });
  if (!updated) return res.status(404).json({ message: 'Invitation not found.' });

  logAudit(req, 'INVITATION_DECLINED', 'invitation', req.params.id,
    `${req.user.name} declined merchant banker invitation for ${updated.company_name}.`,
    { companyId: updated.company_id }
  );

  const issuer = db.getUsers().find(u => u.role === 'issuer');
  if (issuer) {
    db.addNotification({
      recipient_role: 'issuer',
      recipient_email: issuer.email,
      message: `Merchant banker ${req.user.name} (${updated.merchant_banker_name}) declined the invitation.`,
      related_section: 'invitation',
      type: 'invitation_declined'
    });
  }

  res.json({ message: 'Invitation declined.', invitation: updated });
});

app.put('/api/invitations/:id/revoke', authenticateToken, (req, res) => {
  if (req.user.role !== 'issuer') {
    return res.status(403).json({ message: 'Only issuers can revoke invitations.' });
  }
  const updated = db.updateInvitation(req.params.id, {
    status: 'revoked',
    revoked_by: req.user.email,
    revoked_at: new Date().toISOString()
  });
  if (!updated) return res.status(404).json({ message: 'Invitation not found.' });

  logAudit(req, 'INVITATION_REVOKED', 'invitation', req.params.id,
    `${req.user.name} revoked invitation to ${updated.merchant_banker_name}.`,
    { companyId: updated.company_id }
  );

  res.json({ message: 'Invitation revoked successfully.', invitation: updated });
});

// Generic status update route (used by some client calls)
app.put('/api/invitations/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'accepted', 'declined', 'revoked', 'expired'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Allowed: ${validStatuses.join(', ')}` });
  }
  if (status === 'accepted' && req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only reviewers can accept invitations.' });
  }
  if (status === 'declined' && req.user.role !== 'reviewer') {
    return res.status(403).json({ message: 'Only reviewers can decline invitations.' });
  }
  if ((status === 'revoked') && req.user.role !== 'issuer') {
    return res.status(403).json({ message: 'Only issuers can revoke invitations.' });
  }
  const updates = { status, responded_at: new Date().toISOString(), responded_by: req.user.email };
  const updated = db.updateInvitation(req.params.id, updates);
  if (!updated) return res.status(404).json({ message: 'Invitation not found.' });
  logAudit(req, `INVITATION_${status.toUpperCase()}`, 'invitation', req.params.id,
    `${req.user.name} changed invitation status to ${status}.`,
    { companyId: updated.company_id }
  );
  res.json({ message: `Invitation ${status} successfully.`, invitation: updated });
});

app.post('/api/invitations/:id/resend', authenticateToken, async (req, res) => {
  if (req.user.role !== 'issuer') {
    return res.status(403).json({ message: 'Only issuers can resend invitations.' });
  }
  const newToken = 'inv_token_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const updated = db.updateInvitation(req.params.id, {
    status: 'pending',
    token: newToken,
    expires_at: newExpiry,
    resent_at: new Date().toISOString()
  });
  if (!updated) return res.status(404).json({ message: 'Invitation not found.' });

  await sendInvitationEmail('priya@example.com', updated.merchant_banker_name, updated.company_name, newToken, updated.id);

  logAudit(req, 'INVITATION_RESENT', 'invitation', req.params.id,
    `${req.user.name} resent invitation to ${updated.merchant_banker_name}.`,
    { companyId: updated.company_id, token: newToken }
  );

  res.json({ message: 'Invitation resent successfully.', invitation: updated });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

// On Vercel each request runs in a short-lived function: there is no process to
// listen on a port, and the container can be frozen the moment a response is
// sent. So we export a handler instead of calling listen(), and every request
// waits for storage hydration before it touches the store.
const isServerless = Boolean(process.env.VERCEL);

let hydration = null;
function ensureHydrated() {
  if (!hydration) {
    hydration = initDb().catch((err) => {
      // Reset so the next invocation retries rather than serving an empty store
      // for the lifetime of a warm container.
      hydration = null;
      throw err;
    });
  }
  return hydration;
}

if (!isServerless) {
  // Hydrate the DynamoDB-backed store before accepting traffic, so the first request
  // never races an empty in-memory store.
  ensureHydrated()
    .then((usingDynamo) => {
      app.listen(PORT, () => {
        console.log(`IPO Pilot AI backend running on http://localhost:${PORT}`);
        console.log(`Storage: ${usingDynamo ? 'DynamoDB (live)' : 'local db.json'}`);
        console.log(`Gemini model: ${GEMINI_MODEL}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialise storage:', err);
      process.exit(1);
    });
}

// Vercel imports this module and invokes the default export per request. Waiting
// on ensureHydrated() here (rather than at import time) means a cold start that
// fails to reach DynamoDB returns 503 instead of serving an empty store.
export default async function handler(req, res) {
  try {
    await ensureHydrated();
  } catch (err) {
    console.error('Storage init failed:', err);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    // The bare "Storage unavailable" message left no way to tell a missing table
    // from a bad region from a denied IAM policy without digging through Vercel's
    // function logs. AWS error names/codes are classifications, not secrets, so
    // returning them is safe and turns a dead end into an actionable message.
    return res.end(JSON.stringify({
      message: 'Storage unavailable. Please retry.',
      reason: err?.name || 'UnknownError',
      detail: err?.message || String(err),
      hint: 'Check /api/health for which storage settings resolved.'
    }));
  }
  return app(req, res);
}
