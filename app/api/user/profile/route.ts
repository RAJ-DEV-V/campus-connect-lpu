import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { updateUserProfile, upsertUser } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, year } = body;

    const parsedYear = Number(year);
    if (![1, 2, 3, 4].includes(parsedYear)) {
      return NextResponse.json(
        { error: 'Valid academic year (1, 2, 3, or 4) is required.' },
        { status: 400 }
      );
    }

    const studentName = (typeof name === 'string' && name.trim()) 
      ? name.trim() 
      : (session.name?.trim() || 'Student');

    let updatedUser = await updateUserProfile(session.userId, {
      name: studentName,
      year: parsedYear,
    });

    if (!updatedUser) {
      // Fallback: If student profile record is missing, auto-create/upsert it
      updatedUser = await upsertUser({
        id: session.userId,
        name: studentName,
        email: session.email,
        avatar_url: session.avatar_url,
        community_joined: session.community_joined,
        year: parsedYear,
      });
    }

    // Refresh JWT session cookie with new name & academic year
    const token = await signSession(updatedUser, session.isAdmin, session.role);

    const response = NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        year: updatedUser.year,
        profile_completed: Boolean(updatedUser.name && updatedUser.year),
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
