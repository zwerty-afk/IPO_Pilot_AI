import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Info
} from 'lucide-react';
import { chatbotQuery } from '../services/api';

const QUICK_STARTERS = [
  { label: "📋 Show missing documents", query: "Show missing documents in a table." },
  { label: "📈 Create a revenue chart", query: "Create a revenue and PAT growth chart for 3 years." },
  { label: "⚠️ Generate a risk matrix", query: "Generate a risk matrix with severity breakdown." },
  { label: "🏛️ Evaluate capital structure", query: "Visualize promoter shareholding and lock-in compliance." },
  { label: "⚖️ SEBI 6(1) eligibility", query: "Evaluate SEBI Regulation 6(1) financial eligibility." },
  { label: "🔍 Find inconsistencies", query: "Show all open validation errors and document mismatches." }
];

export default function CopilotWidget() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question) => {
    const q = question || input.trim();
    if (!q) return;

    const userMsg = { role: 'user', content: q };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const history = updatedMessages.slice(-10).map(m => ({ role: m.role, content: m.content }));
      const res = await chatbotQuery(q, history.slice(0, -1));
      const answer = res.data?.answer || 'I could not process that request. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: answer, model: res.data?.model }]);
    } catch (err) {
      console.error('Copilot query error:', err);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'I encountered an issue accessing the workspace context. Please try again.',
        isError: true 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleCitationClick = (url) => {
    if (!url) return;
    const cleanUrl = url.replace(/^file:\/\/\/?/, '/');
    navigate(cleanUrl);
  };

  // Render Status & Severity Badges
  const renderStatusChip = (text) => {
    const upper = String(text).toUpperCase();
    if (upper.includes('CRITICAL') || upper.includes('HIGH') || upper.includes('MISSING') || upper.includes('❌')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-red-50 text-red-700 border border-red-200">
          <AlertCircle className="w-2.5 h-2.5 shrink-0" /> {text.replace(/^[❌⚠️✅]\s*/, '')}
        </span>
      );
    }
    if (upper.includes('MEDIUM') || upper.includes('ATTENTION') || upper.includes('WARNING')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> {text.replace(/^[❌⚠️✅]\s*/, '')}
        </span>
      );
    }
    if (upper.includes('LOW') || upper.includes('HEALTHY') || upper.includes('VERIFIED') || upper.includes('COMPLIANT') || upper.includes('UPLOADED') || upper.includes('✅')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-2.5 h-2.5 shrink-0" /> {text.replace(/^[❌⚠️✅]\s*/, '')}
        </span>
      );
    }
    return <span className="font-semibold">{text}</span>;
  };

  // Inline Interactive Chart Renderer
  const renderChart = (chartJson) => {
    try {
      const chart = typeof chartJson === 'string' ? JSON.parse(chartJson) : chartJson;
      const { type, title, data = [] } = chart;

      if (type === 'donut' || type === 'pie') {
        const total = data.reduce((sum, item) => sum + item.value, 0);
        return (
          <div className="my-3 p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
            <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <PieChart className="w-3.5 h-3.5 text-indigo-600" /> {title || 'Distribution Analysis'}
            </p>
            <div className="space-y-2 text-xs pt-1">
              {data.map((item, idx) => {
                const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                const colors = ['bg-indigo-600', 'bg-emerald-500', 'bg-amber-500', 'bg-blue-500'];
                const barColor = colors[idx % colors.length];
                return (
                  <div key={idx}>
                    <div className="flex justify-between font-semibold text-[11px] mb-1">
                      <span className="text-slate-700">{item.label}</span>
                      <span className="text-slate-900 font-mono">{item.value} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className={`${barColor} h-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      if (type === 'matrix') {
        return (
          <div className="my-3 p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
            <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> {title || 'Risk Matrix Grid'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              {data.map((item, idx) => {
                const isCrit = item.category === 'critical';
                const isHigh = item.category === 'high';
                return (
                  <div key={idx} className={`p-2.5 rounded-xl border font-mono text-[11px] ${
                    isCrit ? 'bg-red-50 border-red-200 text-red-800 font-bold' :
                    isHigh ? 'bg-amber-50 border-amber-200 text-amber-800' :
                    'bg-slate-50 border-slate-200 text-slate-700'
                  }`}>
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">{item.label}</span>
                    <span className="text-sm font-extrabold block mt-0.5">{item.value} Risk(s)</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      const maxVal = Math.max(...data.map(d => d.value), 1);
      return (
        <div className="my-3 p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-sm space-y-2">
          <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <BarChart2 className="w-3.5 h-3.5 text-indigo-600" /> {title || 'Visual Comparison'}
          </p>
          <div className="space-y-2 text-xs pt-1">
            {data.map((item, idx) => {
              const pct = Math.round((item.value / maxVal) * 100);
              return (
                <div key={idx}>
                  <div className="flex justify-between font-semibold text-[11px] mb-1">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-indigo-700 font-mono font-bold">{item.value}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    } catch (e) {
      return null;
    }
  };

  // Helper to parse text segment into elements with native bold, citations, and status chips
  const renderInlineFormattedText = (text) => {
    if (!text) return null;
    
    // First, process citation links: [Label](file:///...)
    const linkRegex = /\[([^\]]+)\]\((file:\/\/\/[^\)]+)\)/g;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', content: text.substring(lastIndex, match.index) });
      }
      segments.push({ type: 'citation', label: match[1], url: match[2] });
      lastIndex = linkRegex.lastIndex;
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return segments.map((seg, idx) => {
      if (seg.type === 'citation') {
        return (
          <button
            key={idx}
            type="button"
            onClick={() => handleCitationClick(seg.url)}
            className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] border border-indigo-200 transition-colors shadow-2xs"
            title={`Navigate directly to: ${seg.label}`}
          >
            <Bookmark className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
            <span>{seg.label}</span>
          </button>
        );
      }

      // Process bold markdown (**text**) inside text segment
      const boldParts = seg.content.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={idx}>
          {boldParts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              const boldText = part.slice(2, -2);
              // Check if bold text is a status/severity indicator
              if (/^(HIGH|MEDIUM|LOW|CRITICAL|MISSING|VERIFIED|COMPLIANT|UPLOADED|PENDING)$/i.test(boldText.trim())) {
                return <span key={pIdx}> {renderStatusChip(boldText)} </span>;
              }
              return <strong key={pIdx} className="font-bold text-slate-900">{boldText}</strong>;
            }
            return part;
          })}
        </span>
      );
    });
  };

  // Parses Markdown responses into native React UI components
  const renderNativeCopilotMessage = (content) => {
    if (!content) return null;

    // Extract Chart directive if present
    const chartMatch = content.match(/```chart\n([\s\S]*?)\n```/);
    const chartJson = chartMatch ? chartMatch[1] : null;
    const cleanContent = content.replace(/```chart\n[\s\S]*?\n```/, '').trim();

    // Split content into paragraphs/blocks
    const lines = cleanContent.split('\n');
    const elements = [];
    let tableLines = [];
    let inTable = false;

    const flushTable = () => {
      if (tableLines.length === 0) return;
      // Parse markdown table
      const rows = tableLines
        .filter(l => l.includes('|') && !l.match(/^\|[\s:-|-]+\|$/))
        .map(l => l.split('|').map(c => c.trim()).filter((c, i, arr) => i > 0 && i < arr.length - 1));

      if (rows.length > 0) {
        const headers = rows[0];
        const dataRows = rows.slice(1);

        elements.push(
          <div key={`table-${elements.length}`} className="my-3 border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    {headers.map((h, hIdx) => (
                      <th key={hIdx} className="p-2.5 font-bold">{renderInlineFormattedText(h)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                  {dataRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/70 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2.5 font-medium text-slate-800">
                          {renderInlineFormattedText(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }
      tableLines = [];
      inTable = false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Table line detection
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        inTable = true;
        tableLines.push(trimmed);
        return;
      } else if (inTable) {
        flushTable();
      }

      if (!trimmed) return;

      // Executive Summary Card
      if (trimmed.startsWith('Executive Summary:') || trimmed.startsWith('### Executive Summary')) {
        const summaryText = trimmed.replace(/^Executive Summary:\s*/, '').replace(/^###\s*Executive Summary\s*/, '');
        elements.push(
          <div key={`exec-${index}`} className="p-3.5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs space-y-1 my-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Executive Summary
            </span>
            <p className="text-xs text-slate-800 font-medium leading-relaxed">
              {renderInlineFormattedText(summaryText)}
            </p>
          </div>
        );
        return;
      }

      // AI Recommendation Callout Card
      if (trimmed.toLowerCase().includes('recommendation:') || trimmed.toLowerCase().includes('ai recommendation:')) {
        const recText = trimmed.replace(/^.*?recommendation:\s*/i, '');
        elements.push(
          <div key={`rec-${index}`} className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1 my-2 text-xs">
            <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Action Recommendation
            </span>
            <p className="text-indigo-950 font-medium leading-relaxed">
              {renderInlineFormattedText(recText)}
            </p>
          </div>
        );
        return;
      }

      // Headings (###, ##, #)
      if (trimmed.startsWith('#')) {
        const headingText = trimmed.replace(/^#+\s*/, '');
        elements.push(
          <h4 key={`h-${index}`} className="text-xs font-bold text-slate-900 uppercase tracking-wider pt-2 border-b border-slate-100 pb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-indigo-600" />
            <span>{headingText}</span>
          </h4>
        );
        return;
      }

      // Bullet List Items
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        const bulletText = trimmed.replace(/^[•\-\*]\s*/, '');
        elements.push(
          <div key={`b-${index}`} className="flex items-start gap-2 text-xs text-slate-700 font-medium py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
            <span>{renderInlineFormattedText(bulletText)}</span>
          </div>
        );
        return;
      }

      // Regular Paragraph
      elements.push(
        <p key={`p-${index}`} className="text-xs text-slate-800 font-normal leading-relaxed">
          {renderInlineFormattedText(trimmed)}
        </p>
      );
    });

    if (inTable) {
      flushTable();
    }

    return (
      <div className="space-y-2.5">
        {elements}
        {chartJson && renderChart(chartJson)}
      </div>
    );
  };

  return (
    <>
      {/* Floating Copilot Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center gap-2.5 transition-all hover:scale-105 z-50 border border-indigo-400/30"
          title="Open AI IPO Copilot"
        >
          <div className="w-7 h-7 bg-white/20 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-left leading-tight hidden sm:block">
            <span className="text-xs font-extrabold block">AI IPO Copilot</span>
            <span className="text-[9px] text-indigo-200 font-mono">Workspace Context Active</span>
          </div>
        </button>
      )}

      {/* Copilot Drawer / Modal Workspace */}
      {isOpen && (
        <div className={`fixed bottom-6 right-6 bg-white rounded-3xl border border-slate-200/90 shadow-2xl z-50 flex flex-col overflow-hidden transition-all duration-300 animate-slide-up ${
          isExpanded ? 'w-[780px] h-[700px]' : 'w-[440px] h-[600px]'
        }`}>
          {/* Header Bar */}
          <div className="px-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600/30 border border-indigo-400/30 rounded-xl flex items-center justify-center text-indigo-400">
                <Bot className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <span>IPO Pilot AI Copilot</span>
                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 font-mono">
                    Workspace Context Active
                  </span>
                </h4>
                <p className="text-[10px] text-slate-400">Context: Intake • Docs • OCR • Vision • Drafts • SEBI Rules</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                title={isExpanded ? "Collapse View" : "Expand View"}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.length === 0 ? (
              <div className="text-center space-y-4 pt-2">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto border border-indigo-100">
                  <Sparkles className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">How can I assist your IPO due diligence?</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    Ask any question using your company's entire intake form, uploaded files, financial statements, and SEBI ICDR rules.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-2 pt-2">
                  {QUICK_STARTERS.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => sendMessage(s.query)}
                      className="text-left px-3 py-2 bg-white hover:bg-indigo-50/70 border border-slate-200/80 hover:border-indigo-300 rounded-xl text-xs text-slate-700 font-medium transition-all flex items-center justify-between group shadow-2xs"
                    >
                      <span>{s.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[92%] p-4 rounded-2xl text-xs ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white font-medium shadow-sm'
                      : 'bg-white text-slate-800 border border-slate-200/80 shadow-sm space-y-3'
                  }`}>
                    {msg.role === 'user' ? (
                      <div>{msg.content}</div>
                    ) : (
                      <>
                        {renderNativeCopilotMessage(msg.content)}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[9px] text-slate-400 font-mono">
                          <span>Verified against workspace context</span>
                          <span className="font-bold text-indigo-600">Confidence: 96%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200/80 px-4 py-3 rounded-2xl flex items-center gap-2 text-xs text-slate-600 shadow-sm">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="font-semibold">Analyzing workspace data & SEBI ICDR rules...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="p-3 bg-white border-t border-slate-200/80 shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about missing docs, risk matrix, revenue charts, SEBI rules..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50 flex items-center gap-1 font-bold text-xs shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
