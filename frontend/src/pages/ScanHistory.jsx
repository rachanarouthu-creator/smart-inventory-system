import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, Sparkles, CheckCircle2, XCircle, RefreshCw, Clock, 
  ArrowRight, ArrowUpRight, ArrowDownLeft, Layers, ArrowUpDown
} from 'lucide-react';
import { getScanHistory, getStockMovements } from '../api';

export default function ScanHistory({ onNavigateToScanner, onNavigateToInventory }) {
  const [activeSubTab, setActiveSubTab] = useState('movements'); // 'movements' | 'scans'
  const [history, setHistory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scansData, movementsData] = await Promise.all([
        getScanHistory().catch(() => []),
        getStockMovements().catch(() => [])
      ]);
      setHistory(scansData || []);
      setMovements(movementsData || []);
    } catch (err) {
      console.error('Failed to load audit history:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatDate = (isoStr) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const getMovementBadge = (type) => {
    switch (type) {
      case 'SCAN_INTAKE':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'RESTOCK':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'MANUAL_ADJUST':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      case 'BATCH_ADD':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'CONSUMPTION':
      case 'DISPOSAL':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <History className="w-7 h-7 text-emerald-400" />
            Audit Trail & History
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Complete verifiable log of stock movements, batch intakes, and AI vision classifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={onNavigateToScanner}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" />
            <span>New Scan</span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Toggle */}
      <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900/80 border border-slate-800 w-fit">
        <button
          onClick={() => setActiveSubTab('movements')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeSubTab === 'movements'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          <span>Stock Movement Audit ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scans')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
            activeSubTab === 'scans'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Vision Scans ({history.length})</span>
        </button>
      </div>

      {/* 1. STOCK MOVEMENTS AUDIT TRAIL */}
      {activeSubTab === 'movements' && (
        <>
          {movements.length === 0 && !loading ? (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <ArrowUpDown className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Stock Movements Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Stock changes, batch intakes, and scanner updates will be automatically and immutably recorded here with delta counts.
              </p>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Event ID</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Movement Type</th>
                      <th className="py-3 px-4">Delta</th>
                      <th className="py-3 px-4">New Balance</th>
                      <th className="py-3 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {movements.map((mov) => {
                      const isPositive = mov.quantity_delta > 0;
                      return (
                        <tr key={mov.id} className="hover:bg-slate-900/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-500">#{mov.id}</td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {formatDate(mov.created_at)}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-white">
                            <button
                              onClick={() => onNavigateToInventory(mov.product_name)}
                              className="hover:text-emerald-400 transition-colors text-left"
                            >
                              {mov.product_name}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getMovementBadge(mov.movement_type)}`}>
                              {mov.movement_type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold">
                            <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                              {isPositive ? `+${mov.quantity_delta}` : mov.quantity_delta}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-white font-bold">
                            {mov.new_quantity} units
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {mov.notes || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* 2. AI VISION SCAN HISTORY */}
      {activeSubTab === 'scans' && (
        <>
          {history.length === 0 && !loading ? (
            <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                <History className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white">No Scans Recorded Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Use the AI Scanner to classify a pantry item. Your prediction, confidence score, and inventory sync will be permanently logged here.
              </p>
              <button
                onClick={onNavigateToScanner}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Start First Scan
              </button>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Scan ID</th>
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">AI Prediction</th>
                      <th className="py-3 px-4">Confidence</th>
                      <th className="py-3 px-4">Inventory Match</th>
                      <th className="py-3 px-4">Stock Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {history.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-slate-500">#{record.id}</td>
                        <td className="py-3 px-4 text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {formatDate(record.scanned_at)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-white">
                          <button
                            onClick={() => onNavigateToInventory(record.predicted_name)}
                            className="hover:text-emerald-400 transition-colors text-left"
                          >
                            {record.predicted_name}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                              record.confidence >= 80
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400'
                            }`}
                          >
                            {record.confidence}%
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {record.inventory_found ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Found in DB
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <XCircle className="w-3.5 h-3.5" />
                              Uncataloged
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {record.stock_updated ? (
                            <span className="inline-flex items-center gap-1 text-teal-400 font-semibold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Updated
                            </span>
                          ) : (
                            <span className="text-slate-500">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
