// Shared DRHP export rendering engine — renders the SAME section/subsection
// hierarchy and block content shown in the Draft Preview (client DraftCanvas.jsx /
// DrhpCompositionEngine.jsx / FrontMatterTemplate.jsx) into real docx/pdfkit
// primitives (bordered/shaded tables, vector-drawn charts, boxed org charts,
// timelines, headers/footers) so the downloaded file visually matches the
// on-screen document, not just its text content. Citations ("Source:" chips in
// the app) are intentionally never rendered here — they are an in-app
// traceability aid only, not part of the DRHP document itself.
import {
  Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel,
  BorderStyle, ShadingType, ImageRun, AlignmentType, VerticalAlign,
  Header, Footer, PageNumber
} from 'docx';
import sharp from 'sharp';

// Exact mirror of client/src/data/sebiDrhpSchema.js — kept in sync manually since
// the client bundle isn't importable from this CommonJS-adjacent server runtime.
export const DRHP_HIERARCHY = [
  {
    id: 'general', title: 'SECTION I – GENERAL', key: 'company_details',
    subsections: [
      { id: 'definitions_and_abbreviations', title: 'Definitions and Abbreviations', key: 'company_details' },
      { id: 'certain_conventions_presentation', title: 'Certain Conventions, Use of Financial Information & Market Data', key: 'company_details' },
      { id: 'forward_looking_statements', title: 'Forward Looking Statements', key: 'company_details' }
    ]
  },
  { id: 'risk_factors', title: 'RISK FACTORS', key: 'risk_factors', subsections: [] },
  {
    id: 'introduction', title: 'INTRODUCTION', key: 'company_details',
    subsections: [
      { id: 'the_offer', title: 'The Offer', key: 'company_details' },
      { id: 'summary_restated_financial_info', title: 'Summary of Restated Financial Information', key: 'financials' },
      { id: 'summary_contingent_liabilities', title: 'Summary of Contingent Liabilities of Our Company', key: 'litigation' },
      { id: 'summary_rpt', title: 'Summary of Related Party Transactions', key: 'related_party' },
      { id: 'general_information', title: 'General Information', key: 'company_details' },
      { id: 'capital_structure', title: 'Capital Structure', key: 'capital_structure' }
    ]
  },
  {
    id: 'particulars_of_the_offer', title: 'PARTICULARS OF THE OFFER', key: 'objects',
    subsections: [
      { id: 'objects_of_the_offer', title: 'Objects of the Offer', key: 'objects' },
      { id: 'basis_for_offer_price', title: 'Basis for Offer Price', key: 'financials' },
      { id: 'statement_special_tax_benefits', title: 'Statement of Special Tax Benefits', key: 'legal_compliance' }
    ]
  },
  {
    id: 'about_our_company', title: 'ABOUT OUR COMPANY', key: 'business_overview',
    subsections: [
      { id: 'industry_overview', title: 'Industry Overview', key: 'business_overview' },
      { id: 'our_business', title: 'Our Business', key: 'business_overview' },
      { id: 'key_regulations_and_policies', title: 'Key Regulations and Policies', key: 'legal_compliance' },
      { id: 'history_and_certain_corporate_matters', title: 'History and Certain Corporate Matters', key: 'company_details' },
      { id: 'our_management', title: 'Our Management', key: 'promoter_details' },
      { id: 'our_promoters_and_promoter_group', title: 'Our Promoters and Promoter Group', key: 'promoter_details' },
      { id: 'our_group_companies', title: 'Our Group Companies', key: 'other_disclosures' },
      { id: 'dividend_policy', title: 'Dividend Policy', key: 'other_disclosures' }
    ]
  },
  {
    id: 'financial_information', title: 'FINANCIAL INFORMATION', key: 'financials',
    subsections: [
      { id: 'restated_financial_information', title: 'Restated Financial Information', key: 'financials' },
      { id: 'restated_statement_capitalisation', title: 'Restated Statement of Capitalisation', key: 'capital_structure' },
      { id: 'other_financial_information', title: 'Other Financial Information', key: 'financials' },
      { id: 'mda_financial_position', title: "Management's Discussion and Analysis of Financial Position and Results of Operations", key: 'financials' }
    ]
  },
  {
    id: 'legal_and_other_information', title: 'LEGAL AND OTHER INFORMATION', key: 'litigation',
    subsections: [
      { id: 'outstanding_litigation_developments', title: 'Outstanding Litigation and Material Developments', key: 'litigation' },
      { id: 'government_statutory_approvals', title: 'Government and Other Statutory Approvals', key: 'legal_compliance' },
      { id: 'other_regulatory_statutory_disclosures', title: 'Other Regulatory and Statutory Disclosures', key: 'legal_compliance' }
    ]
  },
  {
    id: 'offer_related_information', title: 'OFFER RELATED INFORMATION', key: 'objects',
    subsections: [
      { id: 'terms_of_the_offer', title: 'Terms of the Offer', key: 'objects' },
      { id: 'offer_structure', title: 'Offer Structure', key: 'capital_structure' },
      { id: 'offer_procedure', title: 'Offer Procedure', key: 'legal_compliance' },
      { id: 'restrictions_foreign_ownership', title: 'Restrictions on Foreign Ownership of Indian Securities', key: 'legal_compliance' }
    ]
  },
  { id: 'description_equity_shares_aoa', title: 'DESCRIPTION OF EQUITY SHARES AND TERMS OF ARTICLES OF ASSOCIATION', key: 'capital_structure', subsections: [] },
  {
    id: 'other_information', title: 'OTHER INFORMATION', key: 'other_disclosures',
    subsections: [
      { id: 'material_contracts_documents_inspection', title: 'Material Contracts and Documents for Inspection', key: 'other_disclosures' },
      { id: 'declaration', title: 'Declaration', key: 'other_disclosures' }
    ]
  }
];

// ── Fixed template subsections (mirrors DraftCanvas.jsx getBlocksForSubsection) ──

function glossaryBlocks(intake = {}) {
  const cd = intake.company_details || {};
  const companyName = cd.legal_name || 'Aarav Precision Engineering Pvt Ltd';
  const cin = cd.cin || 'U29220MH2015PTC263456';
  const incDate = cd.incorporation_date || '2015-04-12';
  const regOffice = cd.registered_office || 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204';
  const promoterNames = intake.promoters?.promoters_list || 'Aarav Mehta & Rohan Mehta';
  const auditorName = intake.legal_compliance?.auditor_details || 'M/s Shah & Associates, Chartered Accountants (FRN: 104920W)';
  const mbName = intake.legal_compliance?.merchant_banker_details || 'Apex Capital Advisors Pvt Ltd (SEBI Reg: INM000012490)';

  const terms = [
    ['Company / Our Company', `${companyName}, a private limited company incorporated on ${incDate} under the Companies Act with Corporate Identification Number ${cin}.`],
    ['Registered Office', regOffice],
    ['Promoters', `${promoterNames}, being the individual promoters of our Company.`],
    ['Promoter Group', 'Includes Aarav Mehta, Rohan Mehta, Mrs. Sunita Mehta, and Aarav Precision Tooling Ltd.'],
    ['Group Companies', 'Mehta Industrial Properties and Mehta CNC Tooling Solutions.'],
    ['Draft Red Herring Prospectus (DRHP)', 'This Draft Red Herring Prospectus issued in accordance with SEBI ICDR Regulations.'],
    ['Red Herring Prospectus (RHP)', 'The prospectus to be filed with ROC after approval of DRHP, containing the price band or issue price.'],
    ['Offer / Issue', 'Initial Public Offering of Equity Shares by our Company.'],
    ['Equity Shares', 'Equity shares of our Company having face value of ₹10 each.'],
    ['Lead Manager / Merchant Banker', mbName],
    ['Registrar to the Issue', 'Bigshare Services Pvt Ltd (SEBI Reg: INR000001385).'],
    ['SEBI ICDR Regulations', 'Securities and Exchange Board of India (Issue of Capital and Disclosure Requirements) Regulations, 2018 as amended.'],
    ['Companies Act', 'The Companies Act, 2013 and applicable rules framed thereunder.'],
    ['SEBI', 'Securities and Exchange Board of India constituted under the SEBI Act, 1992.'],
    ['ROC', 'Registrar of Companies, Mumbai, Maharashtra.'],
    ['ASBA', 'Application Supported by Blocked Amount mechanism for bidding in the Issue.'],
    ['UPI', 'Unified Payments Interface mechanism for retail individual bidders.'],
    ['Restated Financial Statements', 'Restated Statement of Assets and Liabilities, Profit & Loss, and Cash Flows for FY23, FY24, and FY25.'],
    ['Statutory Auditors', auditorName],
    ['Net Worth', 'Aggregate value of paid-up equity share capital and reserves.'],
    ['EBITDA', 'Earnings Before Interest, Taxes, Depreciation, and Amortization.'],
    ['PAT', 'Profit After Tax.'],
    ['Board / Board of Directors', `Board of Directors of ${companyName}.`],
    ['CAGR', 'Compounded Annual Growth Rate.'],
    ['CIN', 'Corporate Identity Number.'],
    ['DIN', 'Director Identification Number.'],
    ['GSTIN', 'Goods and Services Tax Identification Number.']
  ];

  return [
    { type: 'narrative', text: 'In this Draft Red Herring Prospectus, unless the context otherwise indicates or implies, the following terms and abbreviations shall have the meanings assigned to them below.' },
    { type: 'table', headers: ['Term / Abbreviation', 'Definition / Full Disclosure'], rows: terms }
  ];
}

