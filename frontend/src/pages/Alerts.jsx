import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertOctagon, Clock, Package, Plus, RefreshCw, ArrowRight, CheckCircle2 } from 'lucide-react';
import { getAlerts, updateProductStock } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function Alerts({ onNavigateToInventory, addNotification, onRefreshGlobal }) {
  const [alertsData, setAlertsData] = useState({
    summary: { total_alerts: 0, expired_count: 0, low_stock_count: 0, expiring_soon_count: 0 },
    expired: [],
    low_stock: [],
    expiring_soon: [],
  });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('ALL'); // 'ALL' | 'EXPIRED' | 'LOW_STOCK' | 'EXPIRING_SOON'
  const [updatingId, setUpdatingId] = useState(null);

  const fetchAlertsData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAlerts();
      setAlertsData(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      if (addNotification) {
        addNotification({
          type: 'error',
          title: 'Alerts Error',
          message: 'Unable to fetch inventory alerts from backend.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchAlertsData();
  }, [fetchAlertsData]);

  const handleQuickRestock = async (product, delta = 5) => {
    setUpdatingId(product.id);
    try {
      const res = await updateProductStock(product.id, { delta });
      if (addNotification) {
        addNotification({
          type: 'success',
          title: 'Stock Updated',
          message: `✓ Added +${delta} to "${product.name}". New quantity: ${res.new_quantity}.`,
        });
      }
      await fetchAlertsData();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err) {
      if (addNotification) {
        addNotification({
          type: 'error',
          title: 'Restock Failed',
          message: err.message,
        });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const { summary, expired, low_stock, expiring_soon } = alertsData;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-amber-400" />
            Inventory Alerts
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Actionable monitoring for expired stock, low inventory thresholds, and imminent expiries.
          </p>
        </div>

        <button
          onClick={fetchAlertsData}
          disabled={loading}
          className="self-start sm:self-auto p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Alerts</span>
        </button>
      </div>

      {/* KPI Cards for Alert Categories */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Expired KPI */}
        <button
          onClick={() => setActiveFilter('EXPIRED')}
          className={`glass-panel p-5 rounded-2xl border text-left transition-all ${
            activeFilter === 'EXPIRED'
              ? 'border-rose-500/60 bg-rose-500/10 shadow-lg shadow-rose-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-rose-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4" />
              Expired Products
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
              CRITICAL
            </span>
          </div>
          <div className="text-3xl font-black text-rose-400 mt-2">
            {summary.expired_count}
          </div>
          <p className="text-xs text-slate-400 mt-1">Products past their consumption date</p>
        </button>

        {/* Low Stock KPI */}
        <button
          onClick={() => setActiveFilter('LOW_STOCK')}
          className={`glass-panel p-5 rounded-2xl border text-left transition-all ${
            activeFilter === 'LOW_STOCK'
              ? 'border-amber-500/60 bg-amber-500/10 shadow-lg shadow-amber-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              Low Stock Products
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
              RESTOCK
            </span>
          </div>
          <div className="text-3xl font-black text-amber-400 mt-2">
            {summary.low_stock_count}
          </div>
          <p className="text-xs text-slate-400 mt-1">Quantity ≤ minimum threshold</p>
        </button>

        {/* Expiring Soon KPI */}
        <button
          onClick={() => setActiveFilter('EXPIRING_SOON')}
          className={`glass-panel p-5 rounded-2xl border text-left transition-all ${
            activeFilter === 'EXPIRING_SOON'
              ? 'border-yellow-500/60 bg-yellow-500/10 shadow-lg shadow-yellow-500/10'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-yellow-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              Expiring Soon
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 font-mono">
              30 DAYS
            </span>
          </div>
          <div className="text-3xl font-black text-yellow-400 mt-2">
            {summary.expiring_soon_count}
          </div>
          <p className="text-xs text-slate-400 mt-1">Expiring within the next 30 days</p>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        {[
          { id: 'ALL', label: `All Alerts (${summary.total_alerts})` },
          { id: 'EXPIRED', label: `Expired (${summary.expired_count})` },
          { id: 'LOW_STOCK', label: `Low Stock (${summary.low_stock_count})` },
          { id: 'EXPIRING_SOON', label: `Expiring Soon (${summary.expiring_soon_count})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeFilter === tab.id
                ? 'bg-slate-800 text-emerald-400 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {summary.total_alerts === 0 && !loading && (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">All Inventory is Healthy!</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            No expired products, all items are above their minimum stock thresholds, and none are expiring within 30 days.
          </p>
        </div>
      )}

      {/* 1. Expired Items Section */}
      {(activeFilter === 'ALL' || activeFilter === 'EXPIRED') && expired.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4" />
            Expired Products ({expired.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expired.map((p) => (
              <div
                key={`exp-${p.id}`}
                className="glass-panel p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:border-rose-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{p.category}</span>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                    </div>
                    <StatusBadge status="EXPIRED" daysLeft={p.days_left} />
                  </div>
                  <div className="mt-2 text-xs text-rose-300 font-medium">
                    🔴 Expired {Math.abs(p.days_left)} days ago ({p.expiry_date})
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Current Stock: <strong className="text-white">{p.quantity} units</strong> • Min Stock: {p.minimum_stock}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Remove from shelf</span>
                  <button
                    onClick={() => onNavigateToInventory(p.name)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Low Stock Items Section */}
      {(activeFilter === 'ALL' || activeFilter === 'LOW_STOCK') && low_stock.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-amber-400 flex items-center gap-2 uppercase tracking-wider">
            <Package className="w-4 h-4" />
            Low Stock Products ({low_stock.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {low_stock.map((p) => (
              <div
                key={`low-${p.id}`}
                className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{p.category}</span>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      ⚠️ LOW STOCK
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-amber-300">
                    Stock is <strong className="text-white">{p.quantity}</strong> (Threshold: {p.minimum_stock} units)
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Expiry: {p.expiry_date} ({p.days_left > 0 ? `${p.days_left}d left` : 'Expired'})
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleQuickRestock(p, 1)}
                      disabled={updatingId === p.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors"
                    >
                      +1 Stock
                    </button>
                    <button
                      onClick={() => handleQuickRestock(p, 5)}
                      disabled={updatingId === p.id}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-colors"
                    >
                      +5 Stock
                    </button>
                  </div>
                  <button
                    onClick={() => onNavigateToInventory(p.name)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>View</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Expiring Soon Section */}
      {(activeFilter === 'ALL' || activeFilter === 'EXPIRING_SOON') && expiring_soon.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-yellow-400 flex items-center gap-2 uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            Expiring Within 30 Days ({expiring_soon.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expiring_soon.map((p) => (
              <div
                key={`soon-${p.id}`}
                className="glass-panel p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 hover:border-yellow-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">{p.category}</span>
                      <h3 className="text-base font-bold text-white">{p.name}</h3>
                    </div>
                    <StatusBadge status="EXPIRING_SOON" daysLeft={p.days_left} />
                  </div>
                  <div className="mt-2 text-xs text-yellow-300 font-medium">
                    🟡 Expires in {p.days_left} days ({p.expiry_date})
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Stock: {p.quantity} units • Min: {p.minimum_stock}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Plan consumption</span>
                  <button
                    onClick={() => onNavigateToInventory(p.name)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>View Product</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
