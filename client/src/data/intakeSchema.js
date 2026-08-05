// Shared intake schema — single source of truth for the 11 SME intake modules.
// Consumed by IntakeForm.jsx (questionnaire), Dashboard.jsx (completeness heatmap), and AI draft generators.
import {
  Building,
  Briefcase,
  Users,
  Target,
  PieChart,
  AlertCircle,
  Scale,
  ShieldAlert,
  BookOpen
} from 'lucide-react';

export const steps = [
  { key: 'company_details', label: 'Company Details', icon: Building },
  { key: 'business_overview', label: 'Business Overview', icon: Briefcase },
  { key: 'promoters', label: 'Promoters & Directors', icon: Users },
  { key: 'capital_structure', label: 'Capital Structure', icon: PieChart },
  { key: 'financials', label: 'Financials Summary', icon: PieChart },
  { key: 'objects', label: 'Objects of the Issue', icon: Target },
  { key: 'rpt', label: 'Related Party Transactions', icon: Users },
  { key: 'litigation', label: 'Litigation & Disputes', icon: AlertCircle },
  { key: 'legal_compliance', label: 'Legal & Compliance', icon: Scale },
  { key: 'risk_information', label: 'Risk Information', icon: ShieldAlert },
  { key: 'other_disclosures', label: 'Other Disclosures', icon: BookOpen }
];