function conventionsBlocks() {
  return [
    { type: 'narrative', title: 'Currency and Financial Presentation', text: "All references in this Draft Red Herring Prospectus to 'INR', 'Rs.', 'Rupees', or '₹' are to the Indian Rupee, the official currency of the Republic of India. All financial amounts contained herein are presented in Indian Rupees and expressed in Crores (1 Crore = 10,000,000 INR) or Lakhs (1 Lakh = 100,000 INR) unless explicitly specified otherwise." },
    { type: 'narrative', title: 'Financial Reporting Standards', text: 'Financial information included in this Draft Red Herring Prospectus is derived from our Restated Financial Statements for FY 2022-23, FY 2023-24, and FY 2024-25, prepared in accordance with Indian Accounting Standards (Ind AS) / Indian GAAP and the relevant provisions of the Companies Act, 2013. Our Fiscal Year commences on April 1 and ends on March 31 of the following calendar year.' },
    { type: 'narrative', title: 'Market and Industry Data Sources', text: 'Market and industry data used throughout this DRHP has been obtained from CRISIL Research Report, Ministry of Heavy Industries, MCA filings, and official government publications. Industry publications generally state that the information contained therein has been obtained from sources believed to be reliable.' },
    { type: 'narrative', title: 'Rounding & Numerical Adjustments', text: 'Certain numerical figures and percentages in this DRHP have been subject to rounding adjustments. Component figures in tables may not sum exactly to stated totals due to rounding off to two decimal places.' }
  ];
}

function forwardLookingBlocks() {
  return [{
    type: 'narrative',
    text: 'This Draft Red Herring Prospectus contains certain forward-looking statements that involve risks and uncertainties. All statements other than statements of historical facts contained in this DRHP, including statements regarding our Company\'s future financial position, business strategy, expansion plans, financial targets, and objectives of management for future operations, are forward-looking statements.\n\nThese statements can generally be identified by words or phrases such as "aim", "anticipate", "believe", "expect", "estimate", "intend", "objective", "plan", "project", "shall", "will", "will continue", "will pursue", or other words of similar import.\n\nActual results could differ materially from those expressed or implied in such forward-looking statements due to various factors, including volatility in raw material prices, customer concentration, single-facility operational risk, pending legal proceedings, and changes in government policy or SEBI ICDR regulations.\n\nNeither our Company, the Promoters, the Lead Manager, nor any of their respective affiliates undertake any obligation to update or revise any forward-looking statement, whether as a result of new information, future events, or otherwise, except as required by SEBI (ICDR) Regulations, 2018 or applicable law.'
  }];
}

function industryOverviewBlocks() {
  return [
    { type: 'narrative', text: 'Industry Overview: The Indian precision engineering & manufacturing sector is projected to grow at 12.5% CAGR driven by Make in India initiatives, defense localization mandates, and global supply chain diversification. Demand for CNC machined components in Tier-1 automotive and industrial hydraulics continues to expand rapidly.' },
    { type: 'stat_cards', stats: [
      { label: 'Sector CAGR Projection', value: '12.5%', subtext: 'FY24 - FY30' },
      { label: 'Domestic Opportunity', value: '₹45,000 Cr', subtext: 'SME Machining Market' },
      { label: 'Export Share Growth', value: '18.2%', subtext: 'Annual Growth Rate' },
      { label: 'Primary Market Driver', value: 'Make in India', subtext: 'Auto & Defense OEM' }
    ] }
  ];
}

function keyRegulationsBlocks() {
  return [{
    type: 'compliance_matrix', title: 'Key Regulations & Statutory Compliance Matrix',
    items: [
      { name: 'Factory License', authority: 'Inspector of Factories, MH', refNo: '45920-THN', validity: 'Valid till Dec 2028' },
      { name: 'MPCB Consent to Operate', authority: 'MH Pollution Control Board', refNo: 'MPCB-2024-092', validity: 'Valid till March 2029' },
      { name: 'Fire NOC', authority: 'Thane Municipal Fire Dept', refNo: 'NOC-112-2025', validity: 'Valid till Oct 2027' },
      { name: 'GSTIN Registration', authority: 'Central Board of Indirect Taxes', refNo: '27AABCA1234F1Z5', validity: 'Active / Statutory' }
    ]
  }];
}

function historyBlocks() {
  return [{
    type: 'timeline', title: 'History & Corporate Milestones',
    milestones: [
      { year: '2015', event: 'Company Incorporation', detail: 'Incorporated under Companies Act as a private limited entity.' },
      { year: '2018', event: 'MIDC Dombivli Plant Setup', detail: 'Setup primary 25,000 sq ft CNC manufacturing plant.' },
      { year: '2022', event: 'AS9100D Certification', detail: 'Achieved quality certification for aerospace & defense supply chain.' },
      { year: '2025', event: 'SME IPO Filing', detail: 'Initiated DRHP filing for listing on NSE Emerge / BSE SME.' }
    ]
  }];
}

function groupCompaniesBlocks() {
  return [{
    type: 'table', title: 'Details of Group Companies & Sister Entities',
    headers: ['Entity Name', 'Nature of Business', 'Promoter Shareholding %', 'Registered Location'],
    rows: [
      ['Mehta Industrial Properties', 'Industrial Property Leasing', '100.00%', 'Dombivli East, Thane'],
      ['Mehta CNC Tooling Solutions', 'Tooling Distribution', '60.00%', 'Pune, Maharashtra']
    ]
  }];
}

function dividendPolicyBlocks() {
  return [{
    type: 'callout', title: 'Dividend Policy Declaration',
    text: 'Dividend Policy: The Company has not declared dividends during the last 3 fiscal years (FY23, FY24, FY25) in order to retain internal accruals for expansion of manufacturing capacity. Future dividend payments will depend upon net profits, capital expenditure needs, working capital requirements, and applicable statutory reserves under Section 123 of the Companies Act.'
  }];
}

const FIXED_SUBSECTION_BLOCKS = {
  definitions_and_abbreviations: (intake) => glossaryBlocks(intake),
  certain_conventions_presentation: () => conventionsBlocks(),
  forward_looking_statements: () => forwardLookingBlocks(),
  industry_overview: () => industryOverviewBlocks(),
  key_regulations_and_policies: () => keyRegulationsBlocks(),
  history_and_certain_corporate_matters: () => historyBlocks(),
  our_group_companies: () => groupCompaniesBlocks(),
  dividend_policy: () => dividendPolicyBlocks()
};

// Subsections that only show a curated subset of their chapter's generated blocks.
const SUBSECTION_BLOCK_FILTER = {
  our_business: (blocks) => blocks.filter(b => ['bo-1', 'bo-3', 'bo-4', 'bo-5', 'bo-6'].includes(b.id)),
  our_management: (blocks) => blocks.filter(b => b.id === 'prom-2' || b.id === 'prom-3' || b.type === 'org_chart'),
  our_promoters_and_promoter_group: (blocks) => blocks.filter(b => b.id === 'prom-1')
};

/** Mirrors DraftCanvas.jsx's getBlocksForSubsection, without citations. */
export function getExportBlocksForSubsection(subId, subKey, drafts, intake) {
  if (FIXED_SUBSECTION_BLOCKS[subId]) return FIXED_SUBSECTION_BLOCKS[subId](intake);

  const allBlocks = (drafts[subKey] && drafts[subKey].blocks) || [];
  const filter = SUBSECTION_BLOCK_FILTER[subId];
  if (filter) {
    const filtered = filter(allBlocks);
    return filtered.length > 0 ? filtered : allBlocks;
  }
  return allBlocks;
}

