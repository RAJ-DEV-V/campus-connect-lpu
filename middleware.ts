import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { createServerClient } from '@supabase/ssr';
import { getSupabaseConfig } from './lib/supabase/config';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'campus_connect_lpu_super_secret_jwt_key_2026_production'
);

const SESSION_COOKIE_NAME = 'cc_session';

interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  community_joined: boolean;
  isAdmin: boolean;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Static assets and internal routes to skip
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/uploads') ||
    pathname.includes('.') // file extensions
  ) {
    return response;
  }

  let session: SessionPayload | null = null;

  // 1. Check JOSE session cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET_KEY);
      session = payload as unknown as SessionPayload;
    } catch (e) {
      session = null;
    }
  }

  // 2. If no JOSE token, check Supabase SSR cookies if configured
  if (!session) {
    const { url, anonKey, isConfigured } = getSupabaseConfig();
    if (isConfigured) {
      try {
        const supabase = createServerClient(url, anonKey, {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              });
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const userEmail = (user.email || '').toLowerCase().trim();
          const isOwnerEmail = userEmail === 'mishra.rajvansh11@gmail.com';

          // Query public.users for community_joined
          const { data: profile } = await supabase
            .from('users')
            .select('community_joined')
            .eq('id', user.id)
            .single();

          // Check if admin/owner
          const { data: adminRecord } = await supabase
            .from('admins')
            .select('role')
            .or(`user_id.eq.${user.id},email.ilike.${userEmail}`)
            .limit(1);

          const isAdmin = isOwnerEmail || userEmail === 'admin@lpu.in' || (adminRecord && adminRecord.length > 0);

          session = {
            userId: user.id,
            email: user.email || '',
            name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student',
            community_joined: Boolean(profile?.community_joined || isAdmin),
            isAdmin: Boolean(isAdmin),
          };
        }
      } catch (sbErr) {
        // Continue
      }
    }
  }

  // 1. Not logged in
  if (!session) {
    // Protected routes requiring authentication: /library, /dashboard, /materials, /admin, /community
    if (
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/library') ||
      pathname.startsWith('/materials') ||
      pathname.startsWith('/community') ||
      pathname.startsWith('/admin')
    ) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  const isOwnerEmail = session.email.toLowerCase().trim() === 'mishra.rajvansh11@gmail.com';
  const effectiveIsAdmin = isOwnerEmail || session.isAdmin;

  // 2. User is logged in
  if (pathname === '/login') {
    if (effectiveIsAdmin) {
      return NextResponse.redirect(new URL('/admin', request.url));
    } else if (session.community_joined) {
      return NextResponse.redirect(new URL('/library', request.url));
    } else {
      return NextResponse.redirect(new URL('/community', request.url));
    }
  }

  // 3. Admin Route Gatekeeping
  if (pathname.startsWith('/admin')) {
    if (!effectiveIsAdmin) {
      const dashboardUrl = new URL('/dashboard', request.url);
      dashboardUrl.searchParams.set('error', 'unauthorized_admin');
      return NextResponse.redirect(dashboardUrl);
    }
    return response;
  }

  // 4. Community verification check
  // Admin and owner bypass community verification restriction
  if (!session.community_joined && !effectiveIsAdmin) {
    if (
      pathname.startsWith('/dashboard') || 
      pathname.startsWith('/library') ||
      pathname.startsWith('/materials')
    ) {
      return NextResponse.redirect(new URL('/community', request.url));
    }
  }

  // If already joined community and tries to visit /community, forward directly to library
  if (session.community_joined && pathname === '/community') {
    return NextResponse.redirect(new URL('/library', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
