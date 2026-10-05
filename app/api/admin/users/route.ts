import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAllUsers, getCommunityVerificationLinks, revokeUserCommunityAccess } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const users = await getAllUsers();

    const links = await getCommunityVerificationLinks();
    const linkMap = new Map<string, string>();
    links.forEach((l) => linkMap.set(l.id, `${l.name} (${l.invite_url})`));

    // Map safely for admin viewing with all verification & identity metadata
    const userList = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar_url: u.avatar_url,
      role: u.role || (u.email.toLowerCase() === 'mishra.rajvansh11@gmail.com' ? 'owner' : (u.email.toLowerCase() === 'admin@lpu.in' ? 'admin' : 'user')),
      community_joined: u.community_joined,
      community_verified_at: u.community_verified_at || null,
      community_verification_link_id: u.community_verification_link_id || null,
      verification_link_name: u.community_verification_link_id ? (linkMap.get(u.community_verification_link_id) || 'Approved Community Link') : null,
      year: u.year ?? null,
      created_at: u.created_at,
      last_login: u.last_login,
      last_active_at: u.last_active_at || u.last_login,
    }));

    return NextResponse.json({ success: true, users: userList });
  } catch (error: any) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, action } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (action === 'revoke_verification') {
      const success = await revokeUserCommunityAccess(userId);
      if (!success) {
        return NextResponse.json({ error: 'User not found or revocation failed' }, { status: 404 });
      }
      return NextResponse.json({ success: true, message: 'User community verification access revoked successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin user action error:', error);
    return NextResponse.json({ error: error.message || 'Failed to perform user action' }, { status: 500 });
  }
}
