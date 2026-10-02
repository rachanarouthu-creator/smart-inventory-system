import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, Trash2, Edit2, Check, X, Plus, Calendar, 
  AlertCircle, RefreshCw, Layers, ArrowUpDown, ChevronDown, ChevronUp,
  Package, AlertTriangle, Clock, AlertOctagon, ShieldCheck, DollarSign,
  Download, RotateCw
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { 
  updateProduct, deleteProduct, updateProductStock,
  getReportExportUrl, getProductBatches, addProductBatch, getFEFORecommendation,
  getProductImageUrl 
} from '../api';

export default function Dashboard({ 
  inventory, 
  stats, 
  isLoading, 
  onRefresh, 
  onNavigateToAdd, 
  addNotification,
  searchFilter = '' 
}) {
  const [searchQuery, setSearchQuery] = useState(searchFilter || '');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedImage, setSelectedImage] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: 1, minimum_stock: 5, price: 0, expiry_date: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = closest expiry first

  // Batch & FEFO state
  const [selectedProductForBatches, setSelectedProductForBatches] = useState(null);
  const [batchesList, setBatchesList] = useState([]);
  const [fefoInfo, setFefoInfo] = useState(null);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({ batch_number: '', quantity: 10, expiry_date: '' });
  const [isAddingBatch, setIsAddingBatch] = useState(false);

  const handleOpenBatches = async (item) => {
    setSelectedProductForBatches(item);
    setIsLoadingBatches(true);
    setNewBatchForm({
      batch_number: `LOT-${item.id}-${Date.now().toString().slice(-4)}`,
      quantity: 10,
      expiry_date: item.expiry_date || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
    });
    try {
      const [batchesRes, fefoRes] = await Promise.all([
        getProductBatches(item.id).catch(() => ({ batches: [] })),
        getFEFORecommendation(item.id).catch(() => ({ has_recommendation: false }))
      ]);
      setBatchesList(batchesRes.batches || []);
      setFefoInfo(fefoRes);
    } catch (e) {
      console.error('Failed to load batches:', e);
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!selectedProductForBatches) return;
    setIsAddingBatch(true);
    try {
      await addProductBatch(selectedProductForBatches.id, {
        batch_number: newBatchForm.batch_number,
        quantity: parseInt(newBatchForm.quantity, 10),
        expiry_date: newBatchForm.expiry_date,
      });
      addNotification?.({
        type: 'success',
        title: 'Batch Created',
        message: `Batch #${newBatchForm.batch_number} added for ${selectedProductForBatches.name}.`,
      });
      // Refresh batches & main inventory
      const [batchesRes, fefoRes] = await Promise.all([
        getProductBatches(selectedProductForBatches.id).catch(() => ({ batches: [] })),
        getFEFORecommendation(selectedProductForBatches.id).catch(() => ({ has_recommendation: false }))
      ]);
      setBatchesList(batchesRes.batches || []);
      setFefoInfo(fefoRes);
      onRefresh?.();
      setNewBatchForm({
        batch_number: `LOT-${selectedProductForBatches.id}-${Date.now().toString().slice(-4)}`,
        quantity: 10,
        expiry_date: selectedProductForBatches.expiry_date || ''
      });
    } catch (err) {
      addNotification?.({
        type: 'error',
        title: 'Failed to Add Batch',
        message: err.message,
      });
    } finally {
      setIsAddingBatch(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const cats = new Set(inventory.map((item) => item.category));
    return ['ALL', ...Array.from(cats)];
  }, [inventory]);

  // Filtered and sorted products
  const filteredProducts = useMemo(() => {
    let result = inventory.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat =
        selectedCategory === 'ALL' || item.category.toLowerCase() === selectedCategory.toLowerCase();

      const normalizedStatus = item.status.toUpperCase().replace(/\s+/g, '_');
      const matchesStatus =
        selectedStatus === 'ALL' ||
        (selectedStatus === 'LOW_STOCK' ? item.is_low_stock : normalizedStatus === selectedStatus);

      return matchesSearch && matchesCat && matchesStatus;
    });

    result.sort((a, b) => {
      const diff = a.days_left - b.days_left;
      return sortOrder === 'asc' ? diff : -diff;
    });

    return result;
  }, [inventory, searchQuery, selectedCategory, selectedStatus, sortOrder]);

  const handleStartEdit = (item) => {
    setEditingId(item.id);
    setEditForm({
      quantity: item.quantity,
      minimum_stock: item.minimum_stock ?? 5,
      price: item.price ?? 0,
      expiry_date: item.expiry_date,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ quantity: 1, minimum_stock: 5, price: 0, expiry_date: '' });
  };

  const handleSaveEdit = async (id) => {
    setIsSaving(true);
    try {
      await updateProduct(id, {
        quantity: parseInt(editForm.quantity, 10),
        minimum_stock: parseInt(editForm.minimum_stock, 10) || 5,
        price: parseFloat(editForm.price) || 0.0,
        expiry_date: editForm.expiry_date,
      });
      setEditingId(null);
      onRefresh();
      addNotification?.({
        type: 'success',
        title: 'Product Updated',
        message: 'Product changes saved successfully.',
      });
    } catch (err) {
      addNotification?.({
        type: 'error',
        title: 'Save Failed',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStockDelta = async (item, delta) => {
    try {
      const res = await updateProductStock(item.id, { delta });
      onRefresh();
      addNotification?.({
        type: 'success',
        title: 'Stock Updated',
        message: `${item.name}: ${item.quantity} → ${res.new_quantity}`,
      });
    } catch (err) {
      addNotification?.({
        type: 'error',
        title: 'Stock Update Failed',
        message: err.message,
      });
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteProduct(id);
      setDeleteConfirmId(null);
      onRefresh();
      addNotification?.({
        type: 'success',
        title: 'Product Deleted',
        message: `"${name}" removed from inventory.`,
      });
    } catch (err) {
      addNotification?.({
        type: 'error',
        title: 'Delete Failed',
        message: err.message,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Inventory Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Real-time stock counts, shelf-life monitoring, and minimum threshold alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Report Buttons */}
          <a
            href={getReportExportUrl('csv')}
            download="inventory_report.csv"
            className="hidden sm:flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
            title="Download CSV Report"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </a>
          <a
            href={getReportExportUrl('json')}
            download="inventory_report.json"
            className="hidden sm:flex items-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors"
            title="Download JSON Report"
          >
            <Download className="w-3.5 h-3.5 text-teal-400" />
            <span>Export JSON</span>
          </a>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Refresh Inventory"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => onNavigateToAdd()}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Dynamic Database-Driven KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* 1. PRODUCT TYPES */}
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Product Types</div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">
            {stats?.product_types ?? inventory.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Unique items</div>
        </div>

        {/* 2. TOTAL UNITS */}
        <div className="glass-panel p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
          <div className="text-[11px] font-medium text-teal-400 uppercase tracking-wider">Total Units</div>
          <div className="text-2xl sm:text-3xl font-black text-teal-300 mt-1">
            {stats?.total_units ?? 0}
          </div>
          <div className="text-[10px] text-teal-500/80 mt-0.5">Sum of all stock</div>
        </div>

        {/* 3. EXPIRING SOON */}
        <div className="glass-panel p-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <div className="text-[11px] font-medium text-yellow-400 uppercase tracking-wider">Expiring Soon</div>
          <div className="text-2xl sm:text-3xl font-black text-yellow-300 mt-1">
            {stats?.expiring_soon ?? 0}
          </div>
          <div className="text-[10px] text-yellow-500/80 mt-0.5">&le;30 days remaining</div>
        </div>

        {/* 4. EXPIRED */}
        <div className="glass-panel p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Expired</div>
          <div className="text-2xl sm:text-3xl font-black text-rose-300 mt-1">
            {stats?.expired ?? 0}
          </div>
          <div className="text-[10px] text-rose-500/80 mt-0.5">Past shelf life</div>
        </div>

        {/* 5. LOW STOCK */}
        <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 col-span-2 sm:col-span-1">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Low Stock</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">
            {stats?.low_stock ?? 0}
          </div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">&le; minimum level</div>
        </div>
      </div>

      {/* Search, Filter & Sort Controls */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inventory products..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'SAFE', 'EXPIRING_SOON', 'EXPIRED', 'LOW_STOCK'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'EXPIRING_SOON' ? 'Soon' : st === 'LOW_STOCK' ? 'Low Stock' : st}
              </button>
            ))}
          </div>

          {/* Sort By Expiry Date */}
          <button
            onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
            title="Toggle sort order by days left"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>{sortOrder === 'asc' ? 'Earliest Expiry' : 'Latest Expiry'}</span>
          </button>
        </div>
      </div>

      {/* Inventory Products Display: Table on Desktop, Cards on Mobile */}
      {filteredProducts.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Layers className="w-6 h-6" />
          </div>
          <div className="text-base font-semibold text-slate-300">No products match your filter</div>
          <div className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or clear the status filter to view all items.
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Product</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">In Stock</th>
                  <th className="py-3.5 px-4">Min. Stock</th>
                  <th className="py-3.5 px-4">Price</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((item) => {
                  const isEditing = editingId === item.id;
                  const isLow = item.is_low_stock || item.quantity <= (item.minimum_stock ?? 5);

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Product Name & Photo with Low Stock warning */}
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center gap-3">
                          {item.image_path ? (
                            <img
                              src={getProductImageUrl(item.image_path)}
                              alt={item.name}
                              onClick={() => setSelectedImage({ url: getProductImageUrl(item.image_path), title: item.name })}
                              className="w-10 h-10 object-cover rounded-xl border border-slate-700/80 shadow-sm cursor-pointer hover:scale-105 hover:border-emerald-500 transition-all flex-shrink-0 bg-slate-900"
                              title="Click to view image"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0 text-xs font-bold">
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="hover:text-emerald-300 transition-colors">{item.name}</span>
                              {isLow && (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⚠️ LOW
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">ID #{item.id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300 text-[11px]">
                          {item.category}
                        </span>
                      </td>

                      {/* Quantity & Quick Delta Buttons */}
                      <td className="py-3.5 px-4 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantity: e.target.value })
                            }
                            className="w-16 px-2 py-1 rounded bg-slate-900 border border-emerald-500/50 text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isLow ? 'text-amber-400' : 'text-slate-200'}`}>
                              {item.quantity}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleQuickStockDelta(item, -1)}
                                disabled={item.quantity <= 0}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px] disabled:opacity-30"
                                title="Reduce stock by 1"
                              >
                                -
                              </button>
                              <button
                                onClick={() => handleQuickStockDelta(item, 1)}
                                className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-[10px]"
                                title="Increase stock by 1"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Minimum Stock Level */}
                      <td className="py-3.5 px-4 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            min="0"
                            value={editForm.minimum_stock}
                            onChange={(e) =>
                              setEditForm({ ...editForm, minimum_stock: e.target.value })
                            }
                            className="w-16 px-2 py-1 rounded bg-slate-900 border border-emerald-500/50 text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <span className="text-slate-400">{item.minimum_stock ?? 5} units</span>
                        )}
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editForm.price}
                            onChange={(e) =>
                              setEditForm({ ...editForm, price: e.target.value })
                            }
                            className="w-20 px-2 py-1 rounded bg-slate-900 border border-emerald-500/50 text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <span className="text-slate-300">${(item.price ?? 0).toFixed(2)}</span>
                        )}
                      </td>

                      {/* Expiry Date */}
                      <td className="py-3.5 px-4 font-mono">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editForm.expiry_date}
                            onChange={(e) =>
                              setEditForm({ ...editForm, expiry_date: e.target.value })
                            }
                            className="px-2 py-1 rounded bg-slate-900 border border-emerald-500/50 text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <span>{item.expiry_date}</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} daysLeft={item.days_left} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSaveEdit(item.id)}
                              disabled={isSaving}
                              className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Save"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenBatches(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-300 hover:bg-teal-500/10 transition-colors"
                              title="Batches & FEFO"
                            >
                              <Layers className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Edit Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {deleteConfirmId === item.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDelete(item.id, item.name)}
                                  className="px-2 py-1 rounded bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-bold"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="p-1 text-slate-400 hover:text-white"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-slate-800">
            {filteredProducts.map((item) => {
              const isEditing = editingId === item.id;
              const isLow = item.is_low_stock || item.quantity <= (item.minimum_stock ?? 5);

              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.image_path ? (
                        <img
                          src={getProductImageUrl(item.image_path)}
                          alt={item.name}
                          onClick={() => setSelectedImage({ url: getProductImageUrl(item.image_path), title: item.name })}
                          className="w-12 h-12 object-cover rounded-xl border border-slate-700 shadow cursor-pointer flex-shrink-0 bg-slate-900"
                          title="Click to view photo"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 flex-shrink-0 text-xs font-bold">
                          {item.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-white text-base flex items-center gap-2">
                          <span>{item.name}</span>
                          {isLow && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              ⚠️ LOW
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono uppercase">
                          {item.category} • ID #{item.id}
                        </span>
                      </div>
                    </div>
                    <StatusBadge status={item.status} daysLeft={item.days_left} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Stock / Min</span>
                      {isEditing ? (
                        <div className="flex gap-1 mt-1">
                          <input
                            type="number"
                            min="0"
                            value={editForm.quantity}
                            onChange={(e) =>
                              setEditForm({ ...editForm, quantity: e.target.value })
                            }
                            className="w-1/2 px-1 py-0.5 rounded bg-slate-950 border border-emerald-500 text-white font-mono text-xs"
                          />
                          <input
                            type="number"
                            min="0"
                            value={editForm.minimum_stock}
                            onChange={(e) =>
                              setEditForm({ ...editForm, minimum_stock: e.target.value })
                            }
                            className="w-1/2 px-1 py-0.5 rounded bg-slate-950 border border-emerald-500 text-white font-mono text-xs"
                          />
                        </div>
                      ) : (
                        <span className="font-bold text-slate-200 font-mono text-sm">
                          {item.quantity} / <span className="text-slate-500 text-xs">{item.minimum_stock ?? 5}</span>
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Expiry Date</span>
                      {isEditing ? (
                        <input
                          type="date"
                          value={editForm.expiry_date}
                          onChange={(e) =>
                            setEditForm({ ...editForm, expiry_date: e.target.value })
                          }
                          className="w-full mt-1 px-1.5 py-1 rounded bg-slate-950 border border-emerald-500 text-white text-[11px] font-mono"
                        />
                      ) : (
                        <span className="font-mono text-xs text-slate-300">{item.expiry_date}</span>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions Bar */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleQuickStockDelta(item, 1)}
                        className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                      >
                        +1 Stock
                      </button>
                      <button
                        onClick={() => handleOpenBatches(item)}
                        className="px-2 py-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/30 text-xs font-bold"
                      >
                        Batches
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            disabled={isSaving}
                            className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                          >
                            <Check className="w-3.5 h-3.5" /> Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="py-1 px-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="flex items-center gap-1 py-1 px-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs hover:text-white"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>

                          {deleteConfirmId === item.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(item.id, item.name)}
                                className="py-1 px-2.5 rounded-lg bg-rose-500 text-white font-bold text-xs"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="p-1 text-slate-400"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(item.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 bg-slate-900 border border-slate-800"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Batches & FEFO Modal */}
      {selectedProductForBatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <span>Batches for {selectedProductForBatches.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Total Stock: <span className="text-white font-mono font-bold">{selectedProductForBatches.quantity}</span> units
                </p>
              </div>
              <button
                onClick={() => setSelectedProductForBatches(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* FEFO Rotation Highlight Card */}
            {fefoInfo?.has_recommendation && (
              <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" />
                    FEFO Recommendation (Use First)
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Earliest Expiry
                  </span>
                </div>
                <div className="text-xs text-slate-300 flex justify-between">
                  <span>Batch #{fefoInfo.batch_number} ({fefoInfo.quantity} units)</span>
                  <span className="font-mono text-emerald-300 font-semibold">{fefoInfo.expiry_date} ({fefoInfo.days_left}d left)</span>
                </div>
              </div>
            )}

            {/* Existing Batches List */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Active Batches ({batchesList.length})
              </h4>
              {isLoadingBatches ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading batch records...</div>
              ) : batchesList.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
                  No individual batches tracked yet. Add one below to track lot numbers and FEFO.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {batchesList.map((batch) => (
                    <div
                      key={batch.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-bold text-white">#{batch.batch_number}</div>
                        <div className="text-[11px] text-slate-400">{batch.quantity} units</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-slate-300 text-[11px]">{batch.expiry_date}</div>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono mt-0.5 ${
                          batch.status === 'EXPIRED' ? 'bg-rose-500/20 text-rose-300' :
                          batch.status === 'EXPIRING_SOON' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {batch.days_left}d left
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add New Batch Form */}
            <form onSubmit={handleCreateBatch} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Batch Intake</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Batch / Lot #</label>
                  <input
                    type="text"
                    required
                    value={newBatchForm.batch_number}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, batch_number: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Units Received</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newBatchForm.quantity}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Batch Expiry</label>
                  <input
                    type="date"
                    required
                    value={newBatchForm.expiry_date}
                    onChange={(e) => setNewBatchForm({ ...newBatchForm, expiry_date: e.target.value })}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isAddingBatch}
                  className="py-1.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs disabled:opacity-50 transition-colors"
                >
                  {isAddingBatch ? 'Registering...' : 'Add Batch & Update Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Image Lightbox Modal */}
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel p-4 rounded-2xl max-w-md w-full border border-slate-700 space-y-3 relative shadow-2xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📸 {selectedImage.title}</span>
              </h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center max-h-[360px]">
              <img
                src={selectedImage.url}
                alt={selectedImage.title}
                className="w-full h-full object-contain max-h-[360px]"
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
              <span>Cataloged Product Image</span>
              <button
                onClick={() => setSelectedImage(null)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
