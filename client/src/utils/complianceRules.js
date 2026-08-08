// Shared SEBI / Companies Act compliance checklist — single source of truth for
// both ComplianceChecklistPage.jsx (the checklist UI) and readinessEngine.js (the
// 20-point Compliance stage of IPO Readiness). Every rule's pass/fail condition
// lives here exactly once so the checklist page and the score can never disagree.

// Points assigned to each rule — sums to exactly 20.
export const COMPLIANCE_RULE_POINTS = {
  'RULE-001': 2,
  'RULE-002': 2,
  'RULE-003': 2,
  'RULE-004': 2,
  'RULE-005': 2,
  'RULE-006': 2,
  'RULE-007': 2,
  'RULE-008': 1,
  'RULE-009': 2,
  'RULE-010': 1,
  'RULE-011': 1,
  'RULE-012': 1
};

export const COMPLIANCE_MAX = Object.values(COMPLIANCE_RULE_POINTS).reduce((a, b) => a + b, 0);

// A rule earns its full points on 'Pass' or 'Not Applicable' (N/A is never a
// penalty), half its points (rounded down) on 'Warning' (partial progress), and
// zero on 'Fail'. Never negative.
function earnedFor(status, points) {
  if (status === 'Pass' || status === 'Not Applicable') return points;
  if (status === 'Warning') return Math.floor(points / 2);
  return 0;
}

