import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

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
        amount_to_raise: '50,000,000',
        purpose: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.',
        timeline: '' // GAP: Timeline is empty to trigger a mandatory disclosure gap.
      },
      capital_structure: {
        total_shares: '1,000,000',
        promoter_holding_pct: '65', // INCONSISTENCY: Promoter states 65% in intake, but the Cap Table document shows 620,000 shares (62%).
        shareholders: 'Aarav Mehta: 650,000 shares (65%), Rohan Mehta: 350,000 shares (35%).'
      },
      rpt: {
        has_rpt: 'yes',
        rpt_details: 'The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm\'s length basis verified by local valuer report.'
      },
      financials: {
        revenue_fy25: '125,000,000', // INCONSISTENCY: Intake states 12.5 Cr (125,000,000), but Audited Financials shows 11.8 Cr (118,000,000).
        revenue_fy24: '95,000,000',
        revenue_fy23: '72,000,000',
        profit_fy25: '11,000,000',
        profit_fy24: '7,500,000',
        profit_fy23: '4,200,000',
        total_debt: '25,000,000'
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
      status: 'uploaded', // Issuer needs to review & confirm to show OCR review workflow.
      uploaded_at: '2026-07-06T10:05:00Z',
      extracted_values: {
        revenue_fy25: '118,000,000', // OCR reads 11.8 Cr
        revenue_fy24: '95,000,000',
        revenue_fy23: '72,000,000',
        profit_fy25: '11,000,000',
        net_worth: '45,000,000'
      }
    },
    {
      id: 'doc-captable',
      companyId: 'aarav-precision',
      name: 'Certified_Cap_Table_March_2026.pdf',
      doc_type: 'cap_table',
      status: 'uploaded', // Issuer needs to review & confirm.
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
            confidence: 'low', // Low confidence warning for missing gap field
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
  ]
};

// Database utility functions
export function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return INITIAL_SEED;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db file, restoring seed:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return INITIAL_SEED;
  }
}

export function saveDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Scaffolding queries for safety & comfort
export const db = {
  getUsers: () => getDb().users,
  getCompanies: () => getDb().companies,
  getCompany: (id) => getDb().companies.find(c => c.id === id),
  
  getIntake: (companyId) => getDb().intake[companyId] || {},
  saveIntakeStep: (companyId, stepKey, stepData) => {
    const data = getDb();
    if (!data.intake[companyId]) data.intake[companyId] = {};
    data.intake[companyId][stepKey] = stepData;
    saveDb(data);
    return data.intake[companyId][stepKey];
  },
  
  getDocuments: (companyId) => getDb().documents.filter(d => d.companyId === companyId),
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
      // Prevent AI from certifying, only reviewer can certify
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
  addComment: (sectionId, content, type, author, role, blockId = null) => {
    const data = getDb();
    const newComment = {
      id: 'comm-' + Date.now(),
      section_id: sectionId,
      block_id: blockId,
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
  }
};
