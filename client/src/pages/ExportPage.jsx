import { useState, useEffect } from 'react';
import { getCompanyStatus, downloadDocx, downloadPdf, getAuditLogs, getIntake } from '../services/api';
import { 
  Download, 
  History, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  Loader2, 
  ArrowDownToLine,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileCheck,
  Info,
  Sliders,
  Zap,
  AlertCircle
} from 'lucide-react';

const ACTION_LABELS = {
  EXPORT_DOWNLOADED: 'Document exported',
  SECTION_CERTIFIED: 'Section certified',
  SECTION_STATUS_UPDATED: 'Status updated',
  DRAFT_REGENERATED: 'Draft regenerated',
  INTAKE_UPDATED: 'Intake updated',
  COMMENT_ADDED: 'Comment added',
  DOCUMENT_CONFIRMED: 'Document confirmed',
  LOGIN: 'User logged in',
};

export default function ExportPage() {
  const [stats, setStats] = useState(null);
  const [, setIntake] = useState({});
  const [loading, setLoading] = useState(true);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');

  // Export Settings state
  const [exportSettings, setExportSettings] = useState({
    watermarkMode: 'auto', // 'auto' | 'draft' | 'none'
    includePageNumbers: true,
    fontSize: 'standard', // 'standard' | 'large'
    paperSize: 'a4'
  });

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadStats = async () => {
    try {
      setLoading(true);
      const [statusRes, intakeRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIntake(companyId).catch(() => ({ data: {} }))
      ]);
      setStats(statusRes.data || statusRes || {});
      setIntake(intakeRes.data || intakeRes || {});
    } catch (err) {
      console.error("Failed to load export status:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (currentPage = page, currentSearch = search) => {
    try {
      setLogsLoading(true);
      const res = await getAuditLogs(companyId, currentPage, 6, currentSearch);
      const data = res.data || res;
      if (data.logs) {
        setAuditLogs(data.logs);
        setTotalPages(Math.ceil(data.total / 6) || 1);
      } else {
        const logs = Array.isArray(data) ? data : [];
        setAuditLogs(logs);
        setTotalPages(1);
      }
    } catch (err) {
      console.error("Failed to load export audit history:", err);
      setAuditLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [companyId]);

  useEffect(() => {
    loadAuditLogs();
  }, [page, search, companyId]);

  const handleDownloadDocx = async () => {
    try {
      setExportingDocx(true);
      setExportSuccessMsg(null);
      const res = await downloadDocx(companyId);
      const dataBlob = res.data;
      
      const blobData = dataBlob instanceof Blob ? dataBlob : new Blob([dataBlob], { 
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
      });
      
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPO_Draft_Prospectus_${companyId}_${new Date().toISOString().split('T')[0]}.docx`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccessMsg('DOCX exported successfully from Draft Preview!');
      setTimeout(() => setExportSuccessMsg(null), 5000);
      setTimeout(loadAuditLogs, 1500);
    } catch (err) {
      console.error("DOCX export failed:", err);
    } finally {
      setExportingDocx(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setExportingPdf(true);
      setExportSuccessMsg(null);
      const res = await downloadPdf(companyId);
      const dataBlob = res.data;
      
      const blobData = dataBlob instanceof Blob ? dataBlob : new Blob([dataBlob], { 
        type: 'application/pdf' 
      });
      
      const url = window.URL.createObjectURL(blobData);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPO_Draft_Prospectus_${companyId}_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportSuccessMsg('PDF exported successfully from Draft Preview!');
      setTimeout(() => setExportSuccessMsg(null), 5000);
      setTimeout(loadAuditLogs, 1500);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-medium">Loading export panel...</p>
      </div>
    );
  }

  const isFullyCertified = stats?.certifiedCount === stats?.totalSections && (stats?.totalSections > 0);
  const certifiedPercent = stats?.totalSections 
    ? Math.round((stats?.certifiedCount / stats?.totalSections) * 100) 
    : 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-12">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>WYSIWYG Export Architecture</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Export Panel
            </h1>
            <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
              Export your DRHP package directly from the active <strong className="text-white">Draft Preview</strong>. The current draft is your single source of truth—no document regeneration or extra AI processing required.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm shrink-0">
            <FileCheck className="w-8 h-8 text-emerald-400 shrink-0" />
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Export Source</div>
              <div className="text-xs font-bold text-white">Active Draft Preview</div>
              <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Live Sync Ready</div>
            </div>
          </div>
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 text-xs font-medium animate-slide-down">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Export Status Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Info className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Export Status</h3>
                  <p className="text-slate-500 text-xs">Current state of the Draft Preview document ready for export</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold font-mono ${
                isFullyCertified 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {certifiedPercent}% Certified
              </span>
            </div>

            {/* Certification Status Banner */}
            {isFullyCertified ? (
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-4 flex gap-3.5 items-start">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-emerald-950 text-xs">Fully Certified &amp; Ready</h4>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    All {stats?.totalSections || 0} SEBI sections have been certified by reviewers. Your export will generate clean, regulatory-ready files without draft watermarks.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-4 flex gap-3.5 items-start">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-950 text-xs">Uncertified Chapters Pending ({stats?.certifiedCount || 0}/{stats?.totalSections || 0} Certified)</h4>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    Exporting now will produce your current Draft Preview with a regulatory watermark: <strong className="text-amber-950">"DRAFT — PENDING PROFESSIONAL REVIEW"</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* Document Source Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Company</span>
                <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">
                  {stats?.companyName || 'Aarav Precision'}
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Total Chapters</span>
                <span className="text-xs font-bold text-slate-800 block mt-0.5 font-mono">
                  {stats?.totalSections || 19} Sections
                </span>
              </div>
              <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Source State</span>
                <span className="text-xs font-bold text-indigo-700 block mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  WYSIWYG Active
                </span>
              </div>
            </div>
          </div>

          {/* Quick Export Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Export Actions</h3>
                  <p className="text-slate-500 text-xs">Download current Draft Preview into target file format</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Export as PDF */}
              <div className="border border-slate-200 rounded-2xl p-5 hover:border-red-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group bg-gradient-to-b from-white to-red-50/20">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      PDF
                    </div>
                    <span className="text-[10px] font-mono font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      Print Ready
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Export as PDF</h4>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                      Generates a publication-grade PDF file directly from the current Draft Preview layout.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadPdf}
                  disabled={exportingPdf || exportingDocx}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-red-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {exportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Exporting PDF...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* Export as DOCX */}
              <div className="border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 group bg-gradient-to-b from-white to-indigo-50/20">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-extrabold text-sm shadow-sm group-hover:scale-105 transition-transform">
                      DOCX
                    </div>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                      Editable Word
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-base">Export as DOCX</h4>
                    <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                      Generates a fully editable Microsoft Word (.docx) document matching current Draft Preview text.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleDownloadDocx}
                  disabled={exportingPdf || exportingDocx}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {exportingDocx ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Exporting DOCX...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-4 h-4" />
                      <span>Download DOCX</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-500 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>Downloads reflect the exact edits saved in Draft Preview. No secondary document build is triggered.</span>
            </div>
          </div>

          {/* Export Settings Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Export Settings</h3>
                  <p className="text-slate-500 text-xs">Configure output formatting preferences</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Watermark Rule</label>
                <select
                  value={exportSettings.watermarkMode}
                  onChange={(e) => setExportSettings({ ...exportSettings, watermarkMode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="auto">Auto (Draft watermark if uncertified)</option>
                  <option value="draft">Always Include Draft Watermark</option>
                  <option value="none">Suppress Watermark (Certified Only)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Paper Size Layout</label>
                <select
                  value={exportSettings.paperSize}
                  onChange={(e) => setExportSettings({ ...exportSettings, paperSize: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="a4">Standard SEBI A4 (210 x 297 mm)</option>
                  <option value="letter">Letter Format</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">Typography / Density</label>
                <select
                  value={exportSettings.fontSize}
                  onChange={(e) => setExportSettings({ ...exportSettings, fontSize: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="standard">Standard SEBI (11pt Calibri / Times)</option>
                  <option value="large">Large Print (12pt)</option>
                </select>
              </div>

              <div className="space-y-1.5 flex flex-col justify-end">
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={exportSettings.includePageNumbers}
                    onChange={(e) => setExportSettings({ ...exportSettings, includePageNumbers: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="font-semibold text-slate-700">Include Header &amp; Footer Page Numbers</span>
                </label>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Download History (1 Col wide) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>Download History</span>
              </h3>
              <button
                onClick={() => loadAuditLogs()}
                disabled={logsLoading}
                className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 cursor-pointer"
                title="Refresh history"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search history..." 
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>

            <div className="space-y-3 min-h-[300px]">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                  <span className="text-xs">Loading history...</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100 space-y-1">
                  <p className="text-xs font-semibold text-slate-500">No export events yet</p>
                  <p className="text-[10px] text-slate-400">Download history will appear here as exports occur.</p>
                </div>
              ) : (
                auditLogs.map((log, idx) => (
                  <div key={log.id || idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-1 relative hover:border-slate-300 transition-colors">
                    {idx === 0 && (
                      <span className="absolute top-3 right-3 text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded-full">
                        Latest
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="font-bold text-xs text-slate-800 font-mono">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {new Date(log.created_at || Date.now()).toLocaleString()}
                    </p>
                    {log.actor_name && (
                      <p className="text-[10px] text-slate-500 font-semibold">
                        By: {log.actor_name} ({log.actor_role || 'User'})
                      </p>
                    )}
                    {log.description && (
                      <p className="text-[11px] text-slate-600 leading-tight mt-1 italic line-clamp-2">
                        {log.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500 font-medium">Page {page} of {totalPages}</span>
                <button 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1 rounded hover:bg-slate-100 disabled:opacity-40 text-slate-600 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
