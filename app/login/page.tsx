'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  GraduationCap, 
  Lock
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState<{ title: string; desc: string; isConfigError?: boolean } | null>(null);

  React.useEffect(() => {
    // 1. Check query parameters
    const err = searchParams.get('error');
    const errDesc = searchParams.get('error_description');

    // 2. Check hash fragments (Supabase returns #error=... in URL)
    let hashDesc = '';
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      hashDesc = hashParams.get('error_description') || hashParams.get('error') || '';
    }

    const description = errDesc || hashDesc;

    if (err || description) {
      if (
        description.includes('exchange external code') || 
        description.includes('4%2F0A') || 
        description.includes('4/0A') || 
        err === 'oauth_exchange_failed'
      ) {
        setErrorDetails({
          title: 'Google OAuth Setup Error: Unable to exchange external code',
          desc: 'Google rejected the authorization exchange from Supabase. In Google Cloud Console (APIs & Services > Credentials > your OAuth Client), the "Authorized redirect URI" must be https://hfywrezcwyfwsixqdsye.supabase.co/auth/v1/callback (not localhost). Also verify your Client Secret in Supabase has no trailing spaces.',
          isConfigError: true,
        });
      } else {
        setErrorDetails({
          title: 'Authentication Notice',
          desc: decodeURIComponent(description || 'Sign in could not be completed. Please try again.'),
          isConfigError: false,
        });
      }
    }
  }, [searchParams]);

  // Primary Action: Google OAuth Authentication
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();

      if (!supabase) {
        throw new Error('Supabase client is not configured. Please check environment configuration.');
      }

      const origin = window.location.origin;
      const callbackUrl = `${origin}/auth/callback${
        redirectTarget ? `?redirect=${encodeURIComponent(redirectTarget)}` : ''
      }`;

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }
      return; // Browser will redirect to Google
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setError(err.message || 'Google authentication failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-slate-50 relative">
      <div className="absolute inset-0 academic-grid-pattern opacity-40 pointer-events-none" />

      <div className="relative w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-8 sm:p-10">
        
        {/* Brand Crest */}
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-lpu-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/25 mb-4">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Campus Connect <span className="text-lpu-600">LPU</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sign in with Google to unlock verified LPU study materials & papers
          </p>
        </div>

        {errorDetails && (
          <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-slate-800 text-xs text-left space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              {errorDetails.title}
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              {errorDetails.desc}
            </p>
            {errorDetails.isConfigError && (
              <div className="p-2.5 bg-white rounded-lg border border-amber-200 text-[10px] space-y-1 font-mono text-slate-700">
                <div className="text-amber-900 font-bold font-sans">Required Google Cloud Console Setting:</div>
                <div className="text-slate-600 font-sans">Authorized redirect URIs:</div>
                <code className="text-blue-700 break-all select-all font-semibold">https://hfywrezcwyfwsixqdsye.supabase.co/auth/v1/callback</code>
              </div>
            )}
          </div>
        )}

        {error && !errorDetails && (
          <div className="mt-6 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Main Google Sign-In Button */}
        <div className="mt-8 space-y-4">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 rounded-2xl font-bold text-slate-800 text-sm shadow-xs transition-all active:scale-98 disabled:opacity-60"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-400" />
            Zero-friction academic access for LPU students
          </p>
        </div>

      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-lpu-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