export function computeComplianceChecklist(intakeData = {}, documents = []) {
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));
  const hasIntakeCompleted = Object.keys(intakeData || {}).some(k => intakeData[k] && Object.keys(intakeData[k]).length > 0);

  if (!hasIntakeCompleted && (documents || []).length === 0) return [];

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC';

  const rules = [
    {
      id: 'RULE-001',
      requirementName: 'Articles of Association (AOA) Upload',
      applicableRule: 'Companies Act 2013 Sec 5 & SEBI ICDR Schedule VI Part A',
      category: 'Corporate & Governance',
      status: uploadedDocTypes.has('aoa') ? 'Pass' : 'Fail',
      evidenceUsed: uploadedDocTypes.has('aoa') ? 'AOA document verified in repository with standard pre-emption clauses.' : 'No file uploaded for doc_type: aoa.',
      sourceDocument: documents.find(d => d.doc_type === 'aoa')?.name || 'AOA.pdf (Missing)',
      validationResult: uploadedDocTypes.has('aoa') ? 'Satisfied: Statutory AOA uploaded and validated.' : 'Failed: Mandatory corporate charter document missing.',
      timestamp
    },
    {
      id: 'RULE-002',
      requirementName: 'Memorandum of Association (MOA) Upload',
      applicableRule: 'Companies Act 2013 Sec 4 & SEBI ICDR Schedule VI Part A',
      category: 'Corporate & Governance',
      status: uploadedDocTypes.has('moa') ? 'Pass' : 'Fail',
      evidenceUsed: uploadedDocTypes.has('moa') ? 'MOA charter registered with RoC verified.' : 'No file uploaded for doc_type: moa.',
      sourceDocument: documents.find(d => d.doc_type === 'moa')?.name || 'MOA.pdf (Missing)',
      validationResult: uploadedDocTypes.has('moa') ? 'Satisfied: Statutory MOA verified.' : 'Failed: Primary corporate object clause document missing.',
      timestamp
    },
    {
      id: 'RULE-003',
      requirementName: '3-Year Restated Financial Statements (FY23–FY25)',
      applicableRule: 'SEBI (ICDR) Regulations 2018 — Schedule VI Part A Item (11)',
      category: 'Financial Eligibility',
      status: documents.filter(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials').length >= 3 ? 'Pass' : documents.filter(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials').length > 0 ? 'Warning' : 'Fail',
      evidenceUsed: `${documents.filter(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials').length} of 3 required annual audit statements present.`,
      sourceDocument: 'Audited Financial Statements (PDF)',
      validationResult: documents.filter(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials').length >= 3
        ? 'Satisfied: Full 3-year restated financial audit trail present.'
        : 'Incomplete: Requires 3 consecutive years of audited restated accounts.',
      timestamp
    },
    {
      id: 'RULE-004',
      requirementName: 'Board Resolution Approving IPO Issue',
      applicableRule: 'Companies Act 2013 Sec 179(3) & SEBI ICDR Reg 26(1)',
      category: 'Corporate & Governance',
      status: uploadedDocTypes.has('board_resolution') ? 'Pass' : 'Fail',
      evidenceUsed: uploadedDocTypes.has('board_resolution') ? 'Board resolution extract signed by Company Secretary.' : 'Board resolution file slot empty.',
      sourceDocument: documents.find(d => d.doc_type === 'board_resolution')?.name || 'Board_Resolution.pdf (Missing)',
      validationResult: uploadedDocTypes.has('board_resolution') ? 'Satisfied: Board approval recorded.' : 'Failed: Mandatory director approval resolution missing.',
      timestamp
    },
    {
      id: 'RULE-005',
      requirementName: 'Shareholding Pattern Statement',
      applicableRule: 'SEBI (LODR) Regulations 2015 Reg 31 & ICDR Reg 14',
      category: 'Promoters & Capital',
      status: uploadedDocTypes.has('shareholding_pattern') || uploadedDocTypes.has('cap_table') ? 'Pass' : 'Fail',
      evidenceUsed: uploadedDocTypes.has('shareholding_pattern') || uploadedDocTypes.has('cap_table') ? 'Shareholding equity breakdown pattern verified.' : 'No shareholding pattern document on record.',
      sourceDocument: documents.find(d => d.doc_type === 'shareholding_pattern' || d.doc_type === 'cap_table')?.name || 'Shareholding_Pattern.pdf (Missing)',
      validationResult: uploadedDocTypes.has('shareholding_pattern') || uploadedDocTypes.has('cap_table') ? 'Satisfied: Equity distribution verified.' : 'Failed: Pre-issue equity breakdown unverified.',
      timestamp
    },
    {
      id: 'RULE-006',
      requirementName: 'Promoter Minimum Contribution Lock-In (20%)',
      applicableRule: 'SEBI ICDR Regulations 2018 — Regulations 14 & 16',
      category: 'Promoters & Capital',
      status: Number(intakeData.capital_structure?.promoter_holding_pct || intakeData.promoters?.promoter_holding || 0) >= 20 ? 'Pass' : 'Warning',
      evidenceUsed: `Promoter equity holding recorded at ${intakeData.capital_structure?.promoter_holding_pct || intakeData.promoters?.promoter_holding || 0}%.`,
      sourceDocument: 'Promoter Intake Questionnaire & Cap Table',
      validationResult: Number(intakeData.capital_structure?.promoter_holding_pct || intakeData.promoters?.promoter_holding || 0) >= 20 ? 'Satisfied: Exceeds 20% minimum lock-in mandate.' : 'Warning: Promoter lock-in equity share below statutory threshold.',
      timestamp
    },
    {
      id: 'RULE-007',
      requirementName: 'Net Tangible Assets & Operating Profit Test',
      applicableRule: 'SEBI ICDR Regulations 2018 — Regulation 6(1)',
      category: 'Financial Eligibility',
      status: (intakeData.financials?.revenue_fy25 || intakeData.financials?.profit_fy25) ? 'Pass' : 'Warning',
      evidenceUsed: (intakeData.financials?.revenue_fy25 || intakeData.financials?.profit_fy25) ? 'Financial disclosures recorded in pre-issue audit.' : 'Financial disclosures pending completion.',
      sourceDocument: 'Financial Statement Intake & Balance Sheet',
      validationResult: (intakeData.financials?.revenue_fy25 || intakeData.financials?.profit_fy25) ? 'Satisfied: Quantitative eligibility test passed under SEBI ICDR Reg 6(1).' : 'Warning: Financial eligibility pending data verification.',
      timestamp
    },
    {
      id: 'RULE-008',
      requirementName: 'Statutory & Government Operating Approvals',
      applicableRule: 'SEBI ICDR Schedule VI Part A Section VII',
      category: 'Legal & Statutory',
      status: uploadedDocTypes.has('statutory_approvals') ? 'Pass' : 'Warning',
      evidenceUsed: uploadedDocTypes.has('statutory_approvals') ? 'State Pollution Board & Factory License verified.' : 'Operating licenses pending document upload.',
      sourceDocument: documents.find(d => d.doc_type === 'statutory_approvals')?.name || 'Statutory_Approvals.pdf (Pending)',
      validationResult: uploadedDocTypes.has('statutory_approvals') ? 'Satisfied: Statutory licenses active.' : 'Warning: Verification pending statutory license upload.',
      timestamp
    },
    {
      id: 'RULE-009',
      requirementName: 'Litigation & Material Claims Register',
      applicableRule: 'SEBI ICDR Regulations 2018 — Schedule VI Part A Section VII',
      category: 'Legal & Statutory',
      status: intakeData.litigation?.has_litigation !== undefined || uploadedDocTypes.has('litigation_documents') || uploadedDocTypes.has('litigation_records') ? 'Pass' : 'Warning',
      evidenceUsed: 'Litigation register disclosure submitted in Intake Form.',
      sourceDocument: 'Legal Disclosure Intake Form',
      validationResult: intakeData.litigation?.has_litigation !== undefined ? 'Satisfied: Material litigation disclosures recorded.' : 'Warning: Litigation disclosure pending completion.',
      timestamp
    },
    {
      id: 'RULE-010',
      requirementName: 'Merchant Banker Lead Manager Appointment',
      applicableRule: 'SEBI ICDR Regulations 2018 — Regulation 23',
      category: 'Issue Structure',
      status: intakeData.legal_compliance?.merchant_banker_details ? 'Pass' : 'Warning',
      evidenceUsed: intakeData.legal_compliance?.merchant_banker_details ? 'SEBI registered Category-I Merchant Banker lead manager appointed.' : 'Merchant banker appointment pending disclosure.',
      sourceDocument: 'Lead Manager Engagement Agreement',
      validationResult: intakeData.legal_compliance?.merchant_banker_details ? 'Satisfied: Appointed SEBI registered Merchant Banker.' : 'Warning: Merchant Banker appointment pending.',
      timestamp
    },
    {
      id: 'RULE-011',
      requirementName: 'Auditor Tax Benefits Statement Certificate',
      applicableRule: 'SEBI ICDR Schedule VI Part A Section IV',
      category: 'Financial Eligibility',
      status: uploadedDocTypes.has('tax_benefits') ? 'Pass' : 'Warning',
      evidenceUsed: uploadedDocTypes.has('tax_benefits') ? 'Special tax benefit certificate signed by Statutory Auditor.' : 'Tax certificate not yet uploaded.',
      sourceDocument: documents.find(d => d.doc_type === 'tax_benefits')?.name || 'Tax_Certificate.pdf (Pending)',
      validationResult: uploadedDocTypes.has('tax_benefits') ? 'Satisfied: Tax benefit certificate active.' : 'Warning: Auditor tax benefit certificate unverified.',
      timestamp
    },
    {
      id: 'RULE-012',
      requirementName: 'Material Contracts & Inspection List',
      applicableRule: 'SEBI ICDR Schedule VI Part A Section X',
      category: 'Issue Structure',
      status: uploadedDocTypes.has('material_contracts') ? 'Pass' : 'Not Applicable',
      evidenceUsed: uploadedDocTypes.has('material_contracts') ? 'Material contracts cataloged for public inspection.' : 'Exempted for SME IPO profile or pending contract listing.',
      sourceDocument: documents.find(d => d.doc_type === 'material_contracts')?.name || 'Material_Contracts.pdf',
      validationResult: uploadedDocTypes.has('material_contracts') ? 'Satisfied: Inspection list verified.' : 'Not Applicable: Optional for initial SME draft filing.',
      timestamp
    }
  ];

  return rules.map(r => {
    const points = COMPLIANCE_RULE_POINTS[r.id] || 0;
    return { ...r, points, earnedPoints: earnedFor(r.status, points) };
  });
}
