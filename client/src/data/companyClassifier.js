import { getIndustryProfile } from './industryProfiles';

/**
 * Company Profile Configuration Engine
 * 
 * Consumes the user-selected Company Profile (Industry, Sub-Industry, Business Type,
 * Business Model, Regulatory Category) from the Intake Form and declaratively configures:
 * 
 * 1. Intake Form fields (Show / Hide / Mandatory)
 * 2. Required Statutory Document Uploads
 * 3. Dynamic Validation Rules
 * 4. Dynamic Compliance Checklist Items & Exemptions
 * 5. Dynamic Gap Analysis Rules
 * 6. Dynamic Risk Factor Topics
 * 7. Dynamic Draft Prospectus Narrative Focus
 * 8. Dynamic IPO Readiness Evaluation & Denominator Rules
 */

export function classifyCompany(company = {}, intakeData = {}, documents = []) {
  // Read user-selected Industry Sector directly from Company Details
  const userSelectedIndustry = String(
    intakeData.company_details?.industry_type || company.industry_type || ''
  );

  const userSelectedSubInd = String(
    intakeData.company_details?.sub_industry || company.sub_industry || ''
  );

  const userSelectedExchange = String(
    intakeData.company_details?.proposed_exchange || company.proposed_exchange || 'nse_emerge'
  );

  // Declaratively load the matching Industry Profile configuration
  const profileConfig = getIndustryProfile(userSelectedIndustry);

  return {
    industry: profileConfig.id,
    subIndustry: userSelectedSubInd || profileConfig.label,
    businessCategory: profileConfig.category,
    businessModel: profileConfig.businessModel,
    revenueModel: profileConfig.revenueModel,
    operationalType: profileConfig.operationalType,
    assetType: profileConfig.assetType,
    exchangeBoard: userSelectedExchange,
    isRegulated: true,
    regulatoryAuthorities: profileConfig.regulatoryAuthorities,
    aiExplanation: `Configured for ${profileConfig.category} based on user-selected Company Profile.`
  };
}

/**
 * Returns dynamic IPO Compliance Configuration Profile tailored to the company's selected profile.
 * Loaded declaratively from the Industry Profile Registry without hardcoded if/else statements.
 */
export function getIpoProfile(classification = {}) {
  const profileConfig = getIndustryProfile(classification.industry);

  return {
    industry: profileConfig.id,
    applicableUploads: [
      { key: 'incorporation_certificate', label: 'Certificate of Incorporation', docType: 'incorporation_certificate' },
      { key: 'audited_financials', label: '3-Year Audited Financials', docType: 'audited_financials' },
      { key: 'cap_table', label: 'Certified Cap Table & Shareholding', docType: 'cap_table' },
      ...profileConfig.requiredDocs.map(d => ({ key: d.docType, label: d.label, docType: d.docType }))
    ],
    exemptedUploads: profileConfig.exemptedDocs,
    exemptedFields: profileConfig.exemptedFields,
    industryFields: [],
    industryRiskFactors: profileConfig.riskTopics,
    industryNarrativeFocus: profileConfig.draftFocus
  };
}
