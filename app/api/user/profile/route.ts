import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserById, updateUserProfile } from '@/lib/db';

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

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'Student name is required.' },
        { status: 400 }
      );
    }

    const updatedUser = await updateUserProfile(session.userId, {
      name: name.trim(),
      year: parsedYear,
    });

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        year: updatedUser.year,
        profile_completed: Boolean(updatedUser.name && updatedUser.year),
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