/** Mirrors FrontMatterTemplate.jsx's field resolution exactly (same fallbacks). */
export function resolveFrontMatterContext(intake = {}, company = {}) {
  const cd = intake?.company_details || {};
  const bo = intake?.business_overview || {};
  const cap = intake?.capital_structure || {};
  const obj = intake?.objects || {};
  const prom = intake?.promoters || {};
  const od = intake?.other_disclosures || {};

  const compName = cd.legal_name || company.name || company.legal_name || 'Aarav Precision Engineering Pvt Ltd';
  const formerName = cd.former_name || company.formerName || 'Aarav Machining Private Limited';
  const cin = cd.cin || company.cin || 'U29220MH2015PTC263456';
  const regOffice = cd.registered_office || company.address || 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204';
  const complianceOfficer = cd.compliance_officer || company.complianceOfficer || 'K. V. & Associates (Company Secretary)';
  const telephone = cd.telephone || company.contactNo || '+91 (0251) 2894012';
  const email = cd.email || company.email || 'investors@aaravprecision.com';
  const website = cd.website || company.website || 'www.aaravprecision.com';
  const promoters = prom.promoters_list || company.promoters || 'Aarav Mehta and Rohan Mehta';
  const companyAct = cd.company_act || '2013';
  const incDate = cd.incorporation_date || company.incorporation_date || '2015-04-12';
  const incYear = incDate.substring(0, 4);
  const freshIssueAmt = obj.amount_to_raise || '[•]';
  const ofsShares = cap.ofs_shares || 'N/A';
  const ofsAmt = cap.ofs_amount || 'N/A';
  const promoterSeller = prom.selling_shareholder || '';
  const draftDate = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
  const brlm = od.brlm || 'GYR Capital Advisors Private Limited';
  const registrar = od.registrar || 'Bigshare Services Private Limited';

  return {
    compName, formerName, cin, regOffice, complianceOfficer, telephone, email, website,
    promoters, companyAct, incDate, incYear, freshIssueAmt, ofsShares, ofsAmt, promoterSeller,
    draftDate, brlm, registrar,
    floorPrice: '[•]', capPrice: '[•]', minBidLot: '[•]',
    offerOpenDate: '[•]', offerCloseDate: '[•]', anchorDate: '[•]'
  };
}

// ── Chart math (shared, mirrors DrhpLineChart / DrhpDonutChart exactly) ─────

const DONUT_COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

function computeDonutSlices(data) {
  const total = data.reduce((acc, d) => acc + (Number(d.value) || 0), 0) || 1;
  let cumulativeAngle = 0;
  const slices = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const angle = (val / total) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    return { ...d, startAngle, endAngle: cumulativeAngle, pct: Math.round((val / total) * 100), color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });
  return { slices, total };
}

/** Exact port of DrhpDonutChart's getCoordinatesForAngle. */
function donutCoordinatesForAngle(angleDeg, cx, cy, r) {
  const angleInRadians = ((angleDeg - 90) * Math.PI) / 180.0;
  return { x: cx + r * Math.cos(angleInRadians), y: cy + r * Math.sin(angleInRadians) };
}

function donutArcPath(cx, cy, r, startAngle, endAngle) {
  const start = donutCoordinatesForAngle(startAngle, cx, cy, r);
  const end = donutCoordinatesForAngle(endAngle, cx, cy, r);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

/** Exact port of DrhpLineChart's point math. */
function computeLineChartPoints(data, { padding, width, height }) {
  const maxVal = Math.max(...data.map(d => Math.max(Number(d.revenue) || 0, Number(d.profit) || 0))) * 1.15 || 100;
  const xFor = (i) => padding + (i * (width - 2 * padding)) / Math.max(data.length - 1, 1);
  const yFor = (v) => height - padding - ((Number(v) || 0) / maxVal) * (height - 2 * padding);
  return { xFor, yFor, maxVal };
}

function buildLineChartSvg(block) {
  const data = block.data && block.data.length > 0 ? block.data : [];
  if (data.length === 0) return null;
  const padding = 44, width = 640, height = 260, legendH = 34;
  const { xFor, yFor } = computeLineChartPoints(data, { padding, width, height });
  const pathRev = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.revenue).toFixed(1)}`).join(' ');
  const pathPat = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.profit).toFixed(1)}`).join(' ');

  const grid = [0.25, 0.5, 0.75, 1].map(r => {
    const gy = (height - padding - r * (height - 2 * padding)).toFixed(1);
    return `<line x1="${padding}" y1="${gy}" x2="${width - padding}" y2="${gy}" stroke="#e2e8f0" stroke-dasharray="3 3" stroke-width="1.5" />`;
  }).join('');

  const revMarkers = data.map((d, i) => {
    const x = xFor(i).toFixed(1), y = yFor(d.revenue).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="5.5" fill="#4f46e5" /><text x="${x}" y="${Number(y) - 14}" text-anchor="middle" font-size="13" font-weight="700" fill="#4338ca" font-family="Helvetica,Arial,sans-serif">${d.revenue} Cr</text><text x="${x}" y="${height - padding + 22}" text-anchor="middle" font-size="12" fill="#64748b" font-family="Helvetica,Arial,sans-serif">${d.year}</text>`;
  }).join('');

  const patMarkers = data.map((d, i) => {
    const x = xFor(i).toFixed(1), y = yFor(d.profit).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="4.5" fill="#10b981" /><text x="${x}" y="${Number(y) + 20}" text-anchor="middle" font-size="11" font-weight="700" fill="#047857" font-family="Helvetica,Arial,sans-serif">${d.profit} Cr</text>`;
  }).join('');

  const totalH = height + legendH;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}">
<rect width="${width}" height="${totalH}" fill="#ffffff" />
${grid}
<path d="${pathRev}" fill="none" stroke="#4f46e5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
<path d="${pathPat}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
${revMarkers}
${patMarkers}
<circle cx="${padding}" cy="${height + 18}" r="5.5" fill="#4f46e5" /><text x="${padding + 13}" y="${height + 23}" font-size="13" font-weight="700" fill="#4338ca" font-family="Helvetica,Arial,sans-serif">Revenue (Rs Cr)</text>
<circle cx="${padding + 160}" cy="${height + 18}" r="5.5" fill="#10b981" /><text x="${padding + 173}" y="${height + 23}" font-size="13" font-weight="700" fill="#047857" font-family="Helvetica,Arial,sans-serif">PAT (Rs Cr)</text>
</svg>`;
}

function buildDonutChartSvg(block) {
  const data = block.data && block.data.length > 0 ? block.data : [];
  if (data.length === 0) return null;
  const { slices, total } = computeDonutSlices(data);
  const cx = 110, cy = 115, r = 92;

  const paths = slices.map(s => `<path d="${donutArcPath(cx, cy, r, s.startAngle, s.endAngle)}" fill="${s.color}" stroke="#ffffff" stroke-width="2.5" />`).join('');
  const legend = slices.map((s, i) => {
    const ly = 24 + i * 36;
    return `<rect x="252" y="${ly}" width="18" height="18" rx="4" fill="${s.color}" /><text x="278" y="${ly + 14}" font-size="15" font-weight="700" fill="#334155" font-family="Helvetica,Arial,sans-serif">${s.label}</text><text x="278" y="${ly + 31}" font-size="13" fill="#64748b" font-family="Helvetica,Arial,sans-serif">${s.value} (${s.pct}%)</text>`;
  }).join('');

  const svgHeight = Math.max(cy + r + 20, 24 + slices.length * 36 + 16);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="${svgHeight}" viewBox="0 0 640 ${svgHeight}">
<rect width="640" height="${svgHeight}" fill="#ffffff" />
${paths}
<circle cx="${cx}" cy="${cy}" r="42" fill="#ffffff" />
<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="11" font-weight="700" fill="#94a3b8" font-family="Helvetica,Arial,sans-serif">TOTAL</text>
<text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="16" font-weight="700" fill="#0f172a" font-family="Helvetica,Arial,sans-serif">${total} Cr</text>
${legend}
</svg>`;
}

async function svgToPngBuffer(svg) {
  return sharp(Buffer.from(svg), { density: 200 }).png().toBuffer();
}

// ── DOCX rendering ──────────────────────────────────────────────────────────

const HEADER_SHADE = 'F1F5F9';
const BORDER_COLOR = 'CBD5E1';
const ROW_BORDER_COLOR = 'E2E8F0';

function cellBorder(color = ROW_BORDER_COLOR, size = 4) {
  const b = { style: BorderStyle.SINGLE, size, color };
  return { top: b, bottom: b, left: b, right: b };
}

