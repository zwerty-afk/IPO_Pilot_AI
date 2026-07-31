import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyStatus, generateDrafts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { 
  TrendingUp, 
  FileWarning, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  BookOpen, 
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

const sectionMapping = {
  business_overview: "Business Overview",
  risk_factors: "Risk Factors",
  objects: "Objects of the Issue",
  capital_structure: "Capital Structure",
  related_party: "Related Party Transactions",
  litigation: "Litigation & Legal Proceedings",
  promoter_details: "Promoter & Management Details"
};

const sectionDescriptions = {
  business_overview: "Detailed overview of business, products, facilities, and customers.",
  risk_factors: "Internal and external challenges and legal risk exposures.",
  objects: "Detailed breakdown of proposed issue size and utilization of funds.",
  capital_structure: "Pre-IPO share distribution and promoter holding stats.",
  related_party: "Financial agreements with promoter-owned enterprises.",
  litigation: "Pending tax assessments, legal cases, and promoter status.",
  promoter_details: "Detailed experience and board structural profiles."
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await getCompanyStatus(companyId);
      setStats(res.data || res);
      
    } catch (err) {
      console.error("Failed to load dashboard status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [companyId]);

  const handleSyncAI = async () => {
    try {
      setSyncing(true);
      await generateDrafts(companyId);
      const res = await getCompanyStatus(companyId);
      setStats(res.data || res);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm">Assembling dashboard metrics...</p>
        </div>
      </div>
    );
  }

  const getHeatmapColor = (status) => {
    switch(status) {
      case 'certified':
        return 'bg-emerald-50 border-emerald-200 hover:border-emerald-400 text-emerald-800 shadow-emerald-500/5';
      case 'complete':
        return 'bg-indigo-50/50 border-indigo-100 hover:border-indigo-300 text-indigo-900 shadow-indigo-500/5';
      case 'partial':
        return 'bg-amber-50/70 border-amber-200 hover:border-amber-400 text-amber-900 shadow-amber-500/5';
      case 'missing':
      default:
        return 'bg-red-50/60 border-red-200 hover:border-red-400 text-red-900 shadow-red-500/5';
    }
  };

  const getHeatmapBadge = (status) => {
    switch(status) {
      case 'certified':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800"><ShieldCheck className="w-3.5 h-3.5" /> Certified</span>;
      case 'complete':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">Complete</span>;
      case 'partial':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">Needs Review</span>;
      case 'missing':
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">Gap Detected</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Banner Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">IPO Pilot AI Dashboard</h2>
          <p className="text-slate-500 text-sm mt-1">
            Tracking draft preparation metrics for <span className="font-semibold text-slate-700">{stats?.companyName}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSyncAI} 
            disabled={syncing}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all text-sm border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Analyzing Documents...' : 'Refresh Gap Check'}
          </button>
          <button 
            onClick={() => navigate('/intake')}
            className="btn-primary flex items-center gap-2 text-sm shadow-indigo-600/10"
          >
            <span>Continue Intake</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Numerical Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Completeness</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats?.completenessPercentage}%</h3>
            <p className="text-slate-400 text-xs mt-0.5">{stats?.certifiedCount} of {stats?.totalSections} chapters certified</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
            <FileWarning className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Discrepancies</p>
            <h3 className="text-2xl font-bold text-red-600 mt-0.5">{stats?.inconsistenciesCount}</h3>
            <p className="text-slate-400 text-xs mt-0.5">Cross-document mismatches</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Disclosure Gaps</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-0.5">{stats?.gapsCount}</h3>
            <p className="text-slate-400 text-xs mt-0.5">Missing ICDR disclosures</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Banker Comments</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-0.5">{stats?.openComments}</h3>
            <p className="text-slate-400 text-xs mt-0.5">Unresolved review comments</p>
          </div>
        </div>
      </div>

      {/* Grid: Heatmap (Left/Top) & Warnings/Action Panel (Right/Bottom) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Completeness Heatmap */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Completeness Heatmap</h3>
              <p className="text-slate-500 text-xs">Visualizing SEBI ICDR drafting status by chapter</p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Certified</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Draft</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Review</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500"></span> Gap</span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stats?.heatmap && Object.keys(stats.heatmap).map(secKey => (
              <div 
                key={secKey} 
                onClick={() => navigate(user?.role === 'reviewer' ? '/reviewer' : '/draft')}
                className={`p-5 rounded-2xl border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between h-40 ${getHeatmapColor(stats.heatmap[secKey])}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="font-bold text-base tracking-tight">{sectionMapping[secKey]}</h4>
                    {getHeatmapBadge(stats.heatmap[secKey])}
                  </div>
                  <p className="text-xs opacity-75 mt-2 line-clamp-2">
                    {sectionDescriptions[secKey]}
                  </p>
                </div>
                
                <div className="flex items-center justify-between text-xs font-semibold pt-3 border-t border-black/5">
                  <span className="opacity-80">View Draft & Citations</span>
                  <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Critical Action Items */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Critical Verification Flags</h3>
            <p className="text-slate-500 text-xs">Action items requiring immediate promoter confirmation</p>
          </div>

          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {stats?.gapReport && stats.gapReport.length > 0 ? (
              stats.gapReport.map((item, idx) => (
                <div 
                  key={item.id || idx} 
                  className={`p-4 rounded-xl border flex gap-3 ${item.severity === 'high' ? 'bg-red-50/50 border-red-200' : 'bg-amber-50/50 border-amber-200'}`}
                >
                  {item.severity === 'high' ? (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5 animate-pulse" />
                  ) : (
                    <HelpCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                      {item.category === 'consistency' ? 'Data Mismatch' : 'Disclosure Gap'}
                    </p>
                    <p className="text-xs text-slate-700 leading-normal">{item.message}</p>
                    
                    {item.category === 'consistency' && (
                      <div className="grid grid-cols-2 gap-2 bg-white/70 p-2 rounded-lg border border-black/5 text-xs font-mono">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Intake Value</p>
                          <p className="font-semibold text-red-700">{item.intakeValue}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase">Extracted ({item.docName.slice(0, 15)}...)</p>
                          <p className="font-semibold text-emerald-700">{item.docValue}</p>
                        </div>
                      </div>
                    )}
                    
                    <button 
                      onClick={() => navigate(item.category === 'consistency' ? '/documents' : '/intake')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                    >
                      <span>Fix Mismatch</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-emerald-50/40 border border-emerald-200/80 p-5 rounded-2xl text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <h4 className="font-bold text-emerald-950 text-sm">No Discrepancies Detected</h4>
                <p className="text-xs text-emerald-800 mt-1">All confirmed document figures match current promoter intake responses perfectly.</p>
              </div>
            )}
            
            {/* Quick Demo Rehearsal Instructions Box */}
            <div className="bg-slate-900 text-slate-300 p-5 rounded-2xl space-y-3 shadow-lg shadow-slate-900/10 border border-slate-800">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Demo Walkthrough Guide</span>
              </h4>
              <p className="text-[11.5px] leading-relaxed text-slate-400">
                To test the AI pilot in real-time:
              </p>
              <ul className="list-decimal pl-4 text-[11px] space-y-1.5 text-slate-400 font-sans">
                <li>Go to <strong className="text-slate-200">Documents</strong> and click <strong className="text-indigo-300">Confirm</strong> on the uploaded Financials and Cap Table.</li>
                <li>Observe the active discrepancy warnings trigger here.</li>
                <li>Go to <strong className="text-slate-200">Intake Form</strong> and correct the promoter holding to <strong className="text-emerald-300">62%</strong>, or add a deployment timeline.</li>
                <li>Sync AI to watch the warnings disappear and the heatmap turn green.</li>
              </ul>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
