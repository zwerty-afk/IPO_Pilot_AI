import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { useDraftDocument } from '../context/DraftDocumentContext';
import {
  Bot,
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  FileText,
  Bookmark,
  AlertCircle,
  Info,
  Compass,
  Wand2,
  ShieldAlert,
  Edit3,
  CornerDownRight
} from 'lucide-react';
import { chatbotQuery } from '../services/api';

// Dynamic contextual quick starters based on current active module route
const CONTEXTUAL_QUICK_ACTIONS = {
  '/intake': [
    { label: '📋 List missing intake fields', command: 'What intake fields are currently missing or incomplete?', icon: FileText },
    { label: '📄 Check required document uploads', command: 'Which required statutory documents are missing?', icon: ShieldCheck },
    { label: '❓ What should I fill next?', command: 'What should I fill next in the intake form?', icon: Info },
    { label: '🔍 Cross-verify intake against PDFs', command: 'Find any data mismatches between intake inputs and uploaded documents.', icon: AlertTriangle }
  ],
  '/compliance-checklist': [
    { label: '⚠️ Which compliance checks failed?', command: 'Which compliance checks are still pending or failed?', icon: AlertCircle },
    { label: '📜 Explain a failed rule', command: 'Explain why our compliance checks failed and how to fix them.', icon: ShieldCheck },
    { label: '💡 How to fix failed rules', command: 'Give actionable steps to convert all failed compliance checks to Pass.', icon: Sparkles }
  ],
  '/gap-analysis': [
    { label: '🚨 Show critical gaps', command: 'Show me the critical gaps.', icon: ShieldAlert },
    { label: '📉 How do gaps affect readiness?', command: 'How do these gaps impact our total IPO readiness score?', icon: TrendingUp },
    { label: '💡 Action plan to resolve gaps', command: 'Create a step-by-step action plan to fix the highest priority gaps.', icon: Wand2 }
  ],
  '/draft': [
    { label: '✍️ Summarize this chapter', command: 'Summarize this chapter.', icon: Edit3 },
    { label: '📝 Generate risk factor disclosure', command: 'Draft a risk factor based on our company information.', icon: Sparkles },
    { label: '🔍 What sources were used here?', command: 'What sources were used for this section?', icon: Bookmark }
  ],
  '/reviewer': [
    { label: '💬 Summarize open issues', command: 'What are the open issues here?', icon: AlertTriangle },
    { label: '📂 Unresolved comments', command: 'What comments are still unresolved?', icon: ShieldAlert },
    { label: '✅ Current review status', command: 'What is the current review status?', icon: CheckCircle2 }
  ],
  '/draft-preview': [
    { label: '📦 Check DRHP export readiness', command: 'Are all DRHP chapters complete and eligible for export?', icon: ShieldCheck },
    { label: '⚠️ Uncertified chapters', command: 'Which DRHP chapters are still uncertified?', icon: AlertCircle }
  ],
  '/readiness': [
    { label: '📊 Explain our readiness score', command: 'Why is our readiness score what it is?', icon: TrendingUp },
    { label: '🎯 How can we reach 100?', command: 'How can we reach 100?', icon: Sparkles },
    { label: '➡️ What should I do next?', command: 'What should I do next?', icon: Wand2 }
  ]
};

