import React, { useState, useEffect } from 'react';
import { Server, CheckCircle2, AlertTriangle, X, RefreshCw, Globe, HelpCircle } from 'lucide-react';
import { getApiBase, setApiBase, checkBackendHealth } from '../api';

export default function ApiSettingsModal({ isOpen, onClose, onConnected }) {
  const [apiUrl, setApiUrl] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'testing' | 'connected' | 'error'
  const [errorMsg, setErrorMsg] = useState('');
  const [serviceInfo, setServiceInfo] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const current = getApiBase();
      setApiUrl(current);
      testConnection(current);
    }
  }, [isOpen]);

  const testConnection = async (urlToTest) => {
    setStatus('testing');
    setErrorMsg('');
    setServiceInfo(null);

    const result = await checkBackendHealth(urlToTest);
    if (result.ok) {
      setStatus('connected');
      setServiceInfo(result.data);
      if (onConnected) onConnected();
    } else {
      setStatus('error');
      setErrorMsg(result.error);
    }
  };

  const handleSave = () => {
    setApiBase(apiUrl);
    testConnection(apiUrl);
  };

  const handleResetToDefault = () => {
    setApiBase('');
    setApiUrl('');
    testConnection('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-6 space-y-5 text-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">AI Backend Connection</h3>
              <p className="text-[11px] text-slate-400">Configure or test FastAPI server endpoint</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Indicator */}
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          status === 'connected'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : status === 'error'
            ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            : status === 'testing'
            ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
            : 'bg-slate-800/50 border-slate-700/50 text-slate-300'
        }`}>
          <div className="flex items-center gap-2">
            {status === 'connected' && <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
            {status === 'error' && <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />}
            {status === 'testing' && <RefreshCw className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />}
            {status === 'idle' && <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />}
            <div>
              <div className="font-semibold">
                {status === 'connected' && 'Backend Connected & Active'}
                {status === 'error' && 'Backend Offline or Unreachable'}
                {status === 'testing' && 'Testing Connection...'}
                {status === 'idle' && 'Status: Ready'}
              </div>
              {serviceInfo && (
                <div className="text-[10px] text-emerald-400/80">
                  {serviceInfo.service} • Vision Engine: {serviceInfo.vision_engine}
                </div>
              )}
              {errorMsg && (
                <div className="text-[10px] text-rose-400 mt-0.5 max-w-[280px] break-words">
                  {errorMsg}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => testConnection(apiUrl)}
            disabled={status === 'testing'}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${status === 'testing' ? 'animate-spin' : ''}`} /> Test
          </button>
        </div>

        {/* URL Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Backend API URL</span>
            <span className="text-[10px] text-slate-500 font-normal">Leave empty for single-service / same-origin</span>
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="e.g. https://smart-inventory-ai.onrender.com"
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            If you deployed your backend separately on Render or Railway, paste your service URL above.
          </p>
        </div>

        {/* Deployment hints */}
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1 text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
            Quick Deployment Modes:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-slate-400 text-[10px]">
            <li><strong className="text-slate-200">Render Single-URL:</strong> Leave URL empty (FastAPI serves UI directly).</li>
            <li><strong className="text-slate-200">Vercel + Render:</strong> Paste your Render backend URL above and click Save.</li>
            <li><strong className="text-slate-200">Local Dev:</strong> Run <code className="text-emerald-400">uvicorn app.main:app</code> (port 8000).</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-4"
          >
            Reset Default
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 transition-all"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
