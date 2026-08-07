import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIpoReadiness, updateIpoReadinessItem, getIntake, getDocuments, getDrafts, getGapReport } from '../services/api';
import { SECTION_KEYS } from '../components/ChapterHealthSidebar';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  FileText, 
  UserCheck, 
  RefreshCw,
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Clock,
  Building2,
  FileCheck2,
  ListChecks,
  Check,
  XCircle,
  AlertCircle,
  ExternalLink,
  Lock,
  Scale,
  Users,
  Layers,
  Download,
  ChevronRight,
  Bookmark
} from 'lucide-react';

export default function IpoReadinessPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [readinessData, setReadinessData] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [gapReport, setGapReport] = useState([]);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadData = async () => {
    try {
      setLoading(true);
      const [readinessRes, intakeRes, docsRes, draftsRes, gapRes] = await Promise.all([
        getIpoReadiness(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId),
        getGapReport(companyId)
      ]);
      setReadinessData(readinessRes.data || readinessRes || null);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
      setGapReport(gapRes.data || gapRes || []);
    } catch (err) {
      console.error("Error loading IPO readiness data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  const handleMilestoneToggle = async (itemKey, currentStatus) => {
    try {
      const newStatus = currentStatus === 'verified' ? 'needs_changes' : 'verified';
      await updateIpoReadinessItem(companyId, itemKey, newStatus, user?.name || 'Registered Merchant Banker');
      await loadData();
    } catch (err) {
      console.error("Failed to toggle milestone status:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-slate-500 text-xs font-mono font-medium">Assembling Executive Filing Readiness Dashboard...</p>
      </div>
    );
  }

  // ─── DERIVED METRICS & COMPUTATIONS ──────────────────────────────────────────
  const score = readinessData?.overall_score || 0;
  const companyName = readinessData?.companyName || intakeData.company_details?.legal_name || 'Your Company';
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));

  const certifiedCount = Object.keys(SECTION_KEYS).filter(k => drafts[k] && drafts[k].status === 'certified').length;
  const totalChapters = Object.keys(SECTION_KEYS).length;

  const hasIntakeCompleted = Object.keys(intakeData || {}).some(k => intakeData[k] && Object.keys(intakeData[k]).length > 0);

  // ─── DYNAMIC CRITICAL BLOCKERS LIST ──────────────────────────────────────────
  const criticalBlockers = [];

  if (!uploadedDocTypes.has('aoa') && !uploadedDocTypes.has('incorporation_certificate')) {
    criticalBlockers.push({
      id: 'CB-001',
      issue: 'Articles of Association (AOA) Charter Missing',
      impact: 'Statutory corporate charter verification unfulfilled under Companies Act Sec 5.',
      affectedChapter: 'Section I: General & Corporate History',
      blocks: 'Reviewer Certification & Final Export',
      owner: 'Company Secretary',
      estimatedFixTime: '15 Minutes',
      actionLabel: 'Upload AOA Document',
      route: '/intake'
    });
  }

  if (documents.filter(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials').length < 3) {
    criticalBlockers.push({
      id: 'CB-002',
      issue: '3-Year Audited Financial Statements Incomplete',
      impact: 'SEBI ICDR Schedule VI Regulation 6(1) audit trail missing required restated periods.',
      affectedChapter: 'Section VI: Financial Information',
      blocks: 'Financial Chapter Certification & DRHP Export',
      owner: 'CFO / Statutory Auditor',
      estimatedFixTime: '1 Business Day',
      actionLabel: 'Upload Financial Audits',
      route: '/intake'
    });
  }

  if (!uploadedDocTypes.has('board_resolution')) {
    criticalBlockers.push({
      id: 'CB-003',
      issue: 'Certified Board Resolution Approving IPO Omitted',
      impact: 'Board of Directors authorization required prior to SEBI DRHP submission.',
      affectedChapter: 'Section I: General Information',
      blocks: 'Legal Compliance Sign-Off',
      owner: 'Legal Counsel',
      estimatedFixTime: '30 Minutes',
      actionLabel: 'Upload Resolution',
      route: '/intake'
    });
  }

  if (gapReport.some(g => g.category === 'consistency')) {
    criticalBlockers.push({
      id: 'CB-004',
      issue: 'Cross-Document Financial / Shareholding Data Discrepancy',
      impact: 'Inconsistency between Promoter Intake disclosures and uploaded PDF source documents.',
      affectedChapter: 'Section III: Capital Structure & Financials',
      blocks: 'Merchant Banker Final Sign-off',
      owner: 'Company Secretary & CFO',
      estimatedFixTime: '45 Minutes',
      actionLabel: 'Resolve Gaps',
      route: '/gap-analysis'
    });
  }

  if (certifiedCount < totalChapters) {
    criticalBlockers.push({
      id: 'CB-005',
      issue: `${totalChapters - certifiedCount} DRHP Chapters Pending Reviewer Certification`,
      impact: 'Lead Merchant Banker mandatory statutory certification incomplete.',
      affectedChapter: 'All 11 Prospectus Chapters',
      blocks: 'Final DRHP Export',
      owner: 'Merchant Banker Lead Manager',
      estimatedFixTime: '2 Hours',
      actionLabel: 'Open Reviewer Workspace',
      route: '/reviewer'
    });
  }

  // ─── DYNAMIC "WHY NOT 100%" REMAINING BLOCKERS ────────────────────────────────
  const whyNot100 = [];

  if (!hasIntakeCompleted) {
    whyNot100.push({
      title: 'Complete Intake Questionnaire',
      priority: 'Critical',
      module: 'Intake Form',
      resolutionTime: '20 Minutes',
      route: '/intake',
      actionLabel: 'Open Intake'
    });
  }

  if (documents.length < 5) {
    whyNot100.push({
      title: 'Statutory Document Uploads Pending',
      priority: 'High',
      module: 'Document Repository',
      resolutionTime: '15 Minutes',
      route: '/intake',
      actionLabel: 'Upload Files'
    });
  }

  if (gapReport.length > 0) {
    whyNot100.push({
      title: `${gapReport.length} Unresolved Compliance & Data Gaps`,
      priority: 'High',
      module: 'Gap Analysis Engine',
      resolutionTime: '30 Minutes',
      route: '/gap-analysis',
      actionLabel: 'Resolve Gaps'
    });
  }

  if (certifiedCount < totalChapters) {
    whyNot100.push({
      title: `${totalChapters - certifiedCount} DRHP Chapters Require Reviewer Certification`,
      priority: 'Critical',
      module: 'Reviewer Workspace',
      resolutionTime: '1 Hour',
      route: '/reviewer',
      actionLabel: 'Certify Chapters'
    });
  }

  // ─── STATUS DESIGNATION & HEADER ──────────────────────────────────────────────
  let currentStatus = 'Not Ready';
  let statusExplanation = 'Complete the Intake Form and upload mandatory statutory documents to build your filing readiness.';
  let estimatedFilingTime = '2–3 Weeks';
  let statusBadgeColor = 'bg-red-500/20 text-red-300 border-red-500/30';

  if (score >= 95 && criticalBlockers.length === 0) {
    currentStatus = 'Ready for Filing';
    statusExplanation = 'Your company has satisfied all statutory ICDR requirements and certified DRHP disclosures. You are ready to export the final filing package.';
    estimatedFilingTime = 'Ready Today';
    statusBadgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  } else if (score >= 70) {
    currentStatus = 'Almost Ready';
    statusExplanation = 'Your IPO is almost ready. Resolve the remaining critical blockers to become eligible for DRHP export.';
    estimatedFilingTime = '2–3 Working Days';
    statusBadgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
  } else if (score >= 40) {
    currentStatus = 'Needs Review';
    statusExplanation = 'Draft disclosures and statutory documents require merchant banker review and certification.';
    estimatedFilingTime = '5–7 Working Days';
    statusBadgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  }

  // ─── NEXT RECOMMENDED ACTION (SINGLE HIGHEST PRIORITY) ───────────────────────
  const nextBestAction = criticalBlockers.length > 0 ? {
    title: criticalBlockers[0].issue,
    estimatedTime: criticalBlockers[0].estimatedFixTime,
    actionLabel: criticalBlockers[0].actionLabel,
    route: criticalBlockers[0].route
  } : whyNot100.length > 0 ? {
    title: whyNot100[0].title,
    estimatedTime: whyNot100[0].resolutionTime,
    actionLabel: whyNot100[0].actionLabel,
    route: whyNot100[0].route
  } : {
    title: 'Export Certified Final DRHP Prospectus Package',
    estimatedTime: 'Instant Export',
    actionLabel: 'Export DRHP',
    route: '/draft-preview'
  };

  // ─── FILING ELIGIBILITY STATE ────────────────────────────────────────────────
  let filingEligibilityStatus = 'Not Eligible';
  let filingEligibilityReason = 'Mandatory corporate details, financial disclosures, and statutory documents are missing.';

  if (currentStatus === 'Ready for Filing') {
    filingEligibilityStatus = 'Ready for Filing';
    filingEligibilityReason = 'All quantitative SEBI eligibility tests, corporate resolutions, and reviewer certifications are complete.';
  } else if (certifiedCount === totalChapters) {
    filingEligibilityStatus = 'Ready for Reviewer Certification';
    filingEligibilityReason = 'DRHP chapter drafting is complete; awaiting final Merchant Banker sign-off.';
  } else if (gapReport.length > 0) {
    filingEligibilityStatus = 'Waiting for Compliance';
    filingEligibilityReason = 'Unresolved cross-document data discrepancies or missing disclosures detected by validation engine.';
  } else if (documents.length < 3) {
    filingEligibilityStatus = 'Waiting for Missing Documents';
    filingEligibilityReason = 'Key statutory PDF attachments (AOA, MOA, Board Resolution, Audited Financials) pending upload.';
  }

  // ─── EXPORT READINESS STATE ─────────────────────────────────────────────────
  const isExportReady = currentStatus === 'Ready for Filing' || certifiedCount >= 8;
  const exportReasons = [];
  if (certifiedCount < totalChapters) exportReasons.push(`${totalChapters - certifiedCount} chapters not yet certified by reviewer`);
  if (!uploadedDocTypes.has('aoa') && !uploadedDocTypes.has('moa')) exportReasons.push('Corporate charter documents (AOA/MOA) unverified');
  if (gapReport.length > 0) exportReasons.push(`${gapReport.length} unresolved data inconsistency gap(s)`);

  // ─── CATEGORY READINESS BREAKDOWN ───────────────────────────────────────────
  const categories = [
    {
      name: 'Company Information',
      completion: intakeData.company_details?.legal_name ? 100 : 25,
      status: intakeData.company_details?.legal_name ? 'Complete' : 'In Progress',
      route: '/intake?step=company_details'
    },
    {
      name: 'Documents',
      completion: Math.min(100, Math.round((documents.length / 6) * 100)),
      status: documents.length >= 4 ? 'Verified' : 'Pending Uploads',
      route: '/intake'
    },
    {
      name: 'Financial Information',
      completion: intakeData.financials?.revenue_fy25 ? 100 : 30,
      status: intakeData.financials?.revenue_fy25 ? 'Audited' : 'Incomplete',
      route: '/intake?step=financials'
    },
    {
      name: 'Legal & Compliance',
      completion: intakeData.legal_compliance?.factory_license || uploadedDocTypes.has('statutory_approvals') ? 100 : 40,
      status: intakeData.legal_compliance?.factory_license ? 'Compliant' : 'Needs Review',
      route: '/compliance-checklist'
    },
    {
      name: 'Corporate Governance',
      completion: uploadedDocTypes.has('board_resolution') ? 100 : 20,
      status: uploadedDocTypes.has('board_resolution') ? 'Approved' : 'Resolution Missing',
      route: '/intake?step=promoters'
    },
    {
      name: 'Compliance Validation',
      completion: hasIntakeCompleted ? 85 : 0,
      status: hasIntakeCompleted ? 'Rules Checked' : 'Not Validated',
      route: '/compliance-checklist'
    },
    {
      name: 'Gap Resolution',
      completion: gapReport.length === 0 ? 100 : Math.max(20, 100 - gapReport.length * 25),
      status: gapReport.length === 0 ? 'No Gaps' : `${gapReport.length} Open Gaps`,
      route: '/gap-analysis'
    },
    {
      name: 'Draft Prospectus',
      completion: Object.keys(drafts).length > 0 ? 90 : 10,
      status: Object.keys(drafts).length > 0 ? 'Drafted' : 'Not Generated',
      route: '/draft'
    },
    {
      name: 'Reviewer Certification',
      completion: Math.round((certifiedCount / totalChapters) * 100),
      status: certifiedCount === totalChapters ? 'Certified' : `${certifiedCount}/${totalChapters} Certified`,
      route: '/reviewer'
    }
  ];

  // ─── TEAM READINESS STAKEHOLDER MATRIX ──────────────────────────────────────
  const teamStakeholders = [
    {
      role: 'Company Secretary',
      pending: !uploadedDocTypes.has('aoa') || !uploadedDocTypes.has('moa') ? 2 : 0,
      completed: uploadedDocTypes.has('incorporation_certificate') ? 4 : 2,
      status: !uploadedDocTypes.has('aoa') ? 'Pending Charter Upload' : 'Compliant'
    },
    {
      role: 'CFO',
      pending: !intakeData.financials?.revenue_fy25 ? 2 : 0,
      completed: intakeData.financials?.revenue_fy25 ? 5 : 2,
      status: intakeData.financials?.revenue_fy25 ? 'Financials Complete' : 'Pending Audit Sync'
    },
    {
      role: 'Legal Team',
      pending: !uploadedDocTypes.has('board_resolution') ? 1 : 0,
      completed: 3,
      status: uploadedDocTypes.has('board_resolution') ? 'Vetting Complete' : 'Pending Board Resolution'
    },
    {
      role: 'Merchant Banker',
      pending: totalChapters - certifiedCount,
      completed: certifiedCount,
      status: certifiedCount === totalChapters ? 'Fully Certified' : 'Certifying Narrative'
    },
    {
      role: 'Reviewer Desk',
      pending: gapReport.length,
      completed: Math.max(0, 10 - gapReport.length),
      status: gapReport.length === 0 ? 'Cleared' : 'Pending Gap Audit'
    }
  ];

  // ─── SMART AI INSIGHTS ──────────────────────────────────────────────────────
  const smartInsights = [
    intakeData.financials?.revenue_fy25 
      ? 'Financial Information is complete and reconciled with balance sheet intake.' 
      : 'Financial Information requires 3-year revenue and profit entries.',
    uploadedDocTypes.has('aoa') || uploadedDocTypes.has('moa')
      ? 'Legal corporate charter documentation is registered in document repository.' 
      : 'Corporate governance charter documents (AOA/MOA) remain unverified.',
    certifiedCount === totalChapters 
      ? 'All 11 DRHP prospectus chapters certified by Lead Merchant Banker.' 
      : `Reviewer certification is still pending on ${totalChapters - certifiedCount} chapters.`,
    gapReport.length === 0 
      ? 'Zero cross-document compliance gaps detected by validation engine.' 
      : `Final DRHP export is currently blocked by ${gapReport.length} unresolved issue(s).`
  ];

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* ==================================================================== */}
      {/* 1. EXECUTIVE HEADER BANNER                                           */}
      {/* ==================================================================== */}
      <div className="bg-gradient-to-br from-slate-900 via-navy-900 to-indigo-950 text-white p-6 rounded-2xl shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                Executive Command Center
              </span>
              <span className="text-xs text-slate-400 font-medium">• {companyName}</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
              IPO Readiness
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${statusBadgeColor}`}>
                {currentStatus}
              </span>
            </h1>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
              {statusExplanation}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate(nextBestAction.route)}
              className="btn-primary text-xs font-bold py-3 px-5 rounded-xl shadow-indigo-600/20 flex items-center gap-2"
            >
              <span>{nextBestAction.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. OVERALL READINESS SUMMARY (KPI CARDS GRID)                        */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        
        {/* Score Dial */}
        <div className="sm:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" className="stroke-slate-100 fill-none stroke-[8]" />
              <circle 
                cx="50" 
                cy="50" 
                r="45" 
                className="fill-none stroke-[8] transition-all duration-700 ease-out stroke-indigo-600"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * score) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-base font-black text-slate-900 block leading-none">{score}%</span>
            </div>
          </div>

          <div>
            <span className="text-[10px] font-mono text-slate-400 font-bold uppercase block tracking-wider">Overall Readiness</span>
            <span className="text-base font-extrabold text-slate-900 block leading-snug">{currentStatus}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{certifiedCount} of {totalChapters} chapters certified</span>
          </div>
        </div>

        {/* Filing Time */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Estimated Filing</span>
          <p className="text-lg font-black text-slate-900 flex items-center gap-1">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            {estimatedFilingTime}
          </p>
          <p className="text-[10px] text-slate-500">Based on pending actions</p>
        </div>

        {/* Critical Blockers Counter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Critical Blockers</span>
          <p className="text-lg font-black text-red-600 flex items-center gap-1">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {criticalBlockers.length}
          </p>
          <p className="text-[10px] text-slate-500">Blocking DRHP Export</p>
        </div>

        {/* Pending Reviews */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Pending Reviews</span>
          <p className="text-lg font-black text-amber-600 flex items-center gap-1">
            <UserCheck className="w-4 h-4 shrink-0" />
            {totalChapters - certifiedCount}
          </p>
          <p className="text-[10px] text-slate-500">Chapters awaiting signoff</p>
        </div>

        {/* Pending Documents */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Pending Documents</span>
          <p className="text-lg font-black text-indigo-600 flex items-center gap-1">
            <FileText className="w-4 h-4 shrink-0" />
            {Math.max(0, 6 - documents.length)}
          </p>
          <p className="text-[10px] text-slate-500">Statutory PDF attachments</p>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 3. FILING ELIGIBILITY & NEXT BEST ACTION DUAL CARDS                  */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Filing Eligibility Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-indigo-600" />
              Filing Eligibility Status
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
              filingEligibilityStatus === 'Ready for Filing' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              filingEligibilityStatus === 'Ready for Reviewer Certification' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
              'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              {filingEligibilityStatus}
            </span>
          </div>
          <p className="text-slate-700 text-xs leading-relaxed font-sans">
            {filingEligibilityReason}
          </p>
        </div>

        {/* Next Recommended Action */}
        <div className="bg-gradient-to-br from-indigo-900 to-navy-900 text-white p-5 rounded-2xl border border-indigo-800 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-800/80 pb-2.5">
            <span className="font-bold text-indigo-200 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              Next Recommended Action
            </span>
            <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
              Est. Time: {nextBestAction.estimatedTime}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-white text-sm font-bold leading-snug">{nextBestAction.title}</p>
              <p className="text-indigo-200 text-[11px] mt-0.5">Completing this automatically advances your filing readiness.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate(nextBestAction.route)}
              className="btn-primary text-xs font-bold py-2.5 px-4 rounded-xl shadow-lg shrink-0 flex items-center gap-1"
            >
              <span>{nextBestAction.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 4. EXPORT READINESS & READINESS TIMELINE STEPPER                      */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Export Readiness Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Download className="w-4 h-4 text-indigo-600" />
              Final DRHP Export Readiness
            </span>
            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
              isExportReady ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
            }`}>
              {isExportReady ? 'Export Ready' : 'Export Blocked'}
            </span>
          </div>

          {isExportReady ? (
            <div className="space-y-3">
              <p className="text-xs text-emerald-800 font-medium">
                Final Prospectus package is ready for PDF and Word DOCX export.
              </p>
              <button
                type="button"
                onClick={() => navigate('/draft-preview')}
                className="w-full btn-primary text-xs font-bold py-2.5 rounded-xl flex items-center justify-center gap-1.5"
              >
                <span>Go to Export Workspace</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <p className="text-slate-500 font-medium text-[11px]">DRHP Export is currently blocked due to:</p>
              <ul className="space-y-1 text-[11px] text-red-700 font-medium">
                {exportReasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Readiness Stepper Timeline */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-600" />
              Estimated IPO Preparation Timeline
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Filing Pipeline</span>
          </div>

          {/* Horizontal Stepper */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
            {[
              { title: 'Today', status: 'completed', desc: 'Current Baseline' },
              { title: 'Compliance Complete', status: hasIntakeCompleted ? 'completed' : 'active', desc: 'Rules Validated' },
              { title: 'Gap Resolution', status: gapReport.length === 0 ? 'completed' : 'active', desc: 'Discrepancies Cleared' },
              { title: 'Draft Prospectus', status: Object.keys(drafts).length > 0 ? 'completed' : 'upcoming', desc: '11 Chapters Drafted' },
              { title: 'Reviewer Certification', status: certifiedCount === totalChapters ? 'completed' : 'upcoming', desc: 'Banker Sign-off' },
              { title: 'Ready for DRHP Export', status: isExportReady ? 'completed' : 'upcoming', desc: 'Final Filing' }
            ].map((step, idx) => (
              <div key={idx} className={`p-3 rounded-xl border flex flex-col justify-between space-y-1 text-center transition-all ${
                step.status === 'completed' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' :
                step.status === 'active' ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-2 ring-indigo-500/20' :
                'bg-slate-50 border-slate-200 text-slate-400'
              }`}>
                <div className="mx-auto">
                  {step.status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : step.status === 'active' ? (
                    <Clock className="w-4 h-4 text-indigo-600 animate-pulse" />
                  ) : (
                    <Lock className="w-4 h-4 text-slate-300" />
                  )}
                </div>
                <p className="font-bold text-[11px] leading-tight">{step.title}</p>
                <p className="text-[9px] font-mono text-slate-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ==================================================================== */}
      {/* 5. READINESS BREAKDOWN (CATEGORY-WISE)                               */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Category-Wise Readiness Breakdown</h3>
            <p className="text-slate-500 text-xs">Click any category to navigate directly to its module.</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">9 Categories</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {categories.map((cat, idx) => (
            <div
              key={idx}
              onClick={() => navigate(cat.route)}
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-indigo-50/50 hover:border-indigo-200 transition-all cursor-pointer group flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-xs text-slate-800 group-hover:text-indigo-900 transition-colors">
                  {cat.name}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                  cat.completion === 100 ? 'bg-emerald-100 text-emerald-800' :
                  cat.completion >= 50 ? 'bg-indigo-100 text-indigo-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {cat.status}
                </span>
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500">
                  <span>Completion</span>
                  <span className="font-bold text-slate-800">{cat.completion}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      cat.completion === 100 ? 'bg-emerald-600' :
                      cat.completion >= 50 ? 'bg-indigo-600' : 'bg-amber-500'
                    }`}
                    style={{ width: `${cat.completion}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 6. CRITICAL BLOCKERS                                                 */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-slate-900 text-base">Critical Blockers (Separated from Normal Issues)</h3>
          </div>
          <span className="text-xs font-mono font-bold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
            {criticalBlockers.length} Critical Issue(s)
          </span>
        </div>

        {criticalBlockers.length > 0 ? (
          <div className="space-y-3">
            {criticalBlockers.map((blocker) => (
              <div key={blocker.id} className="p-4 bg-red-50/50 border border-red-200/80 rounded-xl space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-red-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase bg-red-600 text-white px-2 py-0.5 rounded">
                      Critical
                    </span>
                    <h4 className="font-bold text-red-950 text-xs">{blocker.issue}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-red-800 font-medium">Est. Fix: {blocker.estimatedFixTime}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-700">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Impact</span>
                    <p className="text-slate-800">{blocker.impact}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Blocks</span>
                    <p className="text-red-700 font-bold">{blocker.blocks}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-400 block uppercase">Owner</span>
                    <p className="text-slate-800 font-medium">{blocker.owner}</p>
                  </div>
                </div>

                <div className="pt-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => navigate(blocker.route)}
                    className="btn-primary text-xs font-bold py-1.5 px-3 rounded-lg flex items-center gap-1"
                  >
                    <span>{blocker.actionLabel}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" /> Zero critical blockers preventing DRHP export.
          </p>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 7. "WHAT IS PREVENTING 100% READINESS?"                             */}
      {/* ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-slate-900 text-base">What is preventing 100% readiness?</h3>
          </div>
          <span className="text-xs font-mono font-bold text-slate-400 uppercase">
            {whyNot100.length} Remaining Item(s)
          </span>
        </div>

        {whyNot100.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {whyNot100.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-amber-50/40 border border-amber-200/70 rounded-xl flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded ${
                      item.priority === 'Critical' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.priority}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">{item.module}</span>
                  </div>
                  <p className="font-bold text-xs text-slate-900 leading-tight">{item.title}</p>
                  <p className="text-[10px] text-slate-500 font-mono">Est. Time: {item.resolutionTime}</p>
                </div>

                <button
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="shrink-0 text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white border border-indigo-200 hover:border-indigo-300 px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1 transition-all"
                >
                  <span>{item.actionLabel}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 p-3 bg-emerald-50/60 rounded-xl border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" /> 100% readiness reached! All statutory requirements fulfilled.
          </p>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 8. TEAM READINESS & SMART INSIGHTS DUAL GRID                         */}
      {/* ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Stakeholder Team Readiness */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-600" />
              Team & Stakeholder Readiness Matrix
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Work Pending</span>
          </div>

          <div className="space-y-2 text-xs">
            {teamStakeholders.map((st, idx) => (
              <div key={idx} className="p-3 bg-slate-50 border border-slate-200/70 rounded-xl flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">{st.role}</span>
                  <span className="text-[10px] text-slate-500">{st.completed} Tasks Done • {st.pending} Pending</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  st.pending === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {st.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Smart Insights */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-bold text-slate-800 text-xs uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              AI Smart Readiness Insights
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">Real-time Audit</span>
          </div>

          <div className="space-y-2 text-xs">
            {smartInsights.map((insight, idx) => (
              <div key={idx} className="p-3 bg-indigo-50/40 border border-indigo-100 rounded-xl flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ✓
                </span>
                <p className="text-slate-800 font-medium text-[11px] leading-relaxed">{insight}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
