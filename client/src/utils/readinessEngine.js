/**
 * Single Source of Truth IPO Readiness Scoring Engine
 *
 * Fixed 100-Point 5-Category Weighted Monotonic Model:
 * 1. INTAKE FORM               = 30 Points Max
 *    - Company Details                  5 pts
 *    - Promoters & Capital Structure    5 pts
 *    - Business Overview                5 pts
 *    - Financial Information            5 pts
 *    - Legal & Compliance               4 pts
 *    - Objects / RPT                    3 pts
 *    - Risk Factors                     3 pts
 * 2. DOCUMENTS                 = 20 Points Max (5 core documents x 4 pts each)
 * 3. COMPLIANCE                = 10 Points Max (5 SEBI rules x 2 pts each)
 * 4. GAP ANALYSIS              = 20 Points Max (Proportional to resolved gaps)
 * 5. REVIEWER CERTIFICATION    = 20 Points Max (Proportional to certified chapters)
 * ─────────────────────────────────────────────────────────────────────────────
 * TOTAL                         = 100 Points Max
 *
 * Rule: Monotonic cumulative progress score, NOT a risk score.
 * Points are earned immediately upon completing valid required actions.
 * Points are derived strictly from the active company's actual persisted data.
 */

export const READINESS_WEIGHTS = {
  INTAKE_MAX: 30,
  DOCUMENTS_MAX: 20,
  COMPLIANCE_MAX: 10,
  GAPS_MAX: 20,
  CERTIFICATION_MAX: 20,
  TOTAL_MAX: 100
};

function getSectionRatio(data) {
  if (!data) return 0;
  if (typeof data !== 'object') return Boolean(data) ? 1 : 0;
  const entries = Object.entries(data);
  if (entries.length === 0) return 0;

  const validFields = entries.filter(([k, v]) => {
    if (k.startsWith('_') || k === 'id' || k === 'createdAt' || k === 'updatedAt') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object' && v !== null) {
      return Object.values(v).some(x => x !== null && x !== undefined && String(x).trim() !== '');
    }
    return v !== null && v !== undefined && String(v).trim() !== '';
  });

  if (validFields.length === 0) return 0;
  // Requires at least 3 valid fields completed to reach full 100% section score
  return Math.min(1, validFields.length / 3);
}

