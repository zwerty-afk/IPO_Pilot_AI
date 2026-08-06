/**
 * Real SEBI SME Framework Eligibility & Regulatory Validation Engine
 * Sourced from SEBI Board Memorandum & Verified Regulations (March 2025 ICDR/LODR Amendments)
 */

export function evaluateSebiEligibilityRules(intakeData = {}, documents = []) {
  const companyDetails = intakeData.company_details || {};
  const financials = intakeData.financials || {};
  const objects = intakeData.objects || {};
  const capital = intakeData.capital_structure || {};
  const rpt = intakeData.rpt || {};
  const promoters = intakeData.promoters || {};
  const legal = intakeData.legal_compliance || {};

  // Utility to extract clean numeric values from string inputs
  const parseNum = (val) => {
    if (!val) return 0;
    const n = Number(String(val).replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  const issueSize = parseNum(companyDetails.proposed_issue_size || objects.amount_to_raise);
  const revenueFY25 = parseNum(financials.revenue_fy25);
  const profitFY25 = parseNum(financials.profit_fy25);
  const profitFY24 = parseNum(financials.profit_fy24);
  const profitFY23 = parseNum(financials.profit_fy23);

  const rules = [
    // 1. Minimum Issue Size
    {
      id: 'sebi-rule-issue-size',
      title: '1. Minimum Issue Size Requirement',
      regRef: 'SEBI ICDR SME Framework',
      description: 'Proposed Issue Size (Company Details → Capital) must be more than ₹10 Crore. Flag if below.',
      source: 'Company Details → Proposed Issue Size',
      stepKey: 'company_details',
      fieldName: 'proposed_issue_size',
      eval: () => {
        if (!issueSize) return { status: 'needs_data', label: 'Needs Data', reason: 'Proposed issue size not specified in intake.' };
        if (issueSize > 100000000) {
          return { status: 'pass', label: 'Pass', reason: `Proposed Issue Size of ₹${(issueSize / 10000000).toFixed(2)} Cr exceeds the minimum ₹10 Cr requirement.` };
        }
        return { status: 'fail', label: 'Fail', reason: `Proposed Issue Size of ₹${(issueSize / 10000000).toFixed(2)} Cr is below the mandatory ₹10 Cr threshold.` };
      }
    },

    // 2. Minimum Operating Profit (EBITDA)
    {
      id: 'sebi-rule-ebitda',
      title: '2. Minimum Operating Profit (EBITDA)',
      regRef: 'SEBI ICDR Reg 229(6) (March 2025)',
      description: 'Company must have positive operating profit (EBITDA) of at least ₹1 Crore in at least 2 of the last 3 financial years.',
      source: 'Financial Summary → Profit & EBITDA Data',
      stepKey: 'financials',
      fieldName: 'profit_fy25',
      eval: () => {
        const p25 = profitFY25 >= 10000000;
        const p24 = profitFY24 >= 10000000;
        const p23 = profitFY23 >= 10000000;
        const count = [p25, p24, p23].filter(Boolean).length;

        if (!profitFY25 && !profitFY24) {
          return { status: 'needs_data', label: 'Needs Data', reason: '3-year operating profit (EBITDA/PAT) figures not fully entered in intake.' };
        }
        if (count >= 2) {
          return { status: 'pass', label: 'Pass', reason: `Operating profit (EBITDA/PAT) exceeds ₹1 Cr in ${count} of the last 3 financial years.` };
        }
        return { status: 'fail', label: 'Fail', reason: `Operating profit exceeds ₹1 Cr in only ${count} of the last 3 years (requires at least 2 years).` };
      }
    },

    // 3. Face Value Requirement
    {
      id: 'sebi-rule-face-value',
      title: '3. Share Face Value Requirement',
      regRef: 'SEBI SME Exchange Norms',
      description: 'Face Value of equity shares (Company Details → Capital) must be ₹10 per share.',
      source: 'Company Details → Authorized/Paid-Up Capital',
      stepKey: 'company_details',
      fieldName: 'authorized_capital',
      eval: () => {
        const text = String(companyDetails.authorized_capital || companyDetails.paid_up_capital || '').toLowerCase();
        if (!text) return { status: 'needs_data', label: 'Needs Data', reason: 'Authorized capital details not entered in intake.' };
        if (text.includes('10') || text.includes('rs 10') || text.includes('inr 10')) {
          return { status: 'pass', label: 'Pass', reason: 'Equity share face value is ₹10 per share.' };
        }
        return { status: 'fail', label: 'Fail', reason: 'Share face value appears to differ from the standard ₹10 per share.' };
      }
    },

    // 4. Minimum Application Size / Lot Size
    {
      id: 'sebi-rule-application-size',
      title: '4. Minimum Investor Application Size & Lot Sizing',
      regRef: 'SEBI ICDR Amendment (March 2025)',
      description: 'Minimum application size for investors must be 2 lots, above ₹2,00,000, per current SEBI SME norms.',
      source: 'Informational — SEBI SME Norms',
      stepKey: 'company_details',
      fieldName: 'proposed_issue_size',
      eval: () => ({
        status: 'informational',
        label: 'Informational',
        reason: 'Informational note: Minimum application size for retail/non-institutional investors is 2 lots (> ₹2,00,000) per March 2025 SEBI norms.'
      })
    },

    // 5. Minimum Allottees Requirement
    {
      id: 'sebi-rule-min-allottees',
      title: '5. Minimum Post-IPO Allottees Threshold',
      regRef: 'SEBI ICDR Reg 229(7) (March 2025)',
      description: 'Issuer must have at least 200 allottees post-IPO (increased from earlier 50).',
      source: 'Informational — SEBI SME Norms',
      stepKey: 'capital_structure',
      fieldName: 'total_shares',
      eval: () => ({
        status: 'informational',
        label: 'Informational',
        reason: 'Informational note: Issuer must achieve at least 200 allottees post-IPO to satisfy post-listing market liquidity requirements.'
      })
    },

    // 6. Offer for Sale (OFS) Cap
    {
      id: 'sebi-rule-ofs-cap',
      title: '6. Offer for Sale (OFS) Allocation Cap (Max 20%)',
      regRef: 'SEBI ICDR Amendment (March 2025)',
      description: 'OFS component must not exceed 20% of total issue size, and no selling shareholder can offer >20% of their pre-issue shareholding.',
      source: 'Objects of the Issue → Purpose',
      stepKey: 'objects',
      fieldName: 'purpose',
      eval: () => {
        const text = String(objects.purpose || '').toLowerCase();
        if (text.includes('ofs') || text.includes('offer for sale') || text.includes('selling shareholder')) {
          if (text.includes('>20%') || text.includes('30%') || text.includes('40%') || text.includes('50%')) {
            return { status: 'fail', label: 'Fail', reason: 'OFS allocation in Objects description exceeds the mandatory 20% issue size cap.' };
          }
          return { status: 'needs_verification', label: 'Needs Verification', reason: 'OFS component detected in issue purpose — verify OFS does not exceed 20% of issue size.' };
        }
        return { status: 'pass', label: 'Pass', reason: 'Issue proceeds dedicated 100% to fresh capital issue (No OFS cap violation).' };
      }
    },

    // 7. Promoter Lock-In Structure
    {
      id: 'sebi-rule-promoter-lockin',
      title: '7. Minimum Promoter Contribution (MPC) Lock-In',
      regRef: 'SEBI ICDR Reg 238 (March 2025)',
      description: 'Minimum Promoter Contribution (MPC 20%) locked for 5 years; excess promoter holding releases in two phases (50% after 1 year, 50% after 2 years).',
      source: 'Capital Structure → Lock-In Disclosures',
      stepKey: 'capital_structure',
      fieldName: 'lock_in_details',
      eval: () => {
        const text = String(capital.lock_in_details || '').toLowerCase();
        if (text.includes('5 year') || text.includes('5 years') || text.includes('mpc')) {
          return { status: 'pass', label: 'Pass', reason: '5-year promoter lock-in for MPC disclosed in capital structure.' };
        }
        return { status: 'informational', label: 'Informational', reason: 'Informational note: Ensure 5-year lock-in for 20% MPC is incorporated in draft offer document.' };
      }
    },

    // 8. General Corporate Purpose (GCP) Cap
    {
      id: 'sebi-rule-gcp-cap',
      title: '8. General Corporate Purpose (GCP) Allocation Cap',
      regRef: 'SEBI ICDR Reg 230(2) (Needs Verification)',
      description: 'GCP portion should not exceed 10–15% of amount raised or ₹10 Crore, whichever is lower.',
      source: 'Objects of the Issue → Purpose',
      stepKey: 'objects',
      fieldName: 'purpose',
      eval: () => {
        const text = String(objects.purpose || '').toLowerCase();
        if (text.includes('general corporate') || text.includes('gcp')) {
          if (text.includes('25%') || text.includes('30%') || text.includes('20%')) {
            return { status: 'fail', label: 'Fail', reason: 'GCP allocation in Objects description appears to exceed 15% threshold.' };
          }
          return { status: 'needs_verification', label: 'Needs Verification', reason: 'GCP portion detected — mark this specific threshold as Needs Verification against Regulation 230(2) (10–15% cap).' };
        }
        return { status: 'needs_verification', label: 'Needs Verification', reason: 'Verify GCP allocation percentage against Regulation 230(2) limits (10–15% cap).' };
      }
    },

    // 9. Prohibition on Repaying Promoter Loans
    {
      id: 'sebi-rule-no-promoter-loan-repay',
      title: '9. Prohibition on Repayment of Promoter Loans',
      regRef: 'SEBI ICDR Reg 230 (March 2025)',
      description: 'Issue proceeds cannot be used to repay any loan taken from Promoter, Promoter Group, or related parties.',
      source: 'Objects of the Issue → Purpose',
      stepKey: 'objects',
      fieldName: 'purpose',
      eval: () => {
        const text = String(objects.purpose || '').toLowerCase();
        if (text.includes('repay promoter') || text.includes('promoter loan') || text.includes('related party loan') || text.includes('promoter debt')) {
          return { status: 'fail', label: 'Fail', reason: 'Issue proceeds cannot be utilized for repayment of promoter or related-party loans under March 2025 SEBI norms.' };
        }
        return { status: 'pass', label: 'Pass', reason: 'No repayment of promoter/related-party loans present in issue objects.' };
      }
    },

    // 10. Monitoring Agency Requirement
    {
      id: 'sebi-rule-monitoring-agency',
      title: '10. Mandatory Monitoring Agency Appointment',
      regRef: 'SEBI ICDR Reg 243 (March 2025)',
      description: 'Mandatory if fresh issue > ₹20 Crore OR objects include funding a subsidiary, repaying subsidiary debt, JV investment, or acquisition.',
      source: 'Objects of the Issue → Amount to Raise',
      stepKey: 'objects',
      fieldName: 'amount_to_raise',
      eval: () => {
        const text = String(objects.purpose || '').toLowerCase();
        const triggersSub = text.includes('subsidiary') || text.includes('acquisition') || text.includes('joint venture');
        if (issueSize > 200000000 || triggersSub) {
          return { status: 'needs_verification', label: 'Action Required', reason: `Issue size (₹${(issueSize/10000000).toFixed(2)} Cr > ₹20 Cr) or subsidiary funding requires appointing a SEBI-registered Monitoring Agency.` };
        }
        return { status: 'pass', label: 'Pass', reason: 'Issue size is ≤ ₹20 Cr with no subsidiary acquisitions (Monitoring Agency optional).' };
      }
    },

    // 11. Related Party Transaction (RPT) Materiality
    {
      id: 'sebi-rule-rpt-materiality',
      title: '11. Related Party Transaction (RPT) 10% Materiality Threshold',
      regRef: 'SEBI LODR Amendment (March 2025)',
      description: 'Flag any related party transaction exceeding 10% of annual consolidated turnover as requiring shareholder approval.',
      source: 'Related Party Transactions → RPT Details',
      stepKey: 'rpt',
      fieldName: 'rpt_details',
      eval: () => {
        const text = String(rpt.rpt_details || '').toLowerCase();
        if (rpt.has_rpt === 'yes' || text.length > 0) {
          return { status: 'needs_verification', label: 'Needs Verification', reason: 'Active RPTs declared — verify whether any transaction exceeds 10% of turnover (requires shareholder resolution).' };
        }
        return { status: 'pass', label: 'Pass', reason: 'No material related party transactions exceeding 10% turnover detected.' };
      }
    },

    // 12. Cooling-off Period for Converted Entities
    {
      id: 'sebi-rule-cooling-off',
      title: '12. Corporate Entity 2-Year Track Record (Converted Entities)',
      regRef: 'SEBI ICDR Reg 229 (March 2025)',
      description: 'If entity was converted from proprietorship/partnership/LLP, it must exist as a company for at least 2 full financial years before filing.',
      source: 'Company Details → Date of Incorporation',
      stepKey: 'company_details',
      fieldName: 'incorporation_date',
      eval: () => {
        if (!companyDetails.incorporation_date) {
          return { status: 'needs_data', label: 'Needs Data', reason: 'Date of incorporation not entered in intake.' };
        }
        const incYear = new Date(companyDetails.incorporation_date).getFullYear();
        const currentYear = new Date().getFullYear();
        const diffYears = currentYear - incYear;

        if (diffYears >= 2) {
          return { status: 'pass', label: 'Pass', reason: `Company incorporated on ${companyDetails.incorporation_date} (${diffYears} years track record ≥ 2 years requirement).` };
        }
        return { status: 'fail', label: 'Fail', reason: `Company incorporated on ${companyDetails.incorporation_date} (${diffYears} years < 2 years corporate track record requirement).` };
      }
    },

    // 13. Promoter / Director Debarment Exclusions
    {
      id: 'sebi-rule-debarment-check',
      title: '13. Debarment & Wilful Defaulter Eligibility Disqualifications',
      regRef: 'SEBI ICDR Reg 228',
      description: 'Issuer, promoters, promoter group, or directors must not be debarred from capital markets, be a wilful defaulter, or a fugitive economic offender.',
      source: 'Promoters & Directors → Profiles',
      stepKey: 'promoters',
      fieldName: 'promoters_list',
      eval: () => ({
        status: 'informational',
        label: 'Informational',
        reason: 'Mandatory declaration check: Ensure formal CIBIL, MCA, SEBI debarment, and Fugitive Economic Offender affidavits are collected.'
      })
    },

    // 14. Conversion of Convertible Securities
    {
      id: 'sebi-rule-convertible-securities',
      title: '14. Pre-IPO Conversion of Outstanding Convertible Securities',
      regRef: 'SEBI ICDR Reg 234',
      description: 'All outstanding convertible securities (except ESOPs) must be converted into equity before filing the draft offer document.',
      source: 'Capital Structure → Past Fundraising',
      stepKey: 'capital_structure',
      fieldName: 'past_fundraising',
      eval: () => {
        const text = String(capital.past_fundraising || capital.shareholders || '').toLowerCase();
        if (text.includes('ccd') || text.includes('ccps') || text.includes('unconverted') || text.includes('debently')) {
          return { status: 'fail', label: 'Fail', reason: 'Unconverted convertible instruments detected — must be fully converted into equity before DRHP filing.' };
        }
        return { status: 'pass', label: 'Pass', reason: 'No outstanding unconverted convertible instruments detected in capital structure.' };
      }
    },

    // 15. Mandatory Supplementary Disclosures
    {
      id: 'sebi-rule-supplementary-disclosures',
      title: '15. Mandatory Supplementary Disclosures & Site Visit Report',
      regRef: 'SEBI ICDR Schedule VI',
      description: 'Head of Department experience, EPF/ESIC employee details (numbers, amounts, delays), Merchant Banker site visit report & fee structure disclosure.',
      source: 'Legal & Compliance → Auditor & Banker Details',
      stepKey: 'legal_compliance',
      fieldName: 'auditor_details',
      eval: () => ({
        status: 'informational',
        label: 'Informational',
        reason: 'Mandatory due diligence check: Verify EPF/ESIC remittance history, HOD profiles, site visit report, and Lead Manager fee disclosures.'
      })
    }
  ];

  return rules.map(r => {
    const res = r.eval();
    return {
      ...r,
      status: res.status,
      statusLabel: res.label,
      reason: res.reason
    };
  });
}
