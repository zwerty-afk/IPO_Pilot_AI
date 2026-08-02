import axios from 'axios';

// In dev, talk to the local Express server directly. In a deployed build the API
// is served from the same origin (Vercel rewrites /api/* to the function), so a
// relative base keeps the app working on any domain without a rebuild.
// VITE_API_BASE_URL overrides both, for a separately hosted backend.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ipo_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('ipo_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ----------------------------------------------------
// CLIENT-SIDE MOCK DATABASE (FALLBACK FOR DEMO PORTABILITY)
// ----------------------------------------------------
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
        timeline: '' // GAP: Timeline is empty to trigger a mandatory disclosure gap.
      },
      capital_structure: {
        total_shares: '1000000',
        promoter_holding_pct: '65', // INCONSISTENCY: Promoter states 65% in intake, but the Cap Table document shows 620,000 shares (62%).
        shareholders: 'Aarav Mehta: 650,000 shares (65%), Rohan Mehta: 350,000 shares (35%).'
      },
      rpt: {
        has_rpt: 'yes',
        rpt_details: 'The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm\'s length basis verified by local valuer report.'
      },
      financials: {
        revenue_fy25: '125000000', // INCONSISTENCY: Intake states 12.5 Cr (125,000,000), but Audited Financials shows 11.8 Cr (118,000,000).
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
      status: 'uploaded', // Promoter needs to review & confirm to show OCR review workflow.
      uploaded_at: '2026-07-06T10:05:00Z',
      extracted_values: {
        revenue_fy25: '118000000', // OCR reads 11.8 Cr
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
      status: 'uploaded', // Promoter needs to review & confirm.
      uploaded_at: '2026-07-06T10:10:00Z',
      extracted_values: {
        aarav_mehta_shares: '620,000', // Leads to 62% instead of 65%
        rohan_mehta_shares: '350,000',
        other_shares: '30,000',
        total_shares: '1,000,000',
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
        disputed_amount: '1,200,000',
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
            text: 'The Company operates from its primary manufacturing and registered facility located at W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204, spanning approximately 15,000 sq ft. The facility is equipped with 14 CNC turning centers, 6 vertical machining centers (VMC), and an advanced metrology lab for precision quality control and calibration.',
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
            text: 'The Company has a pending income tax litigation matter before the Commissioner of Income Tax (Appeals), Mumbai, concerning disallowance of tool depreciation for Assessment Year 2022-23. The total amount under dispute is INR 1,200,000, and the Company has deposited 20% (INR 240,000) under stay conditions. An adverse ruling in this matter could impact our cash flows and profits.',
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
            text: 'WARNING: Inconsistent shareholding disclosures detected. The Promoter states a promoter shareholding percentage of 65.00% in the intake form. However, the certified Cap Table document indicates that the promoters (Aarav Mehta & Rohan Mehta) hold a combined total of 970,000 shares out of 1,000,000, representing 97% of pre-IPO paid-up capital, with Aarav Mehta holding 62.00% (620,000 shares) individually, rather than the stated 65.00%.',
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
            text: 'The Company leases its primary factory premises from Aarav Precision Tooling Ltd (a related party under Indian Accounting Standard 24, where our promoter Aarav Mehta is a director). The lease carries a monthly rent of INR 15,000. Management confirms that this lease is executed on an arm\'s length basis and supported by an independent valuer’s rent valuation report.',
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
            text: 'Income Tax Dispute: The Company has preferred an appeal before the CIT(A), Mumbai, (Ref: CIT(A)/MUM/IT-1124/2024-25) contesting a depreciation disallowance on machinery tools for FY22. The aggregate tax liability under dispute is INR 1,200,000. The Company has obtained a partial stay after depositing 20% of the disputed demand.',
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
            text: 'The promoters of the Company are Aarav Mehta and Rohan Mehta. Aarav Mehta serves as the Managing Director, possessing over 18 years of experience in the tool design and precision component manufacturing industry. Rohan Mehta serves as the Executive Director (Operations), with over 15 years of industry experience managing shop-floor operations.',
            confidence: 'high',
            citations: ['Intake: Promoters: promoters_list']
          },
          {
            id: 'prom-2',
            text: 'The Board of Directors comprises three members: Aarav Mehta (Managing Director), Rohan Mehta (Executive Director), and Mrs. Sunita Mehta (Non-Executive Director). None of our directors are associated with any other public listed companies.',
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
    { id: 'notif-1', recipient_role: 'issuer', recipient_email: 'aarav@example.com', message: 'Priya Sharma requested clarification on Capital Structure section.', related_section: 'capital_structure', is_read: false, created_at: '2026-07-06T11:00:00Z' },
    { id: 'notif-2', recipient_role: 'issuer', recipient_email: 'aarav@example.com', message: 'Priya Sharma added a comment on Capital Structure: "Please verify promoter shareholding percentage."', related_section: 'capital_structure', is_read: false, created_at: '2026-07-06T11:01:00Z' },
    { id: 'notif-3', recipient_role: 'reviewer', recipient_email: 'priya@example.com', message: 'Aarav Mehta uploaded a new document: Audited_Financials_FY25.pdf', related_section: 'documents', is_read: true, created_at: '2026-07-06T10:05:00Z' },
    { id: 'notif-4', recipient_role: 'reviewer', recipient_email: 'priya@example.com', message: 'Aarav Mehta updated the Objects of the Issue intake section.', related_section: 'objects', is_read: true, created_at: '2026-07-06T10:20:00Z' }
  ],
  sebi_notices: [
    { id: 'sebi-1', title: 'Amendment to ICDR Regulations for SME IPOs', description: 'SEBI has notified amendments to the ICDR Regulations, 2018, relaxing the minimum application size for SME IPOs from Rs. 1,00,000 to Rs. 50,000, effective from Q3 FY26.', date: '2026-07-15', category: 'ICDR Amendment' },
    { id: 'sebi-2', title: 'Circular on Enhanced Disclosure Requirements', description: 'New circular mandates additional risk factor disclosures related to ESG compliance and climate risk for all IPO applicants listed on SME platforms.', date: '2026-07-10', category: 'Disclosure Framework' },
    { id: 'sebi-3', title: 'SME Framework Review Committee Report', description: 'SEBI publishes the final report of the SME Advisory Committee recommending streamlined listing timelines and reduced compliance burden for Emerge/SME boards.', date: '2026-06-28', category: 'SME Framework Circular' },
    { id: 'sebi-4', title: 'Guidelines on AI-Assisted Document Preparation', description: 'Draft guidelines issued for public consultation on the use of AI and automation tools in preparation of offer documents, emphasizing human accountability and audit trails.', date: '2026-06-15', category: 'Technology Guidelines' },
    { id: 'sebi-5', title: 'Revised Timeline for SME IPO Processing', description: 'SEBI reduces the mandatory observation period for SME Draft Red Herring Prospectus (DRHP) from 30 days to 21 days for companies with clean compliance records.', date: '2026-05-30', category: 'ICDR Amendment' }
  ],
  merchant_bankers: [
    { id: 'mb-001', name: 'Axis Capital Limited', registration_no: 'INM000012029', status: 'Registered', category: 'Category I', address: 'Axis House, C-2, Wadia International Centre, Pandurang Budhkar Marg, Worli, Mumbai - 400025', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2003-01-01' },
    { id: 'mb-002', name: 'IIFL Securities Ltd', registration_no: 'INM000010940', status: 'Registered', category: 'Category I', address: 'IIFL House, Sun Infotech Park, Road No. 16V, Wagle Industrial Estate, Thane - 400604', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2002-01-01' },
    { id: 'mb-003', name: 'Emkay Global Financial Services Ltd', registration_no: 'INM000011229', status: 'Registered', category: 'Category I', address: '7th Floor, The Ruby, Senapati Bapat Marg, Dadar West, Mumbai - 400028', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2005-01-01' },
    { id: 'mb-004', name: 'Hem Securities Limited', registration_no: 'INM000010981', status: 'Registered', category: 'Category I', address: 'Ground Floor, 1 Bhagwat House, 2 Roop Nagar, Delhi - 110007', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2004-01-01' },
    { id: 'mb-005', name: 'Beeline Capital Advisors Pvt Ltd', registration_no: 'INM000012871', status: 'Registered', category: 'Category II', address: '401, Harlim Chambers, 1st Road, Khar (W), Mumbai - 400052', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2010-01-01' },
    { id: 'mb-006', name: 'Expert Global Consultants Pvt Ltd', registration_no: 'INM000012289', status: 'Registered', category: 'Category II', address: 'Goregaon East, Mumbai - 400063', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2008-01-01' },
    { id: 'mb-007', name: 'GYR Capital Advisors Pvt Ltd', registration_no: 'INM000014149', status: 'Registered', category: 'Category II', address: 'Lower Parel, Mumbai - 400013', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2016-01-01' },
    { id: 'mb-008', name: 'Indorient Financial Services Ltd', registration_no: 'INM000011120', status: 'Registered', category: 'Category I', address: '101, Indira Chambers, M.G. Road, Indore - 452001', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2004-01-01' },
    { id: 'mb-009', name: 'Pantomath Capital Advisors Pvt Ltd', registration_no: 'INM000012110', status: 'Registered', category: 'Category I', address: 'Unit No.908, 9th Floor, Hallmark Business Plaza, Sant Dnyaneshwar Marg, Bandra (E), Mumbai - 400051', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2007-01-01' },
    { id: 'mb-010', name: 'Saffron Capital Advisors Pvt Ltd', registration_no: 'INM000012708', status: 'Registered', category: 'Category II', address: 'Nariman Point, Mumbai - 400021', sebi_source: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1', registered_since: '2009-01-01' }
  ],
  invitations: []
};

// Check if localStorage has database, if not initialize it
const DB_VERSION = 'v2.2'; // Increment this to force-reset stale invitation data
const getMockDb = () => {
  const dbStr = localStorage.getItem('ipo_local_db');
  if (!dbStr) {
    const fresh = { ...INITIAL_SEED, db_version: DB_VERSION };
    localStorage.setItem('ipo_local_db', JSON.stringify(fresh));
    return fresh;
  }
  const parsed = JSON.parse(dbStr);
  // Version-gated reset: if DB version changed, clear invitations to remove stale test data
  if (parsed.db_version !== DB_VERSION) {
    parsed.invitations = [];
    parsed.db_version = DB_VERSION;
    localStorage.setItem('ipo_local_db', JSON.stringify(parsed));
  }
  // Revoked invitations are terminal and carry no useful state — drop them so the
  // list starts clean instead of accumulating "REVOKED" rows.
  if (Array.isArray(parsed.invitations) && parsed.invitations.some(i => i.status === 'revoked')) {
    parsed.invitations = parsed.invitations.filter(i => i.status !== 'revoked');
    localStorage.setItem('ipo_local_db', JSON.stringify(parsed));
  }
  // Schema migration: merge any new top-level keys from INITIAL_SEED
  // This handles the case where users have old data lacking notifications/sebi_notices
  let migrated = false;
  Object.keys(INITIAL_SEED).forEach(key => {
    if (!(key in parsed)) {
      parsed[key] = INITIAL_SEED[key];
      migrated = true;
    }
  });
  if (migrated) localStorage.setItem('ipo_local_db', JSON.stringify(parsed));
  return parsed;
};

const saveMockDb = (data) => {
  localStorage.setItem('ipo_local_db', JSON.stringify(data));
};

// Computes gaps and inconsistencies
const mockComputeGapReport = (companyId, intake, docs) => {
  const gaps = [];

  const intakeRev = intake.financials?.revenue_fy25;
  const finDoc = docs.find(d => d.doc_type === 'audited_financials');
  
  if (intakeRev && finDoc && finDoc.status === 'confirmed') {
    const docRev = finDoc.extracted_values?.revenue_fy25;
    if (docRev && String(intakeRev) !== String(docRev)) {
      gaps.push({
        id: 'gap-rev-mismatch',
        severity: 'high',
        category: 'consistency',
        fieldName: 'financials.revenue_fy25',
        message: 'Revenue mismatch: Promoter intake states 12.5 Crores, but audited financials document records 11.8 Crores.',
        intakeValue: '125,000,000 INR (12.5 Cr)',
        docValue: '118,000,000 INR (11.8 Cr)',
        docName: finDoc.name
      });
    }
  }

  const intakeHolding = intake.capital_structure?.promoter_holding_pct;
  const capDoc = docs.find(d => d.doc_type === 'cap_table');
  if (intakeHolding && capDoc && capDoc.status === 'confirmed') {
    const docHolding = capDoc.extracted_values?.promoter_holding_pct;
    if (docHolding && String(intakeHolding) !== String(docHolding)) {
      gaps.push({
        id: 'gap-holding-mismatch',
        severity: 'high',
        category: 'consistency',
        fieldName: 'capital_structure.promoter_holding_pct',
        message: 'Promoter Shareholding discrepancy: Promoter intake claims 65.00% ownership, but the certified Cap Table document indicates 62.00%.',
        intakeValue: '65.00%',
        docValue: '62.00%',
        docName: capDoc.name
      });
    }
  }

  const objectsTimeline = intake.objects?.timeline;
  if (!objectsTimeline || objectsTimeline.trim() === '') {
    gaps.push({
      id: 'gap-missing-timeline',
      severity: 'medium',
      category: 'gap',
      fieldName: 'objects.timeline',
      message: 'Missing Required Disclosure: The estimated timeline and schedule of fund deployment has not been specified.',
      intakeValue: 'Not specified',
      docValue: 'N/A',
      docName: 'N/A'
    });
  }

  return gaps;
};

// Simulated AI generation on the client
const mockGenerateDraftData = (companyId, sectionKey = null) => {
  const currentDb = getMockDb();
  const intake = currentDb.intake[companyId] || {};
  const docs = currentDb.documents.filter(d => d.companyId === companyId);
  const gapReport = mockComputeGapReport(companyId, intake, docs);
  const currentDrafts = currentDb.drafts[companyId] || {};

  const generateBusinessOverview = () => {
    const name = intake.company_details?.legal_name || 'Aarav Precision Engineering Pvt Ltd';
    const industry = intake.company_details?.industry_type || 'Precision Engineering & Manufacturing';
    const products = intake.business_overview?.products || 'precision machinery components';
    const location = intake.company_details?.registered_office || 'Dombivli, Thane';
    const operations = intake.business_overview?.operations || '';
    const customers = intake.business_overview?.customers || '';

    return {
      status: currentDrafts.business_overview?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'bo-1',
          text: `${name} (the "Company") operates in the ${industry} industry. The Company is principally engaged in the production and supply of ${products}.`,
          confidence: 'high',
          citations: ['Intake: Company Details: legal_name', 'Intake: Business Overview: products']
        },
        {
          id: 'bo-2',
          text: `The registered office and primary tooling facility is established at ${location}. ${operations}`,
          confidence: 'high',
          citations: ['Intake: Company Details: registered_office', 'Intake: Business Overview: operations']
        },
        {
          id: 'bo-3',
          text: `Our client base includes critical aerospace, defense, and high-precision hydraulic manufacturers, key among which are ${customers}.`,
          confidence: 'high',
          citations: ['Intake: Business Overview: customers']
        }
      ]
    };
  };

  const generateRiskFactors = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');
    
    const blocks = [
      {
        id: 'rf-1',
        text: 'Our manufacturing operations are heavily concentrated at our single facility in Dombivli, Thane. Any physical shut-down, natural calamity, or utility failure could suspend manufacturing and hurt our operational yield.',
        confidence: 'medium',
        citations: ['Intake: Business Overview: operations']
      }
    ];

    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc && litDoc.status === 'confirmed') cite.push(`Document: ${litDoc.name}`);
      blocks.push({
        id: 'rf-2',
        text: `We are subject to ongoing tax litigation: ${details}. An adverse ruling in this tax appeal could lead to a liability of up to INR 1,200,000, impacting our overall profits.`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.risk_factors?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  const generateObjects = () => {
    const amount = intake.objects?.amount_to_raise || '50,000,000';
    const purpose = intake.objects?.purpose || '';
    const timeline = intake.objects?.timeline || '';

    const blocks = [
      {
        id: 'obj-1',
        text: `The Company proposes to raise capital amounting to INR ${Number(amount).toLocaleString('en-IN')} through the public issue. The primary objects of the issue are: ${purpose}.`,
        confidence: 'high',
        citations: ['Intake: Objects: amount_to_raise', 'Intake: Objects: purpose']
      }
    ];

    const hasTimelineGap = gapReport.some(g => g.fieldName === 'objects.timeline');
    if (hasTimelineGap) {
      blocks.push({
        id: 'obj-2',
        text: `CRITICAL GAP WARNING: The estimated timeline and schedule of funds deployment has not been specified by the Issuer. SEBI compliance requires a detailed year-by-year deployment timeline.`,
        confidence: 'low',
        citations: ['Intake: Objects: timeline']
      });
    } else {
      blocks.push({
        id: 'obj-2',
        text: `The funds raised through this Issue are proposed to be deployed as follows: ${timeline}.`,
        confidence: 'high',
        citations: ['Intake: Objects: timeline']
      });
    }

    return {
      status: currentDrafts.objects?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  const generateCapitalStructure = () => {
    const totalShares = intake.capital_structure?.total_shares || '1,000,000';
    const holdingPct = intake.capital_structure?.promoter_holding_pct || '65';
    
    const capDoc = docs.find(d => d.doc_type === 'cap_table');
    const isDocConfirmed = capDoc && capDoc.status === 'confirmed';

    const blocks = [
      {
        id: 'cap-1',
        text: `The pre-IPO paid up share capital of the company is comprised of ${Number(totalShares).toLocaleString('en-IN')} equity shares of face value Rs 10 each.`,
        confidence: 'high',
        citations: ['Intake: Capital Structure: total_shares']
      }
    ];

    const hasHoldingMismatch = gapReport.some(g => g.fieldName === 'capital_structure.promoter_holding_pct');
    
    if (hasHoldingMismatch) {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (capDoc) cite.push(`Document: ${capDoc.name}`);
      blocks.push({
        id: 'cap-2',
        text: `WARNING (Data Mismatch): A discrepancy has been detected in promoter shareholding disclosures. The intake form lists promoter holding as ${holdingPct}%, but the verified Cap Table document indicates promoter holding is actually ${capDoc.extracted_values?.promoter_holding_pct || '62'}% (comprising ${capDoc.extracted_values?.aarav_mehta_shares || '620,000'} shares held by Aarav Mehta).`,
        confidence: 'low',
        citations: cite
      });
    } else {
      const cite = ['Intake: Capital Structure: promoter_holding_pct'];
      if (isDocConfirmed) cite.push(`Document: ${capDoc.name}`);
      const actualPct = capDoc ? capDoc.extracted_values?.promoter_holding_pct : holdingPct;
      blocks.push({
        id: 'cap-2',
        text: `The Promoter holding post verification is certified at ${actualPct}% of pre-IPO paid up capital, representing Aarav Mehta holding 62% and Rohan Mehta holding 35% of the shares.`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.capital_structure?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  const generateRelatedParty = () => {
    const rptDetails = intake.rpt?.rpt_details || '';
    return {
      status: currentDrafts.related_party?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'rp-1',
          text: `The company has entered into transaction agreements with related parties, specifically: ${rptDetails}`,
          confidence: 'high',
          citations: ['Intake: Related Party Transactions: rpt_details']
        }
      ]
    };
  };

  const generateLitigation = () => {
    const details = intake.litigation?.litigation_details || '';
    const litDoc = docs.find(d => d.doc_type === 'litigation_records');

    const blocks = [
      {
        id: 'lit-1',
        text: 'Other than the proceeding detailed below, there are no material legal proceedings, criminal records, or tax litigation filed against the promoters, directors, or company.',
        confidence: 'high',
        citations: ['Intake: Litigation: has_litigation']
      }
    ];

    if (details) {
      const cite = ['Intake: Litigation: litigation_details'];
      if (litDoc && litDoc.status === 'confirmed') cite.push(`Document: ${litDoc.name}`);
      blocks.push({
        id: 'lit-2',
        text: `Income Tax Appeal: ${details}`,
        confidence: 'high',
        citations: cite
      });
    }

    return {
      status: currentDrafts.litigation?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks
    };
  };

  const generatePromoters = () => {
    const list = intake.promoters?.promoters_list || '';
    const board = intake.promoters?.directors || '';

    return {
      status: currentDrafts.promoter_details?.status || 'draft',
      last_updated: new Date().toISOString(),
      blocks: [
        {
          id: 'prom-1',
          text: `The profile and details of our promoters are as follows: ${list}`,
          confidence: 'high',
          citations: ['Intake: Promoters: promoters_list']
        },
        {
          id: 'prom-2',
          text: `The current Board of Directors is structured with the following directors: ${board}`,
          confidence: 'high',
          citations: ['Intake: Promoters: directors']
        }
      ]
    };
  };

  if (!sectionKey || sectionKey === 'business_overview') currentDrafts.business_overview = generateBusinessOverview();
  if (!sectionKey || sectionKey === 'risk_factors') currentDrafts.risk_factors = generateRiskFactors();
  if (!sectionKey || sectionKey === 'objects') currentDrafts.objects = generateObjects();
  if (!sectionKey || sectionKey === 'capital_structure') currentDrafts.capital_structure = generateCapitalStructure();
  if (!sectionKey || sectionKey === 'related_party') currentDrafts.related_party = generateRelatedParty();
  if (!sectionKey || sectionKey === 'litigation') currentDrafts.litigation = generateLitigation();
  if (!sectionKey || sectionKey === 'promoter_details') currentDrafts.promoter_details = generatePromoters();

  currentDb.drafts[companyId] = currentDrafts;
  saveMockDb(currentDb);
  return currentDrafts;
};

// Run Mock API Routing
const runMock = (method, url, data) => {
  const dbData = getMockDb();
  
  // POST /auth/login
  if (url === '/auth/login') {
    const { email, password } = data;
    const user = dbData.users.find(u => u.email.toLowerCase() === String(email || '').toLowerCase() && u.password === password);
    if (!user) return Promise.reject({ response: { status: 400, data: { message: 'Invalid email or password.' } } });

    // Simulate JWT token
    const token = `mock-token-for-${user.email}`;
    // Save to localStorage token
    return Promise.resolve({ data: { token, user: { email: user.email, role: user.role, name: user.name } } });
  }

  // POST /auth/register
  if (url === '/auth/register') {
    const { name, email, password, role, companyName } = data || {};
    if (!name || !email || !password) {
      return Promise.reject({ response: { status: 400, data: { message: 'Name, email, and password are required.' } } });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Promise.reject({ response: { status: 400, data: { message: 'Please enter a valid email address.' } } });
    }
    if (String(password).length < 6) {
      return Promise.reject({ response: { status: 400, data: { message: 'Password must be at least 6 characters.' } } });
    }
    const normalizedRole = role === 'reviewer' ? 'reviewer' : 'issuer';
    const exists = dbData.users.some(u => u.email.toLowerCase() === String(email).toLowerCase());
    if (exists) {
      return Promise.reject({ response: { status: 409, data: { message: 'An account with this email already exists. Please sign in.' } } });
    }
    if (normalizedRole === 'issuer' && !companyName) {
      return Promise.reject({ response: { status: 400, data: { message: 'Company name is required for issuer accounts.' } } });
    }

    let companyId = null;
    if (normalizedRole === 'issuer') {
      const slug = String(companyName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'company';
      companyId = slug;
      let n = 1;
      while (dbData.companies.some(c => c.id === companyId)) companyId = `${slug}-${n++}`;
      dbData.companies.push({ id: companyId, name: companyName, legal_name: companyName });
      if (!dbData.intake[companyId]) dbData.intake[companyId] = {};
      if (!dbData.drafts[companyId]) dbData.drafts[companyId] = {};
    }

    const newUser = { email: String(email).toLowerCase(), password, role: normalizedRole, name, companyId };
    dbData.users.push(newUser);
    saveMockDb(dbData);

    const token = `mock-token-for-${newUser.email}`;
    return Promise.resolve({ data: { token, user: { email: newUser.email, role: newUser.role, name: newUser.name } } });
  }

  // GET /auth/me
  if (url === '/auth/me') {
    const token = localStorage.getItem('ipo_token');
    if (!token) return Promise.reject({ response: { status: 401 } });
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) return Promise.reject({ response: { status: 401 } });
    // Never hand the password back to the client.
    const { password: _pw, ...safeUser } = user;
    return Promise.resolve({ data: { user: safeUser } });
  }

  // GET /companies
  if (url === '/companies') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    // Issuers only see their own company; reviewers see all companies.
    if (user && user.role === 'issuer' && user.companyId) {
      return Promise.resolve({ data: { companies: dbData.companies.filter(c => c.id === user.companyId) } });
    }
    return Promise.resolve({ data: { companies: dbData.companies } });
  }

  // GET /companies/:id
  if (url.startsWith('/companies/') && url.endsWith('/status')) {
    const parts = url.split('/');
    const companyId = parts[2];
    const company = dbData.companies.find(c => c.id === companyId);
    if (!company) return Promise.reject({ response: { status: 404 } });

    const intake = dbData.intake[companyId] || {};
    const docs = dbData.documents.filter(d => d.companyId === companyId);
    const drafts = dbData.drafts[companyId] || {};

    const gapReport = mockComputeGapReport(companyId, intake, docs);
    const sections = Object.keys(drafts);
    const certifiedCount = sections.reduce((acc, sec) => acc + (drafts[sec].status === 'certified' ? 1 : 0), 0);
    const openComments = dbData.comments.filter(c => c.status === 'active').length;

    const heatmap = {};
    sections.forEach(secKey => {
      const sec = drafts[secKey];
      if (sec.status === 'certified') {
        heatmap[secKey] = 'certified';
      } else {
        const hasLowBlock = sec.blocks.some(b => b.confidence === 'low');
        const hasGap = gapReport.some(g => {
          if (secKey === 'objects' && g.fieldName === 'objects.timeline') return true;
          if (secKey === 'capital_structure' && g.fieldName === 'capital_structure.promoter_holding_pct') return true;
          if (secKey === 'financials' && g.fieldName === 'financials.revenue_fy25') return true;
          return false;
        });
        const hasComment = dbData.comments.some(c => c.section_id === secKey && c.status === 'active');

        if (hasLowBlock || hasGap) {
          heatmap[secKey] = 'missing';
        } else if (hasComment || sec.status === 'clarification_requested' || sec.blocks.some(b => b.confidence === 'medium')) {
          heatmap[secKey] = 'partial';
        } else {
          heatmap[secKey] = 'complete';
        }
      }
    });

    return Promise.resolve({
      data: {
        companyName: company.name,
        completenessPercentage: Math.round((certifiedCount / sections.length) * 100),
        certifiedCount,
        totalSections: sections.length,
        openComments,
        inconsistenciesCount: gapReport.filter(g => g.category === 'consistency').length,
        gapsCount: gapReport.filter(g => g.category === 'gap').length,
        heatmap,
        gapReport
      }
    });
  }

  // GET /intake/:companyId
  if (url.startsWith('/intake/') && !url.includes('/', 9)) {
    const companyId = url.split('/')[2];
    return Promise.resolve({ data: dbData.intake[companyId] || {} });
  }

  // GET /intake/:companyId/:stepKey
  if (url.startsWith('/intake/') && url.split('/').length === 4) {
    const parts = url.split('/');
    const companyId = parts[2];
    const stepKey = parts[3];
    return Promise.resolve({ data: (dbData.intake[companyId] && dbData.intake[companyId][stepKey]) || {} });
  }

  // PUT /intake/:companyId/:stepKey
  if (method === 'put' && url.startsWith('/intake/') && url.split('/').length === 4) {
    const parts = url.split('/');
    const companyId = parts[2];
    const stepKey = parts[3];
    
    if (!dbData.intake[companyId]) dbData.intake[companyId] = {};
    dbData.intake[companyId][stepKey] = data;
    saveMockDb(dbData);
    
    // Regenerate drafts
    mockGenerateDraftData(companyId);
    return Promise.resolve({ data: { message: 'Saved successfully', data } });
  }

  // GET /documents/:companyId
  if (method === 'get' && url.startsWith('/documents/') && !url.includes('/upload') && !url.includes('/confirm') && !url.includes('/verify') && url.split('/').length === 3) {
    const companyId = url.split('/')[2];
    const companyDocs = dbData.documents.filter(d => d.companyId === companyId);
    return Promise.resolve({ data: companyDocs });
  }

  // POST /documents/:companyId/upload
  if (url.startsWith('/documents/') && url.includes('/upload')) {
    const companyId = url.split('/')[2];
    
    // In Axios FormData wrapper, files are mock handled
    const docType = data.get('doc_type');
    const file = data.get('file');
    
    let ext = {};
    if (docType === 'audited_financials') {
      ext = { revenue_fy25: '118000000', revenue_fy24: '95000000', revenue_fy23: '72000000', profit_fy25: '11000000', net_worth: '45000000' };
    } else if (docType === 'cap_table') {
      ext = { aarav_mehta_shares: '620,000', rohan_mehta_shares: '350,000', total_shares: '1,000,000', promoter_holding_pct: '62' };
    } else if (docType === 'litigation_records') {
      ext = { case_reference: 'CIT(A)/MUM/IT-1124/2024-25', authority: 'Commissioner of Income Tax (Appeals), Mumbai', disputed_amount: '1,200,000' };
    } else if (docType === 'incorporation_certificate') {
      ext = { cin: 'U29220MH2015PTC263456', legal_name: 'Aarav Precision Engineering Private Limited' };
    }

    const newDoc = {
      id: `doc-${Date.now()}`,
      companyId,
      name: file.name || 'document_upload.pdf',
      doc_type: docType,
      status: 'uploaded',
      uploaded_at: new Date().toISOString(),
      extracted_values: ext
    };

    dbData.documents.push(newDoc);
    saveMockDb(dbData);
    mockGenerateDraftData(companyId);
    return Promise.resolve({ data: newDoc });
  }

  // PUT /documents/:id/confirm
  if (method === 'put' && url.startsWith('/documents/') && url.endsWith('/confirm')) {
    const parts = url.split('/');
    const docId = parts[2];
    const doc = dbData.documents.find(d => d.id === docId);
    if (!doc) return Promise.reject({ response: { status: 404 } });
    
    doc.status = 'confirmed';
    if (data) doc.extracted_values = { ...doc.extracted_values, ...data };
    saveMockDb(dbData);
    mockGenerateDraftData(doc.companyId);
    return Promise.resolve({ data: { message: 'Confirmed', document: doc } });
  }

  // PUT /documents/:id/verify (reviewer only in real mode; works in mock for any role)
  if (method === 'put' && url.startsWith('/documents/') && url.endsWith('/verify')) {
    const parts = url.split('/');
    const docId = parts[2];
    const doc = dbData.documents.find(d => d.id === docId);
    if (!doc) return Promise.reject({ response: { status: 404, data: { message: 'Document not found' } } });
    const validStatuses = ['under_review', 'verified', 'changes_requested'];
    if (!data?.status || !validStatuses.includes(data.status)) {
      return Promise.reject({ response: { status: 400, data: { message: `Invalid status. Allowed: ${validStatuses.join(', ')}` } } });
    }
    doc.verification_status = data.status;
    doc.verification_remarks = data.remarks || '';
    if (data.status === 'verified') doc.status = 'confirmed';
    saveMockDb(dbData);
    return Promise.resolve({ data: { message: 'Document verification updated.', document: doc } });
  }

  // DELETE /documents/:id
  if (method === 'delete' && url.startsWith('/documents/')) {
    const docId = url.split('/')[2];
    const doc = dbData.documents.find(d => d.id === docId);
    if (!doc) return Promise.reject({ response: { status: 404 } });
    const companyId = doc.companyId;

    const index = dbData.documents.findIndex(d => d.id === docId);
    if (index !== -1) {
      dbData.documents.splice(index, 1);
      saveMockDb(dbData);
    }
    mockGenerateDraftData(companyId);
    return Promise.resolve({ data: { message: 'Deleted' } });
  }

  // GET /drafts/:companyId
  if (url.startsWith('/drafts/') && !url.includes('/generate') && !url.includes('/gap-report') && url.split('/').length === 3) {
    const companyId = url.split('/')[2];
    return Promise.resolve({ data: dbData.drafts[companyId] || {} });
  }

  // POST /drafts/:companyId/generate
  if (url.startsWith('/drafts/') && url.includes('/generate')) {
    const companyId = url.split('/')[2];
    // Find section query in URL if exists
    let section = null;
    if (url.includes('section=')) {
      section = url.split('section=')[1].split('&')[0];
    }
    const generated = mockGenerateDraftData(companyId, section);
    return Promise.resolve({ data: { message: 'Generated', drafts: generated } });
  }

  // PUT /drafts/:companyId/:sectionKey/status
  if (method === 'put' && url.startsWith('/drafts/') && url.includes('/status')) {
    const parts = url.split('/');
    const companyId = parts[2];
    const sectionKey = parts[3];
    const { status, role } = data;

    if (dbData.drafts[companyId] && dbData.drafts[companyId][sectionKey]) {
      if (status === 'certified' && role !== 'reviewer') {
        return Promise.reject({ response: { status: 403, data: { message: 'Only Reviewers can certify draft sections' } } });
      }
      dbData.drafts[companyId][sectionKey].status = status;
      dbData.drafts[companyId][sectionKey].last_updated = new Date().toISOString();
      saveMockDb(dbData);

      // Trigger notification on certification
      if (!dbData.notifications) dbData.notifications = [];
      const token2 = localStorage.getItem('ipo_token') || '';
      const email2 = token2.replace('mock-token-for-', '');
      const certUser = dbData.users.find(u => u.email === email2) || { name: 'Reviewer', role: 'reviewer' };
      const notifRecipientRole = certUser.role === 'reviewer' ? 'issuer' : 'reviewer';
      const notifRecipient = dbData.users.find(u => u.role === notifRecipientRole);
      if (notifRecipient && status === 'certified') {
        dbData.notifications.push({
          id: 'notif-' + Date.now(),
          recipient_role: notifRecipientRole,
          recipient_email: notifRecipient.email,
          message: `${certUser.name} certified the ${sectionKey.replace(/_/g, ' ')} section.`,
          related_section: sectionKey,
          is_read: false,
          created_at: new Date().toISOString()
        });
        saveMockDb(dbData);
      }
    }
    return Promise.resolve({ data: dbData.drafts[companyId][sectionKey] });
  }

  // GET /drafts/:companyId/gap-report
  if (url.startsWith('/drafts/') && url.includes('/gap-report')) {
    const companyId = url.split('/')[2];
    const intake = dbData.intake[companyId] || {};
    const docs = dbData.documents.filter(d => d.companyId === companyId);
    const gaps = mockComputeGapReport(companyId, intake, docs);
    return Promise.resolve({ data: gaps });
  }

  // GET /comments/:sectionId
  if (url.startsWith('/comments/')) {
    const sectionId = url.split('/')[2];
    const list = dbData.comments.filter(c => c.section_id === sectionId);
    return Promise.resolve({ data: list });
  }

  // POST /comments/:sectionId
  if (method === 'post' && url.startsWith('/comments/')) {
    const sectionId = url.split('/')[2];
    const token = localStorage.getItem('ipo_token') || 'mock-token-for-aarav@example.com';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email) || { name: 'Aarav Mehta', role: 'issuer' };

    const newComment = {
      id: 'comm-' + Date.now(),
      section_id: sectionId,
      block_id: data.block_id || null,
      author: user.name,
      role: user.role,
      content: data.content,
      type: data.type || 'note',
      status: 'active',
      created_at: new Date().toISOString()
    };

    dbData.comments.push(newComment);
    saveMockDb(dbData);

    // Trigger notification
    if (!dbData.notifications) dbData.notifications = [];
    const recipientRole = user.role === 'reviewer' ? 'issuer' : 'reviewer';
    const recipientUser = dbData.users.find(u => u.role === recipientRole);
    if (recipientUser) {
      dbData.notifications.push({
        id: 'notif-' + Date.now(),
        recipient_role: recipientRole,
        recipient_email: recipientUser.email,
        message: `${user.name} added a ${newComment.type === 'clarification_requested' ? 'clarification request' : 'comment'} on ${sectionId.replace(/_/g, ' ')}: "${data.content.substring(0, 80)}${data.content.length > 80 ? '...' : ''}"`,
        related_section: sectionId,
        is_read: false,
        created_at: new Date().toISOString()
      });
      saveMockDb(dbData);
    }

    return Promise.resolve({ data: newComment });
  }

  // PUT /comments/:commentId/resolve
  if (method === 'put' && url.startsWith('/comments/') && url.endsWith('/resolve')) {
    const commentId = url.split('/')[2];
    const comment = dbData.comments.find(c => c.id === commentId);
    if (!comment) return Promise.reject({ response: { status: 404 } });
    
    comment.status = 'resolved';
    saveMockDb(dbData);
    return Promise.resolve({ data: comment });
  }

  // GET /notifications
  if (url === '/notifications') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email);
    const role = user?.role || 'issuer';
    const userNotifs = (dbData.notifications || []).filter(
      n => n.recipient_email === email || (n.recipient_role && n.recipient_role === role) || n.recipient_email === 'all'
    );
    userNotifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ data: userNotifs });
  }

  // PUT /notifications/mark-all-read
  if (method === 'put' && url === '/notifications/mark-all-read') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email);
    const role = user?.role || 'issuer';
    (dbData.notifications || []).forEach(n => {
      if (n.recipient_email === email || (n.recipient_role && n.recipient_role === role) || n.recipient_email === 'all') {
        n.is_read = true;
      }
    });
    saveMockDb(dbData);
    return Promise.resolve({ data: { message: 'All marked read' } });
  }

  // PUT /notifications/:id/read
  if (method === 'put' && url.startsWith('/notifications/') && url.endsWith('/read')) {
    const notifId = url.split('/')[2];
    const notif = (dbData.notifications || []).find(n => n.id === notifId);
    if (notif) {
      notif.is_read = true;
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: notif || {} });
  }

  // POST /notifications (internal - for triggering notifications)
  if (method === 'post' && url === '/notifications') {
    if (!dbData.notifications) dbData.notifications = [];
    const newNotif = {
      id: 'notif-' + Date.now(),
      recipient_role: data.recipient_role,
      recipient_email: data.recipient_email,
      message: data.message,
      related_section: data.related_section || '',
      is_read: false,
      created_at: new Date().toISOString()
    };
    dbData.notifications.push(newNotif);
    saveMockDb(dbData);
    return Promise.resolve({ data: newNotif });
  }

  // GET /sebi-notices
  if (url === '/sebi-notices') {
    const notices = dbData.sebi_notices || [];
    const meta = {
      last_fetched: new Date().toISOString(),
      fetch_count: 1,
      source: 'curated',
      error: null
    };
    return Promise.resolve({ data: { notices, meta } });
  }

  // GET /merchant-bankers
  if (url.startsWith('/merchant-bankers')) {
    const search = url.includes('?q=') ? decodeURIComponent(url.split('?q=')[1] || '').toLowerCase() : '';
    const bankers = dbData.merchant_bankers || INITIAL_SEED.merchant_bankers;
    const filtered = search ? bankers.filter(b => b.name.toLowerCase().includes(search) || b.registration_no.toLowerCase().includes(search) || b.address.toLowerCase().includes(search)) : bankers;
    return Promise.resolve({
      data: {
        merchant_bankers: filtered,
        source: 'SEBI Registered Merchant Bankers Directory',
        source_url: 'https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&ssid=6&smid=0&pageno=1',
        attribution: 'Data sourced from SEBI official merchant banker registration records.'
      }
    });
  }

  // GET /invitations
  if (url === '/invitations') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email);
    const role = user?.role || 'issuer';
    const allInvs = dbData.invitations || [];
    
    if (role === 'reviewer') {
      // Reviewer only sees invitations sent to them
      const forReviewer = allInvs.filter(inv =>
        inv.merchant_banker_email === email ||
        inv.invited_to_email === email
      );
      // Fallback: show all non-revoked invitations if no email match (demo mode)
      return Promise.resolve({ data: forReviewer.length > 0 ? forReviewer : allInvs.filter(i => i.status !== 'revoked') });
    } else {
      // Issuer sees only their company's invitations
      const companyId = user?.companyId || 'aarav-precision';
      return Promise.resolve({ data: allInvs.filter(i => i.company_id === companyId) });
    }
  }

  // POST /invitations
  if (method === 'post' && url === '/invitations') {
    if (!dbData.invitations) dbData.invitations = [];
    const newInv = {
      id: 'inv-' + Date.now(),
      token: 'inv_token_' + Math.random().toString(36).substring(2) + Date.now(),
      company_id: data.company_id || (() => { const tok = localStorage.getItem('ipo_token') || ''; const u = dbData.users.find(u => u.email === tok.replace('mock-token-for-', '')); return u?.companyId || 'aarav-precision'; })(),
      company_name: data.company_name || 'Aarav Precision Engineering Pvt Ltd',
      merchant_banker_id: data.merchant_banker_id,
      merchant_banker_name: data.merchant_banker_name,
      // Map the invited merchant banker to the reviewer email for demo purposes
      merchant_banker_email: 'priya@example.com',
      invited_by_email: (() => { const tok = localStorage.getItem('ipo_token') || ''; return tok.replace('mock-token-for-', ''); })(),
      invited_by_name: (() => { const tok = localStorage.getItem('ipo_token') || ''; const u = dbData.users.find(u => u.email === tok.replace('mock-token-for-', '')); return u?.name || 'Issuer'; })(),
      message: data.message || 'Invitation to review IPO draft.',
      status: 'pending',
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    dbData.invitations.push(newInv);
    saveMockDb(dbData);
    return Promise.resolve({ data: newInv });
  }

  // PUT /invitations/:id/accept
  if (method === 'put' && url.includes('/invitations/') && url.endsWith('/accept')) {
    const invId = url.split('/')[2];
    const inv = (dbData.invitations || []).find(i => i.id === invId);
    if (inv) {
      inv.status = 'accepted';
      inv.responded_at = new Date().toISOString();
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: inv || {} });
  }

  // PUT /invitations/:id/decline
  if (method === 'put' && url.includes('/invitations/') && url.endsWith('/decline')) {
    const invId = url.split('/')[2];
    const inv = (dbData.invitations || []).find(i => i.id === invId);
    if (inv) {
      inv.status = 'declined';
      inv.responded_at = new Date().toISOString();
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: inv || {} });
  }

  // PUT /invitations/:id/revoke
  // Revoking removes the invitation outright — the banker reappears in the search
  // list as un-invited, instead of leaving a dead "REVOKED" row behind.
  if (method === 'put' && url.includes('/invitations/') && url.endsWith('/revoke')) {
    const invId = url.split('/')[2];
    const inv = (dbData.invitations || []).find(i => i.id === invId);
    dbData.invitations = (dbData.invitations || []).filter(i => i.id !== invId);
    saveMockDb(dbData);
    return Promise.resolve({ data: inv || {} });
  }

  // PUT /invitations/:id/status (generic status update)
  if (method === 'put' && url.includes('/invitations/') && url.endsWith('/status')) {
    const parts = url.split('/');
    const invId = parts[2];
    const inv = (dbData.invitations || []).find(i => i.id === invId);
    if (inv && data?.status) {
      inv.status = data.status;
      inv.responded_at = new Date().toISOString();
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: inv || {} });
  }

  // POST /invitations/:id/resend
  if (method === 'post' && url.includes('/invitations/') && url.endsWith('/resend')) {
    const invId = url.split('/')[2];
    const inv = (dbData.invitations || []).find(i => i.id === invId);
    if (inv) {
      inv.status = 'pending';
      inv.token = 'inv_token_' + Math.random().toString(36).substring(2) + Date.now();
      inv.expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      inv.invited_at = new Date().toISOString();
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: inv || {} });
  }

  // GET /notifications
  if (url === '/notifications') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email) || { email, role: 'issuer' };
    const notifs = (dbData.notifications || []).filter(
      n => n.recipient_email === email || (user.role && n.recipient_role === user.role) || n.recipient_email === 'all'
    ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ data: notifs });
  }

  // PUT /notifications/mark-all-read
  if (method === 'put' && url === '/notifications/mark-all-read') {
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email) || { email, role: 'issuer' };
    (dbData.notifications || []).forEach(n => {
      if (n.recipient_email === email || (user.role && n.recipient_role === user.role) || n.recipient_email === 'all') {
        n.is_read = true;
      }
    });
    saveMockDb(dbData);
    return Promise.resolve({ data: { message: 'All notifications marked as read' } });
  }

  // PUT /notifications/:id/read
  if (method === 'put' && url.includes('/notifications/') && url.endsWith('/read')) {
    const parts = url.split('/');
    const id = parts[2];
    const notif = (dbData.notifications || []).find(n => n.id === id);
    if (notif) {
      notif.is_read = true;
      saveMockDb(dbData);
    }
    return Promise.resolve({ data: notif || {} });
  }

  // POST /chatbot/query
  if (method === 'post' && url === '/chatbot/query') {
    const { question } = data;
    const token = localStorage.getItem('ipo_token') || '';
    const email = token.replace('mock-token-for-', '');
    const user = dbData.users.find(u => u.email === email) || { name: 'User', role: 'issuer' };
    const companyId = user.companyId || 'aarav-precision';
    
    // Gather context data
    const drafts = dbData.drafts[companyId] || {};
    const docs = dbData.documents.filter(d => d.companyId === companyId);
    const comments = dbData.comments || [];
    const notifications = (dbData.notifications || []).filter(n => n.recipient_email === email);
    const intake = dbData.intake[companyId] || {};
    
    const q = question.toLowerCase();
    let answer = '';
    
    if (q.includes('pending') && q.includes('certif')) {
      const pending = Object.entries(drafts).filter(([k, v]) => v.status !== 'certified').map(([k]) => k.replace(/_/g, ' '));
      answer = pending.length > 0 
        ? `There are ${pending.length} sections still pending certification: ${pending.join(', ')}. These need to be reviewed and certified by a registered merchant banker before export.`
        : 'All sections have been certified. The draft is ready for export.';
    } else if (q.includes('changed') || q.includes('recent') || q.includes('last')) {
      const recentDrafts = Object.entries(drafts)
        .map(([k, v]) => ({ section: k.replace(/_/g, ' '), date: v.last_updated, status: v.status }))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
      const recentDocs = docs.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at)).slice(0, 3);
      answer = `Here's what changed recently:\n\n**Draft updates:**\n${recentDrafts.map(d => `• ${d.section} — ${d.status} (updated ${new Date(d.date).toLocaleDateString()})`).join('\n')}\n\n**Recent documents:**\n${recentDocs.map(d => `• ${d.name} — ${d.status} (uploaded ${new Date(d.uploaded_at).toLocaleDateString()})`).join('\n')}`;
    } else if (q.includes('comment') || q.includes('feedback')) {
      const sectionMatch = Object.keys(drafts).find(k => q.includes(k.replace(/_/g, ' ')));
      const filtered = sectionMatch ? comments.filter(c => c.section_id === sectionMatch) : comments;
      if (filtered.length === 0) {
        answer = 'No comments found matching your query.';
      } else {
        answer = `Found ${filtered.length} comment(s):\n\n${filtered.map(c => `• **${c.author}** (${c.role}) on ${c.section_id.replace(/_/g, ' ')}: "${c.content}" — Status: ${c.status}`).join('\n')}`;
      }
    } else if (q.includes('document') || q.includes('upload')) {
      answer = `There are ${docs.length} documents on file:\n\n${docs.map(d => `• **${d.name}** — Status: ${d.status}, Type: ${d.doc_type.replace(/_/g, ' ')}, Uploaded: ${new Date(d.uploaded_at).toLocaleDateString()}`).join('\n')}`;
    } else if (q.includes('inconsisten') || q.includes('gap') || q.includes('mismatch')) {
      const gaps = mockComputeGapReport(companyId, intake, docs);
      if (gaps.length === 0) {
        answer = 'No inconsistencies or gaps detected. All intake values match the confirmed document extracts.';
      } else {
        answer = `Found ${gaps.length} issue(s):\n\n${gaps.map(g => `• **${g.category === 'consistency' ? 'Data Mismatch' : 'Disclosure Gap'}**: ${g.message}`).join('\n')}`;
      }
    } else if (q.includes('status') || q.includes('overview') || q.includes('summary')) {
      const certified = Object.values(drafts).filter(v => v.status === 'certified').length;
      const total = Object.keys(drafts).length;
      answer = `**Draft Status Summary:**\n• ${certified} of ${total} sections certified\n• ${docs.length} documents uploaded (${docs.filter(d => d.status === 'confirmed').length} confirmed)\n• ${comments.filter(c => c.status === 'active').length} open comments\n• ${notifications.filter(n => !n.is_read).length} unread notifications`;
    } else {
      answer = `I can help you with information about your IPO draft. Try asking:\n• "What sections are pending certification?"\n• "What changed recently?"\n• "Show me all comments"\n• "Are there any inconsistencies?"\n• "Give me a status overview"`;
    }
    
    return Promise.resolve({ data: { answer } });
  }

  return Promise.reject({ response: { status: 404, data: { message: 'Mock endpoint not found' } } });
};

