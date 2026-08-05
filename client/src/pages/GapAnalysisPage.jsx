import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCompanyStatus, getIntake, getDocuments, getDrafts } from '../services/api';
import { SECTION_KEYS, computeChapterHealth } from '../components/ChapterHealthSidebar';
import { stepQuestions, checkFieldAgainstDocuments, parseCitation } from '../data/intakeSchema';
import { 
  AlertTriangle, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  Loader2, 
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Layers,
  ShieldAlert,
  HelpCircle,
  Bookmark,
  Check
} from 'lucide-react';

export default function GapAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});

  // Interactive grouping state: 'chapter', 'severity', 'category', 'confidence'
  const [groupBy, setGroupBy] = useState('chapter');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedChapter, setSelectedChapter] = useState('all');

  const chapterRefs = useRef({});
  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  // Read URL search param for direct chapter focusing (e.g. ?chapter=business_overview)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sec = params.get('chapter') || params.get('section');
    if (sec && (sec === 'all' || SECTION_KEYS[sec])) {
      setSelectedChapter(sec);
      setGroupBy('chapter');
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
      const [statusRes, intakeRes, docsRes, draftsRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId)
      ]);
      setStats(statusRes.data || statusRes || {});
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
    } catch (err) {
      console.error("Error loading gap analysis data:", err);
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

  // Combine server gap report with client cross-document & AI validation rules
  const serverGaps = stats?.gapReport || [];
  const allGaps = [...serverGaps];
  const existingIds = new Set(allGaps.map(g => g.id || g.fieldName));

  Object.entries(SECTION_KEYS).forEach(([secKey, secLabel]) => {
    const intakeKey = secKey === 'risk_factors' ? 'risk_information' : 
                      secKey === 'related_party' ? 'rpt' : 
                      secKey === 'promoter_details' ? 'promoters' : secKey;

    const secIntake = intakeData[intakeKey] || intakeData[secKey] || {};
    const questions = stepQuestions[intakeKey] || [];

    questions.forEach(q => {
      const val = secIntake[q.name];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const issue = checkFieldAgainstDocuments(intakeKey, q.name, val, documents);
        if (issue && !existingIds.has(`${intakeKey}.${q.name}`)) {
          allGaps.push({
            id: `dyn-mismatch-${intakeKey}-${q.name}`,
            severity: 'high',
            category: 'consistency',
            fieldName: `${intakeKey}.${q.name}`,
            message: `Discrepancy in ${q.label}: Intake states "${issue.enteredDisplay}", but document (${issue.docName}) records "${issue.docDisplay}".`,
            explanation: `Cross-document mismatch detected between promoter intake input and statutory PDF extraction. SEBI regulations require strict consistency before DRHP submission.`,
            recommendation: `Verify the true value with legal counsel and update either the intake field or replace the uploaded document.`,
            intakeValue: issue.enteredDisplay,
            docValue: issue.docDisplay,
            docName: issue.docName,
            chapterKey: secKey,
            chapterLabel: secLabel,
            confidence: 'high'
          });
        }
      }
    });
  });

  // Ensure every gap has rich AI explanation, recommendation, and confidence
  const enrichedGaps = allGaps.map(g => {
    const fn = g.fieldName || '';
    const parts = fn.split('.');
    const intakeKey = parts[0] || 'general';
    const secKey = intakeKey === 'risk_information' ? 'risk_factors' :
                   intakeKey === 'rpt' ? 'related_party' :
                   intakeKey === 'promoters' ? 'promoter_details' : intakeKey;
    const chapterLabel = SECTION_KEYS[secKey] || g.chapterLabel || 'General Disclosure';

    return {
      ...g,
      chapterKey: secKey,
      chapterLabel,
      severity: g.severity || 'medium',
      category: g.category || 'consistency',
      confidence: g.confidence || (g.severity === 'high' ? 'high' : 'medium'),
      explanation: g.explanation || (
        g.category === 'consistency' 
          ? `Cross-document validation mismatch between intake data and verified source document.` 
          : `Mandatory SEBI ICDR disclosure item is missing or incomplete.`
      ),
      recommendation: g.recommendation || (
        g.category === 'consistency'
          ? `Review source document values and update intake entry.`
          : `Complete the required intake field to resolve this disclosure gap.`
      )
    };
  });

  // Filter by chapter & severity
  const filteredGaps = enrichedGaps.filter(g => {
    if (selectedChapter !== 'all' && g.chapterKey !== selectedChapter) return false;
    if (filterSeverity !== 'all' && g.severity !== filterSeverity) return false;
    return true;
  });

  // Grouping logic
  const groupGaps = () => {
    const groups = {};
    filteredGaps.forEach(g => {
      let key = 'Other';
      if (groupBy === 'chapter') key = g.chapterLabel;
      else if (groupBy === 'severity') key = `${g.severity.toUpperCase()} SEVERITY`;
      else if (groupBy === 'category') key = g.category === 'consistency' ? 'Cross-Document Inconsistencies' : 'Disclosure Gaps';
      else if (groupBy === 'confidence') key = `AI Confidence: ${g.confidence.toUpperCase()}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return groups;
  };

  const groupedData = groupGaps();

  const handleSelectChapterSection = (secKey) => {
    setSelectedChapter(secKey);
    setGroupBy('chapter');
    navigate(`/gap-analysis?chapter=${secKey}`, { replace: true });
    if (secKey !== 'all' && chapterRefs.current[secKey]) {
      chapterRefs.current[secKey]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleResolveNavigation = (item) => {
    const fn = item.fieldName || '';
    const parts = fn.split('.');
    if (parts.length === 2) {
      navigate(`/intake?step=${parts[0]}&field=${parts[1]}`);
    } else {
      navigate('/intake');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Gap Analysis</h2>
              <p className="text-slate-500 text-xs mt-0.5">
                Global AI Due Diligence dashboard displaying cross-document mismatches, disclosure gaps, and validation flags across all 11 chapters
              </p>
            </div>
          </div>
        </div>

        {/* Global Summary Pills & Next Action */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-red-50 p-3 rounded-2xl border border-red-200/70 text-center min-w-[110px]">
            <span className="text-[10px] text-red-800 font-mono font-bold uppercase block">High Severity</span>
            <span className="text-xl font-extrabold text-red-700">
              {enrichedGaps.filter(g => g.severity === 'high').length}
            </span>
          </div>

          <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200/70 text-center min-w-[110px]">
            <span className="text-[10px] text-amber-800 font-mono font-bold uppercase block">Medium Severity</span>
            <span className="text-xl font-extrabold text-amber-700">
              {enrichedGaps.filter(g => g.severity === 'medium').length}
            </span>
          </div>

          <button
            type="button"
            onClick={() => navigate('/readiness')}
            className="btn-primary text-xs font-bold py-3 px-4 rounded-xl shadow-indigo-600/10 flex items-center gap-1.5 shrink-0"
          >
            <span>Proceed to IPO Readiness</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* In-Page Chapter Subsections Navigation Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Gap Analysis Chapter Subsections (In-Page Navigation):
          </span>
          {selectedChapter !== 'all' && (
            <button
              type="button"
              onClick={() => handleSelectChapterSection('all')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline"
            >
              Show All Chapters
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
            All Gap Sections ({enrichedGaps.length})
          </button>

          {Object.entries(SECTION_KEYS).map(([secKey, secLabel]) => {
            const chGapsCount = enrichedGaps.filter(g => g.chapterKey === secKey).length;
            const isActive = selectedChapter === secKey;
            return (
              <button
                key={secKey}
                type="button"
                onClick={() => handleSelectChapterSection(secKey)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>{secLabel}</span>
                <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${chGapsCount > 0 ? 'bg-amber-100 text-amber-900 font-bold' : 'bg-slate-200 text-slate-600'}`}>
                  {chGapsCount}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Grouping & Filter Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Group By Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Grouping:
          </span>

          <button
            type="button"
            onClick={() => setGroupBy('chapter')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              groupBy === 'chapter' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            By Chapter
          </button>

          <button
            type="button"
            onClick={() => setGroupBy('severity')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              groupBy === 'severity' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            By Severity
          </button>

          <button
            type="button"
            onClick={() => setGroupBy('category')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              groupBy === 'category' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            By Type
          </button>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Severity:</span>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="all">All Severities</option>
            <option value="high">High Severity Only</option>
            <option value="medium">Medium Severity Only</option>
          </select>
        </div>

      </div>

      {/* Grouped Gap Cards List */}
      <div className="space-y-6">
        {Object.keys(groupedData).length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Zero Due Diligence Gaps Detected</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              All entered intake values match source documents cleanly across the selected gap section.
            </p>
          </div>
        ) : (
          Object.entries(groupedData).map(([groupTitle, groupItems]) => (
            <div 
              key={groupTitle} 
              ref={(el) => {
                const matchedSecKey = Object.keys(SECTION_KEYS).find(k => SECTION_KEYS[k] === groupTitle);
                if (matchedSecKey) chapterRefs.current[matchedSecKey] = el;
              }}
              className="space-y-3 scroll-mt-6"
            >
              {/* Group Section Header */}
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  <span>{groupTitle} Section Gaps</span>
                </h3>
                <span className="text-[11px] font-bold text-slate-500 font-mono">
                  {groupItems.length} {groupItems.length === 1 ? 'Issue' : 'Issues'}
                </span>
              </div>

              {/* Gap Cards in Group */}
              <div className="space-y-3">
                {groupItems.map((item, idx) => {
                  const isHigh = item.severity === 'high';

                  return (
                    <div 
                      key={item.id || idx}
                      className={`bg-white p-5 rounded-2xl border shadow-sm transition-all space-y-3 ${
                        isHigh ? 'border-red-200/90 bg-red-50/20' : 'border-amber-200/90 bg-amber-50/20'
                      }`}
                    >
                      {/* Card Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase font-mono bg-slate-100 text-slate-700 border border-slate-200">
                            {item.chapterLabel}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isHigh ? 'bg-red-100 text-red-800 border border-red-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {item.severity} severity
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200/50 font-mono">
                            {item.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">AI Grounding: <strong className="text-emerald-700 font-bold uppercase">{item.confidence}</strong></span>
                        </div>
                      </div>

                      {/* Description & AI Explanation */}
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.message}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed font-sans">{item.explanation}</p>
                      </div>

                      {/* Source Evidence Grid */}
                      {item.intakeValue && item.docValue && item.docValue !== 'N/A' && (
                        <div className="p-3 bg-white border border-slate-200/80 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Promoter Intake Value</span>
                            <span className="font-semibold text-slate-800 text-[11px] block">{item.intakeValue}</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block">Extracted Document ({item.docName})</span>
                            <span className="font-semibold text-indigo-700 text-[11px] block">{item.docValue}</span>
                          </div>
                        </div>
                      )}

                      {/* Actionable Recommendation & Resolve Button Row */}
                      <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="italic text-[11px]"><strong className="text-slate-700 not-italic font-bold">Recommendation:</strong> {item.recommendation}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleResolveNavigation(item)}
                          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all shadow-sm self-end sm:self-auto"
                        >
                          <span>Resolve Issue</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>
          ))
        )}
      </div>

    </div>
  );
}
