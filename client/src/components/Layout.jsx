import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompanies, getCompanyStatus, getSebiNotices } from '../services/api';
import {
  Shield, LayoutDashboard, ClipboardList, FileText,
  FileCheck2, UserCheck, Download, LogOut, Building2,
  ChevronRight, Newspaper, TrendingUp,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ChatbotWidget from './ChatbotWidget';

// ─── helpers ──────────────────────────────────────────────────────────────────

/**
 * Given heatmap { section: 'certified'|'complete'|'partial'|'missing' }
 * compute a 0-100 readiness score.
 */
function computeReadiness(heatmap) {
  if (!heatmap) return null;
  const keys = Object.keys(heatmap);
  if (keys.length === 0) return null;
  const weights = { certified: 100, complete: 75, partial: 40, missing: 0 };
  const total = keys.reduce((sum, k) => sum + (weights[heatmap[k]] ?? 0), 0);
  return Math.round(total / keys.length);
}

function readinessColor(score) {
  if (score >= 80) return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'On Track' };
  if (score >= 50) return { bar: 'bg-amber-400',   text: 'text-amber-400',   label: 'In Progress' };
  return                   { bar: 'bg-red-500',     text: 'text-red-400',     label: 'Needs Work' };
}

// ─── nav items (SEBI added at end) ────────────────────────────────────────────

const BASE_NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/intake',     icon: ClipboardList,   label: 'Intake Form' },
  { to: '/documents',  icon: FileText,        label: 'Documents' },
  { to: '/draft',      icon: FileCheck2,      label: 'Draft & Heatmap' },
  { to: '/reviewer',   icon: UserCheck,       label: 'Reviewer Workspace', reviewerOnly: true },
  { to: '/export',     icon: Download,        label: 'Export' },
];

// ─── component ────────────────────────────────────────────────────────────────

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [company,       setCompany]       = useState(null);
  const [readiness,     setReadiness]     = useState(null);   // 0-100
  const [sebiCount,     setSebiCount]     = useState(0);      // badge count

  // ── load company + heatmap + sebi count ────────────────────────────────────
  const loadSidebarData = useCallback(async () => {
    try {
      const res = await getCompanies();
      const companies = res.data.companies || res.data;
      if (companies && companies.length > 0) {
        const comp = companies[0];
        setCompany(comp);
        const id = comp._id || comp.id;
        localStorage.setItem('ipo_company_id', id);

        // heatmap → readiness score
        try {
          const statusRes = await getCompanyStatus(id);
          const heatmap = statusRes.data?.heatmap || statusRes.heatmap;
          setReadiness(computeReadiness(heatmap));
        } catch (e) { /* non-fatal */ }

        // sebi notice count for badge
        try {
          const sebiRes = await getSebiNotices();
          setSebiCount((sebiRes.data || []).length);
        } catch (e) { /* non-fatal */ }
      }
    } catch (err) {
      console.error('Layout: failed to load sidebar data', err);
    }
  }, []);

  useEffect(() => {
    loadSidebarData();
    // refresh every 30 s so readiness tracks intake changes
    const iv = setInterval(loadSidebarData, 30000);
    return () => clearInterval(iv);
  }, [loadSidebarData]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const rd = readiness !== null ? readinessColor(readiness) : null;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-72 bg-navy-900 flex flex-col h-full fixed left-0 top-0 z-30">

        {/* Logo / product name */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">IPO Draft Assist</h1>
              <span className="text-xs text-slate-500 font-mono">v1.0 — Demo</span>
            </div>
          </div>
        </div>

        {/* ── IPO Readiness Score ─────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="px-3 py-3 bg-white/5 rounded-xl border border-white/8">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  IPO Readiness
                </span>
              </div>
              {rd && (
                <span className={`text-[10px] font-bold ${rd.text}`}>{rd.label}</span>
              )}
            </div>

            {readiness !== null ? (
              <>
                <div className="flex items-end gap-1.5 mb-2">
                  <span className="text-2xl font-bold text-white leading-none">{readiness}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${rd.bar}`}
                    style={{ width: `${readiness}%` }}
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5">Based on completeness heatmap</p>
              </>
            ) : (
              <div className="h-8 flex items-center">
                <span className="text-xs text-slate-500">Calculating…</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Active company ──────────────────────────────────────────────── */}
        <div className="px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-white/5 rounded-xl">
            <div className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">
                {company?.legal_name || company?.name || 'Loading…'}
              </p>
              <p className="text-xs text-slate-500">Active Company</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
          </div>
        </div>

        {/* ── Nav items ───────────────────────────────────────────────────── */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {BASE_NAV
            .filter((item) => !item.reviewerOnly || user?.role === 'reviewer')
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/20 text-white border-l-2 border-indigo-400'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}

          {/* SEBI Updates nav item with red count badge */}
          <NavLink
            to="/sebi-updates"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600/20 text-white border-l-2 border-indigo-400'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Newspaper className="w-5 h-5 shrink-0" />
            <span className="flex-1">SEBI Updates</span>
            {sebiCount > 0 && (
              <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
                {sebiCount}
              </span>
            )}
          </NavLink>
        </nav>

        {/* ── User profile + bell + logout ───────────────────────────────── */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{user?.name}</p>
              <span
                className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                  user?.role === 'reviewer'
                    ? 'bg-emerald-900/40 text-emerald-400'
                    : 'bg-indigo-900/40 text-indigo-400'
                }`}
              >
                {user?.role === 'reviewer' ? 'Reviewer' : 'Issuer'}
              </span>
            </div>
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-white/5"
              title="Logout"
              type="button"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <main className="ml-72 flex-1 overflow-y-auto">
        <div className="p-8">{children}</div>
        <ChatbotWidget />
      </main>
    </div>
  );
}
