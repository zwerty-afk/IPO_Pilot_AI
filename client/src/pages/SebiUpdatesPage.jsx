import { useState, useEffect } from 'react';
import { getSebiNotices, refreshSebiNotices } from '../services/api';
import { RefreshCw, ExternalLink, Newspaper, Clock } from 'lucide-react';

const CATEGORY_COLORS = {
  'ICDR/SME':             'bg-indigo-50 text-indigo-700 border-indigo-100',
  'ICDR Amendment':       'bg-indigo-50 text-indigo-700 border-indigo-100',
  'Listing Obligations':  'bg-blue-50 text-blue-700 border-blue-100',
  'Insider Trading':      'bg-orange-50 text-orange-700 border-orange-100',
  'Merchant Bankers':     'bg-teal-50 text-teal-700 border-teal-100',
  'Disclosure Framework': 'bg-amber-50 text-amber-700 border-amber-100',
  'SME Framework Circular':'bg-emerald-50 text-emerald-700 border-emerald-100',
  'Technology Guidelines':'bg-purple-50 text-purple-700 border-purple-100',
};

export default function SebiUpdatesPage() {
  const [notices, setNotices] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getSebiNotices();
      // Handle {notices, meta} shape from real server
      const data = res.data;
      if (data?.notices) {
        setNotices(Array.isArray(data.notices) ? data.notices : []);
        setMeta(data.meta || null);
      } else {
        // Fallback: old array shape from mock
        setNotices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to load SEBI notices:', err);
      setError('Could not load SEBI notices. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      setError(null);
      const res = await refreshSebiNotices();
      const data = res.data;
      if (data?.notices) {
        setNotices(Array.isArray(data.notices) ? data.notices : []);
        setMeta(data.meta || null);
      }
    } catch (err) {
      console.error('Failed to refresh SEBI notices:', err);
      setError('Refresh failed. SEBI portal may be temporarily unavailable. Using cached data.');
      // Reload from cache
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-slate-500 text-sm">Fetching regulatory updates from SEBI...</p>
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
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-medium px-4 py-2.5 rounded-xl transition-all text-sm border border-slate-200 self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Fetching from SEBI...' : 'Refresh from SEBI'}
        </button>
      </div>

      {/* Source attribution strip */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-900">{notices.length}</span>
          <span className="text-sm font-semibold text-slate-600">IPO Regulatory Circulars & Updates</span>
        </div>
        <span className="text-slate-400 text-sm">·</span>
        <span className="text-slate-500 text-sm">
          Source:{' '}
          <a
            href="https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=2&smid=0&pageno=1"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-600 hover:underline font-medium"
          >
            SEBI Official Circulars Portal
          </a>
        </span>
        {meta?.last_fetched && (
          <>
            <span className="text-slate-400 text-sm">·</span>
            <span className="flex items-center gap-1 text-slate-400 text-xs">
              <Clock className="w-3.5 h-3.5" />
              Fetched: {new Date(meta.last_fetched).toLocaleString('en-IN')}
            </span>
          </>
        )}
        {notices.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 border border-red-100 rounded-full text-xs font-bold text-red-600">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            {notices.length} circulars
          </span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">{error}</p>
        </div>
      )}


      {/* Notices grid */}
      {notices.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <Newspaper className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">No notices available</p>
          <p className="text-slate-400 text-xs mt-1">
            Click "Refresh from SEBI" to fetch the latest circulars.
          </p>
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
                    {notice.source_attribution || 'SEBI Circular'}
                  </span>
                  {notice.source_url ? (
                    <a
                      href={notice.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on SEBI Portal
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500">
                      <ExternalLink className="w-3 h-3" />
                      View on SEBI Portal
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-[11px] text-slate-400 text-center pb-4">
        These notices are fetched from the official SEBI RSS feed and are for informational purposes only. Verify on the{' '}
        <a href="https://www.sebi.gov.in" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
          official SEBI website
        </a>{' '}
        before taking regulatory action.
      </p>
    </div>
  );
}
