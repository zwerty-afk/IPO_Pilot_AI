import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getIntake, getDocuments } from '../services/api';
import { useDraftDocument } from '../context/DraftDocumentContext';
import { computeComplianceChecklist, COMPLIANCE_MAX } from '../utils/complianceRules';
import {
  ListChecks,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  Loader2,
  Filter,
  Search,
  ShieldCheck,
  FileCheck2,
  FileText,
  RefreshCw,
  Building2,
  Scale
} from 'lucide-react';

export default function ComplianceChecklistPage() {
  const { user } = useAuth();
  const { readiness: centralReadiness } = useDraftDocument();
  const complianceScore = centralReadiness?.stages?.compliance?.score ?? 0;

  const [loading, setLoading] = useState(true);
  const [intakeData, setIntakeData] = useState({});
  const [documents, setDocuments] = useState([]);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const companyId = user?.companyId || localStorage.getItem('ipo_company_id') || '';

  const loadData = async () => {
    if (!companyId) {
      setIntakeData({});
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [intakeRes, docsRes] = await Promise.all([
        getIntake(companyId),
        getDocuments(companyId)
      ]);
      setIntakeData(intakeRes.data || intakeRes || {});
      setDocuments(docsRes.data || docsRes || []);
    } catch (err) {
      console.error("Error loading compliance checklist data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('ipo-company-changed', handleUpdate);
    return () => {
      window.removeEventListener('ipo-company-changed', handleUpdate);
    };
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Running Statutory Compliance Validation Engine...</span>
      </div>
    );
  }

  // ─── MASTER COMPLIANCE RULE VALIDATION MATRIX (shared with the readiness score) ──
  const rulesList = computeComplianceChecklist(intakeData, documents);

  // Filtering
  const categories = ['all', 'Corporate & Governance', 'Financial Eligibility', 'Promoters & Capital', 'Legal & Statutory', 'Issue Structure'];

  const filteredRules = rulesList.filter(r => {
    if (selectedCategory !== 'all' && r.category !== selectedCategory) return false;
    if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return r.requirementName.toLowerCase().includes(q) || 
             r.applicableRule.toLowerCase().includes(q) ||
             r.sourceDocument.toLowerCase().includes(q) ||
             r.id.toLowerCase().includes(q);
    }
    return true;
  });

  const passCount = rulesList.filter(r => r.status === 'Pass').length;
  const failCount = rulesList.filter(r => r.status === 'Fail').length;
  const warnCount = rulesList.filter(r => r.status === 'Warning').length;
  const naCount = rulesList.filter(r => r.status === 'Not Applicable').length;
  const passRatePct = Math.round((passCount / rulesList.length) * 100);

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      
      {/* Page Title & Rule Engine Summary Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
                  Rule Validation Engine
                </span>
                <h1 className="text-xl font-bold text-slate-900">Statutory Compliance Checklist</h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Verifying statutory, legal, financial, and document compliance against SEBI ICDR Regulations 2018 & Companies Act 2013.
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-validate Rules</span>
          </button>
        </div>

        {/* Stats Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block">Compliance Score</span>
            <span className="text-xl font-extrabold text-indigo-700 font-mono">{complianceScore} / {COMPLIANCE_MAX}</span>
            <span className="text-[10px] text-indigo-600/70 block mt-0.5">{passRatePct}% Pass Rate — {passCount} of {rulesList.length} Rules</span>
          </div>

          <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono block">Passed</span>
            <span className="text-xl font-extrabold text-emerald-600">{passCount}</span>
            <span className="text-[10px] text-emerald-600/70 block mt-0.5">Fully Verified</span>
          </div>

          <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 font-mono block">Failed</span>
            <span className="text-xl font-extrabold text-red-600">{failCount}</span>
            <span className="text-[10px] text-red-600/70 block mt-0.5">Mandatory Action Required</span>
          </div>

          <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-mono block">Warnings</span>
            <span className="text-xl font-extrabold text-amber-600">{warnCount}</span>
            <span className="text-[10px] text-amber-600/70 block mt-0.5">Pending Verification</span>
          </div>

          <div className="bg-slate-100/60 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono block">Not Applicable</span>
            <span className="text-xl font-extrabold text-slate-600">{naCount}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Exempted / Optional</span>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono mr-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat === 'all' ? 'All Regulations' : cat}
            </button>
          ))}
        </div>

        {/* Status Filter & Search Input */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="Pass">Pass Only</option>
            <option value="Fail">Fail Only</option>
            <option value="Warning">Warning Only</option>
            <option value="Not Applicable">Not Applicable</option>
          </select>

          <div className="relative flex-1 md:w-56">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rule or regulation..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-sans"
            />
          </div>
        </div>
      </div>

      {/* Statutory Rule Validation Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                <th className="py-3.5 px-4">Rule ID</th>
                <th className="py-3.5 px-4">Requirement Name</th>
                <th className="py-3.5 px-4">Applicable Regulation</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Points</th>
                <th className="py-3.5 px-4">Evidence Used</th>
                <th className="py-3.5 px-4">Source Document</th>
                <th className="py-3.5 px-4">Validation Result</th>
                <th className="py-3.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRules.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                    No compliance rules match the selected filter query.
                  </td>
                </tr>
              ) : (
                filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Rule ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-700 shrink-0">
                      {rule.id}
                    </td>

                    {/* Requirement Name */}
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {rule.requirementName}
                    </td>

                    {/* Applicable Regulation */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {rule.applicableRule}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {rule.status === 'Pass' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pass
                        </span>
                      )}
                      {rule.status === 'Fail' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                          <XCircle className="w-3 h-3 text-red-600" /> Fail
                        </span>
                      )}
                      {rule.status === 'Warning' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Warning
                        </span>
                      )}
                      {rule.status === 'Not Applicable' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <MinusCircle className="w-3 h-3 text-slate-400" /> N/A
                        </span>
                      )}
                    </td>

                    {/* Points Earned */}
                    <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                      <span className={rule.earnedPoints === rule.points ? 'text-emerald-600' : rule.earnedPoints > 0 ? 'text-amber-600' : 'text-slate-400'}>
                        {rule.earnedPoints} / {rule.points}
                      </span>
                    </td>

                    {/* Evidence Used */}
                    <td className="py-3.5 px-4 text-slate-700 leading-normal max-w-xs">
                      {rule.evidenceUsed}
                    </td>

                    {/* Source Document */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-900 font-medium">
                      {rule.sourceDocument}
                    </td>

                    {/* Validation Result */}
                    <td className="py-3.5 px-4 text-slate-800 font-medium max-w-xs">
                      {rule.validationResult}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-4 text-right font-mono text-[10px] text-slate-400 whitespace-nowrap">
                      {rule.timestamp}
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
