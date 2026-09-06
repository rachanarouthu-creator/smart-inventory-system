import React, { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import Scan from './pages/Scan';
import Dashboard from './pages/Dashboard';
import AddProduct from './pages/AddProduct';
import { getInventory } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const [inventory, setInventory] = useState([]);
  const [stats, setStats] = useState({ total: 0, safe: 0, expiring_soon: 0, expired: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [prefillProductName, setPrefillProductName] = useState('');
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
      const data = await getInventory();
      setInventory(data.items || []);
      setStats(data.stats || { total: 0, safe: 0, expiring_soon: 0, expired: 0 });

      // Check for urgent pantry alerts on initial load
      if (data.stats?.expired > 0) {
        addNotification({
          type: 'error',
          title: '🚨 Expired Items in Pantry',
          message: `You have ${data.stats.expired} expired item(s). Check your dashboard immediately.`,
        });
      } else if (data.stats?.expiring_soon > 0) {
        addNotification({
          type: 'warning',
          title: '⚠️ Items Expiring Soon',
          message: `${data.stats.expiring_soon} item(s) will expire in less than 7 days.`,
        });
      }
    } catch (err) {
      console.error('Failed to load pantry data:', err);
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

  const handleProductAdded = () => {
    fetchInventoryData();
    setActiveTab('dashboard');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} stats={stats} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'scan' && (
          <Scan
            onNavigateToAdd={handleNavigateToAdd}
            onNavigateToDashboard={() => setActiveTab('dashboard')}
            addNotification={addNotification}
            refreshInventory={fetchInventoryData}
          />
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            inventory={inventory}
            stats={stats}
            isLoading={isLoading}
            onRefresh={fetchInventoryData}
            onNavigateToAdd={() => handleNavigateToAdd('')}
            addNotification={addNotification}
          />
        )}

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
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Smart Pantry Expiry Tracker • FastAPI & React</span>
          <span className="font-mono text-[11px] text-slate-600">Vision KNN/CNN Pipeline • SQLite</span>
        </div>
      </footer>

      {/* Floating Notifications */}
      <Toast notifications={notifications} onDismiss={dismissNotification} />
    </div>
  );
}
