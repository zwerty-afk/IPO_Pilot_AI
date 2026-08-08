import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCompanyStatus, getIntake, getDocuments, getDrafts } from '../services/api';
import { useDraftDocument } from '../context/DraftDocumentContext';
import { SECTION_KEYS } from '../components/ChapterHealthSidebar';
import { stepQuestions, checkFieldAgainstDocuments } from '../data/intakeSchema';
import { classifyCompany, getIpoProfile } from '../data/companyClassifier';
import { 
  AlertTriangle, 
  AlertCircle, 
  ArrowUpRight, 
  CheckCircle2, 
  Loader2, 
  Filter, 
  Search,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Bookmark,
  Check,
  Clock,
  Layers,
  FileText,
  UploadCloud,
  Eye,
  RefreshCw,
  XCircle,
  MinusCircle
} from 'lucide-react';

export default function GapAnalysisPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { readiness: centralReadiness } = useDraftDocument();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);
  const [drafts, setDrafts] = useState({});

  // Category & Priority Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revalidating, setRevalidating] = useState(false);

  const companyId = localStorage.getItem('ipo_company_id') || 'aarav-precision';

  const loadData = async () => {
    try {
      setLoading(true);
      const [statusRes, intakeRes, docsRes, draftsRes] = await Promise.all([
        getCompanyStatus(companyId),
        getIntake(companyId),
        getDocuments(companyId),
        getDrafts(companyId)
      ]);
      setStats(statusRes.data || statusRes || {});
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
      setDrafts(draftsRes.data || draftsRes || {});
    } catch (err) {
      console.error("Error loading gap analysis data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Analyzing IPO Readiness & DRHP Consequence Impact...</span>
      </div>
    );
  }

  const classification = classifyCompany({ name: stats?.companyName }, intakeData, documents);
  const uploadedDocTypes = new Set((documents || []).map(d => d.doc_type));

  // ─── BUILD DYNAMIC IMPACT & CONSEQUENCE GAPS MATRIX ───────────────────────────
  const gapCategories = [
    'all',
    'Critical Gaps',
    'Financial Gaps',
    'Legal Gaps',
    'Governance Gaps',
    'Documentation Gaps',
    'Disclosure Gaps',
    'Data Quality Gaps',
    'Chapter Readiness Gaps'
  ];

  const allGapsList = [];
  const hasIntakeCompleted = Object.keys(intakeData || {}).some(k => intakeData[k] && Object.keys(intakeData[k]).length > 0);

  if (hasIntakeCompleted) {
    // 1. Critical Gap: Articles of Association (AOA) Missing
    if (!uploadedDocTypes.has('aoa')) {
    allGapsList.push({
      id: 'GAP-CRIT-AOA',
      title: 'Articles of Association (AOA) Missing',
      category: 'Critical Gaps',
      priority: 'Critical',
      description: 'The statutory Articles of Association charter document has not been uploaded to the repository.',
      whyGap: 'SEBI ICDR Regulations Schedule VI Part A mandates that the AOA must be attached to verify pre-emption rights, borrowing powers, and equity share restrictions prior to DRHP filing.',
      affectedChapters: ['Section V: About Our Company', 'Section VII: Legal and Other Information'],
      affectedSubsections: ['History and Certain Corporate Matters', 'Other Regulatory and Statutory Disclosures'],
      readinessImpact: '+8 Pts upon Remediation',
      generationImpact: 'Blocked',
      requiredDocs: ['Articles of Association (AOA.pdf)'],
      recommendedResolution: 'Upload the latest certified Articles of Association containing standard pre-emption clauses.',
      estimatedTime: '15 minutes',
      status: 'Unresolved',
      owner: 'Company Secretary',
      intakeStep: 'company_details',
      intakeField: 'aoa'
    });
  }

  // 2. Financial Gap: 3-Year Financial Statements
  const finCount = documents.filter(d => d.doc_type === 'financial_statements').length;
  if (finCount < 3) {
    allGapsList.push({
      id: 'GAP-FIN-AUDIT',
      title: '3-Year Audited Financial Statements Omitted',
      category: 'Financial Gaps',
      priority: 'Critical',
      description: `Only ${finCount} of 3 required annual audited financial statements are uploaded.`,
      whyGap: 'SEBI ICDR Schedule VI Part A Item (11) requires 3 consecutive years of audited restated accounts (FY23, FY24, FY25) certified by Statutory Auditors.',
      affectedChapters: ['Section VI: Financial Information', 'Section III: Introduction'],
      affectedSubsections: ['Restated Financial Information', 'Summary of Restated Financial Information', "Management's Discussion & Analysis"],
      readinessImpact: '+12 Pts upon Remediation',
      generationImpact: 'Incomplete',
      requiredDocs: ['Audited Financial Reports (FY23, FY24, FY25)'],
      recommendedResolution: 'Upload complete 3-year restated financial audit report certified by Statutory Auditors.',
      estimatedTime: '1 business day',
      status: 'In Progress',
      owner: 'CFO',
      intakeStep: 'financials',
      intakeField: 'financial_statements'
    });
  }

  // 3. Governance Gap: Board Resolution
  if (!uploadedDocTypes.has('board_resolution')) {
    allGapsList.push({
      id: 'GAP-GOV-BOARD',
      title: 'Certified Board Resolution Approving IPO Omitted',
      category: 'Governance Gaps',
      priority: 'High',
      description: 'Certified extract of the Board Resolution approving the IPO issue and appointing Lead Manager is unverified.',
      whyGap: 'Companies Act 2013 Sec 179(3) mandates explicit board resolution for fresh equity capital issuance.',
      affectedChapters: ['Section I: General Information'],
      affectedSubsections: ['Certain Corporate Matters', 'Details of the Offer'],
      readinessImpact: '+6 Pts upon Remediation',
      generationImpact: 'Warning',
      requiredDocs: ['Board Resolution Extract'],
      recommendedResolution: 'Upload certified copy of signed Board Resolution passed on or after Jan 1, 2025.',
      estimatedTime: '30 minutes',
      status: 'Unresolved',
      owner: 'Legal Team',
      intakeStep: 'company_details',
      intakeField: 'board_resolution'
    });
  }

  // 4. Legal Gap: Outstanding Material Litigation Disclosures
  if (!intakeData.rpt?.litigation_declared && !uploadedDocTypes.has('litigation_documents')) {
    allGapsList.push({
      id: 'GAP-LEG-LITIG',
      title: 'Material Litigation Register & Tax Demands Unverified',
      category: 'Legal Gaps',
      priority: 'High',
      description: 'Material civil/tax litigation register disclosures require explicit confirmation or supporting court filings.',
      whyGap: 'SEBI ICDR Schedule VI Part A Section VII mandates full disclosure of material civil, criminal, and tax proceedings against company & promoters.',
      affectedChapters: ['Section VII: Legal and Other Information'],
      affectedSubsections: ['Outstanding Litigation and Material Developments'],
      readinessImpact: '+7 Pts upon Remediation',
      generationImpact: 'Incomplete',
      requiredDocs: ['Litigation Affidavit / Legal Register'],
      recommendedResolution: 'Complete Legal Litigation Disclosure in Intake Step 7 or upload Legal Auditor opinion.',
      estimatedTime: '1 hour',
      status: 'Unresolved',
      owner: 'Legal Counsel',
      intakeStep: 'rpt',
      intakeField: 'litigation_declared'
    });
  }

  // 5. Documentation Gap: Shareholding Pattern Statement
  if (!uploadedDocTypes.has('shareholding_pattern')) {
    allGapsList.push({
      id: 'GAP-DOC-SHARE',
      title: 'Pre-Issue Equity Shareholding Pattern Document Omitted',
      category: 'Documentation Gaps',
      priority: 'Medium',
      description: 'Pre-issue capital structure breakdown and shareholding pattern statement are pending file upload.',
      whyGap: 'SEBI (LODR) Regulations 2015 Reg 31 & ICDR Reg 14 require certified pre-issue shareholding pattern statement.',
      affectedChapters: ['Section III: Capital Structure'],
      affectedSubsections: ['Capital Structure', 'Shareholding Pattern'],
      readinessImpact: '+4 Pts upon Remediation',
      generationImpact: 'Warning',
      requiredDocs: ['Shareholding Pattern Statement (PDF)'],
      recommendedResolution: 'Upload latest shareholding pattern statement certified by Company Secretary.',
      estimatedTime: '20 minutes',
      status: 'Unresolved',
      owner: 'Company Secretary',
      intakeStep: 'promoters',
      intakeField: 'shareholding_pattern'
    });
  }

  // 6. Chapter Readiness Gap: Uncertified DRHP Chapters
  const uncertifiedCount = Object.values(drafts).filter(d => d.status !== 'certified').length;
  if (uncertifiedCount > 0) {
    allGapsList.push({
      id: 'GAP-CHAP-CERT',
      title: 'Merchant Banker Chapter Narrative Certification Pending',
      category: 'Chapter Readiness Gaps',
      priority: 'Medium',
      description: `${uncertifiedCount} DRHP SEBI chapters remain in draft composition mode and require lead manager signoff.`,
      whyGap: 'Merchant Banker must review and certify narrative disclosure compliance before filing DRHP with SEBI.',
      affectedChapters: ['Section VI: Financial Information', 'Section V: About Our Company'],
      affectedSubsections: ['Restated Financial Information', 'Our Business'],
      readinessImpact: '+5 Pts upon Remediation',
      generationImpact: 'Incomplete',
      requiredDocs: ['Lead Manager Due Diligence Certificate'],
      recommendedResolution: 'Review SEBI disclosure narrative in Chapter Editor and click "Certify Chapter".',
      estimatedTime: '1 hour',
      status: 'Unresolved',
      owner: 'Merchant Banker',
      intakeStep: 'company_details',
      intakeField: 'merchant_banker'
    });
  }
  }

  // Filtering
  const filteredGaps = allGapsList.filter(g => {
    if (selectedCategory !== 'all' && g.category !== selectedCategory) return false;
    if (selectedPriority !== 'all' && g.priority !== selectedPriority) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return g.title.toLowerCase().includes(q) ||
             g.description.toLowerCase().includes(q) ||
             g.whyGap.toLowerCase().includes(q) ||
             g.affectedChapters.some(c => c.toLowerCase().includes(q));
    }
    return true;
  });

  const handleRevalidate = async () => {
    setRevalidating(true);
    await loadData();
    setTimeout(() => setRevalidating(false), 800);
  };

  const handleResolveNow = (gap) => {
    navigate(`/intake?step=${gap.intakeStep}&field=${gap.intakeField}`);
  };

  const criticalCount = allGapsList.filter(g => g.priority === 'Critical').length;
  const highCount = allGapsList.filter(g => g.priority === 'High').length;
  const warnCount = allGapsList.filter(g => g.priority === 'Medium' || g.priority === 'Low' || g.priority === 'Warning').length;
  const blockedCount = allGapsList.filter(g => g.generationImpact === 'Blocked').length;
  const totalPenalty = criticalCount * 8 + highCount * 5;

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Page Title & Readiness Analysis Header (Identical design to Compliance Checklist) */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                  Readiness & Consequence Engine
                </span>
                <h1 className="text-xl font-bold text-slate-900">Gap Analysis</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Identifying disclosure, documentation, legal, financial and governance gaps before DRHP generation.
              </p>
            </div>
          </div>

          <button
            onClick={handleRevalidate}
            disabled={revalidating}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${revalidating ? 'animate-spin' : ''}`} />
            <span>Re-validate Gap Analysis</span>
          </button>
        </div>

        {/* Stats Metrics Cards (Identical layout to Compliance Checklist) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 font-mono block">Critical Gaps</span>
            <span className="text-xl font-extrabold text-red-600">{criticalCount}</span>
            <span className="text-[10px] text-red-600/70 block mt-0.5">Mandatory Resolution Required</span>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-mono block">High Priority</span>
            <span className="text-xl font-extrabold text-amber-600">{highCount}</span>
            <span className="text-[10px] text-amber-600/70 block mt-0.5">Needs Attention</span>
          </div>

          <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 font-mono block">Warnings</span>
            <span className="text-xl font-extrabold text-blue-600">{warnCount}</span>
            <span className="text-[10px] text-blue-600/70 block mt-0.5">Review Recommended</span>
          </div>

          <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 font-mono block">Blocked DRHP Chapters</span>
            <span className="text-xl font-extrabold text-rose-600">{blockedCount}</span>
            <span className="text-[10px] text-rose-600/70 block mt-0.5">Draft Generation Blocked</span>
          </div>

          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block">Current Readiness</span>
            <span className="text-xl font-extrabold text-indigo-700 font-mono">{centralReadiness?.score ?? 0}%</span>
            <span className="text-[10px] text-indigo-600/70 block mt-0.5 font-mono">{centralReadiness?.score ?? 0} / 100 Pts</span>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search (Identical to Compliance Checklist) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {gapCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Gap Categories' : cat}
            </button>
          ))}
        </div>

        {/* Priority Filter & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="Critical">Critical Only</option>
            <option value="High">High Only</option>
            <option value="Medium">Medium Only</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search gap title, chapter, doc..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* GAP ANALYSIS TABLE MATRIX (Matching Compliance Checklist Table) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden font-sans">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Gap ID & Priority</th>
                <th className="py-3.5 px-4">Gap Name & Category</th>
                <th className="py-3.5 px-4">Affected DRHP Chapters</th>
                <th className="py-3.5 px-4">Readiness Impact</th>
                <th className="py-3.5 px-4">Owner & Time</th>
                <th className="py-3.5 px-4">DRHP Assembly</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredGaps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                    No gaps match the selected filter query. All statutory items in this category are clear.
                  </td>
                </tr>
              ) : (
                filteredGaps.map((gap) => (
                  <tr key={gap.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Gap ID & Priority */}
                    <td className="py-3.5 px-4 space-y-1 align-top">
                      <span className="font-mono font-bold text-indigo-700 block">
                        {gap.id}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono uppercase ${
                        gap.priority === 'Critical'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : gap.priority === 'High'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      }`}>
                        {gap.priority}
                      </span>
                    </td>

                    {/* Gap Title & Category */}
                    <td className="py-3.5 px-4 space-y-1 max-w-xs align-top">
                      <div className="font-bold text-slate-900 flex items-start gap-1.5">
                        <AlertTriangle className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${gap.priority === 'Critical' ? 'text-red-500' : 'text-amber-500'}`} />
                        <span>{gap.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal">
                        {gap.description}
                      </p>
                      <span className="inline-block text-[9px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 uppercase">
                        {gap.category}
                      </span>
                    </td>

                    {/* Affected DRHP Chapters */}
                    <td className="py-3.5 px-4 max-w-xs align-top space-y-1">
                      <div className="flex flex-wrap gap-1">
                        {gap.affectedChapters.map((ch, cidx) => (
                          <span key={cidx} className="px-2 py-0.5 bg-indigo-50 text-indigo-800 text-[10px] font-medium rounded border border-indigo-100 block truncate">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Readiness Impact */}
                    <td className="py-3.5 px-4 font-mono font-bold text-red-600 align-top">
                      {gap.readinessImpact}
                    </td>

                    {/* Owner & Time */}
                    <td className="py-3.5 px-4 font-mono align-top space-y-0.5">
                      <span className="font-bold text-slate-700 block">{gap.owner}</span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                        <Clock className="w-3 h-3 text-slate-400" /> {gap.estimatedTime}
                      </span>
                    </td>

                    {/* DRHP Assembly Impact */}
                    <td className="py-3.5 px-4 font-mono align-top">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        gap.generationImpact === 'Blocked'
                          ? 'bg-red-100 text-red-800 font-extrabold'
                          : gap.generationImpact === 'Incomplete'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-blue-50 text-blue-700'
                      }`}>
                        {gap.generationImpact}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right align-top shrink-0">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleResolveNow(gap)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer flex items-center gap-1"
                        >
                          <span>Open Intake</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>

                        <button
                          onClick={() => navigate(`/intake?step=${gap.intakeStep}`)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          View Evidence
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
