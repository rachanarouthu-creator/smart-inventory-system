import React, { useState, useEffect } from 'react';
import { PlusCircle, Calendar, Package, Tag, ArrowLeft, CheckCircle2, AlertOctagon } from 'lucide-react';
import { addProduct } from '../api';

const COMMON_CATEGORIES = [
  'Food',
  'Health Drink',
  'Cleaning',
  'Medicine',
  'Dairy',
  'Beverage',
  'Spice',
  'Snack',
];

export default function AddProduct({ prefillName = '', onProductAdded, onCancel, addNotification }) {
  const [name, setName] = useState(prefillName);
  const [category, setCategory] = useState('Food');
  const [quantity, setQuantity] = useState(1);
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefillName) {
      setName(prefillName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }, [prefillName]);

  // Quick Date Shortcut Helper
  const setExpiryOffset = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setExpiryDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!expiryDate) {
      setError('Please select an expiry date.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await addProduct({
        name: name.trim(),
        category: category.trim(),
        quantity: parseInt(quantity, 10) || 1,
        expiry_date: expiryDate,
      });

      addNotification({
        type: 'success',
        title: 'Product Added',
        message: `"${name}" was successfully added to your inventory.`,
      });

      if (onProductAdded) {
        onProductAdded();
      }
    } catch (err) {
      setError(err.message || 'Failed to add product');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Go Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Add New Product
          </h1>
          <p className="text-xs text-slate-400">
            Enter product details or items your camera model hasn't learned yet.
          </p>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800">
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Product Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Product Name *
            </label>
            <div className="relative">
              <Package className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Organic Almond Milk, Basmati Rice..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Category
            </label>
            <div className="relative mb-2">
              <Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter or select category"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                    category.toLowerCase() === cat.toLowerCase()
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity & Expiry Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Expiry Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Expiry Date *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Expiry Date Quick Presets */}
          <div>
            <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">
              Quick expiry shortcuts from today:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '+7 Days', days: 7 },
                { label: '+1 Month', days: 30 },
                { label: '+3 Months', days: 90 },
                { label: '+6 Months', days: 180 },
                { label: '+1 Year', days: 365 },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => setExpiryOffset(preset.days)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>Adding to Pantry...</span>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Save to Inventory</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="py-3 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-sm font-semibold border border-slate-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
