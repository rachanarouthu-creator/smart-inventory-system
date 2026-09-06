import React from 'react';
import { Camera, LayoutDashboard, PlusCircle, Sparkles, AlertTriangle } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, stats }) {
  const urgentCount = (stats?.expired || 0) + (stats?.expiring_soon || 0);

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
      badge: urgentCount > 0 ? urgentCount : null,
      badgeColor: (stats?.expired || 0) > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-slate-950',
    },
    {
      id: 'add',
      label: 'Add Product',
      icon: PlusCircle,
      badge: null,
    },
  ];

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div 
          onClick={() => setActiveTab('scan')} 
          className="flex items-center gap-2.5 cursor-pointer select-none group"
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

        {/* Tab Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-300 shadow-sm border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${tab.badgeColor}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
