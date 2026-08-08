import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  dynamoEnabled,
  initStore,
  isReady,
  readStore,
  writeStore,
  flushStore as flushDynamoStore
} from './dynamoStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

// ─── Password hashing (built-in crypto, no external deps) ──────────────────────
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored) return false;
  if (stored.startsWith('scrypt$')) {
    const [, salt, hash] = stored.split('$');
    const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(test, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  // Legacy plaintext seed users (demo accounts) — still accepted.
  return stored === password;
}

const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'company';

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
        operations: 'Operating from a 15,000 sq ft facility in Dombivli, Maharashtra, equipped with 14 CNC turning centers, 6 vertical machining centers (VMC), and a dedicated metrology lab for quality assurance.',
        revenue_model: 'B2B contractual manufacturing with fixed component pricing and annual rate contracts.',
        business_verticals: 'Automotive Components (55%), Industrial Hydraulics (30%), Aerospace & Defense Sub-assemblies (15%).',
        key_products: 'CNC machined shafts, valve bodies, precision brass fittings, and custom aerospace brackets.',
        services: 'Custom precision machining, surface finishing, heat treatment coordination, and sub-assembly testing.',
        manufacturing_capability: '14 CNC turning centers, 6 vertical machining centers (VMC), CMM inspection, and 500,000 unit monthly capacity.',
        technology: 'CAD/CAM integrated tooling design, IoT-enabled machine monitoring, and automated tool presetting.',
        target_market: 'Tier-1 automotive OEMs, industrial pump manufacturers, and defense contractors across India and South Asia.',
        key_customers: 'Bharat Hydraulic Systems, Sterling Auto Components, and Royal Aerospace Parts India.',
        key_suppliers: 'Apex Alloy Steels Ltd, Mahavir Brass Industries, and Precision Metals Corp.',
        geographic_presence: 'Primary operations in Dombivli (Thane), serving clients across Maharashtra, Gujarat, Tamil Nadu, and exporting to UAE.',
        competitive_advantage: 'AS9100D aerospace certification, 99.4% first-pass quality yield, and long-standing 10+ year client relationships.',
        industry_analysis: 'The Indian precision engineering sector is projected to grow at 12.5% CAGR driven by Make in India initiatives and global supply chain diversification.',
        growth_strategy: 'Expand 5-axis VMC capacity by 40%, acquire AS9100D defense supplier certification, and increase export revenues to 25% of total turnover by FY28.',
        swot_strengths: 'High customer retention rate, specialized 5-axis machining capability, certified metrology lab.',
        swot_weaknesses: 'Single facility concentration in Dombivli, dependency on top 3 clients for 60% revenue.',
        swot_opportunities: 'Growing defense localization mandates in India, EV component manufacturing expansion.',
        swot_threats: 'Fluctuations in raw material prices (alloy steel & brass), rising industrial power tariffs.'
      },
      promoters: {
        promoters_list: 'Aarav Mehta (Managing Director, 18 years experience in tool manufacturing) and Rohan Mehta (Director of Operations, 15 years experience in precision machining).',
        directors: 'Aarav Mehta, Rohan Mehta, and Mrs. Sunita Mehta (Non-Executive Director).'
      },
      objects: {
        amount_to_raise: '50000000',
        purpose: 'Funding capital expenditure for acquisition of 4 advanced 5-axis vertical machining centers (VMCs), meeting long-term working capital requirements, and general corporate purposes.',
        timeline: ''
      },
      capital_structure: {
        total_shares: '1000000',
        promoter_holding_pct: '65',
        shareholders: 'Aarav Mehta: 650,000 shares (65%), Rohan Mehta: 350,000 shares (35%).'
      },
      rpt: {
        has_rpt: 'yes',
        rpt_details: "The company leases its main industrial unit from Aarav Precision Tooling Ltd (a promoter-controlled entity) at a monthly lease rent of 15,000 INR, which is on an arm's length basis verified by local valuer report."
      },
      financials: {
        revenue_fy25: '125000000',
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
      },
      legal_compliance: {
        roc_compliance: 'All annual returns and financial statements filed up to FY25.',
        gst_compliance: 'GSTR-3B and GSTR-1 filed up to date with zero tax defaults.',
        pf_esi_compliance: 'EPFO Code MH/THN/104592; all monthly contributions deposited.',
        factory_license: 'Factory License # 45920-THN valid through Dec 2028.',
        pollution_noc: 'MPCB Consent to Operate (Orange Category) valid till March 2029.',
        fire_noc: 'Thane Municipal Fire NOC # 112/2025 valid till Oct 2027.',
        auditor_details: 'M/s Shah & Associates, Chartered Accountants (FRN: 104920W), Partner: CA Rajesh Shah (M.No: 045912).',
        merchant_banker_details: 'Apex Capital Advisors Pvt Ltd (SEBI Reg: INM000012490)'
      },
      risk_information: {
        top5_customers_pct: '60',
        top_supplier_pct: '45',
        single_factory: 'yes',
        forex_exposure: 'yes',
        forex_pct: '15',
        pending_tax_demand: '1200000',
        promoter_dependence: 'yes',
        promoter_dependence_note: 'Promoters manage key OEM relationships and tooling designs.',
        commodity_dependency: 'yes',
        commodity_name: 'Alloy Steel, Brass, & Aluminum Ingot',
        cybersecurity_risks: 'yes',
        cybersecurity_note: 'CAD design vault protected with cloud backup & firewall controls.',
        esg_risks: 'yes',
        esg_note: 'Zero liquid discharge plant installed for coolant recycling.'
      },
      other_disclosures: {
        dividend_policy: 'The Company has not declared dividends in the last 3 fiscal years to retain profits for capital expansion.',
        csr_initiatives: 'CSR activities focused on local vocational skill training in Thane industrial belt.',
        employee_benefits: 'Gratuity trust maintained with LIC of India; ESOP Scheme 2024 covering 50,000 pool shares.',
        material_contracts: 'Long-term component supply agreement with Sterling Auto Components valid through 2029.',
        insurance_coverage: 'Standard Fire & Special Perils policy # 459102 covering plant & machinery up to INR 80,000,000.',
        property_details: 'Industrial plot W-45 leased from MIDC for 99 years commencing 2012.',
        intellectual_property_summary: 'Registered Trademark "AARAV PRECISION" under Class 7 (# 3940192).',
        government_approvals: 'All required licenses from MIDC, MPCB, DIC, and Inspector of Factories are active.'
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
      status: 'uploaded',
      uploaded_at: '2026-07-06T10:05:00Z',
      extracted_values: {
        revenue_fy25: '118000000',
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
      status: 'uploaded',
      uploaded_at: '2026-07-06T10:10:00Z',
      extracted_values: {
        aarav_mehta_shares: '620000',
        rohan_mehta_shares: '350000',
        other_shares: '30000',
        total_shares: '1000000',
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
        disputed_amount: '1200000',
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
            text: 'The Company operates from its primary manufacturing and registered facility located at W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204, spanning approximately 15,000 sq ft.',
            confidence: 'high',
            citations: ['Intake: Company Details: registered_office', 'Intake: Business Overview: operations']
          },
          {
            id: 'bo-3',
            text: 'Key clientele of the Company includes reputable Tier-1 automotive and industrial pumps manufacturers, namely Bharat Hydraulic Systems, Sterling Auto Components, and Royal Aerospace Parts India.',
            confidence: 'high',
            citations: ['Intake: Business Overview: customers']
          },
          {
            id: 'bo-4',
            text: 'Revenue Model & Business Verticals: The Company generates revenue through B2B contractual manufacturing with fixed component pricing and annual rate contracts. Key business lines & verticals include Automotive Components (55%), Industrial Hydraulics (30%), Aerospace & Defense Sub-assemblies (15%).',
            confidence: 'high',
            citations: ['Intake: Business Overview: revenue_model', 'Intake: Business Overview: business_verticals']
          },
          {
            id: 'bo-5',
            text: 'Products & Services: Key products manufactured include CNC machined shafts, valve bodies, precision brass fittings, and custom aerospace brackets. Complementary services provided include Custom precision machining, surface finishing, heat treatment coordination, and sub-assembly testing. Manufacturing capability features 14 CNC turning centers, 6 vertical machining centers (VMC), CMM inspection, and 500,000 unit monthly capacity, supported by key technologies such as CAD/CAM integrated tooling design, IoT-enabled machine monitoring, and automated tool presetting.',
            confidence: 'high',
            citations: ['Intake: Business Overview: key_products', 'Intake: Business Overview: services', 'Intake: Business Overview: manufacturing_capability', 'Intake: Business Overview: technology']
          },
          {
            id: 'bo-6',
            text: 'Market, Customers & Suppliers: Target market encompasses Tier-1 automotive OEMs, industrial pump manufacturers, and defense contractors across India and South Asia. Key customers include Bharat Hydraulic Systems, Sterling Auto Components, and Royal Aerospace Parts India, while raw material requirements are supplied by Apex Alloy Steels Ltd, Mahavir Brass Industries, and Precision Metals Corp. Geographic presence spans Primary operations in Dombivli (Thane), serving clients across Maharashtra, Gujarat, Tamil Nadu, and exporting to UAE. Key competitive advantages include AS9100D aerospace certification, 99.4% first-pass quality yield, and long-standing 10+ year client relationships, supported by industry analysis: The Indian precision engineering sector is projected to grow at 12.5% CAGR driven by Make in India initiatives and global supply chain diversification.',
            confidence: 'high',
            citations: ['Intake: Business Overview: target_market', 'Intake: Business Overview: key_customers', 'Intake: Business Overview: key_suppliers', 'Intake: Business Overview: geographic_presence', 'Intake: Business Overview: competitive_advantage', 'Intake: Business Overview: industry_analysis']
          },
          {
            id: 'bo-7',
            text: 'Growth Strategy & Timeline: Originally incorporated in 2015-04-12, the Company has progressed through key milestones. Future growth strategy and expansion timeline: Expand 5-axis VMC capacity by 40%, acquire AS9100D defense supplier certification, and increase export revenues to 25% of total turnover by FY28.',
            confidence: 'high',
            citations: ['Intake: Company Details: incorporation_date', 'Intake: Business Overview: growth_strategy']
          },
          {
            id: 'bo-8',
            text: 'SWOT Analysis:\n• Strengths: High customer retention rate, specialized 5-axis machining capability, certified metrology lab.\n• Weaknesses: Single facility concentration in Dombivli, dependency on top 3 clients for 60% revenue.\n• Opportunities: Growing defense localization mandates in India, EV component manufacturing expansion.\n• Threats: Fluctuations in raw material prices (alloy steel & brass), rising industrial power tariffs.',
            confidence: 'high',
            citations: ['Intake: Business Overview: swot_strengths', 'Intake: Business Overview: swot_weaknesses', 'Intake: Business Overview: swot_opportunities', 'Intake: Business Overview: swot_threats']
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
            text: 'The Company has a pending income tax litigation matter before the Commissioner of Income Tax (Appeals), Mumbai, concerning disallowance of tool depreciation for Assessment Year 2022-23. The total amount under dispute is INR 1,200,000.',
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
            text: 'Schedule of Implementation and Deployment of Funds: The proceeds from the Issue will be deployed across FY 2025-26 and FY 2026-27 for machine procurement (INR 30,000,000) and working capital enhancement (INR 20,000,000).',
            confidence: 'high',
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
            text: 'Shareholding Pattern & Promoter Group: The promoter group holds 65.00% of the pre-issue paid-up equity share capital, comprising Aarav Mehta (62.00%) and Rohan Mehta (3.00%), fully unencumbered and held in dematerialized form.',
            confidence: 'high',
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
            text: "The Company leases its primary factory premises from Aarav Precision Tooling Ltd (a related party under Indian Accounting Standard 24, where our promoter Aarav Mehta is a director). The lease carries a monthly rent of INR 15,000. Management confirms that this lease is executed on an arm's length basis.",
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
            text: 'Income Tax Dispute: The Company has preferred an appeal before the CIT(A), Mumbai, (Ref: CIT(A)/MUM/IT-1124/2024-25) contesting a depreciation disallowance on machinery tools for FY22. The aggregate tax liability under dispute is INR 1,200,000.',
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
            text: 'The promoters of the Company are Aarav Mehta and Rohan Mehta. Aarav Mehta serves as the Managing Director, possessing over 18 years of experience in the tool design and precision component manufacturing industry.',
            confidence: 'high',
            citations: ['Intake: Promoters: promoters_list']
          },
          {
            id: 'prom-2',
            text: 'The Board of Directors comprises three members: Aarav Mehta (Managing Director), Rohan Mehta (Executive Director), and Mrs. Sunita Mehta (Non-Executive Director).',
            confidence: 'high',
            citations: ['Intake: Promoters: directors']
          }
        ]
      },
      company_details: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'cd-1',
            text: 'Corporate Identity & Registration: Aarav Precision Engineering Pvt Ltd was incorporated on 2015-04-12 as a Private Limited Company under the Companies Act. Corporate Identification Number (CIN): U29220MH2015PTC263456, Permanent Account Number (PAN): AABCA1234F, GSTIN: 27AABCA1234F1Z5. Industry Classification: Precision Engineering & Manufacturing (CNC Machine Components & Precision Assemblies).',
            confidence: 'high',
            citations: ['Intake: Company Details: legal_name', 'Document: Certificate_of_Incorporation_2015.pdf']
          },
          {
            id: 'cd-2',
            text: 'Registered Office & Operating Locations: Registered Office: W-45, MIDC Industrial Area, Phase II, Dombivli East, Thane, Maharashtra - 421204. Operating Branches & Facilities: Primary manufacturing plant in Dombivli (Thane); regional office in Pune. Storage & Logistics Warehouses: Central raw material vault & finished goods warehouse at Dombivli site.',
            confidence: 'high',
            citations: ['Intake: Company Details: registered_office']
          },
          {
            id: 'cd-3',
            text: 'Share Capital & Proposed Issue: Authorized Capital: 20,000,000 INR (2,000,000 Equity Shares of Rs 10 each). Pre-IPO Paid-up Capital: 10,000,000 INR (1,000,000 Equity Shares of Rs 10 each). Proposed Issue Size: 50,000,000 INR on NSE Emerge / BSE SME.',
            confidence: 'high',
            citations: ['Intake: Company Details: authorized_capital', 'Intake: Company Details: proposed_exchange']
          }
        ]
      },
      financials: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'fin-1',
            text: 'Financial Performance (3-Year Summary): Total Operating Revenue was INR 125,000,000 in FY25, INR 95,000,000 in FY24, and INR 72,000,000 in FY23. Revenue Breakup: Automotive Tier-1 components (55%), Industrial Hydraulics (30%), Aerospace & Defense Sub-assemblies (15%).',
            confidence: 'high',
            citations: ['Intake: Financials: revenue_fy25', 'Document: Audited_Financial_Statements_FY25.pdf']
          },
          {
            id: 'fin-2',
            text: 'Profitability & Ratios: Net Profit After Tax (PAT) stood at INR 11,000,000 in FY25 and INR 7,500,000 in FY24. EBITDA Margin: 18.5%, PAT Margin: 9.3%.',
            confidence: 'high',
            citations: ['Intake: Financials: profit_fy25']
          },
          {
            id: 'fin-3',
            text: 'Borrowings, Working Capital & CAPEX: Outstanding Debt: INR 25,000,000. Working Capital Facilities: Secured cash credit and bank overdraft facilities against inventory and receivables. Capital Expenditure (CAPEX): INR 15,000,000 invested in 2 VMC machines in FY25.',
            confidence: 'high',
            citations: ['Intake: Financials: total_debt']
          }
        ]
      },
      legal_compliance: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'lc-1',
            text: 'Statutory & Tax Compliances: ROC Compliance: All annual returns and financial statements filed up to FY25 with zero delay fees. GST Compliance: GSTR-3B and GSTR-1 filed up to date with zero tax defaults. PF/ESI Compliance: EPFO Code MH/THN/104592; all monthly statutory employee contributions deposited on time. Income Tax Compliance: Income Tax Return (ITR-6) filed up to Assessment Year 2025-26.',
            confidence: 'high',
            citations: ['Intake: Legal Compliance: roc_compliance', 'Intake: Legal Compliance: gst_compliance']
          },
          {
            id: 'lc-2',
            text: 'Licenses & Clearances: Factory License: Factory License # 45920-THN valid through Dec 2028. Pollution Consent: MPCB Consent to Operate (Orange Category) valid till March 2029. Fire NOC: Thane Municipal Fire NOC # 112/2025 valid till Oct 2027.',
            confidence: 'high',
            citations: ['Intake: Legal Compliance: factory_license', 'Intake: Legal Compliance: pollution_noc']
          },
          {
            id: 'lc-3',
            text: 'Key Intermediaries & Advisors: Statutory Auditor: M/s Shah & Associates, Chartered Accountants (FRN: 104920W), Partner: CA Rajesh Shah. Company Secretary: M/s K. V. & Associates, Practicing Company Secretaries, Mumbai. Registrar to the Issue: Bigshare Services Pvt Ltd (SEBI Reg: INR000001385). Lead Merchant Banker: Apex Capital Advisors Pvt Ltd (SEBI Reg: INM000012490).',
            confidence: 'high',
            citations: ['Intake: Legal Compliance: auditor_details', 'Intake: Legal Compliance: merchant_banker_details']
          }
        ]
      },
      other_disclosures: {
        status: 'draft',
        last_updated: '2026-07-06T10:30:00Z',
        blocks: [
          {
            id: 'od-1',
            text: 'Dividend Policy, CSR & Employee Benefits: Dividend Policy: The Company has not declared dividends in the last 3 fiscal years to retain profits for capital expansion. CSR Initiatives: CSR activities focused on local vocational skill training in Thane industrial belt. ESOP & Benefits: Gratuity trust maintained with LIC of India; ESOP Scheme 2024 covering 50,000 pool shares.',
            confidence: 'high',
            citations: ['Intake: Other Disclosures: dividend_policy', 'Intake: Other Disclosures: employee_benefits']
          },
          {
            id: 'od-2',
            text: 'Material Contracts, Insurance & IP: Material Contracts: Long-term component supply agreement with Sterling Auto Components valid through 2029. Asset Risk & Insurance: Standard Fire & Special Perils policy # 459102 covering plant & machinery up to INR 80,000,000. Intellectual Property: Registered Trademark "AARAV PRECISION" under Class 7 (# 3940192).',
            confidence: 'high',
            citations: ['Intake: Other Disclosures: material_contracts', 'Intake: Other Disclosures: insurance_coverage']
          },
          {
            id: 'od-3',
            text: 'Government Approvals & Compliance Defaults: Government Approvals: All required operating licenses from MIDC, MPCB, DIC, and Inspector of Factories are active. Statutory Defaults: No financial defaults, statutory non-compliances, or listing penalties reported.',
            confidence: 'high',
            citations: ['Intake: Other Disclosures: government_approvals']
          }
        ]
      }
    }
  },
  comments: [
    {
      id: 'comm-1',
      companyId: 'aarav-precision',
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
    {
      id: 'notif-1',
      companyId: 'aarav-precision',
      recipient_role: 'issuer',
      recipient_email: 'aarav@example.com',
      message: 'Priya Sharma requested clarification on Capital Structure section.',
      related_section: 'capital_structure',
      is_read: false,
      type: 'comment',
      created_at: '2026-07-06T11:00:00Z'
    },
    {
      id: 'notif-2',
      companyId: 'aarav-precision',
      recipient_role: 'reviewer',
      recipient_email: 'priya@example.com',
      message: 'Aarav Mehta updated the Objects of the Issue intake section.',
      related_section: 'objects',
      is_read: true,
      type: 'intake_update',
      created_at: '2026-07-06T10:20:00Z'
    }
  ],
  sebi_notices: [
    {
      id: 'sebi-2025-01',
      title: 'SME IPO minimum application size increased to ₹2 lakh (2 lots per application)',
      source_title: 'SME IPO minimum application size increased to ₹2 lakh (2 lots per application)',
      description: 'SEBI notified amendments to ICDR Regulations increasing the minimum application size for SME IPO investors from ₹1 lakh to ₹2 lakh (minimum 2 lots per application) to protect retail investors and curb speculative bidding.',
      date: '2025-03-04',
      publication_date: '2025-03-04',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-04T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-02',
      title: 'Minimum number of allottees in SME IPO increased from 50 to 200',
      source_title: 'Minimum number of allottees in SME IPO increased from 50 to 200',
      description: 'SEBI mandates that SME IPO issuers must achieve at least 200 successful allottees (increased from 50) post-IPO allotment to ensure broader public shareholding and trading liquidity.',
      date: '2025-03-04',
      publication_date: '2025-03-04',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-04T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-03',
      title: 'Offer for Sale (OFS) in SME IPOs capped at 20% of issue size',
      source_title: 'Offer for Sale (OFS) in SME IPOs capped at 20% of issue size',
      description: 'OFS component in SME IPOs cannot exceed 20% of total issue size, and individual selling shareholders cannot offer more than 20% of their pre-issue shareholding on a fully diluted basis.',
      date: '2025-03-06',
      publication_date: '2025-03-06',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-06T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-04',
      title: 'Minimum operating profit (EBITDA) requirement of ₹1 crore in 2 of last 3 years introduced for SME IPO eligibility',
      source_title: 'Minimum operating profit (EBITDA) requirement of ₹1 crore in 2 of last 3 years introduced for SME IPO eligibility',
      description: 'Under SEBI ICDR Regulation 229(6), SME issuers must demonstrate positive operating profit (EBITDA) of at least ₹1 crore in at least 2 of the last 3 financial years.',
      date: '2025-03-06',
      publication_date: '2025-03-06',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-06T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-05',
      title: 'Promoter lock-in (MPC) extended to 5 years for SME IPOs',
      source_title: 'Promoter lock-in (MPC) extended to 5 years for SME IPOs',
      description: 'Minimum Promoter Contribution (MPC 20%) lock-in period extended to 5 years. Promoter holding in excess of MPC releases in two phases (50% after 1 year, 50% after 2 years).',
      date: '2025-03-08',
      publication_date: '2025-03-08',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-08T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-06',
      title: 'Monitoring Agency threshold reduced from ₹100 Cr to ₹20 Cr for SME issuers',
      source_title: 'Monitoring Agency threshold reduced from ₹100 Cr to ₹20 Cr for SME issuers',
      description: 'Appointment of a SEBI-registered Monitoring Agency is mandatory for SME IPO fresh issue sizes exceeding ₹20 crore or funding subsidiary debt/acquisitions.',
      date: '2025-03-08',
      publication_date: '2025-03-08',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-08T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-07',
      title: 'RPT norms under LODR extended to SME listed entities (10% of turnover materiality threshold)',
      source_title: 'RPT norms under LODR extended to SME listed entities (10% of turnover materiality threshold)',
      description: 'Related Party Transactions exceeding 10% of annual consolidated turnover require prior shareholder approval by ordinary resolution on SME boards, effective April 1, 2025.',
      date: '2025-03-28',
      publication_date: '2025-03-28',
      category: 'LODR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-lodr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-28T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-08',
      title: 'SME issuers barred from using IPO proceeds to repay promoter/related-party loans',
      source_title: 'SME issuers barred from using IPO proceeds to repay promoter/related-party loans',
      description: 'Strict prohibition introduced under Regulation 230: public issue proceeds cannot be utilized for repayment of loans taken from Promoters, Promoter Group, or related parties.',
      date: '2025-03-08',
      publication_date: '2025-03-08',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-08T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    },
    {
      id: 'sebi-2025-09',
      title: 'Cooling-off period of 2 years introduced for companies converted from proprietorship/partnership/LLP before SME IPO',
      source_title: 'Cooling-off period of 2 years introduced for companies converted from proprietorship/partnership/LLP before SME IPO',
      description: 'Entities converted into a public/private limited company from a proprietorship, partnership, or LLP must complete at least 2 full financial years as a corporate entity before filing an SME IPO.',
      date: '2025-03-08',
      publication_date: '2025-03-08',
      category: 'ICDR Amendment',
      source_url: 'https://www.sebi.gov.in/legal/regulations/mar-2025/sebi-icdr-amendment-regulations-2025_sme_framework.html',
      source_attribution: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
      fetched_at: '2025-03-08T00:00:00.000Z',
      filter_reason: 'Verified SEBI Notification'
    }
  ],
  sebi_notices_meta: {
    last_fetched: '2025-03-28T00:00:00.000Z',
    source: 'SEBI ICDR/LODR Amendments, 2025 — SME Framework',
    fetch_count: 9
  },
  audit_logs: [
    {
      id: 'audit-seed-1',
      actor_email: 'aarav@example.com',
      actor_name: 'Aarav Mehta',
      actor_role: 'issuer',
      action: 'LOGIN',
      entity_type: 'session',
      entity_id: 'aarav-precision',
      description: 'User logged in successfully.',
      metadata: {},
      ip: '127.0.0.1',
      created_at: '2026-07-06T09:55:00Z'
    },
    {
      id: 'audit-seed-2',
      actor_email: 'priya@example.com',
      actor_name: 'Priya Sharma',
      actor_role: 'reviewer',
      action: 'COMMENT_ADDED',
      entity_type: 'draft_section',
      entity_id: 'capital_structure',
      description: 'Reviewer added clarification request on Capital Structure.',
      metadata: { comment: 'Please verify promoter shareholding percentage.' },
      ip: '127.0.0.1',
      created_at: '2026-07-06T11:00:00Z'
    }
  ],
  ipo_readiness: {},
  merchant_bankers: [
    { id: 'mb-001', name: 'Axis Capital Limited', registration_no: 'INM000012029', status: 'Registered', category: 'I', address: 'Axis House, C-2, Wadia International Centre, Pandurang Budhkar Marg, Worli, Mumbai - 400025', sebi_source: 'https://www.sebi.gov.in', registered_since: '2003-01-01' },
    { id: 'mb-002', name: 'IIFL Securities Ltd', registration_no: 'INM000010940', status: 'Registered', category: 'I', address: 'IIFL House, Sun Infotech Park, Road No. 16V, Wagle Industrial Estate, Thane - 400604', sebi_source: 'https://www.sebi.gov.in', registered_since: '2002-01-01' },
    { id: 'mb-003', name: 'Emkay Global Financial Services Ltd', registration_no: 'INM000011229', status: 'Registered', category: 'I', address: '7th Floor, The Ruby, Senapati Bapat Marg, Dadar West, Mumbai - 400028', sebi_source: 'https://www.sebi.gov.in', registered_since: '2005-01-01' },
    { id: 'mb-004', name: 'Hem Securities Limited', registration_no: 'INM000010981', status: 'Registered', category: 'I', address: 'Ground Floor, 1 Bhagwat House, 2 Roop Nagar, Delhi - 110007', sebi_source: 'https://www.sebi.gov.in', registered_since: '2004-01-01' },
    { id: 'mb-005', name: 'Beeline Capital Advisors Pvt Ltd', registration_no: 'INM000012871', status: 'Registered', category: 'II', address: '401, Harlim Chambers, 1st Road, Khar (W), Mumbai - 400052', sebi_source: 'https://www.sebi.gov.in', registered_since: '2010-01-01' },
    { id: 'mb-006', name: 'Expert Global Consultants Pvt Ltd', registration_no: 'INM000012289', status: 'Registered', category: 'II', address: 'Goregaon East, Mumbai - 400063', sebi_source: 'https://www.sebi.gov.in', registered_since: '2008-01-01' },
    { id: 'mb-007', name: 'GYR Capital Advisors Pvt Ltd', registration_no: 'INM000014149', status: 'Registered', category: 'II', address: 'Lower Parel, Mumbai - 400013', sebi_source: 'https://www.sebi.gov.in', registered_since: '2016-01-01' },
    { id: 'mb-008', name: 'Indorient Financial Services Ltd', registration_no: 'INM000011120', status: 'Registered', category: 'I', address: '101, Indira Chambers, M.G. Road, Indore - 452001', sebi_source: 'https://www.sebi.gov.in', registered_since: '2004-01-01' },
    { id: 'mb-009', name: 'Pantomath Capital Advisors Pvt Ltd', registration_no: 'INM000012110', status: 'Registered', category: 'I', address: 'Unit No.908, 9th Floor, Hallmark Business Plaza, Sant Dnyaneshwar Marg, Bandra (E), Mumbai - 400051', sebi_source: 'https://www.sebi.gov.in', registered_since: '2007-01-01' },
    { id: 'mb-010', name: 'Saffron Capital Advisors Pvt Ltd', registration_no: 'INM000012708', status: 'Registered', category: 'II', address: 'Nariman Point, Mumbai - 400021', sebi_source: 'https://www.sebi.gov.in', registered_since: '2009-01-01' }
  ],
  invitations: []
};