// ----------------------------------------------------
// DUAL-MODE ROUTER DISPATCHER
// ----------------------------------------------------
let useLocalMock = false; // Disabled — real backend is primary. Falls back to mock if server is unreachable.

const callApi = async (method, url, data = null, config = {}) => {
  if (useLocalMock) {
    return runMock(method, url, data);
  }
  try {
    const opts = { method, url, ...config };
    if (data !== null && data !== undefined && method.toLowerCase() !== 'delete') {
      opts.data = data;
    }
    const response = await api(opts);
    return response;
  } catch (err) {
    if (!err.response) { // Connection failed (server not running)
      console.warn("Backend server is offline. Switching to client-side database mock for this demo session!");
      useLocalMock = true;
      localStorage.setItem('ipo_use_mock', 'true');
      return runMock(method, url, data);
    }
    throw err;
  }
};

export const login = (email, password) => callApi('post', '/auth/login', { email, password });
export const register = (payload) => callApi('post', '/auth/register', payload);
export const getMe = () => callApi('get', '/auth/me');
export const getCompanies = () => callApi('get', '/companies');
export const getCompany = (id) => callApi('get', `/companies/${id}`);
export const getCompanyStatus = (id) => callApi('get', `/companies/${id}/status`);
export const getIntake = (companyId) => callApi('get', `/intake/${companyId}`);
export const getIntakeStep = (companyId, stepKey) => callApi('get', `/intake/${companyId}/${stepKey}`);
export const saveIntakeStep = (companyId, stepKey, data) => callApi('put', `/intake/${companyId}/${stepKey}`, data);
export const getDocuments = (companyId) => callApi('get', `/documents/${companyId}`);