function docxTable(headers, rows, opts = {}) {
  const n = (headers && headers.length) || (rows[0] && rows[0].length) || 1;
  const first = n > 1 ? 30 : 100;
  const restW = n > 1 ? Math.floor((100 - first) / (n - 1)) : 0;
  const colWidths = n > 1 ? [first, ...Array(n - 1).fill(restW)] : [100];

  const tableRows = [];
  if (headers && headers.length > 0) {
    tableRows.push(new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => new TableCell({
        width: { size: colWidths[i], type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: HEADER_SHADE },
        borders: cellBorder(BORDER_COLOR),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 90, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: String(h).toUpperCase(), bold: true, size: 16, color: '0f172a' })] })]
      }))
    }));
  }
  rows.forEach(row => {
    if (!Array.isArray(row)) return;
    tableRows.push(new TableRow({
      children: row.map((cell, i) => new TableCell({
        width: { size: colWidths[i] || colWidths[colWidths.length - 1], type: WidthType.PERCENTAGE },
        borders: cellBorder(ROW_BORDER_COLOR),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [new Paragraph({ children: [new TextRun({ text: String(cell ?? ''), size: 16, color: i === 0 ? '0f172a' : '334155', bold: i === 0 })] })]
      }))
    }));
  });

  return new Table({ rows: tableRows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function docxPara(text, { bold = false, italics = false, size = 18, color = '334155', spacing } = {}) {
  return new Paragraph({ spacing: spacing || { before: 60, after: 60 }, children: [new TextRun({ text, size, color, bold, italics })] });
}

/** Single-cell shaded/bordered "box" — used for risk cards, callouts. */
function docxBox(paragraphs, { fill, borderColor }) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill },
      borders: cellBorder(borderColor, 6),
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      children: paragraphs
    })] })]
  });
}

function docxStatCards(stats) {
  if (!stats || stats.length === 0) return null;
  const perRow = Math.min(stats.length, 4) || 1;
  const cellW = Math.floor(100 / perRow);
  const cells = stats.map(s => new TableCell({
    width: { size: cellW, type: WidthType.PERCENTAGE },
    borders: cellBorder(ROW_BORDER_COLOR),
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F8FAFC' },
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [
      new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text: String(s.label || '').toUpperCase(), size: 12, color: '94a3b8', bold: true })] }),
      new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: String(s.value || ''), size: 26, bold: true, color: '0f172a' })] }),
      ...(s.subtext ? [new Paragraph({ children: [new TextRun({ text: String(s.subtext), size: 14, bold: true, color: '059669' })] })] : [])
    ]
  }));
  const rows = [];
  for (let i = 0; i < cells.length; i += perRow) rows.push(new TableRow({ children: cells.slice(i, i + perRow) }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function docxTimeline(milestones) {
  if (!milestones || milestones.length === 0) return null;
  const rows = milestones.map(m => new TableRow({
    children: [
      new TableCell({
        width: { size: 16, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'EEF2FF' },
        borders: cellBorder(ROW_BORDER_COLOR),
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 70, bottom: 70, left: 90, right: 60 },
        children: [new Paragraph({ children: [new TextRun({ text: String(m.year || ''), bold: true, size: 17, color: '4f46e5' })] })]
      }),
      new TableCell({
        width: { size: 84, type: WidthType.PERCENTAGE },
        borders: cellBorder(ROW_BORDER_COLOR),
        margins: { top: 70, bottom: 70, left: 110, right: 90 },
        children: [
          new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: String(m.event || ''), bold: true, size: 18, color: '0f172a' })] }),
          new Paragraph({ children: [new TextRun({ text: String(m.detail || ''), size: 16, color: '475569' })] })
        ]
      })
    ]
  }));
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function docxOrgChart(data) {
  if (!data) return [];
  const els = [];
  els.push(new Table({
    width: { size: 55, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [new TableRow({ children: [new TableCell({
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: '4f46e5' },
      borders: cellBorder('4f46e5', 4),
      margins: { top: 90, bottom: 90, left: 90, right: 90 },
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: data.title || '', bold: true, size: 19, color: 'ffffff' })] })]
    })] })]
  }));
  els.push(new Paragraph({ spacing: { before: 40, after: 40 }, children: [] }));

  const children = data.sub || [];
  if (children.length > 0) {
    const perRow = Math.min(children.length, 3);
    const cellW = Math.floor(100 / perRow);
    const cells = children.map(child => new TableCell({
      width: { size: cellW, type: WidthType.PERCENTAGE },
      borders: cellBorder('C7D2FE', 5),
      shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'ffffff' },
      margins: { top: 80, bottom: 80, left: 80, right: 80 },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 50 }, children: [new TextRun({ text: child.title || '', bold: true, size: 17, color: '312e81' })] }),
        ...((child.sub || []).map(leaf => new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: leaf.title || '', size: 15, color: '475569' })] })))
      ]
    }));
    const rows = [];
    for (let i = 0; i < cells.length; i += perRow) rows.push(new TableRow({ children: cells.slice(i, i + perRow) }));
    els.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }
  return els;
}

async function docxChartImage(svg, widthPx) {
  if (!svg) return null;
  try {
    const png = await svgToPngBuffer(svg);
    const meta = await sharp(png).metadata();
    const h = Math.round(widthPx * ((meta.height || 1) / (meta.width || 1)));
    return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [new ImageRun({ data: png, transformation: { width: widthPx, height: h } })] });
  } catch (err) {
    return null;
  }
}

export async function renderBlockDocx(block) {
  const els = [];
  if (!block) return els;

  const pushTitle = (t) => { if (t) els.push(docxPara(t, { bold: true, size: 19, color: '0f172a' })); };

  switch (block.type) {
    case 'narrative':
      pushTitle(block.title);
      String(block.text || '').split('\n\n').forEach(p => els.push(docxPara(p)));
      break;
    case 'callout': {
      const paras = [];
      if (block.title) paras.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: block.title, bold: true, size: 17, color: '3730a3' })] }));
      paras.push(new Paragraph({ children: [new TextRun({ text: block.text || '', italics: true, size: 17, color: '312e81' })] }));
      els.push(docxBox(paras, { fill: 'EEF2FF', borderColor: 'C7D2FE' }));
      break;
    }
    case 'table':
    case 'financial_table':
      pushTitle(block.title);
      if (block.headers && block.rows) els.push(docxTable(block.headers, block.rows));
      break;
    case 'stat_cards': {
      pushTitle(block.title);
      const table = docxStatCards(block.stats || []);
      if (table) els.push(table);
      break;
    }
    case 'timeline': {
      pushTitle(block.title);
      const table = docxTimeline(block.milestones || []);
      if (table) els.push(table);
      break;
    }
    case 'line_chart': {
      pushTitle(block.title);
      const img = await docxChartImage(buildLineChartSvg(block), 500);
      if (img) els.push(img);
      else els.push(docxTable(['Year', 'Revenue (Rs Cr)', 'Profit (Rs Cr)'], (block.data || []).map(d => [d.year, d.revenue, d.profit])));
      break;
    }
    case 'donut_chart': {
      pushTitle(block.title);
      const img = await docxChartImage(buildDonutChartSvg(block), 460);
      if (img) els.push(img);
      else els.push(docxTable(['Segment', 'Share'], (block.data || []).map(d => [d.label, d.value])));
      break;
    }
    case 'org_chart':
      pushTitle(block.title);
      els.push(...docxOrgChart(block.data));
      break;
    case 'risk_card': {
      const d = block.data || {};
      const paras = [new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `Risk ${d.riskNumber || ''}: ${d.heading || ''}`, bold: true, size: 19, color: '0f172a' })] })];
      if (d.description) paras.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: d.description, size: 17, color: '334155' })] }));
      if (d.impact) paras.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'Impact: ', bold: true, size: 16, color: '991b1b' }), new TextRun({ text: d.impact, size: 16, color: '334155' })] }));
      if (d.mitigation) paras.push(new Paragraph({ children: [new TextRun({ text: 'Mitigation: ', bold: true, size: 16, color: '166534' }), new TextRun({ text: d.mitigation, size: 16, color: '334155' })] }));
      els.push(docxBox(paras, { fill: 'FEF2F2', borderColor: 'FECACA' }));
      break;
    }
    case 'risk_summary_cards':
      pushTitle(block.title);
      els.push(docxTable(['Category', 'Level', 'Description'], (block.data || []).map(d => [d.category, d.level, d.desc])));
      break;
    case 'litigation_table':
      pushTitle(block.title);
      els.push(docxTable(['Ref No.', 'Authority', 'Dispute', 'Amount', 'Status'], (block.cases || []).map(c => [c.refNo, c.authority, c.dispute, c.amount, c.status])));
      break;
    case 'compliance_matrix':
      pushTitle(block.title);
      els.push(docxTable(['Requirement', 'Authority', 'Reference No.', 'Validity'], (block.items || []).map(i => [i.name, i.authority, i.refNo, i.validity])));
      break;
    default:
      if (block.text) els.push(docxPara(block.text));
  }
  return els;
}

export function buildDocxHeaderFooter(compName) {
  const footer = new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' } },
      spacing: { before: 100 },
      children: [
        new TextRun({ text: `Draft Red Herring Prospectus — ${compName}   |   Page `, size: 14, color: '94a3b8' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 14, color: '94a3b8' }),
        new TextRun({ text: ' of ', size: 14, color: '94a3b8' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: '94a3b8' })
      ]
    })]
  });
  return { default: footer };
}

