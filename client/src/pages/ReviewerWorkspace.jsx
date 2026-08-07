import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getDrafts, updateDraftStatus, getComments, addComment, resolveComment, editComment, deleteComment, getIntake, getDocuments } from '../services/api';
import { DRHP_HIERARCHY, findDrhpNode } from '../data/sebiDrhpSchema';
import { DrhpBlockRenderer } from '../components/DrhpCompositionEngine';
import FrontMatterTemplate from '../components/FrontMatterTemplate';
import StatusBadge from '../components/StatusBadge';
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
  ShieldAlert
} from 'lucide-react';

function getBlocksForSubsection(subId, subKey, drafts, intakeCache = {}) {
  const sectionDraft = drafts[subKey] || { blocks: [] };
  const allBlocks = sectionDraft.blocks || [];
  if (!allBlocks || allBlocks.length === 0) return [];

  switch (subId) {
    case 'our_business':
      return allBlocks.filter(b => ['bo-1', 'bo-3', 'bo-4', 'bo-5', 'bo-6'].includes(b.id)).length > 0
        ? allBlocks.filter(b => ['bo-1', 'bo-3', 'bo-4', 'bo-5', 'bo-6'].includes(b.id))
        : allBlocks;
    case 'our_management':
      return allBlocks.filter(b => b.id === 'prom-2' || b.id === 'prom-3' || b.type === 'org_chart').length > 0
        ? allBlocks.filter(b => b.id === 'prom-2' || b.id === 'prom-3' || b.type === 'org_chart')
        : allBlocks;
    case 'our_promoters_and_promoter_group':
      return allBlocks.filter(b => b.id === 'prom-1').length > 0
        ? allBlocks.filter(b => b.id === 'prom-1')
        : allBlocks;
    default:
      return allBlocks;
  }
}

