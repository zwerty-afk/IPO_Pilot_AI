import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getIntake, getDocuments, getDrafts, getGapReport } from '../services/api';
import { calculateSingleSourceOfTruthReadiness } from '../utils/readinessEngine';
import { useDraftDocument } from '../context/DraftDocumentContext';
import {
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Award,
  Layers,
  Download,
  ShieldCheck,
  Circle,
  Lock
} from 'lucide-react';

const STAGE_THEME = {
  intake: { text: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-100', bar: 'bg-indigo-600', chip: 'text-indigo-300' },
  compliance: { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-100', bar: 'bg-purple-600', chip: 'text-purple-300' },
  gapAnalysis: { text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-100', bar: 'bg-amber-500', chip: 'text-amber-300' },
  certification: { text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', bar: 'bg-emerald-600', chip: 'text-emerald-400' }
};

const STAGE_ROUTES = {
  intake: '/intake',
  compliance: '/compliance-checklist',
  gapAnalysis: '/gap-analysis',
  certification: '/reviewer'
};

const STAGE_CTA = {
  intake: 'Go to Intake Form',
  compliance: 'Check Compliance',
  gapAnalysis: 'View Gap Analysis',
  certification: 'Open Reviewer Workspace'
};

export default function IpoReadinessPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { readiness: centralReadiness, loadDraftData } = useDraftDocument();
  const [loading, setLoading] = useState(true);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);

  const companyId = user?.companyId || localStorage.getItem('ipo_company_id') || '';

  const loadData = async () => {
    if (!companyId) {
      setIntakeData({});
      setDocuments([]);
      setDrafts({});
      setGapReport([]);
      setLoading(false);
      return;
    }

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
    const handleUpdate = () => loadData();
    window.addEventListener('ipo-company-changed', handleUpdate);
    return () => {
      window.removeEventListener('ipo-company-changed', handleUpdate);
    };
  }, [companyId]);

  const readiness = centralReadiness || calculateSingleSourceOfTruthReadiness(intakeData, documents, gapReport, drafts);
  const { score: overallScore, stages, nextActions, remainingPoints, status } = readiness;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-xs font-mono font-medium">Calculating IPO Readiness Score…</p>
      </div>
    );
  }

  const isFullyReady = overallScore === 100;
  const stageOrder = ['intake', 'compliance', 'gapAnalysis', 'certification'];

  return (
    <div className="space-y-6 font-sans pb-12 max-w-6xl mx-auto animate-fade-in">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">IPO READINESS</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              4-Stage Cumulative Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            One 100-point score, earned through the real IPO preparation journey: Intake → Compliance → Gap Analysis → Reviewer Certification.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Readiness</span>
        </button>
      </div>

      {/* ── PRIMARY HERO SCORE CARD ────────────────────────────────────────── */}
      <div className={`rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden transition-all ${
        isFullyReady
          ? 'bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 border border-emerald-500/30'
          : 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20'
      }`}>
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 relative z-10">

          {/* Main Hero Score Display */}
          <div className="space-y-3 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-mono font-bold text-indigo-200 border border-white/10">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{status.label}</span>
            </div>

            <div className="flex items-baseline justify-center lg:justify-start gap-3">
              <span className="text-6xl sm:text-7xl font-black tracking-tight text-white font-mono">
                {overallScore}
              </span>
              <span className="text-2xl font-bold text-indigo-300 font-mono">
                / 100 {isFullyReady ? '— IPO READY' : ''}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-300 max-w-md">
              {isFullyReady
                ? '🎉 All required workflow stages completed. DRHP filing is 100% ready for export.'
                : overallScore === 0
                ? '🏁 Nothing earned yet. Complete Intake Form sections to start earning points.'
                : `Every point below was earned from a completed action. ${remainingPoints} points remain across the stages that still need work.`}
            </p>
          </div>

          {/* Overall Progress Gauge */}
          <div className="w-full lg:w-1/2 space-y-4 bg-white/5 backdrop-blur-md p-5 rounded-2xl border border-white/10">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-indigo-200 font-bold uppercase tracking-wider">TOTAL IPO READINESS</span>
              <span className="text-emerald-400 font-bold">{overallScore} / 100 Pts</span>
            </div>

            <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className={`h-full rounded-full transition-all duration-700 shadow-lg ${
                  isFullyReady ? 'bg-gradient-to-r from-emerald-500 to-teal-300' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400'
                }`}
                style={{ width: `${overallScore}%` }}
              />
            </div>

            {/* 4 Stage Summary Pills */}
            <div className="grid grid-cols-4 gap-1.5 text-[10px] font-mono pt-1 text-center">
              {stageOrder.map((key) => (
                <div key={key} className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                  <span className={`text-[9px] block ${STAGE_THEME[key].chip}`}>{stages[key].title.split(' ')[0]}</span>
                  <span className="font-bold text-white">{stages[key].score}/{stages[key].max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FOUR STAGE PROGRESS CARDS ────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" /> Four-Stage Breakdown (Sum = {overallScore} / 100)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* STAGE 1: INTAKE (40 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">1</div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">INTAKE & COMPANY INFORMATION</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 40 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-indigo-700 font-mono bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                  {stages.intake.score} / 40
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${stages.intake.pct}%` }} />
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100 max-h-40 overflow-y-auto pr-1">
                {stages.intake.sections.map((s) => (
                  <div key={s.key} className="flex items-center justify-between">
                    <span className="truncate pr-2">{s.label}:</span>
                    <span className={`font-bold shrink-0 ${s.points === s.max ? 'text-emerald-600' : s.points > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {s.points} / {s.max} Pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate(STAGE_ROUTES.intake)}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-indigo-200 cursor-pointer mt-2"
            >
              <span>{STAGE_CTA.intake}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* STAGE 2: COMPLIANCE (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-purple-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">2</div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">COMPLIANCE & SEBI CHECKS</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-purple-700 font-mono bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
                  {stages.compliance.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${stages.compliance.pct}%` }} />
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100 max-h-40 overflow-y-auto pr-1">
                {stages.compliance.rules.map((r) => (
                  <div key={r.id} className="flex items-center justify-between">
                    <span className="truncate pr-2">{r.requirementName}:</span>
                    <span className={`font-bold shrink-0 ${r.earnedPoints === r.points ? 'text-emerald-600' : r.earnedPoints > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {r.earnedPoints} / {r.points} Pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => navigate(STAGE_ROUTES.compliance)}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-purple-200 cursor-pointer mt-2"
            >
              <span>{STAGE_CTA.compliance}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* STAGE 3: GAP ANALYSIS (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-amber-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">3</div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">GAP ANALYSIS & REMEDIATION</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-amber-700 font-mono bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                  {stages.gapAnalysis.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${stages.gapAnalysis.pct}%` }} />
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100 max-h-40 overflow-y-auto pr-1">
                {stages.gapAnalysis.checks.map((c) => (
                  <div key={c.id} className="flex items-center justify-between">
                    <span className="truncate pr-2">{c.title}:</span>
                    <span className={`font-bold shrink-0 ${c.resolved ? 'text-emerald-600' : c.applicable ? 'text-amber-600' : 'text-slate-400'}`}>
                      {c.earnedPoints} / {c.points} Pts
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                Resolving a gap earns points. Identifying one never deducts points.
              </p>
            </div>

            <button
              onClick={() => navigate(STAGE_ROUTES.gapAnalysis)}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-amber-200 cursor-pointer mt-2"
            >
              <span>{STAGE_CTA.gapAnalysis}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* STAGE 4: REVIEWER CERTIFICATION (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">4</div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">REVIEWER CERTIFICATION</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                  {stages.certification.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${stages.certification.pct}%` }} />
              </div>

              <div className="space-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100 max-h-40 overflow-y-auto pr-1">
                {stages.certification.chapters.map((c) => (
                  <div key={c.key} className="flex items-center justify-between">
                    <span className="truncate pr-2 flex items-center gap-1">
                      {c.status === 'certified' ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> : <Circle className="w-3 h-3 text-slate-300 shrink-0" />}
                      {c.label}:
                    </span>
                    <span className={`font-bold shrink-0 ${c.points === c.max ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {c.points} / {c.max} Pts
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-1 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Reviewer-only. Only an actual certification earns points — approval alone does not.
              </p>
            </div>

            <button
              onClick={() => navigate(STAGE_ROUTES.certification)}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-emerald-200 cursor-pointer mt-2"
            >
              <span>{STAGE_CTA.certification}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      </div>

      {/* ── REMAINING POINTS & NEXT ACTIONS ─────────────────────────────────── */}
      {!isFullyReady && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" /> How to Earn the Remaining Points
            </h3>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
              {remainingPoints} points remaining
            </span>
          </div>

          <div className="space-y-2.5">
            {nextActions.map((action) => (
              <button
                key={action.stage}
                onClick={() => navigate(action.route)}
                className={`w-full flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all text-left cursor-pointer ${STAGE_THEME[action.stage].bg} ${STAGE_THEME[action.stage].border} hover:brightness-95`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-black px-2 py-1 rounded-lg bg-white ${STAGE_THEME[action.stage].text}`}>
                    +{action.pointsRemaining}
                  </span>
                  <div>
                    <span className={`text-xs font-bold block ${STAGE_THEME[action.stage].text}`}>{action.label} — {action.pointsRemaining} points remaining</span>
                    <span className="text-[11px] text-slate-600">{action.description}</span>
                  </div>
                </div>
                <ArrowRight className={`w-4 h-4 shrink-0 ${STAGE_THEME[action.stage].text}`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FINAL STATE EXPORT BANNER (Enabled when 100/100) ───────────────── */}
      {isFullyReady && (
        <div className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 font-sans animate-fade-in">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>100 / 100 — IPO READY</span>
            </div>
            <h3 className="text-lg font-black tracking-tight">All required workflow stages completed.</h3>
            <p className="text-xs text-emerald-100">DRHP prospectus certified and ready for submission & export.</p>
          </div>

          <button
            onClick={() => navigate('/export')}
            className="px-5 py-3 bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Export DRHP Prospectus</span>
          </button>
        </div>
      )}
    </div>
  );
}
