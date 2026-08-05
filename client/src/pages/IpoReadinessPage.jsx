import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIpoReadiness, updateIpoReadinessItem, getIntake, getDocuments, getDrafts } from '../services/api';
import { SECTION_KEYS, computeChapterHealth } from '../components/ChapterHealthSidebar';
import { stepQuestions, requiredQuestions, SECTION_UPLOADS } from '../data/intakeSchema';
import { classifyCompany, getIpoProfile } from '../data/companyClassifier';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import { 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  FileText, 
  UserCheck, 
  RefreshCw,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Clock,
  Building2,
  FileCheck2,
  ListChecks,
  Check
} from 'lucide-react';

export default function IpoReadinessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [readinessData, setReadinessData] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadData = async () => {
    try {
      setLoading(true);
      const [readinessRes, intakeRes, docsRes, draftsRes] = await Promise.all([
        getIpoReadiness(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId)
      ]);
      setReadinessData(readinessRes.data || readinessRes || null);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
    } catch (err) {
      console.error("Error loading IPO readiness data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const handleMilestoneToggle = async (itemKey, currentStatus) => {
    try {
      const newStatus = currentStatus === 'verified' ? 'needs_changes' : 'verified';
      await updateIpoReadinessItem(companyId, itemKey, newStatus, user?.name || 'Registered Merchant Banker');
      await loadData();
    } catch (err) {
      console.error("Failed to toggle milestone status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 1. Run AI Company Classification & Dynamic IPO Profile Engine
  const classification = classifyCompany({ name: readinessData?.companyName }, intakeData, documents);
  const ipoProfile = getIpoProfile(classification);

  const score = readinessData?.overall_score || 0;
  const label = readinessData?.overall_label || 'Getting started';
  const summaryText = readinessData?.summary || 'Calculated live across intake fields, source documents, gap penalties, and reviewer certifications.';
  const breakdown = readinessData?.sections || {};

  // Compute total missing items across app (excluding industry exempted items!)
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));
  let missingFieldsCount = 0;
  let missingDocsCount = 0;
  const missingFieldsList = [];
  const missingDocsList = [];

  Object.entries(SECTION_KEYS).forEach(([secKey, secLabel]) => {
    const intakeKey = secKey === 'risk_factors' ? 'risk_information' : 
                      secKey === 'related_party' ? 'rpt' : 
                      secKey === 'promoter_details' ? 'promoters' : secKey;

    const secIntake = intakeData[intakeKey] || intakeData[secKey] || {};
    const reqQs = requiredQuestions(intakeKey, secIntake);
    const requiredUploads = SECTION_UPLOADS[secKey] || [];

    reqQs.forEach(q => {
      // Exclude exempted fields for this company's industry profile
      if (ipoProfile.exemptedFields?.[q.name]) return;

      const val = secIntake[q.name];
      if (val === undefined || val === null || String(val).trim() !== '') {
        missingFieldsCount++;
        missingFieldsList.push({ label: q.label, chapter: secLabel, stepKey: intakeKey, fieldName: q.name });
      }
    });

    requiredUploads.forEach(slot => {
      // Exclude exempted documents for this company's industry profile
      if (ipoProfile.exemptedUploads?.some(e => e.docType === slot.docType)) return;

      if (!uploadedDocTypes.has(slot.docType)) {
        missingDocsCount++;
        missingDocsList.push({ label: slot.label, chapter: secLabel });
      }
    });
  });

  const certifiedCount = Object.keys(SECTION_KEYS).filter(k => drafts[k] && drafts[k].status === 'certified').length;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. AI Company Intelligence Classification Banner */}
      <div className="bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                <Sparkles className="w-5 h-5 animate-pulse-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                    AI Industry-Aware Readiness
                  </span>
                  <h2 className="text-xl font-bold text-white">{classification.businessCategory}</h2>
                </div>
                <p className="text-slate-300 text-xs mt-0.5">
                  Industry readiness evaluated for <strong className="text-indigo-300">{readinessData?.companyName}</strong> • Non-applicable industry requirements are excluded from penalties.
                </p>
              </div>
            </div>
          </div>

          {/* Overall Score Dial Card & Next Action */}
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 flex items-center gap-4 shrink-0 min-w-[240px]">
              <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" className="stroke-white/10 fill-none stroke-[8]" />
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="45" 
                    className="fill-none stroke-[8] transition-all duration-700 ease-out stroke-indigo-400"
                    strokeDasharray="283"
                    strokeDashoffset={283 - (283 * score) / 100}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute text-center">
                  <span className="text-base font-extrabold text-white block leading-none">{score}%</span>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-mono text-indigo-300 font-bold uppercase block tracking-wider">Status Designation</span>
                <span className="text-sm font-bold text-white block leading-snug">{label}</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{certifiedCount} of 11 certified</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/draft')}
              className="btn-primary text-xs font-bold py-3.5 px-4 rounded-xl shadow-indigo-600/10 flex items-center gap-1.5 shrink-0"
            >
              <span>Draft Prospectus</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. AI Executive Summary Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider font-mono">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>AI Executive Audit Summary</span>
        </div>
        <p className="text-slate-700 text-xs leading-relaxed font-sans">{summaryText}</p>
      </div>

      {/* 3. Executive KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Intake Completion */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400 uppercase">
            <span>Intake Completion</span>
            <span className="text-slate-700">Max 40 pts</span>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {breakdown.intake_completion?.score || 0} <span className="text-xs text-slate-400 font-normal">/ 40</span>
          </p>
          <p className="text-[11px] text-slate-500 leading-normal">{breakdown.intake_completion?.note || 'Intake fields completed'}</p>
        </div>

        {/* Document Verification */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400 uppercase">
            <span>Document Uploads</span>
            <span className="text-slate-700">Max 30 pts</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">
            {breakdown.document_completion?.score || 0} <span className="text-xs text-slate-400 font-normal">/ 30</span>
          </p>
          <p className="text-[11px] text-slate-500 leading-normal">{breakdown.document_completion?.note || 'Source documents'}</p>
        </div>

        {/* Gap Penalties */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400 uppercase">
            <span>Gap Penalties</span>
            <span className="text-slate-700">Penalty</span>
          </div>
          <p className="text-2xl font-extrabold text-red-700">
            {breakdown.gap_penalty?.score || 0} <span className="text-xs text-slate-400 font-normal">pts</span>
          </p>
          <p className="text-[11px] text-slate-500 leading-normal">{breakdown.gap_penalty?.note || 'Cross-doc penalties'}</p>
        </div>

        {/* Banker Certification */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs font-mono font-bold text-slate-400 uppercase">
            <span>Banker Certification</span>
            <span className="text-slate-700">Max 30 pts</span>
          </div>
          <p className="text-2xl font-extrabold text-indigo-700">
            {breakdown.reviewer_certification?.score || 0} <span className="text-xs text-slate-400 font-normal">/ 30</span>
          </p>
          <p className="text-[11px] text-slate-500 leading-normal">{breakdown.reviewer_certification?.note || 'Certified chapters'}</p>
        </div>
      </div>

      {/* 4. Missing Items Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Missing Fields Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-amber-600" />
              Applicable Missing Fields ({missingFieldsCount})
            </span>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
              {missingFieldsCount === 0 ? 'All Completed' : 'Action Required'}
            </span>
          </div>

          {missingFieldsList.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
              {missingFieldsList.slice(0, 10).map((f, idx) => (
                <div key={idx} className="p-2 bg-amber-50/50 border border-amber-200/70 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">{f.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{f.chapter}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/intake?step=${f.stepKey}&field=${f.fieldName}`)}
                    className="shrink-0 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5"
                  >
                    <span>Fill</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All required intake fields for {classification.businessCategory} are completed.
            </p>
          )}
        </div>

        {/* Missing Documents Box */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <FileCheck2 className="w-4 h-4 text-indigo-600" />
              Applicable Statutory Documents ({missingDocsCount})
            </span>
            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {missingDocsCount === 0 ? 'All Uploaded' : 'Upload Required'}
            </span>
          </div>

          {missingDocsList.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 text-xs">
              {missingDocsList.map((d, idx) => (
                <div key={idx} className="p-2 bg-indigo-50/50 border border-indigo-200/70 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">{d.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{d.chapter}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/intake')}
                    className="shrink-0 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5"
                  >
                    <span>Upload</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> All required statutory documents for {classification.businessCategory} are uploaded.
            </p>
          )}
        </div>
      </div>

      {/* 5. Top Risks & Recommendations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Top Risks Blocking IPO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 text-red-800 border-b border-slate-100 pb-2.5">
            <ShieldAlert className="w-4 h-4 text-red-600" />
            Industry Risks Blocking IPO
          </h3>
          {readinessData?.top_gaps && readinessData.top_gaps.length > 0 ? (
            <div className="space-y-2 text-xs">
              {readinessData.top_gaps.map((gapMsg, idx) => (
                <div key={idx} className="p-3 bg-red-50/60 border border-red-200/80 rounded-xl space-y-0.5">
                  <span className="text-[10px] font-bold text-red-800 font-mono uppercase block">Risk Item #{idx + 1}</span>
                  <p className="text-red-950 font-medium text-[11px] leading-relaxed">{gapMsg}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Zero high severity risks blocking IPO filing.
            </p>
          )}
        </div>

        {/* Top Recommendations & Next Actions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5 text-indigo-800 border-b border-slate-100 pb-2.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Top Recommendations & Next Actions
          </h3>
          {readinessData?.recommendations && readinessData.recommendations.length > 0 ? (
            <div className="space-y-2 text-xs">
              {readinessData.recommendations.map((recMsg, idx) => (
                <div key={idx} className="p-3 bg-indigo-50/50 border border-indigo-200/70 rounded-xl flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-slate-800 font-medium text-[11px] leading-relaxed">{recMsg}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No pending recommendations.</p>
          )}
        </div>
      </div>

      {/* 6. Milestone Timeline & Verification Checklist */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800 text-base">IPO Readiness Timeline & Milestone Verification</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">
            {readinessData?.milestone_items?.length || 0} Milestones Tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {readinessData?.milestone_items?.map((item) => (
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
                  type="button"
                  onClick={() => handleMilestoneToggle(item.key, item.status)}
                  className="w-full py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg transition-colors"
                >
                  {item.status === 'verified' ? 'Mark Needs Changes' : 'Verify Milestone'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
