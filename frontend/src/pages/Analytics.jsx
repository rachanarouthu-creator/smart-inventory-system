import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Sparkles, AlertTriangle, ShieldCheck, Clock, AlertOctagon, Package, RefreshCw } from 'lucide-react';
import { getAnalytics } from '../api';

export default function Analytics({ onNavigateToInventory }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAnalytics();
      setData(res);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
        <span className="text-sm text-slate-400">Loading live inventory analytics...</span>
      </div>
    );
  }

  const {
    insights = [],
    category_distribution = [],
    product_quantities = [],
    expiry_distribution = { safe: 0, expiring_soon: 0, expired: 0 },
    low_stock_products = [],
    health_score,
  } = data || {};

  // Maximum unit count for scale
  const maxCategoryUnits = Math.max(...category_distribution.map((c) => c.units), 1);
  const maxProductQty = Math.max(...product_quantities.map((p) => Math.max(p.quantity, p.minimum_stock)), 1);
  const totalExpiryCount = expiry_distribution.safe + expiry_distribution.expiring_soon + expiry_distribution.expired || 1;

  const safePercent = Math.round((expiry_distribution.safe / totalExpiryCount) * 100);
  const soonPercent = Math.round((expiry_distribution.expiring_soon / totalExpiryCount) * 100);
  const expiredPercent = Math.round((expiry_distribution.expired / totalExpiryCount) * 100);

  const getGradeColor = (grade) => {
    switch (grade) {
      case 'Good':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Moderate':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <BarChart3 className="w-7 h-7 text-emerald-400" />
            Inventory Analytics & AI Insights
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time visual reports and automated intelligence to guide restocking and inventory decisions.
          </p>
        </div>

        <button
          onClick={fetchAnalyticsData}
          className="self-start sm:self-auto p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Inventory Health Scorecard */}
      {health_score && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900/60">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Left: Overall Score Circle / Pill */}
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-700/80 flex flex-col items-center justify-center shadow-xl">
                <span className="text-2xl font-black text-white font-mono leading-none">
                  {health_score.overall_score}
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-0.5">/ 100</span>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-white">Overall Inventory Health</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getGradeColor(health_score.grade)}`}>
                    {health_score.grade}
                  </span>
                </div>
                <p className="text-xs text-slate-400 max-w-sm">
                  Calculated based on stock levels, safety thresholds, and active shelf-life windows across {health_score.total_products} products.
                </p>
              </div>
            </div>

            {/* Right: Dimension Bars */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Stock Health</span>
                  <span className="font-mono font-bold text-emerald-400">{health_score.stock_health}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full" 
                    style={{ width: `${health_score.stock_health}%` }} 
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Expiry Safety</span>
                  <span className="font-mono font-bold text-yellow-400">{health_score.expiry_health}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-yellow-500 rounded-full" 
                    style={{ width: `${health_score.expiry_health}%` }} 
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-400">Availability</span>
                  <span className="font-mono font-bold text-sky-400">{health_score.availability_score}%</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div 
                    className="h-full bg-sky-500 rounded-full" 
                    style={{ width: `${health_score.availability_score}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Inventory Insights Section */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 relative overflow-hidden">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>AI Inventory Insights</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
            Automated Rules Engine
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.length > 0 ? (
            insights.map((insight, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs text-slate-200 flex items-start gap-2.5 leading-relaxed"
              >
                <span>{insight}</span>
              </div>
            ))
          ) : (
            <div className="text-xs text-slate-400 col-span-2">
              No critical alerts detected. Inventory operations are running smoothly.
            </div>
          )}
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Stock by Category */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-teal-400" />
              Stock by Category
            </h2>
            <span className="text-xs text-slate-400 font-mono">Total Units</span>
          </div>

          <div className="space-y-3 pt-2">
            {category_distribution.map((cat) => {
              const widthPct = Math.round((cat.units / maxCategoryUnits) * 100);
              return (
                <div key={cat.category} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-300">{cat.category}</span>
                    <span className="text-slate-400 font-mono">
                      {cat.units} units <span className="text-slate-600">({cat.count} types)</span>
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(widthPct, 6)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chart 2: Expiry Health Distribution */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              Expiry Distribution
            </h2>
            <span className="text-xs text-slate-400 font-mono">{totalExpiryCount} Products</span>
          </div>

          {/* Stacked Bar */}
          <div className="pt-2">
            <div className="w-full h-4 rounded-full bg-slate-900 border border-slate-800 flex overflow-hidden">
              {safePercent > 0 && (
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${safePercent}%` }}
                  title={`Safe: ${expiry_distribution.safe} (${safePercent}%)`}
                />
              )}
              {soonPercent > 0 && (
                <div
                  className="h-full bg-yellow-500 transition-all"
                  style={{ width: `${soonPercent}%` }}
                  title={`Expiring Soon: ${expiry_distribution.expiring_soon} (${soonPercent}%)`}
                />
              )}
              {expiredPercent > 0 && (
                <div
                  className="h-full bg-rose-500 transition-all"
                  style={{ width: `${expiredPercent}%` }}
                  title={`Expired: ${expiry_distribution.expired} (${expiredPercent}%)`}
                />
              )}
            </div>

            {/* Distribution Legend & Counts */}
            <div className="grid grid-cols-3 gap-3 mt-5 text-center">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-emerald-400 uppercase">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Safe
                </div>
                <div className="text-2xl font-black text-emerald-300 mt-1">
                  {expiry_distribution.safe}
                </div>
                <div className="text-[10px] text-slate-400">{safePercent}%</div>
              </div>

              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-yellow-400 uppercase">
                  <Clock className="w-3.5 h-3.5" />
                  Soon (&le;30d)
                </div>
                <div className="text-2xl font-black text-yellow-300 mt-1">
                  {expiry_distribution.expiring_soon}
                </div>
                <div className="text-[10px] text-slate-400">{soonPercent}%</div>
              </div>

              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-rose-400 uppercase">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  Expired
                </div>
                <div className="text-2xl font-black text-rose-300 mt-1">
                  {expiry_distribution.expired}
                </div>
                <div className="text-[10px] text-slate-400">{expiredPercent}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart 3: Product Stock vs Minimum Stock Threshold */}
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-slate-800 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                Inventory Stock vs Minimum Threshold
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Bars show current stock with the minimum required threshold marked.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Current Stock
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Low Stock
              </span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {product_quantities.map((item) => {
              const currentPct = Math.round((item.quantity / maxProductQty) * 100);
              const minPct = Math.round((item.minimum_stock / maxProductQty) * 100);
              const isLow = item.is_low_stock;

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-200 flex items-center gap-2">
                      {item.name}
                      {isLow && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          ⚠️ LOW
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400 font-mono">
                      Current: <strong className={isLow ? 'text-amber-400' : 'text-white'}>{item.quantity}</strong> / Min: {item.minimum_stock}
                    </span>
                  </div>

                  <div className="relative w-full h-3 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
                    {/* Bar for current stock */}
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLow
                          ? 'bg-gradient-to-r from-amber-500 to-orange-400'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${Math.max(currentPct, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
