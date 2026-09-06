import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, CheckCircle2, AlertTriangle, AlertOctagon, RefreshCw, Plus, Minus, ArrowRight, Layers, Clock } from 'lucide-react';
import { scanItem, updateProduct } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function Scan({ onNavigateToAdd, onNavigateToDashboard, addNotification, refreshInventory }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isUpdatingQty, setIsUpdatingQty] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (.jpg, .png, etc.).');
      return;
    }

    setError(null);
    setScanResult(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setError(null);
      setScanResult(null);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please upload or snap a photo of a pantry product first.');
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      const data = await scanItem(selectedFile);
      setScanResult(data);

      // Trigger urgency alert toast if expired or expiring soon
      if (data.status === 'EXPIRED') {
        addNotification({
          type: 'error',
          title: `⚠️ Product Expired: ${data.product_name}`,
          message: `This item expired ${Math.abs(data.days_left)} days ago (${data.expiry_date}). Dispose or replace it.`,
        });
      } else if (data.status === 'EXPIRING_SOON') {
        addNotification({
          type: 'warning',
          title: `⏳ Expiring Soon: ${data.product_name}`,
          message: `Only ${data.days_left} days left until expiry (${data.expiry_date})!`,
        });
      } else if (data.status === 'SAFE') {
        addNotification({
          type: 'success',
          title: `✅ Identified: ${data.product_name}`,
          message: `Item is SAFE with ${data.days_left} days remaining.`,
        });
      }
    } catch (err) {
      setError(err.message || 'Error communicating with pantry vision service.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAdjustQuantity = async (delta) => {
    if (!scanResult?.inventory_id || isUpdatingQty) return;
    const newQty = Math.max(0, (scanResult.quantity || 0) + delta);
    setIsUpdatingQty(true);

    try {
      await updateProduct(scanResult.inventory_id, { quantity: newQty });
      setScanResult((prev) => ({ ...prev, quantity: newQty }));
      if (refreshInventory) refreshInventory();
      addNotification({
        type: 'success',
        title: 'Quantity Updated',
        message: `${scanResult.product_name} quantity changed to ${newQty}.`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        title: 'Update Failed',
        message: err.message,
      });
    } finally {
      setIsUpdatingQty(false);
    }
  };

  const resetScan = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Pantry Vision <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Scanner</span>
        </h1>
        <p className="text-sm text-slate-400 max-w-lg mx-auto">
          Snap or upload a photo of any kitchen pantry item. The AI vision model classifies the product and checks its expiry status in your inventory.
        </p>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Upload / Capture Box */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-800">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
            id="pantry-camera-input"
          />

          {!previewUrl ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-72 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl flex flex-col items-center justify-center gap-4 cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Camera className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="text-center px-4">
                <div className="text-sm font-semibold text-slate-200">
                  Click to take photo or browse
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Drag & drop image files (JPG, PNG, WebP)
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <div className="relative w-full h-72 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Product preview"
                  className="w-full h-full object-contain"
                />
                <button
                  onClick={resetScan}
                  className="absolute top-3 right-3 bg-slate-950/80 hover:bg-slate-900 text-slate-300 p-2 rounded-lg border border-slate-700 text-xs backdrop-blur-md flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Change
                </button>
              </div>

              <button
                onClick={handleScan}
                disabled={isScanning}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analyzing Image with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Scan & Check Expiry</span>
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="w-full mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 flex-shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Scan Result Panel */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between border border-slate-800">
          {!scanResult ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-slate-600" />
              </div>
              <div className="text-sm font-medium text-slate-400">Awaiting Product Photo</div>
              <div className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Once scanned, product classification, stock count, and live expiry countdown will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Identity Header */}
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                    {scanResult.category}
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-0.5">
                    {scanResult.product_name}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      {scanResult.confidence}% confidence
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {scanResult.model_type}
                    </span>
                  </div>
                </div>

                <StatusBadge status={scanResult.status} daysLeft={scanResult.days_left} />
              </div>

              {/* Expiry Countdown Highlight */}
              {scanResult.in_inventory ? (
                <div
                  className={`p-4 rounded-xl border ${
                    scanResult.status === 'EXPIRED'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      : scanResult.status === 'EXPIRING_SOON'
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
                      <Clock className="w-4 h-4" />
                      Expiry Status
                    </div>
                    <div className="text-xs font-mono">{scanResult.expiry_date}</div>
                  </div>

                  <div className="text-xl sm:text-2xl font-black mt-2 tracking-tight">
                    {scanResult.status === 'EXPIRED' ? (
                      <span>EXPIRED {Math.abs(scanResult.days_left)} DAYS AGO</span>
                    ) : scanResult.status === 'EXPIRING_SOON' ? (
                      <span>EXPIRING IN {scanResult.days_left} DAYS!</span>
                    ) : (
                      <span>SAFE • {scanResult.days_left} DAYS REMAINING</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                  <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                    Not in Inventory
                  </div>
                  <div className="text-xs text-slate-400">
                    Model classified this as <strong className="text-white">{scanResult.detected_label}</strong>, but it hasn't been saved in your inventory list yet.
                  </div>
                </div>
              )}

              {/* Quantity and Actions */}
              {scanResult.in_inventory ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-xs text-slate-400 font-medium">In Stock Quantity</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAdjustQuantity(-1)}
                        disabled={isUpdatingQty || scanResult.quantity <= 0}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="font-mono text-base font-bold text-white w-6 text-center">
                        {scanResult.quantity}
                      </span>
                      <button
                        onClick={() => handleAdjustQuantity(1)}
                        disabled={isUpdatingQty}
                        className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={onNavigateToDashboard}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>View in Inventory Dashboard</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onNavigateToAdd(scanResult.detected_label)}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add "{scanResult.product_name}" to Inventory</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