export function getDb() {
  // When DynamoDB is active, serve from the in-memory copy loaded at boot.
  if (dynamoEnabled && isReady()) {
    return readStore();
  }

  // Read-only deployment: never try to materialise db.json. Reaching here means
  // DynamoDB is unavailable, so return the seed in memory rather than throwing an
  // EROFS that would hide the real storage error.
  if (process.env.VERCEL) {
    console.warn('[db] DynamoDB unavailable under serverless — serving in-memory seed (changes will not persist)');
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }

  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    // Schema migration: ensure new collections exist
    let migrated = false;
    const defaults = {
      audit_logs: INITIAL_SEED.audit_logs,
      notifications: INITIAL_SEED.notifications,
      sebi_notices: [],
      sebi_notices_meta: INITIAL_SEED.sebi_notices_meta,
      ipo_readiness: {},
      merchant_bankers: INITIAL_SEED.merchant_bankers,
      invitations: []
    };
    Object.keys(defaults).forEach(key => {
      if (!(key in parsed)) {
        parsed[key] = defaults[key];
        migrated = true;
      }
    });
    if (migrated) fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2));
    return parsed;
  } catch (err) {
    console.error('Error reading db file, restoring seed:', err);
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_SEED, null, 2));
    return JSON.parse(JSON.stringify(INITIAL_SEED));
  }
}

