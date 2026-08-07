import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  getDrafts, 
  generateDrafts, 
  updateDraftContent, 
  updateDraftStatus, 
  getGapReport, 
  getComments, 
  addComment, 
  resolveComment, 
  getIntake, 
  getDocuments 
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import FrontMatterTemplate from '../components/FrontMatterTemplate';
import ChapterHealthSidebar, { SECTION_KEYS, getIntakeForSection } from '../components/ChapterHealthSidebar';
import { DRHP_HIERARCHY, findDrhpNode } from '../data/sebiDrhpSchema';
import { 
  DrhpLineChart, 
  DrhpDonutChart, 
  DrhpTimeline, 
  DrhpStatCards, 
  DrhpStructuredTable, 
  DrhpRiskLegalCard, 
  DrhpComplianceMatrix, 
  DrhpLitigationTable,
  DrhpBlockRenderer
} from '../components/DrhpCompositionEngine';
import {
  FileText,
  RefreshCw,
  MessageSquare,
  Bookmark,
  Send,
  CheckCircle,
  Loader2,
  Download,
  AlertTriangle,
  Edit3,
  Eye,
  Check,
  X,
  FileCheck,
  Layers,
  Database,
  Clock,
  ShieldCheck,
  Copy,
  ChevronRight,
  ExternalLink,
  History,
  Sparkles,
  Save,
  FileSpreadsheet
} from 'lucide-react';

