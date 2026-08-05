import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDrafts, generateDrafts, getComments, addComment, resolveComment, getIntake, getDocuments } from '../services/api';
import { parseCitation } from '../data/intakeSchema';
import { useAuth } from '../context/AuthContext';
import ConfidenceBadge from '../components/ConfidenceBadge';
import StatusBadge from '../components/StatusBadge';
import ChapterHealthSidebar, { SECTION_KEYS } from '../components/ChapterHealthSidebar';
import { 
  FileText, 
  RefreshCw, 
  MessageSquare, 
  Bookmark, 
  Send,
  CheckCircle,
  Loader2,
  ArrowRight,
  Download
} from 'lucide-react';

export default function DraftPreview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drafts, setDrafts] = useState({});
  const [selectedSectionKey, setSelectedSectionKey] = useState('business_overview');
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [citationModal, setCitationModal] = useState(null);

  // Check URL search param for deep section navigation from citations or links
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sec = params.get('section') || params.get('chapter');
    if (sec && SECTION_KEYS[sec]) {
      setSelectedSectionKey(sec);
    }
  }, [location.search]);

  // Cache data sources for citation popup mapping and health calculations
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

  const handleCitationClick = (citation) => {
    if (citation.startsWith("Document:")) {
      navigate('/intake');
      return;
    }
    const { stepKey, fieldName } = parseCitation(citation);
    navigate(`/intake?step=${stepKey}&field=${fieldName}`);
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
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-in relative">
      
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

      {/* Chapters Sidebar (Left - Dynamic AI Health Indicators) */}
      <div className="xl:col-span-1">
        <ChapterHealthSidebar
          selectedSectionKey={selectedSectionKey}
          setSelectedSectionKey={setSelectedSectionKey}
          drafts={drafts}
          intakeData={intakeCache}
          documents={docsCache}
        />
      </div>

      {/* Main Workspace (Center - Direct Synthesized DRHP Text Content) */}
      <div className="xl:col-span-2 space-y-4">
        
        {/* Workspace Top Header Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{SECTION_KEYS[selectedSectionKey]}</h2>
            <p className="text-slate-400 text-[10px] font-mono mt-0.5">
              Draft Prospectus • Synthesized DRHP Offer Block • Last Updated: {new Date(currentSection.last_updated || Date.now()).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={currentSection.status} />
            <button 
              onClick={handleRegenerate} 
              disabled={generating}
              className="p-2 text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-slate-100 transition-all rounded-xl border border-slate-200 shadow-sm flex items-center gap-1 text-xs font-semibold"
              title="Re-run AI Synthesis"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Re-analyze</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/export')}
              className="btn-primary text-xs font-bold py-2 px-3 rounded-xl shadow-indigo-600/10 flex items-center gap-1.5 shrink-0"
            >
              <span>Export</span>
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Synthesized DRHP Text Content */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm min-h-[500px] flex flex-col justify-between relative overflow-hidden space-y-6">
          
          {/* Watermark Overlay for Uncertified chapters */}
          {currentSection.status !== 'certified' && (
            <div className="absolute inset-0 pointer-events-none select-none flex items-center justify-center overflow-hidden opacity-[0.03] z-0">
              <div className="text-[2.8rem] font-extrabold uppercase -rotate-[30deg] tracking-widest text-red-600 whitespace-nowrap">
                DRAFT — PENDING PROFESSIONAL REVIEW
              </div>
            </div>
          )}

          <div className="z-10 space-y-6">
            {/* Generated Blocks */}
            {currentSection.blocks && currentSection.blocks.length > 0 ? (
              <div className="space-y-4">
                {currentSection.blocks.map((block) => {
                  const isLow = block.confidence === 'low';
                  const isMed = block.confidence === 'medium';
                  return (
                    <div 
                      key={block.id} 
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                        isLow ? 'bg-red-50/30 border-l-4 border-l-red-500 border-red-200' : 
                        isMed ? 'bg-amber-50/30 border-l-4 border-l-amber-500 border-amber-200' : 
                        'bg-slate-50/50 border-l-4 border-l-indigo-500 border-slate-200/80'
                      }`}
                    >
                      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line font-sans">{block.text}</p>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-black/5 text-[11px]">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-slate-400 font-semibold uppercase tracking-wider">Citations:</span>
                          {block.citations && block.citations.map((cite, cidx) => (
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
            ) : (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  No synthesized text blocks for this chapter yet — complete the relevant Intake Form sections to generate AI prospectus text.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/intake')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
                >
                  <span>Go to Intake Form</span>
                </button>
              </div>
            )}
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