export function saveDb(data) {
  if (dynamoEnabled && isReady()) {
    writeStore(data);
    return;
  }
  if (process.env.VERCEL) {
    // Nothing durable to write to. Log loudly rather than crashing the request:
    // a silent no-op here would look like a successful save.
    console.error('[db] save dropped — DynamoDB not ready and filesystem is read-only');
    return;
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/** Called once at server boot to hydrate the DynamoDB-backed store. */
export async function initDb() {
  if (!dynamoEnabled) {
    console.log('[db] DynamoDB disabled — using local db.json');
    return false;
  }
  await initStore(INITIAL_SEED);
  return true;
}

/**
 * Awaits any pending DynamoDB writes. On a long-lived server writes are coalesced
 * and this is only needed for tests/shutdown, but under serverless the request
 * must await it before responding or a frozen container drops the write.
 */
export async function flushDb() {
  if (!dynamoEnabled || !isReady()) return;
  await flushDynamoStore();
}

export const db = {
  getUsers: () => getDb().users,
  // Trimmed as well as lowercased: a trailing space from an autofill, a paste, or
  // a mobile keyboard's auto-inserted space otherwise produced "Invalid email or
  // password" for credentials that were actually correct.
  findUser: (email) => {
    const needle = String(email || '').trim().toLowerCase();
    if (!needle) return undefined;
    return getDb().users.find(u => String(u.email || '').trim().toLowerCase() === needle);
  },
  addUser: (user) => {
    const data = getDb();
    data.users.push(user);
    saveDb(data);
    return user;
  },
  getCompanies: () => getDb().companies,
  getCompany: (id) => getDb().companies.find(c => c.id === id),
  addCompany: (company) => {
    const data = getDb();
    // Ensure a unique id even if the slug collides with an existing company.
    let id = company.id || slugify(company.name);
    let candidate = id;
    let n = 1;
    while (data.companies.some(c => c.id === candidate)) {
      candidate = `${id}-${n++}`;
    }
    const record = { ...company, id: candidate };
    data.companies.push(record);
    if (!data.intake[candidate]) data.intake[candidate] = {};
    if (!data.drafts[candidate]) data.drafts[candidate] = {};
    if (!data.ipo_readiness) data.ipo_readiness = {};
    data.ipo_readiness[candidate] = null;
    saveDb(data);
    return record;
  },

  getIntake: (companyId) => getDb().intake[companyId] || {},
  saveIntakeStep: (companyId, stepKey, stepData) => {
    const data = getDb();
    if (!data.intake[companyId]) data.intake[companyId] = {};
    data.intake[companyId][stepKey] = stepData;
    saveDb(data);
    return data.intake[companyId][stepKey];
  },

  getDocuments: (companyId) => companyId ? (getDb().documents || []).filter(d => d.companyId === companyId) : (getDb().documents || []),
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
    if (!data.drafts[companyId]) data.drafts[companyId] = {};
    if (!data.drafts[companyId][sectionKey]) {
      data.drafts[companyId][sectionKey] = { status: 'draft', last_updated: new Date().toISOString(), blocks: [] };
    }
    if ((status === 'certified' || status === 'approved' || status === 'rejected' || status === 'changes_requested') && role !== 'reviewer') {
      throw new Error('Only a registered Reviewer can update section status.');
    }
    data.drafts[companyId][sectionKey].status = status;
    data.drafts[companyId][sectionKey].last_updated = new Date().toISOString();
    saveDb(data);
    return data.drafts[companyId][sectionKey];
  },
  updateSectionContent: (companyId, sectionKey, blocks) => {
    const data = getDb();
    if (!data.drafts[companyId]) data.drafts[companyId] = {};
    if (!data.drafts[companyId][sectionKey]) {
      data.drafts[companyId][sectionKey] = { status: 'draft', last_updated: new Date().toISOString(), blocks: [] };
    }
    data.drafts[companyId][sectionKey].blocks = blocks;
    data.drafts[companyId][sectionKey].last_updated = new Date().toISOString();
    saveDb(data);
    return data.drafts[companyId][sectionKey];
  },
  saveDrafts: (companyId, drafts) => {
    const data = getDb();
    data.drafts[companyId] = drafts;
    saveDb(data);
  },

  getComments: (companyId, sectionId) => getDb().comments.filter(c => c.companyId === companyId && c.section_id === sectionId),
  addComment: (companyId, sectionId, content, type, author, role, blockId = null, parentId = null) => {
    const data = getDb();
    const newComment = {
      id: 'comm-' + Date.now(),
      companyId,
      section_id: sectionId,
      block_id: blockId,
      parent_id: parentId,
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
  },
  editComment: (commentId, newContent) => {
    const data = getDb();
    const comment = data.comments.find(c => c.id === commentId);
    if (comment) {
      comment.content = newContent;
      comment.updated_at = new Date().toISOString();
      saveDb(data);
    }
    return comment;
  },
  deleteComment: (commentId) => {
    const data = getDb();
    const idx = data.comments.findIndex(c => c.id === commentId);
    if (idx !== -1) {
      data.comments.splice(idx, 1);
      // Optional: Delete child replies too, but let's keep it simple or do it if needed.
      saveDb(data);
      return true;
    }
    return false;
  },

  // Notifications
  getNotifications: (companyId, recipientEmail, recipientRole) => {
    const data = getDb();
    const notifs = (data.notifications || []).filter(
      n => n.companyId === companyId &&
           (n.recipient_email === recipientEmail || (recipientRole && n.recipient_role === recipientRole) || n.recipient_email === 'all')
    );
    return notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addNotification: (notif) => {
    const data = getDb();
    if (!data.notifications) data.notifications = [];

    // Deduplication check: prevent identical notification message to same recipient within 5 seconds
    const recentDup = data.notifications.find(n => 
      n.companyId === notif.companyId &&
      (n.recipient_email === notif.recipient_email || n.recipient_role === notif.recipient_role) &&
      n.message === notif.message &&
      (Date.now() - new Date(n.created_at).getTime()) < 5000
    );
    if (recentDup) return recentDup;

    const newNotif = { id: 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), ...notif, is_read: false, created_at: new Date().toISOString() };
    data.notifications.push(newNotif);
    saveDb(data);
    return newNotif;
  },
  markNotificationRead: (notifId) => {
    const data = getDb();
    const notif = (data.notifications || []).find(n => n.id === notifId);
    if (notif) { notif.is_read = true; saveDb(data); }
    return notif;
  },
  markAllNotificationsRead: (companyId, recipientEmail, recipientRole) => {
    const data = getDb();
    (data.notifications || []).forEach(n => {
      if (n.companyId === companyId &&
          (n.recipient_email === recipientEmail || (recipientRole && n.recipient_role === recipientRole) || n.recipient_email === 'all')) {
        n.is_read = true;
      }
    });
    saveDb(data);
  },

  // Audit Logs
  getAuditLogs: (filters = {}) => {
    const data = getDb();
    let logs = data.audit_logs || [];
    if (filters.companyId) logs = logs.filter(l => l.entity_id === filters.companyId || l.metadata?.companyId === filters.companyId);
    if (filters.action) logs = logs.filter(l => l.action === filters.action);
    if (filters.actor_email) logs = logs.filter(l => l.actor_email === filters.actor_email);
    return logs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  addAuditLog: (entry) => {
    const data = getDb();
    if (!data.audit_logs) data.audit_logs = [];
    const log = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      ...entry,
      created_at: new Date().toISOString()
    };
    data.audit_logs.push(log);
    saveDb(data);
    return log;
  },

  // SEBI Notices (Strictly IPO / ICDR / SME related content)
  getSebiNotices: () => {
    const raw = getDb().sebi_notices || [];
    const isIpoNotice = (n) => {
      const title = (n.title || '').toLowerCase();
      const cat = (n.category || '').toLowerCase();
      if (cat.includes('icdr') || cat.includes('sme') || cat.includes('merchant')) return true;
      if (title.includes('ipo') || title.includes('sme') || title.includes('icdr') || title.includes('issue of capital') || title.includes('merchant banker') || title.includes('drhp') || title.includes('prospectus')) return true;
      return false;
    };
    const ipoOnly = raw.filter(isIpoNotice);
    return ipoOnly.length > 0 ? ipoOnly : INITIAL_SEED.sebi_notices;
  },
  saveSebiNotices: (notices, meta) => {
    const isIpoNotice = (n) => {
      const title = (n.title || '').toLowerCase();
      const cat = (n.category || '').toLowerCase();
      if (cat.includes('icdr') || cat.includes('sme') || cat.includes('merchant')) return true;
      if (title.includes('ipo') || title.includes('sme') || title.includes('icdr') || title.includes('issue of capital') || title.includes('merchant banker') || title.includes('drhp') || title.includes('prospectus')) return true;
      return false;
    };
    const filtered = (notices || []).filter(isIpoNotice);
    const data = getDb();
    data.sebi_notices = filtered.length > 0 ? filtered : INITIAL_SEED.sebi_notices;
    data.sebi_notices_meta = { ...data.sebi_notices_meta, ...meta, last_fetched: new Date().toISOString() };
    saveDb(data);
  },
  getSebiNoticesMeta: () => getDb().sebi_notices_meta || {},

  // IPO Readiness
  getIpoReadiness: (companyId) => (getDb().ipo_readiness || {})[companyId] || null,
  saveIpoReadiness: (companyId, readiness) => {
    const data = getDb();
    if (!data.ipo_readiness) data.ipo_readiness = {};
    // Preserve `items` unless the caller explicitly supplies it. The readiness
    // GET handler recomputes and saves the whole payload, which carries no
    // `items` key — a naive spread therefore deleted every reviewer sign-off on
    // each page load, so verifications silently vanished the moment the issuer
    // refreshed the dashboard.
    const existing = data.ipo_readiness[companyId] || {};
    data.ipo_readiness[companyId] = {
      ...existing,
      ...readiness,
      items: readiness.items ?? existing.items ?? {},
      computed_at: new Date().toISOString()
    };
    saveDb(data);
  },

  // Merchant Bankers
  getMerchantBankers: (query = '') => {
    const data = getDb();
    const bankers = data.merchant_bankers || [];
    if (!query) return bankers;
    const q = query.toLowerCase();
    return bankers.filter(mb =>
      mb.name.toLowerCase().includes(q) ||
      mb.registration_no.toLowerCase().includes(q) ||
      mb.address.toLowerCase().includes(q)
    );
  },

  // Invitations
  getInvitations: (filter = {}) => {
    const data = getDb();
    let invs = data.invitations || [];
    if (typeof filter === 'string') invs = invs.filter(inv => inv.company_id === filter);
    else if (filter.company_id) invs = invs.filter(inv => inv.company_id === filter.company_id);
    else if (filter.merchant_banker_id) invs = invs.filter(inv => inv.merchant_banker_id === filter.merchant_banker_id);
    return invs.sort((a, b) => new Date(b.created_at || b.invited_at || 0) - new Date(a.created_at || a.invited_at || 0));
  },
  getInvitationByIdOrToken: (idOrToken) => {
    const data = getDb();
    return (data.invitations || []).find(i => i.id === idOrToken || i.token === idOrToken);
  },
  addInvitation: (inv) => {
    const data = getDb();
    if (!data.invitations) data.invitations = [];
    const newInv = {
      id: 'inv-' + Date.now(),
      token: 'inv_token_' + Math.random().toString(36).slice(2) + Date.now().toString(36),
      status: 'pending',
      created_at: new Date().toISOString(),
      invited_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      ...inv
    };
    data.invitations.push(newInv);
    saveDb(data);
    return newInv;
  },
  updateInvitation: (invId, updates) => {
    const data = getDb();
    const inv = (data.invitations || []).find(i => i.id === invId || i.token === invId);
    if (inv) {
      Object.assign(inv, updates, { updated_at: new Date().toISOString() });
      saveDb(data);
    }
    return inv;
  },

  // Document Verifications
  verifyDocument: (docId, verifierEmail, verifierName, status, remarks = '') => {
    const data = getDb();
    const doc = (data.documents || []).find(d => d.id === docId);
    if (doc) {
      doc.verification_status = status; // 'under_review' | 'verified' | 'changes_requested'
      doc.verified_by_email = verifierEmail;
      doc.verified_by_name = verifierName;
      doc.verified_at = new Date().toISOString();
      doc.verification_remarks = remarks;
      saveDb(data);
    }
    return doc;
  },

  // IPO Readiness Item Status Updates
  updateIpoReadinessItemStatus: (companyId, itemKey, status, verifierEmail, verifierName, remarks = '') => {
    const data = getDb();
    if (!data.ipo_readiness) data.ipo_readiness = {};
    if (!data.ipo_readiness[companyId]) data.ipo_readiness[companyId] = { items: {} };
    if (!data.ipo_readiness[companyId].items) data.ipo_readiness[companyId].items = {};
    
    data.ipo_readiness[companyId].items[itemKey] = {
      status, // 'not_started' | 'in_progress' | 'submitted_for_review' | 'verified' | 'needs_changes' | 'completed'
      updated_by_email: verifierEmail,
      updated_by_name: verifierName,
      updated_at: new Date().toISOString(),
      remarks
    };
    saveDb(data);
    return data.ipo_readiness[companyId];
  }
};

export default db;
