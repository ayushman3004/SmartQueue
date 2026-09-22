import React, { useState, useEffect } from 'react';
import { usePerfMode } from '../utils/cookiePerf';

export default function PerfToggle() {
  const { mode, setMode, isOptimized, isAndroid, isWindows, isMobile } = usePerfMode();
  const [open, setOpen] = useState(false);
  const [showNotice, setShowNotice] = useState(false);

  useEffect(() => {
    // Show a brief subtle notification on first visit or mobile if optimized
    const hasSeenNotice = sessionStorage.getItem('serveq_perf_notice_seen');
    if (!hasSeenNotice && isOptimized) {
      setShowNotice(true);
      sessionStorage.setItem('serveq_perf_notice_seen', 'true');
      const timer = setTimeout(() => setShowNotice(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOptimized]);

  const platformLabel = isAndroid ? 'Android' : isWindows ? 'Windows' : isMobile ? 'Mobile' : 'Desktop';

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 font-sans select-none">
      {/* Toast Notice */}
      {showNotice && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-zinc-950/90 text-white border border-teal-500/40 backdrop-blur-xl shadow-2xl shadow-teal-500/10 text-xs animate-in fade-in slide-in-from-bottom-2">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
          <span>
            Performance optimized for <strong className="text-teal-300">{platformLabel}</strong> & saved in cookies.
          </span>
          <button
            onClick={() => setShowNotice(false)}
            className="text-zinc-400 hover:text-white ml-1 text-sm font-bold leading-none cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Popover Menu */}
      {open && (
        <div className="w-72 p-4 rounded-2xl bg-zinc-950/95 text-white border border-zinc-800 backdrop-blur-xl shadow-2xl shadow-black/80 flex flex-col gap-3 animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span className="text-xs font-black uppercase tracking-wider text-white">Performance Settings</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white text-xs cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 leading-relaxed">
            Optimized for Android, Windows, and high-frequency displays to eliminate scrolling lag and GPU stutter. Preferences are stored in a persistent cookie.
          </div>

          <div className="flex flex-col gap-1.5 pt-1">
            <button
              onClick={() => { setMode('optimized'); }}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isOptimized
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-sm shadow-teal-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>🚀</span>
                <div className="text-left">
                  <div>Smooth 60FPS Mode</div>
                  <div className="text-[10px] font-normal text-zinc-400">Zero lag • Smooth video • Low GPU</div>
                </div>
              </div>
              {isOptimized && <span className="text-teal-400">✓</span>}
            </button>

            <button
              onClick={() => { setMode('high'); }}
              className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                !isOptimized
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-sm shadow-teal-500/20'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <span>✨</span>
                <div className="text-left">
                  <div>Cinematic FX Mode</div>
                  <div className="text-[10px] font-normal text-zinc-400">Full scrub • Max 3D depth</div>
                </div>
              </div>
              {!isOptimized && <span className="text-teal-400">✓</span>}
            </button>
          </div>

          <div className="pt-1 text-[10px] text-zinc-500 flex items-center justify-between border-t border-zinc-800/80">
            <span>Cookie: <code className="text-teal-400 font-mono">serveq_perf_mode</code></span>
            <span className="text-teal-400">Active</span>
          </div>
        </div>
      )}

      {/* Floating Pill Toggle Button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-zinc-950/80 hover:bg-zinc-900 text-white border border-zinc-800/80 hover:border-teal-500/50 backdrop-blur-md shadow-xl text-xs font-bold tracking-wide transition-all cursor-pointer group active:scale-95"
        title="Toggle performance optimizations"
      >
        <span className={`w-2 h-2 rounded-full ${isOptimized ? 'bg-teal-400 shadow-sm shadow-teal-400' : 'bg-indigo-400'}`} />
        <span className="text-zinc-300 group-hover:text-white">
          {isOptimized ? '⚡ 60FPS Mode' : '✨ Cinematic Mode'}
        </span>
        <span className="text-[10px] text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded-md border border-zinc-800">
          Cookie
        </span>
      </button>
    </div>
  );
}