export const stepQuestions = {
  company_details: [
    { name: 'legal_name', label: 'Company Legal Name', type: 'text', placeholder: 'e.g., Aarav Precision Engineering Pvt Ltd', why: 'Must match incorporation certificate exactly.', example: 'Aarav Precision Engineering Pvt Ltd' },
    { name: 'cin', label: 'Corporate Identification Number (CIN)', type: 'text', placeholder: '21-digit alphanumeric CIN', why: 'Identifies corporate registration with MCA.', example: 'U29220MH2015PTC263456' },
    { name: 'pan', label: 'Company PAN', type: 'text', placeholder: '10-character PAN', why: 'Taxation ID required for regulatory disclosures.', example: 'AAACA1234F', optional: true },
    { name: 'gstin', label: 'GSTIN', type: 'text', placeholder: '15-character GSTIN', why: 'Verifies tax registration across operating states.', example: '27AAACA1234F1Z5', optional: true },
    { name: 'incorporation_date', label: 'Date of Incorporation', type: 'date', why: 'Establishes track record requirements (usually 3 years).', example: '2015-04-12' },
    { name: 'website', label: 'Company Website', type: 'text', placeholder: 'https://...', why: 'Public information portal for prospective investors.', example: 'https://www.aaravprecision.com', optional: true },
    { name: 'email', label: 'Corporate Email', type: 'text', placeholder: 'contact@...', why: 'Official correspondence contact.', example: 'contact@aaravprecision.com', optional: true },
    { name: 'phone', label: 'Contact Phone Number', type: 'text', placeholder: '+91...', why: 'Investor relations and secretarial contact line.', example: '+91 22 2845 9900', optional: true },
    { name: 'industry_type', label: 'Industry Sector', type: 'text', placeholder: 'e.g., Precision Engineering', why: 'Directs exchange board sector classification.', example: 'Precision Engineering & Manufacturing' },
    { name: 'sub_industry', label: 'Sub-Industry / Niche', type: 'text', placeholder: 'e.g., CNC Automotive Components', why: 'Refines competitive positioning.', example: 'Automotive & Industrial Machine Parts', optional: true },
    { name: 'nic_code', label: 'NIC Code', type: 'text', placeholder: '5-digit NIC classification code', why: 'National Industrial Classification identifier.', example: '28112', optional: true },
    { name: 'company_type', label: 'Company Structure', type: 'text', placeholder: 'Private Limited / Public Limited', why: 'Determines conversion requirements prior to IPO.', example: 'Private Limited Company', optional: true },
    { name: 'registered_office', label: 'Registered Office Address', type: 'textarea', placeholder: 'Full address', why: 'Determines jurisdictional courts and state bounds.', example: 'W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204' },
    { name: 'corporate_office', label: 'Corporate Office Address', type: 'textarea', placeholder: 'Corporate HQ address if different', why: 'Key administrative location for due diligence.', example: 'Unit 402, Trade Center, BKC, Mumbai - 400051', optional: true },
    { name: 'factory_address', label: 'Primary Factory Address', type: 'textarea', placeholder: 'Manufacturing unit address', why: 'Primary operational location for physical site audit.', example: 'W-45 & W-46, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204', optional: true },
    { name: 'branches', label: 'Branch Offices & Sales Outlets', type: 'repeatable', placeholder: 'Add branch location', why: 'Documents distribution network geographic footprint.', itemFields: [{ name: 'location', label: 'Location/City' }, { name: 'address', label: 'Branch Address' }], optional: true },
    { name: 'warehouses', label: 'Warehouses & Storage Hubs', type: 'repeatable', placeholder: 'Add warehouse location', why: 'Identifies inventory storage locations.', itemFields: [{ name: 'location', label: 'Location/City' }, { name: 'capacity', label: 'Storage Area / Capacity' }], optional: true },
    { name: 'authorized_capital', label: 'Authorized Capital (INR)', type: 'text', placeholder: 'e.g. 20,000,000 INR', why: 'Defines ceiling for share capital expansion.', example: '20,000,000 INR', optional: true },
    { name: 'paid_up_capital', label: 'Paid-Up Capital (INR)', type: 'text', placeholder: 'e.g. 10,000,000 INR', why: 'Actual capital issued and paid up by shareholders.', example: '10,000,000 INR', optional: true },
    { name: 'proposed_issue_size', label: 'Proposed Issue Size (INR)', type: 'text', placeholder: 'e.g. 50,000,000 INR', why: 'Total public issue capital target.', example: '50,000,000 INR', optional: true },
    { name: 'proposed_exchange', label: 'Target Stock Exchange Board', type: 'select', options: [{ value: 'bse_sme', label: 'BSE SME' }, { value: 'nse_emerge', label: 'NSE Emerge' }, { value: 'mainboard', label: 'Main Board (BSE/NSE)' }], why: 'Dictates specific listing compliance rules.', example: 'nse_emerge', optional: true }
  ],

  business_overview: [
    { name: 'company_history', label: 'Business History / Company History', type: 'textarea', placeholder: 'Describe the inception, background, and evolution of the company...', why: 'SEBI requires historical evolution and milestones of the enterprise.', example: 'Incorporated in 2015 as a private limited company, starting with a single workshop in Dombivli.' },
    { name: 'vision', label: 'Vision', type: 'textarea', placeholder: 'Company long-term vision statement...', why: 'Establishes strategic orientation for prospective investors.', example: 'To become a globally recognized precision engineering solutions provider.' },
    { name: 'mission', label: 'Mission', type: 'textarea', placeholder: 'Company mission statement...', why: 'Outlines core operational purpose and corporate values.', example: 'Delivering zero-defect precision components with maximum efficiency and customer trust.' },
    { name: 'manufacturing_plants', label: 'Manufacturing Plants / Production Locations', type: 'textarea', placeholder: 'Details of manufacturing units, land area, and locations...', why: 'Details physical infrastructure and plant footprint.', example: 'Unit 1: 15,000 sq ft facility at MIDC Dombivli East, Thane, Maharashtra.' },
    { name: 'installed_capacity', label: 'Installed Production Capacity', type: 'text', placeholder: 'e.g., 500,000 units per annum', why: 'SEBI ICDR mandatory capacity disclosure.', example: '500,000 units per annum across 20 CNC/VMC lines.' },
    { name: 'capacity_utilization_pct', label: 'Capacity Utilization (%)', type: 'number', placeholder: 'e.g., 78.5', why: 'Measures operational efficiency and expansion headroom.', example: '78.5' },
    { name: 'distribution_network', label: 'Distribution Network', type: 'textarea', placeholder: 'Sales channels, logistics hubs, and distribution network details...', why: 'Explains go-to-market reach and logistics channel.', example: 'Direct B2B supply network with 3 regional logistics hubs in Maharashtra and Gujarat.' },
    { name: 'export_countries', label: 'Export Markets / Countries Served', type: 'text', placeholder: 'Countries exported to...', why: 'Identifies international revenue exposure.', example: 'UAE, Germany, Vietnam', optional: true },
    { name: 'key_certifications', label: 'Key Certifications (ISO, IATF, etc.)', type: 'textarea', placeholder: 'List ISO, IATF, AS9100, and statutory quality certifications...', why: 'Verifies quality standards and regulatory compliance.', example: 'ISO 9001:2015, IATF 16949:2016, and AS9100D Aerospace Certification.' },
    { name: 'patents_ip', label: 'Patents / Intellectual Property', type: 'textarea', placeholder: 'Registered trademarks, patents, designs, or proprietary IP...', why: 'Documents proprietary technology assets.', example: '2 registered process patents for high-speed CNC fixture alignment; Trademark #3940192.' },
    { name: 'research_development', label: 'Research & Development (R&D)', type: 'textarea', placeholder: 'R&D facilities, team size, spend, and ongoing innovation initiatives...', why: 'Demonstrates innovation focus and technical differentiation.', example: 'In-house R&D team of 6 design engineers equipped with CAD/CAM simulation tools.' },
    { name: 'business_timeline', label: 'Business Timeline / Key Milestones', type: 'textarea', placeholder: 'Key corporate milestones with years...', why: 'Discloses historical achievements and growth trajectory.', example: '2015: Inception; 2018: ISO certification; 2021: First direct export to UAE; 2024: Expanded 5-axis VMC line.' },
    { name: 'sustainability_esg', label: 'Sustainability / ESG Initiatives', type: 'textarea', placeholder: 'Environmental compliance, waste recycling, renewable energy, ESG initiatives...', why: 'Highlight environmental and social governance commitments.' }
  ],

  promoters: [
    { name: 'promoters_list', label: 'Promoter Profiles & Experience', type: 'textarea', placeholder: 'Name, qualification, experience...', why: 'SEBI mandates detailing key management capability.', example: 'Aarav Mehta (Managing Director, 18 years experience in tool manufacturing) and Rohan Mehta (Director of Operations, 15 years experience in precision machining).' },
    { name: 'promoters_repeatable', label: 'Promoters Registry (Multi-Entry)', type: 'repeatable', placeholder: 'Add Promoter Record', why: 'Detailed promoter regulatory registry.', itemFields: [{ name: 'name', label: 'Full Name' }, { name: 'din', label: 'DIN Number' }, { name: 'pan', label: 'PAN' }, { name: 'aadhaar', label: 'Aadhaar (Private / Masked)', sensitive: true }, { name: 'shareholding_pct', label: 'Shareholding %' }], optional: true },
    { name: 'directors', label: 'Board of Directors composition', type: 'textarea', placeholder: 'Full names of all directors...', why: 'Identifies board structure and independent governance.', example: 'Aarav Mehta, Rohan Mehta, and Mrs. Sunita Mehta (Non-Executive Director).' },
    { name: 'directors_repeatable', label: 'Board Members (Multi-Entry)', type: 'repeatable', placeholder: 'Add Director Record', why: 'Details board composition by governance category.', itemFields: [{ name: 'name', label: 'Director Name' }, { name: 'category', label: 'Category (Executive / Independent / Nominee)' }, { name: 'din', label: 'DIN' }, { name: 'experience', label: 'Years Experience' }], optional: true },
    { name: 'kmp_details', label: 'Key Management Personnel (KMP)', type: 'textarea', placeholder: 'CEO, CFO, CS details...', why: 'SEBI required disclosure for key executives.', example: 'CEO: Aarav Mehta; CFO: Vikram Shah (FCA, 14 yrs exp); CS: Ananya Deshmukh (ACS).', optional: true }
  ],

  capital_structure: [
    { name: 'total_shares', label: 'Total Pre-IPO Shares', type: 'number', placeholder: 'e.g. 1000000', why: 'Establishes capitalization denominator.', example: '1000000' },
    { name: 'promoter_holding_pct', label: 'Promoter Shareholding Percentage (%)', type: 'number', placeholder: 'e.g. 65', why: 'Discrepancy test: Stating 65% here while Cap Table document registers 62% will trigger a consistency alert.', example: '62' },
    { name: 'shareholders', label: 'Key Shareholding Pattern Details', type: 'textarea', placeholder: 'Major shareholders list...', why: 'Identifies control blocks.', example: 'Aarav Mehta: 620,000 shares (62%), Rohan Mehta: 350,000 shares (35%), Other minority: 30,000 shares (3%).' },
    { name: 'past_fundraising', label: 'Past Fundraising & Bonus History', type: 'textarea', placeholder: 'History of bonus shares, rights, splits...', why: 'Track record of capital build-up.', example: 'Bonus issue 1:1 in March 2022; Private placement of 50,000 shares at Rs 100 in FY24.', optional: true },
    { name: 'lock_in_details', label: 'Promoter Lock-In Disclosures', type: 'textarea', placeholder: 'Minimum promoter contribution lock-in details...', why: 'SEBI ICDR mandates 3-year lock-in for 20% minimum promoter contribution.', example: '200,000 shares (20% post-issue capital) locked in for 3 years from allotment date.', optional: true }
  ],

  financials: [
    { name: 'revenue_fy25', label: 'FY25 Revenue (INR)', type: 'number', placeholder: 'e.g. 125000000', why: 'Discrepancy test: Stating 125,000,000 (12.5 Cr) while Audited Financials shows 11.8 Cr will trigger an alert.', example: '118000000' },
    { name: 'revenue_fy24', label: 'FY24 Revenue (INR)', type: 'number', placeholder: 'e.g. 95000000', why: 'Demonstrates revenue trajectory.', example: '95000000' },
    { name: 'revenue_fy23', label: 'FY23 Revenue (INR)', type: 'number', placeholder: 'e.g. 72000000', why: 'Establishes three year growth record.', example: '72000000' },
    { name: 'profit_fy25', label: 'FY25 Profit After Tax (INR)', type: 'number', placeholder: 'e.g. 11000000', why: 'Proves profit track record required for Emerge boards.', example: '11000000' },
    { name: 'profit_fy24', label: 'FY24 Profit After Tax (INR)', type: 'number', placeholder: 'e.g. 7500000', why: 'Proves 3-year profit history.', example: '7500000', optional: true },
    { name: 'profit_fy23', label: 'FY23 Profit After Tax (INR)', type: 'number', placeholder: 'e.g. 4200000', why: 'Proves 3-year profit history.', example: '4200000', optional: true },
    { name: 'total_debt', label: 'Total Outstanding Borrowings (INR)', type: 'number', placeholder: 'e.g. 25000000', why: 'Used to measure capital leverage ratio.', example: '25000000' },
    { name: 'ebitda_margin', label: 'EBITDA Margin (%)', type: 'text', placeholder: 'e.g. 18.5%', why: 'Core operating profitability metric.', example: '18.5%', optional: true },
    { name: 'pat_margin', label: 'PAT Margin (%)', type: 'text', placeholder: 'e.g. 9.3%', why: 'Net profit margin percentage.', example: '9.3%', optional: true }
  ],

  objects: [
    { name: 'amount_to_raise', label: 'Proposed Amount to Raise (INR)', type: 'number', placeholder: 'e.g., 50000000', why: 'Sets total capital size of the public issue.', example: '50000000' },
    { name: 'purpose', label: 'Utilization of Net Proceeds', type: 'textarea', placeholder: 'Acquisition of machines, debt repayment...', why: 'Investors must know exactly what their money funding.', example: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.' },
    { name: 'timeline', label: 'Deployment Timeline (SEBI Mandatory)', type: 'textarea', placeholder: 'e.g. FY27: 3 Cr, FY28: 2 Cr...', why: 'Crucial timeline field. Leaving this blank flags a Red disclosure gap on the dashboard!', example: 'FY27: 35,000,000 INR for VMC purchases; FY28: 15,000,000 INR for working capital requirements.' }
  ],

  rpt: [
    { name: 'has_rpt', label: 'Any Related Party Transactions?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Conflict checks are heavily scrutinized by regulators.', example: 'yes' },
    { name: 'rpt_list', label: 'Related Party Transactions Registry', type: 'repeatable', placeholder: 'Add Related Party Transaction', why: 'Multi-entry registry for related party agreements.', itemFields: [{ name: 'party_name', label: 'Related Party Name' }, { name: 'relation_type', label: 'Relationship' }, { name: 'transaction_nature', label: 'Nature (Rent/Supply/Loan)' }, { name: 'amount', label: 'Amount (INR)' }], dependsOn: 'has_rpt', optional: true },
    { name: 'rpt_details', label: 'Describe Related Party Transactions Summary', type: 'textarea', placeholder: 'Rent details, loans, supply arrangements...', why: 'Only required if related transactions are active.', example: 'The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm\'s length basis verified by local valuer report.', dependsOn: 'has_rpt' }
  ],

  litigation: [
    { name: 'has_litigation', label: 'Are there pending litigations against Promoter/Company?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Material litigations must be fully declared.', example: 'yes' },
    { name: 'litigation_list', label: 'Litigation Cases Registry', type: 'repeatable', placeholder: 'Add Legal Case Entry', why: 'Multi-entry list for pending legal proceedings.', itemFields: [{ name: 'case_type', label: 'Case Type (Tax/Civil/Criminal/Labour)' }, { name: 'status', label: 'Current Status' }, { name: 'amount_involved', label: 'Amount Involved (INR)' }, { name: 'brief_description', label: 'Brief Summary' }], dependsOn: 'has_litigation', optional: true },
    { name: 'litigation_details', label: 'Details of Pending Litigations & Demands Summary', type: 'textarea', placeholder: 'Case references, forums, amounts...', why: 'Direct impact on litigation risks chapter.', example: 'An income tax appeal is pending before the Commissioner of Income Tax (Appeals), Mumbai, regarding disallowance of depreciation on tools for FY22, involving a tax demand of 1,200,000 INR. The company has deposited 20% of the demand as per standard stay conditions.', dependsOn: 'has_litigation' }
  ],

  legal_compliance: [
    { name: 'roc_compliance', label: 'ROC & MCA Filings Status', type: 'text', placeholder: 'e.g. All annual returns filed up to FY25', why: 'Confirms corporate compliance with Registrar of Companies.', example: 'All annual returns and financial statements filed up to FY25.', optional: true },
    { name: 'gst_compliance', label: 'GST Filings & Returns Status', type: 'text', placeholder: 'e.g. GSTR-3B & GSTR-1 regular', why: 'Proves statutory indirect tax compliance.', example: 'GSTR-3B and GSTR-1 filed up to date with zero tax defaults.', optional: true },
    { name: 'pf_esi_compliance', label: 'PF & ESI Registrations & Dues', type: 'text', placeholder: 'PF/ESI code and remittance status', why: 'Confirms labor law compliance.', example: 'EPFO Code MH/THN/104592; all monthly contributions deposited.', optional: true },
    { name: 'factory_license', label: 'Factory License Details & Validity', type: 'text', placeholder: 'License number and expiry date', why: 'Required for operational legality of plants.', example: 'Factory License # 45920-THN valid through Dec 2028.', optional: true },
    { name: 'pollution_noc', label: 'Pollution Control Board Consent (NOC)', type: 'text', placeholder: 'Consent to Operate (CTO) status', why: 'Environmental compliance certificate.', example: 'MPCB Consent to Operate (Orange Category) valid till March 2029.', optional: true },
    { name: 'fire_noc', label: 'Fire Safety NOC', type: 'text', placeholder: 'Fire NOC reference & validity', why: 'Industrial safety compliance.', example: 'Thane Municipal Fire NOC # 112/2025 valid till Oct 2027.', optional: true },
    { name: 'auditor_details', label: 'Statutory Auditor Details', type: 'textarea', placeholder: 'Firm Name, FRN, Partner Name, Membership No', why: 'Independent auditor details required in DRHP.', example: 'M/s Shah & Associates, Chartered Accountants (FRN: 104920W), Partner: CA Rajesh Shah (M.No: 045912).', optional: true },
    { name: 'merchant_banker_details', label: 'Lead Merchant Banker / Lead Manager', type: 'text', placeholder: 'Name of SEBI registered Banker', why: 'Lead manager underwriting the SME IPO.', example: 'Apex Capital Advisors Pvt Ltd (SEBI Reg: INM000012490)', optional: true }
  ],

  risk_information: [
    { name: 'top5_customers_pct', label: 'Top 5 Customers Revenue Share (%)', type: 'number', placeholder: 'e.g. 60', why: 'Structured metric for revenue concentration risk. Values >40% automatically trigger concentration risk disclosures.', example: '60' },
    { name: 'top_supplier_pct', label: 'Top Supplier Purchase Share (%)', type: 'number', placeholder: 'e.g. 45', why: 'Structured metric for supplier concentration risk.', example: '45', optional: true },
    { name: 'single_factory', label: 'Single Facility Operations?', type: 'select', options: [{ value: 'no', label: 'No (Multiple Facilities)' }, { value: 'yes', label: 'Yes (Single Manufacturing Plant)' }], why: 'Flags operational concentration risk.', example: 'yes' },
    { name: 'forex_exposure', label: 'Foreign Exchange Exposure?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Flags currency risk.', example: 'yes', optional: true },
    { name: 'forex_pct', label: 'Forex Revenue Share (%)', type: 'number', placeholder: 'e.g. 15', why: 'Percentage of revenue derived in foreign currencies.', example: '15', dependsOn: 'forex_exposure', optional: true },
    { name: 'pending_tax_demand', label: 'Pending Tax Demands Amount (INR)', type: 'number', placeholder: 'e.g. 1200000', why: 'Quantifies contingent tax liabilities.', example: '1200000', optional: true },
    { name: 'promoter_dependence', label: 'Heavy Dependence on Promoters?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Flags key management personnel risk.', example: 'yes', optional: true },
    { name: 'promoter_dependence_note', label: 'Promoter Dependence Details', type: 'text', placeholder: 'Explain dependency...', why: 'Details key personnel risk.', example: 'Promoters manage key OEM relationships and tooling designs.', dependsOn: 'promoter_dependence', optional: true },
    { name: 'commodity_dependency', label: 'Raw Material Commodity Volatility Risk?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Flags input material price risk.', example: 'yes', optional: true },
    { name: 'commodity_name', label: 'Key Commodities Used', type: 'text', placeholder: 'e.g. Alloy Steel & Brass', why: 'Identifies volatile input materials.', example: 'Alloy Steel, Brass, & Aluminum Ingot', dependsOn: 'commodity_dependency', optional: true },
    { name: 'cybersecurity_risks', label: 'Cybersecurity & Digital System Risks?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Flags IT infrastructure risks.', example: 'yes', optional: true },
    { name: 'cybersecurity_note', label: 'Cybersecurity Note', type: 'text', placeholder: 'Backup & security controls...', why: 'Details cybersecurity posture.', example: 'CAD design vault protected with cloud backup & firewall controls.', dependsOn: 'cybersecurity_risks', optional: true },
    { name: 'esg_risks', label: 'ESG & Environmental Compliance Risks?', type: 'select', options: [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes' }], why: 'Flags ESG compliance factors.', example: 'yes', optional: true },
    { name: 'esg_note', label: 'ESG / Environmental Note', type: 'text', placeholder: 'Waste treatment & effluent details...', why: 'Details environmental risk mitigation.', example: 'Zero liquid discharge plant installed for coolant recycling.', dependsOn: 'esg_risks', optional: true }
  ],

  other_disclosures: [
    { name: 'dividend_policy', label: 'Dividend Policy Summary', type: 'textarea', placeholder: 'Describe dividend payout policy...', why: 'Informs prospective investors about dividend history and policy.', example: 'The Company has not declared dividends in the last 3 fiscal years to retain profits for capital expansion.', optional: true },
    { name: 'csr_initiatives', label: 'CSR Activities & Expenditure', type: 'textarea', placeholder: 'Describe CSR projects...', why: 'Section 135 Companies Act compliance.', example: 'CSR activities focused on local vocational skill training in Thane industrial belt.', optional: true },
    { name: 'employee_benefits', label: 'Employee Benefits & ESOP Scheme', type: 'textarea', placeholder: 'PF, gratuity, ESOP trust details...', why: 'Staff welfare and retention scheme disclosures.', example: 'Gratuity trust maintained with LIC of India; ESOP Scheme 2024 covering 50,000 pool shares.', optional: true },
    { name: 'material_contracts', label: 'Material Contracts & Agreements', type: 'textarea', placeholder: 'Key long-term supply/vendor contracts...', why: 'Significant commercial agreements disclosure.', example: 'Long-term component supply agreement with Sterling Auto Components valid through 2029.', optional: true },
    { name: 'insurance_coverage', label: 'Insurance Policy Coverage', type: 'textarea', placeholder: 'Plant & machinery insurance policies...', why: 'Risk mitigation coverage for assets.', example: 'Standard Fire & Special Perils policy # 459102 covering plant & machinery up to INR 80,000,000.', optional: true },
    { name: 'property_details', label: 'Properties Owned / Leased', type: 'textarea', placeholder: 'Land and factory premises ownership details...', why: 'Real estate asset disclosures.', example: 'Industrial plot W-45 leased from MIDC for 99 years commencing 2012.', optional: true },
    { name: 'intellectual_property_summary', label: 'Trademarks, Patents & IP Rights', type: 'textarea', placeholder: 'Registered trademarks and patents...', why: 'Proprietary IP asset protection.', example: 'Registered Trademark "AARAV PRECISION" under Class 7 (# 3940192).', optional: true },
    { name: 'government_approvals', label: 'Key Government & Regulatory Approvals', type: 'textarea', placeholder: 'Licenses and permits list...', why: 'Confirms operational legitimacy.', example: 'All required licenses from MIDC, MPCB, DIC, and Inspector of Factories are active.', optional: true }
  ]
};

// Fields that are optional (do not count against required completeness).
const OPTIONAL_FIELDS = new Set([]);

// Returns the required questions for a module given its current data (respects dependsOn).
export function requiredQuestions(stepKey, data = {}) {
  const qs = stepQuestions[stepKey] || [];
  return qs.filter(
    (q) => !q.optional && !OPTIONAL_FIELDS.has(q.name) && (!q.dependsOn || data[q.dependsOn] === 'yes')
  );
}

// ── Cross-document validation map ────────────────────────────────────────────
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
  const filled = req.filter((q) => {
    const val = data[q.name];
    if (Array.isArray(val)) return val.length > 0;
    return String(val ?? '').trim() !== '';
  }).length;
  return Math.round((filled / req.length) * 100);
}

// Parses citation string into stepKey and fieldName for in-app navigation anchor.
export function parseCitation(citation) {
  if (!citation) return { stepKey: 'business_overview', fieldName: '' };

  let fieldName = citation;
  let categoryHint = '';

  if (citation.startsWith('Intake:')) {
    const parts = citation.split(': ');
    if (parts.length >= 3) {
      categoryHint = parts[1];
      fieldName = parts[2];
    } else if (parts.length === 2) {
      fieldName = parts[1];
    }
  } else if (citation.startsWith('Document:')) {
    return { stepKey: 'company_details', fieldName: '' };
  }

  fieldName = fieldName.trim();

  // Find stepKey from stepQuestions schema
  for (const [sKey, questions] of Object.entries(stepQuestions)) {
    if (questions.some((q) => q.name === fieldName)) {
      return { stepKey: sKey, fieldName };
    }
  }

  if (categoryHint) {
    const match = steps.find(
      (s) => s.key === categoryHint.toLowerCase().replace(/ /g, '_') ||
             s.label.toLowerCase() === categoryHint.toLowerCase()
    );
    if (match) return { stepKey: match.key, fieldName };
  }

  if (['legal_name', 'cin', 'pan', 'gstin', 'incorporation_date', 'registered_office', 'industry_type'].includes(fieldName)) {
    return { stepKey: 'company_details', fieldName };
  }

  return { stepKey: 'business_overview', fieldName };
}

// Section document upload slot definitions
export const SECTION_UPLOADS = {
  company_details: [
    { key: 'coi', name: 'coi', label: 'COI (Certificate of Incorporation)', docType: 'incorporation_certificate' },
    { key: 'moa', name: 'moa', label: 'MOA (Memorandum of Association)', docType: 'moa_document' },
    { key: 'aoa', name: 'aoa', label: 'AOA (Articles of Association)', docType: 'aoa_document' },
    { key: 'pan', name: 'pan', label: 'Company PAN Certificate', docType: 'pan_certificate' },
    { key: 'gst', name: 'gst_certificate', label: 'GST Registration Certificate', docType: 'gst_certificate' }
  ],
  business_overview: [
    { key: 'factory_images', name: 'factory_images', label: 'Factory Images & Photographs', docType: 'factory_images' },
    { key: 'plant_layout', name: 'plant_layout', label: 'Plant Layout & Blueprint', docType: 'plant_layout' },
    { key: 'certifications', name: 'certifications', label: 'Certifications (ISO / AS9100)', docType: 'certifications' },
    { key: 'brochure', name: 'brochure', label: 'Company Product Brochure', docType: 'company_brochure' }
  ],
  promoters: [
    { key: 'din_proof', name: 'din_proof', label: 'DIN Proof / Identification', docType: 'din_proof' },
    { key: 'promoter_pan', name: 'promoter_pan', label: 'Promoter & Director PAN Cards', docType: 'promoter_pan' },
    { key: 'appointment_letters', name: 'appointment_letters', label: 'Appointment Letters', docType: 'appointment_letters' }
  ],
  capital_structure: [
    { key: 'cap_table', name: 'cap_table', label: 'Certified Cap Table & Shareholding Register', docType: 'cap_table' }
  ],
  financials: [
    { key: 'audited_financials', name: 'audited_financials', label: 'Audited Financial Statements (3 Years)', docType: 'audited_financials' },
    { key: 'tax_audit', name: 'tax_audit', label: 'Tax Audit Report', docType: 'tax_audit_report' },
    { key: 'annual_reports', name: 'annual_reports', label: 'Annual Reports', docType: 'annual_reports' }
  ],
  litigation: [
    { key: 'court_orders', name: 'court_orders', label: 'Court Orders & Judicial Filings', docType: 'court_orders' },
    { key: 'legal_opinions', name: 'legal_opinions', label: 'Legal Counsel Opinions & Advices', docType: 'legal_opinions' }
  ]
};

