import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserSavedMaterials, getUserSavedMaterialIds, toggleSaveMaterial } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const idsOnly = searchParams.get('idsOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '12', 10);

    if (idsOnly) {
      const ids = await getUserSavedMaterialIds(session.userId);
      return NextResponse.json({ success: true, savedIds: ids });
    }

    const saved = await getUserSavedMaterials(session.userId, limit);
    return NextResponse.json({ success: true, saved });
  } catch (error: any) {
    console.error('Fetch saved materials error:', error);
    return NextResponse.json({ error: 'Failed to fetch saved materials' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { materialId } = body;

    if (!materialId) {
      return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
    }

    const result = await toggleSaveMaterial(session.userId, materialId);
    return NextResponse.json({ success: true, saved: result.saved, materialId });
  } catch (error: any) {
    console.error('Toggle save material error:', error);
    return NextResponse.json({ error: 'Failed to update saved material' }, { status: 500 });
  }
}
