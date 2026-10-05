import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { User } from '../db/types';
import { getUserById, getUserByEmail, upsertUser, isAdmin as checkIsAdmin, getUserRole, isOwner as checkIsOwner, touchUserActivity } from '../db';
import { createServerSupabaseClient } from '../supabase/server';

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || 'campus_connect_lpu_super_secret_jwt_key_2026_production'
);

export const SESSION_COOKIE_NAME = 'cc_session';

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  avatar_url?: string;
  community_joined: boolean;
  isAdmin: boolean;
  isOwner?: boolean;
  role?: 'owner' | 'admin' | 'user';
  iat?: number;
  exp?: number;
}

export async function signSession(user: User, isAdminUser: boolean, role?: 'owner' | 'admin' | 'user'): Promise<string> {
  const isOwnerUser = role === 'owner' || user.email.toLowerCase() === 'mishra.rajvansh11@gmail.com';
  const effectiveRole = isOwnerUser ? 'owner' : (isAdminUser ? 'admin' : 'user');

  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    community_joined: user.community_joined,
    isAdmin: isOwnerUser || isAdminUser,
    isOwner: isOwnerUser,
    role: effectiveRole,
  };

  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(SECRET_KEY);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as SessionPayload;
  } catch (err) {
    return null;
  }
}

export async function getCurrentSession(): Promise<SessionPayload | null> {
  try {
    // 1. First check Supabase Auth session if configured
    const supabase = createServerSupabaseClient();
    if (supabase) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const profile = await getUserById(authUser.id);
          const userRole = await getUserRole(authUser.email || authUser.id);
          const isAdminUser = userRole === 'owner' || userRole === 'admin';
          const isOwnerUser = userRole === 'owner';
          const communityJoined = profile ? profile.community_joined : false;

          // Touch user activity
          await touchUserActivity(authUser.id);

          return {
            userId: authUser.id,
            email: authUser.email || '',
            name: profile?.name || authUser.user_metadata?.full_name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Student',
            avatar_url: profile?.avatar_url || authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture,
            community_joined: communityJoined,
            isAdmin: isAdminUser,
            isOwner: isOwnerUser,
            role: userRole,
          };
        }
      } catch (sbErr) {
        // Fallback to cookie check
      }
    }

    // 2. Check HTTP session cookie (works seamlessly in all environments)
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySession(token);
    if (!payload) return null;

    // Refresh community status and role from DB in real time
    let user = await getUserById(payload.userId);
    if (!user && payload.email) {
      user = await getUserByEmail(payload.email);
    }

    if (user) {
      await touchUserActivity(user.id);
    }

    const freshRole = await getUserRole(payload.email || payload.userId);
    const isOwnerUser = freshRole === 'owner' || payload.email?.toLowerCase() === 'mishra.rajvansh11@gmail.com';
    const isAdminUser = isOwnerUser || freshRole === 'admin';

    return {
      ...payload,
      community_joined: user ? user.community_joined : payload.community_joined,
      name: user ? user.name : payload.name,
      avatar_url: user ? user.avatar_url : payload.avatar_url,
      role: isOwnerUser ? 'owner' : freshRole,
      isAdmin: isAdminUser,
      isOwner: isOwnerUser,
    };
  } catch (err) {
    return null;
  }
}

export async function loginWithGoogleProfile(profile: {
  name: string;
  email: string;
  avatar_url?: string;
  subId?: string;
}): Promise<{ token: string; user: User; isAdmin: boolean; isOwner: boolean; role: 'owner' | 'admin' | 'user' }> {
  const existing = await getUserByEmail(profile.email);
  const id = existing ? existing.id : (profile.subId && /^[0-9a-f-]{36}$/i.test(profile.subId) ? profile.subId : crypto.randomUUID());

  const userRole = await getUserRole(profile.email);
  const isOwnerUser = userRole === 'owner';
  const isAdminUser = isOwnerUser || userRole === 'admin';

  const user = await upsertUser({
    id,
    name: profile.name,
    email: profile.email,
    avatar_url: profile.avatar_url,
    community_joined: existing ? existing.community_joined : false,
    year: existing?.year ?? undefined,
  });

  const token = await signSession(user, isAdminUser, userRole);

  return { token, user, isAdmin: isAdminUser, isOwner: isOwnerUser, role: userRole };
}
