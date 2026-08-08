import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDraftDocument } from '../context/DraftDocumentContext';
import FrontMatterTemplate from './FrontMatterTemplate';
import ChapterHealthSidebar, { SECTION_KEYS, getIntakeForSection } from './ChapterHealthSidebar';
import { DRHP_HIERARCHY } from '../data/sebiDrhpSchema';
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
} from './DrhpCompositionEngine';
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
  HelpCircle,
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
import { downloadPdf } from '../services/api';

function getBlocksForSubsection(subId, subKey, drafts, intakeCache = {}) {
  const sectionDraft = drafts[subKey] || { blocks: [] };
  const allBlocks = sectionDraft.blocks || [];

  switch (subId) {
    case 'definitions_and_abbreviations':
      return [
        {
          id: 'g-sec-1',
          type: 'drhp_glossary',
          company: intakeCache?.company_details || {},
          intake: intakeCache || {},
          citations: ['Intake: Company Details: legal_name', 'Intake: Promoters: promoters_list', 'Intake: Legal Compliance: merchant_banker_details']
        }
      ];

    case 'certain_conventions_presentation':
      return [
        {
          id: 'cc-sec-1',
          type: 'drhp_conventions',
          company: intakeCache?.company_details || {},
          intake: intakeCache || {},
          citations: ['Intake: Financials: restated_fs', 'Document: Audited_Financial_Statements_FY25.pdf', 'Document: CRISIL_Precision_Engineering_Report.pdf']
        }
      ];

    case 'forward_looking_statements':
      return [
        {
          id: 'fl-sec-1',
          type: 'drhp_forward_looking',
          company: intakeCache?.company_details || {},
          intake: intakeCache || {},
          citations: ['Intake: Risk Factors & Disclosures', 'SEBI ICDR Regulations 2018']
        }
      ];

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

export default function DraftDocument({ mode = 'chapter' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    companyId,
    activeTocId,
    setActiveTocId,
    isCoverPages,
    activeNode,
    selectedSectionKey,
    drafts,
    gapReport,
    comments,
    intakeCache,
    docsCache,
    auditLogs,
    loading,
    editorText,
    setEditorText,
    autoSaveStatus,
    lastSavedTime,
    saveContent,
    updateSectionStatus,
    regenerateSection,
    postComment,
    resolveCommentById
  } = useDraftDocument();

  const [viewMode, setViewMode] = useState(
    location.pathname === '/draft-preview' ? 'preview' : mode
  );

  useEffect(() => {
    if (location.pathname === '/draft-preview') {
      setViewMode('preview');
    } else {
      setViewMode(mode);
    }
  }, [location.pathname, mode]);

  const [generating, setGenerating] = useState(false);
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [activeVersion, setActiveVersion] = useState('current');
  const [originalDraftText, setOriginalDraftText] = useState('');
  const [dismissedSuggestions, setDismissedSuggestions] = useState({});
  const [zoomLevel, setZoomLevel] = useState(100);

  const [exportingSectionPdf, setExportingSectionPdf] = useState(false);
  const [exportingSectionDocx, setExportingSectionDocx] = useState(false);
  const [exportNotice, setExportNotice] = useState(null);

  const [textSelectionTooltip, setTextSelectionTooltip] = useState(null);
  const documentCanvasRef = useRef(null);

  const currentSection = drafts[selectedSectionKey] || { status: 'draft', blocks: [] };

  useEffect(() => {
    const defaultText = (currentSection.blocks || []).map(b => b.text).join('\n\n');
    if (!originalDraftText) setOriginalDraftText(defaultText);

    if (activeVersion === 'original') {
      setEditorText(originalDraftText || defaultText);
    } else {
      setEditorText(defaultText);
    }
  }, [activeTocId, selectedSectionKey, drafts, activeVersion, setEditorText]);

  const handleEditorChange = (e) => {
    const val = e.target.value;
    setEditorText(val);
    saveContent(val);
  };

  const handleRegenerateClick = async () => {
    try {
      setGenerating(true);
      await regenerateSection();
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
      await updateSectionStatus(newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const getActiveSectionContent = () => {
    let element = null;
    if (isCoverPages) {
      element = document.querySelector('.front-matter-container') || document.querySelector('.font-serif');
    } else {
      element = document.getElementById(`drhp-sub-${activeTocId}`) || 
                document.getElementById(`drhp-sec-${activeNode?.section?.id}`) ||
                document.querySelector(`[data-toc-id="${activeTocId}"]`) ||
                document.querySelector('.drhp-subsection-anchor');
    }

    const title = isCoverPages ? 'Draft Prospectus — Pages 1–3 (Fixed Front Matter)' : (activeNode?.fullTitle || 'DRHP Disclosure');
    if (!element) {
      const textContent = editorText || `Disclosure content for ${title}`;
      const htmlContent = `<div style="font-family: Arial, sans-serif; padding: 16px;"><h2>${title}</h2><p style="white-space: pre-wrap;">${textContent}</p></div>`;
      return { title, htmlContent, plainText: `${title}\n\n${textContent}` };
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll('button, .page-break-divider, label').forEach(el => el.remove());
    clone.querySelectorAll('textarea').forEach(ta => {
      const val = ta.value;
      if (val && val.trim()) {
        const div = document.createElement('div');
        div.style.whiteSpace = 'pre-wrap';
        div.style.marginTop = '8px';
        div.style.marginBottom = '12px';
        div.style.fontSize = '11pt';
        div.style.lineHeight = '1.6';
        div.style.color = '#1e293b';
        div.textContent = val;
        ta.parentNode.replaceChild(div, ta);
      } else {
        ta.remove();
      }
    });

    const htmlContent = clone.innerHTML;
    const plainText = `${title}\n\n${clone.innerText || clone.textContent}`;
    return { title, htmlContent, plainText, rawElement: element };
  };

  const handleExportSection = async (format) => {
    const { title, htmlContent } = getActiveSectionContent();
    const sanitizedTitle = (activeTocId || 'drhp_section').replace(/[^a-z0-9_-]/gi, '_');

    if (format === 'pdf') {
      try {
        setExportingSectionPdf(true);
        const res = await downloadPdf(companyId);
        const dataBlob = res.data;
        const blobData = dataBlob instanceof Blob ? dataBlob : new Blob([dataBlob], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blobData);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `IPO_Draft_Prospectus_${companyId}_${new Date().toISOString().split('T')[0]}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        console.error("PDF export failed:", err);
      } finally {
        setExportingSectionPdf(false);
      }
    } else if (format === 'docx') {
      try {
        setExportingSectionDocx(true);
        const docxHeader = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${title}</title></head>
        <body><h1>SEBI SME DRHP</h1><h2>${title}</h2>${htmlContent}</body>
        </html>`;

        const blob = new Blob(['\ufeff' + docxHeader], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${sanitizedTitle}_prospectus.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("DOCX export failed:", err);
      } finally {
        setExportingSectionDocx(false);
      }
    }
  };

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

  // Selection comment tooltip
  useEffect(() => {
    const canvasEl = documentCanvasRef.current;
    if (!canvasEl) return;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setTextSelectionTooltip(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!canvasEl.contains(range.commonAncestorContainer)) {
        setTextSelectionTooltip(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      const canvasRect = canvasEl.getBoundingClientRect();
      const selectedText = selection.toString().trim().substring(0, 120);

      let node = range.commonAncestorContainer;
      let subsectionId = activeTocId;
      while (node && node !== canvasEl) {
        if (node.nodeType === 1) {
          const subId = node.getAttribute?.('data-sub-id') || node.getAttribute?.('data-toc-id');
          if (subId) { subsectionId = subId; break; }
        }
        node = node.parentNode;
      }

      setTextSelectionTooltip({
        x: rect.left + rect.width / 2 - canvasRect.left,
        y: rect.top - canvasRect.top - 6,
        text: selectedText,
        subsectionId
      });
    };

    const handleMouseDown = (e) => {
      if (e.target.closest('.text-selection-tooltip')) return;
      setTextSelectionTooltip(null);
    };

    canvasEl.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      canvasEl.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [activeTocId]);

  const handleTextSelectionComment = async () => {
    if (!textSelectionTooltip) return;
    const commentText = `"${textSelectionTooltip.text}" — [highlighted text]`;
    try {
      await postComment(commentText, 'note', textSelectionTooltip.subsectionId);
      setTextSelectionTooltip(null);
      window.getSelection()?.removeAllRanges();
    } catch (err) {
      console.error('Failed to add selection comment:', err);
    }
  };

  const sectionIntake = getIntakeForSection(selectedSectionKey, intakeCache);
  const intakeFieldsList = Object.entries(sectionIntake).map(([fKey, fVal]) => ({
    fieldKey: `${selectedSectionKey}.${fKey}`,
    fieldName: fKey.replace(/_/g, ' '),
    value: String(fVal)
  }));

  const relevantDocs = docsCache || [];
  const citationsList = (currentSection.blocks || []).flatMap(b => b.citations || []);
  const uniqueCitations = Array.from(new Set(citationsList));

  const keyAliasMap = { risk_factors: 'risk_information', related_party: 'rpt', promoter_details: 'promoters' };
  const targetKey = keyAliasMap[selectedSectionKey] || selectedSectionKey;
  const subsectionIssues = (gapReport || []).filter(g => {
    const field = g.fieldName || '';
    return field.startsWith(selectedSectionKey) || field.startsWith(targetKey);
  });

  const reviewAiSuggestions = subsectionIssues
    .filter(g => !dismissedSuggestions[g.id || g.fieldName])
    .map(g => ({
      id: g.id || g.fieldName,
      severity: g.category || 'warning',
      description: g.description || `Missing or inconsistent: ${g.fieldName}`,
      fieldName: g.fieldName,
      suggestion: g.suggestion || `Add required disclosure for ${(g.fieldName || '').replace(/_/g, ' ')}.`
    }));

  const reviewOpenIssues = subsectionIssues.map(g => ({
    id: g.id || g.fieldName,
    severity: g.category || 'warning',
    section: SECTION_KEYS[selectedSectionKey] || selectedSectionKey,
    fieldName: g.fieldName,
    description: g.description || 'Missing or inconsistent disclosure data.',
    assignedUser: user?.name || 'Unassigned',
    status: 'Open'
  }));

  const reviewVersions = [
    ...(originalDraftText ? [{ id: 'original', label: 'Version 1 (Generated)', timestamp: null, isCurrent: false }] : []),
    { id: 'current', label: `Version ${originalDraftText ? '2' : '1'} (Current)`, timestamp: lastSavedTime.toISOString(), isCurrent: true }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3 font-sans">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Loading DRHP Single Source of Truth Document...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in relative font-sans">

      {/* View Sources Side Drawer */}
      {showSourceDrawer && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-slate-200 shadow-2xl z-50 p-6 overflow-y-auto space-y-6 animate-slide-left font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm uppercase font-mono tracking-wider">Disclosure Grounding Sources</h3>
            </div>
            <button onClick={() => setShowSourceDrawer(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>

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

          <button onClick={() => setShowSourceDrawer(false)} className="w-full btn-secondary text-xs py-2.5 rounded-xl font-semibold mt-4">
            Close Source Panel
          </button>
        </div>
      )}

      {/* Left Navigation Sidebar (Table of Contents & Review Tools) */}
      {viewMode === 'chapter' && (
        <div className="xl:col-span-1">
          <ChapterHealthSidebar
            activeId={activeTocId}
            setActiveId={setActiveTocId}
            onNavigateSection={(backendKey, subId) => {
              setActiveTocId(subId);
              const elem = document.getElementById(`drhp-sub-${subId}`) || document.getElementById(subId);
              if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            drafts={drafts}
            gapReport={gapReport}
            comments={comments}
            auditLogs={auditLogs}
            aiSuggestions={reviewAiSuggestions}
            openIssues={reviewOpenIssues}
            versions={reviewVersions}
            onCommentClick={(comm) => {
              const targetId = comm.block_id || activeTocId;
              const elem = document.getElementById(`drhp-sub-${targetId}`) || document.getElementById(targetId);
              if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            onIssueClick={() => navigate('/compliance-checklist')}
            onAcceptSuggestion={(sug) => {
              const text = sug.suggestion || sug.description || 'AI-suggested content.';
              const updated = editorText + '\n\n' + text;
              setEditorText(updated);
              saveContent(updated);
            }}
            onDismissSuggestion={(sug) => setDismissedSuggestions(prev => ({ ...prev, [sug.id || sug.fieldName]: true }))}
            onConvertSuggestionToComment={async (sug) => {
              const text = `[AI] ${sug.description || sug.text || 'Review suggestion'}`;
              await postComment(text, 'note');
            }}
            onVersionClick={(ver) => setActiveVersion(ver.id === 'original' ? 'original' : 'current')}
            onAddComment={(text) => postComment(text, 'note')}
            onResolveComment={(commId) => resolveCommentById(commId)}
          />
        </div>
      )}

      {/* Main DRHP Composition Pane */}
      <div className={`${viewMode === 'chapter' ? 'xl:col-span-2' : 'xl:col-span-3'} space-y-4`} ref={documentCanvasRef}>

        {/* AutoSave Status Header */}
        <div className="flex items-center justify-start mb-4 font-sans text-xs font-mono">
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
        </div>

        {/* Interactive Editable Document Canvas */}
        <div className="bg-slate-100/90 py-8 px-2 md:px-6 w-full flex justify-center rounded-2xl border border-slate-200/60 shadow-inner overflow-x-auto min-h-[920px]">
          <div style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }} className="w-full max-w-[800px] bg-white shadow-2xl border border-slate-200/80 rounded-sm p-8 md:p-14 space-y-10 font-serif text-slate-900 relative min-h-[900px] transition-transform duration-200">
            
            {!isCoverPages && currentSection.status !== 'certified' && (
              <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden opacity-[0.025] z-0">
                <div className="text-[3.2rem] font-black uppercase -rotate-[30deg] tracking-widest text-slate-900 whitespace-nowrap">
                  DRAFT RED HERRING PROSPECTUS — FOR OFFICIAL REVIEW ONLY
                </div>
              </div>
            )}

            <div className="-m-8 md:-m-14 space-y-12">
              {viewMode === 'preview' ? (
                <>
                  <FrontMatterTemplate
                    company={intakeCache?.company_details || {}}
                    issueDetails={{}}
                    intake={intakeCache}
                    drafts={drafts}
                    onNavigateSection={(secKey, targetId) => {
                      setActiveTocId(targetId);
                      const elem = document.getElementById(`drhp-sub-${targetId}`) || document.getElementById(targetId);
                      if (elem) elem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                  />

                  <div className="px-8 md:px-14 pb-14 space-y-16">
                    {DRHP_HIERARCHY.map((sec, secIdx) => {
                      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
                      const secTitleDisplay = sec.title.startsWith('SECTION')
                        ? sec.title
                        : `SECTION ${romanNumerals[secIdx] || (secIdx + 1)} – ${sec.title}`;
                      const subsections = sec.subsections && sec.subsections.length > 0 ? sec.subsections : [{ id: sec.id, title: sec.title, key: sec.key }];

                      return (
                        <div key={sec.id} id={`drhp-sec-${sec.id}`} className="space-y-10 border-t-4 border-slate-900 pt-10 font-serif">
                          <div className="border-b-2 border-slate-900 pb-3 text-center">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-wide uppercase">
                              {secTitleDisplay}
                            </h2>
                          </div>

                          <div className="space-y-12">
                            {subsections.map((sub, subIdx) => {
                              const subKey = sub.key;
                              const subNumber = sec.subsections && sec.subsections.length > 0 ? `${secIdx + 1}.${subIdx + 1}` : `${secIdx + 1}.0`;
                              const subBlocks = getBlocksForSubsection(sub.id, subKey, drafts, intakeCache);
                              const cleanSubTitle = (sub.title || '').replace(/^\d+(\.\d+)*\s*/, '').trim();

                              return (
                                <div key={sub.id} id={`drhp-sub-${sub.id}`} data-toc-id={sub.id} className="drhp-subsection-anchor space-y-5 pt-4 border-t border-slate-200">
                                  <div className="border-b border-slate-300 pb-2">
                                    <h3 className="text-base font-bold text-slate-900 tracking-tight font-serif">
                                      {subNumber} {cleanSubTitle}
                                    </h3>
                                  </div>

                                  <div className="space-y-5 font-sans">
                                    {subBlocks && subBlocks.length > 0 ? (
                                      subBlocks.map((blk, bIdx) => (
                                        <DrhpBlockRenderer key={blk.id || bIdx} block={blk} onCitationClick={handleSourceClick} />
                                      ))
                                    ) : (
                                      <p className="text-xs text-slate-500 italic font-sans">
                                        Disclosure text pending generation for {cleanSubTitle}.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="px-8 md:px-14 py-10 space-y-12">
                  {isCoverPages ? (
                    <FrontMatterTemplate
                      company={intakeCache?.company_details || {}}
                      issueDetails={{}}
                      intake={intakeCache}
                      drafts={drafts}
                      onNavigateSection={(secKey, targetId) => setActiveTocId(targetId)}
                    />
                  ) : (
                    (() => {
                      const sec = activeNode.section;
                      const secIdx = DRHP_HIERARCHY.findIndex(s => s.id === sec.id);
                      const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
                      const secTitleDisplay = sec.title.startsWith('SECTION')
                        ? sec.title
                        : `SECTION ${romanNumerals[secIdx >= 0 ? secIdx : 0] || 'I'} – ${sec.title}`;
                      const subsections = sec.subsections && sec.subsections.length > 0 ? sec.subsections : [{ id: sec.id, title: sec.title, key: sec.key }];

                      return (
                        <div key={sec.id} id={`drhp-sec-${sec.id}`} className="space-y-10 font-serif">
                          <div className="border-b-2 border-slate-900 pb-3 text-center">
                            <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-wide uppercase">
                              {secTitleDisplay}
                            </h2>
                          </div>

                          <div className="space-y-12">
                            {subsections.map((sub, subIdx) => {
                              const subKey = sub.key;
                              const subNumber = sec.subsections && sec.subsections.length > 0 ? `${secIdx + 1}.${subIdx + 1}` : `${secIdx + 1}.0`;
                              const subBlocks = getBlocksForSubsection(sub.id, subKey, drafts, intakeCache);
                              const cleanSubTitle = (sub.title || '').replace(/^\d+(\.\d+)*\s*/, '').trim();

                              return (
                                <div key={sub.id} id={`drhp-sub-${sub.id}`} data-toc-id={sub.id} data-sub-id={sub.id} className="drhp-subsection-anchor space-y-5 pt-6 border-t border-slate-200 scroll-mt-20">
                                  <div id={sub.id} className="pb-2 border-b border-slate-300 scroll-mt-20">
                                    <h3 className="text-base font-bold text-slate-900 tracking-tight font-serif">
                                      {subNumber} {cleanSubTitle}
                                    </h3>
                                  </div>

                                  <div className="space-y-5 font-sans">
                                    {subBlocks && subBlocks.length > 0 ? (
                                      subBlocks.map((blk, bIdx) => (
                                        <DrhpBlockRenderer key={blk.id || bIdx} block={blk} onCitationClick={handleSourceClick} />
                                      ))
                                    ) : (
                                      <p className="text-xs text-slate-500 italic font-sans">
                                        Disclosure text pending generation for {cleanSubTitle}.
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {textSelectionTooltip && (
        <div className="text-selection-tooltip absolute z-50 animate-fade-in" style={{ left: `${textSelectionTooltip.x}px`, top: `${textSelectionTooltip.y}px`, transform: 'translate(-50%, -100%)' }}>
          <button type="button" onClick={handleTextSelectionComment} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-indigo-600/30 transition-all whitespace-nowrap">
            <MessageSquare className="w-3.5 h-3.5" />
            Add Comment
          </button>
          <div className="w-2.5 h-2.5 bg-indigo-600 rotate-45 mx-auto -mt-1.5" />
        </div>
      )}
    </div>
  );
}
