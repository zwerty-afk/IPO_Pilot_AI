import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getVerificationSummary,
  getVerificationDetail,
  rerunVerification,
  verificationAction,
  getVerificationHistory
} from '../services/api';
import {
  Fingerprint,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  FileText,
  History,
  Building2,
  UserCheck,
  FlagTriangleRight,
  BadgeCheck,
  Info,
  ExternalLink
} from 'lucide-react';

// ─── status → icon/label/classes, shared across every card and panel ──────────
// Full class strings (not built via template literals) so Tailwind's static
// content scanner actually picks them up at build time.
const STATUS_META = {
  verified:         { label: 'Verified',        icon: '✓',  pillClass: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  review_required:  { label: 'Review Required',  icon: '⚠',  pillClass: 'bg-amber-50 text-amber-700 border-amber-200',       Icon: AlertTriangle },
  critical:         { label: 'Critical Issue',   icon: '🔴', pillClass: 'bg-red-50 text-red-700 border-red-200',             Icon: ShieldAlert },
  pending:          { label: 'Pending',          icon: '⏳', pillClass: 'bg-slate-100 text-slate-600 border-slate-200',      Icon: Clock }
};

const MODULE_META = {
  gst:                    { label: 'GST Verification', icon: FileText, desc: 'GSTIN, legal name & registration details' },
  pan:                    { label: 'PAN Verification', icon: BadgeCheck, desc: 'PAN identity match' },
  cin:                    { label: 'MCA / CIN Verification', icon: Building2, desc: 'Corporate registration status' },
  document_authenticity:  { label: 'Document Authenticity', icon: ShieldCheck, desc: 'Uploaded document consistency' },
  identity_cross:         { label: 'Identity Cross-Verification', icon: Fingerprint, desc: 'Cross-check identity across sources' },
  verification_history:   { label: 'Verification History', icon: History, desc: 'Audit trail of all verification actions' }
};

function StatusPill({ status }) {
  const meta = STATUS_META[status] || STATUS_META.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${meta.pillClass}`}>
      <span>{meta.icon}</span>{meta.label}
    </span>
  );
}

function DemoBadge({ provider }) {
  return (
    <div className="flex items-start gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800 font-medium">
      <Info className="w-3 h-3 shrink-0 mt-0.5" />
      <span>{provider || 'Demo Verification Service — not connected to a live authoritative API.'}</span>
    </div>
  );
}

export default function FraudVerificationPage() {
  const { user } = useAuth();
  const isReviewer = user?.role === 'reviewer';
  const companyId = user?.companyId || localStorage.getItem('ipo_company_id') || '';

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [activeType, setActiveType] = useState('gst');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyAll, setHistoryAll] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [activeTab, setActiveTab] = useState('comparison');

  const loadSummary = useCallback(async () => {
    if (!companyId) { setSummary(null); setLoading(false); return; }
    try {
      setLoading(true);
      const res = await getVerificationSummary(companyId);
      setSummary(res.data || res);
    } catch (err) {
      console.error('Failed to load verification summary:', err);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const loadDetail = useCallback(async (type) => {
    if (!companyId || !type) return;
    if (type === 'verification_history') {
      try {
        const res = await getVerificationHistory(companyId);
        setHistoryAll(res.data || res || []);
      } catch (err) {
        console.error('Failed to load verification history:', err);
        setHistoryAll([]);
      }
      return;
    }
    try {
      setDetailLoading(true);
      const res = await getVerificationDetail(companyId, type);
      setDetail(res.data || res);
      setActiveTab('comparison');
    } catch (err) {
      console.error('Failed to load verification detail:', err);
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadSummary();
    const onCompanyChange = () => loadSummary();
    window.addEventListener('ipo-company-changed', onCompanyChange);
    return () => window.removeEventListener('ipo-company-changed', onCompanyChange);
  }, [loadSummary]);

  useEffect(() => {
    loadDetail(activeType);
  }, [activeType, loadDetail]);

  const handleRerun = async () => {
    if (!isReviewer) return;
    setActionBusy(true);
    try {
      await rerunVerification(companyId, activeType);
      await Promise.all([loadDetail(activeType), loadSummary()]);
    } catch (err) {
      console.error('Re-run failed:', err);
    } finally {
      setActionBusy(false);
    }
  };

  const handleAction = async (action) => {
    if (!isReviewer) return;
    setActionBusy(true);
    try {
      await verificationAction(companyId, activeType, action, noteDraft);
      setNoteDraft('');
      await Promise.all([loadDetail(activeType), loadSummary()]);
    } catch (err) {
      console.error('Verification action failed:', err);
    } finally {
      setActionBusy(false);
    }
  };

  if (!isReviewer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3 text-center">
        <ShieldAlert className="w-10 h-10 text-red-400" />
        <p className="text-sm text-slate-600 font-medium">Fraud & Verification is only available to Reviewer users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <span className="text-xs text-slate-500 font-medium">Loading Fraud & Verification workspace...</span>
      </div>
    );
  }

  const modules = summary?.modules || [];
  const s = summary?.summary || { overallStatus: 'Pending', completed: 0, total: 6, verified: 0, reviewRequired: 0, critical: 0 };

  return (
    <div className="space-y-6 animate-fade-in font-sans">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
            <Fingerprint className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fraud & Verification</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify company identity and authentication details using external authoritative sources.
            </p>
          </div>
        </div>
      </div>

      {/* ── Overall Verification Summary ──────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-indigo-50/60 p-3.5 rounded-xl border border-indigo-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 font-mono block">Overall Verification</span>
          <span className="text-lg font-extrabold text-indigo-700">{s.overallStatus}</span>
        </div>
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono block">Verifications Completed</span>
          <span className="text-xl font-extrabold text-slate-800">{s.completed} / {s.total}</span>
        </div>
        <div className="bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 font-mono block">Verified</span>
          <span className="text-xl font-extrabold text-emerald-600">{s.verified}</span>
        </div>
        <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 font-mono block">Review Required</span>
          <span className="text-xl font-extrabold text-amber-600">{s.reviewRequired}</span>
        </div>
        <div className="bg-red-50/60 p-3.5 rounded-xl border border-red-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 font-mono block">Critical Issues</span>
          <span className="text-xl font-extrabold text-red-600">{s.critical}</span>
        </div>
      </div>

      {/* ── Verification Module Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {modules.map((m) => {
          const meta = MODULE_META[m.type];
          const Icon = meta.icon;
          const isActive = activeType === m.type;
          return (
            <button
              key={m.type}
              onClick={() => setActiveType(m.type)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                isActive ? 'bg-indigo-50/60 border-indigo-300 shadow-sm' : 'bg-white border-slate-200/80 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <StatusPill status={m.status} />
              </div>
              <h3 className="text-sm font-bold text-slate-900">{meta.label}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">{meta.desc}</p>
            </button>
          );
        })}
      </div>

      {/* ── Detail Panel ────────────────────────────────────────────────── */}
      {activeType === 'verification_history' ? (
        <VerificationHistoryPanel history={historyAll} />
      ) : (
        <VerificationDetailPanel
          type={activeType}
          detail={detail}
          loading={detailLoading}
          isReviewer={isReviewer}
          actionBusy={actionBusy}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          noteDraft={noteDraft}
          setNoteDraft={setNoteDraft}
          onRerun={handleRerun}
          onAction={handleAction}
        />
      )}
    </div>
  );
}

// ─── Shared identity/authenticity detail panel (GST / PAN / CIN / Document
// Authenticity / Identity Cross-Verification) ──────────────────────────────
function VerificationDetailPanel({ type, detail, loading, isReviewer, actionBusy, activeTab, setActiveTab, noteDraft, setNoteDraft, onRerun, onAction }) {
  if (loading || !detail) {
    return (
      <div className="bg-white p-8 rounded-2xl border border-slate-200/80 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const meta = MODULE_META[type];
  const result = detail.live ? detail.result : detail.result;
  const mock = result?.mock || {};
  const comparisonRows = result?.comparisonRows || [];
  const documents = result?.documents || [];
  const mismatches = comparisonRows.filter(r => r.status === 'Mismatch');

  const tabs = type === 'document_authenticity'
    ? [{ id: 'comparison', label: 'Documents' }, { id: 'raw', label: 'Raw Data' }, { id: 'history', label: 'History' }]
    : [
        { id: 'comparison', label: 'Details Comparison' },
        { id: 'mismatch', label: `Mismatch Details${mismatches.length ? ` (${mismatches.length})` : ''}` },
        { id: 'sources', label: 'Source Documents' },
        { id: 'raw', label: 'Raw Verification Data' },
        { id: 'history', label: 'History' }
      ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="p-5 border-b border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">{meta.label}</h2>
            <StatusPill status={detail.status} />
          </div>
          <div className="flex items-center gap-2">
            {isReviewer && (
              <button
                onClick={onRerun}
                disabled={actionBusy}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {actionBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Re-run Verification
              </button>
            )}
          </div>
        </div>

        <DemoBadge provider={mock.provider} />

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
          <span>Last verified: <strong className="text-slate-700">{detail.lastRunAt ? new Date(detail.lastRunAt).toLocaleString() : 'Never run'}</strong></span>
          {detail.lastRunBy && <span>By: <strong className="text-slate-700">{detail.lastRunBy}</strong></span>}
        </div>

        {!mock.available && (
          <p className="text-xs text-slate-500 italic">Verification unavailable — authoritative source data not available. Complete the relevant Intake fields to enable this check.</p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-5 border-b border-slate-100 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors cursor-pointer ${
              activeTab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {activeTab === 'comparison' && type !== 'document_authenticity' && (
          <ComparisonTable rows={comparisonRows} />
        )}
        {activeTab === 'comparison' && type === 'document_authenticity' && (
          <DocumentAuthenticityTable documents={documents} />
        )}

        {activeTab === 'mismatch' && (
          mismatches.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No mismatches detected in the last verification run.</p>
          ) : (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>⚠ Potential Mismatch Found.</strong> Potential mismatch detected. Reviewer verification required.</span>
              </div>
              <ComparisonTable rows={mismatches} />
            </div>
          )
        )}

        {activeTab === 'sources' && (
          <SourceDocumentsList documents={detail.sourceDocuments || []} />
        )}

        {activeTab === 'raw' && (
          <pre className="text-[10px] font-mono bg-slate-900 text-emerald-300 p-4 rounded-xl overflow-x-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}

        {activeTab === 'history' && (
          <HistoryTable history={detail.history || []} />
        )}
      </div>

      {/* Reviewer actions */}
      {isReviewer && (
        <div className="p-5 border-t border-slate-100 bg-slate-50/60 space-y-2.5">
          <input
            type="text"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Optional note for this decision..."
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => onAction('flag_for_review')}
              disabled={actionBusy}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <FlagTriangleRight className="w-3.5 h-3.5" /> Flag for Review
            </button>
            <button
              onClick={() => onAction('mark_verified')}
              disabled={actionBusy}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark as Verified
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="text-xs text-slate-500 italic">No comparable fields available yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {['Field', 'Verification Source', 'Intake', 'COI Document', 'Status'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, idx) => (
            <tr key={idx} className={r.status === 'Mismatch' ? 'bg-amber-50/40' : ''}>
              <td className="px-3 py-2.5 font-semibold text-slate-800">{r.field}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.sourceValue ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.intakeValue ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-3 py-2.5 text-slate-600">{r.coiValue ?? <span className="text-slate-300">—</span>}</td>
              <td className="px-3 py-2.5">
                {r.status === 'Match' && <span className="text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Match</span>}
                {r.status === 'Mismatch' && <span className="text-amber-700 font-bold flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Potential Mismatch</span>}
                {r.status === 'Not Provided' && <span className="text-slate-400 font-medium">Not Provided</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocumentAuthenticityTable({ documents }) {
  if (!documents || documents.length === 0) {
    return <p className="text-xs text-slate-500 italic">No uploaded documents available to assess.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {['Document', 'Type', 'Uploaded', 'Status', 'Note'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {documents.map((d) => (
            <tr key={d.documentId}>
              <td className="px-3 py-2.5 font-semibold text-slate-800">{d.name}</td>
              <td className="px-3 py-2.5 text-slate-500">{(d.docType || '').replace(/_/g, ' ')}</td>
              <td className="px-3 py-2.5 text-slate-500">{d.uploadedAt ? new Date(d.uploadedAt).toLocaleDateString() : '—'}</td>
              <td className="px-3 py-2.5 font-bold">
                {d.status === 'Consistent' && <span className="text-emerald-600">✓ Consistent</span>}
                {d.status === 'Pending Review' && <span className="text-amber-600">⏳ Pending Review</span>}
                {d.status === 'Not Available' && <span className="text-slate-400">Not Available</span>}
              </td>
              <td className="px-3 py-2.5 text-slate-500">{d.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceDocumentsList({ documents }) {
  if (!documents || documents.length === 0) {
    return <p className="text-xs text-slate-500 italic">No matching source documents uploaded yet.</p>;
  }
  return (
    <div className="space-y-2">
      {documents.map(d => (
        <div key={d.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">{d.name}</p>
              <p className="text-[10px] text-slate-400">{(d.doc_type || '').replace(/_/g, ' ')} · {d.status}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryTable({ history }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-slate-500 italic">No actions recorded yet for this module.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-slate-50">
          <tr>
            {['Reviewer', 'Date / Time', 'Action', 'Result'].map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {[...history].reverse().map(h => (
            <tr key={h.id}>
              <td className="px-3 py-2.5 font-semibold text-slate-800 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-indigo-500" /> {h.actor}</td>
              <td className="px-3 py-2.5 text-slate-500">{new Date(h.at).toLocaleString()}</td>
              <td className="px-3 py-2.5 text-slate-600">{h.action.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2.5 text-slate-600">{h.resultSummary}{h.note ? ` — "${h.note}"` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VerificationHistoryPanel({ history }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-indigo-600" />
        <h2 className="text-base font-bold text-slate-900">Verification History</h2>
      </div>
      {history.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No verification actions have been recorded yet. Run a check or record a decision on any module above.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-50">
              <tr>
                {['Verification Type', 'Reviewer', 'Date / Time', 'Result', 'Action'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase text-[10px] tracking-wider border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map(h => (
                <tr key={h.id}>
                  <td className="px-3 py-2.5 font-semibold text-slate-800">{(MODULE_META[h.type]?.label) || h.type}</td>
                  <td className="px-3 py-2.5 text-slate-600 flex items-center gap-1.5"><UserCheck className="w-3.5 h-3.5 text-indigo-500" /> {h.actor}</td>
                  <td className="px-3 py-2.5 text-slate-500">{new Date(h.at).toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-slate-600">{h.resultSummary}</td>
                  <td className="px-3 py-2.5 text-slate-600">{h.action.replace(/_/g, ' ')}{h.note ? ` — "${h.note}"` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