export function renderFrontMatterDocx(ctx) {
  const {
    compName, formerName, cin, regOffice, complianceOfficer, telephone, email, website,
    promoters, companyAct, incYear, freshIssueAmt, ofsShares, ofsAmt, promoterSeller,
    draftDate, brlm, registrar, floorPrice, capPrice, minBidLot, offerOpenDate, offerCloseDate, anchorDate
  } = ctx;

  const boxed = (paragraphs) => new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: [new TableCell({
      borders: cellBorder('0f172a', 14),
      margins: { top: 260, bottom: 260, left: 260, right: 260 },
      children: paragraphs
    })] })]
  });

  const heading = (text, size = 18) => new Paragraph({ spacing: { before: 160, after: 70 }, children: [new TextRun({ text, bold: true, size, color: '0f172a', allCaps: true, font: 'Times New Roman' })] });
  const body = (text, opts = {}) => new Paragraph({ spacing: { after: 50 }, children: [new TextRun({ text, size: 18, color: '1e293b', font: 'Times New Roman', ...opts })] });

  // ── Page 1: Cover Page ──
  const page1 = boxed([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'DRAFT RED HERRING PROSPECTUS', bold: true, size: 30, color: '0f172a', font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: '(This Draft Red Herring Prospectus will be updated upon filing with the RoC)', italics: true, size: 15, color: '64748b', font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [
      new TextRun({ text: `Dated: ${draftDate}   |   Please read Section 32 of the Companies Act, ${companyAct}   |   `, size: 16, bold: true, color: '334155', font: 'Times New Roman' }),
      new TextRun({ text: '100% Book Built Offer', bold: true, size: 16, color: '1e1b4b', font: 'Times New Roman' })
    ]}),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: compName.toUpperCase(), bold: true, size: 34, color: '0f172a', font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `(Originally incorporated as "${formerName}" under the Companies Act, ${companyAct}; converted/renamed to "${compName}" on ${incYear})`, italics: true, size: 14, color: '475569', font: 'Times New Roman' })] }),
    body(`CIN: ${cin}`, { bold: true }),
    body(`Registered & Corporate Office: ${regOffice}`),
    body(`Contact: ${complianceOfficer} | ${telephone} | ${email} | ${website}`),

    heading('Details of the Offer for Sale by Selling Shareholders', 16),
    promoterSeller
      ? docxTable(['Name of Selling Shareholder', 'Type', 'No. of Shares / Amount', 'WAC of Acquisition'], [[promoterSeller, 'Promoter Selling Shareholder', `Up to ${ofsShares} Shares (₹${ofsAmt} Mn)`, '[•]']])
      : docxTable(['Name of Selling Shareholder', 'Type', 'No. of Shares / Amount', 'WAC of Acquisition'], [['NIL — 100% Fresh Issue (No Promoters selling shares under Offer For Sale).', '', '', '']]),

    heading('Statutory & General Risk Disclosures', 16),
    body('RISKS IN RELATION TO THE FIRST OFFER: This being the first public issue of Equity Shares of our Company, there has been no formal market for the Equity Shares. The face value is ₹10 per share. The Floor Price, Cap Price, and Offer Price determined by our Company in consultation with the BRLM should not be taken as indicative of the market price after listing.'),
    body('GENERAL RISK: Investments in equity and equity-related securities involve a degree of risk. Investors should not invest funds they cannot afford to lose. Investors are advised to read the Risk Factors carefully before taking an investment decision.'),
    body("ISSUER'S ABSOLUTE RESPONSIBILITY: Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect."),

    heading('Intermediaries & Bid/Offer Programme', 16),
    body(`Book Running Lead Manager (BRLM): ${brlm}`, { bold: true }),
    body(`Registrar to the Offer: ${registrar}`, { bold: true }),
    body(`BID/OFFER OPENS ON: ${offerOpenDate}   |   BID/OFFER CLOSES ON: ${offerCloseDate}   |   ANCHOR INVESTOR BIDDING DATE: ${anchorDate}`, { bold: true })
  ]);

  // ── Page 2: Issue Details & Allocation ──
  const page2 = boxed([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: compName.toUpperCase(), bold: true, size: 24, color: '0f172a', font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: `CIN: ${cin}  |  Registered Office: ${regOffice}`, italics: true, size: 14, color: '475569', font: 'Times New Roman' })] }),
    body(`Initial Public Offer of up to [•] Equity Shares of face value of ₹10 each for cash at a price of ₹[•] per Equity Share (including a premium of ₹[•] per Equity Share) aggregating up to ₹${freshIssueAmt} Million ("Offer"). The Offer constitutes 100% Fresh Issue; no shares are offered under Offer for Sale (OFS).`, { bold: true }),

    heading('Price Band & Bid Lot Parameters', 16),
    body('FACE VALUE: ₹10 per Equity Share.', { bold: true }),
    body(`PRICE BAND: ₹${floorPrice} to ₹${capPrice} per Equity Share. The Cap Price shall be at least 105% and at most 120% of the Floor Price.`),
    body(`MINIMUM BID LOT: ${minBidLot} Equity Shares and in multiples of ${minBidLot} Equity Shares thereafter.`),
    body('DISSEMINATION: The Price Band, Employee Discount (if any), and Minimum Bid Lot will be advertised in an English national daily, a Hindi national daily, and a regional daily newspaper at least 2 Working Days prior to the Bid/Offer Opening Date.'),

    heading('Offer Structure & Allocation Categories', 16),
    body('1. QUALIFIED INSTITUTIONAL BUYERS (QIB) PORTION: Not more than 50% of the Net Offer shall be available for allocation to QIBs on a proportionate basis. Anchor Investor Portion: up to 60% of the QIB Portion. Mutual Fund Portion: 5% of the Net QIB Portion.'),
    body('2. NON-INSTITUTIONAL INVESTORS (NII) PORTION: Not less than 15% of the Net Offer shall be available for allocation to NIIs.'),
    body('3. RETAIL INDIVIDUAL INVESTORS (RII) PORTION: Not less than 35% of the Net Offer shall be available for allocation to Retail Individual Bidders.'),
    body('4. MANDATORY ASBA & UPI: All Bidders (except Anchor Investors) are mandatorily required to utilize the Application Supported by Blocked Amount (ASBA) process including the UPI mechanism.'),
    new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'Quick response (QR) codes and direct web links directing to this DRHP are available on the front cover page, public announcements, and application forms in accordance with applicable SEBI (ICDR) Regulations.', italics: true, size: 14, color: '64748b', font: 'Times New Roman' })] })
  ]);

  // ── Page 3: Table of Contents ──
  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const tocRows = [
    ['—', 'Cover Page (Issuer Branding, CIN & Statutory Risk Warnings)', '1'],
    ['—', 'Issue Details & Statutory Allocation Structure', '2'],
    ['—', 'Table of Contents', '3'],
    ...DRHP_HIERARCHY.map((sec, secIdx) => [
      `SECTION ${romanNumerals[secIdx] || secIdx + 1}`,
      sec.title.startsWith('SECTION') ? sec.title.replace(/^SECTION\s+[IVX]+\s*[-–—]\s*/i, '') : sec.title,
      '[•]'
    ])
  ];
  const tocTable = docxTable(['Section', 'Main Section & Subsection Title', 'Page No.'], tocRows);

  const page3 = boxed([
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'TABLE OF CONTENTS', bold: true, size: 26, color: '0f172a', font: 'Times New Roman' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: 'Interactive Navigation Page — Section & Subsection Index', italics: true, size: 14, color: '4338ca', font: 'Times New Roman' })] }),
    tocTable,
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [new TextRun({ text: `Generated by IPO Pilot AI — ${draftDate} — This Draft Red Herring Prospectus is subject to review by a SEBI-registered Merchant Banker and Legal Counsel before filing.`, italics: true, size: 13, color: '94a3b8', font: 'Times New Roman' })] })
  ]);

  return [
    page1, new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
    page2, new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true }),
    page3, new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true })
  ];
}

// ── PDF (pdfkit) rendering ────────────────────────────────────────────────────

const TABLE_PAD = 5;

function pdfUsableWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function pdfEnsureSpace(doc, needed) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
    return true;
  }
  return false;
}

function pdfTableColWidths(doc, n) {
  const usable = pdfUsableWidth(doc);
  if (n <= 1) return [usable];
  const first = usable * 0.3;
  const rest = (usable - first) / (n - 1);
  return [first, ...Array(n - 1).fill(rest)];
}

