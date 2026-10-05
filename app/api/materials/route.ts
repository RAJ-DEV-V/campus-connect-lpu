import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterials, MaterialFilters, touchUserActivity } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (!session.community_joined && !session.isAdmin) {
      return NextResponse.json(
        { error: 'Community membership required to access study materials' },
        { status: 403 }
      );
    }

    // Touch user activity
    await touchUserActivity(session.userId);

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') 
      ? parseInt(searchParams.get('year')!, 10) 
      : searchParams.get('sem') 
        ? Math.ceil(parseInt(searchParams.get('sem')!, 10) / 2) // fallback compatibility
        : undefined;

    const material_type = (searchParams.get('material_type') as any) || undefined;
    const subject = searchParams.get('subject') || undefined;
    const subject_code = searchParams.get('subject_code') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'newest';
    const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50;

    const filters: MaterialFilters = {
      year,
      material_type,
      subject,
      subject_code,
      search,
      sortBy,
      page,
      limit,
    };

    const result = await getMaterials(filters);

    return NextResponse.json(
      {
        success: true,
        materials: result.materials,
        total: result.total,
        page,
        limit,
      },
      {
        headers: {
          'Cache-Control': 'private, s-maxage=60, stale-while-revalidate=120',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch materials' }, { status: 500 });
  }
}
