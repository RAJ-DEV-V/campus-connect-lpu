import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createMaterial } from '@/lib/db';
import { uploadStudyMaterialFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized: Admin privileges required.' }, { status: 403 });
    }

    const contentTypeHeader = req.headers.get('content-type') || '';

    // A. DIRECT GOOGLE DRIVE METADATA PAYLOAD (JSON)
    if (contentTypeHeader.includes('application/json')) {
      const body = await req.json();
      const {
        title,
        description = '',
        subject,
        subject_code,
        year,
        material_type,
        file_url,
        file_size,
        drive_file_id,
        file_name,
        mime_type,
      } = body;

      if (!title || !subject || !subject_code || !material_type || !file_url) {
        return NextResponse.json(
          { error: 'Missing required fields: title, subject, subject_code, material_type, and file_url are required.' },
          { status: 400 }
        );
      }

      let parsedYear = parseInt(year, 10);
      if (!parsedYear || isNaN(parsedYear) || parsedYear < 1 || parsedYear > 4) {
        parsedYear = 1;
      }

      const newMaterial = await createMaterial({
        title,
        description,
        subject,
        subject_code: String(subject_code).toUpperCase().trim(),
        year: parsedYear,
        material_type: material_type as any,
        file_url,
        file_size: file_size || 'Unknown Size',
      });

      return NextResponse.json({
        success: true,
        message: 'Study material registered successfully with Google Drive storage',
        material: newMaterial,
      });
    }

    // B. LEGACY / FALLBACK MULTIPART FORM-DATA UPLOAD
    const formData = await req.formData();
    const title = formData.get('title') as string;
    const description = (formData.get('description') as string) || '';
    const subject = formData.get('subject') as string;
    const subjectCode = formData.get('subject_code') as string;

    let year = parseInt((formData.get('year') || formData.get('semester')) as string, 10);
    if (!year || isNaN(year) || year < 1 || year > 4) {
      year = 1;
    }

    const materialType = formData.get('material_type') as string;
    const file = formData.get('file') as File | null;

    if (!title || !subject || !subjectCode || !materialType) {
      return NextResponse.json(
        { error: 'Missing required fields: title, subject, subject_code, and material_type are required.' },
        { status: 400 }
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: 'File is required. Please select a valid document or PDF to upload.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    const fileName = file.name;
    const contentType = file.type || 'application/pdf';

    const uploadResult = await uploadStudyMaterialFile({
      fileBuffer,
      fileName,
      year,
      subjectCode: subjectCode.toUpperCase(),
      materialType,
      contentType,
    });

    const newMaterial = await createMaterial({
      title,
      description,
      subject,
      subject_code: subjectCode.toUpperCase(),
      year,
      material_type: materialType as any,
      file_url: uploadResult.fileUrl,
      file_size: uploadResult.fileSizeFormatted,
    });

    return NextResponse.json({
      success: true,
      message: 'Study material uploaded successfully',
      material: newMaterial,
    });
  } catch (error: any) {
    console.error('Upload material error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload material' }, { status: 500 });
  }
}