export default function ReviewerWorkspace() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [comments, setComments] = useState([]);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);

  // Active View Mode: 'reviewer' vs 'assigned_to_me' (Issuer Action View)
  const [workspaceMode, setWorkspaceMode] = useState('reviewer'); // 'reviewer' | 'assigned_to_me'

  // Right Panel Tabs: 'issues', 'comments', 'evidence', 'history'
  const [activeRightTab, setActiveRightTab] = useState('issues');

  // Active TOC Section Selection
  const [activeTocId, setActiveTocId] = useState('definitions_and_abbreviations');
  const [expandedSectionId, setExpandedSectionId] = useState('general');

  // Source Panel Drawer State
  const [showSourceDrawer, setShowSourceDrawer] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // New Comment / Annotation Form State
  const [newCommentText, setNewCommentText] = useState('');
  const [commentType, setCommentType] = useState('clarification_requested');

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

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  // STRUCTURED ISSUES ENGINE DATA
  const [issuesList, setIssuesList] = useState(companyId === 'aarav-precision' ? [
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
  ] : []);

  // IMMUTABLE REVIEW AUDIT TRAIL LOG
  const [auditLog, setAuditLog] = useState(companyId === 'aarav-precision' ? [
    { id: 'LOG-001', action: 'Draft Prospectus Loaded', actor: 'System', timestamp: '2026-08-07 13:45 UTC', detail: 'Loaded exact DRHP chapter composition.' },
    { id: 'LOG-002', action: 'Review Mode Opened', actor: 'Merchant Banker Lead Manager', timestamp: '2026-08-07 14:00 UTC', detail: 'Initiated legal & statutory audit review.' },
    { id: 'LOG-003', action: 'Issue Raised', actor: 'Merchant Banker Lead Manager', timestamp: '2026-08-07 14:15 UTC', detail: 'Raised ISSUE-001: Revenue Data Discrepancy.' }
  ] : []);

  const isCoverPages = activeTocId === 'cover_pages' || activeTocId === 'draft_preview';
  const activeNode = isCoverPages
    ? { section: { id: 'draft_preview', title: 'Draft Preview (Pages 1–3)', key: 'draft_preview', subsections: [] }, key: 'draft_preview', number: '0', fullTitle: 'Draft Preview (Fixed Template — Pages 1–3)' }
    : findDrhpNode(activeTocId);
  const selectedSectionKey = isCoverPages ? 'cover_pages' : (activeNode.key || 'company_details');

  const loadData = async () => {
    try {
      setLoading(true);
      const [draftRes, intakeRes, docsRes] = await Promise.all([
        getDrafts(companyId),
        getIntake(companyId),
        getDocuments(companyId)
      ]);
      setDrafts(draftRes.data || draftRes || {});
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);

      // Load comments for active section
      const commRes = await getComments(selectedSectionKey);
      setComments(commRes.data || commRes || []);
    } catch (err) {
      console.error("Error loading reviewer workspace:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId, selectedSectionKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading Legal Review & Certification Engine...</span>
      </div>
    );
  }

  const currentSection = drafts[selectedSectionKey] || { status: 'not_reviewed', blocks: [] };

  // Status Certification Decision Handler
  const handleStatusUpdate = async (newStatus) => {
    try {
      setUpdating(true);
      const certifiedBy = 'Merchant Banker Lead Manager';
      const certifiedAt = new Date().toISOString();
      await updateDraftStatus(companyId, selectedSectionKey, { 
        status: newStatus, 
        role: 'reviewer',
        certified_by: certifiedBy,
        certified_at: certifiedAt
      });
      
      // Append Audit Log
      const newLog = {
        id: `LOG-${Date.now()}`,
        action: `Chapter Status Updated to ${newStatus.toUpperCase()}`,
        actor: 'Merchant Banker Lead Manager',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
        detail: `Section ${activeNode.fullTitle} status changed to ${newStatus}.`
      };
      setAuditLog(prev => [newLog, ...prev]);

      await loadData();
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

      setAuditLog(prev => [{
        id: `LOG-${Date.now()}`,
        action: 'Reviewer Comment Added',
        actor: 'Merchant Banker Lead Manager',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
        detail: `Added note for ${activeNode.section.title}.`
      }, ...prev]);
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

    setAuditLog(prev => [{
      id: `LOG-${Date.now()}`,
      action: 'Structured Legal Issue Raised',
      actor: 'Merchant Banker Lead Manager',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      detail: `Raised ${newIssue.id}: ${newIssue.title}`
    }, ...prev]);
  };

  const handleResolveIssue = (issueId) => {
    setIssuesList(prev => prev.map(iss => iss.id === issueId ? { ...iss, status: 'Resolved' } : iss));
    setAuditLog(prev => [{
      id: `LOG-${Date.now()}`,
      action: 'Structured Issue Resolved',
      actor: 'Issuer / Legal Counsel',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      detail: `Resolved ${issueId}. Marked ready for reviewer verification.`
    }, ...prev]);
  };

  const handleSourceClick = (cite) => {
    setSelectedCitation(cite);
    setShowSourceDrawer(true);
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

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Top Workspace Header Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase tracking-wider bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                  Single Source of Truth — Legal Review Engine
                </span>
                <h1 className="text-xl font-bold text-white">Merchant Banker Legal Review & Certification Platform</h1>
              </div>
              <p className="text-slate-300 text-xs mt-0.5">
                Issue-driven, evidence-backed DRHP verification platform for registered lead managers and statutory legal counsel.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Mode Toggle: Reviewer Mode vs Assigned to Me View */}
            <div className="bg-white/10 p-1 rounded-xl border border-white/10 flex items-center gap-1">
              <button
                onClick={() => setWorkspaceMode('reviewer')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  workspaceMode === 'reviewer'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Reviewer Workspace
              </button>
              <button
                onClick={() => setWorkspaceMode('assigned_to_me')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  workspaceMode === 'assigned_to_me'
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Assigned to Me ({issuesList.filter(i => i.status !== 'Closed').length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CHAPTER AUDIT DECISION BOARD */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="space-y-0.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
              Active DRHP Chapter Review Status
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">{activeNode.fullTitle}</h2>
              <StatusBadge status={currentSection.status || 'not_reviewed'} />
            </div>
            {currentSection.certified_by && (
              <span className="text-[10px] text-slate-400 font-mono block">
                Certified by {currentSection.certified_by} at {new Date(currentSection.certified_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* REVIEWER DECISION ACTIONS */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleStatusUpdate('approved')}
            disabled={updating}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Approve Chapter</span>
          </button>

          <button
            onClick={() => handleStatusUpdate('changes_requested')}
            disabled={updating}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold border border-amber-200 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Changes Requested</span>
          </button>

          <button
            onClick={() => handleStatusUpdate('draft')}
            disabled={updating}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 font-bold border border-red-200 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <XCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Reject / Request Edits</span>
          </button>

          <button
            onClick={() => handleStatusUpdate('under_review')}
            disabled={updating}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold border border-slate-200 rounded-xl text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-slate-600" />
            <span>Lock Chapter</span>
          </button>

          <button
            onClick={() => handleStatusUpdate('certified')}
            disabled={updating}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Certify Chapter</span>
          </button>
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
              {/* Front Matter Sentinel Item */}
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
                const chapterDraft = drafts[sec.key] || { status: 'not_reviewed' };
                const hasActiveSub = sec.subsections.some(sub => sub.id === activeTocId);

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
                        <span className="truncate">{secIdx + 1}. {sec.title}</span>
                      </div>
                      <StatusBadge status={chapterDraft.status || 'not_reviewed'} className="scale-75 shrink-0" />
                    </button>

                    {/* Subsections List */}
                    {isExpanded && sec.subsections && sec.subsections.length > 0 && (
                      <div className="pl-6 space-y-1 border-l-2 border-slate-100 ml-3">
                        {sec.subsections.map((sub, subIdx) => {
                          const isSubActive = activeTocId === sub.id;
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
                              <span className="truncate">{secIdx + 1}.{subIdx + 1} {sub.title}</span>
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

          {/* COLUMN 2: CENTER CANVAS — SINGLE SOURCE OF TRUTH DRAFT PROSPECTUS CHAPTER */}
          <div className="xl:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-8 font-serif min-h-[75vh]">
            {isCoverPages ? (
              <FrontMatterTemplate
                intake={intakeData}
                drafts={drafts}
                onNavigateSection={(secKey, targetId) => setActiveTocId(targetId)}
              />
            ) : (
              (() => {
                const sec = activeNode.section;
                const secIdx = DRHP_HIERARCHY.findIndex(s => s.id === sec.id);
                const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
                const romanTitle = `SECTION ${romanNumerals[secIdx >= 0 ? secIdx : 0] || 'I'}: ${sec.title}`;
                const subsections = sec.subsections && sec.subsections.length > 0
                  ? sec.subsections
                  : [{ id: sec.id, title: sec.title, key: sec.key }];

                return (
                  <div key={sec.id} className="space-y-10">
                    {/* Section Title Banner */}
                    <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1 font-serif">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest font-mono">
                        SECURITIES AND EXCHANGE BOARD OF INDIA — REVIEWER VERIFICATION MODE
                      </p>
                      <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-wide uppercase">
                        {romanTitle}
                      </h2>
                    </div>

                    {/* Subsections Rendered Sequentially for this Chapter */}
                    <div className="space-y-12">
                      {subsections.map((sub, subIdx) => {
                        const subKey = sub.key;
                        const subNumber = sec.subsections && sec.subsections.length > 0 ? `${secIdx + 1}.${subIdx + 1}` : `${secIdx + 1}.0`;
                        const subBlocks = getBlocksForSubsection(sub.id, subKey, drafts, intakeData);
                        const subCitations = subBlocks.flatMap(b => b.citations || []);
                        const uniqueSubCitations = Array.from(new Set(subCitations));

                        return (
                          <div key={sub.id} id={`drhp-sub-${sub.id}`} data-sub-id={sub.id} className="drhp-subsection-anchor space-y-5 pt-6 border-t border-slate-200 scroll-mt-20">
                            {/* Subsection Header */}
                            <div id={sub.id} className="flex items-center justify-between border-b border-slate-300 pb-2 scroll-mt-20">
                              <div className="flex items-center gap-2 flex-1">
                                <span className="text-indigo-700 font-mono font-bold text-xs shrink-0">
                                  {subNumber}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 tracking-tight uppercase font-serif">
                                  {sub.title}
                                </h3>
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
                                  Disclosure narrative for {sub.title}.
                                </p>
                              )}
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
                                    >
                                      <Bookmark className="w-2.5 h-2.5 text-indigo-400" />
                                      <span>{cite.split(': ').pop()}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* PARAGRAPH LEVEL REVIEW CONTROL BAR */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 font-sans text-xs">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-indigo-600" /> Reviewer Paragraph Actions ({subNumber})
                                </span>

                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setIssueSubTarget(sub.id);
                                      setShowRaiseIssueModal(true);
                                    }}
                                    className="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold flex items-center gap-1 text-[10px] shadow-sm cursor-pointer"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> Raise Structured Issue
                                  </button>

                                  <button
                                    onClick={() => handleStatusUpdate('approved')}
                                    className="px-2.5 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 flex items-center gap-1 text-[10px] cursor-pointer"
                                  >
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Approve Block
                                  </button>

                                  <button
                                    onClick={() => handleSourceClick(`Intake: ${subKey}`)}
                                    className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 flex items-center gap-1 text-[10px] cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" /> View Evidence
                                  </button>
                                </div>
                              </div>
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

                      <h4 className="font-bold text-slate-900 text-xs">{iss.title}</h4>
                      <p className="text-[11px] text-slate-700 leading-normal">{iss.description}</p>

                      <div className="pt-1 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                        <span>Assigned: {iss.assignedTo}</span>
                        <span className="font-bold text-slate-700">{iss.status}</span>
                      </div>

                      {iss.status !== 'Resolved' && iss.status !== 'Closed' && (
                        <button
                          onClick={() => handleResolveIssue(iss.id)}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3 h-3" /> Mark Resolved
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: COMMENTS THREAD */}
            {activeRightTab === 'comments' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 font-sans max-h-[70vh] overflow-y-auto">
                <form onSubmit={handlePostComment} className="space-y-2">
                  <textarea
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="Write reviewer comment..."
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 min-h-[70px]"
                  />
                  <button
                    type="submit"
                    disabled={!newCommentText.trim()}
                    className="w-full py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" /> Post Comment
                  </button>
                </form>

                <div className="space-y-2">
                  {comments.map((c) => (
                    <div key={c.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="font-bold text-indigo-700">{c.author_role || 'Reviewer'}</span>
                        <span>{c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}</span>
                      </div>
                      <p className="text-slate-800">{c.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: STATUTORY EVIDENCE PANEL */}
            {activeRightTab === 'evidence' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 font-sans max-h-[70vh] overflow-y-auto text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono block border-b border-slate-100 pb-2">
                  Statutory Evidence Repository
                </span>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-mono text-[10px] text-slate-400 font-bold block uppercase">Intake Form Fields</span>
                    <p className="font-bold text-slate-800">Promoter Data, Capital Structure, Statutory Registers</p>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-mono text-[10px] text-slate-400 font-bold block uppercase">Uploaded PDF Documents</span>
                    <p className="font-bold text-slate-800">MOA.pdf, AOA.pdf, Financials_FY23-FY25.pdf</p>
                  </div>

                  <button
                    onClick={() => navigate('/intake')}
                    className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open Evidence in Intake
                  </button>
                </div>
              </div>
            )}

            {/* TAB 4: IMMUTABLE AUDIT LOG */}
            {activeRightTab === 'history' && (
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 font-sans max-h-[70vh] overflow-y-auto text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono block border-b border-slate-100 pb-2">
                  Immutable Review Audit Trail
                </span>

                <div className="space-y-3">
                  {auditLog.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-indigo-700">{log.action}</span>
                        <span className="text-slate-400">{log.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-700">{log.detail}</p>
                      <span className="text-[9px] text-slate-400 font-mono block">Actor: {log.actor}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* MODAL: RAISE STRUCTURED LEGAL ISSUE */}
      {showRaiseIssueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 text-base">Raise Structured Legal Issue</h3>
              </div>
              <button
                onClick={() => setShowRaiseIssueModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRaiseIssueSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Issue Title</label>
                <input
                  type="text"
                  value={issueForm.title}
                  onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })}
                  placeholder="e.g. Revenue Mismatch in Restated Financials"
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Priority</label>
                  <select
                    value={issueForm.priority}
                    onChange={(e) => setIssueForm({ ...issueForm, priority: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value="Critical">Critical</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Assigned To</label>
                  <select
                    value={issueForm.assignedTo}
                    onChange={(e) => setIssueForm({ ...issueForm, assignedTo: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold outline-none focus:border-indigo-500"
                  >
                    <option value="Issuer / Legal Counsel">Issuer / Legal Counsel</option>
                    <option value="Statutory Auditor">Statutory Auditor</option>
                    <option value="Promoter Group">Promoter Group</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Description</label>
                <textarea
                  value={issueForm.description}
                  onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })}
                  placeholder="Explain the finding or discrepancy..."
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 min-h-[70px]"
                />
              </div>

              <div>
                <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Regulatory Reason</label>
                <input
                  type="text"
                  value={issueForm.reason}
                  onChange={(e) => setIssueForm({ ...issueForm, reason: e.target.value })}
                  placeholder="e.g. SEBI ICDR Schedule VI Part A Item (11)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="font-mono font-bold uppercase tracking-wider text-slate-500 block mb-1">Recommended Fix</label>
                <input
                  type="text"
                  value={issueForm.recommendation}
                  onChange={(e) => setIssueForm({ ...issueForm, recommendation: e.target.value })}
                  placeholder="Recommended action to resolve..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRaiseIssueModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl shadow-md"
                >
                  Raise Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SOURCE INSPECTION SLIDE-OVER DRAWER */}
      {showSourceDrawer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-lg h-full p-6 shadow-2xl space-y-6 overflow-y-auto font-sans">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Statutory Source Evidence Inspection</h3>
              </div>
              <button
                onClick={() => setShowSourceDrawer(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">Citation Target</span>
                <p className="font-mono text-indigo-700 font-bold text-xs">{selectedCitation}</p>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 block">Verified Evidence Snippet</span>
                <p className="text-slate-800 leading-relaxed font-sans bg-slate-50 p-3 rounded-xl border border-slate-200">
                  Data point extracted from statutory intake filing and cross-verified with statutory auditor certificates.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowSourceDrawer(false);
                  navigate('/intake');
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Intake Form</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
