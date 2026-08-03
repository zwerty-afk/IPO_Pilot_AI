import { useState, useEffect, useRef, useCallback } from 'react';
import { getDocuments, uploadDocument, confirmDocument, deleteDocument, verifyDocument, retryDocumentOcr } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { 
  FileText, 
  UploadCloud, 
  Check, 
  Trash2, 
  AlertTriangle, 
  Edit3, 
  Eye,
  Loader2,
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Info,
  RefreshCw
} from 'lucide-react';

const docTypeLabels = {
  incorporation_certificate: "Certificate of Incorporation",
  audited_financials: "Audited Financials Summary",
  cap_table: "Certified Cap Table",
  litigation_records: "Litigation & Notice Records"
};

// OCR status badge component
function OcrStatusBadge({ status, error }) {
  if (status === 'completed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
      <CheckCircle2 className="w-3 h-3" /> OCR Done
    </span>
  );
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5" title={error || ''}>
      <XCircle className="w-3 h-3" /> OCR Failed
    </span>
  );
  if (status === 'processing') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
      <Loader2 className="w-3 h-3 animate-spin" /> Processing…
    </span>
  );
  return null;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadWarning, setUploadWarning] = useState(null);
  const [docType, setDocType] = useState('audited_financials');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationRemarks, setVerificationRemarks] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const [retryingOcr, setRetryingOcr] = useState(false);
  // Ids with a DELETE in flight. Without this, a double-click fired the request
  // twice and the second one 404'd on a document the first had already removed,
  // reporting "Document not found" for a delete that actually succeeded.
  const [deletingIds, setDeletingIds] = useState([]);
  const pollTimerRef = useRef(null);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const handleVerifyDoc = async (status) => {
    if (!selectedDoc) return;
    try {
      setVerifying(true);
      await verifyDocument(selectedDoc.id, status, verificationRemarks);
      await loadDocs();
      setSelectedDoc(prev => ({ ...prev, verification_status: status, verification_remarks: verificationRemarks }));
      setVerificationRemarks('');
    } catch (err) {
      console.error('Failed to verify document:', err);
    } finally {
      setVerifying(false);
    }
  };

  const loadDocs = useCallback(async () => {
    try {
      const res = await getDocuments(companyId);
      const docs = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
      setDocuments(docs);
      return docs;
    } catch (err) {
      console.error("Failed to load documents:", err);
      return [];
    }
  }, [companyId]);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDocs();
      setLoading(false);
    })();
  }, [loadDocs]);

  // Poll while any doc has ocr_status === 'processing'
  useEffect(() => {
    const hasPending = documents.some(d => d.ocr_status === 'processing');
    if (hasPending && !pollTimerRef.current) {
      pollTimerRef.current = setInterval(async () => {
        const fresh = await loadDocs();
        const stillPending = fresh.some(d => d.ocr_status === 'processing');
        if (!stillPending) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          // Refresh selected doc with latest data
          setSelectedDoc(prev => {
            if (!prev) return prev;
            const updated = fresh.find(d => d.id === prev.id);
            if (updated) setEditedValues(updated.extracted_values || {});
            return updated || prev;
          });
        }
      }, 3000);
    }
    if (!hasPending && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [documents, loadDocs]);

  const handleFileChange = (e) => {
    setUploadError(null);
    setUploadWarning(null);
    if (e.target.files && e.target.files.length > 0) {
      const f = e.target.files[0];
      // Client-side size check (10 MB)
      if (f.size > 10 * 1024 * 1024) {
        setUploadError('File is too large. Maximum allowed size is 10 MB.');
        return;
      }
      setSelectedFile(f);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    setUploadError(null);
    setUploadWarning(null);
    try {
      setUploading(true);
      const res = await uploadDocument(companyId, selectedFile, docType);
      const newDoc = res.data || res;
      if (newDoc.message && newDoc.message.startsWith('Warning')) {
        setUploadWarning(newDoc.message);
      }
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('doc-file-input');
      if (fileInput) fileInput.value = '';
      const freshDocs = await loadDocs();
      // Auto-select the newly uploaded doc
      const uploaded = freshDocs.find(d => d.id === newDoc.id) || newDoc;
      setSelectedDoc(uploaded);
      setEditedValues(uploaded.extracted_values || {});
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Upload failed. Please try again.';
      setUploadError(msg);
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDoc = (doc) => {
    setSelectedDoc(doc);
    setEditedValues(doc.extracted_values || {});
    setDeleteError(null);
  };

  const handleValChange = (key, val) => {
    setEditedValues(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirm = async () => {
    if (!selectedDoc) return;
    try {
      setConfirming(true);
      await confirmDocument(selectedDoc.id, editedValues);
      const fresh = await loadDocs();
      const updated = fresh.find(d => d.id === selectedDoc.id);
      if (updated) setSelectedDoc(updated);
    } catch (err) {
      console.error("Confirmation failed:", err);
    } finally {
      setConfirming(false);
    }
  };

  const handleRetryOcr = async (docId) => {
    setRetryingOcr(true);
    try {
      await retryDocumentOcr(docId);
      const fresh = await loadDocs();
      const updated = fresh.find(d => d.id === docId);
      if (updated) {
        setSelectedDoc(updated);
        setEditedValues(updated.extracted_values || {});
      }
    } catch (err) {
      console.error('OCR retry failed:', err);
    } finally {
      setRetryingOcr(false);
    }
  };

  const handleDelete = async (docId) => {
    // Ignore repeat clicks on a row that is already being deleted.
    if (deletingIds.includes(docId)) return;
    if (!window.confirm("Are you sure you want to permanently delete this document? This cannot be undone.")) return;
    setDeleteError(null);
    setDeletingIds(prev => [...prev, docId]);
    try {
      await deleteDocument(docId);
      // Drop the row and close the detail panel immediately, so the document
      // stops being shown without the user having to close the panel first.
      setDocuments(prev => prev.filter(d => d.id !== docId));
      setSelectedDoc(prev => (prev?.id === docId ? null : prev));
      await loadDocs();
    } catch (err) {
      // A 404 means the document is already gone — that is the outcome the user
      // asked for, so reconcile the list instead of reporting a failure.
      if (err.response?.status === 404) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        setSelectedDoc(prev => (prev?.id === docId ? null : prev));
        await loadDocs();
      } else {
        const msg = err.response?.data?.message || err.message || 'Deletion failed. Please try again.';
        setDeleteError(msg);
        console.error("Deletion failed:", err);
      }
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== docId));
    }
  };

  // Renders the document preview — real OCR text if available, simulated if not
  const renderDocumentPreview = (doc) => {
    // If OCR text is available from real extraction, show it
    if (doc.ocr_text) {
      return (
        <div className="border border-slate-300 bg-white rounded-xl shadow-inner p-5 font-mono text-xs text-slate-800 space-y-3 max-h-[400px] overflow-y-auto">
          <div className="flex items-center justify-between border-b pb-2">
            <p className="font-bold text-slate-900 text-sm uppercase">{doc.name}</p>
            <OcrStatusBadge status={doc.ocr_status} error={doc.ocr_error} />
          </div>
          <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider">Gemini OCR — Extracted Text</p>
          <pre className="whitespace-pre-wrap leading-relaxed text-[11px] text-slate-700">{doc.ocr_text}</pre>
        </div>
      );
    }

    // OCR still processing
    if (doc.ocr_status === 'processing') {
      return (
        <div className="border border-amber-200 bg-amber-50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 h-80">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-sm font-semibold text-amber-800">Gemini OCR in progress…</p>
          <p className="text-xs text-amber-600 text-center max-w-xs">Extracting structured data from your document. This page refreshes automatically.</p>
          {/* An extraction interrupted mid-run leaves the record on "processing"
              with nothing left to finish it, which used to spin forever. */}
          <button
            type="button"
            onClick={() => handleRetryOcr(doc.id)}
            disabled={retryingOcr}
            className="flex items-center gap-2 px-3 py-1.5 text-amber-700 rounded-lg text-[11px] font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retryingOcr
              ? <><Loader2 className="w-3 h-3 animate-spin" />Restarting…</>
              : <><RefreshCw className="w-3 h-3" />Taking too long? Restart extraction</>}
          </button>
        </div>
      );
    }

    // OCR failed
    if (doc.ocr_status === 'failed') {
      return (
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 space-y-3 h-80 flex flex-col items-center justify-center gap-3">
          <XCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm font-semibold text-red-800">OCR Extraction Failed</p>
          {doc.ocr_error && <p className="text-[11px] text-red-600 text-center max-w-xs font-mono">{doc.ocr_error}</p>}
          <button
            type="button"
            onClick={() => handleRetryOcr(doc.id)}
            disabled={retryingOcr}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-300 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {retryingOcr
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Retrying extraction…</>
              : <><RefreshCw className="w-3.5 h-3.5" />Retry Extraction</>}
          </button>
          <p className="text-xs text-red-500 text-center max-w-xs">Most failures are temporary. If it fails again, you can enter values manually in the Extracted Values panel.</p>
        </div>
      );
    }

    // Seeded / legacy docs — show simulated preview
    if (doc.doc_type === 'audited_financials') {
      return (
        <div className="border border-slate-300 bg-white rounded-xl shadow-inner p-6 font-mono text-xs text-slate-800 space-y-4 max-h-[400px] overflow-y-auto">
          <div className="text-center font-bold border-b pb-2 text-slate-900 text-sm">
            MEHRA & ASSOCIATES — CHARTERED ACCOUNTANTS<br/>
            AUDIT REPORT FOR FY 2024-25
          </div>
          <div className="space-y-1">
            <p><strong>Entity Name:</strong> Aarav Precision Engineering Private Limited</p>
            <p><strong>CIN:</strong> U29220MH2015PTC263456</p>
          </div>
          <div className="border-t border-b py-2 space-y-2">
            <p className="font-bold text-slate-900">STATEMENT OF PROFIT & LOSS</p>
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[320px] text-left">
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
          </div>
          <p className="text-[10px] text-slate-400 italic">Signed & Certified. Date: June 15, 2025.</p>
        </div>
      );
    }

    if (doc.doc_type === 'cap_table') {
      return (
        <div className="border border-slate-300 bg-white rounded-xl shadow-inner p-6 font-mono text-xs text-slate-800 space-y-4 max-h-[400px] overflow-y-auto">
          <div className="text-center font-bold border-b pb-2 text-slate-900 text-sm">
            CERTIFIED SHAREHOLDING STRUCTURE AS OF MARCH 31, 2026
          </div>
          <div className="space-y-1"><p><strong>Company Name:</strong> Aarav Precision Engineering Pvt Ltd</p></div>
          <div className="border-t border-b py-2 space-y-2">
            <p className="font-bold text-slate-900">SHARE DISTRIBUTION REGISTER</p>
            <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[340px] text-left">
              <thead><tr className="border-b"><th>Name of Shareholder</th><th>Shares</th><th className="text-right">Holding %</th></tr></thead>
              <tbody>
                <tr className="bg-yellow-50 font-semibold border-b"><td>Aarav Mehta (Promoter)</td><td>620,000</td><td className="text-right text-red-700">62.00%</td></tr>
                <tr className="border-b"><td>Rohan Mehta (Promoter)</td><td>350,000</td><td className="text-right">35.00%</td></tr>
                <tr className="border-b"><td>Minority Public Owners</td><td>30,000</td><td className="text-right">3.00%</td></tr>
                <tr className="font-bold"><td>Total Capitalization</td><td>1,000,000</td><td className="text-right">100.00%</td></tr>
              </tbody>
            </table>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic">Certified by CS Rohan Kapur, FCS 1290. Stamp Attached.</p>
        </div>
      );
    }

    // Generic fallback
    return (
      <div className="border border-slate-300 bg-slate-50 rounded-xl p-5 text-xs text-slate-700 font-mono space-y-3 h-80 overflow-y-auto">
        <h4 className="font-bold border-b pb-2 text-slate-800 uppercase">{doc.name}</h4>
        <p className="text-[11px] uppercase text-indigo-500 font-bold">Extracted Values:</p>
        <pre className="whitespace-pre-wrap">{JSON.stringify(doc.extracted_values, null, 2)}</pre>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-900">Document Upload & OCR Extraction</h2>
        <p className="text-slate-500 text-sm mt-1">
          Upload SEBI disclosure documents to run OCR extraction, view data discrepancies, and confirm parsed outputs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Upload Form and List (Left/Top) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Upload New Document</h3>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Document Type</label>
                <select 
                  value={docType} 
                  onChange={(e) => setDocType(e.target.value)}
                  className="input-field py-2.5 bg-no-repeat bg-right pr-10"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundSize: '1.25rem' }}
                >
                  <option value="incorporation_certificate">Certificate of Incorporation</option>
                  <option value="audited_financials">Audited Financials Summary</option>
                  <option value="cap_table">Certified Cap Table</option>
                  <option value="litigation_records">Litigation Records</option>
                </select>
              </div>

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 hover:bg-slate-50 transition-colors text-center relative group">
                <input 
                  id="doc-file-input"
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-indigo-500 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {selectedFile ? selectedFile.name : 'Select or drag file'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">PDF, PNG, JPG, WEBP (max 10MB)</span>
              </div>

              {/* Upload error */}
              {uploadError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700 leading-normal">{uploadError}</p>
                </div>
              )}

              {/* Duplicate warning */}
              {uploadWarning && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-normal">{uploadWarning}</p>
                </div>
              )}

              <button 
                type="submit" 
                disabled={!selectedFile || uploading}
                className="w-full btn-primary flex items-center justify-center gap-1.5 text-xs font-bold uppercase shadow-indigo-600/10 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploading ? 'Uploading & Extracting...' : 'Upload & Extract'}
              </button>
            </form>

            {/* OCR Info note */}
            <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-indigo-600 leading-normal">
                Powered by <strong>Gemini OCR</strong>. Extraction completes in ~10–20s after upload. Values auto-populate below.
              </p>
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Uploaded Documents</h3>
            
            {/* Delete error */}
            {deleteError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-red-700 leading-normal">{deleteError}</p>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
            ) : documents.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No documents uploaded.</div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    onClick={() => handleSelectDoc(doc)}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all hover:bg-slate-50 ${selectedDoc?.id === doc.id ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</p>
                        <span className="text-[10px] text-slate-400 block mt-0.5">{docTypeLabels[doc.doc_type] || doc.doc_type}</span>
                        {/* OCR status inline */}
                        {doc.ocr_status && (
                          <div className="mt-1">
                            <OcrStatusBadge status={doc.ocr_status} error={doc.ocr_error} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={doc.status} />
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                        disabled={deletingIds.includes(doc.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                        title={deletingIds.includes(doc.id) ? 'Deleting…' : 'Delete document'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Verification Workspace (Right/Bottom) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedDoc ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Side-by-Side OCR Verification</h3>
                  <span className="text-slate-500 text-xs mt-0.5 block">{selectedDoc.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedDoc.ocr_status && <OcrStatusBadge status={selectedDoc.ocr_status} error={selectedDoc.ocr_error} />}
                  <StatusBadge status={selectedDoc.status} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Pane: Document View (real OCR text or simulated) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> Source Document View
                    </span>
                    <a
                      href={`/api/documents/${selectedDoc.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100"
                      title="Fetch raw uploaded file from AWS S3 / Server Storage"
                    >
                      Cloud File (AWS S3) ↗
                    </a>
                  </div>
                  {renderDocumentPreview(selectedDoc)}
                </div>

                {/* Right Pane: OCR Output Form */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" /> Extracted Values (Correctable)
                  </span>

                  {selectedDoc.ocr_status === 'processing' ? (
                    <div className="p-6 bg-amber-50 border border-amber-100 rounded-xl flex flex-col items-center gap-3">
                      <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                      <p className="text-xs text-amber-700 font-semibold text-center">OCR running — values will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60 max-h-[400px] overflow-y-auto">
                      {Object.keys(editedValues).length === 0 ? (
                        <p className="text-xs text-slate-400 text-center py-4">
                          {selectedDoc.ocr_status === 'failed' 
                            ? 'OCR failed. Add values manually below or re-upload the document.'
                            : 'No extracted values yet.'}
                        </p>
                      ) : (
                        Object.keys(editedValues).map((key) => (
                          <div key={key} className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">{key.replace(/_/g, ' ')}</label>
                            <input 
                              type="text" 
                              value={editedValues[key] || ''} 
                              onChange={(e) => handleValChange(key, e.target.value)}
                              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-mono"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {selectedDoc.status === 'uploaded' && selectedDoc.ocr_status !== 'processing' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 leading-normal">
                        Confirming the values binds them as the official data source. Any mismatched numbers between these fields and the promoter intake responses will be flagged on the dashboard.
                      </p>
                    </div>
                  )}

                  {/* Merchant Banker Verification Panel */}
                  {user?.role === 'reviewer' && (
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">Merchant Banker Verification</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          selectedDoc.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                          selectedDoc.verification_status === 'changes_requested' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {selectedDoc.verification_status ? selectedDoc.verification_status.replace(/_/g, ' ') : 'Pending Review'}
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="Add review comments or remarks..."
                        value={verificationRemarks}
                        onChange={(e) => setVerificationRemarks(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleVerifyDoc('verified')}
                          disabled={verifying}
                          className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Verify
                        </button>
                        <button
                          onClick={() => handleVerifyDoc('changes_requested')}
                          disabled={verifying}
                          className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                          Request Changes
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button 
                      onClick={() => setSelectedDoc(null)}
                      className="flex-1 btn-secondary text-xs text-center py-2"
                    >
                      Close Panel
                    </button>
                    <button 
                      onClick={handleConfirm}
                      disabled={confirming || selectedDoc.ocr_status === 'processing'}
                      className="flex-1 btn-primary flex items-center justify-center gap-1 text-xs text-center py-2 shadow-indigo-600/10 disabled:opacity-50"
                    >
                      {confirming ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : <FileCheck2 className="w-4.5 h-4.5" />}
                      <span>{selectedDoc.status === 'confirmed' ? 'Save Changes' : 'Confirm Values'}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-12 text-center h-[500px] flex flex-col justify-center items-center">
              <Eye className="w-12 h-12 text-slate-300 mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">Select Document to Audit</h3>
              <p className="text-slate-500 text-xs max-w-sm mt-1 mx-auto leading-normal">
                Click on any uploaded document in the list to open the side-by-side OCR review pane and verify the extracted values.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
