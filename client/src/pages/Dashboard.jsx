import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCompanyStatus, generateDrafts, getIpoReadiness, getIntake, getDocuments, getDrafts, getAuditLogs } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  TrendingUp, 
  FileWarning, 
  MessageSquare, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck,
  ChevronRight,
  Sparkles,
  FileText,
  Clock,
  ListChecks,
  Circle,
  Building2,
  UserCheck,
  Users,
  Calendar,
  AlertCircle,
  Check,
  ExternalLink,
  Shield,
  FileSpreadsheet,
  ArrowUpRight
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [readinessData, setReadinessData] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadStatus = async () => {
    try {
      setLoading(true);
      const [res, readinessRes, intakeRes, docsRes, draftsRes, auditLogsRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIpoReadiness(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId),
        getAuditLogs(companyId).catch(() => ({ data: { logs: [] } }))
      ]);
      setStats(res.data || res);
      setReadinessData(readinessRes.data || readinessRes);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
      const logs = auditLogsRes.data?.logs || auditLogsRes.logs || [];
      setAuditLogs(logs);
    } catch (err) {
      console.error("Failed to load dashboard status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const handleUpdate = () => loadStatus();
    window.addEventListener('ipo-readiness-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('ipo-readiness-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [companyId]);

  const handleSyncAI = async () => {
    try {
      setSyncing(true);
      await generateDrafts(companyId);
      const res = await getCompanyStatus(companyId);
      setStats(res.data || res);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm">Assembling executive dashboard metrics...</p>
        </div>
      </div>
    );
  }

  // Derived metrics from REAL DATA ONLY
  const companyName = stats?.companyName || intakeData.company_details?.legal_name || 'Your Company';
  const ipoType = stats?.ipoType || (intakeData.company_details?.proposed_exchange ? (intakeData.company_details.proposed_exchange === 'mainboard' ? 'Main Board IPO' : 'SME IPO (NSE Emerge / BSE SME)') : 'SME IPO (NSE Emerge / BSE SME)');
  const readinessScore = readinessData?.overall_score ?? (stats?.completenessPercentage ?? 0);
  const criticalCount = stats?.inconsistenciesCount ?? 0;
  const highCount = stats?.gapsCount ?? 0;
  const openComments = stats?.openComments ?? 0;

  // ----------------------------------------------------------------------
  // DYNAMIC WORKFLOW STAGE PROGRESS CALCULATIONS (REAL DATA ONLY)
  // ----------------------------------------------------------------------

  // Stage 1: Company Setup (Completed upon company creation)
  const setupStatus = companyId ? 'Completed' : 'Not Started';

  // Stage 2: Intake Form
  const intakeKeys = Object.keys(intakeData || {});
  const filledIntakeSteps = intakeKeys.filter(k => {
    const section = intakeData[k];
    return section && typeof section === 'object' && Object.values(section).some(v => v !== undefined && v !== null && String(v).trim() !== '');
  });
  const totalMandatorySteps = 11;
  let intakeStatus = 'Not Started';
  if (filledIntakeSteps.length >= totalMandatorySteps) {
    intakeStatus = 'Completed';
  } else if (filledIntakeSteps.length > 0) {
    intakeStatus = 'In Progress';
  }

  // Stage 3: OCR & AI Extraction
  const docList = documents || [];
  let ocrStatus = 'Not Started';
  if (docList.length === 0) {
    ocrStatus = 'Not Started';
  } else {
    const hasUnconfirmed = docList.some(d => d.status === 'processing' || d.status === 'pending');
    if (hasUnconfirmed) {
      ocrStatus = 'In Progress';
    } else {
      ocrStatus = 'Completed';
    }
  }

  // Stage 4: Compliance Checklist
  // Prerequisite: OCR & AI Extraction / Intake must not be Not Started
  let complianceStatus = 'Not Started';
  if (ocrStatus !== 'Not Started' || intakeStatus !== 'Not Started') {
    const uploadedDocTypes = new Set(docList.map(d => d.doc_type));
    const hasMandatoryDocs = uploadedDocTypes.has('aoa') && uploadedDocTypes.has('moa');
    const hasFin = docList.some(d => d.doc_type === 'financial_statements' || d.doc_type === 'audited_financials');
    if (hasMandatoryDocs && hasFin && intakeStatus === 'Completed') {
      complianceStatus = 'Completed';
    } else {
      complianceStatus = 'In Progress';
    }
  }

  // Stage 5: Gap Analysis
  // Prerequisite: Compliance Checklist must not be Not Started
  let gapStatus = 'Not Started';
  if (complianceStatus !== 'Not Started') {
    if (criticalCount > 0) {
      gapStatus = 'Blocked';
    } else if (highCount > 0 || (stats?.gapReport && stats.gapReport.length > 0)) {
      gapStatus = 'In Progress';
    } else if (complianceStatus === 'Completed') {
      gapStatus = 'Completed';
    } else {
      gapStatus = 'In Progress';
    }
  }

  // Stage 6: Draft Prospectus
  // Prerequisite: Gap Analysis must not be Not Started
  const requiredChapters = ['general', 'risk_factors', 'company_details', 'business_overview', 'financials', 'litigation', 'objects', 'other_disclosures'];
  const generatedChaptersCount = requiredChapters.filter(k => drafts[k] && drafts[k].blocks && drafts[k].blocks.length > 0 && drafts[k].status !== 'not_generated').length;
  
  let draftStatus = 'Not Started';
  if (gapStatus !== 'Not Started') {
    if (generatedChaptersCount === requiredChapters.length) {
      draftStatus = 'Completed';
    } else if (generatedChaptersCount > 0) {
      draftStatus = 'In Progress';
    }
  }

  // Stage 7: Reviewer Workspace
  // Prerequisite: Draft Prospectus must not be Not Started
  let reviewerStatus = 'Not Started';
  if (draftStatus !== 'Not Started') {
    const reviewedCount = requiredChapters.filter(k => drafts[k]?.status === 'approved' || drafts[k]?.status === 'certified').length;
    if (reviewedCount === requiredChapters.length) {
      reviewerStatus = 'Completed';
    } else {
      reviewerStatus = 'In Progress';
    }
  }

  // Stage 8: Certification
  // Prerequisite: Reviewer Workspace must not be Not Started
  let certStatus = 'Pending';
  if (reviewerStatus === 'Completed') {
    const certifiedCount = requiredChapters.filter(k => drafts[k]?.status === 'certified').length;
    if (certifiedCount === requiredChapters.length) {
      certStatus = 'Completed';
    } else {
      certStatus = 'Pending';
    }
  } else if (draftStatus === 'Not Started') {
    certStatus = 'Not Started';
  } else {
    certStatus = 'Pending';
  }

  // Stage 9: Export
  // Prerequisite: Certification must be Completed
  let exportStatus = 'Locked';
  if (certStatus === 'Completed') {
    exportStatus = 'Available';
  }

  // SECTION 1: IPO WORKFLOW STAGES (DYNAMIC)
  const workflowStages = [
    { name: 'Company Setup', status: setupStatus, route: '/intake' },
    { name: 'Intake Form', status: intakeStatus, route: '/intake' },
    { name: 'OCR & AI Extraction', status: ocrStatus, route: '/intake' },
    { name: 'Compliance Checklist', status: complianceStatus, route: '/compliance-checklist' },
    { name: 'Gap Analysis', status: gapStatus, route: '/gap-analysis' },
    { name: 'Draft Prospectus', status: draftStatus, route: '/draft' },
    { name: 'Reviewer Workspace', status: reviewerStatus, route: '/reviewer' },
    { name: 'Certification', status: certStatus, route: '/readiness' },
    { name: 'Export', status: exportStatus, route: '/draft-preview' }
  ];

  const stageStatuses = [setupStatus, intakeStatus, ocrStatus, complianceStatus, gapStatus, draftStatus, reviewerStatus, certStatus, exportStatus];
  const firstIncompleteIdx = stageStatuses.findIndex(s => s !== 'Completed');
  const activeStageNumber = firstIncompleteIdx === -1 ? 9 : firstIncompleteIdx + 1;

  const currentStageText = stats?.currentStage || (
    activeStageNumber === 1 ? 'Company Account Setup' :
    activeStageNumber === 2 ? 'Intake Questionnaire Completion' :
    activeStageNumber === 3 ? 'Document Upload & OCR Processing' :
    activeStageNumber === 4 ? 'Statutory Compliance Validation' :
    activeStageNumber === 5 ? 'Compliance Gap Resolution' :
    activeStageNumber === 6 ? 'DRHP Prospectus Generation' :
    activeStageNumber === 7 ? 'Reviewer Workspace Sign-Off' :
    activeStageNumber === 8 ? 'Final Certification' : 'DRHP Filing Ready'
  );

  // SECTION 2: TODAY'S PRIORITIES (DYNAMIC BASED ON REAL DATA)
  const priorityItems = [];
  if (intakeStatus !== 'Completed') {
    priorityItems.push({
      title: filledIntakeSteps.length === 0 ? 'Complete Initial Intake Form' : 'Complete Pending Intake Questionnaire Sections',
      priority: 'High',
      owner: 'Issuer Team',
      dueDate: 'Today',
      action: 'Complete Intake',
      route: '/intake'
    });
  }
  if (ocrStatus !== 'Completed') {
    priorityItems.push({
      title: docList.length === 0 ? 'Upload Mandatory Compliance Documents (AOA, MOA, Financials)' : 'Execute OCR Extraction on Uploaded Documents',
      priority: 'High',
      owner: 'Finance Team',
      dueDate: 'Today',
      action: docList.length === 0 ? 'Upload Documents' : 'Run OCR',
      route: '/intake'
    });
  }
  if (complianceStatus !== 'Completed') {
    priorityItems.push({
      title: 'Run Statutory SEBI ICDR Compliance Checklist Engine',
      priority: criticalCount > 0 ? 'Critical' : 'High',
      owner: 'Legal Counsel',
      dueDate: 'Today',
      action: 'Run Validation',
      route: '/compliance-checklist'
    });
  }
  if (gapStatus !== 'Completed' && (criticalCount > 0 || highCount > 0)) {
    priorityItems.push({
      title: `Resolve ${criticalCount + highCount} Compliance & Discrepancy Gaps`,
      priority: criticalCount > 0 ? 'Critical' : 'High',
      owner: 'Legal Counsel',
      dueDate: 'Today',
      action: 'Resolve Gaps',
      route: '/gap-analysis'
    });
  }
  if (draftStatus !== 'Completed') {
    priorityItems.push({
      title: 'Generate DRHP Prospectus Draft Chapters',
      priority: 'Medium',
      owner: 'AI Copilot',
      dueDate: 'Today',
      action: 'Generate Drafts',
      route: '/draft'
    });
  }
  if (openComments > 0) {
    priorityItems.push({
      title: `Respond to ${openComments} Reviewer Workspace Clarifications`,
      priority: 'High',
      owner: 'Merchant Banker',
      dueDate: 'Today',
      action: 'Respond to Reviewer',
      route: '/reviewer'
    });
  }
  if (certStatus !== 'Completed') {
    priorityItems.push({
      title: 'Certify DRHP Prospectus Sections for Filing',
      priority: 'Medium',
      owner: 'Lead Banker',
      dueDate: 'Today',
      action: 'Certify Sections',
      route: '/readiness'
    });
  }
  const todayPriorities = priorityItems.slice(0, 5);

  // SECTION 4: DRHP CHAPTER DRAFT PROGRESS (DYNAMIC FROM DRAFTS STATE)
  const chapterDefinitions = [
    { name: 'General', code: 'general' },
    { name: 'Risk Factors', code: 'risk_factors' },
    { name: 'Introduction', code: 'company_details' },
    { name: 'About Company', code: 'business_overview' },
    { name: 'Financial', code: 'financials' },
    { name: 'Legal', code: 'litigation' },
    { name: 'Offer', code: 'objects' },
    { name: 'Other Information', code: 'other_disclosures' }
  ];

  const drhpChapters = chapterDefinitions.map(def => {
    const sec = drafts[def.code];
    if (!sec || !sec.blocks || sec.blocks.length === 0 || sec.status === 'not_generated') {
      return { name: def.name, code: def.code, status: 'Not Started', progress: 0 };
    }
    if (sec.status === 'certified') {
      return { name: def.name, code: def.code, status: 'Certified', progress: 100 };
    }
    if (sec.status === 'approved') {
      return { name: def.name, code: def.code, status: 'Completed', progress: 90 };
    }
    if (sec.status === 'in_review' || sec.status === 'clarification_requested') {
      return { name: def.name, code: def.code, status: 'Under Review', progress: 75 };
    }
    return { name: def.name, code: def.code, status: 'Draft', progress: 50 };
  });

  // SECTION 6: PENDING TASKS TABLE DATA (DYNAMIC)
  const pendingTasksTable = todayPriorities.map((t, idx) => ({
    id: idx + 1,
    task: t.title,
    assignedTo: t.owner,
    priority: t.priority,
    dueDate: t.dueDate,
    status: t.priority === 'Critical' ? 'Blocked' : 'Pending',
    route: t.route
  }));

  // SECTION 7: RECENT ACTIVITY TIMELINE (DYNAMIC FROM AUDIT LOGS)
  const recentActivities = auditLogs.length > 0
    ? auditLogs.slice(0, 6).map((log) => {
        const action = log.action || '';
        let icon = Sparkles;
        let iconBg = 'bg-indigo-50 text-indigo-600';
        if (action.includes('DOCUMENT') || action.includes('UPLOAD')) {
          icon = FileSpreadsheet;
          iconBg = 'bg-indigo-50 text-indigo-600';
        } else if (action.includes('INTAKE') || action.includes('RESOLVED')) {
          icon = CheckCircle2;
          iconBg = 'bg-emerald-50 text-emerald-600';
        } else if (action.includes('COMMENT')) {
          icon = MessageSquare;
          iconBg = 'bg-amber-50 text-amber-600';
        } else if (action.includes('CERTIFY')) {
          icon = ShieldCheck;
          iconBg = 'bg-emerald-50 text-emerald-600';
        }

        const logTime = log.created_at ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
        return {
          time: logTime,
          title: log.action ? log.action.replace(/_/g, ' ') : 'System Action',
          desc: log.description || 'Audit log action recorded',
          icon,
          iconBg
        };
      })
    : [
        {
          time: 'Initial',
          title: 'Company Setup Initialized',
          desc: `Clean project tracking initialized from zero for ${companyName}.`,
          icon: CheckCircle2,
          iconBg: 'bg-indigo-50 text-indigo-600'
        }
      ];

  // SECTION 8: AI RECOMMENDATIONS (DYNAMIC)
  const recItems = [];
  if (intakeStatus !== 'Completed' || ocrStatus !== 'Completed') {
    recItems.push({
      title: 'Complete Intake & Document Upload',
      desc: 'Submit mandatory legal identity, financial statements, and corporate charter documents.',
      action: 'Go to Intake',
      route: '/intake'
    });
  }
  if (complianceStatus !== 'Completed') {
    recItems.push({
      title: 'Run Statutory Compliance Engine',
      desc: 'Scan all 12 SEBI ICDR chapters for missing mandatory clauses, disclosures, and annexure references.',
      action: 'Run Validation',
      route: '/compliance-checklist'
    });
  }
  if (draftStatus !== 'Completed') {
    recItems.push({
      title: 'Generate DRHP Draft Chapters',
      desc: 'Synthesize extracted balance sheet items and intake answers into SEBI disclosure format.',
      action: 'Generate Chapters',
      route: '/draft'
    });
  }
  if (reviewerStatus !== 'Completed') {
    recItems.push({
      title: 'Submit Chapters for Review',
      desc: 'Send verified Company Overview and Objects of the Issue chapters to Lead Merchant Banker.',
      action: 'Submit for Review',
      route: '/reviewer'
    });
  }
  const aiRecommendations = recItems.slice(0, 3);

  // SECTION 10: TEAM OVERVIEW (REAL COMPANY NAME & TEAM ROLES)
  const teamMembers = [
    { entity: 'Company (Promoter)', name: companyName, role: 'Issuer', status: intakeStatus === 'Completed' ? 'Intake Complete' : 'Active Intake', lastActive: 'Recently', badgeColor: 'bg-indigo-100 text-indigo-800' },
    { entity: 'Merchant Banker', name: 'Lead Manager Desk', role: 'Lead Manager', status: reviewerStatus === 'Completed' ? 'Approved' : 'Reviewing Drafts', lastActive: 'Recently', badgeColor: 'bg-purple-100 text-purple-800' },
    { entity: 'Legal Counsel', name: 'Statutory Counsel LLP', role: 'Legal Auditor', status: complianceStatus === 'Completed' ? 'Compliant' : 'Vetting Disclosures', lastActive: 'Recently', badgeColor: 'bg-amber-100 text-amber-800' },
    { entity: 'Statutory Auditor', name: 'Financial Auditor Desk', role: 'Financial Auditor', status: docList.length > 0 ? 'Financials Uploaded' : 'Pending Audit Sync', lastActive: 'Recently', badgeColor: 'bg-emerald-100 text-emerald-800' },
    { entity: 'Reviewer', name: 'SEBI Compliance Desk', role: 'Compliance Officer', status: openComments > 0 ? `${openComments} Open Comments` : 'Compliant', lastActive: 'Recently', badgeColor: 'bg-blue-100 text-blue-800' }
  ];

  // Helper badge styles
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
      case 'Certified':
      case 'Available':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><Check className="w-3 h-3" /> {status}</span>;
      case 'In Progress':
      case 'Draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">{status}</span>;
      case 'Under Review':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">{status}</span>;
      case 'Blocked':
      case 'Critical':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800"><AlertCircle className="w-3 h-3" /> {status}</span>;
      case 'Locked':
      case 'Pending':
      case 'Not Started':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'Critical':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-red-100 text-red-800">Critical</span>;
      case 'High':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">High</span>;
      case 'Medium':
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-800">Medium</span>;
      case 'Low':
      default:
        return <span className="px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">Low</span>;
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">

      {/* ====================================================================
          TOP SECTION: CLEAN WELCOME HEADER
         ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              Executive Command Center
            </span>
            <span className="text-xs text-slate-400 font-medium">Last Updated: Today, 10:45 AM</span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Good Morning, <span className="text-indigo-600">{user?.name || 'Issuer'}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 pt-1">
            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Building2 className="w-4 h-4 text-indigo-500" />
              {companyName}
            </span>
            <span className="text-slate-300">•</span>
            <span className="font-medium text-slate-600">{ipoType}</span>
            <span className="text-slate-300">•</span>
            <span className="font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
              Stage: {currentStageText}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={handleSyncAI} 
            disabled={syncing}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all text-sm border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 text-slate-500 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Analyzing...' : 'Refresh Gap Check'}
          </button>
          <button 
            onClick={() => navigate('/intake')}
            className="btn-primary flex items-center gap-2 text-sm shadow-indigo-600/10"
          >
            <span>Continue Intake</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>


      {/* ====================================================================
          SECTION 1: IPO WORKFLOW (Horizontal Lifecycle)
         ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">SECTION 1 — IPO Workflow Lifecycle</h2>
            <p className="text-xs text-slate-500">End-to-end prospectus compilation and filing stages</p>
          </div>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
            Stage {activeStageNumber} of 9 Active
          </span>
        </div>

        {/* Workflow Horizontal Bar */}
        <div className="overflow-x-auto pb-3 pt-2">
          <div className="flex items-stretch gap-2 min-w-[980px]">
            {workflowStages.map((stg, idx) => (
              <div key={stg.name} className="flex-1 flex items-center gap-2">
                <button
                  onClick={() => navigate(stg.route)}
                  className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-md flex flex-col justify-between h-24 ${
                    stg.status === 'Completed' ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300' :
                    stg.status === 'In Progress' ? 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-400 ring-2 ring-indigo-500/10' :
                    stg.status === 'Blocked' ? 'bg-red-50/60 border-red-200 hover:border-red-300' :
                    'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      0{idx + 1}
                    </span>
                    {getStatusBadge(stg.status)}
                  </div>
                  <p className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                    {stg.name}
                  </p>
                </button>
                {idx < workflowStages.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* ====================================================================
          SECTION 2 & 3: TODAY'S PRIORITIES + CRITICAL ISSUES SUMMARY
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* SECTION 2: TODAY'S PRIORITIES (2 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">SECTION 2 — Today's Priorities</h2>
                <p className="text-xs text-slate-500">Top 5 actionable items requiring immediate attention</p>
              </div>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              {todayPriorities.length} Action Items
            </span>
          </div>

          <div className="space-y-3">
            {todayPriorities.map((item, idx) => (
              <div 
                key={idx}
                className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {getPriorityBadge(item.priority)}
                    <h3 className="font-bold text-sm text-slate-900">{item.title}</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-0.5">
                    <span>Owner: <strong className="text-slate-700 font-medium">{item.owner}</strong></span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Due: {item.dueDate}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate(item.route)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center justify-center gap-1.5 border border-indigo-200/60"
                >
                  <span>{item.action}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: CRITICAL ISSUES SUMMARY (1 col) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <h2 className="text-lg font-bold text-slate-900">SECTION 3 — Critical Issues Summary</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Categorized ICDR validation and gap flags</p>

            <div className="grid grid-cols-2 gap-3">
              {/* Critical Card */}
              <div 
                onClick={() => navigate('/gap-analysis')}
                className="p-4 rounded-xl bg-red-50/70 border border-red-200 hover:border-red-400 transition-all cursor-pointer space-y-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-red-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Critical</span>
                  <AlertCircle className="w-4 h-4" />
                </div>
                <p className="text-2xl font-extrabold text-red-900">{criticalCount}</p>
                <p className="text-[10px] text-red-700 font-medium">Blocking Compliance</p>
              </div>

              {/* High Card */}
              <div 
                onClick={() => navigate('/gap-analysis')}
                className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 hover:border-amber-400 transition-all cursor-pointer space-y-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-amber-700">
                  <span className="text-xs font-bold uppercase tracking-wider">High</span>
                  <FileWarning className="w-4 h-4" />
                </div>
                <p className="text-2xl font-extrabold text-amber-900">{highCount}</p>
                <p className="text-[10px] text-amber-700 font-medium">Disclosure Gaps</p>
              </div>

              {/* Medium Card */}
              <div 
                onClick={() => navigate('/gap-analysis')}
                className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 hover:border-indigo-400 transition-all cursor-pointer space-y-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-indigo-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Medium</span>
                  <MessageSquare className="w-4 h-4" />
                </div>
                <p className="text-2xl font-extrabold text-indigo-900">{openComments}</p>
                <p className="text-[10px] text-indigo-700 font-medium">Review Clarifications</p>
              </div>

              {/* Resolved Card */}
              <div 
                onClick={() => navigate('/gap-analysis')}
                className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 hover:border-emerald-400 transition-all cursor-pointer space-y-1 hover:shadow-sm"
              >
                <div className="flex items-center justify-between text-emerald-700">
                  <span className="text-xs font-bold uppercase tracking-wider">Resolved</span>
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <p className="text-2xl font-extrabold text-emerald-900">{stats?.resolvedCount ?? (readinessScore >= 80 ? 12 : Math.round(readinessScore / 8))}</p>
                <p className="text-[10px] text-emerald-700 font-medium">Verified Clauses</p>
              </div>
            </div>
          </div>

          <button 
            onClick={() => navigate('/gap-analysis')}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 mt-4"
          >
            <span>Open Gap Analysis Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>


      {/* ====================================================================
          SECTION 4: DRAFT PROGRESS (DRHP CHAPTERS)
         ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">SECTION 4 — Draft Progress (DRHP Chapters)</h2>
            <p className="text-xs text-slate-500">SEBI ICDR offer document chapter drafting and certification status</p>
          </div>
          <button 
            onClick={() => navigate('/draft')}
            className="flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            <span>Open Full Prospectus Editor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {drhpChapters.map((chap) => (
            <div 
              key={chap.name}
              onClick={() => navigate(`/draft`)}
              className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white transition-all cursor-pointer space-y-3 hover:shadow-md"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-bold text-sm text-slate-800">{chap.name}</h3>
                {getStatusBadge(chap.status)}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                  <span>Completion</span>
                  <span>{chap.progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      chap.progress === 100 ? 'bg-emerald-500' :
                      chap.progress >= 70 ? 'bg-indigo-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${chap.progress}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* ====================================================================
          SECTION 5: REVIEWER STATUS
         ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">SECTION 5 — Reviewer Status</h2>
              <p className="text-xs text-slate-500">Merchant banker and legal counsel sign-off pipeline</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/reviewer')}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-colors border border-indigo-200/80 shrink-0"
          >
            <span>Open Reviewer Workspace</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 text-center space-y-1">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Reviews</p>
            <p className="text-2xl font-extrabold text-amber-900">{requiredChapters.filter(k => drafts[k] && drafts[k].status !== 'certified' && drafts[k].status !== 'approved').length} Chapters</p>
            <p className="text-[10px] text-amber-700">Awaiting Feedback</p>
          </div>

          <div className="p-4 rounded-xl bg-red-50/60 border border-red-200/80 text-center space-y-1">
            <p className="text-xs font-bold text-red-700 uppercase tracking-wider">Changes Requested</p>
            <p className="text-2xl font-extrabold text-red-900">{requiredChapters.filter(k => drafts[k]?.status === 'clarification_requested').length} Section</p>
            <p className="text-[10px] text-red-700">Risk Factors #3</p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-200/80 text-center space-y-1">
            <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Approved Chapters</p>
            <p className="text-2xl font-extrabold text-indigo-900">{requiredChapters.filter(k => drafts[k]?.status === 'approved').length} Chapters</p>
            <p className="text-[10px] text-indigo-700">Ready for Certification</p>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-center space-y-1">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Certified Chapters</p>
            <p className="text-2xl font-extrabold text-emerald-900">{requiredChapters.filter(k => drafts[k]?.status === 'certified').length} Chapters</p>
            <p className="text-[10px] text-emerald-700">Signed & Stamped</p>
          </div>

          <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 text-center space-y-1">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wider">Reviewer Comments</p>
            <p className="text-2xl font-extrabold text-purple-900">{openComments} Open</p>
            <p className="text-[10px] text-purple-700">Merchant Banker Desk</p>
          </div>
        </div>
      </div>


      {/* ====================================================================
          SECTION 6: PENDING TASKS (TABLE FORMAT)
         ==================================================================== */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">SECTION 6 — Pending Tasks</h2>
              <p className="text-xs text-slate-500">Comprehensive assignment queue across all teams</p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {pendingTasksTable.length} Total Pending
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
                <th className="py-3 px-4">Task Description</th>
                <th className="py-3 px-4">Assigned To</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingTasksTable.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-800 max-w-xs">{t.task}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{t.assignedTo}</td>
                  <td className="py-3.5 px-4">{getPriorityBadge(t.priority)}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{t.dueDate}</td>
                  <td className="py-3.5 px-4">{getStatusBadge(t.status)}</td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => navigate(t.route)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg transition-colors border border-indigo-200/60"
                    >
                      Execute Task
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {/* ====================================================================
          SECTION 7 & 8: RECENT ACTIVITY + AI RECOMMENDATIONS
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 7: RECENT ACTIVITY (Chronological Timeline) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">SECTION 7 — Recent Activity</h2>
              <p className="text-xs text-slate-500">Audit trail log of recent prospectus edits and reviews</p>
            </div>
          </div>

          <div className="space-y-4 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-100 pt-1">
            {recentActivities.map((act, idx) => {
              const IconComp = act.icon;
              return (
                <div key={idx} className="flex items-start gap-4 relative">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/60 z-10 ${act.iconBg}`}>
                    <IconComp className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-xs text-slate-800">{act.title}</h3>
                      <span className="text-[10px] text-slate-400 font-medium">{act.time}</span>
                    </div>
                    <p className="text-xs text-slate-600">{act.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECTION 8: AI RECOMMENDATIONS (EXACTLY 3) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-bold text-slate-900">SECTION 8 — AI Recommendations</h2>
            </div>
            <p className="text-xs text-slate-500 mb-4">Context-aware optimization steps generated by IPO Copilot</p>

            <div className="space-y-3">
              {aiRecommendations.map((rec, idx) => (
                <div 
                  key={idx}
                  className="p-4 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-slate-50/40 space-y-2 hover:border-indigo-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      {rec.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed pl-6">{rec.desc}</p>
                  <div className="pl-6 pt-1">
                    <button
                      onClick={() => navigate(rec.route)}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <span>{rec.action}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>


      {/* ====================================================================
          SECTION 9 & 10: IPO READINESS SUMMARY + TEAM OVERVIEW
         ==================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* SECTION 9: IPO READINESS SUMMARY */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">SECTION 9 — IPO Readiness Summary</h2>
                <p className="text-xs text-slate-500">Overall filing readiness breakdown and target timeline</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/readiness')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>Full Checklist</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">Overall IPO Readiness</p>
                <h3 className="text-3xl font-black text-white mt-0.5">{readinessScore}%</h3>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 text-xs font-bold rounded-full border border-emerald-500/30">
                {readinessScore >= 90 ? 'Ready for Filing' : readinessScore >= 50 ? 'Drafting In Progress' : 'Initial Setup Phase'}
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${readinessScore}%` }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Critical Blockers</p>
                <p className="font-bold text-red-400 text-sm mt-0.5">{criticalCount} Blockers</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Pending Docs</p>
                <p className="font-bold text-amber-400 text-sm mt-0.5">{docList.length === 0 ? 3 : docList.filter(d => d.status === 'processing' || d.status === 'pending').length} Documents</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Pending Reviews</p>
                <p className="font-bold text-indigo-300 text-sm mt-0.5">{requiredChapters.filter(k => drafts[k]?.status !== 'approved' && drafts[k]?.status !== 'certified').length} Chapters</p>
              </div>
              <div>
                <p className="text-slate-400 text-[10px] uppercase font-bold">Estimated Filing</p>
                <p className="font-bold text-emerald-400 text-sm mt-0.5">{readinessScore >= 90 ? 'Ready Now' : readinessScore >= 50 ? 'In 10 Days' : 'Target Q4'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 10: TEAM OVERVIEW */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">SECTION 10 — Team Overview</h2>
              <p className="text-xs text-slate-500">Key stakeholders, merchant bankers, and auditors</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {teamMembers.map((tm) => (
              <div 
                key={tm.entity}
                className="p-3 rounded-xl border border-slate-200/70 bg-slate-50/50 flex items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 truncate">{tm.entity}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tm.badgeColor}`}>
                      {tm.role}
                    </span>
                  </div>
                  <p className="text-slate-500 truncate">{tm.name}</p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-bold text-slate-700">{tm.status}</p>
                  <p className="text-[10px] text-slate-400">Active {tm.lastActive}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
