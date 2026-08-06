import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getIntake, getDocuments, getIpoReadiness, getDrafts } from '../services/api';
import { SECTION_KEYS, computeChapterHealth, getIntakeForSection } from '../components/ChapterHealthSidebar';
import { stepQuestions, requiredQuestions, SECTION_UPLOADS } from '../data/intakeSchema';
import { classifyCompany, getIpoProfile } from '../data/companyClassifier';
import { evaluateSebiEligibilityRules } from '../data/sebiEligibilityRules';
import StatusBadge from '../components/StatusBadge';
import { 
  ListChecks, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowRight,
  Bookmark, 
  FileText,
  Loader2,
  Filter,
  Check,
  FileCheck2,
  Layers,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Building2,
  Info,
  MinusCircle
} from 'lucide-react';

export default function ComplianceChecklistPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [drafts, setDrafts] = useState({});

  // Interactive filters & chapter section selection
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'missing_only', 'docs_only', 'fields_only', 'critical_only', 'not_applicable'
  const [selectedChapter, setSelectedChapter] = useState('all'); // 'all' or specific secKey

  const chapterRefs = useRef({});
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  // Read URL search param for direct chapter focusing
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sec = params.get('chapter') || params.get('section');
    if (sec && (sec === 'all' || SECTION_KEYS[sec])) {
      setSelectedChapter(sec);
      if (sec !== 'all' && chapterRefs.current[sec]) {
        setTimeout(() => {
          chapterRefs.current[sec]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
      }
    }
  }, [location.search]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [intakeRes, docsRes, readinessRes, draftsRes] = await Promise.all([
        getIntake(companyId),
        getDocuments(companyId),
        getIpoReadiness(companyId),
        getDrafts(companyId)
      ]);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setReadiness(readinessRes.data || readinessRes || null);
      setDrafts(draftsRes.data || draftsRes || {});
    } catch (err) {
      console.error("Error loading compliance checklist data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  // 1. Run AI Company Classification & Dynamic IPO Profile Engine
  const classification = classifyCompany({ name: readiness?.companyName }, intakeData, documents);
  const ipoProfile = getIpoProfile(classification);
  const sebiRules = evaluateSebiEligibilityRules(intakeData, documents);

  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));

  // Build complete chapter-by-chapter dynamic compliance matrix
  let grandTotalRequiredFields = 0;
  let grandTotalCompletedFields = 0;
  let grandTotalRequiredDocs = 0;
  let grandTotalUploadedDocs = 0;

  const chaptersData = Object.entries(SECTION_KEYS).map(([secKey, label]) => {
    const intakeKey = secKey === 'risk_factors' ? 'risk_information' : 
                      secKey === 'related_party' ? 'rpt' : 
                      secKey === 'promoter_details' ? 'promoters' : secKey;

    const secIntake = getIntakeForSection(secKey, intakeData);
    const questions = stepQuestions[intakeKey] || [];
    const requiredUploads = SECTION_UPLOADS[secKey] || [];
    const health = computeChapterHealth(secKey, drafts, intakeData, documents);
    const secDraft = drafts[secKey] || { status: 'draft' };

    // Required fields breakdown
    const reqQs = requiredQuestions(intakeKey, secIntake);
    const completedFields = [];
    const missingFields = [];
    const exemptedFields = [];

    reqQs.forEach(q => {
      // Check if field is exempted for this industry
      const exemptionReason = ipoProfile.exemptedFields?.[q.name];
      if (exemptionReason) {
        exemptedFields.push({
          id: `exempt-field-${q.name}`,
          label: q.label,
          reason: exemptionReason,
          type: 'field'
        });
        return;
      }

      const val = secIntake[q.name];
      const hasVal = val !== undefined && val !== null && String(val).trim() !== '';
      if (hasVal) {
        completedFields.push({
          id: `field-${q.name}`,
          label: q.label,
          value: typeof val === 'object' ? JSON.stringify(val) : String(val),
          type: 'field',
          fieldName: q.name,
          stepKey: intakeKey
        });
      } else {
        missingFields.push({
          id: `missing-field-${q.name}`,
          label: q.label,
          reason: 'Required Intake Field Empty',
          type: 'field',
          fieldName: q.name,
          stepKey: intakeKey
        });
      }
    });

    // Required documents breakdown
    const uploadedDocsList = [];
    const missingDocsList = [];
    const exemptedDocsList = [];

    requiredUploads.forEach(slot => {
      // Check if doc upload is exempted for this industry
      const exemptObj = ipoProfile.exemptedUploads?.find(e => e.docType === slot.docType);
      if (exemptObj) {
        exemptedDocsList.push({
          id: `exempt-doc-${slot.key}`,
          label: slot.label,
          reason: exemptObj.reason,
          type: 'document'
        });
        return;
      }

      const doc = documents.find(d => d.doc_type === slot.docType);
      if (doc) {
        uploadedDocsList.push({
          id: `doc-${slot.key}`,
          label: slot.label,
          docName: doc.name || 'Uploaded & Verified',
          type: 'document'
        });
      } else {
        missingDocsList.push({
          id: `missing-doc-${slot.key}`,
          label: slot.label,
          reason: 'Required Document Upload Missing',
          type: 'document',
          docType: slot.docType
        });
      }
    });

    grandTotalRequiredFields += (completedFields.length + missingFields.length);
    grandTotalCompletedFields += completedFields.length;
    grandTotalRequiredDocs += (uploadedDocsList.length + missingDocsList.length);
    grandTotalUploadedDocs += uploadedDocsList.length;

    return {
      secKey,
      label,
      intakeKey,
      health,
      certificationStatus: secDraft.status || 'draft',
      certifiedBy: secDraft.certified_by || null,
      certifiedAt: secDraft.certified_at || null,
      reqQs,
      completedFields,
      missingFields,
      exemptedFields,
      requiredUploads,
      uploadedDocsList,
      missingDocsList,
      exemptedDocsList
    };
  });

  // Apply chapter selection & status filters
  const filteredChapters = chaptersData.filter(ch => {
    if (selectedChapter !== 'all' && ch.secKey !== selectedChapter) {
      return false;
    }
    if (activeFilter === 'missing_only') {
      return ch.missingFields.length > 0 || ch.missingDocsList.length > 0;
    }
    if (activeFilter === 'critical_only') {
      return ch.health.criticalCount > 0 || ch.health.completionScore < 50;
    }
    if (activeFilter === 'not_applicable') {
      return ch.exemptedFields.length > 0 || ch.exemptedDocsList.length > 0;
    }
    return true;
  });

  const totalRequiredAll = grandTotalRequiredFields + grandTotalRequiredDocs;
  const totalCompletedAll = grandTotalCompletedFields + grandTotalUploadedDocs;
  const overallCompliancePct = totalRequiredAll > 0 ? Math.round((totalCompletedAll / totalRequiredAll) * 100) : 0;

  const handleSelectChapterSection = (secKey) => {
    setSelectedChapter(secKey);
    navigate(`/compliance-checklist?chapter=${secKey}`, { replace: true });
    if (secKey !== 'all' && chapterRefs.current[secKey]) {
      chapterRefs.current[secKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner: AI Company Classification & Dynamic IPO Profile Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5 animate-pulse-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                  AI Classified Profile
                </span>
                <h2 className="text-xl font-bold text-white">{classification.businessCategory}</h2>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Model: <strong className="text-indigo-300">{classification.businessModel}</strong> • Type: <strong className="text-indigo-300">{classification.operationalType}</strong> • Asset: <strong className="text-indigo-300">{classification.assetType}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-3 rounded-xl border border-white/10 text-center min-w-[120px]">
              <span className="text-[10px] text-slate-300 font-mono font-bold uppercase block">Compliance Score</span>
              <span className="text-2xl font-extrabold text-emerald-400">{overallCompliancePct}%</span>
            </div>

            <button
              type="button"
              onClick={() => navigate('/gap-analysis')}
              className="btn-primary text-xs font-bold py-3 px-4 rounded-xl shadow-indigo-600/10 flex items-center gap-1.5 shrink-0"
            >
              <span>Proceed to Gap Analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Classification Explanation Callout */}
        <div className="bg-white/5 border border-white/10 p-3.5 rounded-xl text-xs space-y-1">
          <p className="text-slate-300 leading-relaxed">
            <strong className="text-indigo-300">AI Classification Explanation:</strong> {classification.aiExplanation}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">Regulatory Authorities:</span>
            {classification.regulatoryAuthorities.map((auth, idx) => (
              <span key={idx} className="text-[10px] bg-white/10 text-white font-mono px-2 py-0.5 rounded border border-white/10">
                {auth}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* PART 1 — SEBI SME Eligibility & Regulatory Framework Rules (March 2025 Norms) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-600" />
              <span>SEBI SME Eligibility & Regulatory Framework (March 2025 Rules)</span>
            </h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Automated validation against notified SEBI ICDR & LODR SME Amendment Regulations.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {sebiRules.filter(r => r.status === 'pass').length} Passed
            </span>
            <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
              {sebiRules.filter(r => r.status === 'fail').length} Failed
            </span>
            <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              {sebiRules.filter(r => r.status === 'needs_verification').length} Needs Verification
            </span>
            <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {sebiRules.filter(r => r.status === 'informational').length} Informational
            </span>
          </div>
        </div>

        {/* Rules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sebiRules.map((rule) => {
            const isPass = rule.status === 'pass';
            const isFail = rule.status === 'fail';
            const isNeedsData = rule.status === 'needs_data';
            const isVerification = rule.status === 'needs_verification';

            const badgeBg = isPass ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            isFail ? 'bg-red-50 text-red-700 border-red-200' :
                            isNeedsData ? 'bg-amber-50 text-amber-800 border-amber-200' :
                            isVerification ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-slate-100 text-slate-700 border-slate-200';

            return (
              <div key={rule.id} className="p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">{rule.title}</h4>
                      <span className="text-[9px] font-mono text-slate-400 font-bold uppercase">{rule.regRef}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 font-mono ${badgeBg}`}>
                      {rule.statusLabel}
                    </span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">{rule.description}</p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                  <p className={`text-[11px] font-medium leading-normal ${isFail ? 'text-red-950 font-semibold' : 'text-slate-700'}`}>
                    <strong className="text-slate-900">Current Status:</strong> {rule.reason}
                  </p>
                  
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-slate-400 font-mono font-semibold">Source: {rule.source}</span>
                    <button
                      type="button"
                      onClick={() => navigate(`/intake?step=${rule.stepKey}&field=${rule.fieldName}`)}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5"
                    >
                      <span>Verify in Intake</span>
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* In-Page Chapter Subsections Navigation Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Dynamic Chapter Subsections (In-Page Navigation):
          </span>
          {selectedChapter !== 'all' && (
            <button
              type="button"
              onClick={() => handleSelectChapterSection('all')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
            >
              Show All 11 Chapters
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar px-1">
          <button
            type="button"
            onClick={() => handleSelectChapterSection('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0 ${
              selectedChapter === 'all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-slate-200'
            }`}
          >
            All Chapters ({chaptersData.length})
          </button>

          {chaptersData.map(ch => {
            const isActive = selectedChapter === ch.secKey;
            return (
              <button
                key={ch.secKey}
                type="button"
                onClick={() => handleSelectChapterSection(ch.secKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>{ch.label}</span>
                <span className={`w-2 h-2 rounded-full ${ch.health.completionScore >= 80 ? 'bg-emerald-400' : ch.health.completionScore >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Display Filters:
          </span>

          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'all' ? 'bg-slate-800 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('missing_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'missing_only' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Missing Only
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('not_applicable')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'not_applicable' ? 'bg-slate-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Not Applicable (Exempted)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('docs_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'docs_only' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Documents Only
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('fields_only')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              activeFilter === 'fields_only' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Fields Only
          </button>
        </div>

        <span className="text-xs font-mono font-bold text-slate-400">
          Showing {filteredChapters.length} of {chaptersData.length} chapter sections
        </span>
      </div>

      {/* Dynamic Chapters Compliance Sections List */}
      <div className="space-y-6">
        {filteredChapters.map((ch) => {
          const showDocs = activeFilter !== 'fields_only';
          const showFields = activeFilter !== 'docs_only';

          return (
            <div 
              key={ch.secKey} 
              ref={(el) => (chapterRefs.current[ch.secKey] = el)}
              className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-5 scroll-mt-6"
            >
              {/* Chapter Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                    ch.health.completionScore >= 80 ? 'bg-emerald-500' : ch.health.completionScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-base">{ch.label} Compliance Section</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ch.health.badgeBg}`}>
                        {ch.health.statusLabel}
                      </span>
                      <StatusBadge status={ch.certificationStatus} />
                    </div>
                    <p className="text-slate-500 text-xs mt-0.5">
                      Completion: <strong className="text-slate-800">{ch.health.completionScore}%</strong> • Evidence Score: <strong className="text-indigo-700">{ch.health.evidenceScore}%</strong> • AI Confidence: <strong className="text-emerald-700">{ch.health.confidenceScore}%</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => navigate(`/draft?chapter=${ch.secKey}`)}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1"
                  >
                    <span>Synthesized Text Block</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                
                {/* REQUIRED & COMPLETED FIELDS */}
                {showFields && (
                  <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-600" />
                        Required Fields ({ch.completedFields.length} / {ch.completedFields.length + ch.missingFields.length})
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        {ch.completedFields.length + ch.missingFields.length > 0 
                          ? Math.round((ch.completedFields.length / (ch.completedFields.length + ch.missingFields.length)) * 100) 
                          : 100}%
                      </span>
                    </div>

                    {/* Completed Fields */}
                    {ch.completedFields.length > 0 && activeFilter !== 'missing_only' && activeFilter !== 'not_applicable' && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Completed Fields ({ch.completedFields.length})</span>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {ch.completedFields.map(f => (
                            <div key={f.id} className="p-2 bg-emerald-50/60 border border-emerald-200/60 rounded-lg flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-[11px] truncate">{f.label}</span>
                              <span className="text-[10px] text-emerald-800 font-mono font-bold shrink-0 flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-600" /> Verified
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Fields */}
                    {ch.missingFields.length > 0 && activeFilter !== 'not_applicable' && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Missing Fields ({ch.missingFields.length})</span>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {ch.missingFields.map(f => (
                            <div key={f.id} className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between gap-2">
                              <span className="font-semibold text-amber-950 text-[11px] truncate">{f.label}</span>
                              <button
                                type="button"
                                onClick={() => navigate(`/intake?step=${f.stepKey}&field=${f.fieldName}`)}
                                className="shrink-0 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5"
                              >
                                <span>Fill in Intake</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exempted / Not Applicable Fields */}
                    {ch.exemptedFields.length > 0 && activeFilter !== 'missing_only' && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Not Applicable / Exempted ({ch.exemptedFields.length})</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {ch.exemptedFields.map(f => (
                            <div key={f.id} className="p-2.5 bg-slate-100/70 border border-slate-200/80 rounded-lg space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700 text-[11px]">{f.label}</span>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                                  Not Applicable
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 italic">{f.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ch.missingFields.length === 0 && ch.exemptedFields.length === 0 && (
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All required intake fields completed.
                      </p>
                    )}
                  </div>
                )}

                {/* REQUIRED & UPLOADING DOCUMENTS */}
                {showDocs && (
                  <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200/60">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-indigo-600" />
                        Statutory Documents ({ch.uploadedDocsList.length} / {ch.uploadedDocsList.length + ch.missingDocsList.length})
                      </span>
                      <span className="text-[11px] font-bold text-indigo-700">
                        {ch.uploadedDocsList.length + ch.missingDocsList.length > 0 
                          ? Math.round((ch.uploadedDocsList.length / (ch.uploadedDocsList.length + ch.missingDocsList.length)) * 100) 
                          : 100}%
                      </span>
                    </div>

                    {/* Uploaded Documents */}
                    {ch.uploadedDocsList.length > 0 && activeFilter !== 'missing_only' && activeFilter !== 'not_applicable' && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-indigo-800 uppercase block">Uploaded & Verified ({ch.uploadedDocsList.length})</span>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {ch.uploadedDocsList.map(d => (
                            <div key={d.id} className="p-2 bg-indigo-50/60 border border-indigo-200/60 rounded-lg flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-800 text-[11px] truncate">{d.label}</span>
                              <span className="text-[10px] text-indigo-700 font-mono font-bold shrink-0">{d.docName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Missing Documents */}
                    {ch.missingDocsList.length > 0 && activeFilter !== 'not_applicable' && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Missing Documents ({ch.missingDocsList.length})</span>
                        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                          {ch.missingDocsList.map(d => (
                            <div key={d.id} className="p-2 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-center justify-between gap-2">
                              <span className="font-semibold text-amber-950 text-[11px] truncate">{d.label}</span>
                              <button
                                type="button"
                                onClick={() => navigate('/intake')}
                                className="shrink-0 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline flex items-center gap-0.5"
                              >
                                <span>Upload Document</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exempted / Not Applicable Documents */}
                    {ch.exemptedDocsList.length > 0 && activeFilter !== 'missing_only' && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Not Applicable / Exempted ({ch.exemptedDocsList.length})</span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {ch.exemptedDocsList.map(d => (
                            <div key={d.id} className="p-2.5 bg-slate-100/70 border border-slate-200/80 rounded-lg space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700 text-[11px]">{d.label}</span>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">
                                  Not Applicable
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 italic">{d.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {ch.missingDocsList.length === 0 && ch.exemptedDocsList.length === 0 && ch.requiredUploads.length > 0 && (
                      <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> All statutory document uploads verified.
                      </p>
                    )}

                    {ch.requiredUploads.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">No statutory upload requirements for this section.</p>
                    )}
                  </div>
                )}

              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}