function pdfDrawTable(doc, headers, rows, opts = {}) {
  if (!headers || headers.length === 0) return;
  const colWidths = opts.colWidths || pdfTableColWidths(doc, headers.length);
  const startX = doc.page.margins.left;
  const totalWidth = colWidths.reduce((a, b) => a + b, 0);

  const drawHeaderRow = () => {
    pdfEnsureSpace(doc, 30);
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(8);
    const rowH = Math.max(...headers.map((h, i) => doc.heightOfString(String(h), { width: colWidths[i] - TABLE_PAD * 2 }))) + TABLE_PAD * 2;
    doc.rect(startX, y, totalWidth, rowH).fill('#f1f5f9');
    let x = startX;
    headers.forEach((h, i) => {
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8)
        .text(String(h).toUpperCase(), x + TABLE_PAD, y + TABLE_PAD, { width: colWidths[i] - TABLE_PAD * 2 });
      x += colWidths[i];
    });
    doc.strokeColor('#cbd5e1').lineWidth(0.75);
    x = startX;
    for (let i = 0; i <= headers.length; i++) {
      doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
      x += colWidths[i] || 0;
    }
    doc.moveTo(startX, y).lineTo(startX + totalWidth, y).stroke();
    doc.moveTo(startX, y + rowH).lineTo(startX + totalWidth, y + rowH).stroke();
    doc.y = y + rowH;
  };

  drawHeaderRow();

  rows.forEach(row => {
    if (!Array.isArray(row)) return;
    doc.font('Helvetica').fontSize(8.5);
    const rowH = Math.max(...row.map((c, i) => doc.heightOfString(String(c ?? ''), { width: (colWidths[i] || colWidths[colWidths.length - 1]) - TABLE_PAD * 2 }))) + TABLE_PAD * 2;

    if (pdfEnsureSpace(doc, rowH + 30)) drawHeaderRow();

    const y = doc.y;
    let x = startX;
    row.forEach((cell, i) => {
      const w = colWidths[i] || colWidths[colWidths.length - 1];
      doc.fillColor(i === 0 ? '#0f172a' : '#334155').font(i === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
        .text(String(cell ?? ''), x + TABLE_PAD, y + TABLE_PAD, { width: w - TABLE_PAD * 2 });
      x += w;
    });
    doc.strokeColor('#e2e8f0').lineWidth(0.5);
    x = startX;
    for (let i = 0; i <= row.length; i++) {
      doc.moveTo(x, y).lineTo(x, y + rowH).stroke();
      x += colWidths[i] || colWidths[colWidths.length - 1] || 0;
    }
    doc.moveTo(startX, y + rowH).lineTo(startX + totalWidth, y + rowH).stroke();
    doc.y = y + rowH;
  });

  doc.x = startX;
  doc.moveDown(0.6);
}

function pdfDrawStatCards(doc, stats) {
  if (!stats || stats.length === 0) return;
  const usable = pdfUsableWidth(doc);
  const perRow = stats.length > 2 ? 4 : 2;
  const gap = 8;
  const cardW = (usable - gap * (perRow - 1)) / perRow;
  const cardH = 56;
  const startX = doc.page.margins.left;

  for (let i = 0; i < stats.length; i += perRow) {
    const rowStats = stats.slice(i, i + perRow);
    pdfEnsureSpace(doc, cardH + 10);
    const y = doc.y;
    rowStats.forEach((s, idx) => {
      const x = startX + idx * (cardW + gap);
      doc.roundedRect(x, y, cardW, cardH, 6).lineWidth(0.75).strokeColor('#e2e8f0').stroke();
      doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(6.5).text(String(s.label || '').toUpperCase(), x + 8, y + 8, { width: cardW - 16 });
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(12.5).text(String(s.value || ''), x + 8, y + 23, { width: cardW - 16 });
      if (s.subtext) doc.fillColor('#059669').font('Helvetica-Bold').fontSize(7).text(String(s.subtext), x + 8, y + 41, { width: cardW - 16 });
    });
    doc.y = y + cardH + gap;
  }
  doc.x = startX;
  doc.moveDown(0.4);
}

function pdfDrawLineChart(doc, block) {
  const title = block.title || 'Financial Growth Trend';
  const data = block.data && block.data.length > 0 ? block.data : [];
  if (data.length === 0) return;

  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title).moveDown(0.3);

  const usable = pdfUsableWidth(doc);
  const chartW = Math.min(460, usable);
  const chartH = 165;
  const padding = 34;
  pdfEnsureSpace(doc, chartH + 40);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  const { xForRel, yForRel } = (() => {
    const maxVal = Math.max(...data.map(d => Math.max(Number(d.revenue) || 0, Number(d.profit) || 0))) * 1.15 || 100;
    return {
      xForRel: (i) => padding + (i * (chartW - 2 * padding)) / Math.max(data.length - 1, 1),
      yForRel: (v) => chartH - padding - ((Number(v) || 0) / maxVal) * (chartH - 2 * padding)
    };
  })();
  const xFor = (i) => startX + xForRel(i);
  const yFor = (v) => startY + yForRel(v);

  doc.strokeColor('#e2e8f0').lineWidth(0.5).dash(2, { space: 2 });
  [0.25, 0.5, 0.75, 1].forEach(r => {
    const gy = startY + chartH - padding - r * (chartH - 2 * padding);
    doc.moveTo(startX + padding, gy).lineTo(startX + chartW - padding, gy).stroke();
  });
  doc.undash();

  doc.strokeColor('#4f46e5').lineWidth(2);
  data.forEach((d, i) => {
    const x = xFor(i), y = yFor(d.revenue);
    if (i === 0) doc.moveTo(x, y); else doc.lineTo(x, y);
  });
  doc.stroke();

  doc.strokeColor('#10b981').lineWidth(2);
  data.forEach((d, i) => {
    const x = xFor(i), y = yFor(d.profit);
    if (i === 0) doc.moveTo(x, y); else doc.lineTo(x, y);
  });
  doc.stroke();

  data.forEach((d, i) => {
    const xr = xFor(i), yr = yFor(d.revenue);
    doc.circle(xr, yr, 2.5).fill('#4f46e5');
    doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(6.5).text(`${d.revenue} Cr`, xr - 14, yr - 13, { width: 28, align: 'center' });

    const xp = xFor(i), yp = yFor(d.profit);
    doc.circle(xp, yp, 2).fill('#10b981');
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(6).text(`${d.profit} Cr`, xp - 14, yp + 4, { width: 28, align: 'center' });

    doc.fillColor('#64748b').font('Helvetica').fontSize(6.5).text(String(d.year), xr - 15, startY + chartH - padding + 7, { width: 30, align: 'center' });
  });

  const legendY = startY + chartH + 6;
  doc.circle(startX, legendY + 3, 2.5).fill('#4f46e5');
  doc.fillColor('#4338ca').font('Helvetica-Bold').fontSize(7).text('Revenue (Rs Cr)', startX + 8, legendY);
  doc.circle(startX + 110, legendY + 3, 2.5).fill('#10b981');
  doc.fillColor('#047857').font('Helvetica-Bold').fontSize(7).text('PAT (Rs Cr)', startX + 118, legendY);

  doc.y = legendY + 16;
  doc.x = startX;
  doc.moveDown(0.4);
}

function pdfDrawDonutChart(doc, block) {
  const title = block.title || 'Allocation Breakdown';
  const data = block.data && block.data.length > 0 ? block.data : [];
  if (data.length === 0) return;

  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title).moveDown(0.3);

  const { slices, total } = computeDonutSlices(data);
  const chartH = Math.max(130, slices.length * 26 + 10);
  pdfEnsureSpace(doc, chartH + 20);
  const startX = doc.page.margins.left;
  const startY = doc.y;
  const cx = startX + 65;
  const cy = startY + 65;
  const r = 55;

  slices.forEach(s => {
    doc.path(donutArcPath(cx, cy, r, s.startAngle, s.endAngle)).fill(s.color);
  });
  doc.circle(cx, cy, 32).fill('#ffffff');
  doc.fillColor('#94a3b8').font('Helvetica-Bold').fontSize(6).text('TOTAL', cx - 20, cy - 8, { width: 40, align: 'center' });
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9).text(`${total} Cr`, cx - 25, cy + 2, { width: 50, align: 'center' });

  let ly = startY;
  const legendX = startX + 150;
  slices.forEach(s => {
    doc.rect(legendX, ly + 2, 8, 8).fill(s.color);
    doc.fillColor('#334155').font('Helvetica-Bold').fontSize(7.5).text(`${s.label}`, legendX + 13, ly, { width: 240 });
    doc.fillColor('#64748b').font('Helvetica').fontSize(7).text(`${s.value} (${s.pct}%)`, legendX + 13, ly + 11, { width: 240 });
    ly += 26;
  });

  doc.y = Math.max(startY + chartH, ly) + 8;
  doc.x = startX;
  doc.moveDown(0.4);
}

