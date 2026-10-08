import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import {
  getAppSettings,
  getWhatsNew,
  getUserMaterialOpenHistory,
  getUserSavedMaterials,
  getUserSavedMaterialIds,
  getMaterials,
  getFeedbackRequests,
} from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const settings = await getAppSettings().catch(() => ({ allow_user_downloads: true, require_community_verification: true }));
    const requireCommunity = settings.require_community_verification !== false;

    if (requireCommunity && !session.community_joined && !session.isAdmin) {
      return NextResponse.json(
        { authenticated: true, user: session, community_required: true },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const activeYear = searchParams.get('year')
      ? parseInt(searchParams.get('year')!, 10)
      : (session.year || 1);

    // Parallel server-side execution across in-memory cache and DB
    const [
      whatsNew,
      history,
      saved,
      savedIds,
      recMaterials,
      recentMaterials,
      requests
    ] = await Promise.all([
      getWhatsNew(true).catch(() => []),
      getUserMaterialOpenHistory(session.userId, 8).catch(() => []),
      getUserSavedMaterials(session.userId, 12).catch(() => []),
      getUserSavedMaterialIds(session.userId).catch(() => []),
      getMaterials({ year: activeYear, sortBy: 'downloads', limit: 6 }).catch(() => ({ materials: [] })),
      getMaterials({ year: activeYear, sortBy: 'newest', limit: 6 }).catch(() => ({ materials: [] })),
      getFeedbackRequests(undefined, session.userId).catch(() => []),
    ]);

    return NextResponse.json(
      {
        success: true,
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
        settings: {
          allow_user_downloads: settings.allow_user_downloads,
          require_community_verification: settings.require_community_verification ?? true,
        },
        whatsNew: Array.isArray(whatsNew) ? whatsNew : [],
        history: Array.isArray(history) ? history : [],
        saved: Array.isArray(saved) ? saved : [],
        savedIds: Array.isArray(savedIds) ? savedIds : [],
        recommended: recMaterials.materials || [],
        recent: recentMaterials.materials || [],
        requests: Array.isArray(requests) ? requests : [],
      },
      {
        headers: {
          'Cache-Control': 'private, no-cache, no-store',
        },
      }
    );
  } catch (error: any) {
    console.error('Dashboard bootstrap error:', error);
    return NextResponse.json({ error: error.message || 'Failed to load dashboard data' }, { status: 500 });
  }
}
