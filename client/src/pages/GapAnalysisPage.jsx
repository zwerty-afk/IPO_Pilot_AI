import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompanyStatus, getIntake, getDocuments, getDrafts, getGapReport } from '../services/api';
import { useDraftDocument } from '../context/DraftDocumentContext';
import { computeGapAnalysisChecks, GAP_ANALYSIS_MAX } from '../utils/gapAnalysisChecks';
import {
  AlertTriangle, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  Loader2, 
  Filter, 
  Search,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Layers,
  FileText,
  UploadCloud,
  Eye,
  RefreshCw,
  XCircle,
  MinusCircle
} from 'lucide-react';

export default function GapAnalysisPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { readiness: centralReadiness } = useDraftDocument();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);

  // Category & Priority Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revalidating, setRevalidating] = useState(false);

  const companyId = user?.companyId || localStorage.getItem('ipo_company_id') || '';

  const loadData = async () => {
    if (!companyId) {
      setStats(null);
      setIntakeData({});
      setDocuments([]);
      setDrafts({});
      setGapReport([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [statusRes, intakeRes, docsRes, draftsRes, gapRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId),
        getGapReport(companyId)
      ]);
      setStats(statusRes.data || statusRes || {});
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
      setGapReport(gapRes.data || gapRes || []);
    } catch (err) {
      console.error("Error loading gap analysis data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('ipo-company-changed', handleUpdate);
    return () => {
      window.removeEventListener('ipo-company-changed', handleUpdate);
    };
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Analyzing IPO Readiness & DRHP Consequence Impact...</span>
      </div>
    );
  }

  // ─── CANONICAL GAP ANALYSIS CHECKLIST (shared with the readiness score) ───────
  const gapCategories = ['all', 'Data Consistency', 'Completeness', 'Risk Disclosure'];

  const CHAPTER_HINTS = {
    'gap-rev-mismatch': ['Section VI: Financial Information'],
    'gap-holding-mismatch': ['Section IV: Capital Structure'],
    'gap-missing-timeline': ['Section III: Particulars of the Offer'],
    'gap-customer-concentration': ['Section II: Risk Factors'],
    'gap-single-factory': ['Section II: Risk Factors'],
    'gap-tax-demand-risk': ['Section VII: Legal and Other Information']
  };
  const OWNER_HINTS = {
    'gap-rev-mismatch': 'CFO',
    'gap-holding-mismatch': 'Company Secretary',
    'gap-missing-timeline': 'Merchant Banker',
    'gap-customer-concentration': 'Issuer / Company',
    'gap-single-factory': 'Issuer / Company',
    'gap-tax-demand-risk': 'Legal Counsel'
  };
  const priorityForPoints = (pts) => (pts >= 5 ? 'Critical' : pts >= 4 ? 'High' : 'Medium');

  const canonicalChecks = computeGapAnalysisChecks(intakeData, documents, gapReport);
  const allGapsList = canonicalChecks.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    priority: priorityForPoints(c.points),
    description: c.description,
    affectedChapters: CHAPTER_HINTS[c.id] || [],
    points: c.points,
    earnedPoints: c.earnedPoints,
    applicable: c.applicable,
    resolved: c.resolved,
    owner: OWNER_HINTS[c.id] || 'Issuer / Company',
    route: c.route
  }));

  const gapAnalysisScore = canonicalChecks.reduce((sum, c) => sum + c.earnedPoints, 0);

  // Filtering
  const filteredGaps = allGapsList.filter(g => {
    if (selectedCategory !== 'all' && g.category !== selectedCategory) return false;
    if (selectedPriority !== 'all' && g.priority !== selectedPriority) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return g.title.toLowerCase().includes(q) ||
             g.description.toLowerCase().includes(q) ||
             g.affectedChapters.some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  const handleRevalidate = async () => {
    setRevalidating(true);
    await loadData();
    setTimeout(() => setRevalidating(false), 800);
  };

  const handleResolveNow = (gap) => {
    navigate(gap.route);
  };

  const resolvedCount = allGapsList.filter(g => g.resolved).length;
  const actionNeededCount = allGapsList.filter(g => g.applicable && !g.resolved).length;
  const notYetApplicableCount = allGapsList.filter(g => !g.applicable).length;
  const criticalCount = allGapsList.filter(g => g.priority === 'Critical' && !g.resolved).length;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Page Title & Readiness Analysis Header (Identical design to Compliance Checklist) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                  Readiness & Consequence Engine
                </span>
                <h1 className="text-xl font-bold text-slate-900">Gap Analysis</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifying disclosure, documentation, legal, financial and governance gaps before DRHP generation.
              </p>
            </div>
          </div>

          <button
            onClick={handleRevalidate}
            disabled={revalidating}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${revalidating ? 'animate-spin' : ''}`} />
            <span>Re-validate Gap Analysis</span>
          </button>
        </div>

        {/* Stats Metrics Cards (Identical layout to Compliance Checklist) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono block">Gap Analysis Score</span>
            <span className="text-xl font-extrabold text-emerald-600 font-mono">{gapAnalysisScore} / {GAP_ANALYSIS_MAX}</span>
            <span className="text-[10px] text-emerald-600/70 block mt-0.5">{resolvedCount} of {allGapsList.length} Checks Verified</span>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-mono block">Action Needed</span>
            <span className="text-xl font-extrabold text-amber-600">{actionNeededCount}</span>
            <span className="text-[10px] text-amber-600/70 block mt-0.5">Data Entered, Not Yet Consistent</span>
          </div>

          <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 font-mono block">Critical Unresolved</span>
            <span className="text-xl font-extrabold text-red-600">{criticalCount}</span>
            <span className="text-[10px] text-red-600/70 block mt-0.5">Mandatory Resolution Required</span>
          </div>

          <div className="bg-slate-100/60 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono block">Not Yet Applicable</span>
            <span className="text-xl font-extrabold text-slate-600">{notYetApplicableCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Awaiting Underlying Data</span>
          </div>

          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block">Current Readiness</span>
            <span className="text-xl font-extrabold text-indigo-700 font-mono">{centralReadiness?.score ?? 0}%</span>
            <span className="text-[10px] text-indigo-600/70 block mt-0.5 font-mono">{centralReadiness?.score ?? 0} / 100 Pts</span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search (Identical to Compliance Checklist) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {gapCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Gap Categories' : cat}
            </button>
          ))}
        </div>

        {/* Priority Filter & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
            <option value="Medium">Medium Only</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gap title, chapter, doc..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* GAP ANALYSIS TABLE MATRIX (Matching Compliance Checklist Table) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Check ID & Priority</th>
                <th className="py-3.5 px-4">Check Name & Category</th>
                <th className="py-3.5 px-4">Affected DRHP Chapters</th>
                <th className="py-3.5 px-4">Points</th>
                <th className="py-3.5 px-4">Owner</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGaps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No gaps match the selected filter query. All statutory items in this category are clear.
                  </td>
                </tr>
              ) : (
                filteredGaps.map((gap) => (
                  <tr key={gap.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Gap ID & Priority */}
                    <td className="py-3.5 px-4 space-y-1 align-top">
                      <span className="font-mono font-bold text-indigo-700 block">
                        {gap.id}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        gap.priority === 'Critical'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : gap.priority === 'High'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {gap.priority}
                      </span>
                    </td>

                    {/* Gap Title & Category */}
                    <td className="py-3.5 px-4 space-y-1 max-w-xs align-top">
                      <div className="font-bold text-slate-900 flex items-start gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${gap.priority === 'Critical' ? 'text-red-500' : 'text-amber-500'}`} />
                        <span>{gap.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        {gap.description}
                      </p>
                      <span className="inline-block text-[9px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 uppercase">
                        {gap.category}
                      </span>
                    </td>

                    {/* Affected DRHP Chapters */}
                    <td className="py-3.5 px-4 max-w-xs align-top space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {gap.affectedChapters.map((ch, cidx) => (
                          <span key={cidx} className="px-2 py-0.5 bg-indigo-50 text-indigo-800 text-[10px] font-medium rounded border border-indigo-100 block truncate">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Points Earned */}
                    <td className="py-3.5 px-4 font-mono font-bold align-top">
                      <span className={gap.resolved ? 'text-emerald-600' : 'text-slate-400'}>
                        {gap.earnedPoints} / {gap.points}
                      </span>
                    </td>

                    {/* Owner */}
                    <td className="py-3.5 px-4 font-mono align-top">
                      <span className="font-bold text-slate-700">{gap.owner}</span>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 font-mono align-top">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        gap.resolved
                          ? 'bg-emerald-100 text-emerald-800'
                          : gap.applicable
                          ? 'bg-amber-100 text-amber-900 font-extrabold'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {gap.resolved ? 'Verified' : gap.applicable ? 'Action Needed' : 'Not Yet Applicable'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right align-top shrink-0">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {gap.resolved ? (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                          </span>
                        ) : (
                          <button
                            onClick={() => handleResolveNow(gap)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                          >
                            <span>Resolve</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