function pdfDrawOrgChart(doc, block) {
  const title = block.title || 'Executive Management Hierarchy';
  const data = block.data;
  if (!data) return;
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title).moveDown(0.3);

  const usable = pdfUsableWidth(doc);
  const startX = doc.page.margins.left;

  pdfEnsureSpace(doc, 70);
  const rootW = 180, rootH = 26;
  const rootX = startX + (usable - rootW) / 2;
  const rootY = doc.y;
  doc.roundedRect(rootX, rootY, rootW, rootH, 5).fill('#4f46e5');
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8.5).text(data.title || '', rootX + 6, rootY + 8, { width: rootW - 12, align: 'center' });

  const children = data.sub || [];
  if (children.length > 0) {
    const connY1 = rootY + rootH;
    const connY2 = connY1 + 14;
    doc.strokeColor('#a5b4fc').lineWidth(1.5).moveTo(rootX + rootW / 2, connY1).lineTo(rootX + rootW / 2, connY2).stroke();

    const gap = 12;
    const childW = Math.min(220, (usable - gap * (children.length - 1)) / children.length);
    const totalChildW = childW * children.length + gap * (children.length - 1);
    let cx = startX + (usable - totalChildW) / 2;
    const maxLeaves = Math.max(...children.map(c => (c.sub || []).length));
    const childH = 24 + maxLeaves * 12 + 8;

    children.forEach(child => {
      const leaves = child.sub || [];
      doc.roundedRect(cx, connY2, childW, childH, 5).lineWidth(1).fillAndStroke('#ffffff', '#c7d2fe');
      doc.fillColor('#312e81').font('Helvetica-Bold').fontSize(7.5).text(child.title || '', cx + 6, connY2 + 6, { width: childW - 12, align: 'center' });
      let ly = connY2 + 22;
      leaves.forEach(leaf => {
        doc.fillColor('#475569').font('Helvetica').fontSize(7).text(leaf.title || '', cx + 6, ly, { width: childW - 12, align: 'center' });
        ly += 12;
      });
      cx += childW + gap;
    });

    doc.y = connY2 + childH + 16;
  } else {
    doc.y = rootY + rootH + 10;
  }
  doc.x = startX;
  doc.moveDown(0.4);
}

function pdfDrawTimeline(doc, block) {
  const title = block.title || 'Timeline';
  const milestones = block.milestones || [];
  if (milestones.length === 0) return;
  doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(title).moveDown(0.3);

  const usable = pdfUsableWidth(doc);
  const lineX = doc.page.margins.left + 6;
  const cardX = lineX + 16;
  const cardW = usable - 16;

  let lineTopY = doc.y;
  const circles = [];

  milestones.forEach(m => {
    const detailH = doc.font('Helvetica').fontSize(7.5).heightOfString(m.detail || '', { width: cardW - 16 });
    const cardH = 34 + detailH;
    pdfEnsureSpace(doc, cardH + 14);
    const y = doc.y;

    doc.roundedRect(cardX, y, cardW, cardH, 5).lineWidth(0.75).strokeColor('#e2e8f0').stroke();
    doc.fillColor('#4f46e5').font('Helvetica-Bold').fontSize(7.5).text(String(m.year || ''), cardX + 8, y + 6);
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8).text(String(m.event || ''), cardX + 8, y + 17, { width: cardW - 16 });
    doc.fillColor('#475569').font('Helvetica').fontSize(7.5).text(String(m.detail || ''), cardX + 8, y + 29, { width: cardW - 16 });

    circles.push(y + 6);
    doc.y = y + cardH + 10;
  });

  doc.strokeColor('#c7d2fe').lineWidth(1.5).moveTo(lineX, lineTopY).lineTo(lineX, doc.y - 10).stroke();
  circles.forEach(cyPos => doc.circle(lineX, cyPos, 3.5).lineWidth(1.5).fillAndStroke('#ffffff', '#4f46e5'));

  doc.x = doc.page.margins.left;
  doc.moveDown(0.4);
}

function pdfDrawRiskCard(doc, block) {
  const d = block.data || {};
  const usable = pdfUsableWidth(doc);
  const startX = doc.page.margins.left;

  doc.font('Helvetica').fontSize(9);
  const descH = d.description ? doc.heightOfString(d.description, { width: usable - 20 }) : 0;
  const impactH = d.impact ? doc.heightOfString(`Impact: ${d.impact}`, { width: usable - 20 }) : 0;
  const mitH = d.mitigation ? doc.heightOfString(`Mitigation: ${d.mitigation}`, { width: usable - 20 }) : 0;
  const cardH = 24 + descH + (impactH ? impactH + 4 : 0) + (mitH ? mitH + 4 : 0) + 12;

  pdfEnsureSpace(doc, cardH + 10);
  const y = doc.y;

  doc.rect(startX + 3, y, usable - 3, cardH).lineWidth(0.75).fillAndStroke('#fef2f2', '#fecaca');
  doc.rect(startX, y, 3, cardH).fill('#dc2626');

  let cy = y + 8;
  doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9.5).text(`Risk ${d.riskNumber || ''}: ${d.heading || ''}`, startX + 12, cy, { width: usable - 24 });
  cy += 16;
  if (d.description) { doc.fillColor('#334155').font('Helvetica').fontSize(9).text(d.description, startX + 12, cy, { width: usable - 24, align: 'justify' }); cy += descH + 4; }
  if (d.impact) { doc.fillColor('#991b1b').font('Helvetica-Bold').fontSize(8.5).text('Impact: ', startX + 12, cy, { continued: true }); doc.fillColor('#334155').font('Helvetica').text(d.impact); cy += impactH + 4; }
  if (d.mitigation) { doc.fillColor('#166534').font('Helvetica-Bold').fontSize(8.5).text('Mitigation: ', startX + 12, cy, { continued: true }); doc.fillColor('#334155').font('Helvetica').text(d.mitigation); }

  doc.y = y + cardH + 10;
  doc.x = startX;
}

function pdfDrawCallout(doc, block) {
  const usable = pdfUsableWidth(doc);
  const startX = doc.page.margins.left;
  doc.font('Helvetica').fontSize(9);
  const bodyH = doc.heightOfString(block.text || '', { width: usable - 24 });
  const titleH = block.title ? 14 : 0;
  const cardH = 16 + titleH + bodyH;
  pdfEnsureSpace(doc, cardH + 10);
  const y = doc.y;
  doc.rect(startX + 3, y, usable - 3, cardH).lineWidth(0.75).fillAndStroke('#eef2ff', '#c7d2fe');
  doc.rect(startX, y, 3, cardH).fill('#4f46e5');
  let cy = y + 8;
  if (block.title) { doc.fillColor('#3730a3').font('Helvetica-Bold').fontSize(8.5).text(block.title, startX + 12, cy, { width: usable - 24 }); cy += titleH; }
  doc.fillColor('#312e81').font('Helvetica-Oblique').fontSize(9).text(block.text || '', startX + 12, cy, { width: usable - 24, align: 'justify' });
  doc.y = y + cardH + 10;
  doc.x = startX;
}

export function renderBlockPdf(doc, block) {
  if (!block) return;

  const title = (t) => { if (t) doc.fontSize(10.5).font('Helvetica-Bold').fillColor('#0f172a').text(t).moveDown(0.3); };

  switch (block.type) {
    case 'narrative':
      title(block.title);
      String(block.text || '').split('\n\n').forEach(p => {
        doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(p, { align: 'justify' }).moveDown(0.4);
      });
      break;
    case 'callout':
      pdfDrawCallout(doc, block);
      break;
    case 'table':
    case 'financial_table':
      title(block.title);
      if (block.headers && block.rows) pdfDrawTable(doc, block.headers, block.rows);
      break;
    case 'stat_cards':
      title(block.title);
      pdfDrawStatCards(doc, block.stats || []);
      break;
    case 'timeline':
      pdfDrawTimeline(doc, block);
      break;
    case 'line_chart':
      pdfDrawLineChart(doc, block);
      break;
    case 'donut_chart':
      pdfDrawDonutChart(doc, block);
      break;
    case 'org_chart':
      pdfDrawOrgChart(doc, block);
      break;
    case 'risk_card':
      pdfDrawRiskCard(doc, block);
      break;
    case 'risk_summary_cards':
      title(block.title);
      pdfDrawTable(doc, ['Category', 'Level', 'Description'], (block.data || []).map(d => [d.category, d.level, d.desc]));
      break;
    case 'litigation_table':
      title(block.title);
      pdfDrawTable(doc, ['Ref No.', 'Authority', 'Dispute', 'Amount', 'Status'], (block.cases || []).map(c => [c.refNo, c.authority, c.dispute, c.amount, c.status]));
      break;
    case 'compliance_matrix':
      title(block.title);
      pdfDrawTable(doc, ['Requirement', 'Authority', 'Reference No.', 'Validity'], (block.items || []).map(i => [i.name, i.authority, i.refNo, i.validity]));
      break;
    default:
      if (block.text) doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(block.text, { align: 'justify' }).moveDown(0.4);
  }
}

