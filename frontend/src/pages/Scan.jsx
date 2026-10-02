import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, Sparkles, CheckCircle2, AlertTriangle, AlertOctagon, 
  RefreshCw, Plus, Minus, ArrowRight, Clock, Video, VideoOff, Layers, Package, Eye,
  Calendar, Tag, ChevronDown, ChevronUp, RotateCw, Image as ImageIcon
} from 'lucide-react';
import { scanItem, updateProductStock, addProductBatch, getFEFORecommendation, getSampleImages, getProductImageUrl, getApiBase } from '../api';
import StatusBadge from '../components/StatusBadge';

export default function Scan({ onNavigateToAdd, onNavigateToDashboard, addNotification, refreshInventory }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [isUpdatingQty, setIsUpdatingQty] = useState(false);
  const [customQtyInput, setCustomQtyInput] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [stockSuccessMsg, setStockSuccessMsg] = useState(null);
  const [sampleImages, setSampleImages] = useState([]);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Batches & FEFO state
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showBatchesList, setShowBatchesList] = useState(false);
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({ batch_number: '', quantity: 10, expiry_date: '' });

  // Live Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop camera when unmounting
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Load sample dataset pictures for 1-click testing
  useEffect(() => {
    getSampleImages()
      .then((data) => setSampleImages(data || []))
      .catch(() => {});
  }, []);

  const handlePickSample = async (sample) => {
    setIsLoadingSample(true);
    setError(null);
    try {
      // 1. Try local bundled static asset from /uploads/ or /samples/
      // This is instant, 100% reliable, zero CORS, and works on Vercel, Render and localhost!
      const localPath = sample.image_url.startsWith('/') ? sample.image_url : `/${sample.image_url}`;
      let resp = null;
      let usedPreview = localPath;

      try {
        resp = await fetch(localPath);
        if (!resp.ok) throw new Error('Local sample path not ok');
      } catch {
        // Fallback to backend API URL if local fetch failed
        const fullUrl = getProductImageUrl(sample.image_url);
        usedPreview = fullUrl;
        resp = await fetch(fullUrl);
      }

      if (!resp || !resp.ok) {
        throw new Error('Could not load sample image file');
      }

      const blob = await resp.blob();
      const file = new File([blob], `${sample.label}.jpg`, { type: blob.type || 'image/jpeg' });
      setSelectedFile(file);
      setPreviewUrl(usedPreview);
      setScanResult(null);
    } catch (err) {
      console.warn('Sample image load error:', err);
      setError(`Failed to load sample image: ${err.message}. Please select or upload a photo directly.`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable:', err);
      setError('Camera access not available or permission denied. Please use the file upload option.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `scan_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(blob));
      setScanResult(null);
      setError(null);
      setStockSuccessMsg(null);
    }, 'image/jpeg', 0.92);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (.jpg, .png, .webp).');
      return;
    }

    stopCamera();
    setError(null);
    setScanResult(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setStockSuccessMsg(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      stopCamera();
      setError(null);
      setScanResult(null);
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStockSuccessMsg(null);
    }
  };

  const handleScan = async () => {
    if (!selectedFile) {
      setError('Please upload or snap a photo of a product first.');
      return;
    }

    setIsScanning(true);
    setError(null);
    setStockSuccessMsg(null);

    try {
      const data = await scanItem(selectedFile);
      setScanResult(data);

      if (data.status === 'EXPIRED') {
        addNotification?.({
          type: 'error',
          title: `⚠️ Product Expired: ${data.product_name}`,
          message: `This item expired ${Math.abs(data.days_left)} days ago (${data.expiry_date}).`,
        });
      } else if (data.status === 'EXPIRING_SOON') {
        addNotification?.({
          type: 'warning',
          title: `⏳ Expiring Soon: ${data.product_name}`,
          message: `Only ${data.days_left} days left until expiry (${data.expiry_date})!`,
        });
      } else if (data.status === 'SAFE') {
        addNotification?.({
          type: 'success',
          title: `✓ Product Identified`,
          message: `${data.product_name} (${data.category}) • ${data.confidence}% confidence.`,
        });
      }
    } catch (err) {
      const base = getApiBase();
      if ((!base || base.includes('localhost')) && typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
        setError(
          'Cannot reach AI Backend from Vercel. Please click the Server icon at the top right of the navigation bar to connect your Render backend URL.'
        );
      } else {
        setError(err.message || 'Error communicating with AI vision service.');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleAdjustStock = async (delta = null, absoluteQty = null) => {
    if (!scanResult?.inventory_id || isUpdatingQty) return;
    setIsUpdatingQty(true);
    setStockSuccessMsg(null);

    try {
      const payload = {
        scan_id: scanResult.scan_id || null,
      };
      if (delta !== null) payload.delta = delta;
      if (absoluteQty !== null) payload.quantity = Math.max(0, absoluteQty);

      const res = await updateProductStock(scanResult.inventory_id, payload);

      const prevQty = scanResult.quantity;
      const newQty = res.new_quantity;

      setScanResult((prev) => ({
        ...prev,
        quantity: newQty,
        is_low_stock: res.is_low_stock,
      }));

      setStockSuccessMsg(`✓ Stock updated successfully: ${scanResult.product_name}: ${prevQty} → ${newQty}`);
      setShowCustomInput(false);
      setCustomQtyInput('');

      if (refreshInventory) refreshInventory();

      addNotification?.({
        type: 'success',
        title: '✓ Stock Updated',
        message: `${scanResult.product_name}: ${prevQty} → ${newQty} units.`,
      });
    } catch (err) {
      addNotification?.({
        type: 'error',
        title: 'Update Failed',
        message: err.message,
      });
    } finally {
      setIsUpdatingQty(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e?.preventDefault?.();
    if (!scanResult?.inventory_id || !newBatchForm.batch_number.trim() || !newBatchForm.expiry_date) return;
    setIsSubmittingBatch(true);
    try {
      const created = await addProductBatch(scanResult.inventory_id, {
        batch_number: newBatchForm.batch_number.trim(),
        quantity: parseInt(newBatchForm.quantity, 10) || 1,
        expiry_date: newBatchForm.expiry_date,
      });

      let fefo = scanResult.fefo_recommendation;
      try {
        fefo = await getFEFORecommendation(scanResult.inventory_id);
      } catch (_) {}

      const updatedBatches = [...(scanResult.batches || []), created];
      setScanResult((prev) => ({
        ...prev,
        quantity: prev.quantity + created.quantity,
        is_low_stock: (prev.quantity + created.quantity) <= (prev.minimum_stock ?? 5),
        batches: updatedBatches,
        fefo_recommendation: fefo || prev.fefo_recommendation,
      }));

      setShowBatchModal(false);
      setNewBatchForm({ batch_number: '', quantity: 10, expiry_date: '' });
      setStockSuccessMsg(`✓ Added Batch #${created.batch_number} (+${created.quantity} units, exp: ${created.expiry_date})`);
      if (refreshInventory) refreshInventory();
      addNotification?.({
        type: 'success',
        title: 'Batch Added',
        message: `Batch #${created.batch_number} created for ${scanResult.product_name}.`,
      });
    } catch (err) {
      setError(err.message || 'Failed to add batch');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const resetScan = () => {
    stopCamera();
    setSelectedFile(null);
    setPreviewUrl(null);
    setScanResult(null);
    setError(null);
    setStockSuccessMsg(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header with Technical Honesty Wording */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          AI Vision Scanner powered by KNN image classification
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Smart Product <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-300">Vision Scanner</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
          Capture or upload product packaging. The system extracts visual features, predicts the product via KNN, searches the SQLite inventory database, and enables instant stock updates.
        </p>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT PANEL: Capture / Upload & Image Preview */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-800">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
            id="product-upload-input"
          />

          {/* Camera View Mode */}
          {isCameraActive ? (
            <div className="w-full space-y-4">
              <div className="relative w-full h-72 rounded-xl overflow-hidden bg-black border border-slate-700 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-emerald-500/40 pointer-events-none rounded-xl m-4 flex items-center justify-center">
                  <span className="text-[11px] font-mono bg-slate-950/80 text-emerald-300 px-2 py-0.5 rounded">
                    Align Product in Frame
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  <Camera className="w-4 h-4" />
                  <span>Snap Photo</span>
                </button>
                <button
                  onClick={stopCamera}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <VideoOff className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          ) : !previewUrl ? (
            /* Upload or Launch Camera Empty State */
            <div className="w-full space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all group"
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7 text-emerald-400" />
                </div>
                <div className="text-center px-4">
                  <div className="text-sm font-semibold text-slate-200">
                    Click to Upload Product Image
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Drag & drop JPG, PNG, or WebP photo
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={startCamera}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors border border-slate-700"
                >
                  <Camera className="w-4 h-4 text-emerald-400" />
                  <span>Open Live Camera</span>
                </button>
              </div>

              {/* Quick Dataset Sample Images Bar */}
              {sampleImages.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Dataset Samples (1-Click Test)
                    </span>
                    {isLoadingSample && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Loading...
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Click any product to load its image and run instant AI computer vision check:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {sampleImages.map((s) => (
                      <button
                        type="button"
                        key={s.label}
                        onClick={() => handlePickSample(s)}
                        className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-emerald-500/60 text-left transition-all group"
                      >
                        <img
                          src={s.image_url?.startsWith('/') ? s.image_url : `/${s.image_url}`}
                          alt={s.name}
                          onError={(e) => {
                            const full = getProductImageUrl(s.image_url);
                            if (full && e.currentTarget.src !== full) {
                              e.currentTarget.src = full;
                            }
                          }}
                          className="w-7 h-7 object-cover rounded border border-slate-800 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold text-slate-200 group-hover:text-emerald-400 truncate">
                            {s.name}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">{s.category}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Image Preview Ready to Scan */
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
                  <RefreshCw className="w-3.5 h-3.5" /> Retake
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
                    <span>AI analysis in progress...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Run AI Classification & Check Inventory</span>
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

        {/* RIGHT PANEL: AI Analysis, Prediction, Inventory Info & Stock Controls */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between border border-slate-800">
          {!scanResult ? (
            <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-slate-600" />
              </div>
              <div className="text-sm font-medium text-slate-300">Awaiting Product Photo</div>
              <div className="text-xs text-slate-500 max-w-xs leading-relaxed">
                Once scanned, product classification, real KNN confidence score, inventory stock levels, and expiry countdown will appear here.
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Product Identified Header with Catalog Photo */}
              <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  {scanResult.image_path && (
                    <img
                      src={getProductImageUrl(scanResult.image_path)}
                      alt={scanResult.product_name}
                      className="w-14 h-14 object-cover rounded-xl border border-slate-700 shadow-md flex-shrink-0 bg-slate-900"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 mb-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Product Identified</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">
                      {scanResult.product_name}
                    </h2>
                    <div className="text-xs text-slate-400 mt-0.5">
                      <span className="font-mono text-emerald-300">{scanResult.category}</span>
                      <span className="mx-1.5">•</span>
                      <span className="font-semibold text-white">{scanResult.confidence}% confidence</span>
                    </div>
                  </div>
                </div>

                <StatusBadge status={scanResult.status} daysLeft={scanResult.days_left} />
              </div>

              {/* Low Confidence or Unknown Warning */}
              {scanResult.confidence < 60 && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Moderate confidence ({scanResult.confidence}%). Verify product packaging matches result.</span>
                </div>
              )}

              {/* Database Connection Result Card */}
              {scanResult.in_inventory ? (
                <div className="space-y-3">
                  {/* Stock & Expiry Snapshot */}
                  <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Inventory Stock:</span>
                      <span className="font-mono text-base font-bold text-white">
                        {scanResult.quantity} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Minimum Stock Level:</span>
                      <span className="font-mono text-xs text-slate-300">
                        {scanResult.minimum_stock ?? 5} units
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Expiry Date:</span>
                      <span className="font-mono text-xs text-slate-200">
                        {scanResult.expiry_date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                      <span className="text-slate-400">Shelf Life Status:</span>
                      <span className="font-semibold">
                        {scanResult.status === 'EXPIRED' ? (
                          <span className="text-rose-400">🔴 EXPIRED ({Math.abs(scanResult.days_left)}d ago)</span>
                        ) : scanResult.status === 'EXPIRING_SOON' ? (
                          <span className="text-yellow-400">🟡 EXPIRING SOON ({scanResult.days_left}d left)</span>
                        ) : (
                          <span className="text-emerald-400">🟢 SAFE ({scanResult.days_left}d left)</span>
                        )}
                      </span>
                    </div>

                    {/* Low Stock Warning Alert & Restock Recommendation */}
                    {scanResult.is_low_stock && (
                      <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold space-y-2">
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>⚠️ LOW STOCK — Stock ({scanResult.quantity}) is at or below minimum ({scanResult.minimum_stock ?? 5})</span>
                        </div>
                        <button
                          onClick={() => handleAdjustStock(scanResult.recommended_restock || 10)}
                          disabled={isUpdatingQty}
                          className="w-full py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Restock Recommended (+{scanResult.recommended_restock || 10} units)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* FEFO Rotation Priority Card */}
                  {scanResult.fefo_recommendation?.has_recommendation && (
                    <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-teal-950/30 border border-emerald-500/40 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider">
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>FEFO Rotation Priority</span>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Use First
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-300 font-semibold">
                          Batch #{scanResult.fefo_recommendation.batch_number}
                        </span>
                        <span className="font-mono text-white font-bold">
                          {scanResult.fefo_recommendation.quantity} units available
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                        <span>Earliest Expiry:</span>
                        <span className="font-mono text-emerald-300">
                          {scanResult.fefo_recommendation.expiry_date} ({scanResult.fefo_recommendation.days_left}d left)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Batches Management Section */}
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setShowBatchesList(!showBatchesList)}
                        className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors"
                      >
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        <span>Tracked Batches ({scanResult.batches?.length || 0})</span>
                        {showBatchesList ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => setShowBatchModal(!showBatchModal)}
                        className="py-1 px-2 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>New Batch</span>
                      </button>
                    </div>

                    {/* Inline Batch Intake Form */}
                    {showBatchModal && (
                      <div className="p-3 rounded-lg bg-slate-950 border border-teal-500/30 space-y-2.5 mt-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-teal-300">
                          <span>Add Batch for {scanResult.product_name}</span>
                          <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white">✕</button>
                        </div>
                        <form onSubmit={handleCreateBatch} className="space-y-2">
                          <div>
                            <label className="text-[10px] text-slate-400 block mb-0.5">Batch / Lot #</label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. LOT-2026-01"
                              value={newBatchForm.batch_number}
                              onChange={(e) => setNewBatchForm({ ...newBatchForm, batch_number: e.target.value })}
                              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Units</label>
                              <input
                                type="number"
                                min="1"
                                required
                                value={newBatchForm.quantity}
                                onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-400 block mb-0.5">Batch Expiry</label>
                              <input
                                type="date"
                                required
                                value={newBatchForm.expiry_date}
                                onChange={(e) => setNewBatchForm({ ...newBatchForm, expiry_date: e.target.value })}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowBatchModal(false)}
                              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSubmittingBatch}
                              className="px-3 py-1 rounded bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs disabled:opacity-50"
                            >
                              {isSubmittingBatch ? 'Saving...' : 'Add Batch'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* Batches Table / Accordion */}
                    {showBatchesList && (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {scanResult.batches && scanResult.batches.length > 0 ? (
                          scanResult.batches.map((b) => (
                            <div key={b.id} className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-white">#{b.batch_number}</span>
                                <span className="text-slate-400 font-mono">{b.quantity} units</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-slate-400 font-mono">{b.expiry_date}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                  b.status === 'EXPIRED' ? 'bg-rose-500/20 text-rose-300' :
                                  b.status === 'EXPIRING_SOON' ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-emerald-500/20 text-emerald-300'
                                }`}>
                                  {b.days_left}d
                                </span>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-500 p-2 text-center">
                            No batches recorded. Click "New Batch" to start tracking inventory batches.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Stock Update Notification Feedback */}
                  {stockSuccessMsg && (
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>{stockSuccessMsg}</span>
                    </div>
                  )}

                  {/* Stock Action Controls */}
                  <div className="space-y-2 pt-1">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                      Update Stock Directly
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleAdjustStock(1)}
                        disabled={isUpdatingQty}
                        className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+1 Stock</span>
                      </button>

                      <button
                        onClick={() => handleAdjustStock(5)}
                        disabled={isUpdatingQty}
                        className="py-2.5 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+5 Stock</span>
                      </button>

                      <button
                        onClick={() => setShowCustomInput(!showCustomInput)}
                        disabled={isUpdatingQty}
                        className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs flex items-center justify-center gap-1 transition-colors"
                      >
                        <span>Custom Qty</span>
                      </button>
                    </div>

                    {/* Inline Custom Quantity Form */}
                    {showCustomInput && (
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-2 mt-2">
                        <input
                          type="number"
                          min="0"
                          value={customQtyInput}
                          onChange={(e) => setCustomQtyInput(e.target.value)}
                          placeholder="Set exact quantity..."
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                        />
                        <button
                          onClick={() => {
                            const val = parseInt(customQtyInput, 10);
                            if (!isNaN(val) && val >= 0) {
                              handleAdjustStock(null, val);
                            }
                          }}
                          disabled={isUpdatingQty || customQtyInput === ''}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs disabled:opacity-50"
                        >
                          Set
                        </button>
                      </div>
                    )}

                    <button
                      onClick={onNavigateToDashboard}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors mt-2"
                    >
                      <span>View Product in Inventory</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Fallback when Product is NOT in Inventory */
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-slate-300">
                    <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">
                      Product Not In Inventory
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Product identified as <strong className="text-white">{scanResult.product_name}</strong>, but it is not currently in inventory.
                    </p>
                  </div>

                  <button
                    onClick={() => onNavigateToAdd(scanResult.detected_label || scanResult.product_name)}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-500/20"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add "{scanResult.product_name}" to Inventory</span>
                  </button>
                </div>
              )}

              {/* OCR Expiry Detection Transparency Card */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1.5">
                <div className="flex items-center justify-between font-mono">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    OCR Expiry Verification
                  </span>
                  <span className={scanResult.ocr?.match_status ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>
                    {scanResult.ocr?.match_status ? '✓ Confirmed on Pack' : (scanResult.ocr?.detected_dates?.length > 0 ? 'Detected on Pack' : 'Database Validated')}
                  </span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Detected Date: <span className="text-slate-200 font-mono">{scanResult.ocr?.detected_dates?.[0] || 'None detected'}</span></span>
                  <span>DB Expiry: <span className="text-slate-200 font-mono">{scanResult.expiry_date || 'N/A'}</span></span>
                </div>
                {scanResult.ocr?.note && (
                  <div className="text-[10px] text-slate-500 italic">
                    {scanResult.ocr.note}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
