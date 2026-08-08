/**
 * Single Source of Truth IPO Readiness Scoring Engine
 *
 * Fixed 100-Point Model:
 * 1. Intake & Company Information  = 30 Points Max
 * 2. Compliance & SEBI Checks     = 30 Points Max
 * 3. Gap Analysis & Remediation    = 20 Points Max
 * 4. Reviewer Certification       = 20 Points Max
 * ──────────────────────────────────────────────────
 * Total                            = 100 Points Max
 *
 * Rule: Cumulative progress score, NOT a risk score.
 * Identifying or documenting a risk NEVER reduces the score.
 * A new company with no completed preparation work starts at 0/100.
 */

export function calculateSingleSourceOfTruthReadiness(intakeData = {}, documents = [], gapReport = [], drafts = {}) {
  // ── 1. INTAKE & COMPANY INFORMATION (30 POINTS MAX) ────────────────────────
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type || d.type));
  const coreDocTypes = ['aoa', 'moa', 'incorporation_certificate', 'audited_financials', 'board_resolution', 'pan'];
  const uploadedCoreDocsCount = coreDocTypes.filter(dt => uploadedDocTypes.has(dt)).length;

  const intakeSections = [
    'company_details', 'business_overview', 'financials', 'capital_structure',
    'objects', 'promoter_details', 'related_party', 'risk_factors',
    'litigation', 'legal_compliance', 'other_disclosures'
  ];

  const filledIntakeSectionsCount = intakeSections.filter(key => {
    const secData = intakeData[key];
    if (!secData) return false;
    if (typeof secData === 'object') {
      return Object.values(secData).some(v => v !== null && v !== undefined && v !== '');
    }
    return Boolean(secData);
  }).length;

  const docsPoints = Math.round((uploadedCoreDocsCount / coreDocTypes.length) * 15);
  const intakeFormPoints = Math.round((filledIntakeSectionsCount / intakeSections.length) * 15);
  
  const intakeScore = Math.min(30, Math.max(0, docsPoints + intakeFormPoints));

  // ── 2. COMPLIANCE & SEBI CHECKS (30 POINTS MAX) ────────────────────────────
  // Evaluates strictly based on completed data/documents for the active company
  const hasFinancials = uploadedDocTypes.has('audited_financials') || Boolean(intakeData.financials?.net_worth);
  const hasCapital = Boolean(intakeData.capital_structure?.promoter_holding || intakeData.promoter_details?.name);
  const hasOperatingTrack = uploadedDocTypes.has('audited_financials') || Boolean(intakeData.financials?.profit_after_tax);
  const hasBoard = Boolean(intakeData.company_details?.managing_director || intakeData.legal_compliance?.independent_directors);
  const hasAuditComm = uploadedDocTypes.has('board_resolution') || Boolean(intakeData.legal_compliance?.audit_committee);
  const hasBoardRes = uploadedDocTypes.has('board_resolution');

  const sebiRules = [
    { id: 'R1', label: 'SEBI ICDR Reg 6(1) Net Worth Eligibility (Min ₹1 Cr)', passed: hasFinancials, pts: 5 },
    { id: 'R2', label: 'Promoters 20% Post-Issue Equity Contribution Locked', passed: hasCapital, pts: 5 },
    { id: 'R3', label: '3-Year Operating Profit Track Record Satisfied', passed: hasOperatingTrack, pts: 5 },
    { id: 'R4', label: 'Independent Board Composition (Min 50% Independent Directors)', passed: hasBoard, pts: 5 },
    { id: 'R5', label: 'Statutory Audit Committee & SRC Formed', passed: hasAuditComm, pts: 5 },
    { id: 'R6', label: 'Companies Act Sec 179 Board Resolution Executed', passed: hasBoardRes, pts: 5 }
  ];
  const passedRulesCount = sebiRules.filter(r => r.passed).length;
  const complianceScore = Math.min(30, Math.round((passedRulesCount / sebiRules.length) * 30));

  // ── 3. GAP ANALYSIS & REMEDIATION (20 POINTS MAX) ─────────────────────────
  // Evaluates strictly based on company gap records
  let gapScore = 0;
  let addressedGapsCount = 0;
  let totalGaps = gapReport ? gapReport.length : 0;

  if (totalGaps > 0) {
    addressedGapsCount = gapReport.filter(g => g.status === 'resolved' || g.status === 'addressed' || g.documented_in_drhp).length;
    gapScore = Math.min(20, Math.round((addressedGapsCount / totalGaps) * 20));
  }

  // ── 4. REVIEWER CERTIFICATION (20 POINTS MAX) ─────────────────────────────
  const chapterKeys = [
    'company_details', 'business_overview', 'financials', 'capital_structure', 
    'objects', 'promoter_details', 'related_party', 'risk_factors', 
    'litigation', 'legal_compliance', 'other_disclosures'
  ];
  const certifiedChaptersCount = chapterKeys.filter(k => drafts[k] && drafts[k].status === 'certified').length;
  const approvedChaptersCount = chapterKeys.filter(k => drafts[k] && drafts[k].status === 'approved').length;

  const certPointsRaw = (certifiedChaptersCount * 1.82) + (approvedChaptersCount * 1.0);
  const certScore = Math.min(20, Math.round(certPointsRaw));

  // ── TOTAL READINESS SCORE (0 - 100 POINTS) ──────────────────────────────────
  const totalScore = Math.min(100, Math.max(0, intakeScore + complianceScore + gapScore + certScore));

  return {
    score: totalScore, // 0 - 100
    displayScore: `${totalScore} / 100`,
    percentage: `${totalScore}%`,
    categories: {
      intake: { title: 'Intake & Company Information', score: intakeScore, max: 30, pct: Math.round((intakeScore / 30) * 100) },
      compliance: { title: 'Compliance & SEBI Checks', score: complianceScore, max: 30, pct: Math.round((complianceScore / 30) * 100) },
      gapRemediation: { title: 'Gap Analysis & Remediation', score: gapScore, max: 20, pct: Math.round((gapScore / 20) * 100) },
      certification: { title: 'Reviewer Certification', score: certScore, max: 20, pct: Math.round((certScore / 20) * 100) }
    },
    meta: {
      uploadedCoreDocsCount,
      totalCoreDocs: coreDocTypes.length,
      filledIntakeSectionsCount,
      totalIntakeSections: intakeSections.length,
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
