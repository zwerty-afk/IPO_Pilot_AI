/**
 * Declarative Industry Profiles Registry & Rule Engine Configuration
 * 
 * Central source of truth for all industry profile configurations.
 * Each profile defines applicable fields, exempted fields, required documents,
 * exempted documents, risk topics, and narrative focus areas.
 * 
 * Adding a new industry in the future requires adding a single configuration block below.
 */

export const INDUSTRY_PROFILES = {
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing & Precision Engineering',
    category: 'Precision Manufacturing SME',
    businessModel: 'B2B Manufacturing',
    revenueModel: 'Job Work & Component Supply Contracts',
    operationalType: 'Manufacturing',
    assetType: 'Asset Heavy',
    regulatoryAuthorities: ['State Factory Inspectorate', 'State Pollution Control Board', 'Fire & Emergency Services', 'ROC', 'GST'],
    
    applicableFields: [
      'manufacturing_plants', 'installed_capacity', 'capacity_utilization_pct',
      'factory_address', 'warehouses', 'factory_license', 'pollution_noc',
      'fire_noc', 'single_factory', 'commodity_dependency'
    ],
    exemptedFields: {
      'tech_stack': 'Factory-focused operation: Software Tech Stack is Not Applicable for Manufacturing enterprises.',
      'ip_ownership': 'Factory-focused operation: Source Code IP Ownership is Not Applicable for Manufacturing enterprises.',
      'cybersecurity_protocol': 'Factory-focused operation: SaaS Cybersecurity Protocol is Not Applicable for Manufacturing enterprises.',
      'fssai_details': 'Non-Food enterprise: FSSAI License is Not Applicable for Manufacturing enterprises.',
      'cdsco_details': 'Non-Pharma enterprise: CDSCO License is Not Applicable for Manufacturing enterprises.',
      'rbi_registration_no': 'Non-NBFC enterprise: RBI Registration is Not Applicable for Manufacturing enterprises.',
      'rera_registration_details': 'Non-Real Estate enterprise: RERA Registration is Not Applicable for Manufacturing enterprises.'
    },

    requiredDocs: [
      { docType: 'factory_license', label: 'Factory License (State Inspectorate)' },
      { docType: 'pollution_noc', label: 'Pollution Control Consent to Operate' },
      { docType: 'fire_noc', label: 'Fire & Emergency Services NOC' },
      { docType: 'plant_layout', label: 'Factory Plant Layout & Machinery Specs' },
      { docType: 'factory_images', label: 'Factory Images & Photographs' }
    ],
    exemptedDocs: [
      { docType: 'ip_assignment', reason: 'Not Applicable for Manufacturing & Engineering businesses without proprietary software.' },
      { docType: 'privacy_policy', reason: 'Not Applicable for Manufacturing & Engineering businesses.' },
      { docType: 'fssai_license', reason: 'Not Applicable for Non-Food Manufacturing businesses.' },
      { docType: 'cdsco_license', reason: 'Not Applicable for Non-Pharma Manufacturing businesses.' }
    ],

    validations: {
      capacity_utilization_pct: { min: 0, max: 100, message: 'Capacity utilization must be between 0% and 100%.' }
    },

    riskTopics: [
      'Raw Material Volatility and Supply Chain Disruptions',
      'Operational Vulnerability to Single Plant Location Disruptions',
      'Environmental and Pollution Control Regulatory Compliance Risk',
      'Power, Water, and Industrial Utility Interruption Risks'
    ],

    draftFocus: 'Manufacturing plant facilities, installed production capacity, capacity utilization %, CNC machinery, and quality control.'
  },

  technology: {
    id: 'technology',
    label: 'Software / IT Services / SaaS',
    category: 'Software & Technology Enterprise',
    businessModel: 'B2B / SaaS',
    revenueModel: 'Recurring Subscription & License Fees',
    operationalType: 'Technology',
    assetType: 'Asset Light',
    regulatoryAuthorities: ['MeitY (IT Act)', 'CERT-In', 'ROC', 'GST Council', 'SEBI'],
    
    applicableFields: [
      'tech_stack', 'ip_ownership', 'cybersecurity_protocol',
      'cloud_infrastructure', 'cybersecurity_risks', 'cybersecurity_note'
    ],
    exemptedFields: {
      'manufacturing_plants': 'Asset-Light Software enterprise: Manufacturing Plants is Not Applicable.',
      'installed_capacity': 'Asset-Light Software enterprise: Installed Production Capacity is Not Applicable.',
      'capacity_utilization_pct': 'Asset-Light Software enterprise: Capacity Utilization (%) is Not Applicable.',
      'factory_address': 'Asset-Light Software enterprise: Primary Factory Address is Not Applicable.',
      'factory_license': 'Asset-Light Software enterprise: Factory License Details & Validity is Not Applicable.',
      'pollution_noc': 'Asset-Light Software enterprise: Pollution Control Board Consent is Not Applicable.',
      'fire_noc': 'Asset-Light Software enterprise: Industrial Fire NOC is Not Applicable.',
      'single_factory': 'Asset-Light Software enterprise: Single Facility Operations is Not Applicable.',
      'commodity_dependency': 'Asset-Light Software enterprise: Commodity Volatility Risk is Not Applicable.',
      'fssai_details': 'Non-Food enterprise: FSSAI License is Not Applicable.',
      'cdsco_details': 'Non-Pharma enterprise: CDSCO License is Not Applicable.',
      'rbi_registration_no': 'Non-NBFC enterprise: RBI Registration is Not Applicable.',
      'rera_registration_details': 'Non-Real Estate enterprise: RERA Registration is Not Applicable.'
    },

    requiredDocs: [
      { docType: 'ip_assignment', label: 'Software IP & Source Code Ownership Agreement' },
      { docType: 'privacy_policy', label: 'Privacy Policy & Data Protection Audit' },
      { docType: 'cybersecurity_audit', label: 'CERT-In Cybersecurity Audit Certificate' }
    ],
    exemptedDocs: [
      { docType: 'factory_license', reason: 'Factory License is Not Applicable for Software & SaaS companies without physical manufacturing plants.' },
      { docType: 'pollution_noc', reason: 'Pollution Control Board NOC is Not Applicable for Asset-Light Software companies.' },
      { docType: 'fire_noc', reason: 'Industrial Fire NOC is Not Applicable for IT office setups.' },
      { docType: 'plant_layout', reason: 'Manufacturing Plant Layout is Not Applicable for Software companies.' },
      { docType: 'factory_images', reason: 'Factory Photographs are Not Applicable for Software companies.' },
      { docType: 'fssai_license', reason: 'Not Applicable for Non-Food Software companies.' },
      { docType: 'cdsco_license', reason: 'Not Applicable for Non-Pharma Software companies.' }
    ],

    validations: {},

    riskTopics: [
      'Cyber Security Attacks, Data Breaches, and System Vulnerability Risks',
      'Cloud Infrastructure Outages and Third-Party Hosting Dependencies',
      'Rapid Technological Obsolescence and Intellectual Property Infringement',
      'Customer Churn Risk and SaaS Enterprise Renewal Rates'
    ],

    draftFocus: 'Software platform scalability, SaaS recurring revenue, proprietary IP ownership, cloud infrastructure security, and enterprise client retention.'
  },

  pharmaceutical: {
    id: 'pharmaceutical',
    label: 'Pharmaceutical & Lifesciences',
    category: 'Pharmaceutical & Lifesciences Enterprise',
    businessModel: 'B2B / Healthcare',
    revenueModel: 'Product Sales & Contract Research',
    operationalType: 'Manufacturing & R&D',
    assetType: 'Asset Heavy',
    regulatoryAuthorities: ['CDSCO', 'State Drug Controller', 'WHO-GMP', 'Pollution Control Board', 'ROC', 'GST'],

    applicableFields: [
      'cdsco_details', 'manufacturing_plants', 'installed_capacity',
      'capacity_utilization_pct', 'factory_address', 'factory_license', 'pollution_noc'
    ],
    exemptedFields: {
      'tech_stack': 'Pharma-focused enterprise: Software Tech Stack is Not Applicable.',
      'ip_ownership': 'Pharma-focused enterprise: Source Code Ownership is Not Applicable.',
      'cybersecurity_protocol': 'Pharma-focused enterprise: SaaS Cybersecurity Protocol is Not Applicable.',
      'fssai_details': 'Non-Food enterprise: FSSAI License is Not Applicable.',
      'rbi_registration_no': 'Non-NBFC enterprise: RBI Registration is Not Applicable.',
      'rera_registration_details': 'Non-Real Estate enterprise: RERA Registration is Not Applicable.'
    },

    requiredDocs: [
      { docType: 'cdsco_license', label: 'CDSCO Drug Manufacturing License' },
      { docType: 'gmp_certificate', label: 'WHO-GMP Compliance Certificate' },
      { docType: 'factory_license', label: 'Pharma Factory License' },
      { docType: 'pollution_noc', label: 'Pollution Control Consent to Operate' }
    ],
    exemptedDocs: [
      { docType: 'ip_assignment', reason: 'Software Source Code Ownership is Not Applicable for Pharmaceutical Formulation companies.' },
      { docType: 'privacy_policy', reason: 'SaaS Privacy Policy is Not Applicable for Pharma Formulations.' },
      { docType: 'fssai_license', reason: 'FSSAI License is Not Applicable for Pharmaceutical Formulations.' }
    ],

    validations: {},

    riskTopics: [
      'Regulatory Disapproval or Delay from CDSCO and International Health Authorities',
      'WHO-GMP Compliance Audit Failure or Manufacturing Plant Quality Warning Letters',
      'Clinical Trial Delays, Product Recalls, and Liability Claims',
      'Raw Material API Sourcing Dependencies and Price Volatility'
    ],

    draftFocus: 'WHO-GMP certified drug manufacturing plants, CDSCO approvals, formulation portfolio, and R&D pipeline.'
  },

  food_beverage: {
    id: 'food_beverage',
    label: 'Food & Beverage / FMCG',
    category: 'Consumer Food & Beverage Company',
    businessModel: 'B2B / B2C / FMCG',
    revenueModel: 'Consumer Product Sales & Distribution',
    operationalType: 'Manufacturing & Packaging',
    assetType: 'Asset Heavy',
    regulatoryAuthorities: ['FSSAI', 'Legal Metrology', 'Factory Inspectorate', 'Pollution Control Board', 'ROC', 'GST'],

    applicableFields: [
      'fssai_details', 'cold_storage_capacity', 'manufacturing_plants',
      'factory_address', 'factory_license', 'fire_noc', 'pollution_noc'
    ],
    exemptedFields: {
      'tech_stack': 'FMCG Food enterprise: Software Tech Stack is Not Applicable.',
      'ip_ownership': 'FMCG Food enterprise: Source Code Ownership is Not Applicable.',
      'cybersecurity_protocol': 'FMCG Food enterprise: SaaS Cybersecurity Protocol is Not Applicable.',
      'cdsco_details': 'Non-Pharma enterprise: CDSCO License is Not Applicable.',
      'rbi_registration_no': 'Non-NBFC enterprise: RBI Registration is Not Applicable.',
      'rera_registration_details': 'Non-Real Estate enterprise: RERA Registration is Not Applicable.'
    },

    requiredDocs: [
      { docType: 'fssai_license', label: 'Central FSSAI Food Safety License' },
      { docType: 'factory_license', label: 'Food Factory License' },
      { docType: 'fire_noc', label: 'Fire Safety NOC' },
      { docType: 'pollution_noc', label: 'Pollution Control Board Consent' }
    ],
    exemptedDocs: [
      { docType: 'ip_assignment', reason: 'Software Source Code Assignment is Not Applicable for Food & Beverage FMCG businesses.' },
      { docType: 'privacy_policy', reason: 'SaaS Privacy Policy is Not Applicable for Food & Beverage FMCG businesses.' },
      { docType: 'cdsco_license', reason: 'CDSCO License is Not Applicable for Food & Beverage FMCG businesses.' }
    ],

    validations: {},

    riskTopics: [
      'FSSAI Regulatory Inspection, Food Safety Contamination, or License Cancellation Risk',
      'Perishable Supply Chain Disruptions and Cold Storage Failures',
      'Fluctuations in Agricultural Raw Material Prices and Seasonality',
      'Brand Reputation Risk and Consumer Product Quality Claims'
    ],

    draftFocus: 'FSSAI certified food processing plants, cold chain network, food safety protocols, and retail distribution footprint.'
  },

  nbfc_financial: {
    id: 'nbfc_financial',
    label: 'NBFC / Financial Services',
    category: 'NBFC / Financial Services Enterprise',
    businessModel: 'B2B / B2C Financial',
    revenueModel: 'Interest Income & Processing Fees',
    operationalType: 'Service & Credit',
    assetType: 'Capital Intensive',
    regulatoryAuthorities: ['Reserve Bank of India (RBI)', 'FIU-IND', 'ROC', 'SEBI'],

    applicableFields: [
      'rbi_registration_no', 'aum_portfolio_details'
    ],
    exemptedFields: {
      'manufacturing_plants': 'Financial Services enterprise: Manufacturing Plants is Not Applicable.',
      'installed_capacity': 'Financial Services enterprise: Installed Production Capacity is Not Applicable.',
      'capacity_utilization_pct': 'Financial Services enterprise: Capacity Utilization (%) is Not Applicable.',
      'factory_address': 'Financial Services enterprise: Primary Factory Address is Not Applicable.',
      'factory_license': 'Financial Services enterprise: Factory License Details & Validity is Not Applicable.',
      'pollution_noc': 'Financial Services enterprise: Pollution Control Board Consent is Not Applicable.',
      'fire_noc': 'Financial Services enterprise: Industrial Fire NOC is Not Applicable.',
      'single_factory': 'Financial Services enterprise: Single Facility Operations is Not Applicable.',
      'commodity_dependency': 'Financial Services enterprise: Commodity Volatility Risk is Not Applicable.',
      'fssai_details': 'Non-Food enterprise: FSSAI License is Not Applicable.',
      'cdsco_details': 'Non-Pharma enterprise: CDSCO License is Not Applicable.',
      'rera_registration_details': 'Non-Real Estate enterprise: RERA Registration is Not Applicable.'
    },

    requiredDocs: [
      { docType: 'rbi_registration_certificate', label: 'RBI Certificate of Registration' }
    ],
    exemptedDocs: [
      { docType: 'factory_license', reason: 'Factory License is Not Applicable for NBFC / Financial Services.' },
      { docType: 'pollution_noc', reason: 'Pollution NOC is Not Applicable for NBFC / Financial Services.' },
      { docType: 'fire_noc', reason: 'Industrial Fire NOC is Not Applicable for NBFC / Financial Services.' },
      { docType: 'plant_layout', reason: 'Plant Layout is Not Applicable for NBFC / Financial Services.' },
      { docType: 'factory_images', reason: 'Factory Photographs are Not Applicable for NBFC / Financial Services.' },
      { docType: 'ip_assignment', reason: 'Source Code IP Assignment is Not Applicable for NBFC / Financial Services.' }
    ],

    validations: {},

    riskTopics: [
      'Reserve Bank of India (RBI) Regulatory Oversight and Capital Adequacy Requirement Risks',
      'Non-Performing Asset (NPA) Credit Default and Recovery Risks',
      'Interest Rate Margin Fluctuation and Funding Liquidity Risks'
    ],

    draftFocus: 'Assets Under Management (AUM), credit underwriting policies, RBI regulatory compliance, capital adequacy ratio, and NPA provisioning.'
  },

  construction_realestate: {
    id: 'construction_realestate',
    label: 'Construction & Infrastructure',
    category: 'Construction & Infrastructure Enterprise',
    businessModel: 'B2B / Government Contracting',
    revenueModel: 'Project Milestones & EPC Contracting',
    operationalType: 'Contracting & Heavy Engineering',
    assetType: 'Asset Heavy',
    regulatoryAuthorities: ['RERA', 'Ministry of Environment & Forests (MoEF)', 'PWD / Municipal Corp', 'ROC', 'GST'],

    applicableFields: [
      'rera_registration_details', 'manufacturing_plants', 'warehouses',
      'factory_address', 'factory_license', 'fire_noc', 'pollution_noc'
    ],
    exemptedFields: {
      'tech_stack': 'Infrastructure Contracting: Software Tech Stack is Not Applicable.',
      'ip_ownership': 'Infrastructure Contracting: Source Code Ownership is Not Applicable.',
      'cybersecurity_protocol': 'Infrastructure Contracting: SaaS Cybersecurity Protocol is Not Applicable.',
      'fssai_details': 'Non-Food enterprise: FSSAI License is Not Applicable.',
      'cdsco_details': 'Non-Pharma enterprise: CDSCO License is Not Applicable.',
      'rbi_registration_no': 'Non-NBFC enterprise: RBI Registration is Not Applicable.'
    },

    requiredDocs: [
      { docType: 'rera_registration', label: 'MahaRERA Project Registration Certificate' },
      { docType: 'environmental_clearances', label: 'MoEF Environmental Clearance Certificate' }
    ],
    exemptedDocs: [
      { docType: 'ip_assignment', reason: 'Software Source Code Assignment is Not Applicable for Infrastructure & Construction enterprises.' },
      { docType: 'privacy_policy', reason: 'SaaS Privacy Policy is Not Applicable for Infrastructure Contracting enterprises.' }
    ],

    validations: {},

    riskTopics: [
      'RERA Project Execution Delay and Environmental Approval Dispute Risks',
      'Land Ownership Title Litigation and Raw Material Steel/Cement Inflation Risks',
      'Subcontractor Execution Failure and Project Milestone Retention Liquidity Risks'
    ],

    draftFocus: 'Ongoing EPC & construction projects, RERA registrations, land bank ownership, environmental clearances, and order book execution.'
  }
};

