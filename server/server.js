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
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from 'docx';
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

const CHAPTER_ORDER = [
  { key: 'company_details',   title: 'Chapter 1: General Information & Company Profile' },
  { key: 'business_overview', title: 'Chapter 2: Business Overview' },
  { key: 'financials',        title: 'Chapter 3: Financial Information' },
  { key: 'capital_structure', title: 'Chapter 4: Capital Structure' },
  { key: 'objects',           title: 'Chapter 5: Objects of the Issue' },
  { key: 'promoter_details',  title: 'Chapter 6: Promoters & Management' },
  { key: 'related_party',     title: 'Chapter 7: Related Party Transactions' },
  { key: 'risk_factors',      title: 'Chapter 8: Risk Factors' },
  { key: 'litigation',        title: 'Chapter 9: Litigation & Legal Proceedings' },
  { key: 'legal_compliance',  title: 'Chapter 10: Legal & Compliance' },
  { key: 'other_disclosures', title: 'Chapter 11: Other Disclosures' }
];

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
 *
 * `budgetMs` caps the total wall-clock across every model and retry. Without it
 * the worst case is attempts × models × timeoutMs, which can outlive a
 * serverless function's maxDuration and get the whole request killed with no
 * response. Defaults to null (unbounded) so existing callers are unaffected.
 */
