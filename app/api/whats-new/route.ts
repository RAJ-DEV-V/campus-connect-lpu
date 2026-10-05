import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getWhatsNew, createWhatsNew } from '@/lib/db';

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
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=180',
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
    const { title, description, type, link_type, link_target, is_active } = body;

    if (!title || !description || !type) {
      return NextResponse.json(
        { error: 'Title, description, and valid announcement type are required' },
        { status: 400 }
      );
    }

    const created = await createWhatsNew({
      title,
      description,
      type,
      link_type: link_type || null,
      link_target: link_target || null,
      is_active: is_active ?? true,
      created_by: session.email || session.userId,
    });

    return NextResponse.json({ success: true, item: created });
  } catch (error: any) {
    console.error('Create whats_new error:', error);
    return NextResponse.json({ error: 'Failed to create announcement' }, { status: 500 });
  }
}
