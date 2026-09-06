import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, X, Info } from 'lucide-react';

export default function Toast({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {notifications.map((toast) => {
        let borderColor = 'border-slate-700 bg-slate-900/95 text-slate-200';
        let Icon = Info;
        let iconColor = 'text-sky-400';

        if (toast.type === 'error' || toast.status === 'EXPIRED') {
          borderColor = 'border-rose-500/40 bg-slate-900/95 text-rose-100 glow-rose';
          Icon = AlertOctagon;
          iconColor = 'text-rose-400';
        } else if (toast.type === 'warning' || toast.status === 'EXPIRING_SOON') {
          borderColor = 'border-amber-500/40 bg-slate-900/95 text-amber-100 glow-amber';
          Icon = AlertTriangle;
          iconColor = 'text-amber-400';
        } else if (toast.type === 'success' || toast.status === 'SAFE') {
          borderColor = 'border-emerald-500/40 bg-slate-900/95 text-emerald-100 glow-emerald';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-400';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 ${borderColor}`}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-sm">
              {toast.title && <div className="font-semibold mb-0.5">{toast.title}</div>}
              <div className="text-xs text-slate-300 leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
