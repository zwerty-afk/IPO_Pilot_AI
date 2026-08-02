import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyStatus, generateDrafts, getIpoReadiness, updateIpoReadinessItem, getIntake, getDocuments, getDrafts } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { steps as intakeSteps, moduleCompleteness } from '../data/intakeSchema';
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
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  Clock,
  ListChecks,
  Circle
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
  const [showGuide, setShowGuide] = useState(() => {
    return localStorage.getItem('ipo_hide_guide') !== 'true';
  });

  const toggleGuide = () => {
    const next = !showGuide;
    setShowGuide(next);
    localStorage.setItem('ipo_hide_guide', next ? 'false' : 'true');
  };
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const [readinessData, setReadinessData] = useState(null);
  const [showReadiness, setShowReadiness] = useState(false);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [previewSectionKey, setPreviewSectionKey] = useState('business_overview');

  const loadStatus = async () => {
    try {
      setLoading(true);
      const [res, readinessRes, intakeRes, docsRes, draftsRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIpoReadiness(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId)
      ]);
      setStats(res.data || res);
      setReadinessData(readinessRes.data || readinessRes);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
    } catch (err) {
      console.error("Failed to load dashboard status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [companyId]);

  const handleReadinessItemUpdate = async (itemKey, newStatus) => {
    try {
      await updateIpoReadinessItem(companyId, itemKey, newStatus, 'Verified by Merchant Banker');
      await loadStatus();
    } catch (err) {
      console.error("Failed to update readiness item:", err);
    }
  };

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

  // Per-module intake completeness (SME completeness heatmap) — derived from shared schema.
  const intakeModules = intakeSteps.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    pct: moduleCompleteness(s.key, intakeData[s.key] || {})
  }));
  const overallIntakePct = intakeModules.length
    ? Math.round(intakeModules.reduce((sum, m) => sum + m.pct, 0) / intakeModules.length)
    : 0;

  // Pending Actions — derived from already-loaded stats + documents (no new backend).
  const REQUIRED_DOC_TYPES = [
    { type: 'incorporation_certificate', label: 'Certificate of Incorporation' },
    { type: 'audited_financials', label: 'Audited Financials' },
    { type: 'cap_table', label: 'Certified Cap Table' },
    { type: 'litigation_records', label: 'Litigation & Notice Records' }
  ];
  const uploadedTypes = new Set((documents || []).map((d) => d.doc_type));
  const missingDocs = REQUIRED_DOC_TYPES.filter((d) => !uploadedTypes.has(d.type));
  const docsPendingReview = (documents || []).filter((d) => d.status === 'uploaded').length;
  const validationErrors = (stats?.inconsistenciesCount || 0);
  const disclosureGaps = (stats?.gapsCount || 0);
  const bankerComments = (stats?.openComments || 0);

  const pendingActions = [
    missingDocs.length > 0 && {
      key: 'missing-docs',
      icon: FileText,
      tone: 'amber',
      label: `${missingDocs.length} Required Document${missingDocs.length > 1 ? 's' : ''} Missing`,
      hint: missingDocs.map((d) => d.label).join(', '),
      to: '/documents'
    },
    docsPendingReview > 0 && {
      key: 'docs-review',
      icon: Clock,
      tone: 'indigo',
      label: `${docsPendingReview} Document${docsPendingReview > 1 ? 's' : ''} Awaiting OCR Confirmation`,
      hint: 'Review extracted values and confirm.',
      to: '/documents'
    },
    validationErrors > 0 && {
      key: 'validation',
      icon: AlertTriangle,
      tone: 'red',
      label: `${validationErrors} Validation Error${validationErrors > 1 ? 's' : ''}`,
      hint: 'Intake values conflict with uploaded documents.',
      to: '/intake'
    },
    disclosureGaps > 0 && {
      key: 'gaps',
      icon: HelpCircle,
      tone: 'amber',
      label: `${disclosureGaps} Disclosure Gap${disclosureGaps > 1 ? 's' : ''}`,
      hint: 'Missing SEBI ICDR disclosures to complete.',
      to: '/intake'
    },
    bankerComments > 0 && {
      key: 'comments',
      icon: MessageSquare,
      tone: 'purple',
      label: `${bankerComments} Banker Comment${bankerComments > 1 ? 's' : ''} Pending`,
      hint: 'Reviewer has requested clarifications.',
      to: user?.role === 'reviewer' ? '/reviewer' : '/draft'
    }
  ].filter(Boolean);

  const pendingToneClass = (tone) => ({
    red: 'bg-red-50/70 border-red-200 text-red-700',
    amber: 'bg-amber-50/70 border-amber-200 text-amber-700',
    indigo: 'bg-indigo-50/70 border-indigo-200 text-indigo-700',
    purple: 'bg-purple-50/70 border-purple-200 text-purple-700'
  }[tone] || 'bg-slate-50 border-slate-200 text-slate-700');

  // Status Tracker — stages derived from existing certification/comment state.
  const certified = stats?.certifiedCount || 0;
  const totalSecs = stats?.totalSections || 0;
  const allCertified = totalSecs > 0 && certified === totalSecs;
  const trackerStages = [
    { key: 'draft', label: 'Draft', done: true },
    { key: 'reviewer', label: 'Reviewer Assigned', done: true },
    { key: 'review', label: 'Under Review', done: totalSecs > 0 },
    { key: 'comments', label: 'Comments Pending', done: bankerComments > 0 || certified > 0, active: bankerComments > 0 && !allCertified },
    { key: 'certified', label: 'Certified', done: certified > 0 },
    { key: 'filing', label: 'Ready for Filing', done: allCertified }
  ];
  const currentStageIndex = (() => {
    if (allCertified) return trackerStages.length - 1;
    if (certified > 0) return 4;
    if (bankerComments > 0) return 3;
    if (totalSecs > 0) return 2;
    return 1;
  })();

  const completenessBar = (pct) => {
    if (pct >= 100) return 'bg-emerald-500';
    if (pct >= 60) return 'bg-indigo-500';
    if (pct >= 30) return 'bg-amber-500';
    return 'bg-red-500';
  };
  const completenessText = (pct) => {
    if (pct >= 100) return 'text-emerald-600';
    if (pct >= 60) return 'text-indigo-600';
    if (pct >= 30) return 'text-amber-600';
    return 'text-red-600';
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowReadiness(prev => !prev)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 transition-colors border border-emerald-200"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{showReadiness ? 'Hide IPO Checklist' : 'IPO Verification Checklist'}</span>
            {showReadiness ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleGuide}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
            <span>{showGuide ? 'Hide Demo Guide' : 'Show Demo Guide'}</span>
            {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
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

      {/* ── IPO Readiness Verification Checklist Dropdown Panel ─────────────────────── */}
      {showReadiness && readinessData?.milestone_items && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-md space-y-4 animate-slide-down">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-base">IPO Readiness Verification Checklist</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                Overall Score: {readinessData.overall_score}/100 ({readinessData.overall_label})
              </span>
              <button
                onClick={() => setShowReadiness(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 px-3 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {readinessData.milestone_items.map((item) => (
              <div key={item.key} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-xs text-slate-800">{item.title}</p>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase shrink-0 ${
                      item.status === 'verified' || item.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                      item.status === 'needs_changes' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {item.verified_by && (
                    <span className="text-[10px] text-slate-500 block mt-1">Verified by: {item.verified_by}</span>
                  )}
                </div>
                {user?.role === 'reviewer' && (
                  <button
                    onClick={() => handleReadinessItemUpdate(item.key, item.status === 'verified' ? 'needs_changes' : 'verified')}
                    className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg transition-colors"
                  >
                    {item.status === 'verified' ? 'Mark Needs Changes' : 'Verify Milestone'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Demo Walkthrough Guide (Top Banner Card) ───────────────────────── */}
      {showGuide && (
        <div className="bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl shadow-slate-900/10 border border-slate-800 space-y-4 animate-slide-down">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse-slow" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Interactive Demo Walkthrough</h3>
                <p className="text-slate-400 text-xs mt-0.5">Follow these 4 simple steps to test the real-time AI validation, gap analysis, and certification workflow</p>
              </div>
            </div>
            <button
              onClick={toggleGuide}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10"
            >
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            {/* Step 1 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 hover:bg-white/[0.08] transition-colors relative group">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">1</span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">Step 1</span>
              </div>
              <h4 className="text-xs font-bold text-white">Update Intake Data</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Go to <strong className="text-indigo-300 cursor-pointer hover:underline" onClick={() => navigate('/intake')}>Intake Form</strong>, correct promoter holding to <span className="text-emerald-300 font-semibold">62%</span> or set funding timeline.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 hover:bg-white/[0.08] transition-colors relative group">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">2</span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">Step 2</span>
              </div>
              <h4 className="text-xs font-bold text-white">Re-Run AI Gap Analysis</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Click <strong className="text-indigo-300 font-semibold">Refresh Gap Check</strong> to trigger live verification and watch cross-document discrepancies auto-resolve.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 hover:bg-white/[0.08] transition-colors relative group">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">3</span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">Step 3</span>
              </div>
              <h4 className="text-xs font-bold text-white">Review & Certify Drafts</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Navigate to <strong className="text-indigo-300 cursor-pointer hover:underline" onClick={() => navigate('/reviewer-workspace')}>Reviewer Workspace</strong> to review citations and mark sections as Certified.
              </p>
            </div>

            {/* Step 4 */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 hover:bg-white/[0.08] transition-colors relative group">
              <div className="flex items-center justify-between">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">4</span>
                <span className="text-[10px] uppercase tracking-wider font-mono text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">Step 4</span>
              </div>
              <h4 className="text-xs font-bold text-white">Export DRHP Prospectus</h4>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Once certified, go to <strong className="text-indigo-300 cursor-pointer hover:underline" onClick={() => navigate('/export')}>Export</strong> to download a clean, un-watermarked Word or PDF offer document.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* ── Completeness Heatmap (SEBI ICDR chapters) — promoted to the top ──── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Completeness Heatmap</h3>
            <p className="text-slate-500 text-xs">Visualizing SEBI ICDR drafting status by chapter</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Certified</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-indigo-500"></span> Draft</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Review</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-red-500"></span> Gap</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
                <span className="opacity-80">View Draft &amp; Citations</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Intake Completeness Heatmap (per SME intake module) ─────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Intake Completeness</h3>
            <p className="text-slate-500 text-xs">Disclosure readiness by intake module, based on required fields captured</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Intake</p>
              <p className={`text-xl font-bold leading-none ${completenessText(overallIntakePct)}`}>{overallIntakePct}%</p>
            </div>
            <button
              onClick={() => navigate('/intake')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors border border-indigo-200"
            >
              <span>Continue Intake</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {intakeModules.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.key}
                onClick={() => navigate('/intake')}
                className="text-left p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-white hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-700 truncate">{m.label}</span>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${completenessText(m.pct)}`}>{m.pct}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${completenessBar(m.pct)}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Pending Actions + Status Tracker ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Actions */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900">Pending Actions</h3>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
              {pendingActions.length} open
            </span>
          </div>

          {pendingActions.length > 0 ? (
            <div className="space-y-3">
              {pendingActions.map((a) => {
                const Icon = a.icon;
                return (
                  <button
                    key={a.key}
                    onClick={() => navigate(a.to)}
                    className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm ${pendingToneClass(a.tone)}`}
                  >
                    <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight">{a.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{a.hint}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 mt-0.5 opacity-60" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bg-emerald-50/40 border border-emerald-200/80 p-5 rounded-xl text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-bold text-emerald-950 text-sm">All Caught Up</h4>
              <p className="text-xs text-emerald-800 mt-1">No pending documents, validation errors, or reviewer comments.</p>
            </div>
          )}
        </div>

        {/* Status Tracker */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900">Status Tracker</h3>
          </div>
          <ol className="space-y-1">
            {trackerStages.map((stage, idx) => {
              const isCurrent = idx === currentStageIndex;
              const isDone = stage.done && idx <= currentStageIndex;
              return (
                <li key={stage.key} className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    {isDone && !isCurrent ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : isCurrent ? (
                      <span className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      </span>
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300" />
                    )}
                    {idx < trackerStages.length - 1 && (
                      <span className={`w-0.5 h-5 ${isDone ? 'bg-emerald-300' : 'bg-slate-200'}`} />
                    )}
                  </div>
                  <span className={`text-sm font-semibold pt-0.5 ${isCurrent ? 'text-indigo-700' : isDone ? 'text-slate-700' : 'text-slate-400'}`}>
                    {stage.label}
                    {isCurrent && <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded">Current</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {/* ── Live Draft Preview (read-only, with section navigation) ──────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Live Draft Preview</h3>
              <p className="text-slate-500 text-xs">AI-generated disclosure text, updated as you complete intake</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/draft')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors border border-indigo-200 shrink-0"
          >
            <span>Open Full Draft</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Section navigation */}
        <div className="flex flex-wrap gap-2">
          {Object.keys(sectionMapping).map((key) => {
            const isActive = key === previewSectionKey;
            const secStatus = drafts[key]?.status;
            return (
              <button
                key={key}
                onClick={() => setPreviewSectionKey(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  secStatus === 'certified' ? 'bg-emerald-500'
                    : secStatus === 'clarification_requested' ? 'bg-amber-500'
                    : isActive ? 'bg-white/70' : 'bg-indigo-400'
                }`} />
                <span>{sectionMapping[key]}</span>
              </button>
            );
          })}
        </div>

        {/* Draft body */}
        {(() => {
          const sec = drafts[previewSectionKey];
          const blocks = sec?.blocks || [];
          const isCertified = sec?.status === 'certified';
          if (!blocks.length) {
            return (
              <div className="bg-slate-50/70 border border-dashed border-slate-300 rounded-xl p-8 text-center">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600">No draft generated yet</p>
                <p className="text-xs text-slate-400 mt-1">Complete the related intake module, then run Refresh Gap Check.</p>
              </div>
            );
          }
          return (
            <div className="relative rounded-xl border border-slate-200/80 bg-slate-50/40 p-5 overflow-hidden">
              {/* Watermark until certification */}
              {!isCertified && (
                <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden opacity-[0.04] z-0">
                  <div className="text-[2rem] font-extrabold uppercase -rotate-[24deg] tracking-widest text-red-600 whitespace-nowrap">
                    PENDING PROFESSIONAL REVIEW
                  </div>
                </div>
              )}
              <div className="relative z-10 space-y-3">
                {blocks.slice(0, 2).map((block) => (
                  <div
                    key={block.id}
                    className={`bg-white/80 rounded-lg p-3.5 border-l-4 ${
                      block.confidence === 'low' ? 'border-l-red-500'
                        : block.confidence === 'medium' ? 'border-l-amber-500'
                        : 'border-l-indigo-500'
                    } border border-slate-200/60`}
                  >
                    <p className="text-sm text-slate-700 leading-relaxed line-clamp-3">{block.text}</p>
                    <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400">
                      <span className="font-semibold uppercase tracking-wider">
                        {(block.citations?.length || 0)} source{(block.citations?.length || 0) === 1 ? '' : 's'}
                      </span>
                      <span className={`font-bold uppercase tracking-wider ${
                        block.confidence === 'low' ? 'text-red-500'
                          : block.confidence === 'medium' ? 'text-amber-600'
                          : 'text-indigo-500'
                      }`}>
                        {block.confidence} confidence
                      </span>
                    </div>
                  </div>
                ))}
                {blocks.length > 2 && (
                  <button
                    onClick={() => navigate('/draft')}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>+{blocks.length - 2} more paragraph{blocks.length - 2 === 1 ? '' : 's'} — view full draft</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Grid: Warnings/Action Panel (the chapter heatmap now sits up top) */}
      <div className="grid grid-cols-1 gap-8">

        {/* Alerts & Critical Action Items */}
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Critical Verification Flags</h3>
            <p className="text-slate-500 text-xs">Action items requiring immediate promoter confirmation</p>
          </div>

          <div className="space-y-4 pr-1">
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
                      onClick={() => navigate(item.category === 'consistency' ? '/intake' : '/intake')}
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
            


          </div>
        </div>

      </div>
    </div>
  );
}