// Values OCR pulled out of uploaded documents, mapped onto intake fields.
export const getPrefillSuggestions = (companyId) => callApi('get', `/intake/${companyId}/prefill/suggestions`);
// Blanks-only by default; pass overwrite to also replace conflicting answers.
export const applyPrefill = (companyId, { fields, overwrite } = {}) =>
  callApi('post', `/intake/${companyId}/prefill/apply`, { fields, overwrite });

export const uploadDocument = (companyId, file, docType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_type', docType);
  if (useLocalMock) {
    const mockFormData = new Map();
    mockFormData.set('file', file);
    mockFormData.set('doc_type', docType);
    return callApi('post', `/documents/${companyId}/upload`, mockFormData);
  }
  return callApi('post', `/documents/${companyId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const confirmDocument = (id, data) => callApi('put', `/documents/${id}/confirm`, data);
export const deleteDocument = (id) => callApi('delete', `/documents/${id}`);
export const getDrafts = (companyId) => callApi('get', `/drafts/${companyId}`);

export const generateDrafts = (companyId, sectionKey) => {
  const url = sectionKey ? `/drafts/${companyId}/generate?section=${sectionKey}` : `/drafts/${companyId}/generate`;
  return callApi('post', url);
};

export const updateDraftStatus = (companyId, sectionKey, statusData) =>
  callApi('put', `/drafts/${companyId}/${sectionKey}/status`, statusData);

export const getGapReport = (companyId) => callApi('get', `/drafts/${companyId}/gap-report`);
export const getComments = (sectionId) => callApi('get', `/comments/${sectionId}`);
export const addComment = (sectionId, content, type, blockId = null, parentId = null) => 
  callApi('post', `/comments/${sectionId}`, { content, type, block_id: blockId, parent_id: parentId });

export const editComment = (commentId, content) => callApi('put', `/comments/${commentId}`, { content });
export const deleteComment = (commentId) => callApi('delete', `/comments/${commentId}`);

export const resolveComment = (commentId) => callApi('put', `/comments/${commentId}/resolve`);

export const downloadDocx = async (companyId) => {
  if (useLocalMock) {
    // Generate beautiful client-side word-compatible .doc HTML file
    const dbData = getMockDb();
    const company = dbData.companies.find(c => c.id === companyId) || { name: 'Aarav Precision Engineering Pvt Ltd' };
    const drafts = dbData.drafts[companyId] || {};
    
    const sections = Object.keys(drafts);
    const allCertified = sections.every(sec => drafts[sec].status === 'certified');
    const watermarkText = allCertified 
      ? "CERTIFIED COPY - CONFIDENTIAL" 
      : "DRAFT — PENDING PROFESSIONAL REVIEW (AI-ASSISTED)";

    const sectionMapping = {
      business_overview: "Chapter 1: Business Overview",
      risk_factors: "Chapter 2: Risk Factors",
      objects: "Chapter 3: Objects of the Issue",
      capital_structure: "Chapter 4: Capital Structure",
      related_party: "Chapter 5: Related Party Transactions",
      litigation: "Chapter 6: Litigation & Legal Proceedings",
      promoter_details: "Chapter 7: Promoter & Management Details"
    };

    let chaptersHtml = '';
    sections.forEach(secKey => {
      const chapterTitle = sectionMapping[secKey] || secKey.toUpperCase();
      const section = drafts[secKey];
      chaptersHtml += `
        <h2 style="color:#0f172a; margin-top:30px; font-size:18pt; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">
          ${chapterTitle} <span style="font-size:10pt; color:${section.status === 'certified' ? '#10b981' : '#f59e0b'};">(${section.status.toUpperCase()})</span>
        </h2>
      `;
      section.blocks.forEach(b => {
        let confColor = '#10b981';
        if (b.confidence === 'medium') confColor = '#f59e0b';
        if (b.confidence === 'low') confColor = '#ef4444';
        
        chaptersHtml += `
          <div style="margin-bottom:15px; padding:10px 15px; border-left:3px solid #6366f1; background-color:#f8fafc;">
            <p style="margin:0; font-size:11pt; color:#334155;">${b.text}</p>
            <p style="margin:5px 0 0 0; font-size:8.5pt; color:#6366f1;">
              <strong>Citations:</strong> ${b.citations.join(', ')} | 
              <span style="color:${confColor}; font-weight:bold;">${b.confidence.toUpperCase()} CONFIDENCE</span>
            </p>
          </div>
        `;
      });
    });

    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <title>IPO Offer Document - Draft</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #334155; }
          .header { text-align: center; margin-bottom: 50px; }
          .title { font-size: 26pt; font-weight: bold; color: #1e1b4b; margin: 0; }
          .company-name { font-size: 20pt; font-weight: bold; color: #4f46e5; margin: 10px 0; }
          .subtitle { font-size: 12pt; color: #64748b; margin-bottom: 40px; }
          .watermark-box { border: 2px solid #ef4444; background-color: #fef2f2; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .watermark-title { font-size: 12pt; font-weight: bold; color: #dc2626; margin: 0 0 5px 0; }
          .watermark-text { font-size: 9.5pt; color: #991b1b; margin: 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="title">DRAFT OFFER DOCUMENT</p>
          <p class="company-name">${company.name.toUpperCase()}</p>
          <p class="subtitle">Prepared using IPO Pilot AI Assist Platform</p>
        </div>
        
        <div class="watermark-box">
          <p class="watermark-title">DISCLAIMER & STATUS: ${watermarkText}</p>
          <p class="watermark-text">This is an AI-assisted disclosure document draft generated for SME IPO Emerge board listing. This document has not been certified by a registered Lead Manager (Merchant Banker) or approved by SEBI. It is strictly for reviewer verification and must not be used as a final filed prospectus.</p>
        </div>
        
        <hr style="border:0; border-top:1px solid #cbd5e1; margin:40px 0;" />
        
        ${chaptersHtml}
      </body>
      </html>
    `;

    const blob = new Blob([docHtml], { type: 'application/msword' });
    const blobUrl = URL.createObjectURL(blob);
    
    // Return a dummy Axios-like response containing the blob URL as custom
    return Promise.resolve({ data: blob, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } });
  }
  
  return api.get(`/export/${companyId}/docx`, { responseType: 'blob' });
};

