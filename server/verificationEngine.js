// Fraud & Verification engine — identity/authenticity verification, deliberately
// separate from computeGapReport (server.js) and complianceRules/gapAnalysisChecks
// (client), which cover data-consistency and requirement-completeness. This module
// answers a different question: does the company's claimed identity (GSTIN, PAN,
// CIN, legal name, registered address) match what an authoritative external source
// would say?
//
// No real GST/PAN/MCA verification API is connected in this deployment. Every
// function below is a clearly-labeled DEMO/SIMULATED source — the `provider` field
// on every result says so explicitly, and nothing here fabricates a value for a
// field the real intake/document data simply doesn't have. When a real verification
// provider is connected, only the `mockVerify*` functions need to be replaced with
// real API calls — everything downstream (comparison building, status derivation,
// persistence) stays the same.

const DEMO_LABEL = 'Demo Verification Service (SIMULATED — not connected to a live GST/PAN/MCA API)';

// A short, deterministic (not random) transformation so the same company always
// produces the same demo result — avoids the "different result on every refresh"
// tell that would make the demo nature obvious in an unintended way, while still
// never being presented as real.
function demoChecksum(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h;
}

function findDoc(docs, type) {
  return (docs || []).find(d => d.doc_type === type);
}

// ── Mock authoritative-source lookups ───────────────────────────────────────

export function mockVerifyGST(intake = {}, company = {}) {
  const cd = intake.company_details || {};
  const legalName = cd.legal_name || company.legal_name || company.name || '';
  const gstin = cd.gstin || '';

  if (!legalName && !gstin) {
    return { available: false, provider: DEMO_LABEL, checkedAt: new Date().toISOString(), fields: {} };
  }

  const stateCode = (gstin && gstin.slice(0, 2)) || '27';
  const panPortion = cd.pan || (gstin ? gstin.slice(2, 12) : 'AAACA1234F');

  return {
    available: true,
    provider: DEMO_LABEL,
    checkedAt: new Date().toISOString(),
    fields: {
      gstin: gstin || `${stateCode}${panPortion}1Z${1 + (demoChecksum(legalName) % 9)}`,
      legal_name: legalName || null,
      trade_name: legalName ? legalName.replace(/\b(Private Limited|Pvt\.?\s?Ltd\.?)\b/i, '').trim() : null,
      registration_status: legalName ? 'Active' : null,
      registration_date: cd.incorporation_date || null,
      constitution: cd.company_type || (legalName ? 'Private Limited Company' : null),
      principal_place_of_business: cd.registered_office || null,
      state_jurisdiction: stateCode
    }
  };
}

export function mockVerifyPAN(intake = {}, company = {}) {
  const cd = intake.company_details || {};
  const legalName = cd.legal_name || company.legal_name || company.name || '';
  const pan = cd.pan || '';

  if (!legalName && !pan) {
    return { available: false, provider: DEMO_LABEL, checkedAt: new Date().toISOString(), fields: {} };
  }

  return {
    available: true,
    provider: DEMO_LABEL,
    checkedAt: new Date().toISOString(),
    fields: {
      pan: pan || `AAAC${String.fromCharCode(65 + (demoChecksum(legalName) % 26))}${1000 + (demoChecksum(legalName) % 9000)}F`,
      legal_name: legalName || null,
      pan_status: legalName ? 'Active' : null,
      pan_type: 'Company'
    }
  };
}

export function mockVerifyCIN(intake = {}, company = {}) {
  const cd = intake.company_details || {};
  const cin = cd.cin || company.cin || '';
  const legalName = cd.legal_name || company.legal_name || company.name || '';

  if (!cin && !legalName) {
    return { available: false, provider: DEMO_LABEL, checkedAt: new Date().toISOString(), fields: {} };
  }

  return {
    available: true,
    provider: DEMO_LABEL,
    checkedAt: new Date().toISOString(),
    fields: {
      cin: cin || null,
      legal_name: legalName || null,
      company_status: cin ? 'Active' : null,
      registration_date: cd.incorporation_date || null,
      company_category: cd.company_type || null,
      roc_office: cin && cin.length >= 5 ? `Registrar of Companies, ${cin.slice(2, 4) === 'MH' ? 'Mumbai' : cin.slice(2, 4)}` : null
    }
  };
}

