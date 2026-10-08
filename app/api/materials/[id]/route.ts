import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterialById, updateMaterial, deleteMaterial, getAppSettings } from '@/lib/db';
import { uploadStudyMaterialFile } from '@/lib/storage';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const settings = await getAppSettings().catch(() => ({ require_community_verification: true } as any));
    const requireCommunity = settings.require_community_verification !== false;

    if (requireCommunity && !session.community_joined && !session.isAdmin) {
      return NextResponse.json({ error: 'Community membership required' }, { status: 403 });
    }

    const material = await getMaterialById(params.id);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, material });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching material' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const existing = await getMaterialById(params.id);
    if (!existing) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    const contentType = req.headers.get('content-type') || '';
    let updates: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const subject = formData.get('subject') as string;
      const subjectCode = formData.get('subject_code') as string;
      const yearStr = formData.get('year') as string;
      const materialType = formData.get('material_type') as string;
      const file = formData.get('file') as File | null;

      if (title) updates.title = title;
      if (description !== null && description !== undefined) updates.description = description;
      if (subject) updates.subject = subject;
      if (subjectCode) updates.subject_code = subjectCode.toUpperCase();
      if (yearStr) {
        const parsedYear = parseInt(yearStr, 10);
        if (!isNaN(parsedYear) && parsedYear >= 1 && parsedYear <= 4) {
          updates.year = parsedYear;
        }
      }
      if (materialType) updates.material_type = materialType;

      // Handle file replacement if a file was provided
      if (file && file.size > 0) {
        const arrayBuffer = await file.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuffer);
        const uploadRes = await uploadStudyMaterialFile({
          fileBuffer,
          fileName: file.name,
          year: updates.year || existing.year,
          subjectCode: updates.subject_code || existing.subject_code,
          materialType: updates.material_type || existing.material_type,
          contentType: file.type || 'application/pdf',
        });
        updates.file_url = uploadRes.fileUrl;
        updates.file_size = uploadRes.fileSizeFormatted;
      }
    } else {
      updates = await req.json();
    }

    const updated = await updateMaterial(params.id, updates);
    if (!updated) {
      return NextResponse.json({ error: 'Material not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, material: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating material' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const success = await deleteMaterial(params.id);
    if (!success) {
      return NextResponse.json({ error: 'Material not found or deletion failed' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Material deleted successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting material' }, { status: 500 });
  }
}
