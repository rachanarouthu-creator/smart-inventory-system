import React, { useState, useEffect } from 'react';
import { Camera, LayoutDashboard, PlusCircle, Sparkles, AlertTriangle, BarChart3, History, Server } from 'lucide-react';
import NotificationCenter from './NotificationCenter';
import ApiSettingsModal from './ApiSettingsModal';
import { checkBackendHealth } from '../api';

export default function Navbar({ activeTab, setActiveTab, stats, alertsCount, onBackendChange }) {
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState(null);

  const totalAlerts = alertsCount !== undefined 
    ? alertsCount 
    : ((stats?.expired || 0) + (stats?.expiring_soon || 0) + (stats?.low_stock || 0));

  useEffect(() => {
    checkBackendHealth().then((res) => {
      setIsBackendHealthy(res.ok);
    });
  }, []);

  const handleConnected = () => {
    setIsBackendHealthy(true);
    if (onBackendChange) onBackendChange();
  };

  const tabs = [
    {
      id: 'scan',
      label: 'AI Scanner',
      icon: Camera,
      badge: null,
    },
    {
      id: 'dashboard',
      label: 'Inventory',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: AlertTriangle,
      badge: totalAlerts > 0 ? totalAlerts : null,
      badgeColor: (stats?.expired || 0) > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'history',
      label: 'Scan History',
      icon: History,
      badge: null,
    },
    {
      id: 'add',
      label: 'Add Product',
      icon: PlusCircle,
      badge: null,
    },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <div 
            onClick={() => setActiveTab('scan')} 
            className="flex items-center gap-2.5 cursor-pointer select-none group flex-shrink-0"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
                Smart Inventory <span className="text-emerald-400 font-mono text-xs px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">AI</span>
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">AI Vision & Expiry Intelligence</div>
            </div>
          </div>

          {/* Right Section: Tabs, API Status & Notification Center */}
          <div className="flex items-center gap-2">
            {/* Tab Navigation */}
            <nav className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-900/80 rounded-xl border border-slate-800 max-w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 shadow-sm border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.id === 'dashboard' ? 'Inventory' : tab.id === 'history' ? 'History' : tab.label}</span>
                    {tab.badge !== null && tab.badge !== undefined && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Backend Connection Trigger */}
            <button
              onClick={() => setIsApiModalOpen(true)}
              title="API Backend Status & Configuration"
              className={`p-2 rounded-xl border transition-all flex items-center gap-1.5 text-xs ${
                isBackendHealthy === true
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:bg-emerald-500/20'
                  : isBackendHealthy === false
                  ? 'bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Server className="w-4 h-4" />
              <span className={`w-2 h-2 rounded-full ${
                isBackendHealthy === true ? 'bg-emerald-400 animate-pulse' : isBackendHealthy === false ? 'bg-rose-400' : 'bg-amber-400'
              }`} />
            </button>

            {/* System Notification Center */}
            <NotificationCenter onNavigateToTab={setActiveTab} />
          </div>
        </div>
      </header>

      <ApiSettingsModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        onConnected={handleConnected}
      />
    </>
  );
}
