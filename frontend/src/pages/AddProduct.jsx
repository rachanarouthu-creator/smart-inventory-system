import React, { useState, useEffect, useRef } from 'react';
import {
  PlusCircle,
  Calendar,
  Package,
  Tag,
  ArrowLeft,
  CheckCircle2,
  AlertOctagon,
  DollarSign,
  ShieldAlert,
  Image as ImageIcon,
  UploadCloud,
  X,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { addProduct, uploadProductImage, getProductImageUrl, getSampleImages } from '../api';

const COMMON_CATEGORIES = [
  'Food',
  'Health Drink',
  'Cleaning',
  'Medicine',
  'Dairy',
  'Beverage',
  'Spice',
  'Snack',
  'Personal Care',
  'Pantry',
];

export default function AddProduct({ prefillName = '', onProductAdded, onCancel, addNotification }) {
  const [name, setName] = useState(prefillName);
  const [category, setCategory] = useState('Food');
  const [quantity, setQuantity] = useState(1);
  const [minimumStock, setMinimumStock] = useState(5);
  const [price, setPrice] = useState(0.0);
  const [expiryDate, setExpiryDate] = useState('');
  
  // Image Upload State
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [sampleImages, setSampleImages] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (prefillName) {
      setName(prefillName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    }
  }, [prefillName]);

  // Load sample dataset pictures
  useEffect(() => {
    getSampleImages()
      .then((data) => setSampleImages(data || []))
      .catch(() => {});
  }, []);

  // Quick Expiry Offset Helper: +7 Days, +1 Month, +3 Months, +6 Months, +1 Year
  const setExpiryOffset = (unit, count) => {
    const d = new Date();
    if (unit === 'days') {
      d.setDate(d.getDate() + count);
    } else if (unit === 'months') {
      d.setMonth(d.getMonth() + count);
    } else if (unit === 'years') {
      d.setFullYear(d.getFullYear() + count);
    }
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setExpiryDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleFileChange = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }
    setError(null);
    setImageFile(file);

    // Instant local preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    // Upload to server
    setIsUploadingImage(true);
    try {
      const res = await uploadProductImage(file);
      setImagePath(res.image_path);
    } catch (err) {
      setError(`Failed to upload image: ${err.message}`);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSelectSample = (sample) => {
    setImagePath(sample.image_url);
    setImagePreview(getProductImageUrl(sample.image_url));
    setImageFile(null);
    if (!name.trim()) {
      setName(sample.name);
    }
    if (sample.category) {
      setCategory(sample.category);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setImagePath(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
    const qtyVal = parseInt(quantity, 10);
    if (isNaN(qtyVal) || qtyVal < 0) {
      setError('Quantity cannot be negative.');
      return;
    }
    const minVal = parseInt(minimumStock, 10);
    if (isNaN(minVal) || minVal < 0) {
      setError('Minimum stock cannot be negative.');
      return;
    }
    const priceVal = parseFloat(price);
    if (isNaN(priceVal) || priceVal < 0) {
      setError('Price cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let finalImagePath = imagePath;
      // If an image was selected but not uploaded yet
      if (imageFile && !finalImagePath) {
        setIsUploadingImage(true);
        const res = await uploadProductImage(imageFile);
        finalImagePath = res.image_path;
        setIsUploadingImage(false);
      }

      await addProduct({
        name: name.trim(),
        category: category.trim(),
        quantity: qtyVal,
        minimum_stock: minVal,
        price: priceVal,
        expiry_date: expiryDate,
        image_path: finalImagePath || null,
      });

      addNotification?.({
        type: 'success',
        title: 'Product Added',
        message: `"${name}" was successfully added to your inventory with photo.`,
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
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <span>Add New Product</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold">
              With Picture 📸
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Catalog an inventory product with photo, shelf life, and minimum stock thresholds.
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

          {/* Product Picture Upload Section */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
                Product Picture
              </label>
              {imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Remove
                </button>
              )}
            </div>

            {/* Hidden Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
            />

            {imagePreview ? (
              <div className="relative group rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 flex items-center p-3 gap-4">
                <img
                  src={imagePreview}
                  alt="Product Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-slate-800 shadow-md flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Picture Ready</span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {imageFile ? imageFile.name : 'Dataset Sample Image'}
                  </p>
                  {isUploadingImage ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300 mt-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Uploading to server...</span>
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-500 mt-1">
                      Uploaded & linked to inventory catalog
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Change
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFileChange(e.dataTransfer.files?.[0]);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`cursor-pointer border-2 border-dashed rounded-xl p-5 text-center transition-all ${
                  isDragOver
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/50 hover:bg-slate-900/50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/60 flex items-center justify-center mx-auto mb-2 text-slate-400 group-hover:text-emerald-400">
                  <UploadCloud className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-xs font-semibold text-slate-200">
                  Upload Product Photo
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Drag & drop, browse files, or take photo (PNG, JPG, WebP)
                </div>
              </div>
            )}

            {/* Quick Sample Dataset Pictures */}
            {sampleImages.length > 0 && !imagePreview && (
              <div className="pt-2">
                <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Or choose a preset product photo:
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {sampleImages.slice(0, 7).map((s) => (
                    <button
                      type="button"
                      key={s.label}
                      onClick={() => handleSelectSample(s)}
                      className="flex-shrink-0 flex items-center gap-1.5 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/50 text-[11px] text-slate-300 transition-colors"
                      title={`Select ${s.name}`}
                    >
                      <img
                        src={getProductImageUrl(s.image_url)}
                        alt={s.name}
                        className="w-6 h-6 object-cover rounded"
                      />
                      <span className="truncate max-w-[80px]">{s.name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

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
                placeholder="e.g. Maggi Noodles, Red Label Tea, Horlicks..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Category *
            </label>
            <div className="relative mb-2">
              <Tag className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Enter or select category"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {/* Category Quick chips */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                    category.toLowerCase() === cat.toLowerCase()
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity, Minimum Stock Level & Price */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Initial Stock *
              </label>
              <input
                type="number"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                Min. Stock *
              </label>
              <input
                type="number"
                min="0"
                required
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Unit Price ($/₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
          </div>

          {/* Expiry Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Expiry Date *
            </label>
            <div className="relative mb-2.5">
              <Calendar className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>

            {/* Quick Expiry Shortcuts: +7 Days, +1 Month, +3 Months, +6 Months, +1 Year */}
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setExpiryOffset('days', 7)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
              >
                +7 Days
              </button>
              <button
                type="button"
                onClick={() => setExpiryOffset('months', 1)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
              >
                +1 Month
              </button>
              <button
                type="button"
                onClick={() => setExpiryOffset('months', 3)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
              >
                +3 Months
              </button>
              <button
                type="button"
                onClick={() => setExpiryOffset('months', 6)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
              >
                +6 Months
              </button>
              <button
                type="button"
                onClick={() => setExpiryOffset('years', 1)}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-emerald-400 hover:border-slate-700 transition-colors"
              >
                +1 Year
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingImage}
              className="py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Product...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Save Product with Picture</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
