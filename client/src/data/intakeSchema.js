// Shared intake schema — single source of truth for the 8 SME intake modules.
// Consumed by IntakeForm.jsx (the questionnaire) and Dashboard.jsx (completeness heatmap).
import {
  Building,
  Briefcase,
  Users,
  Target,
  PieChart,
  AlertCircle
} from 'lucide-react';

export const steps = [
  { key: 'company_details', label: 'Company Details', icon: Building },
  { key: 'business_overview', label: 'Business Overview', icon: Briefcase },
  { key: 'promoters', label: 'Promoters & Directors', icon: Users },
  { key: 'objects', label: 'Objects of the Issue', icon: Target },
  { key: 'capital_structure', label: 'Capital Structure', icon: PieChart },
  { key: 'rpt', label: 'Related Party Transactions', icon: Users },
  { key: 'financials', label: 'Financials Summary', icon: PieChart },
  { key: 'litigation', label: 'Litigation & Disputes', icon: AlertCircle }
];

export const stepQuestions = {
  company_details: [
    { name: 'legal_name', label: 'Company Legal Name', type: 'text', placeholder: 'e.g., Aarav Precision Engineering Pvt Ltd', why: 'Must match incorporation certificate exactly.', example: 'Aarav Precision Engineering Pvt Ltd' },
    { name: 'cin', label: 'Corporate Identification Number (CIN)', type: 'text', placeholder: '21-digit alphanumeric CIN', why: 'Identifies corporate registration with MCA.', example: 'U29220MH2015PTC263456' },
    { name: 'incorporation_date', label: 'Date of Incorporation', type: 'date', why: 'Establishes track record requirements (usually 3 years).', example: '2015-04-12' },
    { name: 'registered_office', label: 'Registered Office Address', type: 'textarea', placeholder: 'Full address', why: 'Determines jurisdictional courts and state regulatory bounds.', example: 'W-45, MIDC Industrial Area, Dombivli East, Thane, Maharashtra - 421204' },
    { name: 'industry_type', label: 'Industry Sector', type: 'text', placeholder: 'e.g., Heavy Industry, Fintech', why: 'Directs the sector classification on stock exchange boards.', example: 'Precision Engineering & Manufacturing' }
  ],
  business_overview: [
    { name: 'industry_desc', label: 'Sector Analysis Summary', type: 'textarea', placeholder: 'Provide industry trends...', why: 'Assists risk assessors in analyzing growth factors.', example: 'The precision engineering industry in India serves aerospace, automotive, and defense, requiring strict compliance to ISO and metrology rules.' },
    { name: 'products', label: 'Key Products & Services', type: 'textarea', placeholder: 'What does your company manufacture/sell?', why: 'Defines business operations for potential investors.', example: 'High-precision CNC machined components, brass fittings, specialized fasteners, and custom assemblies.' },
    { name: 'customers', label: 'Major Clients', type: 'text', placeholder: 'Client names separated by commas', why: 'Demonstrates market traction and customer risk/concentration.', example: 'Bharat Hydraulic Systems, Sterling Auto Components, Royal Aerospace Parts India' },
    { name: 'operations', label: 'Infrastructure & Operational Description', type: 'textarea', placeholder: 'Manufacturing setup details...', why: 'Documents facility capacity and assets.', example: 'Operating from a 15,000 sq ft facility in Dombivli, Maharashtra, equipped with 14 CNC turning centers, 6 vertical machining centers (VMC), and a dedicated metrology lab.' }
  ],
  promoters: [
    { name: 'promoters_list', label: 'Promoter Profiles & Experience', type: 'textarea', placeholder: 'Name, qualification, experience...', why: 'SEBI mandates detailing key management capability.', example: 'Aarav Mehta (Managing Director, 18 years experience in tool manufacturing) and Rohan Mehta (Director of Operations, 15 years experience in precision machining).' },
    { name: 'directors', label: 'Board of Directors composition', type: 'textarea', placeholder: 'Full names of all directors...', why: 'Identifies board structure and independent governance.', example: 'Aarav Mehta, Rohan Mehta, and Mrs. Sunita Mehta (Non-Executive Director).' }
  ],
  objects: [
    { name: 'amount_to_raise', label: 'Proposed Amount to Raise (INR)', type: 'number', placeholder: 'e.g., 50000000', why: 'Sets total capital size of the public issue.', example: '50000000' },
    { name: 'purpose', label: 'Utilization of Net Proceeds', type: 'textarea', placeholder: 'Acquisition of machines, debt repayment...', why: 'Investors must know exactly what their money funding.', example: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.' },
    { name: 'timeline', label: 'Deployment Timeline (SEBI Mandatory)', type: 'textarea', placeholder: 'e.g. FY27: 3 Cr, FY28: 2 Cr...', why: 'Crucial timeline field. Leaving this blank flags a Red disclosure gap on the dashboard!', example: 'FY27: 35,000,000 INR for VMC purchases; FY28: 15,000,000 INR for working capital requirements.' }
  ],
  capital_structure: [
    { name: 'total_shares', label: 'Total Pre-IPO Shares', type: 'number', placeholder: 'e.g. 1000000', why: 'Establishes capitalization denominator.', example: '1000000' },
    { name: 'promoter_holding_pct', label: 'Promoter Shareholding Percentage (%)', type: 'number', placeholder: 'e.g. 65', why: 'Discrepancy test: Stating 65% here while Cap Table document registers 62% will trigger a consistency alert.', example: '62' },
    { name: 'shareholders', label: 'Key Shareholding Pattern Details', type: 'textarea', placeholder: 'Major shareholders list...', why: 'Identifies control blocks.', example: 'Aarav Mehta: 620,000 shares (62%), Rohan Mehta: 350,000 shares (35%), Other minority: 30,000 shares (3%).' }
  ],
  rpt: [
    { name: 'has_rpt', label: 'Any Related Party Transactions?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Conflict checks are heavily scrutinized by regulators.', example: 'yes' },
    { name: 'rpt_details', label: 'Describe Related Party Transactions', type: 'textarea', placeholder: 'Rent details, loans, supply arrangements...', why: 'Only required if related transactions are active.', example: 'The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm\'s length basis verified by local valuer report.', dependsOn: 'has_rpt' }
  ],
  financials: [
    { name: 'revenue_fy25', label: 'FY25 Revenue (INR)', type: 'number', placeholder: 'e.g. 125000000', why: 'Discrepancy test: Stating 125,000,000 (12.5 Cr) while Audited Financials shows 11.8 Cr will trigger an alert.', example: '118000000' },
    { name: 'revenue_fy24', label: 'FY24 Revenue (INR)', type: 'number', placeholder: 'e.g. 95000000', why: 'Demonstrates revenue trajectory.', example: '95000000' },
    { name: 'revenue_fy23', label: 'FY23 Revenue (INR)', type: 'number', placeholder: 'e.g. 72000000', why: 'Establishes three year growth record.', example: '72000000' },
    { name: 'profit_fy25', label: 'FY25 Profit After Tax (INR)', type: 'number', placeholder: 'e.g. 11000000', why: 'Proves profit track record required for Emerge boards.', example: '11000000' },
    { name: 'total_debt', label: 'Total Outstanding Borrowings (INR)', type: 'number', placeholder: 'e.g. 25000000', why: 'Used to measure capital leverage ratio.', example: '25000000' }
  ],
  litigation: [
    { name: 'has_litigation', label: 'Are there pending litigations against Promoter/Company?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Material litigations must be fully declared.', example: 'yes' },
    { name: 'litigation_details', label: 'Details of Pending Litigations & Demands', type: 'textarea', placeholder: 'Case references, forums, amounts...', why: 'Direct impact on litigation risks chapter.', example: 'An income tax appeal is pending before the Commissioner of Income Tax (Appeals), Mumbai, regarding disallowance of depreciation on tools for FY22, involving a tax demand of 1,200,000 INR. The company has deposited 20% of the demand as per standard stay conditions.', dependsOn: 'has_litigation' }
  ]
};

// Fields that are optional (do not count against required completeness).
// Kept minimal to preserve existing IntakeForm behavior (all fields were effectively required before).
const OPTIONAL_FIELDS = new Set([]);

// Returns the required questions for a module given its current data (respects dependsOn).
export function requiredQuestions(stepKey, data = {}) {
  const qs = stepQuestions[stepKey] || [];
  return qs.filter(
    (q) => !OPTIONAL_FIELDS.has(q.name) && (!q.dependsOn || data[q.dependsOn] === 'yes')
  );
}

// ── Cross-document validation map ────────────────────────────────────────────
// Maps an intake field to the uploaded document (and OCR-extracted key) that
// should corroborate it. Used for real-time cross-document validation.
export const DOC_FIELD_MAP = {
  company_details: {
    legal_name: { docType: 'incorporation_certificate', docKey: 'legal_name', kind: 'text' },
    cin: { docType: 'incorporation_certificate', docKey: 'cin', kind: 'text' },
    incorporation_date: { docType: 'incorporation_certificate', docKey: 'incorporation_date', kind: 'text' }
  },
  financials: {
    revenue_fy25: { docType: 'audited_financials', docKey: 'revenue_fy25', kind: 'number' },
    revenue_fy24: { docType: 'audited_financials', docKey: 'revenue_fy24', kind: 'number' },
    revenue_fy23: { docType: 'audited_financials', docKey: 'revenue_fy23', kind: 'number' },
    profit_fy25: { docType: 'audited_financials', docKey: 'profit_fy25', kind: 'number' }
  },
  capital_structure: {
    total_shares: { docType: 'cap_table', docKey: 'total_shares', kind: 'number' },
    promoter_holding_pct: { docType: 'cap_table', docKey: 'promoter_holding_pct', kind: 'number' }
  }
};

const normalizeNumber = (v) => {
  const n = Number(String(v ?? '').replace(/[,\s₹]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const normalizeText = (v) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/\b(private|pvt\.?|limited|ltd\.?)\b/g, (m) => (m.startsWith('p') ? 'private' : 'limited'))
    .replace(/[^a-z0-9]/g, '');

// Formats large INR figures the way the product does elsewhere (e.g. "11.8 Cr").
export function formatInr(value) {
  const n = normalizeNumber(value);
  if (n === null) return String(value ?? '');
  if (n >= 10000000) return `${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(2).replace(/\.00$/, '')} Lakh`;
  return n.toLocaleString('en-IN');
}

/**
 * Compares one intake field against its source document.
 * Returns null when there is nothing to compare or the values agree,
 * otherwise a mismatch descriptor for inline display.
 */
export function checkFieldAgainstDocuments(stepKey, fieldName, value, documents = []) {
  const rule = DOC_FIELD_MAP[stepKey]?.[fieldName];
  if (!rule) return null;

  const entered = String(value ?? '').trim();
  if (entered === '') return null;

  const doc = (documents || []).find((d) => d.doc_type === rule.docType);
  if (!doc) return null;

  const docRaw = doc.extracted_values?.[rule.docKey];
  if (docRaw === undefined || docRaw === null || String(docRaw).trim() === '') return null;

  let matches;
  if (rule.kind === 'number') {
    const a = normalizeNumber(entered);
    const b = normalizeNumber(docRaw);
    if (a === null || b === null) return null;
    matches = a === b;
  } else {
    matches = normalizeText(entered) === normalizeText(docRaw);
  }
  if (matches) return null;

  const isCurrency = rule.kind === 'number' && /revenue|profit|debt|amount/.test(fieldName);
  return {
    fieldName,
    docName: doc.name,
    docStatus: doc.status,
    docValue: String(docRaw),
    enteredValue: entered,
    docDisplay: isCurrency ? `${formatInr(docRaw)} (${normalizeNumber(docRaw)?.toLocaleString('en-IN')} INR)` : String(docRaw),
    enteredDisplay: isCurrency ? `${formatInr(entered)} (${normalizeNumber(entered)?.toLocaleString('en-IN')} INR)` : entered,
    suggestedValue: String(docRaw).replace(/,/g, '')
  };
}

// Completeness percentage (0-100) for a single module.
export function moduleCompleteness(stepKey, data = {}) {
  const req = requiredQuestions(stepKey, data);
  if (!req.length) return 100;
  const filled = req.filter((q) => String(data[q.name] ?? '').trim() !== '').length;
  return Math.round((filled / req.length) * 100);
}