export function renderFrontMatterPdf(doc, ctx) {
  const {
    compName, formerName, cin, regOffice, complianceOfficer, telephone, email, website,
    promoters, companyAct, incYear, freshIssueAmt, ofsShares, ofsAmt, promoterSeller,
    draftDate, brlm, registrar, floorPrice, capPrice, minBidLot, offerOpenDate, offerCloseDate, anchorDate
  } = ctx;

  const usable = pdfUsableWidth(doc);
  const startX = doc.page.margins.left;

  const drawPageBorder = () => {
    doc.rect(startX - 4, doc.page.margins.top - 4, usable + 8, doc.page.height - doc.page.margins.top - doc.page.margins.bottom + 8).lineWidth(1.5).strokeColor('#0f172a').stroke();
    doc.y = doc.page.margins.top + 10;
  };

  const sub = (text, size = 10) => { doc.fontSize(size).font('Times-Bold').fillColor('#0f172a').text(text.toUpperCase(), { underline: false }).moveDown(0.2); };
  const para = (text, opts = {}) => { doc.fontSize(9).font(opts.bold ? 'Times-Bold' : 'Times-Roman').fillColor('#1e293b').text(text, { align: 'justify' }).moveDown(0.3); };

  // ── Page 1: Cover ──
  drawPageBorder();
  doc.fontSize(17).font('Times-Bold').fillColor('#0f172a').text('DRAFT RED HERRING PROSPECTUS', { align: 'center' }).moveDown(0.1);
  doc.fontSize(8.5).font('Times-Italic').fillColor('#64748b').text('(This Draft Red Herring Prospectus will be updated upon filing with the RoC)', { align: 'center' }).moveDown(0.3);
  doc.fontSize(9).font('Times-Bold').fillColor('#334155').text(`Dated: ${draftDate}   |   Please read Section 32 of the Companies Act, ${companyAct}   |   100% Book Built Offer`, { align: 'center' }).moveDown(0.5);
  doc.fontSize(19).font('Times-Bold').fillColor('#0f172a').text(compName.toUpperCase(), { align: 'center' }).moveDown(0.1);
  doc.fontSize(8).font('Times-Italic').fillColor('#475569').text(`(Originally incorporated as "${formerName}" under the Companies Act, ${companyAct}; converted/renamed to "${compName}" on ${incYear})`, { align: 'center' }).moveDown(0.4);
  para(`CIN: ${cin}`, { bold: true });
  para(`Registered & Corporate Office: ${regOffice}`);
  para(`Contact: ${complianceOfficer} | ${telephone} | ${email} | ${website}`);

  sub('Details of the Offer for Sale by Selling Shareholders');
  if (promoterSeller) {
    pdfDrawTable(doc, ['Name of Selling Shareholder', 'Type', 'No. of Shares / Amount', 'WAC'], [[promoterSeller, 'Promoter Selling Shareholder', `Up to ${ofsShares} Shares (₹${ofsAmt} Mn)`, '[•]']]);
  } else {
    pdfDrawTable(doc, ['Name of Selling Shareholder', 'Type', 'No. of Shares / Amount', 'WAC'], [['NIL — 100% Fresh Issue', '—', '—', '—']]);
  }

  sub('Statutory & General Risk Disclosures');
  para('RISKS IN RELATION TO THE FIRST OFFER: This being the first public issue of Equity Shares of our Company, there has been no formal market for the Equity Shares. The face value is ₹10 per share. The Floor Price, Cap Price, and Offer Price determined by our Company in consultation with the BRLM should not be taken as indicative of the market price after listing.');
  para('GENERAL RISK: Investments in equity and equity-related securities involve a degree of risk. Investors should not invest funds they cannot afford to lose. Investors are advised to read the Risk Factors carefully before taking an investment decision.');
  para("ISSUER'S ABSOLUTE RESPONSIBILITY: Our Company accepts full responsibility for confirming that this DRHP contains all material information and is true, correct, and not misleading in any material respect.");

  sub('Intermediaries & Bid/Offer Programme');
  para(`Book Running Lead Manager (BRLM): ${brlm}`, { bold: true });
  para(`Registrar to the Offer: ${registrar}`, { bold: true });
  para(`BID/OFFER OPENS ON: ${offerOpenDate}   |   BID/OFFER CLOSES ON: ${offerCloseDate}   |   ANCHOR INVESTOR BIDDING DATE: ${anchorDate}`, { bold: true });

  // ── Page 2: Issue Details & Allocation ──
  doc.addPage();
  drawPageBorder();
  doc.fontSize(14).font('Times-Bold').fillColor('#0f172a').text(compName.toUpperCase(), { align: 'center' }).moveDown(0.1);
  doc.fontSize(8).font('Times-Italic').fillColor('#475569').text(`CIN: ${cin}  |  Registered Office: ${regOffice}`, { align: 'center' }).moveDown(0.4);
  para(`Initial Public Offer of up to [•] Equity Shares of face value of ₹10 each for cash at a price of ₹[•] per Equity Share (including a premium of ₹[•] per Equity Share) aggregating up to ₹${freshIssueAmt} Million ("Offer"). The Offer constitutes 100% Fresh Issue; no shares are offered under Offer for Sale (OFS).`, { bold: true });

  sub('Price Band & Bid Lot Parameters');
  para('FACE VALUE: ₹10 per Equity Share.', { bold: true });
  para(`PRICE BAND: ₹${floorPrice} to ₹${capPrice} per Equity Share. The Cap Price shall be at least 105% and at most 120% of the Floor Price.`);
  para(`MINIMUM BID LOT: ${minBidLot} Equity Shares and in multiples of ${minBidLot} Equity Shares thereafter.`);
  para('DISSEMINATION: The Price Band, Employee Discount (if any), and Minimum Bid Lot will be advertised in an English national daily, a Hindi national daily, and a regional daily newspaper at least 2 Working Days prior to the Bid/Offer Opening Date.');

  sub('Offer Structure & Allocation Categories');
  para('1. QUALIFIED INSTITUTIONAL BUYERS (QIB) PORTION: Not more than 50% of the Net Offer shall be available for allocation to QIBs on a proportionate basis. Anchor Investor Portion: up to 60% of the QIB Portion. Mutual Fund Portion: 5% of the Net QIB Portion.');
  para('2. NON-INSTITUTIONAL INVESTORS (NII) PORTION: Not less than 15% of the Net Offer shall be available for allocation to NIIs.');
  para('3. RETAIL INDIVIDUAL INVESTORS (RII) PORTION: Not less than 35% of the Net Offer shall be available for allocation to Retail Individual Bidders.');
  para('4. MANDATORY ASBA & UPI: All Bidders (except Anchor Investors) are mandatorily required to utilize the Application Supported by Blocked Amount (ASBA) process including the UPI mechanism.');
  doc.fontSize(8).font('Times-Italic').fillColor('#64748b').text('Quick response (QR) codes and direct web links directing to this DRHP are available on the front cover page, public announcements, and application forms in accordance with applicable SEBI (ICDR) Regulations.', { align: 'justify' });

  // ── Page 3: Table of Contents ──
  doc.addPage();
  drawPageBorder();
  doc.fontSize(16).font('Times-Bold').fillColor('#0f172a').text('TABLE OF CONTENTS', { align: 'center' }).moveDown(0.1);
  doc.fontSize(8.5).font('Times-Italic').fillColor('#4338ca').text('Section & Subsection Index', { align: 'center' }).moveDown(0.4);

  const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  const tocRows = [
    ['—', 'Cover Page (Issuer Branding, CIN & Statutory Risk Warnings)', '1'],
    ['—', 'Issue Details & Statutory Allocation Structure', '2'],
    ['—', 'Table of Contents', '3'],
    ...DRHP_HIERARCHY.map((sec, secIdx) => [
      `SECTION ${romanNumerals[secIdx] || secIdx + 1}`,
      sec.title.startsWith('SECTION') ? sec.title.replace(/^SECTION\s+[IVX]+\s*[-–—]\s*/i, '') : sec.title,
      '[•]'
    ])
  ];
  pdfDrawTable(doc, ['Section', 'Main Section & Subsection Title', 'Page No.'], tocRows);

  doc.moveDown(0.6);
  doc.fontSize(7.5).font('Times-Italic').fillColor('#94a3b8').text(`Generated by IPO Pilot AI — ${draftDate} — This Draft Red Herring Prospectus is subject to review by a SEBI-registered Merchant Banker and Legal Counsel before filing.`, { align: 'center' });

  doc.addPage();
}

export function pdfAddFooters(doc, compName) {
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(range.start + i);
    // The footer sits inside the reserved bottom margin, past the normal content
    // area — pdfkit's text() treats that as an overflow and silently inserts a
    // new blank page unless the bottom margin is zeroed out for this one call.
    const originalBottomMargin = doc.page.margins.bottom;
    const bottom = doc.page.height - originalBottomMargin + 18;
    doc.page.margins.bottom = 0;
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
      .text(`Draft Red Herring Prospectus - ${compName}   |   Page ${i + 1} of ${total}`, doc.page.margins.left, bottom, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
        lineBreak: false
      });
    doc.page.margins.bottom = originalBottomMargin;
  }
}
