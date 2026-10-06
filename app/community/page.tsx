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
  Copy,
  HelpCircle,
  Send,
  BookOpen
} from 'lucide-react';

export default function CommunityVerificationPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('https://chat.whatsapp.com/ElGakQUGGa1IMam5FlAiqw');
  const [hasClickedJoin, setHasClickedJoin] = useState(false);
  const [pastedLink, setPastedLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);

  // Manual Verification Request States
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [requestError, setRequestError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        // 1. Fetch current user
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUser(data.user);
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

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappNumber.trim()) {
      setRequestError('Please enter your WhatsApp phone number.');
      return;
    }

    setRequestSubmitting(true);
    setRequestError('');
    setRequestSuccess(false);

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'community_verification',
          title: 'Manual Community Verification Request',
          description: requestNote.trim() || 'Student requested manual verification after joining WhatsApp community group.',
          whatsapp_number: whatsappNumber.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setRequestError(data.error || 'Failed to submit verification request. Please try again.');
        setRequestSubmitting(false);
        return;
      }

      setRequestSuccess(true);
      setRequestSubmitting(false);
    } catch (err: any) {
      setRequestError('Failed to submit request. Please check your internet connection and try again.');
      setRequestSubmitting(false);
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
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${
            user?.community_joined || verifiedSuccess
              ? 'text-emerald-600 bg-emerald-50 border-emerald-200 font-bold'
              : 'text-lpu-700 bg-orange-50 border-orange-200'
          }`}>
            <Users className="w-3.5 h-3.5" /> 2. Community Verification
          </span>
          <span className="text-slate-300">→</span>
          <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${
            user?.community_joined || verifiedSuccess
              ? 'text-emerald-600 bg-emerald-50 border-emerald-200 font-bold'
              : 'text-slate-400 bg-slate-100 border-slate-200'
          }`}>
            {user?.community_joined || verifiedSuccess ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />} 
            3. Unlock Library
          </span>
        </div>

        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {user?.community_joined ? 'Campus Connect Community Hub' : 'Community Membership Verification'}
          </h2>

          <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            {user?.community_joined 
              ? 'Stay connected with all official updates, announcements, and paper discussions.' 
              : '“Join the Campus Connect LPU community to unlock the complete study-material library.”'}
          </p>
        </div>

        {/* ALREADY VERIFIED STATE */}
        {user?.community_joined ? (
          <div className="mt-8 space-y-6">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white border border-emerald-200 text-center space-y-4 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center mx-auto shadow-md shadow-emerald-600/20">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 mb-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Community Member
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900">
                  Full Library Access Unlocked
                </h3>
                <p className="text-xs text-slate-600 mt-1.5 max-w-md mx-auto leading-relaxed">
                  Your student account has permanent unlocked access to all notes, mid-term papers, end-term papers, and PYQs.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={handleJoinClick}
                  className="py-3 px-5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  Open WhatsApp Community
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>

                <button
                  type="button"
                  onClick={() => router.push('/library')}
                  className="py-3 px-5 rounded-xl font-bold text-xs text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-lpu-600" />
                  Browse Study Library
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
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
                  className="w-full py-3.5 px-5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
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
                  className="w-full py-3.5 px-6 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-lpu-600 to-amber-500 hover:from-lpu-700 hover:to-amber-600 shadow-md shadow-orange-500/20 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
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

              {/* FACING ISSUES EVEN WHEN JOINED SECTION */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/80 to-orange-50/60 border border-amber-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                    Facing issues even after joining the community?
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  If you joined our official WhatsApp group but are unable to copy or verify the invite link, enter your WhatsApp number below. The admin will review and verify your access from the admin dashboard.
                </p>

                {requestSuccess ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-extrabold text-emerald-950">Verification Request Submitted!</p>
                      <p className="font-normal text-emerald-700 text-[11px] mt-0.5">
                        Admin received your WhatsApp number and can approve your access from the dashboard.
                      </p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleRequestVerification} className="space-y-3 pt-1">
                    {requestError && (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                        {requestError}
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Your WhatsApp Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-amber-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-lpu-500 focus:ring-1 focus:ring-lpu-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Message / Note to Admin (Optional)
                      </label>
                      <input
                        type="text"
                        value={requestNote}
                        onChange={(e) => setRequestNote(e.target.value)}
                        placeholder="e.g. Joined the WhatsApp group with this number, please approve"
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-lpu-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={requestSubmitting || !whatsappNumber.trim()}
                      className="w-full py-3 px-4 rounded-xl font-bold text-xs text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50 active:scale-98 cursor-pointer"
                    >
                      {requestSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Submitting Request...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          Send Request to Admin for Verification
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

            </div>
          </>
        )}

        {/* Verification Transparency */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-orange-50/60 border border-orange-200/60 text-[11px] text-slate-600 leading-relaxed">
            <Info className="w-4 h-4 text-lpu-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800">Community Access Verified: </span>
              Submitting an approved Campus Connect community invite link unlocks permanent access to notes, mid-term papers, end-term papers, and PYQs.
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <button
            onClick={async () => {
              try {
                await fetch('/api/auth/logout', { method: 'POST' });
                try {
                  const { createClient } = await import('@/lib/supabase/client');
                  const supabase = createClient();
                  if (supabase) await supabase.auth.signOut();
                } catch (e) {}
                try {
                  if (typeof window !== 'undefined') {
                    Object.keys(localStorage).forEach((k) => {
                      if (k.startsWith('sb-') || k.includes('supabase') || k.includes('auth')) {
                        localStorage.removeItem(k);
                      }
                    });
                    sessionStorage.clear();
                  }
                } catch (e) {}
                window.location.href = '/login';
              } catch (err) {
                window.location.href = '/login';
              }
            }}
            className="text-xs text-slate-400 hover:text-rose-600 font-semibold transition-colors"
          >
            Sign out or switch account
          </button>
        </div>

      </div>
    </div>
  );
}
