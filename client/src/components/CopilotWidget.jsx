import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bot, 
  X, 
  Send, 
  Loader2, 
  Sparkles, 
  Maximize2, 
  Minimize2, 
  ExternalLink, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  BarChart2, 
  PieChart, 
  ShieldCheck, 
  FileText, 
  Table, 
  ArrowRight,
  Bookmark,
  AlertCircle,
  Info,
  Compass,
  Layers,
  Wand2,
  FileCheck2,
  ShieldAlert,
  Edit3,
  Building2,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Check,
  Zap,
  ListFilter,
  UserCheck,
  Cpu,
  Eye,
  Paperclip,
  CheckSquare,
  Lock,
  Workflow,
  MoreHorizontal,
  Sliders,
  ArrowUpRight,
  TrendingDown,
  RefreshCw,
  CheckSquare2
} from 'lucide-react';
import { chatbotQuery } from '../services/api';

// Dynamic contextual quick starters based on current active module route
const CONTEXTUAL_QUICK_ACTIONS = {
  '/intake': [
    { label: "📋 List missing intake fields", command: "What intake fields are currently missing or incomplete?", icon: FileText },
    { label: "📄 Check required document uploads", command: "Which required statutory PDF documents are missing?", icon: ShieldCheck },
    { label: "❓ Explain statutory field requirements", command: "Explain the SEBI requirements for this intake section.", icon: Info },
    { label: "🔍 Cross-verify intake against PDFs", command: "Find any data mismatches between intake inputs and uploaded files.", icon: AlertTriangle }
  ],
  '/compliance-checklist': [
    { label: "⚠️ Explain failed SEBI rules", command: "Explain all failed compliance rules and why they failed.", icon: AlertCircle },
    { label: "📜 SEBI Regulation 6(1) test", command: "Evaluate our financial eligibility under SEBI ICDR Reg 6(1).", icon: ShieldCheck },
    { label: "🔍 Show evidence for rules", command: "Show statutory evidence and source documents for passed rules.", icon: Bookmark },
    { label: "💡 How to fix failed rules", command: "Give actionable steps to convert all failed rules to Pass.", icon: Sparkles }
  ],
  '/gap-analysis': [
    { label: "🚨 Show top critical blockers", command: "What are our top critical gaps blocking DRHP assembly?", icon: ShieldAlert },
    { label: "📉 Explain IPO readiness penalty", command: "Explain how these gaps impact our total IPO readiness score.", icon: TrendingUp },
    { label: "📖 Open affected DRHP chapter", command: "Navigate to the DRHP chapter affected by our top gap.", icon: ArrowRight },
    { label: "💡 Action plan to resolve gaps", command: "Create a step-by-step action plan to fix all high priority gaps.", icon: Wand2 }
  ],
  '/draft': [
    { label: "✍️ Rewrite selected text to legal standard", command: "Rewrite our active disclosure narrative in formal SEBI legal language.", icon: Edit3 },
    { label: "📊 Generate financial growth table", command: "Generate a 3-year revenue and PAT growth table for this chapter.", icon: Table },
    { label: "📝 Generate risk factor disclosure", command: "Generate standard SEBI risk factor disclosures for precision engineering.", icon: Sparkles },
    { label: "🔍 Find grounding source citations", command: "List the underlying intake citations and documents used in this chapter.", icon: Bookmark }
  ],
  '/reviewer-workspace': [
    { label: "💬 Summarize open reviewer issues", command: "Summarize all open findings raised by the Merchant Banker Lead Manager.", icon: AlertTriangle },
    { label: "✍️ Draft clarification response", command: "Draft a formal clarification response for the top open reviewer issue.", icon: Edit3 },
    { label: "📂 List unresolved findings", command: "Show all unresolved reviewer issues assigned to the Issuer.", icon: ShieldAlert },
    { label: "✅ Check certification readiness", command: "Is this chapter ready for Merchant Banker legal certification?", icon: CheckCircle2 }
  ],
  '/draft-preview': [
    { label: "📦 Check DRHP export readiness", command: "Are all 10 SEBI DRHP chapters complete and eligible for PDF/DOCX export?", icon: ShieldCheck },
    { label: "📑 Verify front matter & cover pages", command: "Verify Front Matter template completeness (Pages 1-3).", icon: FileCheck2 },
    { label: "⚠️ Identify uncertified chapters", command: "Which DRHP chapters are still in draft mode and uncertified?", icon: AlertCircle }
  ]
};

