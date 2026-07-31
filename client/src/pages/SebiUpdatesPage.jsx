import { useState, useEffect } from 'react';
import { getSebiNotices } from '../services/api';
import { RefreshCw, ExternalLink, Newspaper } from 'lucide-react';

const CATEGORY_COLORS = {
  'ICDR Amendment':        'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Disclosure Framework':  'bg-amber-50 text-amber-700 border-amber-100',
  'SME Framework Circular':'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Technology Guidelines': 'bg-purple-50 text-purple-700 border-purple-100',
};

export default function SebiUpdatesPage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const res = await getSebiNotices();
      setNotices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load SEBI notices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm">Loading regulatory updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
            <Newspaper className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">SEBI Regulatory Updates</h2>
            <p className="text-slate-500 text-sm mt-0.5">
              Latest circulars and amendments relevant to SME IPO filings
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all text-sm border border-slate-200 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Notice count strip */}
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-slate-900">{notices.length} notices</span>
        <span className="text-slate-400 text-sm">·</span>
        <span className="text-slate-500 text-sm">Updated periodically from SEBI portal</span>
        <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-xs font-bold text-red-600">
          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          {notices.length} new
        </span>
      </div>

      {/* Notices grid */}
      {notices.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No notices available</p>
          <p className="text-slate-400 text-xs mt-1">Check back later for regulatory updates</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {notices.map((notice) => {
            const catColor = CATEGORY_COLORS[notice.category] || 'bg-slate-50 text-slate-600 border-slate-200';
            return (
              <div
                key={notice.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all space-y-3 flex flex-col"
              >
                {/* Category + date row */}
                <div className="flex items-start justify-between gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${catColor}`}>
                    {notice.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">
                    {new Date(notice.date).toLocaleDateString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </span>
                </div>

                {/* Title */}
                <h4 className="text-sm font-bold text-slate-900 leading-snug">
                  {notice.title}
                </h4>

                {/* Description */}
                <p className="text-xs text-slate-500 leading-relaxed flex-1">
                  {notice.description}
                </p>

                {/* Footer action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">
                    SEBI Circular
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 cursor-default">
                    <ExternalLink className="w-3 h-3" />
                    View on SEBI Portal
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 text-center pb-4">
        These notices are for informational purposes only. Verify on the official SEBI website before taking regulatory action.
      </p>
    </div>
  );
}
