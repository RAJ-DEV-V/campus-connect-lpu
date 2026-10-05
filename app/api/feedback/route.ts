import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createFeedbackRequest } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { 
      type, 
      title, 
      description, 
      subject_code, 
      subject_name, 
      material_type 
    } = body;

    if (!type || !title || !description) {
      return NextResponse.json(
        { error: 'Type, title, and description are required' },
        { status: 400 }
      );
    }

    const created = await createFeedbackRequest({
      user_id: session.userId,
      user_name: session.name || 'Anonymous Student',
      user_email: session.email,
      user_year: session.year || undefined,
      type,
      title: title.trim(),
      description: description.trim(),
      subject_code: subject_code ? subject_code.trim().toUpperCase() : undefined,
      subject_name: subject_name ? subject_name.trim() : undefined,
      material_type: material_type ? material_type.trim() : undefined,
    });

    return NextResponse.json({ success: true, request: created });
  } catch (error: any) {
    console.error('Submit feedback request error:', error);
    return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { getFeedbackRequests } = await import('@/lib/db');
    const requests = await getFeedbackRequests(undefined, session.userId);

    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    console.error('Fetch student requests error:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}
