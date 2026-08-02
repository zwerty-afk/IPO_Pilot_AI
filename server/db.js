import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  dynamoEnabled,
  initStore,
  isReady,
  readStore,
  writeStore,
  flushStore as flushDynamoStore
} from './dynamoStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

// ─── Password hashing (built-in crypto, no external deps) ──────────────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Legacy plaintext seed users (demo accounts) — still accepted.
  return stored === password;
}

const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';

const INITIAL_SEED = {
  users: [
    { email: 'aarav@example.com', password: 'demo123', role: 'issuer', name: 'Aarav Mehta', companyId: 'aarav-precision' },
    { email: 'priya@example.com', password: 'demo123', role: 'reviewer', name: 'Priya Sharma', companyId: 'aarav-precision' }
  ],
  companies: [
    {
      id: 'aarav-precision',
      name: 'Aarav Precision Engineering Pvt Ltd',
      legal_name: 'Aarav Precision Engineering Pvt Ltd',
      incorporation_date: '2015-04-12',
      cin: 'U29220MH2015PTC263456',
      authorized_capital: '20,000,000 INR (2,000,000 Equity Shares of Rs 10 each)',
      paid_up_capital: '10,000,000 INR (1,000,000 Equity Shares of Rs 10 each)'
    }
  ],
  intake: {
    'aarav-precision': {
      company_details: {
        legal_name: 'Aarav Precision Engineering Pvt Ltd',
        cin: 'U29220MH2015PTC263456',
        incorporation_date: '2015-04-12',
        registered_office: 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204',
        industry_type: 'Precision Engineering & Manufacturing'
      },
      business_overview: {
        industry_desc: 'The precision engineering industry in India serves critical sectors like Aerospace, Defense, Automotive, and Medical Devices, requiring ultra-tight tolerances and high-grade materials.',
        products: 'High-precision CNC machined components, brass fittings, specialized fasteners, and custom assemblies for automotive Tier-1 suppliers and hydraulic pump manufacturers.',
        customers: 'Primary clients include Bharat Hydraulic Systems, Sterling Auto Components, and Royal Aerospace Parts India.',
        operations: 'Operating from a 15,000 sq ft facility in Dombivli, Maharashtra, equipped with 14 CNC turning centers, 6 vertical machining centers (VMC), and a dedicated metrology lab for quality assurance.'
      },
      promoters: {
        promoters_list: 'Aarav Mehta (Managing Director, 18 years experience in tool manufacturing) and Rohan Mehta (Director of Operations, 15 years experience in precision machining).',
        directors: 'Aarav Mehta, Rohan Mehta, and Mrs. Sunita Mehta (Non-Executive Director).'
      },
      objects: {
        amount_to_raise: '50000000',
        purpose: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.',
        timeline: ''
      },
      capital_structure: {
        total_shares: '1000000',
        promoter_holding_pct: '65',
        shareholders: 'Aarav Mehta: 650,000 shares (65%), Rohan Mehta: 350,000 shares (35%).'
      },
      rpt: {
        has_rpt: 'yes',
        rpt_details: "The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm's length basis verified by local valuer report."
      },
      financials: {
        revenue_fy25: '125000000',
        revenue_fy24: '95000000',
        revenue_fy23: '72000000',
        profit_fy25: '11000000',
        profit_fy24: '7500000',
        profit_fy23: '4200000',
        total_debt: '25000000'
      },
      litigation: {
        has_litigation: 'yes',
        litigation_details: 'An income tax appeal is pending before the Commissioner of Income Tax (Appeals), Mumbai, regarding disallowance of depreciation on tools for FY22, involving a tax demand of 1,200,000 INR. The company has deposited 20% of the demand as per standard stay conditions.'
      }
    }
  },
  documents: [
    {
      id: 'doc-incorporation',
      companyId: 'aarav-precision',
      name: 'Certificate_of_Incorporation_2015.pdf',
      doc_type: 'incorporation_certificate',
      status: 'confirmed',
      uploaded_at: '2026-07-06T10:00:00Z',
      extracted_values: {
        cin: 'U29220MH2015PTC263456',
        legal_name: 'Aarav Precision Engineering Private Limited',
        incorporation_date: '2015-04-12'
      }
    },
    {
      id: 'doc-financials',
      companyId: 'aarav-precision',
      name: 'Audited_Financials_FY25.pdf',
      doc_type: 'audited_financials',
      status: 'uploaded',
      uploaded_at: '2026-07-06T10:05:00Z',
      extracted_values: {
        revenue_fy25: '118000000',
        revenue_fy24: '95000000',
        revenue_fy23: '72000000',
        profit_fy25: '11000000',
        net_worth: '45000000'
      }
    },
    {
      id: 'doc-captable',
      companyId: 'aarav-precision',
      name: 'Certified_Cap_Table_March_2026.pdf',
      doc_type: 'cap_table',
      status: 'uploaded',
      uploaded_at: '2026-07-06T10:10:00Z',
      extracted_values: {
        aarav_mehta_shares: '620000',
        rohan_mehta_shares: '350000',
        other_shares: '30000',
        total_shares: '1000000',
        promoter_holding_pct: '62'
      }
    },
    {
      id: 'doc-litigation',
      companyId: 'aarav-precision',
      name: 'CIT_Appeals_Notice_Tax_Dispute.pdf',
      doc_type: 'litigation_records',
      status: 'confirmed',
      uploaded_at: '2026-07-06T10:15:00Z',
      extracted_values: {
        case_reference: 'CIT(A)/MUM/IT-1124/2024-25',
        authority: 'Commissioner of Income Tax (Appeals), Mumbai',
        disputed_amount: '1200000',
        assessment_year: '2022-23'
      }
    }
  ],
  drafts: {
    'aarav-precision': {
      business_overview: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'bo-1',
            text: 'Aarav Precision Engineering Pvt Ltd (the "Company") is a prominent player in the Precision Engineering & Manufacturing industry. The Company is primarily engaged in the manufacturing of High-precision CNC machined components, brass fittings, specialized fasteners, and custom assemblies.',
            confidence: 'high',
            citations: ['Intake: Company Details: legal_name', 'Intake: Business Overview: products']
          },
          {
            id: 'bo-2',
            text: 'The Company operates from its primary manufacturing and registered facility located at W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204, spanning approximately 15,000 sq ft.',
            confidence: 'high',
            citations: ['Intake: Company Details: registered_office', 'Intake: Business Overview: operations']
          },
          {
            id: 'bo-3',
            text: 'Key clientele of the Company includes reputable Tier-1 automotive and industrial pumps manufacturers, namely Bharat Hydraulic Systems, Sterling Auto Components, and Royal Aerospace Parts India.',
            confidence: 'high',
            citations: ['Intake: Business Overview: customers']
          }
        ]
      },
      risk_factors: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'rf-1',
            text: 'Our operations are heavily dependent on our manufacturing facility at Dombivli, Thane. Any disruption, power outage, machinery breakdown, or labor strike at this facility could materially and adversely affect our business, financial condition, and results of operations.',
            confidence: 'medium',
            citations: ['Intake: Business Overview: operations']
          },
          {
            id: 'rf-2',
            text: 'The Company has a pending income tax litigation matter before the Commissioner of Income Tax (Appeals), Mumbai, concerning disallowance of tool depreciation for Assessment Year 2022-23. The total amount under dispute is INR 1,200,000.',
            confidence: 'high',
            citations: ['Intake: Litigation: litigation_details', 'Document: CIT_Appeals_Notice_Tax_Dispute.pdf']
          }
        ]
      },
      objects: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'obj-1',
            text: 'The Company proposes to raise gross proceeds of INR 50,000,000 through the Public Issue of Equity Shares. The objects of the Issue are to fund capital expenditure for the acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meet long-term working capital requirements, and cover general corporate expenses.',
            confidence: 'high',
            citations: ['Intake: Objects: amount_to_raise', 'Intake: Objects: purpose']
          },
          {
            id: 'obj-2',
            text: 'CRITICAL DISCLOSURE MISSING: The estimated schedule of implementation and deployment of funds has not been provided by the Issuer. SEBI ICDR regulations require a year-wise breakdown of fund utilization.',
            confidence: 'low',
            citations: ['Intake: Objects: timeline']
          }
        ]
      },
      capital_structure: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'cap-1',
            text: 'The authorized share capital of the Company is INR 20,000,000 divided into 2,000,000 Equity Shares of Face Value Rs. 10 each. The issued, subscribed, and paid-up share capital prior to the Issue is INR 10,000,000 divided into 1,000,000 Equity Shares of Face Value Rs. 10 each.',
            confidence: 'high',
            citations: ['Document: Certificate_of_Incorporation_2015.pdf']
          },
          {
            id: 'cap-2',
            text: 'WARNING: Inconsistent shareholding disclosures detected. The Promoter states a promoter shareholding percentage of 65.00% in the intake form. However, the certified Cap Table document indicates that Aarav Mehta holds 62.00% (620,000 shares) individually, rather than the stated 65.00%.',
            confidence: 'low',
            citations: ['Intake: Capital Structure: promoter_holding_pct', 'Document: Certified_Cap_Table_March_2026.pdf']
          }
        ]
      },
      related_party: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'rp-1',
            text: "The Company leases its primary factory premises from Aarav Precision Tooling Ltd (a related party under Indian Accounting Standard 24, where our promoter Aarav Mehta is a director). The lease carries a monthly rent of INR 15,000. Management confirms that this lease is executed on an arm's length basis.",
            confidence: 'high',
            citations: ['Intake: Related Party Transactions: rpt_details']
          }
        ]
      },
      litigation: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'lit-1',
            text: 'Except as disclosed below, there are no outstanding litigations, tax disputes, civil suits, or criminal proceedings involving the Company, promoters, or directors that have a material financial impact.',
            confidence: 'high',
            citations: ['Intake: Litigation: has_litigation']
          },
          {
            id: 'lit-2',
            text: 'Income Tax Dispute: The Company has preferred an appeal before the CIT(A), Mumbai, (Ref: CIT(A)/MUM/IT-1124/2024-25) contesting a depreciation disallowance on machinery tools for FY22. The aggregate tax liability under dispute is INR 1,200,000.',
            confidence: 'high',
            citations: ['Document: CIT_Appeals_Notice_Tax_Dispute.pdf', 'Intake: Litigation: litigation_details']
          }
        ]
      },
      promoter_details: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'prom-1',
            text: 'The promoters of the Company are Aarav Mehta and Rohan Mehta. Aarav Mehta serves as the Managing Director, possessing over 18 years of experience in the tool design and precision component manufacturing industry.',
            confidence: 'high',
            citations: ['Intake: Promoters: promoters_list']
          },
          {
            id: 'prom-2',
            text: 'The Board of Directors comprises three members: Aarav Mehta (Managing Director), Rohan Mehta (Executive Director), and Mrs. Sunita Mehta (Non-Executive Director).',
            confidence: 'high',
            citations: ['Intake: Promoters: directors']
          }
        ]
      }
    }
  },
  comments: [
    {
      id: 'comm-1',
      section_id: 'capital_structure',
      block_id: 'cap-2',
      author: 'Priya Sharma',
      role: 'reviewer',
      content: 'Aarav, please verify the promoter shareholding percentage. The cap table shows 62%, but your intake states 65%. Please update the intake form or supply an amended cap table.',
      type: 'clarification_requested',
      status: 'active',
      created_at: '2026-07-06T11:00:00Z'
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      recipient_role: 'issuer',
      recipient_email: 'aarav@example.com',
      message: 'Priya Sharma requested clarification on Capital Structure section.',
      related_section: 'capital_structure',
      is_read: false,
      type: 'comment',
      created_at: '2026-07-06T11:00:00Z'
    },
    {
      id: 'notif-2',
      recipient_role: 'reviewer',
      recipient_email: 'priya@example.com',
      message: 'Aarav Mehta updated the Objects of the Issue intake section.',
      related_section: 'objects',
      is_read: true,
      type: 'intake_update',
      created_at: '2026-07-06T10:20:00Z'
    }
  ],
  sebi_notices: [
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
    }
  ],
  sebi_notices_meta: {
    last_fetched: '2026-07-01T00:00:00.000Z',
    source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0&pageno=1',
    fetch_count: 5
  },
  audit_logs: [
    {
      id: 'audit-seed-1',
      actor_email: 'aarav@example.com',
      actor_name: 'Aarav Mehta',
      actor_role: 'issuer',
      action: 'LOGIN',
      entity_type: 'session',
      entity_id: 'aarav-precision',
      description: 'User logged in successfully.',
      metadata: {},
      ip: '127.0.0.1',
      created_at: '2026-07-06T09:55:00Z'
    },
    {
      id: 'audit-seed-2',
      actor_email: 'priya@example.com',
      actor_name: 'Priya Sharma',
      actor_role: 'reviewer',
      action: 'COMMENT_ADDED',
      entity_type: 'draft_section',
      entity_id: 'capital_structure',
      description: 'Reviewer added clarification request on Capital Structure.',
      metadata: { comment: 'Please verify promoter shareholding percentage.' },
      ip: '127.0.0.1',
      created_at: '2026-07-06T11:00:00Z'
    }
  ],
  ipo_readiness: {},
  merchant_bankers: [
    { id: 'mb-001', name: 'Axis Capital Limited', registration_no: 'INM000012029', status: 'Registered', category: 'I', address: 'Axis House, C-2, Wadia International Centre, Pandurang Budhkar Marg, Worli, Mumbai - 400025', sebi_source: 'https://www.sebi.gov.in', registered_since: '2003-01-01' },
    { id: 'mb-002', name: 'IIFL Securities Ltd', registration_no: 'INM000010940', status: 'Registered', category: 'I', address: 'IIFL House, Sun Infotech Park, Road No. 16V, Wagle Industrial Estate, Thane - 400604', sebi_source: 'https://www.sebi.gov.in', registered_since: '2002-01-01' },
    { id: 'mb-003', name: 'Emkay Global Financial Services Ltd', registration_no: 'INM000011229', status: 'Registered', category: 'I', address: '7th Floor, The Ruby, Senapati Bapat Marg, Dadar West, Mumbai - 400028', sebi_source: 'https://www.sebi.gov.in', registered_since: '2005-01-01' },
    { id: 'mb-004', name: 'Hem Securities Limited', registration_no: 'INM000010981', status: 'Registered', category: 'I', address: 'Ground Floor, 1 Bhagwat House, 2 Roop Nagar, Delhi - 110007', sebi_source: 'https://www.sebi.gov.in', registered_since: '2004-01-01' },
    { id: 'mb-005', name: 'Beeline Capital Advisors Pvt Ltd', registration_no: 'INM000012871', status: 'Registered', category: 'II', address: '401, Harlim Chambers, 1st Road, Khar (W), Mumbai - 400052', sebi_source: 'https://www.sebi.gov.in', registered_since: '2010-01-01' },
    { id: 'mb-006', name: 'Expert Global Consultants Pvt Ltd', registration_no: 'INM000012289', status: 'Registered', category: 'II', address: 'Goregaon East, Mumbai - 400063', sebi_source: 'https://www.sebi.gov.in', registered_since: '2008-01-01' },
    { id: 'mb-007', name: 'GYR Capital Advisors Pvt Ltd', registration_no: 'INM000014149', status: 'Registered', category: 'II', address: 'Lower Parel, Mumbai - 400013', sebi_source: 'https://www.sebi.gov.in', registered_since: '2016-01-01' },
    { id: 'mb-008', name: 'Indorient Financial Services Ltd', registration_no: 'INM000011120', status: 'Registered', category: 'I', address: '101, Indira Chambers, M.G. Road, Indore - 452001', sebi_source: 'https://www.sebi.gov.in', registered_since: '2004-01-01' },
    { id: 'mb-009', name: 'Pantomath Capital Advisors Pvt Ltd', registration_no: 'INM000012110', status: 'Registered', category: 'I', address: 'Unit No.908, 9th Floor, Hallmark Business Plaza, Sant Dnyaneshwar Marg, Bandra (E), Mumbai - 400051', sebi_source: 'https://www.sebi.gov.in', registered_since: '2007-01-01' },
    { id: 'mb-010', name: 'Saffron Capital Advisors Pvt Ltd', registration_no: 'INM000012708', status: 'Registered', category: 'II', address: 'Nariman Point, Mumbai - 400021', sebi_source: 'https://www.sebi.gov.in', registered_since: '2009-01-01' }
  ],
  invitations: []
};

