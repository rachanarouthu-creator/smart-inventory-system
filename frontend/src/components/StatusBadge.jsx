import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

export default function StatusBadge({ status, daysLeft, compact = false }) {
  const normalizedStatus = (status || '').toUpperCase().replace(/\s+/g, '_');

  if (normalizedStatus === 'SAFE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>SAFE</span>
        {!compact && daysLeft !== undefined && (
          <span className="text-emerald-300/80 font-normal">({daysLeft}d left)</span>
        )}
      </span>
    );
  }

  if (normalizedStatus === 'EXPIRING_SOON' || normalizedStatus === 'EXPIRING SOON') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
        <span>EXPIRING SOON</span>
        {!compact && daysLeft !== undefined && (
          <span className="text-amber-300/80 font-normal">({daysLeft}d left)</span>
        )}
      </span>
    );
  }

  if (normalizedStatus === 'EXPIRED') {
    const daysAgo = Math.abs(daysLeft || 0);
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
        <span>EXPIRED</span>
        {!compact && daysLeft !== undefined && (
          <span className="text-rose-300/80 font-normal">({daysAgo}d ago)</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
      <span>{status || 'UNKNOWN'}</span>
    </span>
  );
}