export const downloadPdf = async (companyId) => {
  if (useLocalMock) {
    const dbData = getMockDb();
    const company = dbData.companies.find(c => c.id === companyId) || { name: 'Aarav Precision Engineering Pvt Ltd' };
    const docHtml = `<html xmlns='http://www.w3.org/TR/REC-html40'><head><title>IPO Offer Document - PDF Draft</title></head><body><h1>${company.name.toUpperCase()} - DRAFT PDF</h1></body></html>`;
    const blob = new Blob([docHtml], { type: 'application/pdf' });
    return Promise.resolve({ data: blob, headers: { 'content-type': 'application/pdf' } });
  }
  return api.get(`/export/${companyId}/pdf`, { responseType: 'blob' });
};

export const getNotifications = () => callApi('get', '/notifications');
export const markNotificationRead = (id) => callApi('put', `/notifications/${id}/read`);
export const markAllNotificationsRead = () => callApi('put', '/notifications/mark-all-read');
export const createNotification = (data) => callApi('post', '/notifications', data);

export const getSebiNotices = () => callApi('get', '/sebi-notices');
export const refreshSebiNotices = () => callApi('post', '/sebi-notices/refresh');

export const chatbotQuery = (question, history = []) => callApi('post', '/chatbot/query', { question, history });