export function getDb() {
  // When DynamoDB is active, serve from the in-memory copy loaded at boot.
  if (dynamoEnabled && isReady()) {
    return readStore();
  }

  // Read-only deployment: never try to materialise db.json. Reaching here means
  // DynamoDB is unavailable, so return the seed in memory rather than throwing an
  // EROFS that would hide the real storage error.
  if (process.env.VERCEL) {
    console.warn('[db] DynamoDB unavailable under serverless — serving in-memory seed (changes will not persist)');
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // Schema migration: ensure new collections exist
    let migrated = false;
    const defaults = {
      audit_logs: INITIAL_SEED.audit_logs,
      notifications: INITIAL_SEED.notifications,
      sebi_notices: [],
      sebi_notices_meta: INITIAL_SEED.sebi_notices_meta,
      ipo_readiness: {},
      merchant_bankers: INITIAL_SEED.merchant_bankers,
      invitations: []
    };
    Object.keys(defaults).forEach(key => {
      if (!(key in parsed)) {
        parsed[key] = defaults[key];
        migrated = true;
      }
    });
    if (migrated) fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (err) {
    console.error('Error reading db file, restoring seed:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
}

export function saveDb(data) {
  if (dynamoEnabled && isReady()) {
    writeStore(data);
    return;
  }
  if (process.env.VERCEL) {
    // Nothing durable to write to. Log loudly rather than crashing the request:
    // a silent no-op here would look like a successful save.
    console.error('[db] save dropped — DynamoDB not ready and filesystem is read-only');
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/** Called once at server boot to hydrate the DynamoDB-backed store. */
export async function initDb() {
  if (!dynamoEnabled) {
    console.log('[db] DynamoDB disabled — using local db.json');
    return false;
  }
  await initStore(INITIAL_SEED);
  return true;
}

/**
 * Awaits any pending DynamoDB writes. On a long-lived server writes are coalesced
 * and this is only needed for tests/shutdown, but under serverless the request
 * must await it before responding or a frozen container drops the write.
 */
export async function flushDb() {
  if (!dynamoEnabled || !isReady()) return;
  await flushDynamoStore();
}

export const db = {
  getUsers: () => getDb().users,
  findUser: (email) => getDb().users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase()),
  addUser: (user) => {
    const data = getDb();
    data.users.push(user);
    saveDb(data);
    return user;
  },
  getCompanies: () => getDb().companies,
  getCompany: (id) => getDb().companies.find(c => c.id === id),
  addCompany: (company) => {
    const data = getDb();
    // Ensure a unique id even if the slug collides with an existing company.
    let id = company.id || slugify(company.name);
    let candidate = id;
    let n = 1;
    while (data.companies.some(c => c.id === candidate)) {
      candidate = `${id}-${n++}`;
    }
    const record = { ...company, id: candidate };
    data.companies.push(record);
    if (!data.intake[candidate]) data.intake[candidate] = {};
    if (!data.drafts[candidate]) data.drafts[candidate] = {};
    saveDb(data);
    return record;
  },

  getIntake: (companyId) => getDb().intake[companyId] || {},
  saveIntakeStep: (companyId, stepKey, stepData) => {
    const data = getDb();
    if (!data.intake[companyId]) data.intake[companyId] = {};
    data.intake[companyId][stepKey] = stepData;
    saveDb(data);
    return data.intake[companyId][stepKey];
  },

  getDocuments: (companyId) => companyId ? (getDb().documents || []).filter(d => d.companyId === companyId) : (getDb().documents || []),
  addDocument: (doc) => {
    const data = getDb();
    data.documents.push(doc);
    saveDb(data);
    return doc;
  },
  confirmDocument: (docId, extractedValues) => {
    const data = getDb();
    const doc = data.documents.find(d => d.id === docId);
    if (doc) {
      doc.status = 'confirmed';
      if (extractedValues) doc.extracted_values = { ...doc.extracted_values, ...extractedValues };
      saveDb(data);
    }
    return doc;
  },
  deleteDocument: (docId) => {
    const data = getDb();
    const index = data.documents.findIndex(d => d.id === docId);
    if (index !== -1) {
      data.documents.splice(index, 1);
      saveDb(data);
      return true;
    }
    return false;
  },

  getDrafts: (companyId) => getDb().drafts[companyId] || {},
  updateSectionStatus: (companyId, sectionKey, status, role) => {
    const data = getDb();
    if (data.drafts[companyId] && data.drafts[companyId][sectionKey]) {
      if (status === 'certified' && role !== 'reviewer') {
        throw new Error('Only a registered Reviewer can certify draft chapters.');
      }
      data.drafts[companyId][sectionKey].status = status;
      data.drafts[companyId][sectionKey].last_updated = new Date().toISOString();
      saveDb(data);
    }
    return data.drafts[companyId] ? data.drafts[companyId][sectionKey] : null;
  },
  saveDrafts: (companyId, drafts) => {
    const data = getDb();
    data.drafts[companyId] = drafts;
    saveDb(data);
  },

  getComments: (sectionId) => getDb().comments.filter(c => c.section_id === sectionId),
  addComment: (sectionId, content, type, author, role, blockId = null, parentId = null) => {
    const data = getDb();
    const newComment = {
      id: 'comm-' + Date.now(),
      section_id: sectionId,
      block_id: blockId,
      parent_id: parentId,
      author,
      role,
      content,
      type,
      status: 'active',
      created_at: new Date().toISOString()
    };
    data.comments.push(newComment);
    saveDb(data);
    return newComment;
  },
  resolveComment: (commentId) => {
    const data = getDb();
    const comment = data.comments.find(c => c.id === commentId);
    if (comment) {
      comment.status = 'resolved';
      saveDb(data);
    }
    return comment;
  },
  editComment: (commentId, newContent) => {
    const data = getDb();
    const comment = data.comments.find(c => c.id === commentId);
    if (comment) {
      comment.content = newContent;
      comment.updated_at = new Date().toISOString();
      saveDb(data);
    }
    return comment;
  },
  deleteComment: (commentId) => {
    const data = getDb();
    const idx = data.comments.findIndex(c => c.id === commentId);
    if (idx !== -1) {
      data.comments.splice(idx, 1);
      // Optional: Delete child replies too, but let's keep it simple or do it if needed.
      saveDb(data);
      return true;
    }
    return false;
  },

  // Notifications
  getNotifications: (recipientEmail, recipientRole) => {
    const data = getDb();
    const notifs = (data.notifications || []).filter(
      n => n.recipient_email === recipientEmail || (recipientRole && n.recipient_role === recipientRole) || n.recipient_email === 'all'
    );
    return notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addNotification: (notif) => {
    const data = getDb();
    if (!data.notifications) data.notifications = [];

    // Deduplication check: prevent identical notification message to same recipient within 5 seconds
    const recentDup = data.notifications.find(n => 
      (n.recipient_email === notif.recipient_email || n.recipient_role === notif.recipient_role) &&
      n.message === notif.message &&
      (Date.now() - new Date(n.created_at).getTime()) < 5000
    );
    if (recentDup) return recentDup;

    const newNotif = { id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), ...notif, is_read: false, created_at: new Date().toISOString() };
    data.notifications.push(newNotif);
    saveDb(data);
    return newNotif;
  },
  markNotificationRead: (notifId) => {
    const data = getDb();
    const notif = (data.notifications || []).find(n => n.id === notifId);
    if (notif) { notif.is_read = true; saveDb(data); }
    return notif;
  },
  markAllNotificationsRead: (recipientEmail, recipientRole) => {
    const data = getDb();
    (data.notifications || []).forEach(n => {
      if (n.recipient_email === recipientEmail || (recipientRole && n.recipient_role === recipientRole) || n.recipient_email === 'all') {
        n.is_read = true;
      }
    });
    saveDb(data);
  },

  // Audit Logs
  getAuditLogs: (filters = {}) => {
    const data = getDb();
    let logs = data.audit_logs || [];
    if (filters.companyId) logs = logs.filter(l => l.entity_id === filters.companyId || l.metadata?.companyId === filters.companyId);
    if (filters.action) logs = logs.filter(l => l.action === filters.action);
    if (filters.actor_email) logs = logs.filter(l => l.actor_email === filters.actor_email);
    return logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addAuditLog: (entry) => {
    const data = getDb();
    if (!data.audit_logs) data.audit_logs = [];
    const log = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      ...entry,
      created_at: new Date().toISOString()
    };
    data.audit_logs.push(log);
    saveDb(data);
    return log;
  },

  // SEBI Notices (Strictly IPO / ICDR / SME related content)
  getSebiNotices: () => {
    const raw = getDb().sebi_notices || [];
    const isIpoNotice = (n) => {
      const title = (n.title || '').toLowerCase();
      const cat = (n.category || '').toLowerCase();
      if (cat.includes('icdr') || cat.includes('sme') || cat.includes('merchant')) return true;
      if (title.includes('ipo') || title.includes('sme') || title.includes('icdr') || title.includes('issue of capital') || title.includes('merchant banker') || title.includes('drhp') || title.includes('prospectus')) return true;
      return false;
    };
    const ipoOnly = raw.filter(isIpoNotice);
    return ipoOnly.length > 0 ? ipoOnly : INITIAL_SEED.sebi_notices;
  },
  saveSebiNotices: (notices, meta) => {
    const isIpoNotice = (n) => {
      const title = (n.title || '').toLowerCase();
      const cat = (n.category || '').toLowerCase();
      if (cat.includes('icdr') || cat.includes('sme') || cat.includes('merchant')) return true;
      if (title.includes('ipo') || title.includes('sme') || title.includes('icdr') || title.includes('issue of capital') || title.includes('merchant banker') || title.includes('drhp') || title.includes('prospectus')) return true;
      return false;
    };
    const filtered = (notices || []).filter(isIpoNotice);
    const data = getDb();
    data.sebi_notices = filtered.length > 0 ? filtered : INITIAL_SEED.sebi_notices;
    data.sebi_notices_meta = { ...data.sebi_notices_meta, ...meta, last_fetched: new Date().toISOString() };
    saveDb(data);
  },
  getSebiNoticesMeta: () => getDb().sebi_notices_meta || {},

  // IPO Readiness
  getIpoReadiness: (companyId) => (getDb().ipo_readiness || {})[companyId] || null,
  saveIpoReadiness: (companyId, readiness) => {
    const data = getDb();
    if (!data.ipo_readiness) data.ipo_readiness = {};
    // Preserve `items` unless the caller explicitly supplies it. The readiness
    // GET handler recomputes and saves the whole payload, which carries no
    // `items` key — a naive spread therefore deleted every reviewer sign-off on
    // each page load, so verifications silently vanished the moment the issuer
    // refreshed the dashboard.
    const existing = data.ipo_readiness[companyId] || {};
    data.ipo_readiness[companyId] = {
      ...existing,
      ...readiness,
      items: readiness.items ?? existing.items ?? {},
      computed_at: new Date().toISOString()
    };
    saveDb(data);
  },

  // Merchant Bankers
  getMerchantBankers: (query = '') => {
    const data = getDb();
    const bankers = data.merchant_bankers || [];
    if (!query) return bankers;
    const q = query.toLowerCase();
    return bankers.filter(mb =>
      mb.name.toLowerCase().includes(q) ||
      mb.registration_no.toLowerCase().includes(q) ||
      mb.address.toLowerCase().includes(q)
    );
  },

  // Invitations
  getInvitations: (filter = {}) => {
    const data = getDb();
    let invs = data.invitations || [];
    if (typeof filter === 'string') invs = invs.filter(inv => inv.company_id === filter);
    else if (filter.company_id) invs = invs.filter(inv => inv.company_id === filter.company_id);
    else if (filter.merchant_banker_id) invs = invs.filter(inv => inv.merchant_banker_id === filter.merchant_banker_id);
    return invs.sort((a, b) => new Date(b.created_at || b.invited_at || 0) - new Date(a.created_at || a.invited_at || 0));
  },
  getInvitationByIdOrToken: (idOrToken) => {
    const data = getDb();
    return (data.invitations || []).find(i => i.id === idOrToken || i.token === idOrToken);
  },
  addInvitation: (inv) => {
    const data = getDb();
    if (!data.invitations) data.invitations = [];
    const newInv = {
      id: 'inv-' + Date.now(),
      token: 'inv_token_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      status: 'pending',
      created_at: new Date().toISOString(),
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...inv
    };
    data.invitations.push(newInv);
    saveDb(data);
    return newInv;
  },
  updateInvitation: (invId, updates) => {
    const data = getDb();
    const inv = (data.invitations || []).find(i => i.id === invId || i.token === invId);
    if (inv) {
      Object.assign(inv, updates, { updated_at: new Date().toISOString() });
      saveDb(data);
    }
    return inv;
  },

  // Document Verifications
  verifyDocument: (docId, verifierEmail, verifierName, status, remarks = '') => {
    const data = getDb();
    const doc = (data.documents || []).find(d => d.id === docId);
    if (doc) {
      doc.verification_status = status; // 'under_review' | 'verified' | 'changes_requested'
      doc.verified_by_email = verifierEmail;
      doc.verified_by_name = verifierName;
      doc.verified_at = new Date().toISOString();
      doc.verification_remarks = remarks;
      saveDb(data);
    }
    return doc;
  },

  // IPO Readiness Item Status Updates
  updateIpoReadinessItemStatus: (companyId, itemKey, status, verifierEmail, verifierName, remarks = '') => {
    const data = getDb();
    if (!data.ipo_readiness) data.ipo_readiness = {};
    if (!data.ipo_readiness[companyId]) data.ipo_readiness[companyId] = { items: {} };
    if (!data.ipo_readiness[companyId].items) data.ipo_readiness[companyId].items = {};
    
    data.ipo_readiness[companyId].items[itemKey] = {
      status, // 'not_started' | 'in_progress' | 'submitted_for_review' | 'verified' | 'needs_changes' | 'completed'
      updated_by_email: verifierEmail,
      updated_by_name: verifierName,
      updated_at: new Date().toISOString(),
      remarks
    };
    saveDb(data);
    return data.ipo_readiness[companyId];
  }
};

export default db;
