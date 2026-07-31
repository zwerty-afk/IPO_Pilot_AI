import { useState, useEffect } from 'react';
import { getCompanyStatus, downloadDocx } from '../services/api';
import { 
  Download, 
  History, 
  ShieldAlert, 
  ShieldCheck, 
  FileText, 
  Loader2, 
  ArrowDownToLine,
  Bookmark
} from 'lucide-react';

const mockVersions = [
  { ver: 'v3', date: '2026-07-06T17:15:00Z', author: 'Priya Sharma (Reviewer)', change: 'Certified Litigation and Related Party chapters.' },
  { ver: 'v2', date: '2026-07-06T16:45:00Z', author: 'Aarav Mehta (Issuer)', change: 'Corrected promoter shareholding ratio to 62% inside Capital Structure.' },
  { ver: 'v1', date: '2026-07-06T10:30:00Z', author: 'AI Engine', change: 'First synthesis of ICDR draft based on intake form fields.' }
];

export default function ExportPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadStats = async () => {
    try {
      setLoading(true);
      const res = await getCompanyStatus(companyId);
      setStats(res.data || res || {});
    } catch (err) {
      console.error("Failed to load export details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [companyId]);

  const handleDownload = async () => {
    try {
      setExporting(true);
      const res = await downloadDocx(companyId);
      const dataBlob = res.data || res;
      
      const url = window.URL.createObjectURL(new Blob([dataBlob], { type: 'application/msword' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `IPO_Prospectus_${companyId}_Draft.doc`);
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export download failed:", err);
    } finally {
      setExporting(false);
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
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-2xl font-bold text-slate-900">Compile & Export Draft</h2>
        <p className="text-slate-500 text-sm mt-1">
          Generate a publication-ready formatted document containing all disclosure chapters.
        </p>
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
                  All 7 disclosure chapters have been certified as verified by the reviewer (Priya Sharma). Exported document compiles with a clean corporate designation.
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex gap-4">
              <ShieldAlert className="w-8 h-8 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-red-950 text-sm">Draft Watermark Active</h4>
                <p className="text-xs text-red-800 mt-1 leading-relaxed">
                  This prospectus contains uncertified chapters ({stats?.certifiedCount} of {stats?.totalSections} certified). The compiled Word export will carry a red regulatory banner warning: <strong className="text-red-900">"DRAFT — PENDING PROFESSIONAL REVIEW"</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Export Action Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6 text-center">
            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <FileText className="w-8 h-8" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-800">Microsoft Word Prospectus (.doc)</h3>
              <p className="text-slate-500 text-xs max-w-md mx-auto leading-relaxed">
                Compiles all 7 synthesized SEBI ICDR chapters, citations list, and verification confidence metrics into a Word-compatible layout.
              </p>
            </div>

            <button 
              onClick={handleDownload} 
              disabled={exporting}
              className="btn-primary w-full max-w-sm mx-auto flex items-center justify-center gap-2 text-sm shadow-indigo-600/15 disabled:opacity-50 py-3"
            >
              {exporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDownToLine className="w-5 h-5" />}
              <span>{exporting ? 'Compiling Chapters...' : 'Download Word Prospectus'}</span>
            </button>
          </div>
        </div>

        {/* Version History (Right/Bottom) */}
        <div className="md:col-span-1 space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-indigo-500" />
            <span>Version Audit Log</span>
          </h3>

          <div className="space-y-4">
            {mockVersions.map((v, idx) => (
              <div key={v.ver} className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-sm space-y-1 relative">
                {idx === 0 && (
                  <span className="absolute top-3 right-3 text-[9px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded">
                    Latest
                  </span>
                )}
                <div className="flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-xs text-slate-800 font-mono">{v.ver}</span>
                </div>
                <p className="text-[10px] text-slate-400 font-mono">{new Date(v.date).toLocaleString()}</p>
                <p className="text-[10px] text-slate-500 font-semibold mt-1">Edited by: {v.author}</p>
                <p className="text-[11px] text-slate-600 leading-normal mt-1 italic">{v.change}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
