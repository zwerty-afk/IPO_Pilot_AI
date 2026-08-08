import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DraftCanvas from '../components/DraftCanvas';
import { useDraftDocument, filterMeaningfulAuditLogs } from '../context/DraftDocumentContext';
import StatusBadge from '../components/StatusBadge';
import { DRHP_HIERARCHY } from '../data/sebiDrhpSchema';
import { 
  ShieldCheck, 
  Lock, 
  HelpCircle, 
  MessageSquare, 
  Send, 
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  FileText,
  Building2,
  Bookmark,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  Eye,
  Check,
  XCircle,
  Clock,
  Sparkles,
  Layers,
  Search,
  Filter,
  UserCheck,
  History,
  FileCheck2,
  Calendar,
  AlertCircle,
  Plus,
  ArrowRight,
  User,
  ShieldAlert,
  X
} from 'lucide-react';

function cleanChapterTitle(title) {
  if (!title) return 'General';
  const clean = title
    .replace(/^SECTION\s+[I|V|X]+\s*[-–—]\s*/i, '')
    .replace(/^SECTION\s+\d+\s*[-–—]\s*/i, '')
    .trim();

  const titleMap = {
    'GENERAL': 'General',
    'RISK FACTORS': 'Risk Factors',
    'INTRODUCTION': 'Introduction',
    'PARTICULARS OF THE OFFER': 'Particulars of the Offer',
    'ABOUT OUR COMPANY': 'About Our Company',
    'FINANCIAL INFORMATION': 'Financial Information',
    'LEGAL AND OTHER INFORMATION': 'Legal and Other Information',
    'OFFER RELATED INFORMATION': 'Offer Related Information',
    'DESCRIPTION OF EQUITY SHARES': 'Description of Equity Shares',
    'OTHER INFORMATION': 'Other Information'
  };

  return titleMap[clean.toUpperCase()] || (clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase());
}