/**
 * Given an industry string (from intakeData or company object), resolves the matching INDUSTRY_PROFILES configuration.
 */
export function getIndustryProfile(industryKey = 'manufacturing') {
  const normalizedKey = String(industryKey || '').toLowerCase();
  
  if (normalizedKey.includes('software') || normalizedKey.includes('tech') || normalizedKey.includes('saas') || normalizedKey.includes('it')) {
    return INDUSTRY_PROFILES.technology;
  }
  if (normalizedKey.includes('pharma') || normalizedKey.includes('drug') || normalizedKey.includes('health')) {
    return INDUSTRY_PROFILES.pharmaceutical;
  }
  if (normalizedKey.includes('food') || normalizedKey.includes('beverage') || normalizedKey.includes('fmcg')) {
    return INDUSTRY_PROFILES.food_beverage;
  }
  if (normalizedKey.includes('nbfc') || normalizedKey.includes('finance') || normalizedKey.includes('bank') || normalizedKey.includes('credit')) {
    return INDUSTRY_PROFILES.nbfc_financial;
  }
  if (normalizedKey.includes('construction') || normalizedKey.includes('infra') || normalizedKey.includes('realty') || normalizedKey.includes('estate')) {
    return INDUSTRY_PROFILES.construction_realestate;
  }

  // Default fallback: Manufacturing
  return INDUSTRY_PROFILES.manufacturing;
}
