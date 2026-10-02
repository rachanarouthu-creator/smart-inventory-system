import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Bell, CheckCheck, Check, AlertOctagon, AlertTriangle, 
  Package, Camera, Info, X, RefreshCw, ChevronRight 
} from 'lucide-react';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';

export default function NotificationCenter({ onNavigateToTab }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL'); // 'ALL' | 'UNREAD'
  const containerRef = useRef(null);

  const fetchNotifs = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await getNotifications(40);
      if (Array.isArray(data)) {
        setNotifications(data);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Fetch on mount and poll every 45s
  useEffect(() => {
    fetchNotifs(false);
    const timer = setInterval(() => {
      fetchNotifs(false);
    }, 45000);
    return () => clearInterval(timer);
  }, [fetchNotifs]);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleDocumentClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleDocumentClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchNotifs(true);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications read:', err);
    }
  };

  const handleMarkSingleRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleNotificationClick = (item) => {
    if (!item.is_read) {
      markNotificationRead(item.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
    }
    setIsOpen(false);

    if (onNavigateToTab) {
      if (item.type === 'EXPIRED' || item.type === 'EXPIRING_SOON') {
        onNavigateToTab('alerts');
      } else if (item.type === 'LOW_STOCK') {
        onNavigateToTab('dashboard');
      } else if (item.type === 'SCAN') {
        onNavigateToTab('history');
      } else {
        onNavigateToTab('dashboard');
      }
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifications = filter === 'UNREAD' 
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'EXPIRED':
        return <AlertOctagon className="w-4 h-4 text-rose-400" />;
      case 'EXPIRING_SOON':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'LOW_STOCK':
        return <Package className="w-4 h-4 text-orange-400" />;
      case 'SCAN':
        return <Camera className="w-4 h-4 text-emerald-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'EXPIRED':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
            EXPIRED
          </span>
        );
      case 'EXPIRING_SOON':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
            EXPIRING SOON
          </span>
        );
      case 'LOW_STOCK':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-orange-500/15 text-orange-300 border border-orange-500/30">
            LOW STOCK
          </span>
        );
      case 'SCAN':
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            SCAN INTAKE
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-700/40 text-slate-300 border border-slate-700">
            SYSTEM
          </span>
        );
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={handleToggle}
        aria-label="Notification center"
        className={`relative p-2 rounded-xl transition-all duration-200 border ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-700'
            : 'bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800/80 border-slate-800'
        }`}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-extrabold text-white shadow-lg shadow-rose-500/40 ring-2 ring-slate-950 animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900/95 border border-slate-800 shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => fetchNotifs(true)}
                disabled={loading}
                title="Refresh"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/30 flex items-center gap-2 text-xs">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filter === 'ALL'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('UNREAD')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                filter === 'UNREAD'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications Scroll List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60 custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400 animate-spin" />
                <span>Syncing notifications...</span>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-slate-800/70 flex items-center justify-center text-slate-400 mb-2">
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-sm font-semibold text-slate-300">All caught up!</div>
                <p className="text-xs text-slate-500 mt-1">
                  {filter === 'UNREAD' 
                    ? 'No unread notifications at this time.' 
                    : 'No system notifications recorded yet.'}
                </p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3 text-left flex items-start gap-3 transition-colors cursor-pointer group ${
                    notif.is_read
                      ? 'hover:bg-slate-800/40 text-slate-400'
                      : 'bg-slate-800/30 hover:bg-slate-800/60 text-slate-200'
                  }`}
                >
                  <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800 border border-slate-700/60 flex-shrink-0">
                    {getNotificationIcon(notif.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTypeBadge(notif.type)}
                      <span className="text-[10px] text-slate-500 font-mono truncate">
                        {notif.created_at}
                      </span>
                    </div>

                    <p className={`text-xs leading-relaxed ${notif.is_read ? 'text-slate-400' : 'text-slate-200 font-medium'}`}>
                      {notif.message}
                    </p>

                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400/80 group-hover:text-emerald-300 flex items-center gap-0.5">
                        <span>View details</span>
                        <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>

                      {!notif.is_read && (
                        <button
                          onClick={(e) => handleMarkSingleRead(notif.id, e)}
                          title="Mark as read"
                          className="text-[10px] text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
