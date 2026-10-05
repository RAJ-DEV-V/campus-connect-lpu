import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getUserMaterialOpenHistory, recordMaterialOpen } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '8', 10);

    const history = await getUserMaterialOpenHistory(session.userId, limit);
    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error('Fetch material open history error:', error);
    return NextResponse.json({ error: 'Failed to fetch open history' }, { status: 500 });
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

    const recorded = await recordMaterialOpen(session.userId, materialId);
    return NextResponse.json({ success: true, history: recorded });
  } catch (error: any) {
    console.error('Record material open error:', error);
    return NextResponse.json({ error: 'Failed to record open event' }, { status: 500 });
  }
}
