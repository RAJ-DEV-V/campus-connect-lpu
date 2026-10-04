import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAdminStats } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const stats = await getAdminStats();
    return NextResponse.json({ success: true, stats });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch admin stats' }, { status: 500 });
  }
}