export const getAuditLogs = (companyId, page = 1, limit = 10, search = '') => {
  const queryParams = new URLSearchParams();
  if (companyId) queryParams.append('companyId', companyId);
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  if (search) queryParams.append('search', search);
  return callApi('get', `/audit-logs?${queryParams.toString()}`);
};

export const getIpoReadiness = (companyId) => callApi('get', `/companies/${companyId}/ipo-readiness`);

export const getMerchantBankers = (query = '') => callApi('get', `/merchant-bankers${query ? `?q=${encodeURIComponent(query)}` : ''}`);
export const createInvitation = (data) => callApi('post', '/invitations', data);
export const getInvitations = () => callApi('get', '/invitations');
export const updateInvitationStatus = (id, status) => callApi('put', `/invitations/${id}/status`, { status });
export const acceptInvitation = (id) => callApi('put', `/invitations/${id}/accept`);
export const declineInvitation = (id) => callApi('put', `/invitations/${id}/decline`);
export const revokeInvitation = (id) => callApi('put', `/invitations/${id}/revoke`);
export const resendInvitation = (id) => callApi('post', `/invitations/${id}/resend`);
export const verifyDocument = (id, status, remarks) => callApi('put', `/documents/${id}/verify`, { status, remarks });
export const updateIpoReadinessItem = (companyId, itemKey, status, remarks) => callApi('put', `/companies/${companyId}/ipo-readiness/item-status`, { itemKey, status, remarks });

export default api;