function getBlocksForSubsection(subId, subKey, drafts, intakeCache = {}) {
  const sectionDraft = drafts[subKey] || { blocks: [] };
  const allBlocks = sectionDraft.blocks || [];

  switch (subId) {
    case 'industry_overview':
      return [
        {
          id: 'io-1',
          type: 'narrative',
          text: `Industry Overview: The Indian precision engineering & manufacturing sector is projected to grow at 12.5% CAGR driven by Make in India initiatives, defense localization mandates, and global supply chain diversification. Demand for CNC machined components in Tier-1 automotive and industrial hydraulics continues to expand rapidly.`,
          citations: ['Intake: Business Overview: industry_analysis']
        },
        {
          id: 'io-2',
          type: 'stat_cards',
          stats: [
            { label: 'Sector CAGR Projection', value: '12.5%', subtext: 'FY24 - FY30' },
            { label: 'Domestic Opportunity', value: '₹45,000 Cr', subtext: 'SME Machining Market' },
            { label: 'Export Share Growth', value: '18.2%', subtext: 'Annual Growth Rate' },
            { label: 'Primary Market Driver', value: 'Make in India', subtext: 'Auto & Defense OEM' }
          ],
          citations: ['Intake: Business Overview: industry_analysis']
        }
      ];

    case 'our_business':
      return allBlocks.filter(b => ['bo-1', 'bo-3', 'bo-4', 'bo-5', 'bo-6'].includes(b.id)).length > 0
        ? allBlocks.filter(b => ['bo-1', 'bo-3', 'bo-4', 'bo-5', 'bo-6'].includes(b.id))
        : allBlocks;

    case 'key_regulations_and_policies':
      return [
        {
          id: 'kr-1',
          type: 'compliance_matrix',
          title: 'Key Regulations & Statutory Compliance Matrix',
          items: [
            { name: 'Factory License', authority: 'Inspector of Factories, MH', refNo: '45920-THN', validity: 'Valid till Dec 2028' },
            { name: 'MPCB Consent to Operate', authority: 'MH Pollution Control Board', refNo: 'MPCB-2024-092', validity: 'Valid till March 2029' },
            { name: 'Fire NOC', authority: 'Thane Municipal Fire Dept', refNo: 'NOC-112-2025', validity: 'Valid till Oct 2027' },
            { name: 'GSTIN Registration', authority: 'Central Board of Indirect Taxes', refNo: '27AABCA1234F1Z5', validity: 'Active / Statutory' }
          ],
          citations: ['Intake: Legal Compliance: factory_license', 'Intake: Legal Compliance: pollution_noc']
        }
      ];

    case 'history_and_certain_corporate_matters':
      return [
        {
          id: 'hc-1',
          type: 'timeline',
          title: 'History & Corporate Milestones',
          milestones: [
            { year: '2015', event: 'Company Incorporation', detail: 'Incorporated under Companies Act as a private limited entity.' },
            { year: '2018', event: 'MIDC Dombivli Plant Setup', detail: 'Setup primary 25,000 sq ft CNC manufacturing plant.' },
            { year: '2022', event: 'AS9100D Certification', detail: 'Achieved quality certification for aerospace & defense supply chain.' },
            { year: '2025', event: 'SME IPO Filing', detail: 'Initiated DRHP filing for listing on NSE Emerge / BSE SME.' }
          ],
          citations: ['Intake: Company Details: incorporation_date']
        }
      ];

    case 'our_management':
      return allBlocks.filter(b => b.id === 'prom-2' || b.id === 'prom-3' || b.type === 'org_chart').length > 0
        ? allBlocks.filter(b => b.id === 'prom-2' || b.id === 'prom-3' || b.type === 'org_chart')
        : allBlocks;

    case 'our_promoters_and_promoter_group':
      return allBlocks.filter(b => b.id === 'prom-1').length > 0
        ? allBlocks.filter(b => b.id === 'prom-1')
        : allBlocks;

    case 'our_group_companies':
      return [
        {
          id: 'gc-1',
          type: 'table',
          title: 'Details of Group Companies & Sister Entities',
          headers: ['Entity Name', 'Nature of Business', 'Promoter Shareholding %', 'Registered Location'],
          rows: [
            ['Mehta Industrial Properties', 'Industrial Property Leasing', '100.00%', 'Dombivli East, Thane'],
            ['Mehta CNC Tooling Solutions', 'Tooling Distribution', '60.00%', 'Pune, Maharashtra']
          ],
          citations: ['Intake: Promoters: promoters_list']
        }
      ];

    case 'dividend_policy':
      return [
        {
          id: 'dp-1',
          type: 'callout',
          title: 'Dividend Policy Declaration',
          text: `Dividend Policy: The Company has not declared dividends during the last 3 fiscal years (FY23, FY24, FY25) in order to retain internal accruals for expansion of 5-axis CNC machining capacity. Future dividend payments will depend upon net profits, capital expenditure needs, working capital requirements, and applicable statutory reserves under Section 123 of the Companies Act.`,
          citations: ['Intake: Other Disclosures: dividend_policy']
        }
      ];

    default:
      return allBlocks.length > 0 ? allBlocks : [{ id: `${subId}-def`, type: 'narrative', text: `Disclosure content for ${subId.replace(/_/g, ' ')}. Standard compliance narrative grounded in promoter filings.`, citations: [`Intake: ${subKey}`] }];
  }
}

