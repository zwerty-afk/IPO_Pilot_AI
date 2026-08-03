import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getCompanies, getCompanyStatus, getSebiNotices, getIpoReadiness } from '../services/api';
import {
  Shield, LayoutDashboard, ClipboardList,
  FileCheck2, UserCheck, Download, LogOut, Building2,
  ChevronRight, Newspaper, TrendingUp, FolderOpen, Mail,
  Menu, X,
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import ChatbotWidget from './ChatbotWidget';

// ─── helpers ──────────────────────────────────────────────────────────────────



function readinessColor(score) {
  if (score >= 100) return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Ready for IPO filing review' };
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'Almost ready' };
  if (score >= 40) return { bar: 'bg-amber-400',   text: 'text-amber-400',   label: 'In progress' };
  return                   { bar: 'bg-red-500',     text: 'text-red-400',     label: 'Getting started' };
}

// ─── nav items (SEBI added at end) ────────────────────────────────────────────

const BASE_NAV = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents',  icon: FolderOpen,      label: 'Documents' },
  { to: '/intake',     icon: ClipboardList,   label: 'Intake Form' },
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
  const [mobileOpen,    setMobileOpen]    = useState(false);  // mobile drawer

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

        try {
          const readinessRes = await getIpoReadiness(id);
          const readinessData = readinessRes.data || readinessRes;
          if (readinessData && readinessData.overall_score !== undefined) {
            setReadiness(readinessData.overall_score);
          }
        } catch (e) { /* non-fatal */ }

        try {
          const sebiRes = await getSebiNotices();
          // Handle both old array response and new {notices, meta} shape
          const notices = sebiRes.data?.notices || sebiRes.data || [];
          setSebiCount(Array.isArray(notices) ? notices.length : 0);
        } catch (e) { /* non-fatal */ }
      }
    } catch (err) {
      console.error('Layout: failed to load sidebar data', err);
    }
  }, []);

  useEffect(() => {
    loadSidebarData();
    // Immediate refresh when any page signals a score-affecting mutation
    // (field save, document upload/confirm, certification). Falls back to the
    // 30s poll for anything that doesn't dispatch the event.
    const onChanged = () => loadSidebarData();
    window.addEventListener('ipo-readiness-changed', onChanged);
    const iv = setInterval(loadSidebarData, 30000);
    return () => {
      window.removeEventListener('ipo-readiness-changed', onChanged);
      clearInterval(iv);
    };
  }, [loadSidebarData]);

  // Close the mobile drawer on Escape and lock body scroll while it's open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const getInitials = (name) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const rd = readiness !== null ? readinessColor(readiness) : null;

  const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
      isActive
        ? 'bg-indigo-600/20 text-white border-l-2 border-indigo-400'
        : 'text-slate-400 hover:text-white hover:bg-white/5'
    }`;

  // ── Sidebar inner content (shared by desktop + mobile drawer) ──────────────
  const sidebarContent = (
    <>
      {/* Logo / product name */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">IPO Pilot AI</h1>
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
              <p className="text-[10px] text-slate-500 mt-1.5">Based on intake, documents, gaps & certifications</p>
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
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" onClick={() => setMobileOpen(false)}>
        {BASE_NAV
          .filter((item) => !item.reviewerOnly || user?.role === 'reviewer')
          .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              className={navLinkClass}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}

        {/* SEBI Updates nav item with red count badge */}
        <NavLink to="/sebi-updates" className={navLinkClass}>
          <Newspaper className="w-5 h-5 shrink-0" />
          <span className="flex-1">SEBI Updates</span>
          {sebiCount > 0 && (
            <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shrink-0">
              {sebiCount}
            </span>
          )}
        </NavLink>

        {/* Invitations nav item */}
        <NavLink to="/invitations" className={navLinkClass}>
          <Mail className="w-5 h-5 shrink-0" />
          <span className="flex-1">Invitations</span>
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
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* ── Desktop Sidebar ─────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex w-72 bg-navy-900 flex-col h-full fixed left-0 top-0 z-30">
        {sidebarContent}
      </aside>

      {/* ── Mobile drawer + overlay ─────────────────────────────────────────── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-full w-72 max-w-[85vw] bg-navy-900 flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white z-10"
          aria-label="Close menu"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 h-full overflow-hidden">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 h-14 bg-navy-900 border-b border-white/10 shrink-0 sticky top-0 z-20">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 text-slate-300 hover:text-white"
            aria-label="Open menu"
            type="button"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-base">IPO Pilot AI</span>
          </div>
          <div className="flex items-center">
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          <ChatbotWidget />
        </main>
      </div>
    </div>
  );
}
