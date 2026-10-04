import { NextRequest, NextResponse } from 'next/server';
import { loginWithGoogleProfile, signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getUserByEmail, getUserById, upsertUser, isAdmin as checkIsAdmin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, avatar_url } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    // Explicitly reject any test / demo accounts
    const cleanEmail = String(email).toLowerCase().trim();
    if (cleanEmail === 'admin@lpu.in' || cleanEmail === 'amanpreet.k@lpu.in') {
      return NextResponse.json({ error: 'Unauthorized demo account' }, { status: 403 });
    }

    const displayName = name || cleanEmail.split('@')[0];
    const { token, user, isAdmin, isOwner, role } = await loginWithGoogleProfile({
      email: cleanEmail,
      name: displayName,
      avatar_url: avatar_url,
    });

    // Destination routing:
    // If admin or owner -> /admin
    // If community_joined = true -> Study Material Library
    // If community_joined = false -> Community Verification
    const destination = (isAdmin || isOwner) ? '/admin' : (user.community_joined ? '/library' : '/community');

    const response = NextResponse.json({
      success: true,
      user,
      isAdmin,
      isOwner,
      role,
      redirectUrl: destination,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: error.message || 'Failed to authenticate' }, { status: 500 });
  }
}
