import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserById, isAdmin as checkIsAdmin, getUserRole, touchUserActivity } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json(
      { authenticated: false, user: null }, 
      { 
        status: 401,
        headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
      }
    );
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        avatar_url: session.avatar_url,
        community_joined: session.community_joined,
        year: session.year || null,
        profile_completed: Boolean(session.name && session.year),
        role: session.role || (session.isAdmin ? 'admin' : 'user'),
        isAdmin: session.isAdmin,
        isOwner: session.isOwner ?? false,
      },
    },
    {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' }
    }
  );
}
