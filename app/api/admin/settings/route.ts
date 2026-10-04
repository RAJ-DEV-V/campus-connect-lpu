import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAppSettings, updateAppSettings } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const settings = await getAppSettings();
    return NextResponse.json(
      {
        success: true,
        settings,
        isAdmin: Boolean(session.isAdmin || session.isOwner),
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: any) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || (!session.isAdmin && !session.isOwner)) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { allow_user_downloads } = body;

    if (typeof allow_user_downloads !== 'boolean') {
      return NextResponse.json({ error: 'allow_user_downloads must be a boolean' }, { status: 400 });
    }

    const updated = await updateAppSettings({
      allow_user_downloads,
      updated_by: session.email || session.userId,
    });

    return NextResponse.json({
      success: true,
      message: allow_user_downloads 
        ? 'Global setting updated: Users can preview and download study materials.'
        : 'Global setting updated: Users can preview study materials but cannot download them.',
      settings: updated,
    });
  } catch (error: any) {
    console.error('Settings PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Failed to update settings' }, { status: 500 });
  }
}
