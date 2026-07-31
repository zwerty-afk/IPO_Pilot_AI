import { useState, useEffect } from 'react';
import { getDocuments, uploadDocument, confirmDocument, deleteDocument } from '../services/api';
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
  FileCheck2
} from 'lucide-react';

const docTypeLabels = {
  incorporation_certificate: "Certificate of Incorporation",
  audited_financials: "Audited Financials Summary",
  cap_table: "Certified Cap Table",
  litigation_records: "Litigation & Notice Records"
};

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('audited_financials');
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editedValues, setEditedValues] = useState({});
  const [confirming, setConfirming] = useState(false);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadDocs = async () => {
    try {
      setLoading(true);
      const res = await getDocuments(companyId);
      setDocuments(res.data || res || []);
    } catch (err) {
      console.error("Failed to load documents:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs();
  }, [companyId]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;
    try {
      setUploading(true);
      const res = await uploadDocument(companyId, selectedFile, docType);
      setSelectedFile(null);
      await loadDocs();
      // Select newly uploaded document for instant verification workflow
      setSelectedDoc(res.data || res);
      setEditedValues((res.data || res).extracted_values || {});
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleSelectDoc = (doc) => {
    setSelectedDoc(doc);
    setEditedValues(doc.extracted_values || {});
  };

  const handleValChange = (key, val) => {
    setEditedValues(prev => ({ ...prev, [key]: val }));
  };

  const handleConfirm = async () => {
    if (!selectedDoc) return;
    try {
      setConfirming(true);
      await confirmDocument(selectedDoc.id, editedValues);
      setSelectedDoc(null);
      await loadDocs();
    } catch (err) {
      console.error("Confirmation failed:", err);
    } finally {
      setConfirming(false);
    }
  };

  const handleDelete = async (docId) => {
    if(!window.confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteDocument(docId);
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      await loadDocs();
    } catch (err) {
      console.error("Deletion failed:", err);
    }
  };

  // Helper to render simulated PDF layout for selected doc in demo
  const renderSimulatedPdf = (doc) => {
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
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th>Particulars</th><th className="text-right">FY 2024-25</th></tr>
              </thead>
              <tbody>
                <tr className="bg-yellow-50 font-semibold border-b">
                  <td>Revenue from Operations</td>
                  <td className="text-right text-red-700">118,000,000 INR</td>
                </tr>
                <tr className="border-b"><td>Other Income</td><td className="text-right">2,100,000 INR</td></tr>
                <tr className="font-bold border-b"><td>Total Revenue</td><td className="text-right">120,100,000 INR</td></tr>
                <tr className="border-b"><td>Cost of Materials</td><td className="text-right">72,500,000 INR</td></tr>
                <tr className="border-b"><td>Employee Benefit Exp</td><td className="text-right">18,300,000 INR</td></tr>
                <tr className="bg-slate-100 font-semibold">
                  <td>Profit After Tax (PAT)</td>
                  <td className="text-right text-emerald-800">11,000,000 INR</td>
                </tr>
              </tbody>
            </table>
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
          <div className="space-y-1">
            <p><strong>Company Name:</strong> Aarav Precision Engineering Pvt Ltd</p>
          </div>
          <div className="border-t border-b py-2 space-y-2">
            <p className="font-bold text-slate-900">SHARE DISTRIBUTION REGISTER</p>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b"><th>Name of Shareholder</th><th>Shares</th><th className="text-right">Holding %</th></tr>
              </thead>
              <tbody>
                <tr className="bg-yellow-50 font-semibold border-b">
                  <td>Aarav Mehta (Promoter)</td>
                  <td>620,000</td>
                  <td className="text-right text-red-700">62.00%</td>
                </tr>
                <tr className="border-b">
                  <td>Rohan Mehta (Promoter)</td>
                  <td>350,000</td>
                  <td className="text-right">35.00%</td>
                </tr>
                <tr className="border-b">
                  <td>Minority Public Owners</td>
                  <td>30,000</td>
                  <td className="text-right">3.00%</td>
                </tr>
                <tr className="font-bold">
                  <td>Total Capitalization</td>
                  <td>1,000,000</td>
                  <td className="text-right">100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 italic">Certified by CS Rohan Kapur, FCS 1290. Stamp Attached.</p>
        </div>
      );
    }

    // Fallback standard text representation
    return (
      <div className="border border-slate-300 bg-slate-50 rounded-xl p-5 text-xs text-slate-700 font-mono space-y-3 h-80 overflow-y-auto">
        <h4 className="font-bold border-b pb-2 text-slate-800 uppercase">{doc.name}</h4>
        <p className="text-[11px] uppercase text-indigo-500 font-bold">Simulated OCR Content Output:</p>
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
                  type="file" 
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".pdf,.xlsx,.png"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2 group-hover:text-indigo-500 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 block">
                  {selectedFile ? selectedFile.name : 'Select or drag PDF file'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">PDF, Excel or Image (max 10MB)</span>
              </div>

              <button 
                type="submit" 
                disabled={!selectedFile || uploading}
                className="w-full btn-primary flex items-center justify-center gap-1.5 text-xs font-bold uppercase shadow-indigo-600/10 disabled:opacity-50"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {uploading ? 'Extracting Text...' : 'Upload & Extract'}
              </button>
            </form>
          </div>

          {/* Uploaded Documents List */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Uploaded Documents</h3>
            
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
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={doc.status} />
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(doc.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded hover:bg-slate-100"
                        title="Delete"
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
                <StatusBadge status={selectedDoc.status} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Left Pane: Simulated Document View */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> Source Document View
                  </span>
                  {renderSimulatedPdf(selectedDoc)}
                </div>

                {/* Right Pane: OCR Output Form */}
                <div className="space-y-4">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Edit3 className="w-3.5 h-3.5" /> Extracted Values (Correctable)
                  </span>

                  <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-200/60 max-h-[400px] overflow-y-auto">
                    {Object.keys(editedValues).map((key) => (
                      <div key={key} className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block font-mono">{key.replace(/_/g, ' ')}</label>
                        <input 
                          type="text" 
                          value={editedValues[key] || ''} 
                          onChange={(e) => handleValChange(key, e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {selectedDoc.status === 'uploaded' && (
                    <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-xl flex gap-2">
                      <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 leading-normal">
                        Confirming the values binds them as the official data source. Any mismatched numbers between these fields and the promoter intake responses will be flagged on the dashboard.
                      </p>
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
                      disabled={confirming}
                      className="flex-1 btn-primary flex items-center justify-center gap-1 text-xs text-center py-2 shadow-indigo-600/10"
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
