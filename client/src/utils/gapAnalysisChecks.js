// Shared Gap Analysis & Remediation checklist — single source of truth for both
// GapAnalysisPage.jsx (the gap list UI) and readinessEngine.js (the 20-point Gap
// Analysis stage of IPO Readiness).
//
// Mirrors the "applicable" conditions of the server's live consistency engine
// (computeGapReport in server/server.js) so a check only pays out once real data
// exists to verify — a brand-new company has nothing "applicable" yet, so it can't
// earn free points just because no gap has been flagged. Once applicable, a check
// is "resolved" (earns its points) exactly when the corresponding gap id is NOT
// present in the live gapReport — i.e. the AI found no problem with it. Risk
// disclosure checks are the one exception: per the "risk factors must not reduce
// the score" rule, they're earned once genuinely disclosed, regardless of the
// value entered.

export const GAP_CHECK_POINTS = {
  'gap-rev-mismatch': 5,
  'gap-holding-mismatch': 5,
  'gap-missing-timeline': 4,
  'gap-customer-concentration': 2,
  'gap-single-factory': 2,
  'gap-tax-demand-risk': 2
};

export const GAP_ANALYSIS_MAX = Object.values(GAP_CHECK_POINTS).reduce((a, b) => a + b, 0);

export function computeGapAnalysisChecks(intakeData = {}, documents = [], gapReport = []) {
  const gapsList = Array.isArray(gapReport) ? gapReport : (gapReport?.gaps || []);
  const flaggedIds = new Set(gapsList.map(g => g.id));
  const findFlagged = (id) => gapsList.find(g => g.id === id);

  const intake = intakeData || {};
  const docs = documents || [];
  const financials = intake.financials || {};
  const capitalStructure = intake.capital_structure || {};
  const objects = intake.objects || {};
  const riskInfo = intake.risk_information || {};

  const finDoc = docs.find(d => d.doc_type === 'audited_financials');
  const capDoc = docs.find(d => d.doc_type === 'cap_table');

  const checks = [];

  // 1. Revenue consistency: intake FY25 revenue vs audited financials document.
  {
    const id = 'gap-rev-mismatch';
    const points = GAP_CHECK_POINTS[id];
    const applicable = Boolean(financials.revenue_fy25 && finDoc?.extracted_values?.revenue_fy25);
    const resolved = applicable && !flaggedIds.has(id);
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Revenue Matches Audited Financials',
      description: applicable
        ? (resolved ? 'FY25 revenue in the Intake Form matches the audited financial statement.' : 'FY25 revenue in the Intake Form does not match the uploaded audited financial statement.')
        : 'Enter FY25 revenue in Financials Summary and upload Audited Financial Statements to verify.',
      remediation: findFlagged(id)?.message || null,
      route: '/intake?step=financials',
      category: 'Data Consistency'
    });
  }

  // 2. Promoter holding consistency: intake capital structure vs cap table document.
  {
    const id = 'gap-holding-mismatch';
    const points = GAP_CHECK_POINTS[id];
    const applicable = Boolean(capitalStructure.promoter_holding_pct && capDoc?.extracted_values?.promoter_holding_pct);
    const resolved = applicable && !flaggedIds.has(id);
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Promoter Holding Matches Cap Table',
      description: applicable
        ? (resolved ? 'Promoter shareholding % in the Intake Form matches the Cap Table document.' : 'Promoter shareholding % in the Intake Form does not match the uploaded Cap Table.')
        : 'Enter Promoter Shareholding % in Capital Structure and upload the Certified Cap Table to verify.',
      remediation: findFlagged(id)?.message || null,
      route: '/intake?step=capital_structure',
      category: 'Data Consistency'
    });
  }

  // 3. Fund deployment timeline disclosed (SEBI-mandatory Objects field).
  {
    const id = 'gap-missing-timeline';
    const points = GAP_CHECK_POINTS[id];
    const objectsStarted = Boolean(objects.amount_to_raise || objects.purpose);
    const timelineFilled = Boolean(objects.timeline && objects.timeline.trim() !== '');
    const applicable = objectsStarted;
    const resolved = applicable && timelineFilled;
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Fund Deployment Timeline Disclosed',
      description: !applicable
        ? 'Start the Objects of the Issue section to unlock this check.'
        : (resolved ? 'Deployment timeline for issue proceeds has been disclosed.' : 'Deployment timeline for the proposed issue proceeds is missing — SEBI mandatory disclosure.'),
      remediation: findFlagged(id)?.message || null,
      route: '/intake?step=objects',
      category: 'Completeness'
    });
  }

  // 4. Customer concentration risk disclosed — filling this is progress, the
  // percentage value itself is never penalized.
  {
    const id = 'gap-customer-concentration';
    const points = GAP_CHECK_POINTS[id];
    const applicable = riskInfo.top5_customers_pct !== undefined && riskInfo.top5_customers_pct !== null && String(riskInfo.top5_customers_pct).trim() !== '';
    const resolved = applicable;
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Customer Concentration Risk Disclosed',
      description: resolved ? 'Top-5 customer revenue concentration has been disclosed.' : 'Disclose the Top 5 Customers Revenue Share in Risk Information.',
      remediation: null,
      route: '/intake?step=risk_information',
      category: 'Risk Disclosure'
    });
  }

  // 5. Single-facility concentration risk disclosed.
  {
    const id = 'gap-single-factory';
    const points = GAP_CHECK_POINTS[id];
    const applicable = riskInfo.single_factory === 'yes' || riskInfo.single_factory === 'no';
    const resolved = applicable;
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Single-Facility Risk Disclosed',
      description: resolved ? 'Facility concentration risk has been disclosed.' : 'Answer Single Facility Operations in Risk Information.',
      remediation: null,
      route: '/intake?step=risk_information',
      category: 'Risk Disclosure'
    });
  }

  // 6. Tax demand exposure reviewed — tied to full completion of the Risk
  // Information section's required fields (a genuine "reviewed the risk profile"
  // signal, since pending_tax_demand itself is an optional field).
  {
    const id = 'gap-tax-demand-risk';
    const points = GAP_CHECK_POINTS[id];
    const applicable = riskInfo.top5_customers_pct !== undefined && riskInfo.single_factory !== undefined;
    const resolved = applicable && (riskInfo.top5_customers_pct !== undefined && riskInfo.single_factory !== undefined);
    checks.push({
      id, points, applicable, resolved, earnedPoints: resolved ? points : 0,
      title: 'Tax Demand Exposure Reviewed',
      description: resolved ? 'Contingent tax liability exposure has been reviewed as part of the risk profile.' : 'Complete the required Risk Information fields to review tax demand exposure.',
      remediation: findFlagged(id)?.message || null,
      route: '/intake?step=risk_information',
      category: 'Risk Disclosure'
    });
  }

  return checks;
}
