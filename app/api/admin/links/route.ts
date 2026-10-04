import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { 
  getCommunityVerificationLinks, 
  createCommunityVerificationLink, 
  updateCommunityVerificationLink, 
  deleteCommunityVerificationLink,
  revokeUsersVerifiedViaLink
} from '@/lib/db';
import { parseAndValidateWhatsAppInvite } from '@/lib/whatsapp-verify';

// GET /api/admin/links - List all verification links with counts
export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const links = await getCommunityVerificationLinks();
    return NextResponse.json({ success: true, links });
  } catch (error: any) {
    console.error('Admin get links error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch links' }, { status: 500 });
  }
}

// POST /api/admin/links - Add a new approved verification link
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name, invite_url, type = 'community', is_active = true } = body;

    if (!name || !invite_url) {
      return NextResponse.json({ error: 'Name and invite URL are required' }, { status: 400 });
    }

    // Validate link format and extract code
    const parsed = parseAndValidateWhatsAppInvite(invite_url);
    if (!parsed.isValid || !parsed.inviteCode) {
      return NextResponse.json(
        { error: parsed.error || 'Please provide a valid WhatsApp invite URL format (chat.whatsapp.com/...)' },
        { status: 400 }
      );
    }

    const newLink = await createCommunityVerificationLink({
      name: name.trim(),
      invite_url: parsed.cleanUrl,
      invite_code: parsed.inviteCode,
      type: type as any,
      is_active: Boolean(is_active),
      created_by: session.userId,
    });

    return NextResponse.json({ success: true, link: newLink }, { status: 201 });
  } catch (error: any) {
    console.error('Admin create link error:', error);
    return NextResponse.json({ error: error.message || 'Failed to create link' }, { status: 500 });
  }
}

// PATCH /api/admin/links - Update link status or revoke users
export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Link ID is required' }, { status: 400 });
    }

    // Action: Revoke all users who verified via this link
    if (action === 'revoke_users') {
      const revokedCount = await revokeUsersVerifiedViaLink(id);
      return NextResponse.json({
        success: true,
        message: `Successfully revoked community access for ${revokedCount} user(s).`,
        revokedCount,
      });
    }

    // Otherwise standard update
    if (updates.invite_url) {
      const parsed = parseAndValidateWhatsAppInvite(updates.invite_url);
      if (!parsed.isValid || !parsed.inviteCode) {
        return NextResponse.json({ error: parsed.error || 'Invalid WhatsApp URL' }, { status: 400 });
      }
      updates.invite_url = parsed.cleanUrl;
      updates.invite_code = parsed.inviteCode;
    }

    const updated = await updateCommunityVerificationLink(id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, link: updated });
  } catch (error: any) {
    console.error('Admin update link error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update link' }, { status: 500 });
  }
}

// DELETE /api/admin/links - Delete a verification link
export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Link ID query parameter is required' }, { status: 400 });
    }

    const success = await deleteCommunityVerificationLink(id);
    if (!success) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Link deleted successfully' });
  } catch (error: any) {
    console.error('Admin delete link error:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete link' }, { status: 500 });
  }
}
