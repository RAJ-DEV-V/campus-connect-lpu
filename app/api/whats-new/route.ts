import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { 
  getWhatsNew, 
  createWhatsNew, 
  toggleWhatsNewActive, 
  deleteWhatsNew 
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get('all') !== 'true';

    const items = await getWhatsNew(activeOnly);
    return NextResponse.json(
      { success: true, items },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Fetch whats_new error:', error);
    return NextResponse.json({ error: 'Failed to fetch announcements' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin && !session.isOwner) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { title, description, type, link_type, link_target, link, is_active } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Title, description, and valid announcement type are required' },
        { status: 400 }
      );
    }

    const finalLink = link || link_target || null;
    const created = await createWhatsNew({
      title,
      description,
      type,
      link_type: link_type || (finalLink ? 'page' : null),
      link_target: finalLink,
      link: finalLink,
      is_active: is_active ?? true,
      created_by: session.email || session.userId,
    });

    return NextResponse.json({ success: true, item: created });
  } catch (error: any) {
    console.error('Create whats_new error:', error);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
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
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    const updated = await toggleWhatsNewActive(id);
    if (!updated) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error: any) {
    console.error('Toggle whats_new error:', error);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
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
      return NextResponse.json({ error: 'Announcement ID is required' }, { status: 400 });
    }

    const deleted = await deleteWhatsNew(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Announcement deleted' });
  } catch (error: any) {
    console.error('Delete whats_new error:', error);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}