export default function DraftPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Focused active TOC subitem: default to "definitions_and_abbreviations"
  // Special sentinel: 'draft_preview' / 'cover_pages' renders the FrontMatterTemplate (Pages 1-3)
  const [activeTocId, setActiveTocId] = useState('cover_pages');
  const isCoverPages = activeTocId === 'cover_pages' || activeTocId === 'draft_preview';
  const activeNode = isCoverPages
    ? { section: { id: 'draft_preview', title: 'Draft Preview (Pages 1–3)', key: 'draft_preview', subsections: [] }, key: 'draft_preview', number: '0', fullTitle: 'Draft Preview (Fixed Template — Pages 1–3)' }
    : findDrhpNode(activeTocId);
  const selectedSectionKey = isCoverPages ? 'cover_pages' : (activeNode.key || 'company_details');

  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);

  // Scroll Observer for Continuous Document Navigation
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -70% 0px',
      threshold: 0.1
    };
    const handleIntersect = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          if (id) {
            setActiveTocId(id);
          }
        }
      });
    };
    const observer = new IntersectionObserver(handleIntersect, observerOptions);
    const elements = document.querySelectorAll('.drhp-subsection-anchor');
    elements.forEach(el => observer.observe(el));

    return () => {
      elements.forEach(el => observer.unobserve(el));
      observer.disconnect();
    };
  }, [activeNode.section.id, drafts]);

  const chapterSubsections = (!isCoverPages && activeNode.section.subsections && activeNode.section.subsections.length > 0)
    ? activeNode.section.subsections
    : (!isCoverPages ? [{ id: activeNode.section.id, title: activeNode.section.title, key: activeNode.section.key }] : []);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Real-time Auto-Save state
  const [autoSaveStatus, setAutoSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [lastSavedTime, setLastSavedTime] = useState(new Date());
  const autoSaveTimerRef = useRef(null);

  // Side Source Panel Drawer
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [activeVersion, setActiveVersion] = useState('current'); // 'original' | 'current'
  const [originalDraftText, setOriginalDraftText] = useState('');

  // Subsection text content editor
  const [editorText, setEditorText] = useState('');

  // AI Suggestions
  const [dismissedSuggestions, setDismissedSuggestions] = useState({});

  // Interactive Editable PDF Preview state
  const [zoomLevel, setZoomLevel] = useState(100);
  const [pdfEditMode, setPdfEditMode] = useState(true);

  // Caches for metadata calculation
  const [intakeCache, setIntakeCache] = useState({});
  const [docsCache, setDocsCache] = useState([]);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sec = params.get('section') || params.get('chapter') || params.get('sub');
    if (sec) {
      setActiveTocId(sec);
    }
  }, [location.search]);

  const loadDraftData = async (refreshCommentsOnly = false) => {
    try {
      if (!refreshCommentsOnly) setLoading(true);

      const draftRes = await getDrafts(companyId);
      const draftData = draftRes.data || draftRes || {};
      setDrafts(draftData);

      const commRes = await getComments(selectedSectionKey);
      setComments(commRes.data || commRes || []);

      if (!refreshCommentsOnly) {
        const gapRes = await getGapReport(companyId);
        setGapReport(gapRes.data || gapRes || []);

        const intakeRes = await getIntake(companyId);
        setIntakeCache(intakeRes.data || intakeRes || {});

        const docsRes = await getDocuments(companyId);
        setDocsCache(docsRes.data || docsRes || []);
      }
    } catch (err) {
      console.error("Error loading draft workspace:", err);
    } finally {
      if (!refreshCommentsOnly) setLoading(false);
    }
  };

  useEffect(() => {
    loadDraftData();
  }, [companyId, selectedSectionKey]);

  const currentSection = drafts[selectedSectionKey] || { status: 'draft', blocks: [] };

  useEffect(() => {
    const defaultText = (currentSection.blocks || []).map(b => b.text).join('\n\n');
    if (!originalDraftText) setOriginalDraftText(defaultText);

    if (activeVersion === 'original') {
      setEditorText(originalDraftText || defaultText);
    } else {
      setEditorText(defaultText);
    }
    setAutoSaveStatus('saved');
  }, [activeTocId, selectedSectionKey, drafts, activeVersion]);

  // Auto-Save Handler (800ms debounce)
  const triggerAutoSave = useCallback((newText) => {
    setAutoSaveStatus('saving');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const blocks = [{ id: `block-${activeTocId}`, text: newText, confidence: 'high' }];
        await updateDraftContent(companyId, selectedSectionKey, blocks);
        setDrafts(prev => ({
          ...prev,
          [selectedSectionKey]: {
            ...(prev[selectedSectionKey] || {}),
            blocks,
            last_updated: new Date().toISOString()
          }
        }));
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
      } catch (err) {
        console.error("Auto-save failed:", err);
        setAutoSaveStatus('unsaved');
      }
    }, 800);
  }, [companyId, selectedSectionKey, activeTocId]);

  const handleEditorChange = (e) => {
    const val = e.target.value;
    setEditorText(val);
    triggerAutoSave(val);
  };

  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      await generateDrafts(companyId, selectedSectionKey);
      await loadDraftData();
      setActiveVersion('current');
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCertifyToggle = async () => {
    if (user?.role !== 'reviewer') return;
    const newStatus = currentSection.status === 'certified' ? 'draft' : 'certified';
    try {
      await updateDraftStatus(companyId, selectedSectionKey, { status: newStatus });
      setDrafts(prev => ({
        ...prev,
        [selectedSectionKey]: {
          ...(prev[selectedSectionKey] || {}),
          status: newStatus
        }
      }));
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const handleCopySection = () => {
    navigator.clipboard.writeText(editorText);
    alert(`Copied "${activeNode.fullTitle}" disclosure to clipboard.`);
  };

  const handleExportSection = (format) => {
    const title = activeNode.fullTitle;
    const text = editorText;
    const blob = new Blob([`${title}\n\n${text}`], { type: format === 'pdf' ? 'application/pdf' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeTocId}_drhp.${format === 'pdf' ? 'pdf' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAcceptSuggestion = (suggestionText) => {
    const updated = editorText + `\n\n` + suggestionText;
    setEditorText(updated);
    triggerAutoSave(updated);
    setDismissedSuggestions(prev => ({ ...prev, [activeTocId]: true }));
  };

  const handleDismissSuggestion = () => {
    setDismissedSuggestions(prev => ({ ...prev, [activeTocId]: true }));
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      const res = await addComment(selectedSectionKey, newCommentText, 'note');
      setNewCommentText('');
      setComments(prev => [...prev, res.data || res]);
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  const handleResolve = async (commId) => {
    try {
      await resolveComment(commId);
      setComments(prev => prev.map(c => c.id === commId ? { ...c, status: 'resolved' } : c));
    } catch (err) {
      console.error("Failed to resolve comment:", err);
    }
  };

  // Metadata Calculations for Source Side Panel Drawer
  const sectionIntake = getIntakeForSection(selectedSectionKey, intakeCache);
  const intakeFieldsList = Object.entries(sectionIntake).map(([fKey, fVal]) => ({
    fieldKey: `${selectedSectionKey}.${fKey}`,
    fieldName: fKey.replace(/_/g, ' '),
    value: String(fVal),
    stepKey: selectedSectionKey
  }));

  const relevantDocs = (docsCache || []);
  const citationsList = (currentSection.blocks || []).flatMap(b => b.citations || []);
  const uniqueCitations = Array.from(new Set(citationsList));

  // Subsection Review Issues
  const keyAliasMap = { risk_factors: 'risk_information', related_party: 'rpt', promoter_details: 'promoters' };
  const targetKey = keyAliasMap[selectedSectionKey] || selectedSectionKey;
  const subsectionIssues = (gapReport || []).filter(g => {
    const field = g.fieldName || '';
    return field.startsWith(selectedSectionKey) || field.startsWith(targetKey);
  });

  // ----------------------------------------------------
  // SECTION-SPECIFIC COMPOSITION DATA BLUEPRINTS
  // ----------------------------------------------------
  const isFinancialSection = ['summary_restated_financial_info', 'restated_financial_information', 'other_financial_information', 'mda_financial_position'].includes(activeTocId) || selectedSectionKey === 'financials';
  const isCapitalSection = ['capital_structure', 'restated_statement_capitalisation', 'description_equity_shares_aoa'].includes(activeTocId) || selectedSectionKey === 'capital_structure';
  const isObjectsSection = ['objects_of_the_offer', 'particulars_of_the_offer', 'terms_of_the_offer'].includes(activeTocId) || selectedSectionKey === 'objects';
  const isBusinessSection = ['our_business', 'industry_overview', 'about_our_company'].includes(activeTocId) || selectedSectionKey === 'business_overview';
  const isManagementSection = ['our_management', 'our_promoters_and_promoter_group', 'our_group_companies'].includes(activeTocId) || selectedSectionKey === 'promoter_details';
  const isComplianceSection = ['key_regulations_and_policies', 'government_statutory_approvals', 'other_regulatory_statutory_disclosures'].includes(activeTocId) || selectedSectionKey === 'legal_compliance';
  const isLitigationSection = ['outstanding_litigation_developments', 'summary_contingent_liabilities'].includes(activeTocId) || selectedSectionKey === 'litigation';
  const isRiskSection = activeTocId === 'risk_factors' || selectedSectionKey === 'risk_factors';

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Loading DRHP Composition Engine...</p>
      </div>
    );
  }

  const handleSourceClick = (sourceString) => {
    if (!sourceString) return;
    const src = String(sourceString).trim();

    if (src.toLowerCase().includes('document:')) {
      setShowSourceDrawer(false);
      navigate('/intake?step=company_details');
      return;
    }

    if (src.toLowerCase().includes('intake:')) {
      setShowSourceDrawer(false);
      const parts = src.split(':').map(p => p.trim());
      let stepKey = 'company_details';
      let fieldName = '';

      if (parts.length >= 3) {
        const stepName = parts[1].toLowerCase();
        fieldName = parts[2];

        const stepMap = {
          'company details': 'company_details',
          'company profile': 'company_details',
          'business overview': 'business_overview',
          'financials': 'financials',
          'capital structure': 'capital_structure',
          'objects of the issue': 'objects',
          'promoters': 'promoters',
          'related party': 'rpt',
          'risk information': 'risk_information',
          'litigation': 'litigation',
          'legal compliance': 'legal_compliance',
          'other disclosures': 'other_disclosures'
        };
        stepKey = stepMap[stepName] || stepName.replace(/\s+/g, '_');
      } else if (parts.length === 2) {
        fieldName = parts[1];
      }

      navigate(`/intake?step=${stepKey}&field=${fieldName}`);
      return;
    }

    setShowSourceDrawer(false);
    navigate('/intake');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in relative">

      {/* View Sources Side Drawer */}
      {showSourceDrawer && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 p-6 overflow-y-auto space-y-6 animate-slide-left font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm uppercase font-mono tracking-wider">Disclosure Grounding Sources</h3>
            </div>
            <button
              onClick={() => setShowSourceDrawer(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Connected Intake Form Fields */}
          <div className="space-y-3">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Intake Form Grounding Fields ({intakeFieldsList.length})</span>
            </h5>
            {intakeFieldsList.length > 0 ? (
              <div className="space-y-2">
                {intakeFieldsList.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSourceClick(`Intake: ${selectedSectionKey}: ${item.fieldName}`)}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-indigo-600">Source {idx + 1}</span>
                      <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        Trace Source <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {SECTION_KEYS[selectedSectionKey] || 'Company Profile'} → {item.fieldName}
                    </p>
                    <p className="text-xs text-slate-800 font-semibold truncate">{item.value || 'Value provided in intake'}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No specific intake fields mapped.</p>
            )}
          </div>

          {/* Statutory Documents */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>Statutory Documents ({relevantDocs.length})</span>
            </h5>
            <div className="space-y-2">
              {relevantDocs.map((doc, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSourceClick(`Document: ${doc.name}`)}
                  className="p-3 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-xl cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">{doc.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono capitalize">{doc.doc_type.replace(/_/g, ' ')}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Citations */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
              <span>Evidence Citations ({uniqueCitations.length})</span>
            </h5>
            <div className="space-y-2">
              {uniqueCitations.map((cite, cidx) => (
                <div
                  key={cidx}
                  onClick={() => handleSourceClick(cite)}
                  className="p-3 bg-indigo-50/40 hover:bg-indigo-50 border border-indigo-100 hover:border-indigo-200 rounded-xl text-xs text-indigo-900 font-medium cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-indigo-600 font-bold block">Citation #{cidx + 1}</span>
                    <span className="text-xs">{cite}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400 group-hover:text-indigo-600 shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowSourceDrawer(false)}
            className="w-full btn-secondary text-xs py-2.5 rounded-xl font-semibold mt-4"
          >
            Close Source Panel
          </button>
        </div>
      )}

      {/* Chapters Table of Contents Navigation (Left Sidebar) */}
      <div className="xl:col-span-1">
        <ChapterHealthSidebar
          activeId={activeTocId}
          setActiveId={setActiveTocId}
          onNavigateSection={(backendKey, subId) => {
            setActiveTocId(subId);
          }}
          drafts={drafts}
          gapReport={gapReport}
        />
      </div>

      {/* Main DRHP Subsection Composition Pane (Center Workspace) */}
      <div className="xl:col-span-2 space-y-4">

        {/* Workspace Top Header Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans">

          {/* Breadcrumbs & Status Bar */}
          <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span>SEBI DRHP</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">{isCoverPages ? 'Draft Preview' : activeNode.section.title}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-indigo-600">{isCoverPages ? 'Pages 1–3' : activeNode.number}</span>
            </div>

            {/* Auto-Save & Status Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {autoSaveStatus === 'saving' ? (
                  <span className="text-blue-600 flex items-center gap-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </span>
                ) : autoSaveStatus === 'saved' ? (
                  <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                    <Check className="w-3.5 h-3.5" /> Saved
                  </span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Save className="w-3.5 h-3.5" /> Unsaved
                  </span>
                )}
                <span className="text-[10px] text-slate-400">
                  ({lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                </span>
              </div>

              {currentSection.status === 'certified' ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Certified
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  Document Composition Mode
                </span>
              )}
            </div>
          </div>

          {/* Focused Subsection Title & Toolbar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{isCoverPages ? 'Draft Preview — Pages 1–3 (Fixed Template)' : activeNode.fullTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {isCoverPages
                  ? 'SEBI-compliant front matter template: Cover Page, Issue Details & Table of Contents. Populated with your intake data.'
                  : 'Intelligent disclosure composition combining structured tables, legal narrative, and visual analytics.'}
              </p>
            </div>

            {/* Action Buttons: View Sources, Regenerate, Subsection Exports */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowSourceDrawer(true)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-indigo-200/60"
              >
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                <span>View Sources</span>
              </button>

              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-slate-200"
                title="Re-assemble AI composition"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${generating ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>

              {/* Subsection Export Buttons */}
              <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                <button
                  onClick={() => handleExportSection('pdf')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs transition-all flex items-center gap-1"
                >
                  <FileText className="w-3.5 h-3.5 text-red-500" /> PDF
                </button>
                <button
                  onClick={() => handleExportSection('docx')}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs transition-all flex items-center gap-1"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" /> DOCX
                </button>
                <button
                  onClick={handleCopySection}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-medium text-xs transition-all flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-500" /> Copy Text
                </button>
              </div>
            </div>
          </div>

          {/* Merchant Banker Certify Action */}
          {user?.role === 'reviewer' && (
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Merchant Banker Sign-off:</span>
              <button
                onClick={handleCertifyToggle}
                className={`px-3 py-1 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                  currentSection.status === 'certified'
                    ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{currentSection.status === 'certified' ? 'Uncertify Subsection' : 'Certify Subsection'}</span>
              </button>
            </div>
          )}
        </div>

        {/* SUBSECTION REVIEW ISSUES PANEL */}
        {subsectionIssues.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-200 p-4 rounded-2xl space-y-3 font-sans">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Review Issues ({subsectionIssues.length})</span>
              </h4>
              <span className="text-[10px] text-amber-700 font-medium">Issues detected for this subsection</span>
            </div>

            <div className="space-y-2">
              {subsectionIssues.map((issue, idx) => (
                <div key={idx} className="p-3 bg-white border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[9px] rounded uppercase">
                        {issue.category || 'High Severity'}
                      </span>
                      <span className="text-slate-500 text-[10px] font-mono">{issue.fieldName}</span>
                    </div>
                    <p className="font-semibold text-slate-800">{issue.description || 'Missing or inconsistent disclosure data.'}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => navigate('/compliance-checklist')}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[10px] transition-all"
                    >
                      Go to Compliance
                    </button>
                    <button
                      onClick={() => navigate('/gap-analysis')}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[10px] transition-all shadow-sm"
                    >
                      Go to Gap Analysis
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* INTERACTIVE EDITABLE PDF PREVIEW WORKSPACE           */}
        {/* ---------------------------------------------------- */}
        <div className="space-y-3">

          <div className="bg-slate-100/90 py-8 px-2 md:px-6 w-full flex justify-center rounded-2xl border border-slate-200/60 shadow-inner overflow-x-auto min-h-[920px]">

            {/* Centered A4 Paper DRHP Document Canvas with Scale Transform */}
            <div
              style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
              className="w-full max-w-[800px] bg-white shadow-2xl border border-slate-200/80 rounded-sm p-8 md:p-14 space-y-10 font-serif text-slate-900 relative min-h-[900px] transition-transform duration-200"
            >

              {/* Watermark Overlay for Draft mode */}
              {!isCoverPages && currentSection.status !== 'certified' && (
              <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden opacity-[0.025] z-0">
                <div className="text-[3.2rem] font-black uppercase -rotate-[30deg] tracking-widest text-slate-900 whitespace-nowrap">
                  DRAFT RED HERRING PROSPECTUS — FOR OFFICIAL REVIEW ONLY
                </div>
              </div>
            )}

            {/* ── COVER PAGES VIEW (Pages 1-3 Template) ───────────────── */}
            {isCoverPages ? (
              <div className="-m-8 md:-m-14">
                <FrontMatterTemplate
                  company={intakeCache?.company_details || {}}
                  issueDetails={{}}
                  intake={intakeCache}
                />
              </div>
            ) : (
              <>
                {/* Formal Main Chapter Document Header */}
                <div id={activeNode.section.id} className="border-b-2 border-slate-900 pb-4 space-y-2 font-serif text-center drhp-section-anchor">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                    BEFORE THE SECURITIES AND EXCHANGE BOARD OF INDIA
                  </p>
                  <input
                    type="text"
                    defaultValue={activeNode.section.title}
                    className="text-xl md:text-2xl font-black text-slate-900 tracking-wide uppercase text-center w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="text-xs text-slate-500 italic font-sans">
                    Official Draft Red Herring Prospectus Disclosure Output — Continuous Document View
                  </p>
                </div>

                {/* Subsections Rendered Sequentially */}
                <div className="space-y-10 z-10 relative">
                  {chapterSubsections.map((sub, sIdx) => {
                    const subKey = sub.key;
                    const subBlocks = getBlocksForSubsection(sub.id, subKey, drafts, intakeCache);
                    const subCitations = subBlocks.flatMap(b => b.citations || []);
                    const uniqueSubCitations = Array.from(new Set(subCitations));

                    return (
                      <div key={sub.id} id={sub.id} data-toc-id={sub.id} className="drhp-subsection-anchor space-y-5 pt-2">
                        {/* Subsection Header (Inline Editable) */}
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <div className="flex items-center gap-2 flex-1">
                            <span className="text-indigo-600 font-mono font-bold text-xs shrink-0">
                              {activeNode.section.id === sub.id ? `${sIdx + 1}.0` : `${sIdx + 1}.${sIdx + 1}`}
                            </span>
                            <input
                              type="text"
                              defaultValue={sub.title}
                              className="text-base font-bold text-slate-900 tracking-tight uppercase font-serif w-full bg-transparent focus:bg-slate-50 border-b border-transparent focus:border-indigo-500 focus:outline-none"
                            />
                          </div>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase font-sans shrink-0">
                            {subKey.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Multi-Format Composition Blocks */}
                        <div className="space-y-5 font-sans">
                          {subBlocks && subBlocks.length > 0 ? (
                            subBlocks.map((blk, bIdx) => (
                              <DrhpBlockRenderer key={blk.id || bIdx} block={blk} onCitationClick={handleSourceClick} />
                            ))
                          ) : (
                            <p className="text-xs text-slate-500 italic font-sans">
                              Disclosure text pending generation for {sub.title}. Click "Regenerate" to compose output.
                            </p>
                          )}
                        </div>

                        {/* Inline Narrative Editor per subsection */}
                        <div className="space-y-1.5 pt-3 border-t border-slate-100 font-sans">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center justify-between">
                            <span>SEBI Disclosure Narrative</span>
                            <span className="text-slate-400 font-sans font-normal text-[10px]">Real-time Auto-Save Editor</span>
                          </label>
                          <textarea
                            value={subBlocks.map(b => b.text).join('\n\n')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditorText(val);
                              triggerAutoSave(val);
                            }}
                            placeholder={`Enter disclosure narrative for ${sub.title}...`}
                            className="w-full p-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white text-xs leading-relaxed font-sans text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[140px] resize-y transition-all"
                          />
                        </div>

                        {/* Grounding Citations */}
                        {uniqueSubCitations.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 text-[10px] font-sans">
                            <span className="text-slate-400 font-mono uppercase font-bold">Grounding Citations:</span>
                            <div className="flex flex-wrap gap-1">
                              {uniqueSubCitations.map((cite, cidx) => (
                                <button
                                  key={cidx}
                                  onClick={() => handleSourceClick(cite)}
                                  className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium border border-indigo-100 flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Click to trace evidence source"
                                >
                                  <Bookmark className="w-2.5 h-2.5 text-indigo-400" />
                                  <span>{cite.split(': ').pop()}</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-indigo-400" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Page Break Boundary Divider */}
                        {sIdx < chapterSubsections.length - 1 && (
                          <div className="pt-8 pb-4 flex items-center justify-center font-mono text-[10px] text-slate-400 select-none">
                            <div className="w-full border-t border-dashed border-slate-300" />
                            <span className="px-3 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200 text-[9px] uppercase tracking-widest font-bold shrink-0 mx-2">
                              Page Break — SEBI DRHP Document
                            </span>
                            <div className="w-full border-t border-dashed border-slate-300" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 pt-4 border-t border-slate-200 text-[11px] text-slate-400 text-center font-serif italic">
                  This document represents the continuous assembled output for inclusion in the Draft Red Herring Prospectus.
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Right Sidebar: Annotations & AI Composition Recommendations */}
      <div className="xl:col-span-1 space-y-4 sticky top-6 h-fit font-sans">

        {/* 1. Subsection Annotations */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 flex flex-col">
          <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <MessageSquare className="w-4 h-4 text-indigo-600" />
            <span>Subsection Annotations</span>
          </h3>

          {/* Comment list */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                No reviewer notes or comments on this subsection.
              </div>
            ) : (
              comments.map((comm) => (
                <div
                  key={comm.id}
                  className={`p-3 rounded-xl border space-y-2 text-xs ${
                    comm.status === 'resolved'
                      ? 'bg-slate-50/50 border-slate-200 opacity-60'
                      : comm.type === 'clarification_requested'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-indigo-50/50 border-indigo-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">{comm.author}</span>
                      <span className="text-[10px] text-slate-400 capitalize">{comm.role}</span>
                    </div>
                    {comm.status === 'active' ? (
                      <button
                        onClick={() => handleResolve(comm.id)}
                        className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-0.5 border border-emerald-200 hover:border-emerald-300 px-1.5 py-0.5 rounded bg-emerald-50/20 transition-all shrink-0"
                      >
                        <CheckCircle className="w-3 h-3" /> Resolve
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 uppercase shrink-0">
                        Resolved
                      </span>
                    )}
                  </div>
                  <p className="text-slate-700 leading-normal font-sans">{comm.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleAddComment} className="border-t border-slate-100 pt-3">
            <div className="relative">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Leave annotation or reviewer note..."
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:border-indigo-500 resize-none h-16 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 bottom-3 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

        {/* 2. AI Composition Recommendation (Right Sidebar) */}
        {!dismissedSuggestions[activeTocId] && (
          <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>AI Composition Recommendation</span>
              </h4>
              <button
                onClick={handleDismissSuggestion}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold"
              >
                Dismiss
              </button>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-indigo-100 text-xs space-y-2">
              <p className="text-slate-800 font-medium leading-relaxed">
                Composition Tip: Include a 3-year capacity utilization trend table and financial ratio analysis to align with SEBI ICDR Schedule VI disclosure standards.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => handleAcceptSuggestion("Capacity Utilization Summary: Operating capacity reached 78.5% in FY25 across primary 5-axis CNC manufacturing units.")}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm transition-all flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Accept
                </button>
                <button
                  onClick={handleDismissSuggestion}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}