import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth';
import { getSupabaseConfig } from '@/lib/supabase/config';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  // 1. Clear unified session cookie
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    maxAge: 0,
    expires: new Date(0),
    path: '/',
  });

  // 2. Clear any Supabase or auth session cookies
  const allCookies = request.cookies.getAll();
  for (const cookie of allCookies) {
    if (
      cookie.name.startsWith('sb-') ||
      cookie.name === SESSION_COOKIE_NAME ||
      cookie.name.includes('auth') ||
      cookie.name.includes('token') ||
      cookie.name.includes('session')
    ) {
      response.cookies.set({
        name: cookie.name,
        value: '',
        maxAge: 0,
        expires: new Date(0),
        path: '/',
      });
    }
  }

  // 3. Invalidate Supabase server session
  try {
    const { url, anonKey, isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      const supabase = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                maxAge: 0,
                expires: new Date(0),
                path: '/',
              });
            });
          },
        },
      });
      await supabase.auth.signOut();
    }
  } catch (err) {
    console.warn('Supabase server signOut notice:', err);
  }

  return response;
}
