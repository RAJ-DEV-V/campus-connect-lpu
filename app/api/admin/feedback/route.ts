import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { 
  getFeedbackRequests, 
  updateFeedbackRequestStatus, 
  deleteFeedbackRequest 
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin && !session.isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const requests = await getFeedbackRequests(status);
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('Fetch feedback requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin && !session.isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { id, status, admin_note, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    if (action === 'approve_verification') {
      const { getFeedbackRequests, updateCommunityJoined, getCommunityVerificationLinks, deleteFeedbackRequest } = await import('@/lib/db');
      const allRequests = await getFeedbackRequests();
      const targetReq = allRequests.find((r) => r.id === id);
      if (!targetReq) {
        return NextResponse.json({ error: 'Feedback request not found' }, { status: 404 });
      }

      const links = await getCommunityVerificationLinks();
      const primaryLink = links.find((l) => l.is_active) || links[0];
      await updateCommunityJoined(targetReq.user_id, true, primaryLink?.id);

      // Automatically delete record from database once approved
      await deleteFeedbackRequest(id);

      return NextResponse.json({
        success: true,
        deleted: true,
        message: 'Student verified and library unlocked successfully. Record removed.',
      });
    }

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    if (status === 'resolved') {
      // Automatically delete record from database once marked resolved
      await deleteFeedbackRequest(id);
      return NextResponse.json({
        success: true,
        deleted: true,
        message: 'Request resolved and automatically removed from records.',
      });
    }

    const updated = await updateFeedbackRequestStatus(id, status, admin_note);
    if (!updated) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) {
    console.error('Update feedback request error:', error);
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin && !session.isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    const deleted = await deleteFeedbackRequest(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Request deleted' });
  } catch (error: any) {
    console.error('Delete feedback request error:', error);
    return NextResponse.json({ error: 'Failed to delete request' }, { status: 500 });
  }
}
