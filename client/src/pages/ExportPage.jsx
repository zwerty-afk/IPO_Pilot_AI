import { useState, useEffect } from 'react';
import { getCompanyStatus, downloadDocx, downloadPdf, getAuditLogs, getIntake } from '../services/api';
import FrontMatterTemplate from '../components/FrontMatterTemplate';
import { 
  Download, 
  History, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  Loader2, 
  ArrowDownToLine,
  Bookmark,
  RefreshCw,
  File,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  Layers
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
  const [intake, setIntake] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('front_matter'); // 'front_matter' | 'outline'
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
      console.error("Failed to load export details:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (currentPage = page, currentSearch = search) => {
    try {
      setLogsLoading(true);
      const res = await getAuditLogs(companyId, currentPage, 5, currentSearch);
      const data = res.data || res;
      if (data.logs) {
        setAuditLogs(data.logs);
        setTotalPages(Math.ceil(data.total / 5));
      } else {
        const logs = Array.isArray(data) ? data : [];
        setAuditLogs(logs);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
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

  const handleDownload = async () => {
    try {
      setExporting(true);
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

      setTimeout(loadAuditLogs, 1500);
    } catch (err) {
      console.error("Export download failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setExportingPdf(true);
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

      setTimeout(loadAuditLogs, 1500);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const isFullyCertified = stats?.certifiedCount === stats?.totalSections;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 pb-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Compile &amp; Export DRHP Package</h2>
          <p className="text-slate-500 text-sm mt-1">
            Generate a publication-ready SEBI SME DRHP document containing fixed Front Matter (Pages 1–3) followed by AI-synthesized chapters.
          </p>
        </div>

        {/* View Toggle Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('front_matter')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'front_matter' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Fixed Front Matter Preview
          </button>
          <button
            onClick={() => setActiveTab('outline')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'outline' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> 19 SEBI Sections Outline
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Main Export Action (Left/Top) */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Watermark/Disclaimer Alert Banner */}
          {isFullyCertified ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex gap-4">
              <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-emerald-950 text-sm">Ready for Professional Certification</h4>
                <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
                  All {stats?.totalSections} disclosure chapters have been certified as verified by the reviewer. Exported document compiles with a clean corporate designation.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-4">
              <ShieldAlert className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-950 text-sm">Draft Watermark Active</h4>
                <p className="text-xs text-red-800 mt-1 leading-relaxed">
                  This prospectus contains uncertified chapters ({stats?.certifiedCount} of {stats?.totalSections} certified). The compiled export will carry a red regulatory banner warning: <strong className="text-red-900">"DRAFT — PENDING PROFESSIONAL REVIEW"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Export Action Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 text-center">
            <div className="flex gap-4 justify-center">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                <FileText className="w-8 h-8" />
              </div>
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center shadow-inner">
                <File className="w-8 h-8" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">Export Final SEBI DRHP Package</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                Includes Fixed Front Matter (Pages 1–3: Cover Page, Offer Snapshot, Important Info) + Table of Contents + All Synthesized SEBI Chapters.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <button 
                onClick={handleDownload} 
                disabled={exporting || exportingPdf}
                className="btn-primary flex items-center justify-center gap-2 text-sm shadow-indigo-600/15 disabled:opacity-50 py-3"
              >
                {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
                <span>Word (.docx)</span>
              </button>
              
              <button 
                onClick={handleDownloadPdf} 
                disabled={exporting || exportingPdf}
                className="bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 text-sm rounded-lg font-bold shadow-sm shadow-red-600/15 disabled:opacity-50 py-3 transition-colors"
              >
                {exportingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
                <span>PDF Document</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
              AI-generated content. Must be reviewed by a SEBI-registered Merchant Banker and legal counsel before filing.
            </p>
          </div>

          {/* FRONT MATTER PREVIEW VS OUTLINE TAB */}
          {activeTab === 'front_matter' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 font-mono uppercase tracking-wider">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <span>Fixed Front Matter Template Preview (Pages 1–4)</span>
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 text-[10px] uppercase font-mono">
                  Fixed Template Engine Active
                </span>
              </div>
              <p className="text-xs text-slate-500 italic">
                These first 3 pages and Table of Contents use strict, non-AI document templates. Verified company and intake data are automatically injected into standard SEBI filing layouts.
              </p>
              
              <FrontMatterTemplate
                company={{ name: stats?.companyName, ...((intake?.company_details) || {}) }}
                issueDetails={{}}
                intake={intake}
                stats={stats}
              />
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-indigo-600" />
                    <span>19 SEBI SME DRHP Prospectus Sections</span>
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Mapped to SEBI (ICDR) Regulations, Schedule VI. Preceded by 3 Fixed Front Matter pages.
                  </p>
                </div>
                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                  19 Sections
                </span>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {[
                  { num: 1, title: 'Cover Page (Fixed Template)', pages: 'Page 1', src: 'Verified Company Profile & BRLM', note: 'Logo, Exchange, Date, SEBI Warning' },
                  { num: 2, title: 'Offer Snapshot (Fixed Template)', pages: 'Page 2', src: 'Issue Structure & Objects', note: 'QIB, NII, RII Share Allocation Table' },
                  { num: 3, title: 'Important Information (Fixed Template)', pages: 'Page 3', src: 'SEBI & Exchange Disclaimers', note: 'Investor Grievances & Disclaimers' },
                  { num: 4, title: 'Table of Contents (Auto-Generated)', pages: 'Page 4', src: 'Auto-generated Outline', note: 'Complete section page index' },
                  { num: 5, title: 'Definitions & Abbreviations', pages: 'Pages 5–6', src: 'Static Legal + Company Data', note: 'SEBI, ICDR, CIN, DIN terms' },
                  { num: 6, title: 'Risk Factors', pages: 'Pages 7–12', src: 'Risk Factors Chapter', note: 'Internal, External & Issue risks' },
                  { num: 7, title: 'Summary of the Offer Document', pages: 'Pages 13–15', src: 'Synthesized Cross-Chapter', note: 'Business, Issue & Risk summary' },
                  { num: 8, title: 'General Information', pages: 'Pages 16–18', src: 'Company Details & Legal', note: 'CIN, Registered Office, Auditor' },
                  { num: 9, title: 'Capital Structure', pages: 'Pages 19–22', src: 'Capital Structure Chapter', note: 'Share capital, holding, lock-in' },
                  { num: 10, title: 'Objects of the Issue', pages: 'Pages 23–26', src: 'Objects of Issue Chapter', note: 'Fund usage, timeline, benefits' },
                  { num: 11, title: 'Business Overview', pages: 'Pages 27–34', src: 'Business Overview Chapter', note: 'Operations, products, strategy' },
                  { num: 12, title: 'Industry Overview', pages: 'Pages 35–38', src: 'Business Overview (Industry)', note: 'Sector landscape & market size' },
                  { num: 13, title: 'Financial Information', pages: 'Pages 39–46', src: 'Financial Summary Chapter', note: '3-Year Balance Sheet, P&L, Ratios' },
                  { num: 14, title: "Management's Discussion & Analysis (MD&A)", pages: 'Pages 47–50', src: 'Synthesized Financial + Strategy', note: 'Revenue trends & expansion notes' },
                  { num: 15, title: 'Promoters & Management', pages: 'Pages 51–54', src: 'Promoters & Directors Chapter', note: 'Promoter profiles, Board, KMP' },
                  { num: 16, title: 'Related Party Transactions', pages: 'Pages 55–57', src: 'Related Party Chapter', note: 'Disclosed related-party contracts' },
                  { num: 17, title: 'Litigation & Legal Proceedings', pages: 'Pages 58–61', src: 'Litigation & Disputes Chapter', note: 'Civil, tax, GST & labor cases' },
                  { num: 18, title: 'Legal & Compliance / Government Approvals', pages: 'Pages 62–63', src: 'Legal & Compliance Chapter', note: 'Licenses, Factory NOC, Approvals' },
                  { num: 19, title: 'Other Disclosures & Declaration', pages: 'Pages 64–65', src: 'Other Disclosures Chapter', note: 'Dividend policy & Promoter Sign-off' }
                ].map((s) => (
                  <div key={s.num} className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-indigo-600 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        {s.num}
                      </span>
                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-800 truncate text-xs">{s.title}</h4>
                        <p className="text-[10px] text-slate-400 truncate">{s.src} · {s.note}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0">
                      {s.pages}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Version Audit Log (Right/Bottom) */}
        <div className="md:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
              <History className="w-4.5 h-4.5 text-indigo-500" />
              <span>Version Audit Log</span>
            </h3>
            <button
              onClick={() => loadAuditLogs()}
              disabled={logsLoading}
              className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors rounded-lg"
              title="Refresh audit log"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search logs..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <div className="space-y-3">
            {logsLoading ? (
              <div className="flex items-center justify-center h-20">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm text-center">
                <p className="text-xs text-slate-400">No audit events yet.</p>
                <p className="text-[10px] text-slate-300 mt-1">Events appear here as you use the system.</p>
              </div>
            ) : (
              auditLogs.map((log, idx) => (
                <div key={log.id} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-1 relative">
                  {idx === 0 && (
                    <span className="absolute top-3 right-3 text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                      Latest
                    </span>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold text-xs text-slate-800 font-mono">
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">{new Date(log.created_at).toLocaleString()}</p>
                  <p className="text-[10px] text-slate-500 font-semibold mt-1">By: {log.actor_name} ({log.actor_role})</p>
                  <p className="text-[11px] text-slate-600 leading-normal mt-1 italic line-clamp-2">{log.description}</p>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-4">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-500 font-medium">Page {page} of {totalPages}</span>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded hover:bg-slate-100 disabled:opacity-50 text-slate-600"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