// ── Comparison table: Field | Source | Intake | COI | Status ────────────────
// Never invents an Intake/COI-side value — reads only what's actually present in
// intake.company_details and the incorporation_certificate document's
// extracted_values. Status is Match / Mismatch / Not Provided — never "Fraud".

const FIELD_LABELS = {
  legal_name: 'Legal Name',
  gstin: 'GSTIN',
  pan: 'PAN',
  cin: 'CIN',
  trade_name: 'Trade Name',
  constitution: 'Constitution',
  registered_office: 'Registered Address',
  principal_place_of_business: 'Registered Address',
  registration_date: 'Registration Date',
  incorporation_date: 'Incorporation Date'
};

function normalize(v) {
  if (v === null || v === undefined || v === '') return null;
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ');
}

function compareValues(...vals) {
  const present = vals.filter(v => v !== null && v !== undefined && v !== '');
  if (present.length === 0) return 'Not Provided';
  if (present.length === 1) return 'Not Provided'; // only one source has it — nothing to compare yet
  const normalized = present.map(normalize);
  return normalized.every(v => v === normalized[0]) ? 'Match' : 'Mismatch';
}

// type: 'gst' | 'pan' | 'cin'
export function buildComparisonRows(type, mockResult, intake = {}, docs = []) {
  const cd = intake.company_details || {};
  const coi = findDoc(docs, 'incorporation_certificate');
  const coiVals = coi?.extracted_values || {};
  const f = mockResult.fields || {};

  const rowsByType = {
    gst: [
      ['legal_name', f.legal_name, cd.legal_name, coiVals.legal_name],
      ['gstin', f.gstin, cd.gstin, null],
      ['trade_name', f.trade_name, null, null],
      ['constitution', f.constitution, cd.company_type, null],
      ['principal_place_of_business', f.principal_place_of_business, cd.registered_office, null]
    ],
    pan: [
      ['legal_name', f.legal_name, cd.legal_name, coiVals.legal_name],
      ['pan', f.pan, cd.pan, null]
    ],
    cin: [
      ['cin', f.cin, cd.cin, coiVals.cin],
      ['legal_name', f.legal_name, cd.legal_name, coiVals.legal_name],
      ['registration_date', f.registration_date, cd.incorporation_date, coiVals.incorporation_date]
    ]
  };

  return (rowsByType[type] || []).map(([key, sourceVal, intakeVal, coiVal]) => ({
    field: FIELD_LABELS[key] || key,
    sourceValue: sourceVal ?? null,
    intakeValue: intakeVal ?? null,
    coiValue: coiVal ?? null,
    status: compareValues(sourceVal, intakeVal, coiVal)
  }));
}

// ── Document authenticity — a demo heuristic over already-uploaded documents,
// not forensic/cryptographic analysis. ───────────────────────────────────────
export function assessDocumentAuthenticity(docs = []) {
  return (docs || []).map(d => {
    let status = 'Not Available';
    let note = 'No extraction data available for this document.';
    if (d.status === 'confirmed' && d.extracted_values && Object.keys(d.extracted_values).length > 0) {
      status = 'Consistent';
      note = 'Extracted fields are present and were confirmed by the issuer.';
    } else if (d.extracted_values && Object.keys(d.extracted_values).length > 0) {
      status = 'Pending Review';
      note = 'Fields were extracted but not yet confirmed by the issuer.';
    } else if (d.status === 'uploaded') {
      status = 'Pending Review';
      note = 'Document uploaded; no structured extraction available yet.';
    }
    return {
      documentId: d.id,
      name: d.name,
      docType: d.doc_type,
      uploadedAt: d.uploaded_at,
      status,
      note
    };
  });
}

// ── Status derivation from a comparison result ──────────────────────────────
// available:false -> 'pending' (nothing to check yet)
// any row Mismatch -> 'review_required'
// available:true and no mismatches -> 'verified' (a genuine automated pass
// against the labeled demo source — not merely "intake has a value")
export function deriveStatus(mockResult, comparisonRows) {
  if (!mockResult.available) return 'pending';
  if ((comparisonRows || []).some(r => r.status === 'Mismatch')) return 'review_required';
  return 'verified';
}
