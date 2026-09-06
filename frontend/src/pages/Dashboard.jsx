import React, { useState, useMemo } from 'react';
import { Search, Filter, Trash2, Edit2, Check, X, Plus, Calendar, AlertCircle, RefreshCw, Layers, ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { updateProduct, deleteProduct } from '../api';

export default function Dashboard({ inventory, stats, isLoading, onRefresh, onNavigateToAdd, addNotification }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ quantity: 1, expiry_date: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = closest expiry first

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
        selectedStatus === 'ALL' || normalizedStatus === selectedStatus;

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
      expiry_date: item.expiry_date,
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({ quantity: 1, expiry_date: '' });
  };

  const handleSaveEdit = async (id) => {
    setIsSaving(true);
    try {
      await updateProduct(id, {
        quantity: parseInt(editForm.quantity, 10),
        expiry_date: editForm.expiry_date,
      });
      setEditingId(null);
      onRefresh();
      addNotification({
        type: 'success',
        title: 'Product Updated',
        message: 'Changes saved successfully.',
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Save Failed',
        message: err.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    try {
      await deleteProduct(id);
      setDeleteConfirmId(null);
      onRefresh();
      addNotification({
        type: 'success',
        title: 'Product Deleted',
        message: `"${name}" removed from inventory.`,
      });
    } catch (err) {
      addNotification({
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
            Real-time shelf life monitoring, quantity adjustments, and expiry tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Items</div>
          <div className="text-2xl sm:text-3xl font-black text-white mt-1">{stats?.total ?? 0}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Safe</div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300 mt-1">{stats?.safe ?? 0}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider">Expiring Soon</div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300 mt-1">{stats?.expiring_soon ?? 0}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider">Expired</div>
          <div className="text-2xl sm:text-3xl font-black text-rose-300 mt-1">{stats?.expired ?? 0}</div>
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
            placeholder="Search pantry products..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
          />
        </div>

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Status Filter */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
            {['ALL', 'SAFE', 'EXPIRING_SOON', 'EXPIRED'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  selectedStatus === st
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st === 'EXPIRING_SOON' ? 'Soon' : st}
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
                  <th className="py-3.5 px-4">Quantity</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProducts.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      {/* Product Name */}
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {item.name}
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 text-slate-300 text-[11px]">
                          {item.category}
                        </span>
                      </td>

                      {/* Quantity (Inline editable) */}
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
                          <span className="font-bold text-slate-200">{item.quantity}</span>
                        )}
                      </td>

                      {/* Expiry Date (Inline editable) */}
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
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              title="Edit Quantity or Expiry"
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
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(item.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                                title="Delete Product"
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

          {/* Mobile Card Grid View */}
          <div className="block md:hidden divide-y divide-slate-800">
            {filteredProducts.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-white text-base">{item.name}</div>
                      <span className="text-[11px] text-slate-400 font-mono uppercase">
                        {item.category}
                      </span>
                    </div>
                    <StatusBadge status={item.status} daysLeft={item.days_left} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block uppercase">Quantity</span>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={editForm.quantity}
                          onChange={(e) =>
                            setEditForm({ ...editForm, quantity: e.target.value })
                          }
                          className="w-full mt-1 px-2 py-1 rounded bg-slate-950 border border-emerald-500 text-white font-mono"
                        />
                      ) : (
                        <span className="font-bold text-slate-200 font-mono text-sm">{item.quantity}</span>
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

                  {/* Actions Bar */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 text-xs"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(item)}
                          className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 text-xs hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>

                        {deleteConfirmId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(item.id, item.name)}
                              className="py-1.5 px-3 rounded-lg bg-rose-500 text-white font-bold text-xs"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="p-1.5 text-slate-400"
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