/** Renders a Gemini-generated Markdown answer (headers, bold, tables, lists) as real formatted content. */
function MarkdownMessage({ content }) {
  const navigate = useNavigate();

  // The assistant cites its sources as links to real in-app routes ("/intake?
  // step=financials"). Those must navigate within the SPA — opening them in a
  // new tab would force a full reload and drop the user's session context.
  // External links (http…) keep the normal new-tab behaviour.
  const SourceLink = ({ href = '', children, ...rest }) => {
    const isInternal = href.startsWith('/');
    if (!isInternal) {
      return <a className="text-indigo-600 font-semibold underline hover:text-indigo-800" href={href} target="_blank" rel="noreferrer" {...rest}>{children}</a>;
    }
    return (
      <a
        href={href}
        onClick={(e) => { e.preventDefault(); navigate(href); }}
        className="text-indigo-600 font-semibold underline hover:text-indigo-800 cursor-pointer"
        {...rest}
      >
        {children}
      </a>
    );
  };

  return (
    <div className="p-3.5 bg-white border border-slate-200/90 rounded-2xl shadow-sm text-xs leading-relaxed text-slate-800 font-sans [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1.5" {...p} />,
          h2: (p) => <h3 className="text-sm font-bold text-slate-900 mt-3 mb-1.5" {...p} />,
          h3: (p) => <h4 className="text-xs font-bold text-indigo-900 mt-2.5 mb-1" {...p} />,
          p: (p) => <p className="text-xs text-slate-700 leading-relaxed mb-1.5" {...p} />,
          strong: (p) => <strong className="font-bold text-slate-900" {...p} />,
          em: (p) => <em className="italic text-slate-600" {...p} />,
          ul: (p) => <ul className="list-disc list-inside space-y-1 text-xs text-slate-700 pl-1 mb-1.5" {...p} />,
          ol: (p) => <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 pl-1 mb-1.5" {...p} />,
          li: (p) => <li className="text-xs" {...p} />,
          a: SourceLink,
          code: (p) => <code className="px-1 py-0.5 bg-slate-100 text-indigo-700 rounded text-[10px] font-mono" {...p} />,
          table: (p) => <div className="overflow-x-auto my-2 rounded-lg border border-slate-200"><table className="w-full text-[10px] border-collapse" {...p} /></div>,
          thead: (p) => <thead className="bg-slate-100" {...p} />,
          th: (p) => <th className="px-2 py-1.5 text-left font-bold text-slate-700 border-b border-slate-200" {...p} />,
          td: (p) => <td className="px-2 py-1.5 text-slate-700 border-b border-slate-100" {...p} />,
          hr: () => <hr className="border-slate-200 my-2" />,
          blockquote: (p) => <blockquote className="border-l-2 border-indigo-300 pl-2 italic text-slate-500" {...p} />
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function CopilotWidget() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    companyId,
    readiness,
    selectedSectionKey,
    activeNode
  } = useDraftDocument();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasUnreadBadge, setHasUnreadBadge] = useState(true);

  const messagesEndRef = useRef(null);
  const widgetRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const pathname = location.pathname;

  const getModuleDetails = (path) => {
    if (path.startsWith('/intake')) return { name: 'Intake Questionnaire', icon: '📋', role: 'Issuer' };
    if (path.startsWith('/compliance-checklist')) return { name: 'Compliance Checklist', icon: '🛡️', role: 'Compliance Officer' };
    if (path.startsWith('/gap-analysis')) return { name: 'Gap Analysis Engine', icon: '🚨', role: 'IPO Advisor' };
    if (path.startsWith('/draft-preview')) return { name: 'Draft Preview (Merged DRHP)', icon: '📖', role: 'Issuer / Reviewer' };
    if (path.startsWith('/draft')) return { name: 'Draft Prospectus (Chapter Editor)', icon: '✍️', role: 'Issuer / Legal Counsel' };
    if (path.startsWith('/reviewer')) return { name: 'Reviewer Workspace', icon: '⚖️', role: 'Lead Merchant Banker' };
    if (path.startsWith('/readiness')) return { name: 'IPO Readiness', icon: '📊', role: 'Issuer / Reviewer' };
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

  // Same launcher icon stays mounted whether the panel is open or closed —
  // clicking it just toggles the panel, it never disappears.
  const handleToggleCopilot = () => {
    setIsOpen(prev => !prev);
    setHasUnreadBadge(false);
  };

  const buildContext = () => {
    const readinessSnapshot = readiness ? {
      score: readiness.score,
      remainingPoints: readiness.remainingPoints,
      status: readiness.status?.label,
      stages: {
        intake: { score: readiness.stages.intake.score, max: readiness.stages.intake.max },
        compliance: {
          score: readiness.stages.compliance.score,
          max: readiness.stages.compliance.max,
          rules: (readiness.stages.compliance.rules || []).map(r => ({ name: r.requirementName, status: r.status, category: r.category }))
        },
        gapAnalysis: {
          score: readiness.stages.gapAnalysis.score,
          max: readiness.stages.gapAnalysis.max,
          checks: (readiness.stages.gapAnalysis.checks || []).map(c => ({ title: c.title, applicable: c.applicable, resolved: c.resolved, description: c.description }))
        },
        certification: {
          score: readiness.stages.certification.score,
          max: readiness.stages.certification.max,
          chapters: (readiness.stages.certification.chapters || []).map(c => ({ label: c.label, status: c.status }))
        }
      },
      nextActions: readiness.nextActions
    } : null;

    // Deliberately small. Drafts, documents, intake sections, comments, gaps,
    // audit trail and verifications are NOT sent from here — the server's
    // retrieval layer loads whichever of those the question actually needs,
    // straight from the live store. The readiness snapshot is the exception:
    // it is computed client-side by the single-source-of-truth engine that also
    // renders the IPO Readiness page, so passing it through is what guarantees
    // the Copilot and that page can never quote different numbers.
    return {
      companyId,
      role: user?.role,
      pathname,
      currentChapter: activeNode?.fullTitle || selectedSectionKey,
      readiness: readinessSnapshot
    };
  };

  const sendMessage = async (question) => {
    const q = question || input.trim();
    // Guard against duplicate submissions (double click, Enter + click race,
    // or a retry while a request is still in flight) — exactly one request
    // per user message.
    if (!q || requestInFlightRef.current) return;

    const userMsg = { role: 'user', content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    if (!companyId) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Company data could not be loaded. Please refresh and try again.' }]);
      return;
    }

    requestInFlightRef.current = true;
    setLoading(true);
    try {
      const history = updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const context = buildContext();
      const res = await chatbotQuery(q, history.slice(0, -1), context);

      const answer = res.data?.answer || "I couldn't process that request right now. Please try again.";

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        model: res.data?.model
      }]);
    } catch (err) {
      console.error('Copilot query error:', err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I couldn't process that request right now. Please try again."
      }]);
    } finally {
      setLoading(false);
      requestInFlightRef.current = false;
    }
  };

  return (
    <div ref={widgetRef} className="fixed bottom-6 right-6 z-50 font-sans">

      {/* COMPACT FLOATING CIRCULAR LAUNCHER ICON — stays mounted in both open and
          closed states; clicking it toggles the panel. Unchanged design/position. */}
      <button
        onClick={handleToggleCopilot}
        title={isOpen ? 'Close IPO Copilot' : 'Open IPO Copilot (Context Aware)'}
        className="group relative flex items-center justify-center w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-2xl border border-slate-700/80 transition-all duration-300 transform hover:scale-110 cursor-pointer z-50"
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 via-indigo-600 to-amber-400 flex items-center justify-center text-white shadow-md">
          <Bot className="w-5.5 h-5.5 group-hover:scale-110 transition-transform" />
        </div>

        {hasUnreadBadge && !isOpen && (
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-amber-400 border-2 border-slate-900 rounded-full animate-pulse" />
        )}
      </button>

      {/* COPILOT COMPACT FLOATING CHAT PANEL — anchored bottom-right, above the
          launcher. Fixed positioning so it never resizes/pushes the page, and is
          capped well below fullscreen per spec (max 420 x 650). */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-4 sm:right-6 z-50 bg-white border border-slate-200/90 shadow-2xl rounded-3xl flex flex-col overflow-hidden font-sans w-[calc(100vw-2rem)] sm:w-[400px] max-w-[420px] h-[min(78vh,600px)] max-h-[650px]"
        >
          {/* Top Bar */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-amber-400 flex items-center justify-center text-white shadow-md shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-white truncate">IPO Pilot AI</h3>
                <p className="text-[10px] text-slate-300 truncate">AI Filing Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Close Assistant (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          <div className="bg-indigo-50/80 border-b border-indigo-100 px-4 py-2 flex items-center justify-between text-xs text-indigo-900 font-medium shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">Grounded in this company's live workspace data</span>
            </div>
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
                    Ask about readiness, compliance, gaps, reviewer status, or your draft prospectus — I answer from
                    <strong> {moduleInfo.name}</strong> and this company's real workspace data.
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
                    ) : (
                      <MarkdownMessage content={msg.content} />
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-center gap-2 text-slate-500 p-3 bg-white border border-slate-200/80 rounded-2xl w-fit shadow-sm">
                <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                <span className="text-xs font-medium">Analyzing workspace context...</span>
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
              placeholder="Ask Copilot about readiness, compliance, gaps, or your draft..."
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