export default function ReviewerWorkspace() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isReviewer = user?.role === 'reviewer';

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
    updateSectionStatus,
    postComment,
    resolveCommentById
  } = useDraftDocument();

  // Active View Mode: 'reviewer' vs 'assigned_to_me' (Issuer Action View)
  const [workspaceMode, setWorkspaceMode] = useState('reviewer'); // 'reviewer' | 'assigned_to_me'

  // Right Panel Tabs: 'issues', 'comments', 'evidence', 'history'
  const [activeRightTab, setActiveRightTab] = useState('issues');
  const [expandedSectionId, setExpandedSectionId] = useState('general');

  // New Comment Form State
  const [newCommentText, setNewCommentText] = useState('');
  const [commentType, setCommentType] = useState('clarification_requested');
  const [updating, setUpdating] = useState(false);
  const [expandedDiffIds, setExpandedDiffIds] = useState({});
  const toggleDiffExpand = (id) => setExpandedDiffIds(prev => ({ ...prev, [id]: !prev[id] }));

  // Raise Issue Modal State
  const [showRaiseIssueModal, setShowRaiseIssueModal] = useState(false);
  const [issueSubTarget, setIssueSubTarget] = useState(null);
  const [issueForm, setIssueForm] = useState({
    title: '',
    priority: 'High',
    description: '',
    reason: '',
    recommendation: '',
    assignedTo: 'Issuer / Legal Counsel',
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  });

  // STRUCTURED ISSUES ENGINE DATA
  const [issuesList, setIssuesList] = useState([
    {
      id: 'ISSUE-001',
      title: 'Restated Financial Revenue Data Discrepancy',
      priority: 'Critical',
      description: 'FY24 restated revenue figure stated as ₹95 Cr in intake narrative but statutory audit PDF records ₹92.4 Cr.',
      reason: 'SEBI ICDR Regulations 2018 Schedule VI Part A Item (11) mandates 100% exact alignment between restated accounts and DRHP tables.',
      recommendation: 'Reconcile FY24 revenue figure with Statutory Auditor and update financial disclosure intake field.',
      assignedTo: 'Statutory Auditor',
      dueDate: '2026-08-10',
      status: 'Open',
      affectedChapter: 'Section VI: Financial Information',
      affectedSubId: 'restated_financial_information',
      supportingEvidence: 'Intake: Financials: fy24_revenue vs Audit_Report_FY24.pdf',
      createdAt: '2026-08-07 14:00 UTC'
    },
    {
      id: 'ISSUE-002',
      title: 'Missing Board Resolution for Equity Issue Approval',
      priority: 'Critical',
      description: 'Certified extract of Board of Directors resolution approving the IPO issue and Lead Banker appointment is missing.',
      reason: 'Companies Act 2013 Section 179(3) and SEBI ICDR Regulation 26(1) require board authorization before DRHP submission.',
      recommendation: 'Upload certified copy of Board Resolution passed on or after Jan 1, 2025.',
      assignedTo: 'Issuer / Legal Counsel',
      dueDate: '2026-08-09',
      status: 'Open',
      affectedChapter: 'Section I: General',
      affectedSubId: 'general_information',
      supportingEvidence: 'Document Upload: board_resolution (Missing)',
      createdAt: '2026-08-07 14:15 UTC'
    },
    {
      id: 'ISSUE-003',
      title: 'Incomplete Outstanding Litigation & Tax Demand Disclosure',
      priority: 'High',
      description: 'Pending GST demand notice of ₹45 Lakhs not disclosed in Legal & Other Information chapter.',
      reason: 'SEBI ICDR Schedule VI Part A Section VII mandates full disclosure of all tax proceedings exceeding 1% of net worth.',
      recommendation: 'Complete litigation disclosure intake form and attach GST demand order.',
      assignedTo: 'Issuer / Legal Counsel',
      dueDate: '2026-08-11',
      status: 'In Progress',
      affectedChapter: 'Section VII: Legal and Other Information',
      affectedSubId: 'outstanding_litigation',
      supportingEvidence: 'Intake: Litigation: tax_demands',
      createdAt: '2026-08-07 14:30 UTC'
    }
  ]);

  const currentSection = drafts[selectedSectionKey] || { status: 'draft' };

  // Status Decision Handler
  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      await updateSectionStatus(newStatus);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePostCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    try {
      await postComment(newCommentText, commentType);
      setNewCommentText('');
    } catch (err) {
      console.error("Failed to post comment:", err);
    }
  };

  const handleRaiseIssueSubmit = (e) => {
    e.preventDefault();
    if (!issueForm.title.trim()) return;

    const newIssue = {
      id: `ISSUE-00${issuesList.length + 1}`,
      title: issueForm.title,
      priority: issueForm.priority,
      description: issueForm.description,
      reason: issueForm.reason,
      recommendation: issueForm.recommendation,
      assignedTo: issueForm.assignedTo,
      dueDate: issueForm.dueDate,
      status: 'Open',
      affectedChapter: activeNode.fullTitle,
      affectedSubId: issueSubTarget || activeTocId,
      supportingEvidence: `Intake: ${selectedSectionKey}`,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC'
    };

    setIssuesList(prev => [newIssue, ...prev]);
    setShowRaiseIssueModal(false);
    setIssueForm({
      title: '',
      priority: 'High',
      description: '',
      reason: '',
      recommendation: '',
      assignedTo: 'Issuer / Legal Counsel',
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
    });
  };

  const handleResolveIssue = (issueId) => {
    setIssuesList(prev => prev.map(iss => iss.id === issueId ? { ...iss, status: 'Resolved' } : iss));
  };

  const handleTocParentClick = (sec) => {
    setExpandedSectionId(sec.id);
    const targetId = (sec.subsections && sec.subsections.length > 0) ? sec.subsections[0].id : sec.id;
    setActiveTocId(targetId);
  };

  const handleTocSubClick = (subId, e) => {
    e.stopPropagation();
    setActiveTocId(subId);
  };

  const openIssuesForChapter = issuesList.filter(i => i.status !== 'Closed');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 font-sans">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading Legal Review & Certification Engine...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* CHAPTER AUDIT DECISION BOARD (TOP CHAPTER REVIEW SUMMARY) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Active DRHP Chapter Review
              </span>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white shadow-xs ml-2">
                Reviewer Workspace
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-bold text-slate-900">
                {isCoverPages ? 'Pages 1–3: Front Matter' : cleanChapterTitle(activeNode.section?.title)}
              </h2>
              <StatusBadge status={currentSection.status || 'draft'} />

              {/* Lock Chapter Icon Button (Reviewer) or Read-Only Badge (Issuer) */}
              {isReviewer ? (
                <button
                  onClick={() => handleStatusUpdate('under_review')}
                  disabled={updating}
                  title="Lock Chapter"
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 rounded-lg text-[11px] transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span>Lock</span>
                </button>
              ) : (
                <span className="px-2 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-mono flex items-center gap-1">
                  <Lock className="w-3 h-3 text-slate-400" /> Read-Only View (Issuer)
                </span>
              )}
            </div>

            {currentSection.certified_by && (
              <span className="text-[10px] text-slate-400 font-mono block">
                Certified by {currentSection.certified_by} at {new Date(currentSection.certified_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* OVERALL CHAPTER SUMMARY METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="p-1.5 bg-indigo-100/70 text-indigo-700 rounded-lg shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Open Comments</span>
              <span className="text-sm font-bold text-slate-900">{comments.length}</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100/70 text-amber-700 rounded-lg shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Open Issues</span>
              <span className="text-sm font-bold text-slate-900">{openIssuesForChapter.length}</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="p-1.5 bg-purple-100/70 text-purple-700 rounded-lg shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">AI Findings</span>
              <span className="text-sm font-bold text-slate-900">{gapReport?.gaps?.length || 1}</span>
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-100/70 text-emerald-700 rounded-lg shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Last Reviewed</span>
              <span className="text-xs font-bold text-slate-800">Today • 10:42 AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* ISSUER "ASSIGNED TO ME" ACTION VIEW */}
      {workspaceMode === 'assigned_to_me' ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900">Issuer Issue Resolution Dashboard</h2>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
              {openIssuesForChapter.length} Open Findings Assigned to Issuer
            </span>
          </div>

          <div className="space-y-4">
            {openIssuesForChapter.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic">
                No open legal issues assigned to your team.
              </div>
            ) : (
              openIssuesForChapter.map((iss) => (
                <div key={iss.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-700">{iss.id}</span>
                      <h3 className="font-bold text-slate-900 text-sm">{iss.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        iss.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                      }`}>
                        {iss.priority}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-400">Due: {iss.dueDate}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-bold">{iss.status}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed font-sans">{iss.description}</p>

                  <div className="p-3 bg-amber-50/80 border border-amber-200/70 rounded-xl text-xs space-y-1">
                    <span className="font-mono font-bold text-[10px] uppercase text-amber-900 block">Recommended Resolution:</span>
                    <p className="text-slate-800 font-medium">{iss.recommendation}</p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 flex-wrap gap-2 text-xs">
                    <span className="font-mono text-slate-500 text-[11px]">Affected Chapter: <strong>{iss.affectedChapter}</strong></span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate('/intake')}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Go to Source</span>
                      </button>

                      <button
                        onClick={() => handleResolveIssue(iss.id)}
                        className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Mark Resolved & Ready for Review</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* MAIN 3-COLUMN REVIEW WORKSPACE GRID */
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          {/* COLUMN 1: LEFT NAV — DRHP TABLE OF CONTENTS */}
          <div className="xl:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm h-fit space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> DRHP Table of Contents
              </span>
            </div>

            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
              <button
                onClick={() => setActiveTocId('cover_pages')}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-semibold transition-all ${
                  activeTocId === 'cover_pages' || activeTocId === 'draft_preview'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="truncate">Pages 1–3: Front Matter</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-white font-mono">0.0</span>
              </button>

              {DRHP_HIERARCHY.map((sec, secIdx) => {
                const isExpanded = expandedSectionId === sec.id;
                const chapterDraft = drafts[sec.key] || { status: 'draft' };
                const hasActiveSub = sec.subsections.some(sub => sub.id === activeTocId);
                const displayTitle = cleanChapterTitle(sec.title);

                return (
                  <div key={sec.id} className="space-y-1">
                    <button
                      onClick={() => handleTocParentClick(sec)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-xs font-bold transition-all ${
                        hasActiveSub || (activeNode.section.id === sec.id)
                          ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80'
                          : 'text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-indigo-600 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        <span className="truncate">{displayTitle}</span>
                      </div>
                      <StatusBadge status={chapterDraft.status || 'draft'} className="scale-75 shrink-0" />
                    </button>

                    {isExpanded && sec.subsections && sec.subsections.length > 0 && (
                      <div className="pl-6 space-y-1 border-l-2 border-slate-100 ml-3">
                        {sec.subsections.map((sub, subIdx) => {
                          const isSubActive = activeTocId === sub.id;
                          const subNumber = `${secIdx + 1}.${subIdx + 1}`;
                          const cleanSubTitle = (sub.title || '').replace(/^\d+(\.\d+)*\s*/, '').trim();
                          return (
                            <button
                              key={sub.id}
                              onClick={(e) => handleTocSubClick(sub.id, e)}
                              className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-[11px] font-medium transition-all ${
                                isSubActive
                                  ? 'bg-indigo-600 text-white font-bold shadow-sm'
                                  : 'text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate">{subNumber} {cleanSubTitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* COLUMN 2: CENTER CANVAS — SINGLE SOURCE OF TRUTH DRAFT PROSPECTUS (WITHOUT DRAFT TOOLBAR) */}
          <div className="xl:col-span-2">
            <DraftCanvas showToolbar={false} mode="chapter" />
          </div>

          {/* COLUMN 3: RIGHT PANEL — 4 TABBED WORKSPACES (ISSUES, COMMENTS, EVIDENCE, HISTORY) */}
          <div className="xl:col-span-1 space-y-4">
            
            {/* Tab Selector Header */}
            <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-1 font-sans text-xs">
              <button
                onClick={() => setActiveRightTab('issues')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center cursor-pointer ${
                  activeRightTab === 'issues' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Issues ({issuesList.filter(i => i.status !== 'Closed').length})
              </button>

              <button
                onClick={() => setActiveRightTab('comments')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center cursor-pointer ${
                  activeRightTab === 'comments' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Comments ({comments.length})
              </button>

              <button
                onClick={() => setActiveRightTab('evidence')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center cursor-pointer ${
                  activeRightTab === 'evidence' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Evidence
              </button>

              <button
                onClick={() => setActiveRightTab('history')}
                className={`flex-1 py-1.5 rounded-xl font-bold transition-all text-center cursor-pointer ${
                  activeRightTab === 'history' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                History
              </button>
            </div>

            {/* TAB 1: STRUCTURED ISSUES ENGINE */}
            {activeRightTab === 'issues' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Open Findings ({issuesList.filter(i => i.status !== 'Closed').length})
                  </span>
                  <button
                    onClick={() => setShowRaiseIssueModal(true)}
                    className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Raise Issue
                  </button>
                </div>

                <div className="space-y-3">
                  {issuesList.map((iss) => (
                    <div
                      key={iss.id}
                      className={`p-3.5 rounded-xl border space-y-2 text-xs transition-all ${
                        iss.priority === 'Critical'
                          ? 'bg-red-50/70 border-red-200 text-red-950'
                          : 'bg-amber-50/70 border-amber-200 text-amber-950'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-[10px] text-indigo-700">{iss.id}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase font-mono ${
                          iss.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {iss.priority}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-xs leading-snug">{iss.title}</h4>
                      <p className="text-[11px] text-slate-600 line-clamp-2">{iss.description}</p>

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-[10px] font-mono text-slate-500">
                        <span>Assigned: {iss.assignedTo}</span>
                        <span className="font-bold text-indigo-600">{iss.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: REVIEWER COMMENTS */}
            {activeRightTab === 'comments' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" /> Chapter Comments ({comments.length})
                  </span>
                </div>

                <form onSubmit={handlePostCommentSubmit} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={commentType}
                      onChange={(e) => setCommentType(e.target.value)}
                      className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                    >
                      <option value="clarification_requested">Clarification</option>
                      <option value="legal_risk">Legal Risk</option>
                      <option value="note">Internal Note</option>
                    </select>
                  </div>
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Add reviewer annotation or observation..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-indigo-500 min-h-[70px]"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Send className="w-3 h-3" /> Post Comment
                  </button>
                </form>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {comments.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">No comments for this section yet.</p>
                  ) : (
                    comments.map((comm) => (
                      <div key={comm.id || comm._id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span className="font-bold text-slate-700">{comm.author || 'Reviewer'}</span>
                          <span>{comm.created_at ? new Date(comm.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                        </div>
                        <p className="text-slate-800 font-sans leading-snug">{comm.content}</p>
                        {comm.status !== 'resolved' && (
                          <button
                            onClick={() => resolveCommentById(comm.id || comm._id)}
                            className="text-[10px] text-emerald-600 font-bold hover:underline block pt-1"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: EVIDENCE */}
            {activeRightTab === 'evidence' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans max-h-[70vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5 text-slate-800" /> Evidence & Grounding Documents
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  {docsCache.length === 0 ? (
                    <p className="text-slate-400 italic text-center py-4">No statutory documents linked.</p>
                  ) : (
                    docsCache.map((doc, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 truncate">{doc.name}</span>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Verified
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono block capitalize">{doc.doc_type?.replace(/_/g, ' ')}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: FULLY TRACEABLE VERSION HISTORY & AUDIT TRAIL */}
            {activeRightTab === 'history' && (() => {
              const cleanLogs = filterMeaningfulAuditLogs(auditLogs);
              return (
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <History className="w-4 h-4 text-indigo-600" /> Traceable Version History & Audit Trail
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {cleanLogs.length} Meaningful Events
                    </span>
                  </div>

                  <div className="space-y-3">
                    {cleanLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center py-4">No audit logs recorded yet.</p>
                    ) : (
                      cleanLogs.map((log, idx) => {
                        const logId = log.id || `LOG-${idx}`;
                        const isDiffExpanded = !!expandedDiffIds[logId];
                        const actionType = log.actionType || log.action_type || 'Edit';
                        const source = log.source || (log.actor?.includes('Issuer') ? 'Issuer' : log.actor?.includes('Reviewer') || log.actor?.includes('Banker') ? 'Reviewer' : log.actor?.includes('AI') ? 'AI Co-Pilot' : 'System');
                        
                        const actionBadgeColor = {
                          'Certification': 'bg-emerald-100 text-emerald-800 border-emerald-300',
                          'Approval': 'bg-emerald-50 text-emerald-700 border-emerald-200',
                          'Rejection': 'bg-red-50 text-red-700 border-red-200',
                          'Edit': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          'Comment': 'bg-purple-50 text-purple-700 border-purple-200',
                          'Suggestion': 'bg-amber-50 text-amber-800 border-amber-200',
                          'Lock': 'bg-slate-100 text-slate-700 border-slate-300',
                          'Intake Update': 'bg-blue-50 text-blue-700 border-blue-200'
                        }[actionType] || 'bg-slate-100 text-slate-700 border-slate-200';

                        const sourceBadgeColor = {
                          'Issuer': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                          'Reviewer': 'bg-emerald-50 text-emerald-800 border-emerald-200',
                          'AI Co-Pilot': 'bg-amber-50 text-amber-900 border-amber-200',
                          'System': 'bg-slate-100 text-slate-700 border-slate-200'
                        }[source] || 'bg-slate-100 text-slate-600 border-slate-200';

                        return (
                          <div key={logId} className="p-3.5 bg-slate-50 border border-slate-200/90 rounded-xl space-y-2 text-xs transition-all hover:border-indigo-300">
                            {/* Header: Actor, Timestamp & Badges */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded border ${actionBadgeColor}`}>
                                  {actionType}
                                </span>
                                <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${sourceBadgeColor}`}>
                                  {source}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {log.timestamp || log.created_at || 'Recent'}
                              </span>
                            </div>

                            {/* Actor / Who Made It */}
                            <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 font-sans">
                              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{log.actor || log.user || 'System'}</span>
                            </div>

                            {/* Affected Target / Chapter */}
                            <div className="text-[10px] font-mono text-slate-500">
                              Target: <strong className="text-slate-700">{log.affectedTarget || log.detail || log.event}</strong>
                            </div>

                            {/* Action Summary */}
                            <p className="text-xs text-slate-700 font-sans leading-snug">{log.actionSummary || log.action || log.description}</p>

                            {/* Content Delta / Previous vs Updated Expandable Diff */}
                            {(log.prevContent || log.newContent) && (
                              <div className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-1.5 font-mono text-[10px] mt-1">
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px]">Content Delta / Comparison</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleDiffExpand(logId)}
                                    className="text-[9px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                  >
                                    {isDiffExpanded ? 'Collapse Diff' : 'Expand Diff'}
                                  </button>
                                </div>

                                {log.prevContent && (
                                  <div className={`text-red-700 bg-red-50/70 p-1.5 rounded border border-red-100 font-mono leading-relaxed ${isDiffExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                                    <span className="font-bold mr-1">- Previous:</span> {log.prevContent}
                                  </div>
                                )}
                                {log.newContent && (
                                  <div className={`text-emerald-700 bg-emerald-50/70 p-1.5 rounded border border-emerald-100 font-mono leading-relaxed ${isDiffExpanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
                                    <span className="font-bold mr-1">+ Updated:</span> {log.newContent}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* PERMANENT REVIEW ACTIONS SECTION AT BOTTOM OF RIGHT SIDEBAR */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" /> {isReviewer ? 'Review Actions' : 'Reviewer Decisions'}
                </span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${isReviewer ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                  {isReviewer ? 'Reviewer Controls' : '🔒 Read-Only (Issuer)'}
                </span>
              </div>

              {/* Primary Actions: Approve, Request Changes, Reject */}
              <div className="space-y-2">
                <button
                  onClick={() => isReviewer && handleStatusUpdate('approved')}
                  disabled={!isReviewer || updating}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    currentSection.status === 'approved'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : isReviewer
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Approve Chapter</span>
                </button>

                <button
                  onClick={() => isReviewer && handleStatusUpdate('changes_requested')}
                  disabled={!isReviewer || updating}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    currentSection.status === 'changes_requested'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : isReviewer
                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                  }`}
                >
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Request Changes</span>
                </button>

                <button
                  onClick={() => isReviewer && handleStatusUpdate('rejected')}
                  disabled={!isReviewer || updating}
                  className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                    currentSection.status === 'rejected'
                      ? 'bg-red-600 text-white shadow-sm'
                      : isReviewer
                      ? 'bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 cursor-pointer'
                      : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed opacity-70'
                  }`}
                >
                  <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Reject Chapter</span>
                </button>
              </div>

              {/* Visual Separator */}
              <div className="pt-3 border-t border-slate-200 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                  Final Step
                </span>
                {/* Final Step: Certify Chapter */}
                <button
                  onClick={() => isReviewer && handleStatusUpdate('certified')}
                  disabled={!isReviewer || updating || (currentSection.status !== 'approved' && currentSection.status !== 'certified')}
                  className={`w-full py-3 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-sm ${
                    currentSection.status === 'certified'
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400 cursor-default'
                      : isReviewer && currentSection.status === 'approved'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/20'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Certify Chapter</span>
                </button>

                {isReviewer ? (
                  currentSection.status !== 'approved' && currentSection.status !== 'certified' && (
                    <p className="text-[10px] text-slate-400 text-center font-sans italic">
                      Approve chapter first to enable final certification.
                    </p>
                  )
                ) : (
                  <p className="text-[10px] text-slate-500 text-center font-sans italic leading-relaxed pt-1">
                    Read-Only Access: Approval, rejection, and certification decisions are reserved for Merchant Banker / Legal Counsel.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RAISE STRUCTURED ISSUE MODAL */}
      {showRaiseIssueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white max-w-lg w-full rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-base">Raise Structured Legal Finding</h3>
              </div>
              <button onClick={() => setShowRaiseIssueModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRaiseIssueSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Finding Title</label>
                <input
                  type="text"
                  required
                  value={issueForm.title}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Revenue Discrepancy between restated financial narrative and statutory audit report"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Priority Level</label>
                  <select
                    value={issueForm.priority}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-bold"
                  >
                    <option value="Critical">Critical Severity</option>
                    <option value="High">High Severity</option>
                    <option value="Medium">Medium Severity</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 block">Assigned Entity</label>
                  <select
                    value={issueForm.assignedTo}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, assignedTo: e.target.value }))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  >
                    <option value="Issuer / Legal Counsel">Issuer / Legal Counsel</option>
                    <option value="Statutory Auditor">Statutory Auditor</option>
                    <option value="Lead Manager">Lead Manager</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Detailed Finding Description</label>
                <textarea
                  rows="3"
                  value={issueForm.description}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detail exact statutory mismatch, missing evidence document, or numeric variation..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 block">Recommended Action</label>
                <input
                  type="text"
                  value={issueForm.recommendation}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, recommendation: e.target.value }))}
                  placeholder="e.g. Reconcile restated financial accounts with auditor certificate"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRaiseIssueModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs shadow-sm"
                >
                  Raise Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
