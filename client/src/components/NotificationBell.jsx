import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, RotateCcw, Loader2 } from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../services/api';

const SECTION_ROUTES = {
  documents: '/intake',
  sebi_updates: '/sebi-updates',
  invitation: '/invitations',
  export: '/export',
  dashboard: '/dashboard',
  reviewer: '/reviewer-workspace',
  capital_structure: '/draft',
  objects: '/draft',
  business_overview: '/draft',
  risk_factors: '/draft',
  related_party: '/draft',
  litigation: '/draft',
  promoter_details: '/draft',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const navigate = useNavigate();

  const loadNotifications = useCallback(async () => {
    try {
      setError(null);
      const res = await getNotifications();
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Could not load notifications.');
    }
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const toggleOpen = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const panelHeight = 360;
      // Place panel smartly above the bottom-left sidebar bell button
      const topPos = rect.top - panelHeight > 10 ? rect.top - panelHeight + 30 : Math.max(10, rect.bottom - panelHeight);
      setPanelPos({ top: topPos, left: 296 });
    }
    setOpen((prev) => !prev);
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
    setOpen(false);
    navigate(SECTION_ROUTES[notif.related_section] || '/dashboard');
  };

  return (
    <>
      {/* Bell button — lives inside sidebar */}
      <button
        ref={buttonRef}
        onClick={toggleOpen}
        className="relative p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5"
        title="Notifications"
        type="button"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 animate-pulse-soft">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel — fixed position, escapes sidebar overflow clipping */}
      {open && (
        <div
          ref={panelRef}
          style={{ top: panelPos.top, left: panelPos.left }}
          className="fixed z-[999] w-80 bg-white rounded-2xl border border-slate-200/80 shadow-2xl overflow-hidden animate-slide-up"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500" />
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Notifications
              </h4>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                  <button
                    onClick={handleMarkAllRead}
                    type="button"
                    className="text-[10px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    Mark all read
                  </button>
                </>
              )}
              <button
                onClick={() => setOpen(false)}
                type="button"
                className="p-1 text-slate-400 hover:text-slate-700 transition-colors rounded-lg hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {error ? (
              <div className="p-6 text-center space-y-2">
                <p className="text-red-600 text-xs font-semibold">{error}</p>
                <button
                  onClick={loadNotifications}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-xs font-medium">No notifications yet</p>
                <p className="text-slate-300 text-[10px] mt-1">
                  Activity on your drafts will appear here
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <button
                  key={notif.id}
                  onClick={() => handleNotifClick(notif)}
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-slate-50 last:border-b-0 hover:bg-slate-50 transition-colors flex gap-3 ${
                    !notif.is_read ? 'bg-indigo-50/40' : ''
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      !notif.is_read ? 'bg-indigo-500' : 'bg-slate-200'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs leading-relaxed ${
                        !notif.is_read ? 'text-slate-800 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {notif.message}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                    {notif.related_section && (
                      <span className="inline-block mt-1 text-[10px] font-bold text-indigo-500 uppercase tracking-wider">
                        {notif.related_section.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
