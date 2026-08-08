import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIntake, getDocuments, getDrafts, getGapReport } from '../services/api';
import { calculateSingleSourceOfTruthReadiness } from '../utils/readinessEngine';
import { useAuth } from '../context/AuthContext';
import { useDraftDocument } from '../context/DraftDocumentContext';
import { 
  CheckCircle2, 
  RefreshCw,
  ArrowRight,
  Sparkles,
  Award,
  Layers,
  FileText,
  Download,
  ShieldCheck
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

  const readiness = centralReadiness || calculateSingleSourceOfTruthReadiness(intakeData, documents, gapReport, drafts);
  const { score: overallScore, categories, sectionBreakdown, meta } = readiness;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-xs font-mono font-medium">Calculating Fixed Weighted IPO Readiness Score…</p>
      </div>
    );
  }

  const isFullyReady = overallScore === 100;

  return (
    <div className="space-y-6 font-sans pb-12 max-w-6xl mx-auto animate-fade-in">
      
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">IPO READINESS</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Fixed 100-Point Weighted Model
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 font-sans">
            Section-level weighted cumulative progress score out of 100 points across 5 independent categories.
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
              <span>{isFullyReady ? '100% Certified & Approved' : 'Cumulative Progress Score'}</span>
            </div>

            <div className="flex items-baseline justify-center lg:justify-start gap-3">
              <span className="text-6xl sm:text-7xl font-black tracking-tight text-white font-mono">
                {overallScore}%
              </span>
              <span className="text-2xl font-bold text-indigo-300 font-mono">
                {isFullyReady ? '— IPO READY' : 'Progress toward DRHP readiness'}
              </span>
            </div>

            <p className="text-sm font-medium text-slate-300 max-w-md">
              {isFullyReady 
                ? '🎉 All required workflow stages completed. DRHP filing is 100% ready for export.'
                : overallScore === 0 
                ? '🏁 Initial setup phase (0/100). Complete Intake Form sections to earn points.' 
                : '🚀 Cumulative workflow progress. Earn points as sections, documents, compliance rules, gaps, and certifications are completed.'}
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

            {/* 5 Fixed Category Summary Pills */}
            <div className="grid grid-cols-5 gap-1.5 text-[10px] font-mono pt-1 text-center">
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                <span className="text-slate-300 text-[9px] block">Intake</span>
                <span className="font-bold text-indigo-300">{categories.intake.score}/30</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                <span className="text-slate-300 text-[9px] block">Docs</span>
                <span className="font-bold text-blue-300">{categories.documents.score}/20</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                <span className="text-slate-300 text-[9px] block">Compl.</span>
                <span className="font-bold text-purple-300">{categories.compliance.score}/10</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                <span className="text-slate-300 text-[9px] block">Gaps</span>
                <span className="font-bold text-amber-300">{categories.gapRemediation.score}/20</span>
              </div>
              <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex flex-col items-center">
                <span className="text-slate-300 text-[9px] block">Cert.</span>
                <span className="font-bold text-emerald-400">{categories.certification.score}/20</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── FIVE CATEGORY PROGRESS CARDS ────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" /> Five Independent Category Breakdown (Sum = {overallScore} / 100)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* CATEGORY 1: INTAKE FORM (30 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">INTAKE FORM</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 30 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-indigo-700 font-mono bg-indigo-50 px-2.5 py-1 rounded-xl border border-indigo-100">
                  {categories.intake.score} / 30
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-600 h-full rounded-full transition-all duration-500" style={{ width: `${categories.intake.pct}%` }} />
              </div>

              {/* Intake Section Level Weighted Breakdown */}
              <div className="space-y-1 text-[11px] text-slate-600 font-mono pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span>Company Details:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.companyDetails} / 5 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Promoters & Capital:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.promotersCapital} / 5 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Business Overview:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.businessOverview} / 5 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Financial Info:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.financials} / 5 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Legal / Compliance:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.legalCompliance} / 4 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Objects / RPT:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.objectsRpt} / 3 Pts</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Risk Factors:</span>
                  <span className="font-bold text-slate-900">{sectionBreakdown.riskFactors} / 3 Pts</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/intake')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-indigo-200 cursor-pointer mt-2"
            >
              <span>Go to Intake Form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 2: DOCUMENTS (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">DOCUMENTS</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-blue-700 font-mono bg-blue-50 px-2.5 py-1 rounded-xl border border-blue-100">
                  {categories.documents.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-600 h-full rounded-full transition-all duration-500" style={{ width: `${categories.documents.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 font-sans pt-1">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{meta.uploadedCoreDocsCount} / {meta.totalCoreDocs} Statutory Charters Uploaded</span>
                </div>
                <div className="space-y-1 pt-1 text-[11px] font-mono text-slate-500 border-t border-slate-100">
                  {meta.coreDocs.map(doc => (
                    <div key={doc.type} className="flex items-center justify-between">
                      <span className="truncate">{doc.label}:</span>
                      <span className={doc.uploaded ? 'font-bold text-emerald-600' : 'text-slate-400'}>
                        {doc.uploaded ? '+4 Pts' : '0 Pts'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/intake')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-blue-200 cursor-pointer mt-2"
            >
              <span>Upload Documents</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 3: COMPLIANCE (10 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">COMPLIANCE</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 10 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-purple-700 font-mono bg-purple-50 px-2.5 py-1 rounded-xl border border-purple-100">
                  {categories.compliance.score} / 10
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full transition-all duration-500" style={{ width: `${categories.compliance.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 font-sans pt-1">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                  <span>{meta.passedRulesCount} / {meta.totalRules} SEBI ICDR Rules Passed</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                  Each verified compliance check earns 2 points toward the 10-point ceiling.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/compliance-checklist')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-purple-200 cursor-pointer mt-2"
            >
              <span>Check Compliance</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 4: GAP ANALYSIS (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">GAP ANALYSIS</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-amber-700 font-mono bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                  {categories.gapRemediation.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full transition-all duration-500" style={{ width: `${categories.gapRemediation.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 font-sans pt-1">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{meta.addressedGapsCount} / {meta.totalGaps} Identified Discrepancies Resolved</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                  Resolving gaps earns points. Identifying a gap never deducts points.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/gap-analysis')}
              className="w-full py-2 px-3 bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-800 font-semibold rounded-xl text-xs transition-all flex items-center justify-between border border-slate-200 hover:border-amber-200 cursor-pointer mt-2"
            >
              <span>View Gap Analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* CATEGORY 5: REVIEWER CERTIFICATION (20 PTS) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                    5
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">REVIEWER CERTIFICATION</h4>
                    <span className="text-[10px] text-slate-400 font-mono">Max Allocation: 20 Points</span>
                  </div>
                </div>
                <span className="text-base font-black text-emerald-700 font-mono bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                  {categories.certification.score} / 20
                </span>
              </div>

              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full transition-all duration-500" style={{ width: `${categories.certification.pct}%` }} />
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 font-sans pt-1">
                <div className="flex items-center gap-2 text-slate-700 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{meta.certifiedChaptersCount} / {meta.totalChapters} DRHP Chapters Certified</span>
                </div>
                <p className="text-[11px] text-slate-500 font-mono border-t border-slate-100 pt-1">
                  Merchant Banker certification awards final 20 points toward 100/100 readiness.
                </p>
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

      {/* ── FINAL STATE EXPORT BANNER (Enabled when 100/100) ───────────────── */}
      {isFullyReady && (
        <div className="bg-emerald-500 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 font-sans animate-fade-in">
          <div className="space-y-1 text-center sm:text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/20 text-xs font-mono font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>100% — IPO READY</span>
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
