import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, signSession, SESSION_COOKIE_NAME } from '@/lib/auth';
import { updateCommunityJoined, findActiveLinkByCode, getActiveCommunityInviteUrl, isAdmin as checkIsAdmin } from '@/lib/db';
import { parseAndValidateWhatsAppInvite } from '@/lib/whatsapp-verify';

export async function GET() {
  try {
    const inviteUrl = await getActiveCommunityInviteUrl();
    return NextResponse.json({
      success: true,
      inviteUrl,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: true,
      inviteUrl: 'https://chat.whatsapp.com/ElGakQUGGa1IMam5FlAiqw',
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { inviteUrl } = body;

    if (!inviteUrl || typeof inviteUrl !== 'string') {
      return NextResponse.json(
        { 
          error: 'Please paste the WhatsApp invite link you used to join the community.',
          code: 'MISSING_LINK'
        }, 
        { status: 400 }
      );
    }

    // 1. Validate & extract code with strict matching
    const parsed = parseAndValidateWhatsAppInvite(inviteUrl);
    if (!parsed.isValid || !parsed.inviteCode) {
      return NextResponse.json(
        {
          error: parsed.error || 'Please paste a valid WhatsApp invite link format (chat.whatsapp.com/...).',
          code: 'INVALID_FORMAT'
        },
        { status: 400 }
      );
    }

    // 2. Lookup against active approved invite links in database
    const matchedLink = await findActiveLinkByCode(parsed.inviteCode);
    if (!matchedLink) {
      return NextResponse.json(
        {
          error: 'Invite Link Not Recognized. Please make sure you pasted the exact WhatsApp Community/Freshers Group invite link approved by Campus Connect.',
          code: 'UNAPPROVED_LINK',
        },
        { status: 400 }
      );
    }

    // 3. Mark user as verified with link ID and timestamp
    const updatedUser = await updateCommunityJoined(session.userId, true, matchedLink.id);
    if (!updatedUser) {
      return NextResponse.json({ error: 'Failed to update community verification status.' }, { status: 500 });
    }

    // 4. Refresh JWT session cookie so middleware immediately grants library access
    const isAdminUser = await checkIsAdmin(updatedUser.email) || await checkIsAdmin(updatedUser.id);
    const newToken = await signSession(updatedUser, isAdminUser);

    const response = NextResponse.json({
      success: true,
      message: 'Community Access Verified! Welcome to Campus Connect LPU Study Material Library.',
      redirectUrl: '/library',
      linkMatched: {
        id: matchedLink.id,
        name: matchedLink.name,
        type: matchedLink.type,
      },
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        community_joined: true,
        community_verified_at: updatedUser.community_verified_at,
        community_verification_link_id: updatedUser.community_verification_link_id,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Community verification error:', error);
    return NextResponse.json({ error: error.message || 'Verification could not be completed.' }, { status: 500 });
  }
}
