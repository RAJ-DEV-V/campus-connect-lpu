import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getAdmins, addAdmin, removeAdmin } from '@/lib/db';

export async function GET() {
  try {
    const session = await getCurrentSession();
    // Only owner can view or manage admin roster
    if (!session || !session.isOwner) {
      return NextResponse.json({ error: 'Forbidden: Owner privileges required.' }, { status: 403 });
    }

    const admins = await getAdmins();
    return NextResponse.json({ success: true, admins });
  } catch (error: any) {
    console.error('Admin management GET error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch admins' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isOwner) {
      return NextResponse.json({ error: 'Forbidden: Owner privileges required.' }, { status: 403 });
    }

    const body = await req.json();
    const { email, role = 'admin' } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const newAdmin = await addAdmin(email, role);
    return NextResponse.json({ success: true, admin: newAdmin }, { status: 201 });
  } catch (error: any) {
    console.error('Admin management POST error:', error);
    return NextResponse.json({ error: error.message || 'Failed to add admin' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isOwner) {
      return NextResponse.json({ error: 'Forbidden: Owner privileges required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Admin ID query parameter is required' }, { status: 400 });
    }

    await removeAdmin(id);
    return NextResponse.json({ success: true, message: 'Admin privileges revoked successfully.' });
  } catch (error: any) {
    console.error('Admin management DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove admin' }, { status: 400 });
  }
}
