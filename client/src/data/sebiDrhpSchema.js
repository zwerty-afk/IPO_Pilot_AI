// Official SEBI Draft Red Herring Prospectus (DRHP) Master Outline

export const DRHP_HIERARCHY = [
  {
    id: "general",
    title: "SECTION I – GENERAL",
    key: "company_details",
    subsections: [
      { id: "definitions_and_abbreviations", title: "1.1 Definitions and Abbreviations", key: "company_details" },
      { id: "certain_conventions_presentation", title: "1.2 Certain Conventions, Use of Financial Information & Market Data", key: "company_details" },
      { id: "forward_looking_statements", title: "1.3 Forward Looking Statements", key: "company_details" }
    ]
  },
  {
    id: "risk_factors",
    title: "RISK FACTORS",
    key: "risk_factors",
    subsections: []
  },
  {
    id: "introduction",
    title: "INTRODUCTION",
    key: "company_details",
    subsections: [
      { id: "the_offer", title: "The Offer", key: "company_details" },
      { id: "summary_restated_financial_info", title: "Summary of Restated Financial Information", key: "financials" },
      { id: "summary_contingent_liabilities", title: "Summary of Contingent Liabilities of Our Company", key: "litigation" },
      { id: "summary_rpt", title: "Summary of Related Party Transactions", key: "related_party" },
      { id: "general_information", title: "General Information", key: "company_details" },
      { id: "capital_structure", title: "Capital Structure", key: "capital_structure" }
    ]
  },
  {
    id: "particulars_of_the_offer",
    title: "PARTICULARS OF THE OFFER",
    key: "objects",
    subsections: [
      { id: "objects_of_the_offer", title: "Objects of the Offer", key: "objects" },
      { id: "basis_for_offer_price", title: "Basis for Offer Price", key: "financials" },
      { id: "statement_special_tax_benefits", title: "Statement of Special Tax Benefits", key: "legal_compliance" }
    ]
  },
  {
    id: "about_our_company",
    title: "ABOUT OUR COMPANY",
    key: "business_overview",
    subsections: [
      { id: "industry_overview", title: "Industry Overview", key: "business_overview" },
      { id: "our_business", title: "Our Business", key: "business_overview" },
      { id: "key_regulations_and_policies", title: "Key Regulations and Policies", key: "legal_compliance" },
      { id: "history_and_certain_corporate_matters", title: "History and Certain Corporate Matters", key: "company_details" },
      { id: "our_management", title: "Our Management", key: "promoter_details" },
      { id: "our_promoters_and_promoter_group", title: "Our Promoters and Promoter Group", key: "promoter_details" },
      { id: "our_group_companies", title: "Our Group Companies", key: "other_disclosures" },
      { id: "dividend_policy", title: "Dividend Policy", key: "other_disclosures" }
    ]
  },
  {
    id: "financial_information",
    title: "FINANCIAL INFORMATION",
    key: "financials",
    subsections: [
      { id: "restated_financial_information", title: "Restated Financial Information", key: "financials" },
      { id: "restated_statement_capitalisation", title: "Restated Statement of Capitalisation", key: "capital_structure" },
      { id: "other_financial_information", title: "Other Financial Information", key: "financials" },
      { id: "mda_financial_position", title: "Management's Discussion and Analysis of Financial Position and Results of Operations", key: "financials" }
    ]
  },
  {
    id: "legal_and_other_information",
    title: "LEGAL AND OTHER INFORMATION",
    key: "litigation",
    subsections: [
      { id: "outstanding_litigation_developments", title: "Outstanding Litigation and Material Developments", key: "litigation" },
      { id: "government_statutory_approvals", title: "Government and Other Statutory Approvals", key: "legal_compliance" },
      { id: "other_regulatory_statutory_disclosures", title: "Other Regulatory and Statutory Disclosures", key: "legal_compliance" }
    ]
  },
  {
    id: "offer_related_information",
    title: "OFFER RELATED INFORMATION",
    key: "objects",
    subsections: [
      { id: "terms_of_the_offer", title: "Terms of the Offer", key: "objects" },
      { id: "offer_structure", title: "Offer Structure", key: "capital_structure" },
      { id: "offer_procedure", title: "Offer Procedure", key: "legal_compliance" },
      { id: "restrictions_foreign_ownership", title: "Restrictions on Foreign Ownership of Indian Securities", key: "legal_compliance" }
    ]
  },
  {
    id: "description_equity_shares_aoa",
    title: "DESCRIPTION OF EQUITY SHARES AND TERMS OF ARTICLES OF ASSOCIATION",
    key: "capital_structure",
    subsections: []
  },
  {
    id: "other_information",
    title: "OTHER INFORMATION",
    key: "other_disclosures",
    subsections: [
      { id: "material_contracts_documents_inspection", title: "Material Contracts and Documents for Inspection", key: "other_disclosures" },
      { id: "declaration", title: "Declaration", key: "other_disclosures" }
    ]
  }
];

export function findDrhpNode(targetId) {
  if (!targetId) {
    const first = DRHP_HIERARCHY[0];
    return { section: first, subsection: first.subsections[0], number: '1.1', fullTitle: `1.1 ${first.subsections[0].title}`, key: first.subsections[0].key };
  }
  for (let secIdx = 0; secIdx < DRHP_HIERARCHY.length; secIdx++) {
    const sec = DRHP_HIERARCHY[secIdx];
    const secNumber = `${secIdx + 1}`;
    if (sec.id === targetId) {
      return { section: sec, subsection: null, number: `${secNumber}.0`, fullTitle: `${secNumber}. ${sec.title}`, key: sec.key };
    }
    if (sec.subsections) {
      for (let subIdx = 0; subIdx < sec.subsections.length; subIdx++) {
        const sub = sec.subsections[subIdx];
        const subNumber = `${secNumber}.${subIdx + 1}`;
        if (sub.id === targetId) {
          return { section: sec, subsection: sub, number: subNumber, fullTitle: `${subNumber} ${sub.title}`, key: sub.key };
        }
      }
    }
  }
  const first = DRHP_HIERARCHY[0];
  return { section: first, subsection: first.subsections[0], number: '1.1', fullTitle: `1.1 ${first.subsections[0].title}`, key: first.subsections[0].key };
}