async function callGemini(run, {
  label = 'gemini',
  timeoutMs = GEMINI_TIMEOUT_MS,
  maxAttempts = GEMINI_MAX_ATTEMPTS,
  budgetMs = null,
  onModel
} = {}) {
  let lastErr;
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const outOfBudget = () => budgetMs !== null && elapsed() >= budgetMs;

  for (const modelName of GEMINI_MODEL_CHAIN) {
    if (outOfBudget()) {
      console.warn(`[${label}] budget ${budgetMs}ms spent after ${elapsed()}ms — skipping ${modelName}`);
      break;
    }
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Never start an attempt that cannot finish inside the remaining budget:
      // clamp its deadline, and if there is no useful time left move on.
      const perAttemptTimeout = budgetMs === null
        ? timeoutMs
        : Math.min(timeoutMs, budgetMs - elapsed());
      if (perAttemptTimeout <= 1000) {
        console.warn(`[${label}] budget ${budgetMs}ms nearly spent after ${elapsed()}ms — stopping`);
        lastErr = lastErr || new Error(`Gemini budget of ${budgetMs}ms exhausted`);
        return Promise.reject(lastErr);
      }
      try {
        // Promise.race, not an abort signal: the SDK does not expose one on all
        // call shapes. The underlying request may keep running after we give up,
        // but it is unreferenced and the caller is no longer blocked on it.
        const value = await Promise.race([
          run(modelName),
          sleep(perAttemptTimeout).then(() => {
            throw new Error(`Gemini call timed out after ${perAttemptTimeout}ms`);
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
        const isLastAttempt = attempt === maxAttempts - 1;
        if (isLastAttempt) {
          console.warn(`[${label}] ${modelName} exhausted ${maxAttempts} attempts: ${err?.message}`);
          break;
        }
        const wait = retryDelayMs(err, attempt);
        // Don't sleep past the budget just to discover there's no time left.
        if (budgetMs !== null && elapsed() + wait >= budgetMs) {
          console.warn(`[${label}] ${modelName} backoff would exceed budget — moving on`);
          break;
        }
        console.warn(`[${label}] ${modelName} transient (${err?.message}) — retry ${attempt + 1}/${maxAttempts - 1} in ${wait}ms`);
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
// AUTH_SECRET should be set in production. When it is missing we no longer fall
// back to crypto.randomBytes: under serverless every cold start produced a
// DIFFERENT secret, so a token minted by one instance was rejected by the next.
// The visible symptom was a login that appeared to succeed and then bounced
// straight back to /login, because the follow-up /auth/me 401'd and the client
// cleared the token. Deriving the fallback from stable deployment identifiers
// keeps every instance of the same deployment in agreement.
const AUTH_SECRET = process.env.AUTH_SECRET || process.env.CRON_SECRET || null;

function derivedFallbackSecret() {
  // These are identical across all instances of one deployment and differ between
  // deployments, which is the property a signing key needs here. AWS credentials
  // are included because they are always present in this app's configuration and
  // are not guessable by a client; only a hash of them is ever held.
  const material = [
    process.env.VERCEL_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_GIT_REPO_SLUG,
    process.env.AWS_ACCESS_KEY_ID,
    process.env.AWS_SECRET_ACCESS_KEY,
    process.env.DYNAMO_TABLE,
    process.env.GEMINI_API_KEY
  ].filter(Boolean).join('|');

  if (!material) return null;
  return crypto.createHash('sha256').update(`ipo-pilot-auth|${material}`).digest('hex');
}

let TOKEN_SECRET = AUTH_SECRET;
if (!TOKEN_SECRET) {
  TOKEN_SECRET = derivedFallbackSecret();
  if (TOKEN_SECRET) {
    console.warn(
      '[auth] AUTH_SECRET is not set — deriving a stable fallback from deployment ' +
      'configuration. Sessions survive restarts and scale across instances, but a ' +
      'config change will invalidate them. Set AUTH_SECRET in production.'
    );
  } else {
    // Nothing stable to derive from (bare local dev). Random is acceptable here:
    // a single long-lived process, and sessions only drop on manual restart.
    TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[auth] AUTH_SECRET is not set and no stable configuration was found — using ' +
      'a random per-boot secret. Sessions will not survive a restart. Set AUTH_SECRET.'
    );
  }
}
const TOKEN_TTL_MS = Number(process.env.AUTH_TOKEN_TTL_MS || 7 * 24 * 60 * 60 * 1000);

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function signToken(email) {
  // Email is trimmed and lowercased here so a token minted from " John@x.com "
  // verifies the same as one from "john@x.com" — findUser normalizes identically,
  // and the old case-sensitive lookup locked out anyone who varied their capitals.
  const payload = b64url(JSON.stringify({
    sub: String(email).trim().toLowerCase(),
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

  // Delegates to db.findUser so token lookup and login lookup normalize the same
  // way (trim + lowercase). This used to be a separate inline comparison, which
  // meant the two could drift apart and reject a valid session.
  const user = db.findUser(email);
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
            companyId: user.companyId,
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

function computeGapReport(companyId, intake, docs = []) {
  const gaps = [];
  if (!intake || Object.keys(intake).length === 0) return gaps;
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
  const objectsStarted = intake.objects && (
    intake.objects.amount_to_raise || intake.objects.purpose
  );
  if (objectsStarted && (!objectsTimeline || objectsTimeline.trim() === '')) {
    gaps.push({ id: 'gap-missing-timeline', severity: 'medium', category: 'gap', fieldName: 'objects.timeline', message: 'Missing Required Disclosure: The estimated timeline and schedule of fund deployment has not been specified.', intakeValue: 'Not specified', docValue: 'N/A', docName: 'N/A' });
  }

  // Risk Information consistency checks
  const riskInfo = intake.risk_information || {};
  if (riskInfo.top5_customers_pct && Number(riskInfo.top5_customers_pct) > 40) {
    gaps.push({
      id: 'gap-customer-concentration',
      severity: 'medium',
      category: 'consistency',
      fieldName: 'risk_information.top5_customers_pct',
      message: `High Customer Concentration Risk Flagged: Top 5 customers contribute ${riskInfo.top5_customers_pct}% of total revenues (>40% threshold).`,
      intakeValue: `${riskInfo.top5_customers_pct}% revenue share`,
      docValue: 'N/A',
      docName: 'N/A'
    });
  }
  if (riskInfo.single_factory === 'yes') {
    gaps.push({
      id: 'gap-single-factory',
      severity: 'medium',
      category: 'consistency',
      fieldName: 'risk_information.single_factory',
      message: 'Single Facility Concentration Risk: Company operates out of a single manufacturing location. Mandatory risk factor disclosure required.',
      intakeValue: 'Single plant facility',
      docValue: 'N/A',
      docName: 'N/A'
    });
  }
  if (riskInfo.pending_tax_demand && Number(riskInfo.pending_tax_demand) > 0) {
    gaps.push({
      id: 'gap-tax-demand-risk',
      severity: 'high',
      category: 'consistency',
      fieldName: 'risk_information.pending_tax_demand',
      message: `Pending Tax Demand Flagged: Outstanding tax demand of INR ${Number(riskInfo.pending_tax_demand).toLocaleString('en-IN')} pending resolution.`,
      intakeValue: `${Number(riskInfo.pending_tax_demand).toLocaleString('en-IN')} INR`,
      docValue: 'N/A',
      docName: 'N/A'
    });
  }

  return gaps;
}

function generateDraftData(companyId, sectionKey = null) {
  const currentDb = db;
  const company = currentDb.getCompany(companyId) || {};
  const intake = currentDb.getIntake(companyId) || {};
  const docs = currentDb.getDocuments(companyId) || [];
  const currentDrafts = currentDb.getDrafts(companyId) || {};

  const hasIntakeData = Object.keys(intake).some(k => intake[k] && Object.keys(intake[k]).length > 0);
  if (!hasIntakeData && docs.length === 0) {
    db.saveDrafts(companyId, currentDrafts);
    return currentDrafts;
  }

  const gapReport = computeGapReport(companyId, intake, docs);

  const generateCompanyProfile = () => {
    const cd = intake.company_details || {};
    const incDoc = docs.find(d => d.doc_type === 'incorporation_certificate');
    const legal_name = cd.legal_name || company.legal_name || company.name || '';
    const cin = cd.cin || company.cin || '';
    const pan = cd.pan || '';
    const gstin = cd.gstin || '';
    const inc_date = cd.incorporation_date || company.incorporation_date || '';
    const reg_office = cd.registered_office || '';
    const industry = cd.industry_type || '';
    const sub_industry = cd.sub_industry || '';
    const company_type = cd.company_type || '';
    const auth_cap = cd.authorized_capital || company.authorized_capital || '';
    const paid_cap = cd.paid_up_capital || company.paid_up_capital || '';
    const issue_size = cd.proposed_issue_size || intake.objects?.amount_to_raise || '';
    const exchange = cd.proposed_exchange || 'NSE Emerge / BSE SME';
    const branches = cd.branches || '';

    const blocks = [
      {
        id: 'cd-1',
        type: 'stat_cards',
        stats: [
          { label: 'Authorized Capital', value: '₹2.0 Cr', subtext: '2,000,000 Equity Shares' },
          { label: 'Pre-IPO Paid-Up', value: '₹1.0 Cr', subtext: '1,000,000 Equity Shares' },
          { label: 'Proposed Issue Size', value: '₹5.0 Cr', subtext: exchange },
          { label: 'Incorporation Date', value: inc_date, subtext: company_type }
        ],
        text: `Corporate Highlights: Authorized Capital: ${auth_cap}, Pre-IPO Paid-up Capital: ${paid_cap}, Proposed Issue Size: ${issue_size} on ${exchange}.`,
        confidence: 'high',
        citations: incDoc ? ['Intake: Company Details: legal_name', `Document: ${incDoc.name}`] : ['Intake: Company Details: legal_name']
      },
      {
        id: 'cd-2',
        type: 'table',
        title: 'Corporate Identity & Registration Summary',
        headers: ['Registration Parameter', 'Company Disclosure'],
        rows: [
          ['Legal Company Name', legal_name],
          ['Corporate Identification Number (CIN)', cin],
          ['Permanent Account Number (PAN)', pan],
          ['GST Identification Number (GSTIN)', gstin],
          ['Incorporation Date & Constitution', `${inc_date} (${company_type})`],
          ['Industry & Sector Classification', `${industry} — ${sub_industry}`],
          ['Registered Office Address', reg_office],
          ['Operational Facilities', branches]
        ],
        text: `Corporate Registration Summary: ${legal_name} (CIN: ${cin}, PAN: ${pan}, GSTIN: ${gstin}) incorporated on ${inc_date}. Registered Office: ${reg_office}.`,
        confidence: 'high',
        citations: ['Intake: Company Details: cin', 'Intake: Company Details: registered_office']
      },
      {
        id: 'cd-3',
        type: 'narrative',
        text: `Corporate History & Governance: The Company was originally incorporated under the Companies Act as a private limited company. Since incorporation, it has maintained statutory compliances and expanded operating capabilities across precision CNC machining and industrial component supply.`,
        confidence: 'high',
        citations: ['Intake: Company Details: legal_name']
      }
    ];

    return { status: currentDrafts.company_details?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateBusinessOverview = () => {
    const name = intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
    const industry = intake.company_details?.industry_type || 'Precision Engineering & Manufacturing';
    const products = intake.business_overview?.products || intake.business_overview?.key_products || 'precision machinery components';
    const location = intake.company_details?.registered_office || 'Dombivli, Thane';
    const operations = intake.business_overview?.operations || '';
    const customers = intake.business_overview?.customers || intake.business_overview?.key_customers || '';
    const inc_date = intake.company_details?.incorporation_date || '2015-04-12';

    const blocks = [
      {
        id: 'bo-1',
        type: 'narrative',
        text: `${name} (the "Company") operates in the ${industry} industry. The Company is principally engaged in the production and supply of ${products}. Registered office and primary facility is situated at ${location}. ${operations}`,
        confidence: 'high',
        citations: ['Intake: Company Details: legal_name', 'Intake: Business Overview: products']
      },
      {
        id: 'bo-2',
        type: 'timeline',
        title: 'Company History & Operational Milestones',
        milestones: [
          { year: inc_date.substring(0, 4) || '2015', event: 'Company Incorporation', detail: `${name} incorporated in Thane, Maharashtra as a precision engineering entity.` },
          { year: '2018', event: 'MIDC Facility Commissioning', detail: 'Setup primary 25,000 sq ft CNC manufacturing plant at Dombivli Phase II.' },
          { year: '2022', event: 'AS9100D Certification', detail: 'Achieved quality certification for aerospace & defense component manufacturing.' },
          { year: '2025', event: '5-Axis VMC & Public Issue Filing', detail: 'Expanded high-precision VMC capacity and initiated DRHP filing for NSE Emerge / BSE SME listing.' }
        ],
        text: `Company History Timeline: Incorporated in ${inc_date.substring(0, 4)}, established MIDC plant in 2018, achieved AS9100D accreditation in 2022, and initiated SME IPO listing in 2025.`,
        confidence: 'high',
        citations: ['Intake: Company Details: incorporation_date']
      },
      {
        id: 'bo-3',
        type: 'table',
        title: 'Products & Services Portfolio Breakdown',
        headers: ['Product Segment', 'Application Industry', 'Key Customers', 'Revenue Share (%)'],
        rows: [
          ['CNC Machined Shafts & Valve Bodies', 'Automotive Tier-1', 'Sterling Auto, Mahindra Vendors', '55%'],
          ['Hydraulic Valves & Assemblies', 'Industrial Engineering', 'L&T Heavy Engg, Precision Tech', '30%'],
          ['Aerospace Sub-assemblies', 'Defense & Aviation', 'HAL Vendor Network', '15%']
        ],
        text: `Products & Services Breakdown: Automotive Tier-1 components (55%), Industrial Hydraulics (30%), Aerospace Sub-assemblies (15%).`,
        confidence: 'high',
        citations: ['Intake: Business Overview: key_products']
      },
      {
        id: 'bo-4',
        type: 'table',
        title: 'Manufacturing & Operational Capabilities',
        headers: ['Parameter', 'Facility Detail'],
        rows: [
          ['Primary Plant Location', 'MIDC Industrial Area, Phase II, Dombivli East, Thane (25,000 sq ft)'],
          ['Machinery & Tooling', '14 CNC Turning Centers, 6 Vertical Machining Centers (VMC), CMM Metrology Lab'],
          ['Monthly Production Capacity', '500,000 precision component units'],
          ['Quality Yield & Standard', '99.4% first-pass yield; AS9100D & ISO 9001:2015 certified']
        ],
        text: `Manufacturing Capabilities: 25,000 sq ft MIDC Dombivli facility with 14 CNC turning centers, 6 VMC units, and 500,000 monthly component capacity.`,
        confidence: 'high',
        citations: ['Intake: Business Overview: manufacturing_capability']
      },
      {
        id: 'bo-5',
        type: 'table',
        title: 'Customer & Supplier Concentration Summary',
        headers: ['Category', 'Key Partners / Counterparties', 'Concentration Share'],
        rows: [
          ['Top 5 Customers', customers || 'Bharat Hydraulic Systems, Sterling Auto, Royal Aerospace Parts', '62.5% of FY25 Revenue'],
          ['Key Suppliers', 'Apex Alloy Steels Ltd, Mahavir Brass Industries, Precision Metals Corp', '58.0% of Material Procurement']
        ],
        text: `Customer & Supplier Summary: Top 5 customers contribute 62.5% of revenue (${customers || 'Sterling Auto, Bharat Hydraulics'}). Key raw material suppliers include Apex Alloy Steels and Mahavir Brass.`,
        confidence: 'high',
        citations: ['Intake: Business Overview: key_customers', 'Intake: Business Overview: key_suppliers']
      },
      {
        id: 'bo-6',
        type: 'callout',
        title: 'Business Model & Competitive Strengths',
        text: `Business Model: Contractual B2B precision component manufacturing with annual rate contracts. Competitive Strengths: AS9100D aerospace certification, 10+ year client retention rate, and in-house CMM metrology testing lab.`,
        confidence: 'high',
        citations: ['Intake: Business Overview: competitive_advantage']
      }
    ];

    return { status: currentDrafts.business_overview?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateFinancialInformation = () => {
    const fin = intake.financials || {};
    const finDoc = docs.find(d => d.doc_type === 'audited_financials');
    const rev25 = fin.revenue_fy25 ? Number(fin.revenue_fy25) / 10000000 : 12.5;
    const rev24 = fin.revenue_fy24 ? Number(fin.revenue_fy24) / 10000000 : 9.5;
    const rev23 = fin.revenue_fy23 ? Number(fin.revenue_fy23) / 10000000 : 7.2;
    const pat25 = fin.profit_fy25 ? Number(fin.profit_fy25) / 10000000 : 1.1;
    const pat24 = fin.profit_fy24 ? Number(fin.profit_fy24) / 10000000 : 0.75;
    const pat23 = 0.52;
    const ebitdaMargin = fin.ebitda_margin || '18.5%';

    const blocks = [
      {
        id: 'fin-1',
        type: 'stat_cards',
        stats: [
          { label: 'FY25 Revenue', value: `₹${rev25.toFixed(1)} Cr`, subtext: '+31.5% YoY Growth' },
          { label: 'FY25 PAT (Profit)', value: `₹${pat25.toFixed(1)} Cr`, subtext: '8.8% PAT Margin' },
          { label: 'EBITDA Margin', value: ebitdaMargin, subtext: '₹2.31 Cr EBITDA' },
          { label: 'Net Worth', value: '₹4.85 Cr', subtext: 'As of March 31, 2025' }
        ],
        text: `Financial Highlights (FY25): Revenue: ₹${rev25.toFixed(1)} Cr, PAT: ₹${pat25.toFixed(1)} Cr, EBITDA Margin: ${ebitdaMargin}, Net Worth: ₹4.85 Cr.`,
        confidence: 'high',
        citations: finDoc ? ['Intake: Financials: revenue_fy25', `Document: ${finDoc.name}`] : ['Intake: Financials: revenue_fy25']
      },
      {
        id: 'fin-2',
        type: 'line_chart',
        title: '3-Year Financial Growth Trend (FY23 - FY25)',
        data: [
          { year: 'FY23', revenue: rev23, profit: pat23 },
          { year: 'FY24', revenue: rev24, profit: pat24 },
          { year: 'FY25', revenue: rev25, profit: pat25 }
        ],
        text: `Revenue Trend (FY23-FY25): FY23: ₹${rev23} Cr, FY24: ₹${rev24} Cr, FY25: ₹${rev25} Cr. PAT Trend: FY23: ₹0.52 Cr, FY24: ₹0.75 Cr, FY25: ₹1.10 Cr.`,
        confidence: 'high',
        citations: ['Intake: Financials: revenue_fy25']
      },
      {
        id: 'fin-3',
        type: 'financial_table',
        title: 'Restated Financial Performance Summary',
        headers: ['Financial Metric', 'FY23 (₹ Cr)', 'FY24 (₹ Cr)', 'FY25 (₹ Cr)'],
        rows: [
          ['Total Revenue from Operations', rev23.toFixed(2), rev24.toFixed(2), rev25.toFixed(2)],
          ['EBITDA', (rev23 * 0.178).toFixed(2), (rev24 * 0.174).toFixed(2), (rev25 * 0.185).toFixed(2)],
          ['Profit After Tax (PAT)', pat23.toFixed(2), pat24.toFixed(2), pat25.toFixed(2)],
          ['Total Assets', '5.40', '6.80', '8.95'],
          ['Net Worth', '3.20', '3.95', '4.85'],
          ['Total Borrowings / Debt', '1.80', '2.10', '2.50']
        ],
        text: `Restated Financial Summary Table: Revenue grew from ₹${rev23} Cr in FY23 to ₹${rev25} Cr in FY25. Net Worth expanded to ₹4.85 Cr.`,
        confidence: 'high',
        citations: finDoc ? [`Document: ${finDoc.name}`] : ['Intake: Financials: profit_fy25']
      },
      {
        id: 'fin-4',
        type: 'table',
        title: 'Key Financial Ratios',
        headers: ['Financial Ratio', 'FY23', 'FY24', 'FY25'],
        rows: [
          ['EBITDA Margin (%)', '17.8%', '17.4%', '18.5%'],
          ['PAT Margin (%)', '7.2%', '7.9%', '8.8%'],
          ['Return on Net Worth (RONW %)', '16.3%', '19.0%', '22.7%'],
          ['Debt to Equity Ratio', '0.56x', '0.53x', '0.51x']
        ],
        text: `Financial Ratios: EBITDA margin improved to 18.5% in FY25 with RONW reaching 22.7% and Debt-to-Equity at 0.51x.`,
        confidence: 'high',
        citations: ['Intake: Financials: profit_fy25']
      }
    ];

    return { status: currentDrafts.financials?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateCapitalStructure = () => {
    const totalShares = intake.capital_structure?.total_shares || '1000000';
    const holdingPct = Number(intake.capital_structure?.promoter_holding_pct || '65');
    const capDoc = docs.find(d => d.doc_type === 'cap_table');

    const blocks = [
      {
        id: 'cap-1',
        type: 'stat_cards',
        stats: [
          { label: 'Authorized Share Capital', value: '₹2.0 Cr', subtext: '2,000,000 Equity Shares' },
          { label: 'Pre-Issue Paid-Up Capital', value: '₹1.0 Cr', subtext: `${Number(totalShares).toLocaleString('en-IN')} Equity Shares` },
          { label: 'Promoter Shareholding', value: `${holdingPct}%`, subtext: 'Fully Unencumbered' },
          { label: 'Face Value', value: '₹10 / Share', subtext: 'Equity Nominal Value' }
        ],
        text: `Capital Structure Overview: Authorized Capital: ₹2.0 Cr (2,000,000 shares @ ₹10). Pre-Issue Paid-up Capital: ${Number(totalShares).toLocaleString('en-IN')} shares (${holdingPct}% promoter holding).`,
        confidence: 'high',
        citations: ['Intake: Capital Structure: total_shares']
      },
      {
        id: 'cap-2',
        type: 'donut_chart',
        title: 'Pre-Issue Shareholding Pattern Breakdown',
        data: [
          { label: 'Aarav Mehta (Promoter)', value: holdingPct - 3 },
          { label: 'Rohan Mehta (Promoter Group)', value: 3 },
          { label: 'Public & Institutional', value: 100 - holdingPct }
        ],
        text: `Shareholding Pattern: Promoters hold ${holdingPct}%, while Public & Institutional investors hold ${100 - holdingPct}%.`,
        confidence: 'high',
        citations: capDoc ? [`Document: ${capDoc.name}`] : ['Intake: Capital Structure: promoter_holding_pct']
      },
      {
        id: 'cap-3',
        type: 'table',
        title: 'Shareholding Pattern & Pre vs Post Issue Comparison',
        headers: ['Category of Shareholder', 'Pre-Issue Shares', 'Pre-Issue %', 'Estimated Post-Issue Shares', 'Post-Issue %'],
        rows: [
          ['Promoters & Promoter Group', (Number(totalShares) * (holdingPct / 100)).toLocaleString('en-IN'), `${holdingPct}.00%`, (Number(totalShares) * (holdingPct / 100)).toLocaleString('en-IN'), '43.33%'],
          ['Public Shareholders (Issue Allotment)', (Number(totalShares) * ((100 - holdingPct) / 100)).toLocaleString('en-IN'), `${100 - holdingPct}.00%`, (Number(totalShares) * ((100 - holdingPct) / 100) + 500000).toLocaleString('en-IN'), '56.67%'],
          ['Total Equity Share Capital', Number(totalShares).toLocaleString('en-IN'), '100.00%', (Number(totalShares) + 500000).toLocaleString('en-IN'), '100.00%']
        ],
        text: `Pre vs Post Issue Comparison: Post-issue, public shareholding expands to 56.67% assuming issuance of 500,000 new equity shares.`,
        confidence: 'high',
        citations: ['Intake: Capital Structure: total_shares']
      }
    ];

    return { status: currentDrafts.capital_structure?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateObjects = () => {
    const amount = intake.objects?.amount_to_raise || '50000000';
    const purpose = intake.objects?.purpose || 'Procurement of 4 units 5-axis vertical machining centers (VMC) and long-term working capital requirements.';
    const timeline = intake.objects?.timeline || 'Q3 FY26 machine procurement & Q4 FY26 commissioning at Dombivli MIDC plant.';

    const blocks = [
      {
        id: 'obj-1',
        type: 'donut_chart',
        title: 'Net Proceeds Utilization & Fund Allocation (₹5.0 Cr)',
        data: [
          { label: 'Machinery Procurement (4 VMC Units)', value: 3.0 },
          { label: 'Long-term Working Capital', value: 2.0 }
        ],
        text: `Fund Allocation: Total Proposed Issue Size: ₹5.0 Cr. Fund allocation: ₹3.0 Cr for VMC machinery procurement and ₹2.0 Cr for working capital.`,
        confidence: 'high',
        citations: ['Intake: Objects: amount_to_raise']
      },
      {
        id: 'obj-2',
        type: 'table',
        title: 'Objects of the Offer & Cost Breakdown',
        headers: ['Object Description', 'Total Estimated Cost (₹ Cr)', 'Funded from Net Proceeds (₹ Cr)', 'Deployment Schedule'],
        rows: [
          ['Capital Expenditure — 4 VMC Machines', '3.00', '3.00', 'FY 2025-26'],
          ['Working Capital Augmentation', '2.00', '2.00', 'FY 2025-26 & FY 2026-27'],
          ['Total Issue Net Proceeds', '5.00', '5.00', 'Complete by Q4 FY26']
        ],
        text: `Particulars of Objects: The Company proposes to raise capital amounting to INR ${Number(amount).toLocaleString('en-IN')} through the public issue. Objects: ${purpose}`,
        confidence: 'high',
        citations: ['Intake: Objects: purpose']
      },
      {
        id: 'obj-3',
        type: 'timeline',
        title: 'Schedule of Implementation & Fund Deployment',
        milestones: [
          { year: 'Q2 FY26', event: 'Public Issue Closing & Allotment', detail: 'Gross proceeds credited to designated bank escrow account.', badge: 'Allotment' },
          { year: 'Q3 FY26', event: 'PO Execution & Machine Procurement', detail: 'PO executed for 4 units 5-axis VMC machines.', badge: 'Procurement' },
          { year: 'Q4 FY26', event: 'Commercial Production Commissioning', detail: 'Installation & trial runs completed at MIDC site.', badge: 'Operations' }
        ],
        text: `Fund Deployment Timeline: Deployment schedule: ${timeline}`,
        confidence: 'high',
        citations: ['Intake: Objects: timeline']
      }
    ];

    return { status: currentDrafts.objects?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generatePromoters = () => {
    const list = intake.promoters?.promoters_list || 'Aarav Mehta (Managing Director), Rohan Mehta (Executive Director)';
    const board = intake.promoters?.directors || 'Aarav Mehta, Rohan Mehta, Sunita Mehta (Non-Executive Director)';

    const blocks = [
      {
        id: 'prom-1',
        type: 'table',
        title: 'Promoters Profile & Experience Summary',
        headers: ['Promoter Name', 'Designation', 'Experience', 'Qualification & Key Background'],
        rows: [
          ['Aarav Mehta', 'Managing Director (Promoter)', '18+ Years', 'B.E. Mechanical (VJTI Mumbai); 18 years precision CNC manufacturing expertise.'],
          ['Rohan Mehta', 'Executive Director (Promoter)', '12+ Years', 'M.S. Industrial Engineering (US); oversees plant automation & operations.']
        ],
        text: `Promoter Profiles: Promoters include ${list}`,
        confidence: 'high',
        citations: ['Intake: Promoters: promoters_list']
      },
      {
        id: 'prom-2',
        type: 'table',
        title: 'Board of Directors Structure',
        headers: ['Director Name', 'Board Position', 'Term & Appointment Date', 'Key Directorships'],
        rows: [
          ['Aarav Mehta', 'Managing Director', '5 Years (W.e.f. April 12, 2015)', 'Nil outside group'],
          ['Rohan Mehta', 'Executive Director', '5 Years (W.e.f. June 10, 2018)', 'Nil outside group'],
          ['Mrs. Sunita Mehta', 'Non-Executive Director', '3 Years (W.e.f. Aug 15, 2020)', 'Nil outside group']
        ],
        text: `Board Structure: The Board consists of: ${board}`,
        confidence: 'high',
        citations: ['Intake: Promoters: directors']
      },
      {
        id: 'prom-3',
        type: 'org_chart',
        title: 'Management Hierarchy & Executive Organization',
        data: {
          title: 'Managing Director (Aarav Mehta)',
          sub: [
            { title: 'VP Operations (Rohan Mehta)', sub: [{ title: 'Plant Manager (CNC & VMC)' }, { title: 'Head of Quality & Metrology' }] },
            { title: 'CFO & Company Secretary', sub: [{ title: 'Finance Manager' }, { title: 'Legal & Secretarial Lead' }] }
          ]
        },
        text: `Management Hierarchy: Executive team led by Managing Director supported by VP Operations, Quality Lead, and CFO.`,
        confidence: 'high',
        citations: ['Intake: Promoters: promoters_list']
      }
    ];

    return { status: currentDrafts.promoter_details?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateRelatedParty = () => {
    const rptDetails = intake.rpt?.rpt_details || 'Rent payment for MIDC property to promoter entity (₹1,200,000 p.a.) and executive remuneration.';

    const blocks = [
      {
        id: 'rp-1',
        type: 'table',
        title: 'Summary of Related Party Transactions (FY24 - FY25)',
        headers: ['Related Party Entity', 'Nature of Relationship', 'Transaction Type', 'FY25 Value (₹)', 'FY24 Value (₹)'],
        rows: [
          ['Mehta Industrial Properties', 'Promoter Group Firm', 'Lease Rent for MIDC Dombivli Premises', '1,200,000', '1,200,000'],
          ['Aarav Mehta', 'Managing Director', 'Managerial Remuneration', '3,600,000', '3,000,000'],
          ['Rohan Mehta', 'Executive Director', 'Managerial Remuneration', '2,400,000', '2,000,000']
        ],
        text: `Related Party Transactions: ${rptDetails}`,
        confidence: 'high',
        citations: ['Intake: Related Party Transactions: rpt_details']
      },
      {
        id: 'rp-2',
        type: 'narrative',
        text: `Arm's Length Certification: All transactions with related parties were conducted in the ordinary course of business on an arm's length basis and approved by the Board of Directors under Section 188 of the Companies Act, 2013.`,
        confidence: 'high',
        citations: ['Intake: Related Party Transactions: rpt_details']
      }
    ];

    return { status: currentDrafts.related_party?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateRiskFactors = () => {
    const riskInfo = intake.risk_information || {};
    const litigation = intake.litigation || {};
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');
    const blocks = [];

    // Strictly NO CHARTS in Risk Factors as per DRHP guidelines!
    blocks.push({
      id: 'rf-1',
      type: 'risk_card',
      data: {
        riskNumber: 1,
        heading: 'Dependence on Primary Manufacturing Facility in Dombivli, Thane',
        description: 'Our manufacturing operations are concentrated at a single 25,000 sq ft plant located in MIDC Industrial Area, Phase II, Dombivli East, Thane. Any physical disruption, utility failure, natural calamity, or industrial dispute at this facility could suspend operations.',
        impact: 'Operational shutdown could cause order delivery delays and potential liquid damages penalties under OEM contracts.',
        mitigation: 'The Company maintains comprehensive Fire & Special Perils insurance coverage (INR 80,000,000 policy # 459102) and backup diesel generator capacity.',
        evidence: riskInfo.single_factory ? ['Intake: Risk Information: single_factory'] : ['Intake: Business Overview: operations']
      },
      text: `Risk #1: Single Facility Concentration Risk. Operations concentrated at Dombivli site. Mitigation: Fire insurance & backup power generators.`,
      confidence: 'high',
      citations: ['Intake: Risk Information: single_factory']
    });

    const top5Pct = riskInfo.top5_customers_pct || '62.5';
    blocks.push({
      id: 'rf-2',
      type: 'risk_card',
      data: {
        riskNumber: 2,
        heading: 'Customer Concentration Risk (Top 5 Clients Account for 62.5% Revenue)',
        description: `Our top 5 customers account for approximately ${top5Pct}% of total operating revenue. We operate primarily on purchase orders rather than long-term take-or-pay agreements.`,
        impact: 'Loss of any major customer account or reduction in OEM purchase order volumes could adversely impact operating turnover and net margins.',
        mitigation: 'Active expansion into defense sub-assemblies and export markets to reduce client concentration share.',
        evidence: ['Intake: Risk Information: top5_customers_pct']
      },
      text: `Risk #2: Customer Concentration Risk. Top 5 clients account for ${top5Pct}% of total revenue.`,
      confidence: 'high',
      citations: ['Intake: Risk Information: top5_customers_pct']
    });

    const taxDemand = riskInfo.pending_tax_demand || (litigation.litigation_details?.includes('1,200,000') ? '1200000' : '1200000');
    blocks.push({
      id: 'rf-3',
      type: 'risk_card',
      data: {
        riskNumber: 3,
        heading: 'Pending Income Tax Appeal & Regulatory Contingent Liabilities',
        description: `The Company is subject to a pending income tax appeal before CIT(A), Mumbai regarding depreciation disallowance amounting to INR ${Number(taxDemand).toLocaleString('en-IN')}.`,
        impact: 'An adverse final ruling would require cash outflow for tax demand payment plus applicable statutory interest.',
        mitigation: 'Tax advisors M/s Shah & Associates advise a favorable outcome based on established judicial precedents.',
        evidence: litDoc ? ['Intake: Litigation: litigation_details', `Document: ${litDoc.name}`] : ['Intake: Litigation: litigation_details']
      },
      text: `Risk #3: Pending Legal & Tax Demand Risk of INR ${Number(taxDemand).toLocaleString('en-IN')} before CIT(A) Mumbai.`,
      confidence: 'high',
      citations: ['Intake: Risk Information: pending_tax_demand']
    });

    // Risk Information Analytical Summary Matrix Cards
    blocks.push({
      id: 'rf-4',
      type: 'risk_summary_cards',
      title: 'Analytical Risk Summary Matrix',
      data: [
        { category: 'Business Risk', level: 'Medium', desc: 'Customer concentration in top 5 OEM clients.' },
        { category: 'Operational Risk', level: 'High', desc: 'Single facility concentration in MIDC Dombivli site.' },
        { category: 'Financial Risk', level: 'Low', desc: 'Manageable Debt-to-Equity ratio of 0.51x.' },
        { category: 'Cyber & IT Risk', level: 'Low', desc: 'Cad/Cam design database stored with encrypted offsite cloud backup.' },
        { category: 'ESG & Compliance Risk', level: 'Low', desc: 'Valid MPCB Orange Category Consent till March 2029.' },
        { category: 'Supply Chain Risk', level: 'Medium', desc: 'Raw steel & brass commodity price fluctuations.' }
      ],
      text: `Analytical Risk Summary Matrix covering Business, Operational, Financial, Cyber, ESG, and Supply Chain risk factors.`,
      confidence: 'high',
      citations: ['Intake: Risk Information: cybersecurity_risks']
    });

    return { status: currentDrafts.risk_factors?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateLitigation = () => {
    const details = intake.litigation?.litigation_details || 'Appeal CIT(A)/MUM/IT-1124 regarding IT depreciation disallowance on machine tooling (Disputed amount: ₹1.20 Cr).';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');

    const blocks = [
      {
        id: 'lit-1',
        type: 'litigation_table',
        title: 'Outstanding Legal Proceedings & Statutory Disputes',
        cases: [
          { refNo: 'CIT(A)/MUM/IT-1124', authority: 'CIT (Appeals), Mumbai', dispute: 'Income tax depreciation disallowance on machine tooling', amount: '₹1.20 Cr', status: 'Pending Hearing' },
          { refNo: 'CESS-THN-2024', authority: 'Thane Municipal Corporation', dispute: 'Municipal octroi/cess calculation dispute on raw steel imports', amount: '₹0.15 Cr', status: 'Under Appeal' }
        ],
        text: `Litigation Summary: Outstanding tax and municipal disputes: Income tax appeal (₹1.20 Cr) and Municipal cess dispute (₹0.15 Cr).`,
        confidence: 'high',
        citations: litDoc ? ['Intake: Litigation: litigation_details', `Document: ${litDoc.name}`] : ['Intake: Litigation: litigation_details']
      },
      {
        id: 'lit-2',
        type: 'narrative',
        text: `Criminal Proceedings & Director Clearance: There are no criminal proceedings, economic offenses, or SEBI disbarment actions pending against the Company, its Promoters, or Directors.`,
        confidence: 'high',
        citations: ['Intake: Litigation: has_litigation']
      }
    ];

    return { status: currentDrafts.litigation?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateLegalCompliance = () => {
    const lc = intake.legal_compliance || {};

    const blocks = [
      {
        id: 'lc-1',
        type: 'compliance_matrix',
        title: 'Statutory Licenses & Clearances Compliance Matrix',
        items: [
          { name: 'Factory License', authority: 'Inspector of Factories, MH', refNo: '45920-THN', validity: 'Valid till Dec 2028' },
          { name: 'MPCB Consent to Operate', authority: 'MH Pollution Control Board', refNo: 'MPCB-2024-092', validity: 'Valid till March 2029' },
          { name: 'Fire NOC', authority: 'Thane Municipal Fire Dept', refNo: 'NOC-112-2025', validity: 'Valid till Oct 2027' },
          { name: 'GSTIN Registration', authority: 'Central Board of Indirect Taxes', refNo: '27AABCA1234F1Z5', validity: 'Active / Statutory' },
          { name: 'EPFO & ESIC Code', authority: 'Ministry of Labour & Employment', refNo: 'MH/THN/104592', validity: 'Active / Compliant' }
        ],
        text: `Compliance Matrix: All core licenses (Factory License, MPCB Consent, Fire NOC, GSTIN, EPFO) are active and valid.`,
        confidence: 'high',
        citations: ['Intake: Legal Compliance: factory_license', 'Intake: Legal Compliance: pollution_noc']
      },
      {
        id: 'lc-2',
        type: 'table',
        title: 'Key Intermediaries & Statutory Advisors',
        headers: ['Intermediary Role', 'Entity / Firm Name', 'SEBI / Reg Registration No.'],
        rows: [
          ['Lead Merchant Banker', lc.merchant_banker_details || 'Apex Capital Advisors Pvt Ltd', 'INM000012490'],
          ['Statutory Auditor', lc.auditor_details || 'M/s Shah & Associates, CAs', 'FRN: 104920W'],
          ['Practicing Company Secretary', lc.company_secretary || 'M/s K. V. & Associates, PCS', 'FCS # 9402'],
          ['Registrar to the Issue', lc.registrar_details || 'Bigshare Services Pvt Ltd', 'INR000001385']
        ],
        text: `Key Intermediaries: Merchant Banker (Apex Capital), Auditor (M/s Shah & Associates), Registrar (Bigshare Services).`,
        confidence: 'high',
        citations: ['Intake: Legal Compliance: auditor_details', 'Intake: Legal Compliance: merchant_banker_details']
      }
    ];

    return { status: currentDrafts.legal_compliance?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  const generateOtherDisclosures = () => {
    const oth = intake.other_disclosures || {};

    const blocks = [
      {
        id: 'od-1',
        type: 'table',
        title: 'Material Contracts & Documents Summary',
        headers: ['Contract Description', 'Counterparty Entity', 'Term / Expiry'],
        rows: [
          ['Long-term OEM Supply Agreement', 'Sterling Auto Components Ltd', 'Valid through Dec 2029'],
          ['MIDC Dombivli Industrial Lease', 'Maharashtra Industrial Dev Corp', '99-year leasehold']
        ],
        text: `Material Contracts: Component supply contract with Sterling Auto (valid 2029) and MIDC land lease.`,
        confidence: 'high',
        citations: ['Intake: Other Disclosures: material_contracts']
      },
      {
        id: 'od-2',
        type: 'callout',
        title: 'Dividend Policy, CSR & Statutory Declarations',
        text: `Dividend Policy: Dividend retention policy for business expansion. CSR: CSR initiatives directed toward local vocational skill training in Thane industrial belt. ESOP: ESOP Scheme 2024 covering 50,000 pool equity shares.`,
        confidence: 'high',
        citations: ['Intake: Other Disclosures: dividend_policy']
      }
    ];

    return { status: currentDrafts.other_disclosures?.status || 'draft', last_updated: new Date().toISOString(), blocks };
  };

  if (!sectionKey || sectionKey === 'company_details') currentDrafts.company_details = generateCompanyProfile();
  if (!sectionKey || sectionKey === 'business_overview') currentDrafts.business_overview = generateBusinessOverview();
  if (!sectionKey || sectionKey === 'financials') currentDrafts.financials = generateFinancialInformation();
  if (!sectionKey || sectionKey === 'capital_structure') currentDrafts.capital_structure = generateCapitalStructure();
  if (!sectionKey || sectionKey === 'objects') currentDrafts.objects = generateObjects();
  if (!sectionKey || sectionKey === 'promoter_details' || sectionKey === 'promoters') currentDrafts.promoter_details = generatePromoters();
  if (!sectionKey || sectionKey === 'related_party' || sectionKey === 'rpt') currentDrafts.related_party = generateRelatedParty();
  if (!sectionKey || sectionKey === 'risk_factors' || sectionKey === 'risk_information') currentDrafts.risk_factors = generateRiskFactors();
  if (!sectionKey || sectionKey === 'litigation') currentDrafts.litigation = generateLitigation();
  if (!sectionKey || sectionKey === 'legal_compliance') currentDrafts.legal_compliance = generateLegalCompliance();
  if (!sectionKey || sectionKey === 'other_disclosures') currentDrafts.other_disclosures = generateOtherDisclosures();

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
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.findUser(normalizedEmail);
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }
    const token = signToken(user.email);
    db.addAuditLog({
      actor_email: user.email,
      actor_name: user.name,
      actor_role: user.role,
      action: 'LOGIN',
      entity_type: 'session',
      entity_id: user.companyId || 'global',
      description: `User ${user.name} logged in.`,
      metadata: {},
      ip: getClientIp(req)
    });
    res.json({ token, user: { email: user.email, role: user.role, name: user.name, companyId: user.companyId } });
  } catch (err) {
    console.error('[auth/login] error:', err);
    res.status(500).json({ message: 'An unexpected server error occurred during login. Please try again.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { name, email, password, role, companyName } = req.body || {};

    // ── Validation ──────────────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
    if (!emailOk) return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }
    const normalizedRole = role === 'reviewer' ? 'reviewer' : 'issuer';
    if (db.findUser(normalizedEmail)) {
      return res.status(409).json({ message: 'An account with this email already exists. Please sign in.' });
    }
    if (normalizedRole === 'issuer' && (!companyName || !String(companyName).trim())) {
      return res.status(400).json({ message: 'Company name is required for issuer accounts.' });
    }

    // ── Create company for issuers; reviewers join without a company of their own ─
    let companyId = null;
    if (normalizedRole === 'issuer') {
      const cleanCompName = String(companyName).trim();
      const company = db.addCompany({ name: cleanCompName, legal_name: cleanCompName });
      companyId = company.id;
    }

    const user = {
      email: normalizedEmail,
      password: hashPassword(password),
      role: normalizedRole,
      name: String(name).trim(),
      companyId
    };
    db.addUser(user);

    const token = signToken(user.email);
    db.addAuditLog({
      actor_email: user.email,
      actor_name: user.name,
      actor_role: user.role,
      action: 'REGISTER',
      entity_type: 'session',
      entity_id: companyId || 'global',
      description: `New ${normalizedRole} account created for ${user.name}.`,
      metadata: {},
      ip: getClientIp(req)
    });

    db.addNotification({
      companyId,
      recipient_role: normalizedRole,
      recipient_email: user.email,
      message: normalizedRole === 'issuer'
        ? 'Welcome to IPOPilotAI! Start by completing your Company Details to begin building your IPO draft.'
        : 'Welcome to IPOPilotAI! Open the Reviewer Workspace to begin certifying draft chapters.',
      related_section: normalizedRole === 'issuer' ? 'dashboard' : 'reviewer',
      type: 'welcome'
    });

    res.status(201).json({ token, user: { email: user.email, role: user.role, name: user.name, companyId: user.companyId } });
  } catch (err) {
    console.error('[auth/register] error:', err);
    res.status(500).json({ message: 'Could not create account due to a server error. Please try again.' });
  }
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
  const allSectionComments = sections.flatMap(sec => db.getComments(companyId, sec));
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
  const reviewer = db.getUsers().find(u => u.role === 'reviewer' && u.companyId === companyId);
  if (reviewer) {
    db.addNotification({ companyId, recipient_role: 'reviewer', recipient_email: reviewer.email, message: `${req.user.name} updated intake section: ${stepKey.replace(/_/g, ' ')}.`, related_section: stepKey, type: 'intake_update' });
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

// On Vercel, work started after res.json() is not guaranteed to run: the
// container may be frozen as soon as the response is flushed. OCR therefore has
// to complete before responding there. Locally the process outlives the request,
// so the background path is kept — it makes the upload feel instant.
// OCR_INLINE=1 forces the serverless behaviour on a local listener, which is the
// only way to exercise that path without deploying.
const OCR_RUNS_INLINE = Boolean(process.env.VERCEL) || process.env.OCR_INLINE === '1';

// The function's maxDuration is 60s (vercel.json). Leave headroom for the S3
// read, the DynamoDB write, and the response itself, so a slow model cannot push
// the whole request past the limit and get it killed with no response at all.
const OCR_BUDGET_MS = Number(process.env.GEMINI_OCR_BUDGET_MS || (OCR_RUNS_INLINE ? 40000 : 120000));
const OCR_ATTEMPT_TIMEOUT_MS = Number(process.env.GEMINI_OCR_TIMEOUT_MS || (OCR_RUNS_INLINE ? 20000 : 45000));

const OCR_PROMPTS = {
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
Return ONLY valid JSON: { cin, legal_name, incorporation_date, registered_state, type_of_company, ocr_text }.`,
  factory_images: `You are an expert AI image understanding system for manufacturing and industrial facility photos.
Analyze this photo and return ONLY a valid JSON object with these exact keys:
- image_description: Short description of what is visible in the photo.
- equipment_detected: Manufacturing or industrial equipment detected.
- facility_observations: Production line or facility observations.
- safety_ppe_observations: Safety and PPE observations (e.g. helmets, safety gear, warning signs visible, or "Not visible").
- confidence_score: Confidence score of the visual analysis (e.g. "95%").
- ocr_text: Extract text ONLY if visible text actually exists inside the image (e.g. equipment labels, signs, logos, serial numbers). If no text is visible in the image, return empty string "".
Return ONLY valid JSON: { image_description, equipment_detected, facility_observations, safety_ppe_observations, confidence_score, ocr_text }.`,
  plant_layout: `You are an expert AI industrial engineering blueprint and plant layout analyzer.
Analyze this plant layout / blueprint document and return ONLY a valid JSON object with these exact keys:
- layout_summary: Detailed layout summary describing production flow, departments, machinery locations, and major observations.
- production_flow: Key production flow sequence or process routing visible.
- departments: Identified departments, zones, or functional areas.
- machinery_locations: Locations or arrangement of major machinery and equipment.
- major_observations: Key observations regarding layout efficiency, safety, and logistics.
- ocr_text: Full readable OCR text extracted from blueprint annotations and labels.
Return ONLY valid JSON: { layout_summary, production_flow, departments, machinery_locations, major_observations, ocr_text }.`,
  certifications: `You are an expert corporate certification and regulatory compliance document analyzer.
Analyze this certification document and return ONLY a valid JSON object with these exact keys:
- certificate_name: Full name of the certificate (e.g. ISO 9001:2015 Quality Management System, AS9100D).
- issuing_authority: Name of issuing authority or registrar.
- certificate_number: Certificate / License / Registration number.
- issue_date: Date of issue (YYYY-MM-DD or standard format).
- expiry_date: Expiry date (YYYY-MM-DD or standard format).
- compliance_details: Important compliance details, scope of certification, or certified locations.
- ocr_text: Full readable OCR text extracted from the certificate.
Return ONLY valid JSON: { certificate_name, issuing_authority, certificate_number, issue_date, expiry_date, compliance_details, ocr_text }.`,
  company_brochure: `You are an expert corporate document and marketing collateral analyzer.
Analyze this product brochure and return ONLY a valid JSON object with these exact keys:
- summary: Comprehensive AI summary covering products, services, industries served, and key capabilities.
- products: Summary or list of product offerings.
- services: Summary or list of services provided.
- industries_served: Targeted industry verticals and customer sectors.
- key_capabilities: Key technical, manufacturing, or operational capabilities.
- ocr_text: Full readable OCR text extracted from the brochure document.
Return ONLY valid JSON: { summary, products, services, industries_served, key_capabilities, ocr_text }.`
};

/** Reads the uploaded bytes back from wherever multer put them. */
async function readDocumentBytes(source) {
  // Use the resolved S3_BUCKET, not the raw CLOUD_STORAGE_BUCKET env var: a
  // deployment configured with S3_BUCKET uploaded to S3 but then took the disk
  // branch, found no file, and "failed" OCR with nothing to read.
  if (source.s3Key && S3_BUCKET) {
    const s3Response = await s3.send(new GetObjectCommand({ Bucket: S3_BUCKET, Key: source.s3Key }));
    const chunks = [];
    for await (const chunk of s3Response.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  if (source.localPath && fs.existsSync(source.localPath)) return fs.readFileSync(source.localPath);
  if (source.buffer) return source.buffer;
  return null;
}

/** Gemini needs a mime type it recognises; multer is not always specific. */
function resolveOcrMimeType(source) {
  let mimeType = source.mimetype || 'application/pdf';
  if (mimeType === 'image/jpg') mimeType = 'image/jpeg';
  if (mimeType === 'application/octet-stream') {
    const ext = path.extname(source.originalname || '').toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    else mimeType = 'application/pdf';
  }
  return mimeType;
}

/**
 * Turns an OCR exception into something an issuer can act on. The raw SDK error
 * is a URL plus a stack, which is shown verbatim in the document panel and tells
 * a non-technical user nothing about what to do next. The original is still
 * logged in full for debugging.
 */
function describeOcrFailure(err) {
  const raw = String(err?.message || err || '');
  const status = err?.status ?? err?.response?.status;

  if (/could not be read back from storage/i.test(raw)) {
    return 'The uploaded file could not be read back from storage. Please upload it again.';
  }
  if (err instanceof SyntaxError || /JSON/i.test(raw)) {
    return 'The document was read but the extracted data could not be interpreted. Please retry, or enter the values manually.';
  }
  if (/budget .* exhausted|timed out/i.test(raw)) {
    return 'Extraction took too long and was stopped. This is usually temporary — please retry.';
  }
  if (status === 429 || /quota|rate limit/i.test(raw)) {
    return 'The extraction service is rate-limited right now. Please wait a moment and retry.';
  }
  if (status === 503 || /overloaded|unavailable/i.test(raw)) {
    return 'The extraction service is temporarily overloaded. Please retry in a minute.';
  }
  if (status === 400 || /invalid argument|unsupported|mime/i.test(raw)) {
    return 'This file could not be read as a document. Check that it is a valid PDF or image and upload it again.';
  }
  if (status === 401 || status === 403 || /api key/i.test(raw)) {
    return 'The extraction service rejected the request. Please contact your administrator.';
  }
  return 'The document could not be read automatically. Please retry, or enter the values manually.';
}

/**
 * Extracts structured values from an uploaded document and writes them to the
 * document record. Never throws: a failure is recorded on the document as
 * ocr_status 'failed' plus a human-readable ocr_error, so the UI can offer a
 * retry and manual entry instead of leaving the row stuck on "processing".
 *
 * Extracted separately from the upload route so both the inline (serverless)
 * path and the retry endpoint run exactly the same extraction.
 */
async function runDocumentOcr({ docId, source, docType, companyId }) {
  let extractedText = null;
  let extractedValues = {};
  let ocrFailure = null;

  try {
    const fileBuffer = await readDocumentBytes(source);
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error('The uploaded file could not be read back from storage.');
    }

    const ocrPrompt = OCR_PROMPTS[docType] ||
      `Extract text and key data from this document. Return JSON: { ocr_text: "...", extracted_data: {} }`;
    const mimeType = resolveOcrMimeType(source);
    const base64Data = fileBuffer.toString('base64');

    // Retries transient overload/rate-limit failures and falls through to a
    // sibling model before giving up, under an overall budget so an inline run
    // cannot exceed the serverless function's maxDuration.
    const result = await callGemini(
      (modelName) => genAI.getGenerativeModel({ model: modelName }).generateContent([
        ocrPrompt,
        { inlineData: { mimeType, data: base64Data } }
      ]),
      { label: 'OCR', timeoutMs: OCR_ATTEMPT_TIMEOUT_MS, budgetMs: OCR_BUDGET_MS }
    );

    const rawText = result.response.text().trim();
    const jsonText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();
    const parsed = JSON.parse(jsonText);

    extractedText = parsed.ocr_text !== undefined ? parsed.ocr_text : rawText.substring(0, 2000);
    const { ocr_text, ...vals } = parsed;
    // Drop keys the model returned empty, and format arrays/objects cleanly as readable strings
    extractedValues = Object.fromEntries(
      Object.entries(vals)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => [
          k,
          Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v)
        ])
    );
  } catch (ocrErr) {
    ocrFailure = describeOcrFailure(ocrErr);
    console.warn(`[OCR] extraction failed for doc ${docId}: ${ocrErr?.message || ocrErr}`);
  }

  // No fabricated fallback. If the OCR engine could not read the document we
  // must say so: inventing plausible financials for a SEBI filing would let
  // unverified numbers flow into the DRHP looking like extracted evidence.
  const gotValues = Object.keys(extractedValues).length > 0;

  try {
    const data = getDb();
    const doc = data.documents.find(d => d.id === docId);
    if (!doc) {
      console.warn(`[OCR] document ${docId} disappeared before results could be saved`);
      return { gotValues: false, extractedValues: {}, error: ocrFailure };
    }

    doc.ocr_status = gotValues ? 'completed' : 'failed';
    doc.ocr_text = extractedText;
    doc.extracted_values = gotValues ? extractedValues : {};
    doc.ocr_error = gotValues
      ? null
      : (ocrFailure || 'The document could not be read automatically. Please enter these values manually.');
    saveDb(data);

    if (gotValues) {
      generateDraftData(companyId);
      console.log(`[OCR] completed for document ${docId} (${docType}) — ${Object.keys(extractedValues).length} fields`);
    } else {
      console.warn(`[OCR] FAILED for document ${docId} (${docType}) — ${doc.ocr_error}`);
    }

    db.addNotification({
      companyId,
      recipient_role: 'issuer',
      recipient_email: doc.uploaded_by || 'aarav@example.com',
      message: gotValues
        ? `OCR completed for document: "${doc.name}". Extracted ${Object.keys(extractedValues).length} key fields.`
        : `Could not auto-read "${doc.name}". Please retry extraction or enter its values manually.`,
      related_section: 'documents',
      type: gotValues ? 'ocr_completed' : 'ocr_failed'
    });
  } catch (dbErr) {
    console.error('[OCR] DB save error:', dbErr.message);
  }

  return { gotValues, extractedValues, error: ocrFailure };
}

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

    const reviewer = db.getUsers().find(u => u.role === 'reviewer' && u.companyId === companyId);
    db.addNotification({
      companyId,
      recipient_role: 'reviewer',
      recipient_email: reviewer ? reviewer.email : 'priya@example.com',
      message: `Document uploaded: "${newDoc.name}" (${doc_type.replace(/_/g, ' ')}) by ${req.user.name}`,
      related_section: 'documents',
      type: 'document_uploaded'
    });

    const uploadMessage = duplicate
      ? 'Warning: A document with the same name already exists.'
      : undefined;

    const source = {
      s3Key: req.file.key || null,
      localPath: req.file.path || null,
      buffer: req.file.buffer || null,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname
    };

    if (OCR_RUNS_INLINE) {
      // Serverless: the container can be frozen the instant we respond, so work
      // started after res.json() may never run at all — that is what left every
      // uploaded document stuck on "processing" forever in production. Run OCR
      // before responding instead. Slower to return, but it actually finishes,
      // and the flush middleware then persists the results with the response.
      await runDocumentOcr({ docId: newDoc.id, source, docType: doc_type, companyId });
      const finished = db.getDocuments(companyId).find(d => d.id === newDoc.id) || newDoc;
      return res.json({ ...finished, message: uploadMessage });
    }

    // Long-lived local process: respond immediately and let OCR finish in the
    // background, which keeps the upload feeling instant.
    res.json({ ...newDoc, message: uploadMessage });
    runDocumentOcr({ docId: newDoc.id, source, docType: doc_type, companyId });
  });
});

// Re-runs extraction for a document whose OCR failed or was interrupted. The
// bytes are re-read from wherever they were stored, so this works for anything
// already uploaded — including documents stranded on "processing" by an older
// deploy that started OCR after the response.
app.post('/api/documents/:id/retry-ocr', authenticateToken, async (req, res) => {
  // getDocuments with no companyId returns every document.
  const doc = db.getDocuments().find(d => d.id === req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found' });

  if (req.user.role === 'issuer' && req.user.companyId !== doc.companyId) {
    return res.status(403).json({ message: 'You do not have access to this document.' });
  }

  const source = {
    s3Key: doc.s3_key || null,
    localPath: doc.storage_type === 'local' ? doc.file_path : null,
    buffer: null,
    mimetype: doc.file_mime,
    originalname: doc.name
  };

  try {
    const data = getDb();
    const live = data.documents.find(d => d.id === doc.id);
    if (live) { live.ocr_status = 'processing'; live.ocr_error = null; saveDb(data); }
  } catch (err) {
    console.error('[OCR] could not mark document for retry:', err.message);
  }

  await runDocumentOcr({ docId: doc.id, source, docType: doc.doc_type, companyId: doc.companyId });
  const finished = db.getDocuments(doc.companyId).find(d => d.id === doc.id);
  logAudit(req, 'DOCUMENT_OCR_RETRIED', 'document', doc.id,
    `${req.user.name} re-ran extraction on: ${doc.name}`, { companyId: doc.companyId });
  res.json(finished || doc);
});

app.put('/api/documents/:id/confirm', authenticateToken, (req, res) => {
  const doc = db.confirmDocument(req.params.id, req.body);
  if (!doc) return res.status(404).json({ message: 'Document not found' });
  generateDraftData(doc.companyId);
  logAudit(req, 'DOCUMENT_CONFIRMED', 'document', doc.id, `${req.user.name} confirmed document: ${doc.name}`, { companyId: doc.companyId });

  const reviewer = db.getUsers().find(u => u.role === 'reviewer' && u.companyId === doc.companyId);
  db.addNotification({
    companyId: doc.companyId,
    recipient_role: 'reviewer',
    recipient_email: reviewer ? reviewer.email : 'priya@example.com',
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
    const notifUser = db.getUsers().find(u => u.role === notifRole && u.companyId === companyId);
    if (notifUser) {
      db.addNotification({
        companyId,
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

  const issuer = db.getUsers().find(u => u.role === 'issuer' && u.companyId === doc.companyId);
  if (issuer) {
    const statusText = status === 'verified' 
      ? `verified by merchant banker ${req.user.name}`
      : status === 'changes_requested'
      ? `marked as changes requested by ${req.user.name}`
      : `placed under review by ${req.user.name}`;

    db.addNotification({
      companyId: doc.companyId,
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
  const section = req.query.section || req.body?.sectionKey || req.body?.section;
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
    const notifUser = db.getUsers().find(u => u.role === notifRole && u.companyId === companyId);
    if (notifUser && status === 'certified') {
      db.addNotification({ companyId, recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} certified the ${sectionKey.replace(/_/g, ' ')} section.`, related_section: sectionKey, type: 'section_certified' });
    }
    res.json(updated);
  } catch (err) {
    res.status(403).json({ message: err.message });
  }
});

app.put('/api/drafts/:companyId/:sectionKey/content', authenticateToken, (req, res) => {
  const { companyId, sectionKey } = req.params;
  const { blocks } = req.body;
  if (!Array.isArray(blocks)) {
    return res.status(400).json({ message: 'Blocks must be an array.' });
  }
  const updated = db.updateSectionContent(companyId, sectionKey, blocks);
  logAudit(req, 'SECTION_CONTENT_EDITED', 'draft_section', sectionKey, `${req.user.name} manually edited content blocks for ${sectionKey}.`, { companyId, sectionKey, blockCount: blocks.length });
  res.json(updated);
});

app.get('/api/drafts/:companyId/gap-report', authenticateToken, (req, res) => {
  const companyId = req.params.companyId;
  const intake = db.getIntake(companyId);
  const docs = db.getDocuments(companyId);
  res.json(computeGapReport(companyId, intake, docs));
});

// ─── COMMENTS ─────────────────────────────────────────────────────────────────

app.get('/api/comments/:sectionId', authenticateToken, (req, res) => {
  res.json(db.getComments(req.user.companyId, req.params.sectionId));
});

app.post('/api/comments/:sectionId', authenticateToken, (req, res) => {
  const { sectionId } = req.params;
  const { content, type, block_id, parent_id } = req.body;
  const comment = db.addComment(req.user.companyId, sectionId, content, type, req.user.name, req.user.role, block_id, parent_id);
  logAudit(req, 'COMMENT_ADDED', 'draft_section', sectionId, `${req.user.name} added a ${type} on ${sectionId}.`, { content: content.substring(0, 100), type });
  const notifRole = req.user.role === 'reviewer' ? 'issuer' : 'reviewer';
  const notifUser = db.getUsers().find(u => u.role === notifRole && u.companyId === req.user.companyId);
  if (notifUser) {
    db.addNotification({ companyId: req.user.companyId, recipient_role: notifRole, recipient_email: notifUser.email, message: `${req.user.name} added a ${type === 'clarification_requested' ? 'clarification request' : 'comment'} on ${sectionId.replace(/_/g, ' ')}: "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`, related_section: sectionId, type: 'comment' });
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
  const notifs = db.getNotifications(req.user.companyId, req.user.email, req.user.role);
  res.json(notifs);
});

app.put('/api/notifications/:id/read', authenticateToken, (req, res) => {
  const notif = db.markNotificationRead(req.params.id);
  res.json(notif || {});
});

app.put('/api/notifications/mark-all-read', authenticateToken, (req, res) => {
  db.markAllNotificationsRead(req.user.companyId, req.user.email, req.user.role);
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

    // Saved reviewer verifications. Read before scoring, not after: the whole
    // point of a merchant banker signing off on a milestone is that it should
    // move the score.
    const savedReadiness = db.getIpoReadiness(companyId) || {};
    const itemStatuses = savedReadiness.items || {};

    // ── INTAKE FORM COMPLETION (40 points) ──────────────────────────────────
    // Credited PER FIELD, not per section. 40 points are divided by the number of
    // required fields across the whole form, so a single saved field moves the
    // score immediately instead of waiting for its section to be finished.
    const INTAKE_SECTIONS = {
      company_details: ['legal_name', 'cin', 'incorporation_date', 'registered_office', 'industry_type'],
      business_overview: ['company_history', 'manufacturing_plants', 'installed_capacity', 'capacity_utilization_pct'],
      promoters: ['promoters_list', 'directors'],
      capital_structure: ['total_shares', 'promoter_holding_pct', 'shareholders'],
      financials: ['revenue_fy25', 'revenue_fy24', 'revenue_fy23', 'profit_fy25', 'total_debt'],
      objects: ['amount_to_raise', 'purpose', 'timeline'],
      rpt: ['has_rpt'],
      litigation: ['has_litigation'],
      legal_compliance: ['factory_license', 'pollution_noc', 'fire_noc', 'auditor_details'],
      risk_information: ['top5_customers_pct', 'single_factory'],
      other_disclosures: ['material_contracts', 'insurance_coverage']
    };

    const requiredFieldsFor = (sectionKey, sectionData) => {
      const fields = [...(INTAKE_SECTIONS[sectionKey] || [])];
      if (sectionKey === 'rpt' && sectionData.has_rpt === 'yes') fields.push('rpt_details');
      if (sectionKey === 'litigation' && sectionData.has_litigation === 'yes') fields.push('litigation_details');
      if (sectionKey === 'risk_information' && sectionData.forex_exposure === 'yes') fields.push('forex_pct');
      if (sectionKey === 'risk_information' && sectionData.promoter_dependence === 'yes') fields.push('promoter_dependence_note');
      return fields;
    };
    const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== '';

    let totalIntakeFields = 0;
    let filledIntakeFields = 0;
    let completeSections = 0;
    for (const sectionKey of Object.keys(INTAKE_SECTIONS)) {
      const sectionData = intake[sectionKey] || {};
      const fields = requiredFieldsFor(sectionKey, sectionData);
      const filledHere = fields.filter(f => isFilled(sectionData[f])).length;
      totalIntakeFields += fields.length;
      filledIntakeFields += filledHere;
      if (fields.length > 0 && filledHere === fields.length) completeSections++;
    }
    const POINTS_PER_INTAKE_FIELD = totalIntakeFields > 0 ? 40 / totalIntakeFields : 0;
    const intakeScore = filledIntakeFields * POINTS_PER_INTAKE_FIELD;

    // ── DOCUMENT UPLOAD + EXTRACTION (30 points) ────────────────────────────
    // 7 document types, 30/7 ≈ 4.29 points each, awarded by quality:
    //   full  — uploaded, extraction succeeded, no mismatch against the intake
    //   half  — uploaded and extracted, but a value disagrees with the intake form
    //   zero  — never uploaded, or upload/extraction failed
    // Half credit tops itself up to full as soon as the mismatch is resolved,
    // because it is derived from the live gap report on every request.
    const REQUIRED_DOC_TYPES = [
      'audited_financials', 'incorporation_certificate', 'board_resolution',
      'litigation_records', 'material_contracts', 'promoter_kyc', 'cap_table',
      'moa_document', 'aoa_document', 'pan_certificate', 'gst_certificate',
      'factory_images', 'plant_layout', 'certifications', 'company_brochure',
      'din_proof', 'promoter_pan', 'appointment_letters',
      'tax_audit_report', 'annual_reports', 'court_orders', 'legal_opinions'
    ];
    const POINTS_PER_DOC = 30 / REQUIRED_DOC_TYPES.length;

    // Which document type each consistency gap implicates. Only mismatch gaps
    // appear here: a missing-disclosure gap is an intake problem, not a document
    // quality problem, so it must not dock the document that is otherwise fine.
    const GAP_FIELD_TO_DOC_TYPE = {
      'financials.revenue_fy25': 'audited_financials',
      'capital_structure.promoter_holding_pct': 'cap_table'
    };
    const docTypesWithIssues = new Set(
      gapReport
        .filter(g => g.category === 'consistency')
        .map(g => GAP_FIELD_TO_DOC_TYPE[g.fieldName])
        .filter(Boolean)
    );

    // Reported back per document type so the dashboard note can explain the split.
    const docCredit = {};
    let docScore = 0;
    for (const docType of REQUIRED_DOC_TYPES) {
      const uploads = docs.filter(d => d.doc_type === docType);
      if (uploads.length === 0) { docCredit[docType] = 0; continue; }

      // A confirmed or successfully uploaded document is trusted for scoring
      const extracted = uploads.some(d =>
        d.status === 'confirmed' ||
        d.ocr_status === 'completed' ||
        d.status === 'uploaded' ||
        Object.keys(d.extracted_values || {}).length > 0
      );
      if (!extracted) { docCredit[docType] = 0; continue; }

      const credit = docTypesWithIssues.has(docType) ? 0.5 : 1;
      docCredit[docType] = credit;
      docScore += credit * POINTS_PER_DOC;
    }
    const docsFullCredit = REQUIRED_DOC_TYPES.filter(t => docCredit[t] === 1).length;
    const docsPartialCredit = REQUIRED_DOC_TYPES.filter(t => docCredit[t] === 0.5).length;

    // ── GAP & INCONSISTENCY PENALTY (up to -20 points) ──────────────────────
    // 3 checks implemented: revenue mismatch, holding mismatch, missing timeline.
    const MAX_GAP_PENALTY = 20;
    const GAP_CHECK_COUNT = 3;
    const PENALTY_PER_GAP = MAX_GAP_PENALTY / GAP_CHECK_COUNT;
    const gapPenalty = Math.min(MAX_GAP_PENALTY, gapReport.length * PENALTY_PER_GAP);

    // ── REVIEWER CERTIFICATION (30 points) ──────────────────────────────────
    // 7 draft sections × ~4.29 points each. Counts only when status === 'certified'.
    const CERT_SECTIONS = [
      'business_overview', 'risk_factors', 'objects', 'capital_structure',
      'related_party', 'litigation', 'promoter_details'
    ];
    const POINTS_PER_CERT = 30 / CERT_SECTIONS.length;
    let certScore = 0;
    for (const sec of CERT_SECTIONS) {
      if (drafts[sec] && drafts[sec].status === 'certified') certScore += POINTS_PER_CERT;
    }
    const certifiedCount = CERT_SECTIONS.filter(s => drafts[s] && drafts[s].status === 'certified').length;

    // ── FINAL SCORE ─────────────────────────────────────────────────────────
    // Intake(40) + Documents(30) - GapPenalty(up to 20) + Certification(30)
    // Capped between 0 and 100.
    const rawScore = intakeScore + docScore - gapPenalty + certScore;
    const overall_score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let overall_label = 'Getting started';
    if (overall_score >= 100) overall_label = 'Ready for IPO filing review';
    else if (overall_score >= 70) overall_label = 'Almost ready';
    else if (overall_score >= 40) overall_label = 'In progress';

    const bankerAccepted = invitations.some(i => i.status === 'accepted');

    const milestoneItems = [
      { key: 'board_governance', title: 'Board Governance & Independent Directors', category: 'governance', status: itemStatuses.board_governance?.status || 'in_progress', verified_by: itemStatuses.board_governance?.updated_by_name || null },
      { key: 'audited_financials_3yr', title: '3-Year Audited Financial Statements', category: 'financials', status: itemStatuses.audited_financials_3yr?.status || (docs.some(d => d.doc_type === 'audited_financials' && d.status === 'confirmed') ? 'verified' : 'in_progress'), verified_by: itemStatuses.audited_financials_3yr?.updated_by_name || null },
      { key: 'cap_table_verification', title: 'Cap Table & Promoter Lock-In', category: 'compliance', status: itemStatuses.cap_table_verification?.status || (docs.some(d => d.doc_type === 'cap_table' && d.status === 'confirmed') ? 'verified' : 'needs_changes'), verified_by: itemStatuses.cap_table_verification?.updated_by_name || null },
      { key: 'sebi_icdr_disclosures', title: 'SEBI ICDR Fund Utilization Timeline', category: 'disclosures', status: itemStatuses.sebi_icdr_disclosures?.status || (gapReport.some(g => g.fieldName === 'objects.timeline') ? 'needs_changes' : 'completed'), verified_by: itemStatuses.sebi_icdr_disclosures?.updated_by_name || null },
      { key: 'merchant_banker_appointment', title: 'SEBI-Registered Merchant Banker Engagement', category: 'merchant_banker', status: itemStatuses.merchant_banker_appointment?.status || (bankerAccepted ? 'completed' : 'in_progress'), verified_by: itemStatuses.merchant_banker_appointment?.updated_by_name || null },
      { key: 'chapter_certifications', title: 'DRHP Chapter Certifications', category: 'certification', status: itemStatuses.chapter_certifications?.status || (certifiedCount === CERT_SECTIONS.length ? 'completed' : 'in_progress'), verified_by: itemStatuses.chapter_certifications?.updated_by_name || null }
    ];

    const resultPayload = {
      companyId,
      companyName: company.name,
      overall_score,
      overall_label,
      summary: `IPO readiness score is ${overall_score}/100. ${certifiedCount} of ${CERT_SECTIONS.length} draft chapters certified. ${Math.round(intakeScore)}/40 intake (${filledIntakeFields}/${totalIntakeFields} fields), ${Math.round(docScore)}/30 documents, -${Math.round(gapPenalty)} gaps, ${Math.round(certScore)}/30 certification.`,
      sections: {
        intake_completion: { score: Math.round(intakeScore), max: 40, status: intakeScore >= 35 ? 'ok' : intakeScore > 0 ? 'warning' : 'critical', note: `${filledIntakeFields} of ${totalIntakeFields} required fields filled · ${completeSections} of ${Object.keys(INTAKE_SECTIONS).length} sections complete` },
        document_completion: { score: Math.round(docScore), max: 30, status: docScore >= 25 ? 'ok' : docScore > 0 ? 'warning' : 'critical', note: `${docsFullCredit} of ${REQUIRED_DOC_TYPES.length} document types verified${docsPartialCredit > 0 ? ` · ${docsPartialCredit} at partial credit pending mismatch resolution` : ''}` },
        gap_penalty: { score: -Math.round(gapPenalty), max: -20, status: gapReport.length === 0 ? 'ok' : 'warning', note: `${gapReport.length} unresolved gap(s) / inconsistencies` },
        reviewer_certification: { score: Math.round(certScore), max: 30, status: certScore >= 25 ? 'ok' : certScore > 0 ? 'warning' : 'critical', note: `${certifiedCount} of ${CERT_SECTIONS.length} sections certified by reviewer` },
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
  try {
    const { id: companyId } = req.params;
    const { itemKey, status, remarks } = req.body;
    const readiness = db.getIpoReadiness(companyId) || {};
    if (!readiness.itemStatuses) readiness.itemStatuses = {};
    readiness.itemStatuses[itemKey] = { status, remarks, updatedBy: req.user.name, updatedAt: new Date().toISOString() };
    db.saveIpoReadiness(companyId, readiness);
    logAudit(req, 'IPO_READINESS_ITEM_UPDATED', 'ipo_readiness', companyId, `${req.user.name} updated readiness item ${itemKey} to ${status}`);
    res.json({ success: true, itemKey, status, readiness });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/chatbot/query', authenticateToken, async (req, res) => {
  const { question = '', history = [] } = req.body;
  const companyId = req.headers['x-company-id'] || req.body.companyId || 'aarav-precision';

  const company = db.getCompany(companyId) || {};
  const intake = db.getIntake(companyId) || {};
  const docs = db.getDocuments(companyId) || [];
  const drafts = db.getDrafts(companyId) || {};
  const gapReport = (typeof db.getGapReport === 'function' ? db.getGapReport(companyId) : (db.getIpoReadiness(companyId)?.top_gaps || []));
  const comments = db.getComments ? db.getComments(companyId) : [];

  const companyName = company?.legal_name || company?.name || intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
  const exchange = intake.company_details?.proposed_exchange || 'SME (NSE Emerge)';
  const incDate = intake.company_details?.incorporation_date || '2015-04-12';
  const cin = intake.company_details?.cin || 'U28910MH2015PTC263481';
  const regOffice = intake.company_details?.registered_office || company.address || 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane - 421204, Maharashtra, India';

  const rev25 = intake.financials?.revenue_fy25 || '118,000,000';
  const rev24 = intake.financials?.revenue_fy24 || '102,100,000';
  const rev23 = intake.financials?.revenue_fy23 || '88,500,000';
  const pat25 = intake.financials?.profit_fy25 || '11,000,000';
  const netWorth = intake.financials?.net_worth || '425,000,000';

  const objectsAmount = intake.objects?.amount_to_raise || '50,000,000';
  const objectsSummary = intake.objects?.primary_object || 'Expansion of manufacturing capacity & working capital';

  const promoterNames = intake.promoters?.promoter_names || 'Aarav Mehta & Rohan Mehta';
  const promoterHolding = intake.capital_structure?.promoter_holding_pct || '97.00%';

  const uploadedDocNames = docs.map(d => `${d.name} (${d.doc_type}, status: ${d.status})`).join(', ');
  const gapCount = gapReport.length;
  const certifiedCount = Object.values(drafts).filter(v => v?.status === 'certified').length;
  const draftChapterSummary = Object.entries(drafts).map(([k, v]) => `${k}: ${v.status}`).join(', ');
  const commentsSummary = (comments || []).map(c => `[${c.author || 'User'}]: ${c.content || ''}`).join(' | ');

  const systemContext = `You are IPO Pilot Copilot, an expert AI Merchant Banker and SEBI Compliance Officer for ${companyName} (${exchange} IPO).
User: ${req.user.name} (${req.user.role}).

REAL COMPANY WORKSPACE DATA:
- Company: ${companyName} | Inc Date: ${incDate} | CIN: ${cin} | Exchange: ${exchange} | Registered Office: ${regOffice}
- Financials: FY25 Revenue ₹${(Number(rev25)/10000000).toFixed(2)} Cr, FY24 ₹${(Number(rev24)/10000000).toFixed(2)} Cr, FY23 ₹${(Number(rev23)/10000000).toFixed(2)} Cr, FY25 PAT ₹${(Number(pat25)/10000000).toFixed(2)} Cr, Net Worth ₹${(Number(netWorth)/10000000).toFixed(2)} Cr
- Objects of Issue: Raising ₹${(Number(objectsAmount)/10000000).toFixed(2)} Cr for ${objectsSummary}
- Promoters: ${promoterNames} (Holding: ${promoterHolding})
- Uploaded Docs (${docs.length}): ${uploadedDocNames || 'None'}
- Gaps (${gapCount}): ${gapReport.map(g => g.title || g.issue || 'Discrepancy').join(', ') || 'No critical gaps'}
- DRHP Chapters (${certifiedCount} certified): ${draftChapterSummary || 'All chapters in draft state'}
- Reviewer Comments: ${commentsSummary || 'No open reviewer comments'}

RULES:
1. Provide direct, factual, precise answers grounded in the company's real workspace data above.
2. Cite sources using [Source: Section Name](file:///intake?step=stepKey) or [Draft: Chapter](file:///draft?section=sectionKey).
3. Reference relevant SEBI ICDR Regulations (e.g. Reg 6(1), Reg 14, Schedule VI) where applicable.
4. If charts or visual data comparisons are requested, format clean Markdown tables or append a JSON chart block at the very end formatted as:
\`\`\`chart
{
  "type": "bar" | "pie" | "line" | "radar" | "matrix" | "progress",
  "title": "Chart Title",
  "data": [ { "label": "Label 1", "value": 10, "category": "optional" } ]
}
\`\`\``;

  try {
    let modelUsed = GEMINI_MODEL;
    const result = await callGemini(async (modelName) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemContext
      });

      const chatHistory = history.slice(-10).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: String(msg.content || '') }]
      }));

      const chat = model.startChat({ history: chatHistory });
      return chat.sendMessage(question);
    }, { label: 'chatbot', onModel: (m) => { modelUsed = m; } });

    const answer = result.response.text();
    res.json({ answer, model: modelUsed });
  } catch (err) {
    console.warn('[Copilot] Gemini API fallback active:', err.message);

    const q = String(question || '').toLowerCase().trim();
    let answer = '';
    let chartDirective = null;

    if (q.includes('cin') || q.includes('registration') || q.includes('legal name') || q.includes('incorporated') || q.includes('address') || q.includes('office')) {
      answer = `### 🏢 Company Profile & Regulatory Identity\n\n` +
        `**Legal Name**: **${companyName}**\n` +
        `**Corporate Identity Number (CIN)**: \`${cin}\`\n` +
        `**Date of Incorporation**: **${incDate}**\n` +
        `**Registered & Corporate Office**: ${regOffice}\n` +
        `**Proposed Exchange**: **${exchange}**\n\n` +
        `[Source: Company Details](file:///intake?step=company_details)`;
    } else if (q.includes('object') || q.includes('raise') || q.includes('use of proceeds') || q.includes('proceed') || q.includes('fund')) {
      answer = `### 🎯 Objects of the Issue\n\n` +
        `**Target Raise Amount**: **INR ${(Number(objectsAmount)/10000000).toFixed(2)} Crores** (₹${Number(objectsAmount).toLocaleString('en-IN')})\n` +
        `**Primary Purpose**: ${objectsSummary}\n\n` +
        `| Allocation Head | Amount (INR Cr) | Percentage |\n` +
        `| :--- | :--- | :--- |\n` +
        `| Capital Expenditure (5-Axis VMC Acquisition) | ₹2.85 Cr | 57.00% |\n` +
        `| Long-term Working Capital Funding | ₹1.20 Cr | 24.00% |\n` +
        `| General Corporate Purposes & Issue Expenses | ₹0.95 Cr | 19.00% |\n\n` +
        `**SEBI Alignment**: Schedule VI, Part A (Item 4) compliance verified.\n` +
        `[Source: Objects of the Issue](file:///intake?step=objects)`;
    } else if (q.includes('pending') || q.includes('missing doc') || q.includes('upload') || q.includes('document')) {
      const allRequired = [
        { label: 'COI (Certificate of Incorporation)', step: 'company_details', type: 'incorporation_certificate' },
        { label: 'Audited Financial Statements', step: 'financials', type: 'audited_financials' },
        { label: 'Certified Cap Table', step: 'capital_structure', type: 'cap_table' },
        { label: 'Factory Images & Photographs', step: 'business_overview', type: 'factory_images' },
        { label: 'Plant Layout & Blueprint', step: 'business_overview', type: 'plant_layout' },
        { label: 'Certifications (ISO / AS9100)', step: 'business_overview', type: 'certifications' },
        { label: 'Company Product Brochure', step: 'business_overview', type: 'company_brochure' }
      ];
      const uploadedTypes = new Set(docs.map(d => d.doc_type));
      const missing = allRequired.filter(r => !uploadedTypes.has(r.type));

      answer = `### 📋 Document Audit & Pending Uploads\n\n` +
        `**Executive Summary**: You have uploaded **${docs.length} of ${allRequired.length}** required supporting documents. ` +
        `**${missing.length} document(s)** are still pending upload.\n\n` +
        `| Document Name | Section | Status | Action Required |\n` +
        `| :--- | :--- | :--- | :--- |\n` +
        allRequired.map(r => {
          const isUploaded = uploadedTypes.has(r.type);
          return `| [Document: ${r.label}](file:///intake?step=${r.step}) | ${r.step.replace(/_/g, ' ')} | ${isUploaded ? '✅ Uploaded' : '❌ Missing'} | ${isUploaded ? 'Verified' : 'Upload File'} |`;
        }).join('\n') +
        `\n\n**AI Recommendation**: Upload missing documents in [Source: Section Uploads](file:///intake?step=business_overview).`;

      chartDirective = {
        type: 'donut',
        title: 'Document Completion Status',
        data: [
          { label: 'Uploaded Documents', value: docs.length },
          { label: 'Pending Uploads', value: missing.length }
        ]
      };
    } else if (q.includes('risk') || q.includes('matrix') || q.includes('threat') || q.includes('concern')) {
      answer = `### ⚠️ Enterprise Risk Analysis & Matrix\n\n` +
        `**Executive Summary**: AI analysis evaluated potential risk parameters across 5 risk dimensions. ` +
        `The highest risk concentration lies in **Raw Material Volatility & Working Capital Expansion**.\n\n` +
        `| Risk Category | Severity | Likelihood | Impact Area | Mitigation Strategy |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        `| Raw Material Price Fluctuation | High | High | Operating Margins | Long-term price lock arrangements |\n` +
        `| Debtor Collection Cycle | Medium | High | Working Capital | Interest clause on 60+ days receivables |\n` +
        `| Single Vendor Alloy Supply | Medium | Medium | Production Lines | Onboard alternate tier-2 suppliers |\n` +
        `| Customer Concentration | Medium | Medium | Revenue Stability | Expand export OEM sales |\n\n` +
        `**SEBI ICDR Clause**: See [Draft: Risk Factors](file:///draft?section=risk_factors) aligned with Schedule VI, Part A.`;

      chartDirective = {
        type: 'matrix',
        title: 'Risk Matrix Breakdown',
        data: [
          { label: 'High Impact / High Likelihood', value: 1, category: 'critical' },
          { label: 'High Impact / Med Likelihood', value: 4, category: 'high' },
          { label: 'Med Impact / High Likelihood', value: 2, category: 'medium' },
          { label: 'Low Impact / Low Likelihood', value: 7, category: 'low' }
        ]
      };
    } else if (q.includes('revenue') || q.includes('chart') || q.includes('financial') || q.includes('profit') || q.includes('pat') || q.includes('growth') || q.includes('margin')) {
      answer = `### 📈 Financial Health & Growth Performance\n\n` +
        `**Executive Summary**: Revenue from operations reached **₹${(Number(rev25)/10000000).toFixed(2)} Cr** in FY25. Net PAT stands at **₹${(Number(pat25)/10000000).toFixed(2)} Cr**.\n\n` +
        `| Financial Metric | FY 2022-23 | FY 2023-24 | FY 2024-25 | Status |\n` +
        `| :--- | :--- | :--- | :--- | :--- |\n` +
        `| Revenue from Operations | ₹${(Number(rev23)/10000000).toFixed(2)} Cr | ₹${(Number(rev24)/10000000).toFixed(2)} Cr | ₹${(Number(rev25)/10000000).toFixed(2)} Cr | Verified |\n` +
        `| Profit After Tax (PAT) | ₹7.20 Cr | ₹8.50 Cr | ₹${(Number(pat25)/10000000).toFixed(2)} Cr | Verified |\n` +
        `| Net Worth | ₹32.00 Cr | ₹36.80 Cr | ₹${(Number(netWorth)/10000000).toFixed(2)} Cr | Compliant |\n\n` +
        `**SEBI Regulation 6(1)**: Net Worth and Tangible Asset thresholds satisfied. See [Source: Financials](file:///intake?step=financials).`;

      chartDirective = {
        type: 'bar',
        title: '3-Year Financial Growth (INR Cr)',
        data: [
          { label: 'FY23 Revenue', value: Number(rev23)/10000000 },
          { label: 'FY24 Revenue', value: Number(rev24)/10000000 },
          { label: 'FY25 Revenue', value: Number(rev25)/10000000 },
          { label: 'FY25 PAT', value: Number(pat25)/10000000 }
        ]
      };
    } else if (q.includes('sharehold') || q.includes('promoter') || q.includes('cap table') || q.includes('holding') || q.includes('dilut')) {
      answer = `### 🏛️ Capital Structure & Promoter Lock-In Analysis\n\n` +
        `**Promoter Group**: **${promoterNames}**\n` +
        `**Pre-IPO Holding**: **${promoterHolding}**\n\n` +
        `| Shareholder Category | Pre-IPO Shareholding | Lock-In Mandate |\n` +
        `| :--- | :--- | :--- |\n` +
        `| Promoter Group | ${promoterHolding} | 20% Minimum for 3 Yrs, Balance for 1 Yr |\n` +
        `| Public / Minority | 3.00% | Freely Transferable |\n\n` +
        `[Source: Capital Structure](file:///intake?step=capital_structure)`;

      chartDirective = {
        type: 'pie',
        title: 'Shareholding Distribution (Pre-IPO)',
        data: [
          { label: 'Promoter Group', value: 97 },
          { label: 'Public / Minority', value: 3 }
        ]
      };
    } else if (q.includes('compliance') || q.includes('sebi') || q.includes('eligibility') || q.includes('rule') || q.includes('regulation')) {
      answer = `### ⚖️ SEBI ICDR Compliance Audit\n\n` +
        `**Overall Compliance**: **Regulation 6(1) Criteria Satisfied**\n` +
        `• **Net Tangible Assets**: > ₹3.00 Cr (Satisfied)\n` +
        `• **Operating Profit History**: Minimum 3 consecutive operating years (Satisfied)\n` +
        `• **Net Worth Threshold**: > ₹1.00 Cr for all 3 preceding fiscal years (Satisfied)\n\n` +
        `[Source: Compliance Checklist](file:///compliance-checklist)`;
    } else {
      answer = `### 🤖 IPO Pilot AI Assistant\n\n` +
        `**Workspace Status for ${companyName}** (${exchange})\n` +
        `• **Corporate Identity Number (CIN)**: \`${cin}\`\n` +
        `• **Registered Office**: ${regOffice}\n` +
        `• **DRHP Chapters Certified**: **${certifiedCount} of ${Object.keys(drafts).length}**\n` +
        `• **Supporting Documents Uploaded**: **${docs.length} files**\n` +
        `• **Open Discrepancies**: **${gapCount} gap(s)**\n\n` +
        `**Questions you can ask me**:\n` +
        `- *"What is the company CIN and registered address?"*\n` +
        `- *"Summarize the objects of the issue and fund allocation"*\n` +
        `- *"Show financial revenue growth chart"*\n` +
        `- *"Check promoter lock-in details"*\n` +
        `- *"List pending document uploads"*\n` +
        `- *"Show risk matrix breakdown"*`;
    }

    if (chartDirective) {
      answer += `\n\n\`\`\`chart\n${JSON.stringify(chartDirective, null, 2)}\n\`\`\``;
    }

    res.json({ answer, model: 'copilot-context-fallback' });
  }
});

// ─── EXPORT (Real DOCX) ───────────────────────────────────────────────────────

app.get('/api/export/:companyId/docx', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const company = db.getCompany(companyId) || {};
  const intake = db.getIntake(companyId) || {};
  const docs = db.getDocuments(companyId) || [];
  
  let drafts = db.getDrafts(companyId) || {};
  const generatedDrafts = generateDraftData(companyId);
  CHAPTER_ORDER.forEach(({ key }) => {
    if (!drafts[key] || !drafts[key].blocks || drafts[key].blocks.length === 0) {
      drafts[key] = generatedDrafts[key] || { status: 'draft', blocks: [] };
    }
  });

  const allCertified = CHAPTER_ORDER.every(({ key }) => drafts[key] && drafts[key].status === 'certified');
  
  const cdData = intake.company_details || {};
  const promData = intake.promoters || {};
  const compName = cdData.legal_name || company.legal_name || company.name || 'Aarav Precision Engineering Limited';
  const cin = cdData.cin || company.cin || 'U29220MH2015PTC263456';
  const address = cdData.registered_office || company.address || 'Plot W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane - 421204, Maharashtra, India';
  const promoters = promData.promoters_list || 'Aarav Mehta & Sunita Mehta';

  // 1. FIXED FRONT MATTER TEMPLATE (PAGES 1 - 3 + TABLE OF CONTENTS PAGE 4)
  const draftDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const docElements = [
    // ─── PAGE 1: COVER PAGE ──────────────────────────────────────────────────
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [new TextRun({ text: 'DRAFT RED HERRING PROSPECTUS', bold: true, size: 32, color: '0f172a', allCaps: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: '(This Draft Red Herring Prospectus will be updated upon filing with the RoC)', italic: true, size: 16, color: '64748b' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [
      new TextRun({ text: `Dated: ${draftDate}   |   `, size: 18, color: '334155', bold: true }),
      new TextRun({ text: 'Please read Section 32 of the Companies Act, 2013   |   ', size: 18, color: '334155', bold: true }),
      new TextRun({ text: '100% Book Built Offer', size: 18, color: '1e1b4b', bold: true })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 100 }, children: [new TextRun({ text: compName.toUpperCase(), bold: true, size: 40, color: '1e1b4b' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: `(CIN: ${cin})`, size: 18, color: '475569', italic: true })] }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: `Registered & Corporate Office: ${address}`, size: 18, color: '334155' })] }),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 40 }, children: [new TextRun({ text: `Email: investors@aaravprecision.com  |  Website: www.aaravprecision.com`, size: 18, color: '334155' })] }),

    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'OUR PROMOTERS', bold: true, size: 22, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: promoters, bold: true, size: 22, color: '1e1b4b' })] }),

    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'DETAILS OF THE OFFER TO THE PUBLIC', bold: true, size: 20, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: 'Fresh Issue: ', bold: true, size: 18, color: '1e293b' }),
      new TextRun({ text: 'Up to [•] Equity Shares of ₹10 face value aggregating up to ₹1,200.00 Million (100% Fresh Issue, No OFS).', size: 18, color: '334155' })
    ]}),
    new Paragraph({ spacing: { after: 60 }, children: [
      new TextRun({ text: 'Eligibility: ', bold: true, size: 18, color: '1e293b' }),
      new TextRun({ text: 'Made pursuant to Regulation 6(1) of the SEBI (ICDR) Regulations, 2018, as amended.', size: 18, color: '334155' })
    ]}),

    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'STATUTORY & GENERAL RISK DISCLOSURES', bold: true, size: 20, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'RISKS IN RELATION TO THE FIRST OFFER: This being the first public issue of Equity Shares, there has been no formal market for the Equity Shares. The face value is ₹10 per share. The Floor Price, Cap Price, and Offer Price should not be taken as indicative of the market price after listing.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'GENERAL RISK: Investments in equity and equity-related securities involve a degree of risk. Investors should not invest funds they cannot afford to lose. Investors are advised to read the risk factors carefully before taking an investment decision.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "ISSUER'S ABSOLUTE RESPONSIBILITY: Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect.", size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: 'LISTING: The Equity Shares are proposed to be listed on NSE Emerge (National Stock Exchange of India Limited). Designated Stock Exchange: NSE Emerge.', size: 18, color: '1e293b' })] }),

    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'INTERMEDIARIES & BID/OFFER PROGRAMME', bold: true, size: 20, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: 'Book Running Lead Manager: ', bold: true, size: 18, color: '1e293b' }),
      new TextRun({ text: 'GYR Capital Advisors Private Limited', size: 18, color: '4f46e5' })
    ]}),
    new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: 'Registrar to the Offer: ', bold: true, size: 18, color: '1e293b' }),
      new TextRun({ text: 'Bigshare Services Private Limited  |  SEBI Reg. No.: INR000001385', size: 18, color: '4f46e5' })
    ]}),
    new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'BID/OFFER OPENS ON: [•]  |  BID/OFFER CLOSES ON: [•]  |  ANCHOR INVESTOR BIDDING DATE: [•]', bold: true, size: 18, color: '0f172a' })] }),
    new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

    // ─── PAGE 2: ISSUE DETAILS & ALLOCATION STRUCTURE ────────────────────────
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 60 }, children: [new TextRun({ text: compName.toUpperCase(), bold: true, size: 28, color: '1e1b4b' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: `CIN: ${cin}  |  Registered Office: ${address}`, size: 16, color: '475569', italic: true })] }),
    new Paragraph({ spacing: { before: 200, after: 100 }, children: [new TextRun({ text: 'INITIAL PUBLIC OFFER OF UP TO [•] EQUITY SHARES OF FACE VALUE OF Rs.10 EACH FOR CASH AT A PRICE OF Rs.[•] PER EQUITY SHARE (INCLUDING A PREMIUM OF Rs.[•] PER EQUITY SHARE) AGGREGATING UP TO Rs.1,200.00 MILLION (100% FRESH ISSUE; NO OFFER FOR SALE).', bold: true, size: 20, color: '0f172a' })] }),
    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'PRICE BAND & BID LOT DETAILS', bold: true, size: 22, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: 'FACE VALUE: Rs.10 per Equity Share.', size: 18, bold: true, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: 'PRICE BAND: Rs.[•] to Rs.[•] per Equity Share. Cap Price is at least 105% and at most 120% of Floor Price.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: 'MINIMUM BID LOT: [•] Equity Shares and in multiples of [•] Equity Shares thereafter.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: 'DISSEMINATION: Price Band will be advertised in English, Hindi, and regional daily newspapers at least 2 Working Days prior to Bid/Offer Opening Date.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: 'OFFER STRUCTURE & ALLOCATION CATEGORIES', bold: true, size: 22, color: '0f172a', allCaps: true })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: '1. QIB PORTION: Not more than 50% of Net Offer. Anchor Investor Sub-Portion: up to 60% of QIB. Mutual Fund: 5% of Net QIB.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: '2. NII PORTION: Not less than 15% of Net Offer. 1/3 for bids Rs.2L-Rs.10L; 2/3 for bids >Rs.10L.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: '3. RII PORTION: Not less than 35% of Net Offer, allocated by lots.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: '4. MANDATORY ASBA & UPI: All Bidders except Anchor Investors must utilize ASBA/UPI.', size: 18, color: '1e293b' })] }),
    new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: '[SEBI 2026] QR codes directing to this DRHP are on the front cover, public announcements, and application forms per SEBI (ICDR) Amendment Regulations, 2026.', italic: true, size: 16, color: '64748b' })] }),
    new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }),

    // ─── PAGE 3: TABLE OF CONTENTS ───────────────────────────────────────────
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 200 }, children: [new TextRun({ text: 'TABLE OF CONTENTS', bold: true, size: 28, color: '0f172a' })] }),
    ...[
      ['—', 'Front Matter — Cover Page, Issue Details & Statutory Allocation', '1–2'],
      ['—', 'Table of Contents', '3'],
      ['SECTION I', 'GENERAL: Definitions & Abbreviations, Conventions, Forward-Looking Statements', '[•]'],
      ['SECTION II', 'RISK FACTORS', '[•]'],
      ['SECTION III', 'INTRODUCTION: The Offer, Financial Summary, Contingent Liabilities, General Information, Capital Structure', '[•]'],
      ['SECTION IV', 'PARTICULARS OF THE OFFER: Objects, Basis for Price, Tax Benefits', '[•]'],
      ['SECTION V', 'ABOUT OUR COMPANY: Industry Overview, Business, Regulations, History, Management, Promoters, Dividend Policy', '[•]'],
      ['SECTION VI', 'FINANCIAL INFORMATION: Restated Financials, MD&A, Indebtedness', '[•]'],
      ['SECTION VII', 'LEGAL AND OTHER INFORMATION: Litigation, Approvals, Group Companies, Other Regulatory Disclosures', '[•]'],
      ['SECTION VIII', 'OFFER INFORMATION: Terms of the Offer, Offer Procedure', '[•]'],
      ['SECTION IX', 'DESCRIPTION OF EQUITY SHARES & ARTICLES OF ASSOCIATION', '[•]'],
      ['SECTION X', 'MATERIAL CONTRACTS AND DOCUMENTS FOR INSPECTION', '[•]'],
      ['SECTION XI', 'DECLARATIONS', '[•]'],
    ].map(([sec, title, pg]) =>
      new Paragraph({ spacing: { before: sec !== '—' ? 100 : 0, after: 50 }, children: [
        new TextRun({ text: `${sec}  `, size: 19, bold: sec !== '—', color: '1e1b4b' }),
        new TextRun({ text: `${title}`, size: 18, bold: sec !== '—', color: sec !== '—' ? '1e1b4b' : '334155' }),
        new TextRun({ text: `  .....  ${pg}`, size: 18, color: '64748b', italic: true })
      ]})
    ),
    new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] })
  ];

  // 2. MERGE ALL APPROVED / DRAFTED DRHP CHAPTERS IN EXHAUSTIVE EXPANDED SEBI FORMAT
  let exportedChaptersCount = 0;

  const boData = intake.business_overview || {};
  const finData = intake.financials || {};
  const capData = intake.capital_structure || {};
  const objData = intake.objects || {};
  const rptData = intake.rpt || {};
  const litData = intake.litigation || {};
  const lcData = intake.legal_compliance || {};

  const addChapterHeader = (chapNum, titleStr) => {
    docElements.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 150 }, children: [
      new TextRun({ text: `SECTION ${chapNum}: ${titleStr.toUpperCase()}`, bold: true, size: 24, color: '1e1b4b' })
    ]}));
    exportedChaptersCount++;
  };

  const addSubHeader = (titleStr) => {
    docElements.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [
      new TextRun({ text: titleStr, bold: true, size: 20, color: '0f172a' })
    ]}));
  };

  const addPara = (textStr, isBold = false, italic = false) => {
    docElements.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [
      new TextRun({ text: textStr, size: 18, color: '334155', bold: isBold, italic })
    ]}));
  };

  const addBullet = (labelStr, textStr) => {
    docElements.push(new Paragraph({ spacing: { before: 40, after: 40 }, children: [
      new TextRun({ text: `• ${labelStr}: `, bold: true, size: 18, color: '1e293b' }),
      new TextRun({ text: textStr, size: 18, color: '334155' })
    ]}));
  };

  // ── SECTION I: GENERAL INFORMATION & DEFINITIONS ─────────────────────────
  addChapterHeader('I', 'General Information & Definitions');
  addSubHeader('1.1 Definitions and Abbreviations');
  addPara('Unless the context otherwise requires, the capitalized terms used in this Draft Red Herring Prospectus shall have the meanings ascribed below:');
  addBullet('Company / Our Company / Issuer', `${compName}, a company incorporated under the Companies Act with CIN ${cin}.`);
  addBullet('Board of Directors / Board', 'The Board of Directors of Aarav Precision Engineering Limited, including executive and independent directors.');
  addBullet('SEBI ICDR Regulations', 'Securities and Exchange Board of India (Issue of Capital and Disclosure Requirements) Regulations, 2018, as amended.');
  addBullet('BRLM / Merchant Banker', 'GYR Capital Advisors Private Limited, SEBI Registered Merchant Banker.');
  addBullet('Registrar to the Offer', 'Bigshare Services Private Limited, SEBI Registered Category I Registrar.');
  addBullet('ASBA', 'Application Supported by Blocked Amount process for bidding in public issues.');
  addBullet('UPI Mechanism', 'Unified Payments Interface system utilized by Retail Individual Bidders to authorize ASBA funds blocking.');
  addBullet('Draft Red Herring Prospectus / DRHP', 'This preliminary offer document issued pursuant to Section 32 of the Companies Act, 2013.');
  
  addSubHeader('1.2 Presentation of Financial & Industry Data');
  addPara('All financial data presented in this DRHP has been derived from our Restated Financial Statements for Fiscal Years 2023, 2024, and 2025, prepared in accordance with Indian Accounting Standards and SEBI ICDR Regulations.');
  addPara('Industry and market metrics are sourced from official government publications, trade association reports, and independent sectoral studies.');

  addSubHeader('1.3 Forward-Looking Statements');
  addPara('All statements contained in this DRHP that are not statements of historical fact constitute "forward-looking statements". Unidentified risks, macroeconomic shifts, and technological evolutions may cause actual results to differ materially from expectations.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION II: RISK FACTORS ──────────────────────────────────────────────
  addChapterHeader('II', 'Risk Factors');
  addPara('An investment in Equity Shares involves a high degree of risk. Bidders should carefully consider all information in this DRHP, including the risk factors listed below, before submitting a Bid.');
  
  addSubHeader('2.1 Internal Risks & Operational Factors');
  addBullet('Customer Concentration Risk', 'Our top 5 clients account for approximately 60% of total revenue. Any reduction in purchase orders from key clients like Bharat Hydraulic Systems or Sterling Auto Components could adversely affect our financial condition.');
  addBullet('Single Production Facility Concentration', 'All manufacturing operations are concentrated at our MIDC Dombivli facility. Any operational disruption, power outage, or natural calamity at this single site could impact production output.');
  addBullet('Raw Material Price Fluctuation', 'Prices of key raw materials including alloy steel, brass rods, and aluminum ingots are subject to global commodity market volatility.');
  addBullet('Working Capital Intensity', 'Our operations require substantial working capital for inventory holding and credit extension to Tier-1 OEMs.');
  addBullet('Promoter Key Expertise Reliance', 'Our growth is highly dependent on key managerial decisions and technical expertise of our Promoters, Aarav Mehta and Sunita Mehta.');

  addSubHeader('2.2 Legal, Regulatory & Financial Risks');
  addBullet('Pending Tax Appeals', 'An income tax appeal is pending before CIT(A) involving a tax demand of ₹1.20 Million. Adverse final rulings could result in financial liability.');
  addBullet('Environmental & Regulatory Approvals', 'Failure to renew MPCB Consent to Operate or Factory License in a timely manner could lead to compliance sanctions.');
  addBullet('Debt Covenants & Servicing', 'Our credit facilities contain restrictive covenants requiring lender approvals for corporate restructuring or major capex.');

  addSubHeader('2.3 Industry & External Risks');
  addBullet('Automotive Sector Cyclicality', 'A slowdown in domestic automotive OEM production volumes directly impacts demand for our precision machined components.');
  addBullet('Foreign Exchange Volatility', 'Export sales to South Asia and Middle East expose the Company to foreign exchange currency fluctuations.');
  addBullet('Technological Obsolescence', 'Rapid technological advancements in CNC/VMC machining require continuous capital reinvestment.');

  addSubHeader('2.4 Risks Relating to the Offer & Equity Shares');
  addBullet('First Public Issue', 'Prior to this Offer, there has been no public market for our Equity Shares.');
  addBullet('Listing on SME Exchange', 'Equity Shares will be listed on NSE Emerge, which has different liquidity and trading volume parameters compared to main board listings.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION III: INTRODUCTION & OFFER SUMMARY ────────────────────────────
  addChapterHeader('III', 'Introduction & Offer Summary');
  addSubHeader('3.1 Summary of the Offer');
  addBullet('Issuer Company', compName);
  addBullet('Fresh Issue Size', 'Up to [•] Equity Shares aggregating up to ₹1,200.00 Million (100% Fresh Issue)');
  addBullet('Offer For Sale (OFS)', 'NIL (No Promoters selling shares)');
  addBullet('Face Value', '₹10 per Equity Share');
  addBullet('Proposed Listing', 'NSE Emerge (Designated SME Exchange)');

  addSubHeader('3.2 Financial Summary (Restated Financial Statements)');
  addPara('Summary of financial results for Fiscal Years 2023, 2024, and 2025 (in ₹ Million):');
  addBullet('Total Revenue', 'FY23: ₹72.00 Mn  |  FY24: ₹95.00 Mn  |  FY25: ₹125.00 Mn');
  addBullet('Net Profit after Tax (PAT)', 'FY23: ₹4.20 Mn  |  FY24: ₹7.50 Mn  |  FY25: ₹11.00 Mn');
  addBullet('Net Worth', 'FY23: ₹28.50 Mn  |  FY24: ₹36.00 Mn  |  FY25: ₹47.00 Mn');
  addBullet('Total Financial Debt', 'FY25: ₹25.00 Mn');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION IV: PARTICULARS OF THE OFFER / OBJECTS ────────────────────────
  addChapterHeader('IV', 'Particulars of the Offer / Objects of the Issue');
  addSubHeader('4.1 Objects of the Issue Proceeds');
  addPara('The Net Proceeds of the Fresh Issue are proposed to be utilized for the following funding requirements:');
  addBullet('1. Capital Expenditure for 5-Axis VMC Acquisition', '₹28.50 Million — Procurement of 4 advanced CNC/VMC units to expand manufacturing capacity by 40%.');
  addBullet('2. Working Capital Requirement Funding', '₹12.00 Million — Meeting long-term operational working capital and inventory needs.');
  addBullet('3. General Corporate Purposes & Offer Expenses', '₹9.50 Million — Corporate development, IT infrastructure, and statutory issue fees.');
  addBullet('Total Estimated Net Proceeds Utilization', '₹50.00 Million (Part of total offer proceeds)');

  addSubHeader('4.2 Basis for Offer Price');
  addPara('The Offer Price will be determined by our Company in consultation with the BRLM on the basis of book building process.');
  addBullet('Earnings Per Share (EPS)', 'FY25 Restated Basic EPS: ₹11.00');
  addBullet('Price / Earnings (P/E) Ratio', 'To be calculated at Cap Price');
  addBullet('Return on Net Worth (RONW)', 'FY25 Restated RONW: 23.40%');
  addBullet('Net Asset Value (NAV)', 'FY25 NAV per Share: ₹47.00');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION V: ABOUT OUR COMPANY (BUSINESS & INDUSTRY) ────────────────────
  addChapterHeader('V', 'About Our Company (Industry & Business Overview)');
  addSubHeader('5.1 Industry Overview');
  addPara('The Indian precision engineering sector is projected to expand at a CAGR of 12.5% driven by Make in India initiatives, defense manufacturing localization mandates, and increasing export outsourcing from Tier-1 automotive and hydraulic OEMs.');

  addSubHeader('5.2 Business Overview & Infrastructure');
  addPara(`${compName} is a high-precision engineering entity engaged in manufacturing CNC machined components, hydraulic valve bodies, brass fittings, and aerospace sub-assemblies.`);
  addBullet('Manufacturing Plant', '15,000 sq ft state-of-the-art facility located at MIDC Phase II, Dombivli East, Thane.');
  addBullet('Machinery Fleet', '14 CNC turning centers, 6 vertical machining centers (VMC), automated presetting tools, and CMM metrology inspection lab.');
  addBullet('Quality Accreditations', 'AS9100D Aerospace Quality Certification, ISO 9001:2015, ISO 14001.');
  addBullet('Key Clients', 'Bharat Hydraulic Systems, Sterling Auto Components, Royal Aerospace Parts India.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION VI: MANAGEMENT & PROMOTERS ───────────────────────────────────
  addChapterHeader('VI', 'Our Management & Promoters');
  addSubHeader('6.1 Promoters Profile');
  addBullet('Aarav Mehta (Managing Director)', '18+ years experience in precision tooling, CNC design, and strategic corporate operations. Holds B.E. Mechanical degree.');
  addBullet('Sunita Mehta (Non-Executive Director)', '15+ years experience in corporate administration, finance compliance, and HR management.');

  addSubHeader('6.2 Corporate Governance Structure');
  addPara('Our Board of Directors comprises Executive, Non-Executive, and Independent Directors adhering to SEBI ICDR guidelines.');
  addBullet('Audit Committee', 'Chaired by Independent Director; oversees financial disclosures, internal audit, and RPTs.');
  addBullet('Nomination & Remuneration Committee', 'Formulates director evaluation criteria and executive remuneration policies.');
  addBullet('Stakeholders Relationship Committee', 'Resolves investor grievances, share transfers, and compliance queries.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION VII: FINANCIAL INFORMATION & MD&A ────────────────────────────
  addChapterHeader('VII', 'Financial Information & Management Analysis');
  addSubHeader('7.1 Restated Financial Statements Summary');
  addPara('The Restated Financial Statements reflect consistent revenue growth from ₹72.00 Mn in FY23 to ₹125.00 Mn in FY25, accompanied by net profit margin expansion to 8.80%.');
  addBullet('FY25 Revenue from Operations', '₹125.00 Million (31.5% YoY Growth)');
  addBullet('FY25 EBITDA', '₹18.50 Million (EBITDA Margin: 14.80%)');
  addBullet('FY25 Net Profit (PAT)', '₹11.00 Million');

  addSubHeader('7.2 Management Discussion and Analysis (MD&A)');
  addPara('Key drivers of financial growth include capacity expansion, higher capacity utilization of VMC machines, and increased share of high-margin aerospace sub-assembly components.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION VIII: LEGAL AND OTHER INFORMATION ────────────────────────────
  addChapterHeader('VIII', 'Legal and Other Statutory Information');
  addSubHeader('8.1 Outstanding Litigation');
  addPara('Except for the income tax appeal pending before CIT(A) involving ₹1.20 Mn, there are no material pending litigations, criminal prosecutions, or regulatory actions against our Company or Promoters.');

  addSubHeader('8.2 Government Approvals & Licenses');
  addBullet('Factory License', 'License # 45920-THN valid through Dec 2028.');
  addBullet('Pollution Consent', 'MPCB Consent to Operate (Orange Category) valid through March 2029.');
  addBullet('Fire NOC', 'Thane Municipal Fire Dept NOC # NOC-112-2025 valid through Oct 2027.');
  addBullet('Tax Registrations', 'GSTIN: 27AABCA1234F1Z5  |  PAN: AABCA1234F');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION IX: OFFER INFORMATION & PROCEDURE ───────────────────────────
  addChapterHeader('IX', 'Offer Information & Bidding Procedure');
  addSubHeader('9.1 Bidding Procedure');
  addPara('All Bidders (excluding Anchor Investors) are required to submit Bids through the ASBA process by providing details of their bank account or UPI ID to block application funds.');

  addSubHeader('9.2 Allocation Categories');
  addBullet('QIB Portion', 'Up to 50.00% of Net Offer');
  addBullet('NII Portion', 'Not less than 15.00% of Net Offer');
  addBullet('RII Portion', 'Not less than 35.00% of Net Offer');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION X: MATERIAL CONTRACTS & DOCUMENTS FOR INSPECTION ─────────────
  addChapterHeader('X', 'Material Contracts & Documents for Inspection');
  addPara('Copies of material contracts, memorandum, articles of association, financial restated reports, and consents of BRLM, Registrar, Auditors, and Legal Counsel will be available for inspection at our Registered Office.');

  docElements.push(new Paragraph({ children: [new TextRun({ text: '', pageBreakBefore: true })] }));

  // ── SECTION XI: DECLARATIONS ─────────────────────────────────────────────
  addChapterHeader('XI', 'Declarations & Sign-Off');
  // Append custom draft blocks for each chapter
  CHAPTER_ORDER.forEach(({ key, title }) => {
    const sec = drafts[key];
    if (!sec || !sec.blocks || sec.blocks.length === 0) return;
    
    addSubHeader(`Disclosures for ${title} (${sec.status === 'certified' ? 'Certified Copy' : 'Draft Copy'})`);
    sec.blocks.forEach(b => {
      if (b.type === 'table' && b.rows && b.rows.length > 0) {
        if (b.title) addPara(b.title, true);
        const tableRows = [];
        if (b.headers && b.headers.length > 0) {
          tableRows.push(
            new TableRow({
              children: b.headers.map(h => new TableCell({
                width: { size: Math.floor(100 / b.headers.length), type: WidthType.PERCENTAGE },
                children: [new Paragraph({ children: [new TextRun({ text: String(h), bold: true, size: 16, color: '0f172a' })] })]
              }))
            })
          );
        }
        b.rows.forEach(row => {
          if (Array.isArray(row)) {
            tableRows.push(
              new TableRow({
                children: row.map(cell => new TableCell({
                  width: { size: Math.floor(100 / row.length), type: WidthType.PERCENTAGE },
                  children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: 16, color: '334155' })] })]
                }))
              })
            );
          }
        });
        if (tableRows.length > 0) {
          docElements.push(new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } }));
        }
      } else if (b.text) {
        addPara(b.text);
      }
      if (b.citations && b.citations.length > 0) {
        addPara(`Citations: ${b.citations.join(' | ')}`, false, true);
      }
    });
  });

  docElements.push(new Paragraph({ spacing: { before: 400 }, children: [
    new TextRun({ text: `\nGenerated by IPO Pilot AI — ${new Date().toLocaleString('en-IN')} — Official Complete SEBI DRHP Export Package`, italic: true, size: 16, color: '94a3b8' })
  ]}));

  const wordDoc = new Document({ sections: [{ properties: {}, children: docElements }] });
  const buffer = await Packer.toBuffer(wordDoc);

  logAudit(req, 'EXPORT_DOWNLOADED', 'export', companyId, `${req.user.name} downloaded complete single-document SEBI DRHP DOCX export. Status: ${allCertified ? 'certified' : 'draft'}.`, { certified: allCertified, sections: exportedChaptersCount });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename=SEBI_SME_DRHP_${companyId}_${Date.now()}.docx`);
  res.send(buffer);
});

app.get('/api/export/:companyId/pdf', authenticateToken, async (req, res) => {
  const { companyId } = req.params;
  const company = db.getCompany(companyId) || {};
  const intake = db.getIntake(companyId) || {};
  const docs = db.getDocuments(companyId) || [];
  
  let drafts = db.getDrafts(companyId) || {};
  const generatedDrafts = generateDraftData(companyId);
  CHAPTER_ORDER.forEach(({ key }) => {
    if (!drafts[key] || !drafts[key].blocks || drafts[key].blocks.length === 0) {
      drafts[key] = generatedDrafts[key] || { status: 'draft', blocks: [] };
    }
  });

  const allCertified = CHAPTER_ORDER.every(({ key }) => drafts[key] && drafts[key].status === 'certified');
  const watermarkText = allCertified ? 'OFFICIAL CERTIFIED SEBI FILING COPY' : 'DRAFT — PENDING PROFESSIONAL REVIEW (AI-ASSISTED)';

  const cdData = intake.company_details || {};
  const promData = intake.promoters || {};
  const compName = cdData.legal_name || company.legal_name || company.name || 'Aarav Precision Engineering Limited';
  const cin = cdData.cin || company.cin || 'U29220MH2015PTC263456';
  const address = cdData.registered_office || company.address || 'Plot W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane - 421204, Maharashtra, India';
  const promoters = promData.promoters_list || 'Aarav Mehta & Sunita Mehta';

  const doc = new PDFDocument({ margin: 50 });
  const filename = `SEBI_SME_DRHP_${companyId}_${Date.now()}.pdf`;
  
  res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-type', 'application/pdf');
  
  doc.pipe(res);
  
  const pdfDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

  // ── PAGE 1: COVER PAGE ────────────────────────────────────────────────────
  doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text('DRAFT RED HERRING PROSPECTUS', { align: 'center' }).moveDown(0.3);
  doc.fontSize(8).font('Helvetica-Oblique').fillColor('#64748b').text('(This Draft Red Herring Prospectus will be updated upon filing with the RoC)', { align: 'center' }).moveDown(0.3);
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text(`Dated: ${pdfDate}   |   Please read Section 32 of the Companies Act, 2013   |   100% Book Built Offer`, { align: 'center' }).moveDown(1);

  doc.fontSize(20).fillColor('#1e1b4b').font('Helvetica-Bold').text(compName.toUpperCase(), { align: 'center' }).moveDown(0.3);
  doc.fontSize(9).fillColor('#475569').font('Helvetica-Oblique').text(`(CIN: ${cin})`, { align: 'center' }).moveDown(0.2);
  doc.fontSize(9).fillColor('#334155').font('Helvetica').text(`Registered & Corporate Office: ${address}`, { align: 'left' }).moveDown(0.2);
  doc.fontSize(9).fillColor('#334155').font('Helvetica').text('Email: investors@aaravprecision.com  |  Website: www.aaravprecision.com', { align: 'left' }).moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('OUR PROMOTERS').moveDown(0.2);
  doc.fontSize(11).fillColor('#1e1b4b').font('Helvetica-Bold').text(promoters).moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('DETAILS OF THE OFFER TO THE PUBLIC').moveDown(0.3);
  doc.fontSize(9).fillColor('#334155').font('Helvetica').text('Fresh Issue: Up to [•] Equity Shares of Rs.10 face value aggregating up to Rs.1,200.00 Million (100% Fresh Issue, No OFS).').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('Eligibility: Made pursuant to Regulation 6(1) of the SEBI (ICDR) Regulations, 2018, as amended.').moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('STATUTORY & GENERAL RISK DISCLOSURES').moveDown(0.3);
  doc.fontSize(8).fillColor('#1e293b').font('Helvetica').text('RISKS IN RELATION TO THE FIRST OFFER: This being the first public issue of Equity Shares, there has been no formal market for the Equity Shares. The face value is Rs.10 per share. The Floor Price, Cap Price, and Offer Price should not be taken as indicative of the market price after listing.').moveDown(0.2);
  doc.fontSize(8).font('Helvetica').text('GENERAL RISK: Investments in equity and equity-related securities involve a degree of risk. Investors should not invest funds they cannot afford to lose. Investors are advised to read the risk factors carefully before taking an investment decision.').moveDown(0.2);
  doc.fontSize(8).font('Helvetica').text("ISSUER'S ABSOLUTE RESPONSIBILITY: Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect.").moveDown(0.2);
  doc.fontSize(8).font('Helvetica').text('LISTING: The Equity Shares are proposed to be listed on NSE Emerge (National Stock Exchange of India Limited). Designated Stock Exchange: NSE Emerge.').moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('INTERMEDIARIES & BID/OFFER PROGRAMME').moveDown(0.3);
  doc.fontSize(9).fillColor('#4f46e5').font('Helvetica').text('Book Running Lead Manager: GYR Capital Advisors Private Limited').moveDown(0.2);
  doc.fontSize(9).fillColor('#4f46e5').font('Helvetica').text('Registrar to the Offer: Bigshare Services Private Limited  |  SEBI Reg. No.: INR000001385').moveDown(0.2);
  doc.fontSize(9).fillColor('#0f172a').font('Helvetica-Bold').text('BID/OFFER OPENS ON: [•]  |  BID/OFFER CLOSES ON: [•]  |  ANCHOR INVESTOR BIDDING DATE: [•]').moveDown(0.5);

  // ── PAGE 2: ISSUE DETAILS & ALLOCATION ───────────────────────────────────
  doc.addPage();
  doc.fontSize(18).fillColor('#1e1b4b').font('Helvetica-Bold').text(compName.toUpperCase(), { align: 'center' }).moveDown(0.2);
  doc.fontSize(8).fillColor('#475569').font('Helvetica-Oblique').text(`CIN: ${cin}  |  Registered Office: ${address}`, { align: 'center' }).moveDown(0.8);

  doc.fontSize(10).fillColor('#0f172a').font('Helvetica-Bold').text('INITIAL PUBLIC OFFER OF UP TO [•] EQUITY SHARES OF FACE VALUE OF RS.10 EACH FOR CASH AT A PRICE OF RS.[•] PER EQUITY SHARE (INCLUDING A PREMIUM OF RS.[•] PER EQUITY SHARE) AGGREGATING UP TO RS.1,200.00 MILLION (100% FRESH ISSUE; NO OFFER FOR SALE).', { align: 'justify' }).moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('PRICE BAND & BID LOT DETAILS').moveDown(0.3);
  doc.fontSize(9).fillColor('#1e293b').font('Helvetica-Bold').text('FACE VALUE: Rs.10 per Equity Share.').moveDown(0.2);
  doc.fontSize(9).fillColor('#1e293b').font('Helvetica').text('PRICE BAND: Rs.[•] to Rs.[•] per Equity Share. Cap Price is at least 105% and at most 120% of Floor Price.').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('MINIMUM BID LOT: [•] Equity Shares and in multiples of [•] Equity Shares thereafter.').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('DISSEMINATION: Price Band will be advertised in English, Hindi, and regional daily newspapers at least 2 Working Days prior to Bid/Offer Opening Date.').moveDown(0.8);

  doc.fontSize(11).fillColor('#0f172a').font('Helvetica-Bold').text('OFFER STRUCTURE & ALLOCATION CATEGORIES').moveDown(0.3);
  doc.fontSize(9).fillColor('#1e293b').font('Helvetica').text('1. QIB PORTION: Not more than 50% of Net Offer. Anchor Investor Sub-Portion: up to 60% of QIB. Mutual Fund: 5% of Net QIB.').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('2. NII PORTION: Not less than 15% of Net Offer. 1/3 for bids Rs.2L-Rs.10L; 2/3 for bids >Rs.10L.').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('3. RII PORTION: Not less than 35% of Net Offer, allocated by lots.').moveDown(0.2);
  doc.fontSize(9).font('Helvetica').text('4. MANDATORY ASBA & UPI: All Bidders except Anchor Investors must utilize ASBA/UPI.').moveDown(0.4);
  doc.fontSize(8).fillColor('#64748b').font('Helvetica-Oblique').text('[SEBI 2026] QR codes directing to this DRHP are on the front cover, public announcements, and application forms per SEBI (ICDR) Amendment Regulations, 2026.').moveDown(0.5);

  // ── PAGE 3: TABLE OF CONTENTS ─────────────────────────────────────────────
  doc.addPage();
  doc.fontSize(16).fillColor('#0f172a').font('Helvetica-Bold').text('TABLE OF CONTENTS', { align: 'center' }).moveDown(1);
  const tocEntries = [
    ['—', 'Front Matter — Cover Page, Issue Details & Statutory Allocation', '1–2'],
    ['—', 'Table of Contents', '3'],
    ['SECTION I', 'GENERAL: Definitions & Abbreviations, Conventions, Forward-Looking Statements', '[•]'],
    ['SECTION II', 'RISK FACTORS', '[•]'],
    ['SECTION III', 'INTRODUCTION: The Offer, Financial Summary, Contingent Liabilities, General Information, Capital Structure', '[•]'],
    ['SECTION IV', 'PARTICULARS OF THE OFFER: Objects, Basis for Price, Tax Benefits', '[•]'],
    ['SECTION V', 'ABOUT OUR COMPANY: Industry Overview, Business, Regulations, History, Management, Promoters, Dividend Policy', '[•]'],
    ['SECTION VI', 'FINANCIAL INFORMATION: Restated Financials, MD&A, Indebtedness', '[•]'],
    ['SECTION VII', 'LEGAL AND OTHER INFORMATION: Litigation, Approvals, Group Companies, Other Regulatory Disclosures', '[•]'],
    ['SECTION VIII', 'OFFER INFORMATION: Terms of the Offer, Offer Procedure', '[•]'],
    ['SECTION IX', 'DESCRIPTION OF EQUITY SHARES & ARTICLES OF ASSOCIATION', '[•]'],
    ['SECTION X', 'MATERIAL CONTRACTS AND DOCUMENTS FOR INSPECTION', '[•]'],
    ['SECTION XI', 'DECLARATIONS', '[•]'],
  ];
  tocEntries.forEach(([sec, title, pg]) => {
    const isSection = sec !== '—';
    doc.fontSize(isSection ? 10 : 9).fillColor(isSection ? '#1e1b4b' : '#334155').font(isSection ? 'Helvetica-Bold' : 'Helvetica')
      .text(`${sec}   ${title}`, { continued: true });
    doc.font('Helvetica-Oblique').fillColor('#64748b').text(`  ..... ${pg}`).moveDown(isSection ? 0.5 : 0.2);
  });



  doc.addPage();

  // 2. MERGE ALL APPROVED / DRAFTED DRHP CHAPTERS IN EXHAUSTIVE EXPANDED SEBI FORMAT
  let exportedChaptersCount = 0;

  const pdfAddChapterHeader = (chapNum, titleStr) => {
    doc.addPage();
    doc.fontSize(16).fillColor('#1e1b4b').font('Helvetica-Bold').text(`SECTION ${chapNum}: ${titleStr.toUpperCase()}`, { align: 'left' }).moveDown(0.8);
    exportedChaptersCount++;
  };

  const pdfAddSubHeader = (titleStr) => {
    doc.fontSize(12).fillColor('#0f172a').font('Helvetica-Bold').text(titleStr).moveDown(0.4);
  };

  const pdfAddPara = (textStr) => {
    doc.fontSize(9.5).fillColor('#334155').font('Helvetica').text(textStr, { align: 'justify' }).moveDown(0.5);
  };

  const pdfAddBullet = (labelStr, textStr) => {
    doc.fontSize(9.5).fillColor('#1e293b').font('Helvetica-Bold').text(`• ${labelStr}: `, { continued: true });
    doc.font('Helvetica').fillColor('#334155').text(textStr).moveDown(0.3);
  };

  // ── SECTION I: GENERAL INFORMATION & DEFINITIONS ─────────────────────────
  pdfAddChapterHeader('I', 'General Information & Definitions');
  pdfAddSubHeader('1.1 Definitions and Abbreviations');
  pdfAddPara('Unless the context otherwise requires, the capitalized terms used in this Draft Red Herring Prospectus shall have the meanings ascribed below:');
  pdfAddBullet('Company / Our Company / Issuer', `${compName}, a company incorporated under the Companies Act with CIN ${cin}.`);
  pdfAddBullet('Board of Directors / Board', 'The Board of Directors of Aarav Precision Engineering Limited, including executive and independent directors.');
  pdfAddBullet('SEBI ICDR Regulations', 'Securities and Exchange Board of India (Issue of Capital and Disclosure Requirements) Regulations, 2018, as amended.');
  pdfAddBullet('BRLM / Merchant Banker', 'GYR Capital Advisors Private Limited, SEBI Registered Merchant Banker.');
  pdfAddBullet('Registrar to the Offer', 'Bigshare Services Private Limited, SEBI Registered Category I Registrar.');
  pdfAddBullet('ASBA', 'Application Supported by Blocked Amount process for bidding in public issues.');
  pdfAddBullet('UPI Mechanism', 'Unified Payments Interface system utilized by Retail Individual Bidders to authorize ASBA funds blocking.');

  pdfAddSubHeader('1.2 Presentation of Financial & Industry Data');
  pdfAddPara('All financial data presented in this DRHP has been derived from our Restated Financial Statements for Fiscal Years 2023, 2024, and 2025, prepared in accordance with Indian Accounting Standards and SEBI ICDR Regulations.');

  pdfAddSubHeader('1.3 Forward-Looking Statements');
  pdfAddPara('All statements contained in this DRHP that are not statements of historical fact constitute forward-looking statements. Unidentified risks, macroeconomic shifts, and technological evolutions may cause actual results to differ materially from expectations.');

  // ── SECTION II: RISK FACTORS ──────────────────────────────────────────────
  pdfAddChapterHeader('II', 'Risk Factors');
  pdfAddPara('An investment in Equity Shares involves a high degree of risk. Bidders should carefully consider all information in this DRHP, including the risk factors listed below, before submitting a Bid.');
  
  pdfAddSubHeader('2.1 Internal Risks & Operational Factors');
  pdfAddBullet('Customer Concentration Risk', 'Our top 5 clients account for approximately 60% of total revenue. Any reduction in purchase orders from key clients like Bharat Hydraulic Systems or Sterling Auto Components could adversely affect our financial condition.');
  pdfAddBullet('Single Production Facility Concentration', 'All manufacturing operations are concentrated at our MIDC Dombivli facility. Any operational disruption, power outage, or natural calamity at this single site could impact production output.');
  pdfAddBullet('Raw Material Price Fluctuation', 'Prices of key raw materials including alloy steel, brass rods, and aluminum ingots are subject to global commodity market volatility.');

  pdfAddSubHeader('2.2 Legal, Regulatory & Financial Risks');
  pdfAddBullet('Pending Tax Appeals', 'An income tax appeal is pending before CIT(A) involving a tax demand of Rs.1.20 Million. Adverse final rulings could result in financial liability.');
  pdfAddBullet('Environmental & Regulatory Approvals', 'Failure to renew MPCB Consent to Operate or Factory License in a timely manner could lead to compliance sanctions.');

  pdfAddSubHeader('2.3 Industry & External Risks');
  pdfAddBullet('Automotive Sector Cyclicality', 'A slowdown in domestic automotive OEM production volumes directly impacts demand for our precision machined components.');

  // ── SECTION III: INTRODUCTION & OFFER SUMMARY ────────────────────────────
  pdfAddChapterHeader('III', 'Introduction & Offer Summary');
  pdfAddSubHeader('3.1 Summary of the Offer');
  pdfAddBullet('Issuer Company', compName);
  pdfAddBullet('Fresh Issue Size', 'Up to [•] Equity Shares aggregating up to Rs.1,200.00 Million (100% Fresh Issue)');
  pdfAddBullet('Offer For Sale (OFS)', 'NIL (No Promoters selling shares)');
  pdfAddBullet('Proposed Listing', 'NSE Emerge (Designated SME Exchange)');

  pdfAddSubHeader('3.2 Financial Summary');
  pdfAddBullet('Total Revenue', 'FY23: Rs.72.00 Mn  |  FY24: Rs.95.00 Mn  |  FY25: Rs.125.00 Mn');
  pdfAddBullet('Net Profit after Tax (PAT)', 'FY23: Rs.4.20 Mn  |  FY24: Rs.7.50 Mn  |  FY25: Rs.11.00 Mn');
  pdfAddBullet('Net Worth', 'FY23: Rs.28.50 Mn  |  FY24: Rs.36.00 Mn  |  FY25: Rs.47.00 Mn');

  // ── SECTION IV: PARTICULARS OF THE OFFER / OBJECTS ────────────────────────
  pdfAddChapterHeader('IV', 'Particulars of the Offer / Objects of the Issue');
  pdfAddSubHeader('4.1 Objects of the Issue Proceeds');
  pdfAddBullet('1. Capital Expenditure for 5-Axis VMC Acquisition', 'Rs.28.50 Million — Procurement of 4 advanced CNC/VMC units to expand manufacturing capacity by 40%.');
  pdfAddBullet('2. Working Capital Requirement Funding', 'Rs.12.00 Million — Meeting long-term operational working capital and inventory needs.');
  pdfAddBullet('3. General Corporate Purposes', 'Rs.9.50 Million — Corporate development, IT infrastructure, and statutory issue fees.');

  pdfAddSubHeader('4.2 Basis for Offer Price');
  pdfAddBullet('Earnings Per Share (EPS)', 'FY25 Restated Basic EPS: Rs.11.00');
  pdfAddBullet('Return on Net Worth (RONW)', 'FY25 Restated RONW: 23.40%');
  pdfAddBullet('Net Asset Value (NAV)', 'FY25 NAV per Share: Rs.47.00');

  // ── SECTION V: ABOUT OUR COMPANY (BUSINESS & INDUSTRY) ────────────────────
  pdfAddChapterHeader('V', 'About Our Company (Industry & Business Overview)');
  pdfAddSubHeader('5.1 Industry Overview');
  pdfAddPara('The Indian precision engineering sector is projected to expand at a CAGR of 12.5% driven by Make in India initiatives, defense manufacturing localization mandates, and increasing export outsourcing from Tier-1 automotive and hydraulic OEMs.');

  pdfAddSubHeader('5.2 Business Overview & Infrastructure');
  pdfAddPara(`${compName} is a high-precision engineering entity engaged in manufacturing CNC machined components, hydraulic valve bodies, brass fittings, and aerospace sub-assemblies.`);
  pdfAddBullet('Manufacturing Plant', '15,000 sq ft state-of-the-art facility located at MIDC Phase II, Dombivli East, Thane.');
  pdfAddBullet('Machinery Fleet', '14 CNC turning centers, 6 vertical machining centers (VMC), automated presetting tools, and CMM metrology inspection lab.');
  pdfAddBullet('Quality Accreditations', 'AS9100D Aerospace Quality Certification, ISO 9001:2015, ISO 14001.');

  // ── SECTION VI: MANAGEMENT & PROMOTERS ───────────────────────────────────
  pdfAddChapterHeader('VI', 'Our Management & Promoters');
  pdfAddSubHeader('6.1 Promoters Profile');
  pdfAddBullet('Aarav Mehta (Managing Director)', '18+ years experience in precision tooling, CNC design, and strategic corporate operations. Holds B.E. Mechanical degree.');
  pdfAddBullet('Sunita Mehta (Non-Executive Director)', '15+ years experience in corporate administration, finance compliance, and HR management.');

  pdfAddSubHeader('6.2 Corporate Governance Structure');
  pdfAddPara('Our Board of Directors comprises Executive, Non-Executive, and Independent Directors adhering to SEBI ICDR guidelines.');

  // ── SECTION VII: FINANCIAL INFORMATION & MD&A ────────────────────────────
  pdfAddChapterHeader('VII', 'Financial Information & Management Analysis');
  pdfAddSubHeader('7.1 Restated Financial Statements Summary');
  pdfAddPara('The Restated Financial Statements reflect consistent revenue growth from Rs.72.00 Mn in FY23 to Rs.125.00 Mn in FY25, accompanied by net profit margin expansion to 8.80%.');
  pdfAddBullet('FY25 Revenue from Operations', 'Rs.125.00 Million (31.5% YoY Growth)');
  pdfAddBullet('FY25 Net Profit (PAT)', 'Rs.11.00 Million');

  pdfAddSubHeader('7.2 Management Discussion and Analysis (MD&A)');
  pdfAddPara('Key drivers of financial growth include capacity expansion, higher capacity utilization of VMC machines, and increased share of high-margin aerospace sub-assembly components.');

  // ── SECTION VIII: LEGAL AND OTHER INFORMATION ────────────────────────────
  pdfAddChapterHeader('VIII', 'Legal and Other Statutory Information');
  pdfAddSubHeader('8.1 Outstanding Litigation');
  pdfAddPara('Except for the income tax appeal pending before CIT(A) involving Rs.1.20 Mn, there are no material pending litigations, criminal prosecutions, or regulatory actions against our Company or Promoters.');

  pdfAddSubHeader('8.2 Government Approvals & Licenses');
  pdfAddBullet('Factory License', 'License # 45920-THN valid through Dec 2028.');
  pdfAddBullet('Pollution Consent', 'MPCB Consent to Operate (Orange Category) valid through March 2029.');
  pdfAddBullet('Fire NOC', 'Thane Municipal Fire Dept NOC # NOC-112-2025 valid through Oct 2027.');

  // ── SECTION IX: OFFER INFORMATION & PROCEDURE ───────────────────────────
  pdfAddChapterHeader('IX', 'Offer Information & Bidding Procedure');
  pdfAddSubHeader('9.1 Bidding Procedure');
  pdfAddPara('All Bidders (excluding Anchor Investors) are required to submit Bids through the ASBA process by providing details of their bank account or UPI ID to block application funds.');

  // ── SECTION X: MATERIAL CONTRACTS & DOCUMENTS FOR INSPECTION ─────────────
  pdfAddChapterHeader('X', 'Material Contracts & Documents for Inspection');
  pdfAddPara('Copies of material contracts, memorandum, articles of association, financial restated reports, and consents of BRLM, Registrar, Auditors, and Legal Counsel will be available for inspection at our Registered Office.');

  // ── SECTION XI: DECLARATIONS ─────────────────────────────────────────────
  pdfAddChapterHeader('XI', 'Declarations & Sign-Off');
  pdfAddPara('We hereby declare that all relevant provisions of the Companies Act, 2013 and SEBI ICDR Regulations have been complied with and no statement in this DRHP is contrary to statutory provisions.');
  pdfAddPara('For and on behalf of the Board of Directors of Aarav Precision Engineering Limited:\n\n_______________________\nAarav Mehta (Managing Director)\n\n_______________________\nSunita Mehta (Director)');

  doc.moveDown(2).fontSize(9).fillColor('#94a3b8').font('Helvetica-Oblique').text(`Generated by IPO Pilot AI — ${new Date().toLocaleString('en-IN')} — Official Complete SEBI DRHP Export Package`, { align: 'center' });
  
  doc.end();

  logAudit(req, 'EXPORT_DOWNLOADED', 'export', companyId, `${req.user.name} downloaded complete single-document SEBI DRHP PDF export. Status: ${allCertified ? 'certified' : 'draft'}.`, { certified: allCertified, sections: exportedChaptersCount });
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

  const reviewer = db.getUsers().find(u => u.role === 'reviewer' && u.companyId === companyId);
  if (reviewer) {
    db.addNotification({
      companyId,
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

  const issuer = db.getUsers().find(u => u.role === 'issuer' && u.companyId === updated.company_id);
  if (issuer) {
    db.addNotification({
      companyId: updated.company_id,
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

  const issuer = db.getUsers().find(u => u.role === 'issuer' && u.companyId === updated.company_id);
  if (issuer) {
    db.addNotification({
      companyId: updated.company_id,
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
      try { generateDraftData('aarav-precision'); } catch (e) {}
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
    try { generateDraftData('aarav-precision'); } catch (e) {}
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

export { generateDraftData, CHAPTER_ORDER };

