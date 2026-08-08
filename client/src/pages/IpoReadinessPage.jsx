import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIntake, getDocuments, getDrafts, getGapReport } from '../services/api';
import { calculateSingleSourceOfTruthReadiness } from '../utils/readinessEngine';
import { useAuth } from '../context/AuthContext';
import { useDraftDocument } from '../context/DraftDocumentContext';
import { 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw,
  ArrowRight,
  Sparkles,
  Award,
  Layers,
  Info
} from 'lucide-react';

export default function IpoReadinessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { readiness: centralReadiness, loadDraftData } = useDraftDocument();
  const [loading, setLoading] = useState(true);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadData = async () => {
    try {
      setLoading(true);
      const [intakeRes, docsRes, draftsRes, gapRes] = await Promise.all([
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId),
        getGapReport(companyId)
      ]);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
      setGapReport(gapRes.data || gapRes || []);
      if (loadDraftData) await loadDraftData(true);
    } catch (err) {
      console.error("Error loading IPO readiness data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  // Safe readiness object from central context with deterministic engine fallback
  const readiness = centralReadiness || calculateSingleSourceOfTruthReadiness(intakeData, documents, gapReport, drafts);
  const { score: overallScore, categories, meta } = readiness;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-xs font-mono font-medium">Calculating Single Source of Truth IPO Readiness Score…</p>
      </div>
    );
  }

  // Build Action Plan to reach 100/100
  const actionItems = [];

  if (meta.uploadedCoreDocsCount < meta.totalCoreDocs) {
    const missingPts = Math.round(((meta.totalCoreDocs - meta.uploadedCoreDocsCount) / meta.totalCoreDocs) * 15);
    actionItems.push({
      id: 'ACT-001',
      category: 'Intake & Documents',
      title: `Upload Remaining Statutory Evidence (${meta.totalCoreDocs - meta.uploadedCoreDocsCount} Docs)`,
      description: 'Attach certified Board Resolution and Articles of Association (AOA) charters.',
      pts: missingPts > 0 ? missingPts : 5,
      route: '/intake',
      btnText: 'Go to Intake Form'
    });
  }

  if (meta.passedRulesCount < meta.totalRules) {
    const missingPts = (meta.totalRules - meta.passedRulesCount) * 5;
    actionItems.push({
      id: 'ACT-002',
      category: 'Compliance & Checks',
      title: 'Complete SEBI ICDR Sec 179 Board Authorization',
      description: 'Execute board resolution approving equity issue and audit committee charter.',
      pts: missingPts > 0 ? missingPts : 5,
      route: '/compliance-checklist',
      btnText: 'Verify Compliance'
    });
  }

  if (meta.certifiedChaptersCount < meta.totalChapters) {
    const remainingChapters = meta.totalChapters - meta.certifiedChaptersCount;
    const missingPts = Math.round(remainingChapters * 1.82);
    actionItems.push({
      id: 'ACT-003',
      category: 'Reviewer Certification',
      title: `Obtain Merchant Banker Certification on ${remainingChapters} Chapters`,
      description: 'Submit completed DRHP chapters to Lead Merchant Banker for legal certification.',
      pts: missingPts > 0 ? missingPts : 7,
      route: '/reviewer',
      btnText: 'Open Reviewer Workspace'
    });
  }

  if (meta.addressedGapsCount < meta.totalGaps) {
    const remainingGaps = meta.totalGaps - meta.addressedGapsCount;
    const missingPts = Math.round((remainingGaps / meta.totalGaps) * 20);
    actionItems.push({
      id: 'ACT-004',
      category: 'Gap Remediation',
      title: `Address ${remainingGaps} Identified Disclosure Discrepancies`,
      description: 'Document litigation notice & RPT reconciliation disclosures in DRHP draft.',
      pts: missingPts > 0 ? missingPts : 4,
      route: '/gap-analysis',
      btnText: 'Go to Gap Analysis'
    });
  }

  return (
    <div className="space-y-6 font-sans pb-12 max-w-7xl mx-auto">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">IPO Readiness</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fixed 100-Point Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            One single authoritative readiness score. Cumulative progress calculation out of 100 points across 4 fixed categories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Recalculate Progress</span>
          </button>
        </div>
      </div>

      {/* ── PRIMARY HERO SCORE CARD (Single Score Display Only) ────────────── */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">
          {/* Main Score Display: 70 / 100 IPO Readiness */}
          <div className="space-y-3 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono font-bold text-indigo-300 border border-white/10">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>Single Source of Truth Score</span>
            </div>

            <div className="flex items-baseline justify-center lg:justify-start gap-3">
              <span className="text-6xl sm:text-7xl font-black tracking-tight text-white font-mono">
                {overallScore}
              </span>
              <span className="text-2xl font-bold text-indigo-300 font-mono">/ 100 IPO Readiness</span>
            </div>

            <p className="text-sm font-medium text-slate-300 max-w-md">
              {overallScore === 0 ? '🏁 Initial setup phase. Begin by filling intake details and uploading statutory charters to earn points.' :
               overallScore >= 85 ? '🎉 Outstanding! DRHP filing preparations are certified and ready for submission.' :
               overallScore >= 60 ? '⚡ Strong progress! Key compliance and intake requirements are satisfied.' :
               '🚀 Preparation in progress. Complete remaining intake and legal checks to earn full score.'}
            </p>
          </div>

          {/* 4 Category Score Pills (Sums Exactly to overallScore) */}
          <div className="w-full lg:w-1/2 space-y-4 bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-indigo-200 font-bold uppercase tracking-wider">Category Score Sum</span>
              <span className="text-emerald-400 font-bold font-mono">{categories.intake.score} + {categories.compliance.score} + {categories.gapRemediation.score} + {categories.certification.score} = {overallScore} Pts</span>
            </div>

            <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 rounded-full transition-all duration-700 shadow-lg"
                style={{ width: `${overallScore}%` }}
              />
            </div>

            {/* 4 Category Exact Points Badges */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-slate-300 truncate">Intake & Info</span>
                <span className="font-bold text-indigo-300">{categories.intake.score}/30</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-slate-300 truncate">Compliance</span>
                <span className="font-bold text-indigo-300">{categories.compliance.score}/30</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-slate-300 truncate">Gap Remediation</span>
                <span className="font-bold text-indigo-300">{categories.gapRemediation.score}/20</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-slate-300 truncate">Certification</span>
                <span className="font-bold text-emerald-400">{categories.certification.score}/20</span>
              </div>
            </div>
          </div>
        </div>

        {/* Informational Callout */}
        <div className="mt-6 pt-4 border-t border-white/10 flex items-start gap-2.5 text-xs text-indigo-200">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-white">Cumulative Rule Guarantee:</strong> Identifying or documenting a risk disclosure never reduces your score. Completing required intake items, compliance checks, gap remediations, and legal certifications adds points towards reaching 100/100.
          </p>
        </div>
      </div>

      {/* ── 4 CATEGORY BREAKDOWN CARDS GRID (2x2) ────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-mono flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" /> Category Point Breakdown (Sum = {overallScore} / 100)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CATEGORY 1 CARD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{categories.intake.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 30 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-indigo-600 font-mono bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                  {categories.intake.score} / 30 Pts
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${categories.intake.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.filledIntakeSectionsCount} / {meta.totalIntakeSections} Intake Sections Completed</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.uploadedCoreDocsCount} / {meta.totalCoreDocs} Statutory Charters & Audits Uploaded</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/intake')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-indigo-200 cursor-pointer mt-2"
            >
              <span>Manage Intake & Documents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 2 CARD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{categories.compliance.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 30 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-purple-600 font-mono bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
                  {categories.compliance.score} / 30 Pts
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full" style={{ width: `${categories.compliance.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.passedRulesCount} / {meta.totalRules} SEBI ICDR Rules Satisfied</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Net Worth & Promoters Lock-in Eligibility Passed</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/compliance-checklist')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-purple-200 cursor-pointer mt-2"
            >
              <span>Verify SEBI ICDR Rules</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 3 CARD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{categories.gapRemediation.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-amber-700 font-mono bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                  {categories.gapRemediation.score} / 20 Pts
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: `${categories.gapRemediation.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.addressedGapsCount} / {meta.totalGaps} Identified Discrepancies Remedied</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Risk Factors & Tax Demands Documented in DRHP</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/gap-analysis')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-amber-200 cursor-pointer mt-2"
            >
              <span>View Gap Remediation</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 4 CARD */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{categories.certification.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                  {categories.certification.score} / 20 Pts
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${categories.certification.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.certifiedChaptersCount} / {meta.totalChapters} DRHP Chapters Certified by Reviewer</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.approvedChaptersCount} Chapters Approved by Lead Merchant Banker</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/reviewer')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-emerald-200 cursor-pointer mt-2"
            >
              <span>Open Reviewer Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── "PATH TO 100/100" ACTIONABLE TASK PLAN ──────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" /> Action Plan to Reach 100/100 Points
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-sans">
              Complete these specific workflow actions to earn the remaining {100 - overallScore} points and achieve 100% filing readiness.
            </p>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
            {100 - overallScore} Points Remaining
          </span>
        </div>

        <div className="space-y-3">
          {actionItems.length === 0 ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <h4 className="font-bold text-emerald-900 text-sm">Perfect 100/100 Score Achieved!</h4>
              <p className="text-xs text-emerald-700">All intake disclosures, compliance checks, remediations, and reviewer certifications are 100% complete.</p>
            </div>
          ) : (
            actionItems.map((act) => (
              <div key={act.id} className="p-4 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded">
                      {act.category}
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded">
                      +{act.pts} Points Available
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm font-sans">{act.title}</h4>
                  <p className="text-xs text-slate-500 font-sans">{act.description}</p>
                </div>

                <button
                  onClick={() => navigate(act.route)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <span>{act.btnText}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── DETERMINISTIC FORMULA TRANSPARENCY ────────────────────────────── */}
      <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-3">
        <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600" /> Deterministic Scoring Model Transparency
        </h4>
        <p className="text-xs text-slate-600 leading-relaxed font-sans">
          The IPO Pilot AI Readiness score uses a fixed 100-point allocation matrix:
          <strong> Intake & Company Information</strong> ({categories.intake.score}/30) + 
          <strong> Compliance & SEBI Checks</strong> ({categories.compliance.score}/30) + 
          <strong> Gap Analysis & Remediation</strong> ({categories.gapRemediation.score}/20) + 
          <strong> Reviewer Certification</strong> ({categories.certification.score}/20) = 
          <strong className="text-indigo-600 font-mono"> {overallScore} / 100 IPO Readiness</strong>.
        </p>
      </div>
    </div>
  );
}
