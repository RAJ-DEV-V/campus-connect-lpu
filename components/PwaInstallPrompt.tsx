'use client';

import React, { useState, useEffect } from 'react';
import { DownloadCloud, X, Smartphone, Share2, PlusSquare, Sparkles } from 'lucide-react';

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('PWA ServiceWorker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('PWA ServiceWorker registration notice:', err);
        });
    }

    // 2. Check if already installed & running in standalone mode
    const standaloneCheck =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standaloneCheck);

    if (standaloneCheck) return;

    // 3. Check if user recently dismissed the banner in the last 5 days
    try {
      const lastDismissed = localStorage.getItem('lpu_pwa_dismissed_at');
      if (lastDismissed) {
        const diffDays = (Date.now() - parseInt(lastDismissed, 10)) / (1000 * 60 * 60 * 24);
        if (diffDays < 5) {
          return;
        }
      }
    } catch {}

    // 4. Check if iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Delay showing banner by 4 seconds on iOS for non-intrusive appearance
      const timer = setTimeout(() => {
        setDismissed(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // 5. Android / Chromium BeforeInstallPrompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setDismissed(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User installed Campus Connect PWA');
    }
    setDeferredPrompt(null);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosGuide(false);
    try {
      localStorage.setItem('lpu_pwa_dismissed_at', Date.now().toString());
    } catch {}
  };

  if (isStandalone || dismissed) {
    return null;
  }

  return (
    <>
      {/* Floating Bottom PWA Banner */}
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
        <div className="bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-white flex items-start gap-3.5 ring-1 ring-white/10">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-lpu-600 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-orange-500/20">
            <Smartphone className="w-6 h-6 text-white" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white tracking-tight">
                Install Campus Connect LPU
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                App
              </span>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-snug">
              Install to your home screen for full-screen mode, 0s loading, and offline access without typing URLs!
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-orange-500/20 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{isIos ? 'How to Install' : 'Install App'}</span>
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
              >
                Later
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm">Install on iPhone / iPad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIosGuide(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Apple Safari allows installing Campus Connect directly without the App Store:
            </p>

            <div className="space-y-3 bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  1
                </div>
                <div>
                  Tap the <strong className="text-white">Share</strong> button at the bottom of Safari (<Share2 className="w-3.5 h-3.5 inline text-sky-400" />).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  2
                </div>
                <div>
                  Scroll down and tap <strong className="text-white">&ldquo;Add to Home Screen&rdquo;</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-emerald-400" />).
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                  3
                </div>
                <div>
                  Tap <strong className="text-white">Add</strong> in the top-right corner. You&apos;re done!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowIosGuide(false);
                setDismissed(true);
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 text-white font-bold text-xs shadow-md transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
