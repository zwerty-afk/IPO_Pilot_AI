import React from 'react';

const statusConfig = {
  draft: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400' },
  under_review: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  clarification_requested: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  certified: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  complete: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  partial: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  missing: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
  uploaded: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500' },
  extracted: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

function formatStatus(status) {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function StatusBadge({ status, className = '' }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
      {formatStatus(status)}
    </span>
  );
}