export function calculateSingleSourceOfTruthReadiness(intakeData = {}, documents = [], gapReport = [], drafts = {}) {
  // ── 1. INTAKE FORM (30 POINTS MAX) ──────────────────────────────────────────
  const companyDetailsRatio = getSectionRatio(intakeData.company_details);
  const companyDetailsPts = Math.round(companyDetailsRatio * 5);

  const promoterCapitalRatio = Math.max(
    getSectionRatio(intakeData.promoters), 
    getSectionRatio(intakeData.capital_structure), 
    getSectionRatio(intakeData.promoter_details)
  );
  const promoterCapitalPts = Math.round(promoterCapitalRatio * 5);

  const businessRatio = getSectionRatio(intakeData.business_overview);
  const businessPts = Math.round(businessRatio * 5);

  const financialRatio = getSectionRatio(intakeData.financials);
  const financialPts = Math.round(financialRatio * 5);

  const legalRatio = Math.max(getSectionRatio(intakeData.legal_compliance), getSectionRatio(intakeData.litigation));
  const legalPts = Math.round(legalRatio * 4);

  const objectsRptRatio = Math.max(getSectionRatio(intakeData.objects), getSectionRatio(intakeData.rpt), getSectionRatio(intakeData.related_party));
  const objectsRptPts = Math.round(objectsRptRatio * 3);

  const riskRatio = Math.max(getSectionRatio(intakeData.risk_information), getSectionRatio(intakeData.risk_factors));
  const riskPts = Math.round(riskRatio * 3);

  const intakeScore = Math.min(30, Math.max(0, companyDetailsPts + promoterCapitalPts + businessPts + financialPts + legalPts + objectsRptPts + riskPts));

  // ── 2. DOCUMENTS (20 POINTS MAX) ─────────────────────────────────────────────
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type || d.type));
  const coreDocs = [
    { type: 'aoa', label: 'Articles of Association (AOA)', pts: 4, uploaded: uploadedDocTypes.has('aoa') },
    { type: 'moa', label: 'Memorandum of Association (MOA)', pts: 4, uploaded: uploadedDocTypes.has('moa') },
    { type: 'audited_financials', label: 'Audited Financial Statements', pts: 4, uploaded: uploadedDocTypes.has('audited_financials') },
    { type: 'board_resolution', label: 'Board Resolution for IPO', pts: 4, uploaded: uploadedDocTypes.has('board_resolution') },
    { type: 'incorporation_certificate', label: 'Certificate of Incorporation / PAN', pts: 4, uploaded: uploadedDocTypes.has('incorporation_certificate') || uploadedDocTypes.has('pan') }
  ];
  const uploadedDocsCount = coreDocs.filter(d => d.uploaded).length;
  const documentsScore = Math.min(20, Math.max(0, uploadedDocsCount * 4));

  // ── 3. COMPLIANCE (10 POINTS MAX) ────────────────────────────────────────────
  const hasFinancials = uploadedDocTypes.has('audited_financials') || Boolean(intakeData.financials?.net_worth);
  const hasCapital = Boolean((intakeData.capital_structure && Object.keys(intakeData.capital_structure).length > 0) || intakeData.promoter_details?.name);
  const hasOperatingTrack = uploadedDocTypes.has('audited_financials') || Boolean(intakeData.financials?.profit_after_tax);
  const hasBoard = Boolean(intakeData.company_details?.managing_director || intakeData.legal_compliance?.independent_directors);
  const hasAuditComm = uploadedDocTypes.has('board_resolution') || Boolean(intakeData.legal_compliance?.audit_committee);

  const sebiRules = [
    { id: 'R1', label: 'SEBI Reg 6(1) Net Worth Eligibility (Min ₹1 Cr)', passed: hasFinancials, pts: 2 },
    { id: 'R2', label: 'Promoters 20% Lock-in Eligibility', passed: hasCapital, pts: 2 },
    { id: 'R3', label: '3-Year Operating Profit Track Record', passed: hasOperatingTrack, pts: 2 },
    { id: 'R4', label: 'Independent Board Composition (Min 50%)', passed: hasBoard, pts: 2 },
    { id: 'R5', label: 'Statutory Audit Committee Formed', passed: hasAuditComm, pts: 2 }
  ];
  const passedRulesCount = sebiRules.filter(r => r.passed).length;
  const complianceScore = Math.min(10, Math.max(0, passedRulesCount * 2));

  // ── 4. GAP ANALYSIS (20 POINTS MAX) ──────────────────────────────────────────
  let gapScore = 0;
  let addressedGapsCount = 0;
  const gapsList = Array.isArray(gapReport) ? gapReport : (gapReport?.gaps || []);
  let totalGaps = gapsList.length;

  if (totalGaps > 0) {
    addressedGapsCount = gapsList.filter(g => g.status === 'resolved' || g.status === 'addressed' || g.documented_in_drhp).length;
    gapScore = Math.min(20, Math.round((addressedGapsCount / totalGaps) * 20));
  } else {
    gapScore = 0;
  }

  // ── 5. REVIEWER CERTIFICATION (20 POINTS MAX) ─────────────────────────────
  const chapterKeys = [
    'company_details', 'business_overview', 'financials', 'capital_structure', 
    'objects', 'promoter_details', 'related_party', 'risk_factors', 
    'litigation', 'legal_compliance', 'other_disclosures'
  ];
  const certifiedChaptersCount = chapterKeys.filter(k => drafts[k] && drafts[k].status === 'certified').length;
  const approvedChaptersCount = chapterKeys.filter(k => drafts[k] && drafts[k].status === 'approved').length;

  let certScore = 0;
  if (certifiedChaptersCount === chapterKeys.length) {
    certScore = 20;
  } else {
    const certPointsRaw = (certifiedChaptersCount * (20 / chapterKeys.length)) + (approvedChaptersCount * 1.0);
    certScore = Math.min(20, Math.round(certPointsRaw));
  }

  // ── TOTAL READINESS SCORE (0 - 100 POINTS) ──────────────────────────────────
  const totalScore = Math.min(100, Math.max(0, intakeScore + documentsScore + complianceScore + gapScore + certScore));

  return {
    score: totalScore, // 0 - 100
    displayScore: `${totalScore} / 100`,
    percentage: `${totalScore}%`,
    categories: {
      intake: { title: 'INTAKE FORM', score: intakeScore, max: 30, pct: Math.round((intakeScore / 30) * 100) },
      documents: { title: 'DOCUMENTS', score: documentsScore, max: 20, pct: Math.round((documentsScore / 20) * 100) },
      compliance: { title: 'COMPLIANCE', score: complianceScore, max: 10, pct: Math.round((complianceScore / 10) * 100) },
      gapRemediation: { title: 'GAP ANALYSIS', score: gapScore, max: 20, pct: Math.round((gapScore / 20) * 100) },
      certification: { title: 'REVIEWER CERTIFICATION', score: certScore, max: 20, pct: Math.round((certScore / 20) * 100) }
    },
    sectionBreakdown: {
      companyDetails: companyDetailsPts,
      promotersCapital: promoterCapitalPts,
      businessOverview: businessPts,
      financials: financialPts,
      legalCompliance: legalPts,
      objectsRpt: objectsRptPts,
      riskFactors: riskPts
    },
    meta: {
      uploadedCoreDocsCount: uploadedDocsCount,
      totalCoreDocs: 5,
      coreDocs,
      passedRulesCount,
      totalRules: sebiRules.length,
      sebiRules,
      addressedGapsCount,
      totalGaps,
      certifiedChaptersCount,
      approvedChaptersCount,
      totalChapters: chapterKeys.length
    }
  };
}