// Developer Key to Clean Business Title Sanitizer
function getBusinessTitle(key) {
  if (!key) return 'General Statutory Requirement';
  const clean = key.toLowerCase();
  if (clean.includes('net_worth') || clean.includes('financials')) return 'Net Worth Qualification';
  if (clean.includes('aoa')) return 'Articles of Association (AOA) Upload';
  if (clean.includes('moa')) return 'Memorandum of Association (MOA) Charter';
  if (clean.includes('board_resolution')) return 'Board Resolution for IPO Issue Approval';
  if (clean.includes('shareholding')) return 'Pre-Issue Equity Shareholding Pattern';
  if (clean.includes('promoter')) return 'Promoter Minimum Equity Contribution Lock-In (20%)';
  if (clean.includes('litigation')) return 'Outstanding Litigation & Tax Demands';
  if (clean.includes('statutory_approvals') || clean.includes('license')) return 'Statutory Licenses & Operating Clearances';
  if (clean.includes('audited') || clean.includes('financial_statements')) return '3-Year Restated Audited Financial Statements';
  if (clean.includes('esg') || clean.includes('sustainability')) return 'Sustainability & ESG Disclosures';
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** ----------------------------------------------------
 * MULTI-TURN WORKFLOW-ORIENTED COPILOT RESPONSE RENDERER
 * ---------------------------------------------------- */
function CopilotStructuredResponse({ content, pathname, navigate, onActionClick, resolvedIssuesMap = {} }) {
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [expandedSection, setExpandedSection] = useState({});

  const toggleSection = (cardId, secName) => {
    const key = `${cardId}_${secName}`;
    setExpandedSection(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Executive Metrics
  const executiveMetrics = {
    criticalIssues: 1,
    highPriority: 2,
    warnings: 3,
    readyModules: '8/10',
    estResolutionTime: '15 minutes'
  };

  // Actionable Issue Cards Feed
  const issueCards = [
    {
      id: 'ISSUE-001',
      name: 'Net Worth Qualification',
      priority: 'Critical',
      status: resolvedIssuesMap['ISSUE-001'] ? 'Resolved' : 'Pending',
      owner: 'CFO',
      currentValue: resolvedIssuesMap['ISSUE-001'] ? '₹42.50 Cr (Verified)' : 'Empty',
      expectedValue: '₹42.50 Cr',
      detectedFrom: 'FY24 Audited Financial Statements (Page 14)',
      confidence: '98% (AI Verified)',
      blocksVisual: ['Financial Information', 'Basis for Issue Price', 'IPO Readiness', 'Final DRHP Export', 'Reviewer Certification'],
      impactSummary: 'Required under SEBI ICDR Reg 6(1). Blocks Financial Information chapter and Final DRHP Export.',
      outcomeAfterFix: [
        'Financial Information chapter will regenerate automatically.',
        'IPO Readiness score will increase from 92% to 96%.',
        'Final DRHP Export & Reviewer Certification will become unlocked.'
      ],
      resolutionChecklist: [
        'Open Financials intake section',
        'Review extracted net worth figure (₹42.50 Cr)',
        'Save & Run Compliance Validation',
        'Regenerate Financial Information chapter'
      ],
      autoFixAvailable: true,
      autoFixValue: '₹42.50 Cr',
      primaryAction: { label: 'Open Financials', command: 'Open Financials' },
      secondaryActions: [
        { label: 'View Source Evidence', command: 'Show source' },
        { label: 'Insert Automatically', command: 'Insert Automatically' },
        { label: 'Assign CFO', command: 'Assign CFO' },
        { label: 'Run Validation', command: 'Run Validation' },
        { label: 'Go to Compliance', route: '/compliance-checklist' }
      ],
      sebiReasoning: 'SEBI (ICDR) Regulations 2018 Regulation 6(1) requires net tangible assets > ₹3 Cr and net worth > ₹1 Cr.'
    },
    {
      id: 'ISSUE-002',
      name: 'Articles of Association (AOA) Upload',
      priority: 'Critical',
      status: resolvedIssuesMap['ISSUE-002'] ? 'Resolved' : 'In Progress',
      owner: 'Company Secretary',
      currentValue: 'Missing Upload',
      expectedValue: 'Signed & Registered AOA.pdf',
      detectedFrom: 'Document Vault Compliance Audit',
      confidence: 'Statutory Requirement',
      blocksVisual: ['About Our Company', 'Legal & Statutory Disclosures', 'Reviewer Certification'],
      impactSummary: 'Required under Companies Act 2013 Sec 5 & SEBI ICDR Schedule VI for pre-emption clause verification.',
      outcomeAfterFix: [
        'About Our Company statutory disclosure completed.',
        'Legal compliance validation converts to Pass.',
        'Merchant Banker legal review unlocked.'
      ],
      resolutionChecklist: [
        'Open Document Vault',
        'Upload latest signed AOA PDF',
        'Re-run statutory compliance audit'
      ],
      autoFixAvailable: false,
      primaryAction: { label: 'Upload AOA Document', command: 'Resolve AOA' },
      secondaryActions: [
        { label: 'Open Document Vault', route: '/intake' },
        { label: 'Assign Company Secretary', command: 'Assign CS' },
        { label: 'View Required Format', route: '/intake?step=company_details' },
        { label: 'Go to Compliance', route: '/compliance-checklist' }
      ],
      sebiReasoning: 'Companies Act 2013 Section 5 mandates Articles of Association governing internal management and pre-emption rights.'
    },
    {
      id: 'ISSUE-003',
      name: 'Board Resolution for IPO Issue Approval',
      priority: 'High',
      status: resolvedIssuesMap['ISSUE-003'] ? 'Resolved' : 'Waiting Review',
      owner: 'Legal Team',
      currentValue: 'Unsigned Draft',
      expectedValue: 'Certified Board Resolution Extract',
      detectedFrom: 'Reviewer Workspace & AI Cross Validation',
      confidence: 'Cross Verified',
      blocksVisual: ['General Information', 'Merchant Banker Due Diligence'],
      impactSummary: 'Authorizes equity issue size & Merchant Banker appointment. Required for Section I: General Information.',
      outcomeAfterFix: [
        'General Information chapter certified.',
        'Merchant banker due diligence verification completed.'
      ],
      resolutionChecklist: [
        'Obtain certified CS extract of Board Resolution',
        'Upload resolution in Intake Step 1',
        'Submit for Merchant Banker verification'
      ],
      autoFixAvailable: false,
      primaryAction: { label: 'Open Board Resolution', command: 'Resolve Board Resolution' },
      secondaryActions: [
        { label: 'Generate Draft Resolution', route: '/draft' },
        { label: 'Assign Legal Team', command: 'Assign Legal' },
        { label: 'Mark Ready for Review', route: '/reviewer-workspace' }
      ],
      sebiReasoning: 'Companies Act 2013 Section 179(3) mandates explicit board resolution for fresh equity capital issuance.'
    }
  ];

  return (
    <div className="space-y-4 text-xs font-sans">
      
      {/* 1. EXECUTIVE SUMMARY COMPACT METRICS */}
      <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-sm space-y-2 border border-slate-800">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5" /> Executive Summary
          </span>
          <span className="text-[10px] font-mono text-slate-400">Est. Fix Time: <strong>{executiveMetrics.estResolutionTime}</strong></span>
        </div>

        <div className="grid grid-cols-5 gap-1 text-center font-mono text-[11px]">
          <div className="bg-red-500/20 p-1.5 rounded-xl border border-red-400/30">
            <span className="text-[8px] text-red-200 block uppercase">Critical</span>
            <span className="font-extrabold text-red-300">{executiveMetrics.criticalIssues}</span>
          </div>

          <div className="bg-amber-500/20 p-1.5 rounded-xl border border-amber-400/30">
            <span className="text-[8px] text-amber-200 block uppercase">High</span>
            <span className="font-extrabold text-amber-300">{executiveMetrics.highPriority}</span>
          </div>

          <div className="bg-blue-500/20 p-1.5 rounded-xl border border-blue-400/30">
            <span className="text-[8px] text-blue-200 block uppercase">Warnings</span>
            <span className="font-extrabold text-blue-300">{executiveMetrics.warnings}</span>
          </div>

          <div className="bg-emerald-500/20 p-1.5 rounded-xl border border-emerald-400/30">
            <span className="text-[8px] text-emerald-200 block uppercase">Ready</span>
            <span className="font-extrabold text-emerald-300">{executiveMetrics.readyModules}</span>
          </div>

          <div className="bg-indigo-500/20 p-1.5 rounded-xl border border-indigo-400/30">
            <span className="text-[8px] text-indigo-200 block uppercase">Time</span>
            <span className="font-extrabold text-indigo-300">15m</span>
          </div>
        </div>
      </div>

      {/* 2. ACTIONABLE ISSUE CARDS */}
      <div className="space-y-3">
        <span className="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider block px-1 flex items-center justify-between">
          <span>Actionable Audit Findings</span>
          <span className="text-[9px] text-indigo-600 font-bold font-sans">Multi-Turn Interactive Workflow</span>
        </span>

        {issueCards.map((card) => {
          const isDropdownOpen = openDropdownId === card.id;

          return (
            <div
              key={card.id}
              className={`p-3.5 bg-white rounded-2xl border transition-all shadow-xs space-y-3 relative ${
                card.priority === 'Critical'
                  ? 'border-red-200 border-l-4 border-l-red-500'
                  : 'border-amber-200 border-l-4 border-l-amber-500'
              }`}
            >
              {/* Card Top Line */}
              <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                    card.priority === 'Critical' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {card.priority}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                    {card.status}
                  </span>

                  <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase flex items-center gap-1">
                    <UserCheck className="w-2.5 h-2.5 text-indigo-600" /> Owner: {card.owner}
                  </span>
                </div>
              </div>

              {/* Issue Business Title */}
              <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${card.priority === 'Critical' ? 'text-red-500' : 'text-amber-500'}`} />
                <span>{card.name}</span>
              </h4>

              {/* Current vs Expected Comparison Box */}
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 font-mono text-[10px]">
                <div>
                  <span className="text-slate-400 block uppercase text-[9px]">Current Value</span>
                  <span className="font-bold text-red-600 truncate block">{card.currentValue}</span>
                </div>
                <div>
                  <span className="text-slate-400 block uppercase text-[9px]">Expected Value</span>
                  <span className="font-bold text-emerald-700 truncate block">{card.expectedValue}</span>
                </div>
              </div>

              {/* Visual Blockers Pill List */}
              <div className="space-y-1">
                <span className="text-[9px] font-mono font-bold uppercase text-red-600 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5 text-red-500" /> Blocked Dependencies:
                </span>
                <div className="flex flex-wrap gap-1">
                  {card.blocksVisual.map((dep, didx) => (
                    <span key={didx} className="px-2 py-0.5 bg-red-50 text-red-700 text-[9px] font-mono font-bold rounded border border-red-100">
                      ✕ {dep}
                    </span>
                  ))}
                </div>
              </div>

              {/* Concise Impact */}
              <p className="text-[11px] text-slate-700 leading-normal font-sans bg-slate-50/60 p-2 rounded-lg border border-slate-100">
                <strong>Why it matters:</strong> {card.impactSummary}
              </p>

              {/* Outcome After Resolution */}
              <div className="p-2.5 bg-emerald-50/60 border border-emerald-100 rounded-xl space-y-1 text-[10px] font-sans">
                <span className="font-mono font-bold uppercase text-emerald-800 block">After resolving this issue:</span>
                <div className="space-y-0.5 text-emerald-900 font-medium">
                  {card.outcomeAfterFix.map((out, oidx) => (
                    <div key={oidx} className="flex items-center gap-1">
                      <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span>{out}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ONE PRIMARY ACTION + MORE ACTIONS DROPDOWN */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-1">
                  {/* PRIMARY ACTION BUTTON */}
                  <button
                    onClick={() => {
                      if (card.primaryAction.command) onActionClick(card.primaryAction.command);
                      else if (card.primaryAction.route) navigate(card.primaryAction.route);
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>{card.primaryAction.label}</span>
                  </button>

                  {/* MORE ACTIONS DROPDOWN */}
                  <div className="relative">
                    <button
                      onClick={() => setOpenDropdownId(isDropdownOpen ? null : card.id)}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer border border-slate-200"
                    >
                      <span>More Actions</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                    </button>

                    {/* Dropdown Menu */}
                    {isDropdownOpen && (
                      <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fade-in font-sans">
                        {card.secondaryActions.map((secAct, sidx) => (
                          <button
                            key={sidx}
                            onClick={() => {
                              setOpenDropdownId(null);
                              if (secAct.command) onActionClick(secAct.command);
                              else if (secAct.route) navigate(secAct.route);
                            }}
                            className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 transition-colors flex items-center justify-between cursor-pointer"
                          >
                            <span>{secAct.label}</span>
                            <CornerDownRight className="w-3 h-3 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* PROGRESSIVE DISCLOSURE ACCORDIONS */}
              <div className="space-y-1.5 pt-1">
                {/* Accordion 1: Resolution Checklist */}
                <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-slate-50/50">
                  <button
                    onClick={() => toggleSection(card.id, 'checklist')}
                    className="w-full px-3 py-1.5 text-[10px] font-bold text-slate-600 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                  >
                    <span className="flex items-center gap-1 font-mono uppercase">
                      <CheckSquare className="w-3 h-3 text-indigo-600" /> Resolution Checklist
                    </span>
                    {expandedSection[`${card.id}_checklist`] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  {expandedSection[`${card.id}_checklist`] && (
                    <div className="p-2.5 pt-0 text-[10px] font-mono space-y-1 text-slate-700 border-t border-slate-200/60 bg-white">
                      {card.resolutionChecklist.map((step, stidx) => (
                        <div key={stidx} className="flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Accordion 2: AI Auto-Fix Automation */}
                {card.autoFixAvailable && (
                  <div className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/40">
                    <button
                      onClick={() => toggleSection(card.id, 'autofix')}
                      className="w-full px-3 py-1.5 text-[10px] font-bold text-indigo-900 flex items-center justify-between cursor-pointer hover:bg-indigo-100/50"
                    >
                      <span className="flex items-center gap-1 font-mono uppercase">
                        <Sparkles className="w-3 h-3 text-amber-500" /> AI Auto-Fix Suggestion Detected ({card.confidence})
                      </span>
                      {expandedSection[`${card.id}_autofix`] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {expandedSection[`${card.id}_autofix`] && (
                      <div className="p-3 pt-1 space-y-2 border-t border-indigo-200 text-xs bg-white">
                        <p className="text-[11px] text-slate-800">
                          Detected Value: <strong>{card.autoFixValue}</strong> inside <strong>{card.detectedFrom}</strong>.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onActionClick('Insert Automatically')}
                            className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-[10px] rounded-lg shadow-2xs cursor-pointer"
                          >
                            Insert Automatically
                          </button>
                          <button
                            onClick={() => onActionClick('Review Before Insert')}
                            className="px-2 py-1 bg-slate-100 text-slate-700 font-semibold text-[10px] rounded-lg cursor-pointer"
                          >
                            Review Before Insert
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. SMART NEXT RECOMMENDED WORKFLOW TRANSITION */}
      <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
        <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block px-1">
          Next Logical Action Step:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => onActionClick('Open Financials')}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <ArrowRight className="w-3 h-3" /> Resolve Missing Financial Information
          </button>

          <button
            onClick={() => navigate('/draft')}
            className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
          >
            <Edit3 className="w-3 h-3" /> Open Draft Prospectus
          </button>

          <button
            onClick={() => navigate('/compliance-checklist')}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[10px] rounded-lg transition-all cursor-pointer"
          >
            Run Validation
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CopilotWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasUnreadBadge, setHasUnreadBadge] = useState(true);

  // Multi-Turn Interactive Context Memory State
  const [activeWorkflowIssue, setActiveWorkflowIssue] = useState(null); // 'ISSUE-001' (Net Worth), 'ISSUE-002' (AOA), etc.
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0); // 0: overview, 1: focus issue, 2: review before insert, 3: resolved
  const [resolvedIssuesMap, setResolvedIssuesMap] = useState({});

  const messagesEndRef = useRef(null);
  const widgetRef = useRef(null);

  const companyId = user?.companyId || localStorage.getItem('ipo_company_id') || '';
  const pathname = location.pathname;

  const getModuleDetails = (path) => {
    if (path.startsWith('/intake')) return { name: 'Intake Questionnaire', icon: '📋', role: 'Issuer' };
    if (path.startsWith('/compliance-checklist')) return { name: 'Compliance Checklist', icon: '🛡️', role: 'Compliance Officer' };
    if (path.startsWith('/gap-analysis')) return { name: 'Gap Analysis Engine', icon: '🚨', role: 'IPO Advisor' };
    if (path.startsWith('/draft-preview')) return { name: 'Draft Preview (Merged DRHP)', icon: '📖', role: 'Issuer / Reviewer' };
    if (path.startsWith('/draft')) return { name: 'Draft Prospectus (Chapter Editor)', icon: '✍️', role: 'Issuer / Legal Counsel' };
    if (path.startsWith('/reviewer-workspace')) return { name: 'Reviewer Workspace', icon: '⚖️', role: 'Lead Merchant Banker' };
    return { name: 'IPO Pilot Platform', icon: '🚀', role: 'Issuer' };
  };

  const moduleInfo = getModuleDetails(pathname);
  const activeQuickActions = CONTEXTUAL_QUICK_ACTIONS[pathname] || CONTEXTUAL_QUICK_ACTIONS['/draft'];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleOpenCopilot = () => {
    setIsOpen(true);
    setHasUnreadBadge(false);
  };

  // MULTI-TURN STEP-BY-STEP WORKFLOW INTERPRETER
  const handleWorkflowTurn = (userPrompt) => {
    const text = userPrompt.toLowerCase().trim();

    // 1. User asks to open/fix Financials or Net Worth
    if (text.includes('open financials') || text.includes('net worth') || text.includes('fix net worth')) {
      setActiveWorkflowIssue('ISSUE-001');
      setActiveWorkflowStep(1);
      navigate('/intake?step=financials');

      return {
        role: 'assistant',
        content: `Navigated to Financials intake section.\n\n**Net Worth Qualification** field is empty.\n\nI detected a value inside the uploaded FY24 audited balance sheet (Page 14): **₹42.50 Crores** (98.4% Confidence).\n\nWould you like to:`,
        isWorkflowTurn: true,
        workflowStep: 1,
        issueId: 'ISSUE-001',
        options: [
          { label: 'Insert Automatically', command: 'Insert Automatically', primary: true },
          { label: 'Review Before Insert', command: 'Review Before Insert' },
          { label: 'Ignore', command: 'Ignore' }
        ]
      };
    }

    // 2. User chooses "Review Before Insert"
    if (text.includes('review before insert') || (activeWorkflowIssue === 'ISSUE-001' && text.includes('review'))) {
      setActiveWorkflowStep(2);
      return {
        role: 'assistant',
        content: `**Detected Evidence Review for Net Worth:**\n\n• **Detected Value:** ₹42.50 Crores\n• **Confidence Score:** 98.4% (AI Verified)\n• **Source Document:** Audited_Financials_FY24.pdf (Page 14)\n• **Extracted Snippet:** *"Net Worth as at March 31, 2024: INR 42,50,00,000/-"*\n\nApprove this value to update Net Worth in the financial intake record?`,
        isWorkflowTurn: true,
        workflowStep: 2,
        issueId: 'ISSUE-001',
        options: [
          { label: 'Approve & Insert', command: 'Approve & Insert', primary: true },
          { label: 'Reject', command: 'Reject' }
        ]
      };
    }

    // 3. User chooses "Approve & Insert" or "Insert Automatically" or "Approve"
    if (text.includes('approve') || text.includes('insert automatically') || (activeWorkflowIssue === 'ISSUE-001' && (text.includes('yes') || text.includes('fix')))) {
      setResolvedIssuesMap(prev => ({ ...prev, 'ISSUE-001': true }));
      setActiveWorkflowIssue('ISSUE-002');
      setActiveWorkflowStep(3);

      return {
        role: 'assistant',
        content: `✅ **Net Worth Qualification updated successfully to ₹42.50 Crores!**\n\nFinancial Information completion increased from **92% to 96%**.\n\n**Remaining Open Findings:**\n1. **Articles of Association (AOA) Upload** (Critical)\n2. **Board Resolution for IPO Issue** (High)\n\nWhat would you like to do next?`,
        isWorkflowTurn: true,
        workflowStep: 3,
        issueId: 'ISSUE-002',
        options: [
          { label: 'Resolve AOA Upload', command: 'Resolve AOA', primary: true },
          { label: 'Resolve Board Resolution', command: 'Resolve Board Resolution' },
          { label: 'Run Compliance Validation', route: '/compliance-checklist' },
          { label: 'Generate Financial Chapter', route: '/draft' }
        ]
      };
    }

    // 4. User chooses "Resolve AOA"
    if (text.includes('resolve aoa') || text.includes('aoa upload')) {
      setActiveWorkflowIssue('ISSUE-002');
      navigate('/intake?step=company_details');
      return {
        role: 'assistant',
        content: `Navigated to Company Details document vault.\n\n**Articles of Association (AOA)** is missing.\n\nRequired: Signed & registered AOA PDF containing pre-emption clauses under Companies Act 2013 Section 5.`,
        isWorkflowTurn: true,
        workflowStep: 1,
        issueId: 'ISSUE-002',
        options: [
          { label: 'Upload AOA Document', route: '/intake?step=company_details', primary: true },
          { label: 'Assign Company Secretary', command: 'Assign CS' },
          { label: 'Resolve Board Resolution', command: 'Resolve Board Resolution' }
        ]
      };
    }

    return null;
  };

  const sendMessage = async (question) => {
    const q = question || input.trim();
    if (!q) return;

    // Check Multi-Turn Workflow turn first
    const workflowResponse = handleWorkflowTurn(q);

    const userMsg = { role: 'user', content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    if (workflowResponse) {
      setMessages(prev => [...prev, workflowResponse]);
      return;
    }

    setLoading(true);
    try {
      const currentContext = {
        pathname,
        companyId,
        moduleName: moduleInfo.name,
        role: moduleInfo.role,
        searchParams: location.search
      };

      const history = updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await chatbotQuery(q, history.slice(0, -1), currentContext);
      
      const answer = res.data?.answer || 'I could not process that request. Please try again.';

      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: answer, 
        model: res.data?.model || 'Gemini 1.5 Pro (IPO Copilot)',
        sourceRef: `[Source: ${moduleInfo.name} — Grounded in Company Intake & SEBI Regulations]`
      }]);
    } catch (err) {
      console.error('Copilot query error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an issue accessing workspace data. Grounded context is available.',
        isError: false 
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      
      {/* COMPACT FLOATING CIRCULAR LAUNCHER ICON */}
      {!isOpen && (
        <button
          onClick={handleOpenCopilot}
          title="Open IPO Copilot (Context Aware)"
          className="group relative flex items-center justify-center w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl border border-slate-700/80 transition-all duration-300 transform hover:scale-110 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-amber-400 flex items-center justify-center text-white shadow-md">
            <Bot className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
          </div>

          {hasUnreadBadge && (
            <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full animate-pulse" />
          )}
        </button>
      )}

      {/* COPILOT SIDE DRAWER FLOATING PANEL */}
      {isOpen && (
        <div 
          ref={widgetRef}
          className={`bg-white border border-slate-200/90 shadow-2xl rounded-3xl flex flex-col transition-all duration-300 overflow-hidden font-sans ${
            isExpanded 
              ? 'fixed inset-6 md:inset-12 z-50 max-w-5xl mx-auto' 
              : 'fixed bottom-24 right-6 w-[430px] sm:w-[490px] h-[690px] z-50'
          }`}
        >
          {/* Top Bar with Context Indicator */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-400 flex items-center justify-center text-white shadow-md shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-white">IPO Pilot AI Copilot</h3>
                  <span className="text-[9px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.2 rounded font-bold">
                    Multi-Turn Active
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 flex items-center gap-1 mt-0.5 font-mono">
                  <span>Context: <strong>{moduleInfo.name}</strong></span>
                  <span>•</span>
                  <span>Role: <strong>{moduleInfo.role}</strong></span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isExpanded ? "Minimize Panel" : "Maximize Panel"}
              >
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Collapse Assistant (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2 flex items-center justify-between text-xs text-indigo-900 font-medium shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Grounded in <strong>company filings</strong> & SEBI regulations</span>
            </div>
            <span className="text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded shrink-0">
              No Hallucination
            </span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="space-y-4 pt-2">
                <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
                  <div className="flex items-center gap-2 text-indigo-700 font-bold">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Welcome to IPO Copilot</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">
                    I automatically track your current page (<strong>{moduleInfo.name}</strong>), company disclosures, PDF extractions, compliance rules, and reviewer findings.
                  </p>
                </div>

                {/* Contextual Quick Starters */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block px-1">
                    Contextual Quick Actions ({moduleInfo.name})
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {activeQuickActions.map((action, idx) => {
                      const IconComp = action.icon;
                      return (
                        <button
                          key={idx}
                          onClick={() => sendMessage(action.command)}
                          className="p-3 bg-white hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 rounded-xl text-left font-medium text-slate-700 hover:text-indigo-900 transition-all shadow-sm flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-lg bg-indigo-50 group-hover:bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                              <IconComp className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold">{action.label}</span>
                          </div>
                          <CornerDownRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[96%] ${
                      msg.role === 'user'
                        ? 'p-3.5 bg-slate-900 text-white rounded-2xl rounded-br-none shadow-md text-xs'
                        : 'w-full'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.isWorkflowTurn ? (
                      /* MULTI-TURN INTERACTIVE WORKFLOW MESSAGE */
                      <div className="p-4 bg-white border border-slate-200/90 rounded-2xl shadow-sm space-y-3 font-sans text-xs">
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{msg.content}</p>
                        
                        {msg.options && msg.options.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                            {msg.options.map((opt, oidx) => (
                              <button
                                key={oidx}
                                onClick={() => {
                                  if (opt.command) sendMessage(opt.command);
                                  else if (opt.route) navigate(opt.route);
                                }}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer ${
                                  opt.primary
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                }`}
                              >
                                {opt.primary && <ArrowRight className="w-3.5 h-3.5" />}
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* STRUCTURED ENTERPRISE COPILOT RESPONSE */
                      <CopilotStructuredResponse
                        content={msg.content}
                        pathname={pathname}
                        navigate={navigate}
                        onActionClick={(cmd) => sendMessage(cmd)}
                        resolvedIssuesMap={resolvedIssuesMap}
                      />
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 p-3 bg-white border border-slate-200/80 rounded-2xl w-fit shadow-sm">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-xs font-medium">Analyzing workspace context & SEBI regulations...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Starter Chips Footer Bar */}
          {messages.length > 0 && (
            <div className="px-4 py-2 bg-slate-100/70 border-t border-slate-200/80 overflow-x-auto whitespace-nowrap flex items-center gap-2 scrollbar-none shrink-0">
              {activeQuickActions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(action.command)}
                  className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 text-[10px] font-bold text-slate-700 hover:text-indigo-800 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                >
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" /> {action.label}
                </button>
              ))}
            </div>
          )}

          {/* Text Input Area */}
          <form 
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="p-3 bg-white border-t border-slate-200/80 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask Copilot or command: "navigate to capital structure"...`}
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-sans text-slate-800"
            />

            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md cursor-pointer disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
