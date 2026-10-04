'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  CheckCircle, 
  ExternalLink, 
  Sparkles, 
  ShieldCheck, 
  Info, 
  ArrowRight,
  MessageCircle,
  Lock,
  Unlock,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Copy
} from 'lucide-react';

export default function CommunityVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('https://chat.whatsapp.com/campus-connect-lpu-2026');
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [pastedLink, setPastedLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch current user
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
            if (data.user.community_joined) {
              router.push('/library');
              return;
            }
          } else {
            router.push('/login');
            return;
          }
        } else {
          router.push('/login');
          return;
        }

        // 2. Fetch active approved WhatsApp invite link
        const linkRes = await fetch('/api/community/confirm');
        if (linkRes.ok) {
          const linkData = await linkRes.json();
          if (linkData.inviteUrl) {
            setInviteUrl(linkData.inviteUrl);
          }
        }
      } catch (e) {
        router.push('/login');
      }
    }
    loadData();
  }, [router]);

  const handleJoinClick = () => {
    setHasClickedJoin(true);
    setError('');
    window.open(inviteUrl, '_blank', 'noopener,noreferrer');
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedLink.trim()) {
      setError('Please paste the WhatsApp invite link you used to join.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/community/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviteUrl: pastedLink.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        // Standard user-friendly error required by prompt
        setError(
          data.error || 
          '❌ Invite Link Not Recognized. Please make sure you pasted the exact WhatsApp Community/Freshers Group invite link approved by Campus Connect.'
        );
        setSubmitting(false);
        return;
      }

      // Successful verification -> immediately open Study Material Library
      setVerifiedSuccess(true);
      setTimeout(() => {
        router.push('/library?welcome=community_unlocked');
        router.refresh();
      }, 1200);

    } catch (err: any) {
      setError('❌ Verification failed. Please check your internet connection and try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50 relative">
      <div className="absolute inset-0 academic-grid-pattern opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" /> 1. Logged In
          </span>
          <span className="text-slate-300">→</span>
          <span className="flex items-center gap-1 text-lpu-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
            <Users className="w-3.5 h-3.5" /> 2. Community Verification
          </span>
          <span className="text-slate-300">→</span>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${
            verifiedSuccess ? 'text-emerald-600 bg-emerald-50 border border-emerald-200 font-bold' : 'text-slate-400 bg-slate-100'
          }`}>
            <Lock className="w-3.5 h-3.5" /> 3. Unlock Library
          </span>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Community Membership Verification
          </h2>

          <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            “Join the Campus Connect LPU community to unlock the complete study-material library.”
          </p>
        </div>

        {/* Success Banner */}
        {verifiedSuccess && (
          <div className="mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-extrabold text-emerald-900">Community Access Verified!</p>
              <p className="text-emerald-700 text-xs font-normal mt-0.5">Redirecting to your Study Material Library...</p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-bold">{error}</span>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setPastedLink('');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:text-rose-900 bg-rose-100 hover:bg-rose-200 px-2.5 py-1 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Try Again
              </button>
            </div>
          </div>
        )}

        {/* Community Benefits Box */}
        <div className="mt-6 bg-slate-50 rounded-2xl p-5 border border-slate-200/90 text-xs space-y-2.5 text-slate-700">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-lpu-600" />
            Why join the Campus Connect community?
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Instant notification when new Mid-Term & End-Term papers are uploaded.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Connect with fellow LPU students across 1st, 2nd, 3rd & 4th Year.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Exam discussion threads, doubt solving, and faculty question predictions.</span>
          </div>
        </div>

        {/* 2-STEP INTERACTION FORM */}
        <div className="mt-8 space-y-6">
          
          {/* STEP 1: Join Community */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                Join Campus Connect LPU Community
              </span>
              {hasClickedJoin && (
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Opened Link ✓
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Click below to open the official approved WhatsApp invite link and join the group.
            </p>

            <button
              onClick={handleJoinClick}
              type="button"
              className="w-full py-3.5 px-5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <MessageCircle className="w-4 h-4" />
              Join Community (WhatsApp)
              <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-80" />
            </button>
          </div>

          {/* STEP 2: Paste Link & Verify */}
          <form onSubmit={handleVerifySubmit} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                Paste the WhatsApp invite link you used to join
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Paste the invite link from WhatsApp to verify community access and unlock the library.
            </p>

            <div className="relative">
              <input
                type="text"
                value={pastedLink}
                onChange={(e) => {
                  setPastedLink(e.target.value);
                  if (error) setError('');
                }}
                placeholder="https://chat.whatsapp.com/..."
                className="w-full pl-3.5 pr-20 py-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-lpu-500 focus:bg-white transition-all"
                disabled={submitting || verifiedSuccess}
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text) setPastedLink(text);
                  } catch {}
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 hover:text-slate-800 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs"
                title="Paste from clipboard"
              >
                Paste
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || verifiedSuccess || !pastedLink.trim()}
              className="w-full py-3.5 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Verifying Link...
                </>
              ) : verifiedSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Community Access Verified!
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  Verify & Unlock Materials
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

        {/* Verification Transparency (Prompt strict restriction: never claim WhatsApp API verified membership) */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/60 text-[11px] text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 text-lpu-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Community Access Verified: </span>
              Submitting an approved Campus Connect community invite link unlocks permanent access to notes, mid-term papers, end-term papers, and PYQs.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
