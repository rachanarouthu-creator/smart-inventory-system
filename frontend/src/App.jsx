import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import Scan from './pages/Scan';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import Analytics from './pages/Analytics';
import ScanHistory from './pages/ScanHistory';
import AddProduct from './pages/AddProduct';
import { getInventory, getAlerts } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ 
    total: 0, 
    product_types: 0, 
    total_units: 0, 
    safe: 0, 
    expiring_soon: 0, 
    expired: 0, 
    low_stock: 0 
  });
  const [alertsCount, setAlertsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [prefillProductName, setPrefillProductName] = useState('');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [notifications, setNotifications] = useState([]);

  const addNotification = useCallback((notif) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newNotif = { id, ...notif };

    setNotifications((prev) => [...prev, newNotif]);

    // Auto-dismiss after 6 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 6000);
  }, []);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const fetchInventoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invData, alertsData] = await Promise.all([
        getInventory().catch(() => ({ items: [], stats: {} })),
        getAlerts().catch(() => ({ summary: { total_alerts: 0 } })),
      ]);

      setInventory(invData.items || []);
      setStats(invData.stats || { 
        total: 0, 
        product_types: 0, 
        total_units: 0, 
        safe: 0, 
        expiring_soon: 0, 
        expired: 0, 
        low_stock: 0 
      });
      setAlertsCount(alertsData?.summary?.total_alerts || 0);

      // Urgent pantry alerts toast notification on initial load
      if (invData.stats?.expired > 0) {
        addNotification({
          type: 'error',
          title: '🚨 Expired Products in Inventory',
          message: `You have ${invData.stats.expired} expired item(s). Check Alerts or Dashboard.`,
        });
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchInventoryData();
  }, [fetchInventoryData]);

  const handleNavigateToAdd = (productName = '') => {
    setPrefillProductName(productName);
    setActiveTab('add');
  };

  const handleNavigateToInventoryWithSearch = (productName = '') => {
    setDashboardSearch(productName);
    setActiveTab('dashboard');
  };

  const handleProductAdded = () => {
    fetchInventoryData();
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation Bar with 6 Tabs */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
        alertsCount={alertsCount} 
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* 1. AI Product Scanner (STAR FEATURE) */}
        {activeTab === 'scan' && (
          <Scan
            onNavigateToAdd={handleNavigateToAdd}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            addNotification={addNotification}
            refreshInventory={fetchInventoryData}
          />
        )}

        {/* 2. Inventory Dashboard */}
        {activeTab === 'dashboard' && (
          <Dashboard
            inventory={inventory}
            stats={stats}
            isLoading={isLoading}
            onRefresh={fetchInventoryData}
            onNavigateToAdd={() => handleNavigateToAdd('')}
            addNotification={addNotification}
            searchFilter={dashboardSearch}
          />
        )}

        {/* 3. Inventory Alerts */}
        {activeTab === 'alerts' && (
          <Alerts
            onNavigateToInventory={handleNavigateToInventoryWithSearch}
            addNotification={addNotification}
            onRefreshGlobal={fetchInventoryData}
          />
        )}

        {/* 4. Analytics & AI Insights */}
        {activeTab === 'analytics' && (
          <Analytics
            onNavigateToInventory={handleNavigateToInventoryWithSearch}
          />
        )}

        {/* 5. AI Scan History */}
        {activeTab === 'history' && (
          <ScanHistory
            onNavigateToScanner={() => setActiveTab('scan')}
            onNavigateToInventory={handleNavigateToInventoryWithSearch}
          />
        )}

        {/* 6. Add Product */}
        {activeTab === 'add' && (
          <AddProduct
            prefillName={prefillProductName}
            onProductAdded={handleProductAdded}
            onCancel={() => setActiveTab('dashboard')}
            addNotification={addNotification}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Smart Inventory AI • Computer Vision & Expiry Intelligence</span>
          <span className="font-mono text-[11px] text-slate-600">FastAPI • React • SQLite • KNN Classifier</span>
        </div>
      </footer>

      {/* Floating Notifications */}
      <Toast notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
}
