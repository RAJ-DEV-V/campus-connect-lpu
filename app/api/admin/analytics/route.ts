import { NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getDownloadAnalytics } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const analytics = await getDownloadAnalytics();
    return NextResponse.json({ success: true, analytics });
  } catch (error: any) {
    console.error('Download analytics API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch analytics' }, { status: 500 });
  }
}
