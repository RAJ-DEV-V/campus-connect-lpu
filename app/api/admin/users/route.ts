import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAllUsers, getCommunityVerificationLinks, revokeUserCommunityAccess } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const forceFresh = searchParams.get('fresh') === 'true';

    const users = await getAllUsers(forceFresh);

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
    if (!session || (!session.isAdmin && !session.isOwner)) {
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
        const { updateCommunityJoined } = await import('@/lib/db');
        const fallback = await updateCommunityJoined(userId, false, null);
        if (!fallback) {
          return NextResponse.json({ error: 'User not found or revocation failed' }, { status: 404 });
        }
      }
      return NextResponse.json({ success: true, message: 'User community verification access revoked successfully.' });
    }

    if (action === 'approve_verification') {
      const { updateCommunityJoined, getCommunityVerificationLinks, upsertUser } = await import('@/lib/db');
      const links = await getCommunityVerificationLinks();
      const primaryLink = links.find((l) => l.is_active) || links[0];
      let updatedUser = await updateCommunityJoined(userId, true, primaryLink?.id);
      if (!updatedUser && body.email) {
        updatedUser = await updateCommunityJoined(body.email, true, primaryLink?.id);
      }
      if (!updatedUser) {
        const email = body.email || (userId.includes('@') ? userId : `${userId}@student.lpu.in`);
        updatedUser = await upsertUser({
          id: userId,
          name: body.name || 'Student',
          email,
          community_joined: true,
        });
      }
      return NextResponse.json({ success: true, message: 'User community verification approved successfully.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Admin user action error:', error);
    return NextResponse.json({ error: error.message || 'Failed to perform user action' }, { status: 500 });
  }
}
