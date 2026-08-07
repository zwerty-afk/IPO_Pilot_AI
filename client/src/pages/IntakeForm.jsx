import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getIntakeStep,
  saveIntakeStep,
  getIntake,
  getDocuments,
  uploadDocument,
  confirmDocument,
  verifyDocument,
  deleteDocument,
  retryDocumentOcr,
  getPrefillSuggestions,
  applyPrefill
} from '../services/api';
import { steps, stepQuestions, checkFieldAgainstDocuments, SECTION_UPLOADS, DOC_FIELD_MAP, getAdaptiveStepQuestions, getAdaptiveSectionUploads } from '../data/intakeSchema';
import { classifyCompany, getIpoProfile } from '../data/companyClassifier';
import {
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  Save,
  Check,
  Loader2,
  AlertCircle,
  FileSearch,
  Sparkles,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  UploadCloud,
  FileText,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronDown,
  RefreshCw,
  Edit3,
  FileCheck2,
  AlertTriangle
} from 'lucide-react';

// Helper component for repeatable field groups (e.g. Promoters, Directors, Related Parties, Litigation cases, Branches)
function RepeatableFieldGroup({ q, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [showMask, setShowMask] = useState({});

  const addItem = () => {
    const newItem = {};
    (q.itemFields || []).forEach(f => { newItem[f.name] = ''; });
    onChange([...items, newItem]);
  };

  const removeItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateItemField = (index, fieldName, val) => {
    const updated = items.map((item, i) => i === index ? { ...item, [fieldName]: val } : item);
    onChange(updated);
  };

  const toggleMask = (key) => {
    setShowMask(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2 relative group">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entry #{idx + 1}</span>
            <button
              type="button"
              onClick={() => removeItem(idx)}
              className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 font-semibold transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(q.itemFields || []).map(f => {
              const maskKey = `${idx}-${f.name}`;
              const isSensitive = f.sensitive;
              const isMasked = isSensitive && !showMask[maskKey];
              return (
                <div key={f.name} className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>{f.label}</span>
                    {isSensitive && (
                      <button
                        type="button"
                        onClick={() => toggleMask(maskKey)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-1 text-[10px] font-normal normal-case"
                        title={isMasked ? 'Show sensitive field' : 'Hide sensitive field'}
                      >
                        {isMasked ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isMasked ? 'Show' : 'Hide'}
                      </button>
                    )}
                  </label>
                  <input
                    type={isMasked ? 'password' : 'text'}
                    value={item[f.name] || ''}
                    onChange={(e) => updateItemField(idx, f.name, e.target.value)}
                    placeholder={f.label}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-200 px-3.5 py-2.5 rounded-xl transition-colors w-full justify-center shadow-sm"
      >
        <Plus className="w-4 h-4" /> {q.placeholder || 'Add Another Entry'}
      </button>
    </div>
  );
}

// Expected fields list per document type to initialize input slots even if OCR fails
const EXPECTED_FIELDS_BY_DOC_TYPE = {
  incorporation_certificate: ['cin', 'legal_name', 'incorporation_date', 'registered_state', 'type_of_company'],
  audited_financials: ['revenue_fy25', 'revenue_fy24', 'revenue_fy23', 'profit_fy25', 'profit_fy24', 'net_worth', 'total_assets', 'total_debt'],
  cap_table: ['total_shares', 'promoter_holding_pct', 'promoter_shares', 'public_shares'],
  litigation_records: ['case_reference', 'authority', 'disputed_amount', 'assessment_year', 'nature_of_dispute'],
  factory_images: ['image_description', 'equipment_detected', 'facility_observations', 'safety_ppe_observations', 'confidence_score'],
  plant_layout: ['layout_summary', 'production_flow', 'departments', 'machinery_locations', 'major_observations'],
  certifications: ['certificate_name', 'issuing_authority', 'certificate_number', 'issue_date', 'expiry_date', 'compliance_details'],
  company_brochure: ['summary', 'products', 'services', 'industries_served', 'key_capabilities']
};

// Helper to check which form field maps to a given document key for live discrepancy validation
const getMappedField = (docType, docKey) => {
  for (const [sKey, fields] of Object.entries(DOC_FIELD_MAP)) {
    for (const [fName, rule] of Object.entries(fields)) {
      if (rule.docType === docType && rule.docKey === docKey) {
        return { stepKey: sKey, fieldName: fName };
      }
    }
  }
  return null;
};

// Component for rendering a section-specific document upload slot with inline OCR review & auditing
function DocumentUploadSlot({ slot, companyId, documents, setDocuments, onUploadSuccess, formData, currentStepKey, allIntake }) {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showExtracted, setShowExtracted] = useState(false);
  const [showSourceView, setShowSourceView] = useState(false);
  const [error, setError] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const existingDoc = (documents || []).find((d) => d.doc_type === slot.docType);

  useEffect(() => {
    if (existingDoc) {
      const defaultFields = EXPECTED_FIELDS_BY_DOC_TYPE[existingDoc.doc_type] || [];
      const initialValues = {};
      defaultFields.forEach(field => {
        initialValues[field] = '';
      });
      setEditedValues({
        ...initialValues,
        ...(existingDoc.extracted_values || {})
      });
    } else {
      setEditedValues({});
    }
  }, [existingDoc?.id, existingDoc?.extracted_values, existingDoc?.doc_type]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum allowed size is 10 MB.');
      return;
    }
    try {
      setUploading(true);
      setError(null);
      await uploadDocument(companyId, file, slot.docType);
      setShowExtracted(true);
      if (onUploadSuccess) await onUploadSuccess();
      window.dispatchEvent(new CustomEvent('ipo-readiness-changed'));
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!existingDoc) return;
    const docId = existingDoc.id;
    try {
      setDeleting(true);
      setError(null);

      // Optimistically remove the document from UI
      if (setDocuments) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
      }
      setShowExtracted(false);
      setShowSourceView(false);

      await deleteDocument(docId);
      if (onUploadSuccess) await onUploadSuccess();
      window.dispatchEvent(new CustomEvent('ipo-readiness-changed'));
    } catch (err) {
      console.error('Delete failed:', err);
      // Ignore 404 since it means document is already deleted
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || 'Could not delete document.');
        // Re-fetch in case deletion failed so the UI restores to previous state
        if (onUploadSuccess) await onUploadSuccess();
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleRetryOcr = async () => {
    if (!existingDoc) return;
    try {
      setRetrying(true);
      setError(null);
      await retryDocumentOcr(existingDoc.id);
      if (onUploadSuccess) await onUploadSuccess();
      window.dispatchEvent(new CustomEvent('ipo-readiness-changed'));
    } catch (err) {
      console.error('Retry OCR failed:', err);
      setError(err.response?.data?.message || 'OCR retry failed.');
    } finally {
      setRetrying(false);
    }
  };

  const handleConfirmValues = async () => {
    if (!existingDoc) return;
    try {
      setConfirming(true);
      setError(null);
      await confirmDocument(existingDoc.id, editedValues);
      if (onUploadSuccess) await onUploadSuccess();
      window.dispatchEvent(new CustomEvent('ipo-readiness-changed'));
    } catch (err) {
      console.error('Confirmation failed:', err);
      setError(err.response?.data?.message || 'Confirmation failed.');
    } finally {
      setConfirming(false);
    }
  };

  const handleVerify = async (status) => {
    if (!existingDoc) return;
    try {
      setVerifying(true);
      setError(null);
      await verifyDocument(existingDoc.id, status, verificationRemarks);
      setVerificationRemarks('');
      if (onUploadSuccess) await onUploadSuccess();
    } catch (err) {
      console.error('Verification failed:', err);
      setError(err.response?.data?.message || 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  };

  const fileUrl = existingDoc
    ? (existingDoc.file_path && existingDoc.file_path.startsWith('http')
        ? existingDoc.file_path
        : `http://localhost:3001/api/documents/${existingDoc.id}/file`)
    : '#';

  const extractedEntries = Object.entries(editedValues);

  const renderDocumentPreview = () => {
    if (!existingDoc) return null;

    // If OCR text or AI vision output is available, show it
    if (existingDoc.ocr_text || existingDoc.doc_type === 'factory_images') {
      return (
        <div className="border border-slate-200 bg-white rounded-xl p-3 font-mono text-[11px] text-slate-700 space-y-2 max-h-48 overflow-y-auto shadow-inner">
          <p className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider">
            {existingDoc.doc_type === 'factory_images' ? 'Gemini AI Vision — Visible Text (If Any)' : 'Gemini OCR — Extracted Text'}
          </p>
          <pre className="whitespace-pre-wrap leading-relaxed">
            {existingDoc.ocr_text || (existingDoc.doc_type === 'factory_images' ? 'No visible text detected in image.' : '')}
          </pre>
        </div>
      );
    }

    // Legacy / Seeded documents fallback previews
    if (existingDoc.doc_type === 'audited_financials') {
      return (
        <div className="border border-slate-200 bg-white rounded-xl p-4 font-mono text-[11px] text-slate-700 space-y-3 max-h-48 overflow-y-auto shadow-inner">
          <div className="text-center font-bold border-b pb-1.5 text-slate-900 text-xs">
            MEHRA & ASSOCIATES — CHARTERED ACCOUNTANTS<br/>
            AUDIT REPORT FOR FY 2024-25
          </div>
          <div className="space-y-0.5 text-[10px]">
            <p><strong>Entity Name:</strong> Aarav Precision Engineering Private Limited</p>
            <p><strong>CIN:</strong> U29220MH2015PTC263456</p>
          </div>
          <div className="border-t border-b py-1.5 space-y-1">
            <p className="font-bold text-slate-900 text-[10px]">STATEMENT OF PROFIT & LOSS</p>
            <table className="w-full text-left text-[10px]">
              <thead><tr className="border-b"><th>Particulars</th><th className="text-right">FY 2024-25</th></tr></thead>
              <tbody>
                <tr className="bg-yellow-50 font-semibold border-b"><td>Revenue from Operations</td><td className="text-right text-red-700">118,000,000 INR</td></tr>
                <tr className="border-b"><td>Other Income</td><td className="text-right">2,100,000 INR</td></tr>
                <tr className="font-bold border-b"><td>Total Revenue</td><td className="text-right">120,100,000 INR</td></tr>
                <tr className="border-b"><td>Cost of Materials</td><td className="text-right">72,500,000 INR</td></tr>
                <tr className="border-b"><td>Employee Benefit Exp</td><td className="text-right">18,300,000 INR</td></tr>
                <tr className="bg-slate-100 font-semibold"><td>Profit After Tax (PAT)</td><td className="text-right text-emerald-800">11,000,000 INR</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-400 italic">Signed & Certified. Date: June 15, 2025.</p>
        </div>
      );
    }

    if (existingDoc.doc_type === 'cap_table') {
      return (
        <div className="border border-slate-200 bg-white rounded-xl p-4 font-mono text-[11px] text-slate-700 space-y-3 max-h-48 overflow-y-auto shadow-inner">
          <div className="text-center font-bold border-b pb-1.5 text-slate-900 text-xs">
            CERTIFIED SHAREHOLDING STRUCTURE AS OF MARCH 31, 2026
          </div>
          <div className="space-y-0.5 text-[10px]"><p><strong>Company Name:</strong> Aarav Precision Engineering Pvt Ltd</p></div>
          <div className="border-t border-b py-1.5 space-y-1">
            <p className="font-bold text-slate-900 text-[10px]">SHARE DISTRIBUTION REGISTER</p>
            <table className="w-full text-left text-[10px]">
              <thead><tr className="border-b"><th>Name of Shareholder</th><th>Shares</th><th className="text-right">Holding %</th></tr></thead>
              <tbody>
                <tr className="bg-yellow-50 font-semibold border-b"><td>Aarav Mehta (Promoter)</td><td>620,000</td><td className="text-right text-red-700">62.00%</td></tr>
                <tr className="border-b"><td>Rohan Mehta (Promoter)</td><td>350,000</td><td className="text-right">35.00%</td></tr>
                <tr className="border-b"><td>Minority Public Owners</td><td>30,000</td><td className="text-right">3.00%</td></tr>
                <tr className="font-bold"><td>Total Capitalization</td><td>1,000,000</td><td className="text-right">100.00%</td></tr>
              </tbody>
            </table>
          </div>
          <p className="text-[9px] text-slate-400 italic">Certified by CS Rohan Kapur, FCS 1290. Stamp Attached.</p>
        </div>
      );
    }

    return (
      <div className="border border-slate-200 bg-slate-50 rounded-xl p-3 text-[11px] text-slate-700 font-mono space-y-1 max-h-48 overflow-y-auto">
        <p className="text-[9px] uppercase text-indigo-500 font-bold">Extracted Values JSON:</p>
        <pre className="whitespace-pre-wrap">{JSON.stringify(existingDoc.extracted_values, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 truncate">
          <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="truncate" title={slot.label}>{slot.label}</span>
        </label>
        {existingDoc && (
          <span className="shrink-0">
            {existingDoc.ocr_status === 'processing' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <Loader2 className="w-3 h-3 animate-spin" /> Extracting…
              </span>
            ) : existingDoc.ocr_status === 'completed' || existingDoc.status === 'confirmed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Extracted successfully
              </span>
            ) : existingDoc.ocr_status === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                <XCircle className="w-3 h-3 text-red-600" /> Issue detected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-2 py-0.5">
                <Check className="w-3 h-3" /> Uploaded
              </span>
            )}
          </span>
        )}
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-100 rounded-lg text-red-700 text-[11px] font-medium flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
        </div>
      )}

      {existingDoc ? (
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 truncate max-w-[14rem]" title={existingDoc.name}>
              {existingDoc.name}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {existingDoc.file_size ? `${(existingDoc.file_size / 1024).toFixed(0)} KB` : ''}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
            <div className="flex items-center gap-3">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> View File
              </a>

              {existingDoc.ocr_status !== 'processing' && (
                <button
                  type="button"
                  onClick={() => setShowExtracted(!showExtracted)}
                  className="text-slate-700 hover:text-indigo-600 font-bold flex items-center gap-1 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{showExtracted ? 'Hide Extracted Data' : 'View Extracted Data'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExtracted ? 'rotate-180' : ''}`} />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSourceView(!showSourceView)}
                className="text-slate-500 hover:text-slate-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{showSourceView ? 'Hide Source' : 'Source View'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {existingDoc.ocr_status === 'failed' && (
                <button
                  type="button"
                  onClick={handleRetryOcr}
                  disabled={retrying}
                  className="text-amber-700 hover:text-amber-900 font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Retry OCR
                </button>
              )}
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
              </button>
            </div>
          </div>

          {/* Source Document View Panel */}
          {showSourceView && (
            <div className="mt-2 pt-2 border-t border-slate-200 bg-white rounded-xl p-3 text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-sans border-b pb-1 font-bold">
                <span>SOURCE DOCUMENT PREVIEW</span>
                <span>{existingDoc.name}</span>
              </div>
              {renderDocumentPreview()}
            </div>
          )}

          {/* Collapsible Inline Extracted Data Panel */}
          {showExtracted && (
            <div className="mt-2 pt-2 border-t border-indigo-100 bg-white/90 rounded-xl p-3 space-y-3 animate-slide-up">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-1 text-indigo-700">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Extracted Data
                </span>
                <span className="text-[10px] text-slate-400 font-normal">Powered by Gemini OCR</span>
              </div>

              {extractedEntries.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">
                  {existingDoc.ocr_status === 'failed'
                    ? 'OCR failed. No structured values extracted.'
                    : 'No structured fields extracted for this document type.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 text-[11px]">
                  {extractedEntries.map(([key, val]) => {
                    const mapping = getMappedField(existingDoc.doc_type, key);
                    let hasMismatch = false;
                    let enteredDisplay = '';

                    if (mapping) {
                      const formVal = (formData && formData[mapping.fieldName] !== undefined)
                        ? formData[mapping.fieldName]
                        : (allIntake && allIntake[mapping.stepKey] ? allIntake[mapping.stepKey][mapping.fieldName] : undefined);

                      if (formVal !== undefined && formVal !== null && String(formVal).trim() !== '') {
                        const mockDoc = { ...existingDoc, extracted_values: editedValues };
                        const mismatchResult = checkFieldAgainstDocuments(mapping.stepKey, mapping.fieldName, formVal, [mockDoc]);
                        if (mismatchResult) {
                          hasMismatch = true;
                          enteredDisplay = mismatchResult.enteredDisplay;
                        }
                      }
                    }

                    const isMultiline = [
                      'image_description', 'facility_observations', 'safety_ppe_observations',
                      'layout_summary', 'production_flow', 'departments', 'machinery_locations', 'major_observations',
                      'compliance_details', 'summary', 'products', 'services', 'industries_served', 'key_capabilities'
                    ].includes(key) || (typeof val === 'string' && val.length > 50);

                    return (
                      <div key={key} className="p-2 bg-slate-50 border border-slate-200/70 rounded-lg space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-mono text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                            {key.replace(/_/g, ' ')}
                          </label>
                          {hasMismatch && (
                            <span className="text-[9px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 animate-slide-up" title={`Intake Form has: "${enteredDisplay}"`}>
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> Form Mismatch (Intake: {enteredDisplay})
                            </span>
                          )}
                        </div>
                        {isMultiline ? (
                          <textarea
                            rows={3}
                            value={editedValues[key] || ''}
                            onChange={(e) => setEditedValues(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                          />
                        ) : (
                          <input
                            type="text"
                            value={editedValues[key] || ''}
                            onChange={(e) => setEditedValues(prev => ({ ...prev, [key]: e.target.value }))}
                            className="w-full px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Action buttons inside Extracted Data panel */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleConfirmValues}
                  disabled={confirming || existingDoc.ocr_status === 'processing'}
                  className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-colors shadow-sm"
                >
                  {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck2 className="w-3.5 h-3.5" />}
                  <span>{existingDoc.status === 'confirmed' ? 'Save Changes' : 'Confirm Values'}</span>
                </button>
              </div>

              {/* Merchant Banker Verification Panel (Reviewer Only) */}
              {user?.role === 'reviewer' && (
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-lg space-y-2 mt-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                    <span>Merchant Banker Verification</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                      existingDoc.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                      existingDoc.verification_status === 'changes_requested' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {existingDoc.verification_status ? existingDoc.verification_status.replace(/_/g, ' ') : 'Pending Review'}
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="Add verification remarks..."
                    value={verificationRemarks}
                    onChange={(e) => setVerificationRemarks(e.target.value)}
                    className="w-full px-2.5 py-1 rounded bg-white border border-slate-200 text-xs text-slate-800"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleVerify('verified')}
                      disabled={verifying}
                      className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] rounded transition-colors flex items-center justify-center gap-1"
                    >
                      {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Verify
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify('changes_requested')}
                      disabled={verifying}
                      className="flex-1 py-1 px-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-[11px] rounded transition-colors flex items-center justify-center gap-1"
                    >
                      {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />} Request Changes
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      ) : (
        <label className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${uploading ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20'}`}>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-1 text-indigo-600 text-xs font-semibold py-1">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span>Uploading & Processing OCR...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-slate-500 text-xs">
              <UploadCloud className="w-5 h-5 text-indigo-500" />
              <span className="font-semibold text-slate-700">Click to upload or drag & drop</span>
              <span className="text-[10px] text-slate-400">PDF, PNG, JPG, WEBP (max 10MB)</span>
            </div>
          )}
        </label>
      )}

      {showDeleteConfirm && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-sm w-full p-5 space-y-4 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-950">Remove Document?</h4>
                <p className="text-xs text-slate-500 leading-normal">
                  Are you sure you want to permanently delete this document? This cannot be undone and will reset the section completeness score.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await handleDeleteConfirm();
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-600/10"
              >
                Remove/Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntakeForm() {
  const [searchParams] = useSearchParams();
  const targetStep = searchParams.get('step');
  const targetField = searchParams.get('field');

  const [currentStepIndex, setCurrentStepIndex] = useState(() => {
    if (targetStep) {
      const idx = steps.findIndex((s) => s.key === targetStep);
      if (idx !== -1) return idx;
    }
    return 0;
  });

  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [activeWhy, setActiveWhy] = useState(null);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [allIntake, setAllIntake] = useState({});
  const [documents, setDocuments] = useState([]);
  const [dismissedMismatches, setDismissedMismatches] = useState({});
  const [prefill, setPrefill] = useState([]);
  const [prefillApplying, setPrefillApplying] = useState(false);
  const [prefillDismissed, setPrefillDismissed] = useState(false);
  const [prefillNote, setPrefillNote] = useState('');
  const [highlightedField, setHighlightedField] = useState(null);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';
  const currentStep = steps[currentStepIndex];

  // Sync step index when targetStep changes in searchParams
  useEffect(() => {
    if (targetStep) {
      const idx = steps.findIndex((s) => s.key === targetStep);
      if (idx !== -1 && idx !== currentStepIndex) {
        setCurrentStepIndex(idx);
      }
    }
  }, [targetStep]);

  // Scroll to and highlight target field when navigating from a citation tag
  useEffect(() => {
    if (!loading && targetField) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`field-${targetField}`) || document.getElementById(targetField);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const inputEl = el.querySelector('input, textarea, select') || el;
          if (inputEl && typeof inputEl.focus === 'function') {
            inputEl.focus();
          }
          setHighlightedField(targetField);
          const clearTimer = setTimeout(() => setHighlightedField(null), 3500);
          return () => clearTimeout(clearTimer);
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, currentStepIndex, targetField]);

  // Fetch data for the current step
  const loadStepData = async () => {
    try {
      setLoading(true);
      const res = await getIntakeStep(companyId, currentStep.key);
      setFormData(res.data || res || {});
      setActiveWhy(null);
      setSavedSuccess(false);
      setErrors({});
      setTouched({});
      setDismissedMismatches({});
      setPrefillDismissed(false);
    } catch (err) {
      console.error('Failed to load step data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStepData();
  }, [currentStepIndex, companyId]);

  // Whole-intake snapshot drives the per-module completion ticks in the sidebar.
  const loadAllIntake = useCallback(async () => {
    try {
      const res = await getIntake(companyId);
      setAllIntake(res.data || res || {});
    } catch (err) {
      console.error('Failed to load intake overview:', err);
    }
  }, [companyId]);

  useEffect(() => { loadAllIntake(); }, [loadAllIntake, savedSuccess]);

  // Values the OCR scan pulled out of uploaded documents, ready to drop into the form.
  const loadPrefill = useCallback(async () => {
    try {
      const res = await getPrefillSuggestions(companyId);
      const payload = res.data || res || {};
      setPrefill(payload.suggestions || []);
    } catch (err) {
      // A missing prefill endpoint must never block the questionnaire itself.
      console.error('Failed to load prefill suggestions:', err);
      setPrefill([]);
    }
  }, [companyId]);

  useEffect(() => { loadPrefill(); }, [loadPrefill]);

  // Uploaded documents back the real-time cross-document validation below.
  const loadDocuments = useCallback(async () => {
    try {
      const res = await getDocuments(companyId);
      setDocuments(res.data || res || []);
    } catch (err) {
      console.error('Failed to load documents for validation:', err);
    }
  }, [companyId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Poll while any doc has ocr_status === 'processing'
  useEffect(() => {
    const hasPending = documents.some(d => d.ocr_status === 'processing');
    let timer;
    if (hasPending) {
      timer = setInterval(async () => {
        try {
          const res = await getDocuments(companyId);
          const fresh = res.data || res || [];
          setDocuments(fresh);
          const stillPending = fresh.some(d => d.ocr_status === 'processing');
          if (!stillPending) {
            clearInterval(timer);
            loadPrefill();
            loadAllIntake();
            window.dispatchEvent(new CustomEvent('ipo-readiness-changed'));
          }
        } catch (err) {
          console.error('Polling documents failed:', err);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [documents, companyId, loadPrefill, loadAllIntake]);

  // Only offer suggestions for the step on screen, and only for fields this step
  // actually renders. The document map extracts more keys than the questionnaire
  // asks for (net_worth, total_assets, ...); offering those would ask the promoter
  // to approve a change to a field they cannot see, labelled with a raw key name.
  const stepPrefill = prefill.filter(
    (s) => s.step === currentStep.key &&
      (stepQuestions[currentStep.key] || []).some((q) => q.name === s.field)
  );
  const blanksHere = stepPrefill.filter((s) => !s.conflict);

  // Fills every empty field on this step from the documents. Conflicts are left
  // alone: an answer the promoter already gave is theirs to change, via the
  // per-field mismatch card below.
  const handleApplyPrefill = async () => {
    try {
      setPrefillApplying(true);
      const res = await applyPrefill(companyId, {
        fields: blanksHere.map((s) => `${s.step}.${s.field}`)
      });
      const payload = res.data || res || {};
      setPrefillNote(payload.message || 'Filled from your documents.');
      await loadStepData();
      await loadPrefill();
      await loadAllIntake();
      setTimeout(() => setPrefillNote(''), 4000);
    } catch (err) {
      console.error('Failed to apply prefill:', err);
      setPrefillNote('Could not auto-fill right now. Please enter the values manually.');
      setTimeout(() => setPrefillNote(''), 4000);
    } finally {
      setPrefillApplying(false);
    }
  };

  // Compares a live field value against the matching OCR-extracted document value.
  const mismatchFor = (q) => {
    if (dismissedMismatches[q.name]) return null;
    return checkFieldAgainstDocuments(currentStep.key, q.name, formData[q.name], documents);
  };

  // A module counts as done when every non-conditional field carries a value.
  const moduleStatus = (stepKey) => {
    const data = stepKey === currentStep.key ? formData : (allIntake[stepKey] || {});
    const qs = stepQuestions[stepKey] || [];
    const req = qs.filter((q) => !q.optional && (!q.dependsOn || data[q.dependsOn] === 'yes'));
    if (!req.length) return 'complete';
    const filled = req.filter((q) => String(data[q.name] ?? '').trim() !== '').length;
    if (filled === 0) return 'empty';
    return filled === req.length ? 'complete' : 'partial';
  };

  // ── Inline validation ──────────────────────────────────────────────────────
  const validateField = (q, value) => {
    const val = String(value ?? '').trim();
    if (q.optional) return '';
    if (!val) return `${q.label} is required.`;

    if (q.name === 'cin' && !/^[A-Za-z0-9]{21}$/.test(val)) {
      return 'CIN must be exactly 21 alphanumeric characters.';
    }
    if (q.type === 'number') {
      if (Number.isNaN(Number(val))) return 'Please enter a valid number.';
      if (Number(val) < 0) return 'Value cannot be negative.';
      if (q.name === 'promoter_holding_pct' && (Number(val) > 100 || Number(val) <= 0)) {
        return 'Shareholding must be between 0 and 100 percent.';
      }
    }
    if (q.type === 'date' && val) {
      const d = new Date(val);
      if (Number.isNaN(d.getTime())) return 'Please enter a valid date.';
      if (d > new Date()) return 'Date cannot be in the future.';
    }
    return '';
  };

  const questions = getAdaptiveStepQuestions(currentStep.key, allIntake);

  const validateStep = () => {
    const nextErrors = {};
    questions.forEach((q) => {
      // "Details" fields only matter when the paired yes/no answer is "yes".
      if (q.dependsOn && formData[q.dependsOn] !== 'yes') return;
      const msg = validateField(q, formData[q.name]);
      if (msg) nextErrors[q.name] = msg;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  // Progress across the whole intake step (share of required fields completed).
  const requiredQs = questions.filter((q) => !q.optional && (!q.dependsOn || formData[q.dependsOn] === 'yes'));
  const completedCount = requiredQs.filter((q) => String(formData[q.name] ?? '').trim() !== '').length;
  const stepProgress = requiredQs.length ? Math.round((completedCount / requiredQs.length) * 100) : 100;

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    const q = questions.find((f) => f.name === name);
    if (q && touched[name]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(q, value) }));
    }
  };

  const handleBlur = (q) => {
    setTouched((prev) => ({ ...prev, [q.name]: true }));
    if (q.dependsOn && formData[q.dependsOn] !== 'yes') return;
    setErrors((prev) => ({ ...prev, [q.name]: validateField(q, formData[q.name]) }));
    // Persist as the promoter moves off the field, so the readiness score credits
    // it right away rather than only when the section is submitted. Silent by
    // design: "Save Progress" and "Next Step" still drive the visible confirmation,
    // and a failure here is not worth interrupting typing over — the explicit
    // save will surface it.
    autoSaveField(q);
  };

  // Fire-and-forget per-field save. Skipped when the value has not changed since
  // the last load or save, so tabbing through a filled form makes no requests.
  const savedValuesRef = useRef({});
  useEffect(() => { savedValuesRef.current = { ...formData }; }, [currentStepIndex]);

  const autoSaveField = async (q) => {
    const value = formData[q.name];
    if (String(savedValuesRef.current[q.name] ?? '') === String(value ?? '')) return;
    if (String(value ?? '').trim() === '') return;      // nothing to credit yet
    if (validateField(q, value)) return;                 // don't persist invalid input
    savedValuesRef.current = { ...savedValuesRef.current, [q.name]: value };
    try {
      await saveIntakeStep(companyId, currentStep.key, { ...formData, [q.name]: value });
      loadAllIntake();
    } catch (err) {
      // Roll back the guard so the next blur (or explicit save) retries.
      delete savedValuesRef.current[q.name];
      console.error('Auto-save on blur failed:', err);
    }
  };

  const handleSave = async (advance = false) => {
    // Advancing requires a valid step; plain "Save Progress" always works so
    // promoters can stop half-way and resume later.
    if (advance) {
      const allTouched = {};
      questions.forEach((q) => { allTouched[q.name] = true; });
      setTouched(allTouched);
      if (!validateStep()) return;
    }
    try {
      setSaving(true);
      setSavedSuccess(false);
      await saveIntakeStep(companyId, currentStep.key, formData);
      // Keep the blur-autosave guard aligned with what is now persisted, so an
      // explicit save doesn't leave stale entries that suppress later autosaves.
      savedValuesRef.current = { ...formData };
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      
      if (advance) {
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          navigate('/compliance-checklist');
        }
      }
    } catch (err) {
      console.error('Failed to save step:', err);
    } finally {
      setSaving(false);
    }
  };

  // Fills every field in the section on screen with its sample value, in one
  // action. This replaced a per-field "Auto-Fill Sample" button on every row —
  // same sample data, same validation, just one trigger per section instead of
  // one per field. Conditional fields whose parent answer is not "yes" are
  // skipped so the form does not populate rows the promoter cannot see.
  const fillSectionExamples = () => {
    const next = { ...formData };
    // Parents first, so a dependent field sees the sample value its parent just got.
    questions.filter((q) => !q.dependsOn).forEach((q) => {
      if (q.example !== undefined) next[q.name] = q.example;
    });
    questions.filter((q) => q.dependsOn).forEach((q) => {
      // A dependent field only applies once its parent answer is "yes".
      if (q.example !== undefined && next[q.dependsOn] === 'yes') next[q.name] = q.example;
    });
    setFormData(next);
    // Re-validate anything already touched so error text tracks the new values.
    setErrors((prev) => {
      const updated = { ...prev };
      questions.forEach((q) => {
        if (touched[q.name]) updated[q.name] = validateField(q, next[q.name]);
      });
      return updated;
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-fade-in">
      
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-2">
        <h3 className="font-bold text-slate-800 text-sm px-3 mb-4 uppercase tracking-wider">Intake Sections</h3>
        <div className="space-y-1">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStepIndex;
            const status = moduleStatus(step.key);
            return (
              <button
                key={step.key}
                onClick={() => setCurrentStepIndex(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{step.label}</span>
                {status === 'complete' ? (
                  <Check className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-emerald-500'}`} title="Module complete" />
                ) : status === 'partial' ? (
                  <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-white/70' : 'bg-amber-400'}`} title="In progress" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Questionnaire Body */}
      <div className="lg:col-span-3 space-y-6">
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="border-b border-slate-100 pb-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest font-mono">Step {currentStepIndex + 1} of {steps.length}</span>
                  {(() => {
                    const classification = classifyCompany({ name: companyId }, allIntake, documents);
                    return (
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1 border border-slate-200" title={classification.aiExplanation}>
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        {classification.businessCategory}
                      </span>
                    );
                  })()}
                </div>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{currentStep.label}</h2>
              </div>
              <div className="flex items-center gap-3">
                {savedSuccess && (
                  <span className="flex items-center gap-1 text-emerald-600 text-xs font-semibold animate-pulse">
                    <Check className="w-4 h-4" /> Progress Saved
                  </span>
                )}
                {/* One trigger for the whole section, replacing the per-field
                    "Auto-Fill Sample" buttons that used to sit on every row. */}
                <button
                  type="button"
                  onClick={fillSectionExamples}
                  disabled={loading}
                  className="text-[10px] text-indigo-600 hover:text-indigo-800 disabled:opacity-50 transition-colors font-medium border border-indigo-200/50 hover:border-indigo-400 px-2 py-0.5 rounded bg-indigo-50/20"
                >
                  Auto-Fill Section
                </button>
              </div>
            </div>

            {/* Section progress indicator */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section Progress</span>
                <span className={`text-[10px] font-bold ${stepProgress === 100 ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {completedCount} of {requiredQs.length} required · {stepProgress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${stepProgress === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                  style={{ width: `${stepProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* ── Auto-fill from scanned documents ──────────────────────────────
              Values OCR read out of the uploaded files. Blanks can be filled in
              one click; conflicts stay with the per-field card so the promoter
              always sees both numbers before overwriting their own answer. */}
          {!loading && !prefillDismissed && stepPrefill.length > 0 && (
            <div className="mb-6 p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3 animate-slide-up">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-indigo-900 leading-tight">
                      We read {stepPrefill.length} value{stepPrefill.length === 1 ? '' : 's'} for this section from your documents
                    </p>
                    <p className="text-[11px] text-indigo-800/80 mt-0.5">
                      {blanksHere.length > 0
                        ? `${blanksHere.length} empty field${blanksHere.length === 1 ? '' : 's'} can be filled automatically.`
                        : 'Every value here differs from what you entered — review each one below.'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPrefillDismissed(true)}
                  className="text-[10px] font-semibold text-indigo-700 hover:text-indigo-900 underline decoration-indigo-300 shrink-0"
                >
                  Not now
                </button>
              </div>

              <div className="space-y-1.5">
                {stepPrefill.map((s) => {
                  const q = questions.find((f) => f.name === s.field);
                  return (
                    <div key={s.field} className="flex items-center justify-between gap-2 text-[11px] bg-white/70 rounded-lg px-2.5 py-1.5 border border-indigo-100">
                      <span className="font-semibold text-slate-700 truncate">{q?.label || s.field}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-semibold text-emerald-700 truncate max-w-[12rem]" title={String(s.value)}>
                          {String(s.value)}
                        </span>
                        {s.conflict ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                            Differs
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Blank
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[10px] text-indigo-800/70 leading-normal">
                Source: {[...new Set(stepPrefill.map((s) => s.source_document).filter(Boolean))].join(', ')}
              </p>

              {blanksHere.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyPrefill}
                  disabled={prefillApplying}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {prefillApplying
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Sparkles className="w-3.5 h-3.5" />}
                  Fill {blanksHere.length} empty field{blanksHere.length === 1 ? '' : 's'}
                </button>
              )}

              {prefillNote && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                  <Check className="w-3.5 h-3.5 shrink-0" /> {prefillNote}
                </p>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[30vh]">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
          ) : (
            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
              {/* Section Uploads & Supporting Documents (Placed at the top of the intake section) */}
              {(() => {
                const sectionUploads = getAdaptiveSectionUploads(currentStep.key, allIntake);
                if (!sectionUploads.length) return null;
                return (
                  <div className="mb-8 border-b border-slate-200/80 pb-6 space-y-4">
                    <div>
                      <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <UploadCloud className="w-4 h-4 text-indigo-600" /> Section Uploads & Supporting Documents ({currentStep.label})
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Upload required documents for this section. Uploaded files are automatically processed via AI understanding and OCR.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sectionUploads.map((slot) => (
                        <DocumentUploadSlot
                          key={slot.docType}
                          slot={slot}
                          companyId={companyId}
                          documents={documents}
                          setDocuments={setDocuments}
                          formData={formData}
                          currentStepKey={currentStep.key}
                          allIntake={allIntake}
                          onUploadSuccess={async () => {
                            try {
                              const res = await getDocuments(companyId);
                              setDocuments(res.data || res || []);
                              await loadPrefill();
                              await loadAllIntake();
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {questions.map((q) => {
                const isRequired = !q.optional && (!q.dependsOn || formData[q.dependsOn] === 'yes');
                const err = errors[q.name];
                const mismatch = mismatchFor(q);
                const isHighlighted = highlightedField === q.name;
                const fieldClass = `input-field ${err ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20' : mismatch ? 'border-amber-400 focus:border-amber-500 focus:ring-amber-500/20' : isHighlighted ? 'border-indigo-500 ring-2 ring-indigo-500/40' : ''}`;
                return (
                <div 
                  key={q.name} 
                  id={`field-${q.name}`}
                  data-field={q.name}
                  className={`space-y-2 relative group p-3 rounded-2xl transition-all duration-500 ${isHighlighted ? 'bg-indigo-50/80 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                      {q.label}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold normal-case tracking-normal ${isRequired ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                        {isRequired ? 'Required' : 'Optional'}
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveWhy(activeWhy === q.name ? null : q.name)}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="Why we're asking this"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {activeWhy === q.name && (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-900 leading-normal animate-slide-up">
                      <strong>Why we're asking this:</strong> {q.why}
                    </div>
                  )}

                  {q.type === 'textarea' ? (
                    <textarea
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      onBlur={() => handleBlur(q)}
                      placeholder={q.placeholder}
                      className={`${fieldClass} min-h-24 py-2 resize-none`}
                    />
                  ) : q.type === 'select' ? (
                    <select
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      onBlur={() => handleBlur(q)}
                      className={`${fieldClass} appearance-none bg-no-repeat bg-right pr-10`}
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
                    >
                      <option value="">Select option...</option>
                      {q.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : q.type === 'repeatable' ? (
                    <RepeatableFieldGroup
                      q={q}
                      value={formData[q.name]}
                      onChange={(val) => handleInputChange(q.name, val)}
                    />
                  ) : (
                    <input
                      type={q.type}
                      value={formData[q.name] || ''}
                      onChange={(e) => handleInputChange(q.name, e.target.value)}
                      onBlur={() => handleBlur(q)}
                      placeholder={q.placeholder}
                      className={fieldClass}
                    />
                  )}

                  {err && (
                    <div className="flex items-center gap-1.5 text-red-600 text-[11px] font-medium">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{err}</span>
                    </div>
                  )}

                  {/* Real-time cross-document validation */}
                  {!err && mismatch && (
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-slide-up">
                      <div className="flex items-start gap-1.5">
                        <FileSearch className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-amber-900 leading-tight">
                            Doesn't match your uploaded document
                          </p>
                          <p className="text-[10px] text-amber-800/80 mt-0.5 truncate" title={mismatch.docName}>
                            Source: {mismatch.docName}
                            {mismatch.docStatus !== 'confirmed' && ' (pending your confirmation)'}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-sans font-bold">You entered</p>
                          <p className="font-semibold text-red-700 break-words">{mismatch.enteredDisplay}</p>
                        </div>
                        <div className="bg-white/80 rounded-lg p-2 border border-amber-200/60">
                          <p className="text-[9px] text-slate-400 uppercase tracking-wider font-sans font-bold">Document says</p>
                          <p className="font-semibold text-emerald-700 break-words">{mismatch.docDisplay}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleInputChange(q.name, mismatch.suggestedValue)}
                          className="text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Use document value
                        </button>
                        <button
                          type="button"
                          onClick={() => setDismissedMismatches((prev) => ({ ...prev, [q.name]: true }))}
                          className="text-[10px] font-semibold text-amber-800 hover:text-amber-950 underline decoration-amber-300"
                        >
                          Keep mine — my value is correct
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}

              {/* Navigation Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 pt-6 mt-8">
                <button
                  type="button"
                  disabled={currentStepIndex === 0}
                  onClick={() => setCurrentStepIndex((prev) => prev - 1)}
                  className="flex items-center gap-2 text-slate-500 hover:text-slate-800 disabled:opacity-30 transition-all font-semibold text-xs uppercase self-start"
                >
                  <ArrowLeft className="w-4 h-4" /> Prev Step
                </button>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={saving}
                    className="flex items-center gap-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 px-4 py-2.5 rounded-xl transition-all text-xs font-bold uppercase"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Progress
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                    className="btn-primary flex items-center gap-1.5 text-xs font-bold uppercase shadow-indigo-600/10"
                  >
                    <span>Save & Next</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

            </form>
          )}
        </div>
      </div>

    </div>
  );
}
