import { useState, useEffect } from 'react';
import { getDrafts, generateDrafts, getComments, addComment, resolveComment, getIntake, getDocuments } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ConfidenceBadge from '../components/ConfidenceBadge';
import StatusBadge from '../components/StatusBadge';
import { 
  FileText, 
  RefreshCw, 
  MessageSquare, 
  ChevronRight, 
  Bookmark, 
  Send,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Loader2
} from 'lucide-react';

const sectionMapping = {
  business_overview: "Business Overview",
  risk_factors: "Risk Factors",
  objects: "Objects of the Issue",
  capital_structure: "Capital Structure",
  related_party: "Related Party Transactions",
  litigation: "Litigation & Legal Proceedings",
  promoter_details: "Promoter & Management Details"
};

export default function DraftPreview() {
  const { user } = useAuth();
  const [drafts, setDrafts] = useState({});
  const [selectedSectionKey, setSelectedSectionKey] = useState('business_overview');
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [citationModal, setCitationModal] = useState(null);
  
  // Cache data sources for citation popup mapping
  const [intakeCache, setIntakeCache] = useState({});
  const [docsCache, setDocsCache] = useState([]);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadDraftData = async (refreshCommentsOnly = false) => {
    try {
      if (!refreshCommentsOnly) setLoading(true);
      
      const draftRes = await getDrafts(companyId);
      setDrafts(draftRes.data || draftRes || {});

      const commRes = await getComments(selectedSectionKey);
      setComments(commRes.data || commRes || []);

      // Load reference data for citation tooltips if not loaded
      if (!refreshCommentsOnly) {
        const intakeRes = await getIntake(companyId);
        setIntakeCache(intakeRes.data || intakeRes || {});
        const docsRes = await getDocuments(companyId);
        setDocsCache(docsRes.data || docsRes || []);
      }
    } catch (err) {
      console.error("Error loading draft preview:", err);
    } finally {
      if (!refreshCommentsOnly) setLoading(false);
    }
  };

  useEffect(() => {
    loadDraftData();
  }, [companyId, selectedSectionKey]);

  const handleRegenerate = async () => {
    try {
      setGenerating(true);
      await generateDrafts(companyId, selectedSectionKey);
      await loadDraftData();
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setGenerating(false);
    }
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

  // Helper to map citation key to underlying data value
  const handleCitationClick = (citation) => {
    let source = "Unknown Source";
    let value = "Data not found";

    if (citation.startsWith("Intake:")) {
      const parts = citation.split(": ");
      const category = parts[1]?.toLowerCase().replace(/ /g, '_');
      const field = parts[2];
      
      source = `Promoter Intake Questionnaire: ${parts[1]} — ${field}`;
      if (intakeCache[category] && intakeCache[category][field]) {
        value = intakeCache[category][field];
        if (field.includes('revenue') || field.includes('amount') || field.includes('profit')) {
          value = `${Number(value).toLocaleString('en-IN')} INR`;
        }
      }
    } else if (citation.startsWith("Document:")) {
      const docName = citation.replace("Document: ", "");
      const doc = docsCache.find(d => d.name === docName);
      source = `OCR Extracted Source Document: ${docName}`;
      if (doc) {
        value = JSON.stringify(doc.extracted_values, null, 2);
      } else {
        value = "Document verified on file.";
      }
    } else {
      source = citation;
      value = "Verified reference link.";
    }

    setCitationModal({ source, value, raw: citation });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const currentSection = drafts[selectedSectionKey] || { status: 'draft', blocks: [] };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-8 animate-fade-in relative">
      
      {/* Citation Details Modal Popup */}
      {citationModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-lg w-full animate-slide-up">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5 border-b pb-3 mb-4">
              <Bookmark className="w-4.5 h-4.5 text-indigo-500" />
              <span>AI Grounding Citation Source</span>
            </h4>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Location</p>
                <p className="text-xs text-slate-800 font-semibold">{citationModal.source}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Source Confirmed Value</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mt-1">
                  <pre className="text-xs text-slate-700 font-mono whitespace-pre-wrap leading-normal">
                    {citationModal.value}
                  </pre>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setCitationModal(null)}
              className="mt-6 w-full btn-secondary text-xs py-2 rounded-xl"
            >
              Close Citation View
            </button>
          </div>
        </div>
      )}

      {/* Chapters Sidebar (Left/Top) */}
      <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-2">
        <h3 className="font-bold text-slate-800 text-sm px-3 mb-4 uppercase tracking-wider">Chapters</h3>
        <div className="space-y-1">
          {Object.keys(sectionMapping).map((key) => {
            const isActive = key === selectedSectionKey;
            const status = drafts[key]?.status || 'draft';
            return (
              <button
                key={key}
                onClick={() => setSelectedSectionKey(key)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all duration-200 ${isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/10' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <span className="truncate pr-2">{sectionMapping[key]}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${status === 'certified' ? 'bg-emerald-500' : status === 'clarification_requested' ? 'bg-amber-500' : 'bg-indigo-400'}`}></span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Draft Document Workspace (Center) */}
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm min-h-[500px] flex flex-col justify-between relative overflow-hidden">
          
          {/* Watermark Overlay for Uncertified chapters */}
          {currentSection.status !== 'certified' && (
            <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden opacity-[0.03] z-0">
              <div className="text-[2.8rem] font-extrabold uppercase -rotate-[30deg] tracking-widest text-red-600 whitespace-nowrap">
                DRAFT — PENDING PROFESSIONAL REVIEW
              </div>
            </div>
          )}

          <div className="z-10 space-y-6">
            <div className="flex items-center justify-between border-b pb-4 mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{sectionMapping[selectedSectionKey]}</h2>
                <p className="text-slate-400 text-[10px] mt-0.5 font-mono">Last Synthesized: {new Date(currentSection.last_updated).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={currentSection.status} />
                <button 
                  onClick={handleRegenerate} 
                  disabled={generating}
                  className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-all rounded-lg border border-slate-200 shadow-sm"
                  title="Re-run AI draft generation"
                >
                  <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Generated Blocks */}
            <div className="space-y-6">
              {currentSection.blocks.map((block) => {
                const isLow = block.confidence === 'low';
                const isMed = block.confidence === 'medium';
                return (
                  <div 
                    key={block.id} 
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${isLow ? 'bg-red-50/30 border-l-4 border-l-red-500 border-red-200' : isMed ? 'bg-amber-50/30 border-l-4 border-l-amber-500 border-amber-200' : 'bg-slate-50/50 border-l-4 border-l-indigo-500 border-slate-200/80'}`}
                  >
                    <p className="text-slate-800 text-sm leading-relaxed">{block.text}</p>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[11px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider">Citations:</span>
                        {block.citations.map((cite, cidx) => (
                          <button
                            key={cidx}
                            onClick={() => handleCitationClick(cite)}
                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium transition-colors border border-indigo-200/20"
                          >
                            <Bookmark className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="max-w-[150px] truncate">{cite.split(': ').pop()}</span>
                          </button>
                        ))}
                      </div>
                      <ConfidenceBadge level={block.confidence} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center italic z-10">
            AI-generated blocks carry confidence labels. Verify sources by clicking on citation links.
          </div>
        </div>
      </div>

      {/* Reviewer Comments Sidebar (Right) */}
      <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-4 flex flex-col">
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          <span>Comments Sidebar</span>
        </h3>

        {/* Comment list */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {comments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">No comments on this chapter.</div>
          ) : (
            comments.map((comm) => (
              <div 
                key={comm.id} 
                className={`p-3 rounded-xl border space-y-2 text-xs ${comm.status === 'resolved' ? 'bg-slate-50/50 border-slate-200 opacity-60' : comm.type === 'clarification_requested' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50/50 border-indigo-100'}`}
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

        {/* Add Comment Box */}
        <form onSubmit={handleAddComment} className="border-t border-slate-100 pt-4 mt-2">
          <div className="relative">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder="Leave response or note..."
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

    </div>
  );
}
