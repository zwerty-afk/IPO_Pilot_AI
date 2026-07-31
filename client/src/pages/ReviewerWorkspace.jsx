import { useState, useEffect } from 'react';
import { getDrafts, updateDraftStatus, getComments, addComment, resolveComment } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import ConfidenceBadge from '../components/ConfidenceBadge';
import { 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  MessageSquare, 
  Send, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileText
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

export default function ReviewerWorkspace() {
  const [drafts, setDrafts] = useState({});
  const [selectedSectionKey, setSelectedSectionKey] = useState('business_overview');
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentType, setCommentType] = useState('clarification_requested');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadReviewData = async () => {
    try {
      setLoading(true);
      const draftRes = await getDrafts(companyId);
      setDrafts(draftRes.data || draftRes || {});

      const commRes = await getComments(selectedSectionKey);
      setComments(commRes.data || commRes || []);
    } catch (err) {
      console.error("Error loading reviewer workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviewData();
  }, [companyId, selectedSectionKey]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await updateDraftStatus(companyId, selectedSectionKey, { status: newStatus, role: 'reviewer' });
      
      // If clarification requested, automatically log comment if typed
      if (newStatus === 'clarification_requested' && newCommentText.trim()) {
        await addComment(selectedSectionKey, newCommentText, 'clarification_requested');
        setNewCommentText('');
      }

      await loadReviewData();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      const res = await addComment(selectedSectionKey, newCommentText, commentType);
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
      console.error("Failed to resolve:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const currentSection = drafts[selectedSectionKey] || { status: 'draft', blocks: [] };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-slate-200 pb-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Reviewer Verification Workspace</h2>
          <p className="text-slate-500 text-sm mt-1">
            Banker / Legal Auditor panel: Inspect chapters, flag clarifications, lock edits, and issue SEBI ICDR certifications.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2 rounded-xl text-xs font-semibold h-fit">
          <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
          <span>Active Role: Registered Merchant Banker</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        
        {/* Navigation Sidebar (Left/Top) */}
        <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-2">
          <h3 className="font-bold text-slate-800 text-sm px-3 mb-4 uppercase tracking-wider">Chapters for Review</h3>
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
                  <StatusBadge status={status} className="scale-90" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Central Inspection & Actions Workspace */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            
            {/* Audit Status Action Board */}
            <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audit Decision Board</p>
                <div className="flex items-center gap-2 mt-1">
                  <h4 className="font-bold text-slate-800 text-sm">{sectionMapping[selectedSectionKey]}</h4>
                  <StatusBadge status={currentSection.status} />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleStatusUpdate('clarification_requested')}
                  disabled={updating}
                  className="px-3.5 py-2 border border-amber-200 hover:bg-amber-50 text-amber-700 font-bold text-xs rounded-xl flex items-center gap-1.5 uppercase transition-all"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Clarification
                </button>
                <button 
                  onClick={() => handleStatusUpdate('under_review')}
                  disabled={updating}
                  className="px-3.5 py-2 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 uppercase transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  Lock Chapter
                </button>
                <button 
                  onClick={() => handleStatusUpdate('certified')}
                  disabled={updating}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 uppercase shadow-md shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all"
                >
                  <ShieldCheck className="w-4.5 h-4.5" />
                  Certify Chapter
                </button>
              </div>
            </div>

            {/* Document Draft Inspection */}
            <div className="space-y-4 border-t border-slate-100 pt-6">
              <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                <span>Inspection View</span>
              </h3>
              
              <div className="space-y-4">
                {currentSection.blocks.map((block) => (
                  <div key={block.id} className="p-4 bg-slate-50/50 border border-slate-200/80 rounded-xl space-y-2 relative">
                    <p className="text-slate-700 text-xs leading-relaxed">{block.text}</p>
                    <div className="flex justify-between items-center text-[10px] pt-1">
                      <span className="text-slate-400 font-mono">ID: {block.id} | Citations: {block.citations.join(', ')}</span>
                      <ConfidenceBadge level={block.confidence} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Audit Notes & Communications Panel (Right/Bottom) */}
        <div className="xl:col-span-1 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm h-fit space-y-4">
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider flex items-center gap-1.5">
            <MessageSquare className="w-4.5 h-4.5 text-indigo-500" />
            <span>Audit Findings</span>
          </h3>

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {comments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No audit findings recorded.</div>
            ) : (
              comments.map((comm) => (
                <div 
                  key={comm.id} 
                  className={`p-3 rounded-xl border space-y-2 text-xs ${comm.status === 'resolved' ? 'bg-slate-50/50 border-slate-200 opacity-60' : comm.type === 'clarification_requested' ? 'bg-amber-50 border-amber-200' : 'bg-indigo-50/50 border-indigo-100'}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-slate-800 block">{comm.author}</span>
                      <span className="text-[9px] text-slate-400 font-mono capitalize">{comm.role} • {comm.type.replace(/_/g, ' ')}</span>
                    </div>
                    {comm.status === 'active' && (
                      <button 
                        onClick={() => handleResolve(comm.id)}
                        className="text-[9px] text-emerald-600 hover:text-emerald-800 font-bold"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                  <p className="text-slate-700 leading-normal">{comm.content}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handlePostComment} className="border-t border-slate-100 pt-4 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Comment Type</label>
              <select 
                value={commentType} 
                onChange={(e) => setCommentType(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white outline-none"
              >
                <option value="clarification_requested">Clarification Requested (Yellow Warning)</option>
                <option value="note">Internal Reviewer Note (Indigo Info)</option>
              </select>
            </div>
            
            <div className="relative">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder="Log a finding or request detail..."
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white text-xs outline-none focus:border-indigo-500 resize-none h-20 transition-all"
              />
              <button
                type="submit"
                className="absolute right-2 bottom-3.5 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
