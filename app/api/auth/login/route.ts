import { NextRequest, NextResponse } from 'next/server';
import { loginWithGoogleProfile, signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { getUserByEmail, getUserById, upsertUser, isAdmin as checkIsAdmin } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, avatar_url, preset } = body;

    let targetEmail = email;
    let targetName = name;
    let targetAvatar = avatar_url;

    // Handle presets for rapid testing & evaluation
    if (preset === 'student_rajvansh') {
      targetEmail = 'rajvansh.lpu@gmail.com';
      targetName = 'Rajvansh Kumar';
      targetAvatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    } else if (preset === 'student_new') {
      targetEmail = 'amanpreet.k@lpu.in';
      targetName = 'Amanpreet Kaur';
      targetAvatar = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';
    } else if (preset === 'owner' || targetEmail === 'mishra.rajvansh11@gmail.com') {
      targetEmail = 'mishra.rajvansh11@gmail.com';
      targetName = targetName || 'Rajvansh Mishra (Owner)';
      targetAvatar = targetAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
    } else if (preset === 'admin') {
      targetEmail = 'admin@lpu.in';
      targetName = 'Campus Admin';
      targetAvatar = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150';
    }

    if (!targetEmail) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const displayName = targetName || targetEmail.split('@')[0];
    const { token, user, isAdmin, isOwner, role } = await loginWithGoogleProfile({
      email: targetEmail,
      name: displayName,
      avatar_url: targetAvatar,
    });

    // Flow logic:
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
