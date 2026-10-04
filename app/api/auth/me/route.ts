import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserById, isAdmin as checkIsAdmin, getUserRole, touchUserActivity } from '@/lib/db';

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  // Update last_active_at whenever authenticated user accesses the platform
  await touchUserActivity(user.id);

  const userRole = await getUserRole(user.email || user.id);
  const isAdmin = userRole === 'owner' || userRole === 'admin';
  const isOwner = userRole === 'owner';

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar_url: user.avatar_url,
      community_joined: user.community_joined,
      created_at: user.created_at,
      last_login: user.last_login,
      last_active_at: new Date().toISOString(),
      role: userRole,
      isAdmin,
      isOwner,
    },
  });
}
