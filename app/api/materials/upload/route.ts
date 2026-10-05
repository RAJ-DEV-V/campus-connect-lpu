import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { createMaterial, getMaterials, deleteMaterial } from '@/lib/db';
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
        delete_same_name = false,
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

      const cleanSubjectCode = String(subject_code).toUpperCase().trim();

      // OPTION: DELETE FILES WITH THE SAME NAME WHEN UPLOADED
      let deletedSameNameCount = 0;
      if (delete_same_name === true || delete_same_name === 'true') {
        try {
          const targetTitleLower = String(title).trim().toLowerCase();
          const targetFileLower = file_name ? String(file_name).trim().toLowerCase() : '';

          const { materials: existingList } = await getMaterials({
            year: parsedYear,
            subject_code: cleanSubjectCode,
          });

          for (const ext of existingList) {
            const extTitle = ext.title.trim().toLowerCase();
            const extFile = ext.file_name ? ext.file_name.trim().toLowerCase() : '';

            // Match if titles match, or file names match, or title matches file name
            const isSame =
              extTitle === targetTitleLower ||
              (targetFileLower && extFile === targetFileLower) ||
              (targetFileLower && extTitle === targetFileLower) ||
              (extFile && extFile === targetTitleLower);

            if (isSame) {
              await deleteMaterial(ext.id);
              deletedSameNameCount++;
            }
          }
        } catch (delErr) {
          console.warn('Could not auto-delete existing same-name materials:', delErr);
        }
      }

      const newMaterial = await createMaterial({
        title,
        description,
        subject,
        subject_code: cleanSubjectCode,
        year: parsedYear,
        material_type: material_type as any,
        file_url,
        file_size: file_size || 'Unknown Size',
      });

      return NextResponse.json({
        success: true,
        message:
          deletedSameNameCount > 0
            ? `Study material registered successfully. Replaced & deleted ${deletedSameNameCount} existing file(s) with the same name.`
            : 'Study material registered successfully with Google Drive storage',
        deletedSameNameCount,
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

    const deleteSameName =
      formData.get('delete_same_name') === 'true' ||
      formData.get('delete_same_name') === '1' ||
      formData.get('delete_same_name') === 'on';

    let deletedSameNameCount = 0;
    if (deleteSameName) {
      try {
        const cleanSubj = subjectCode.toUpperCase().trim();
        const targetTitleLower = title.trim().toLowerCase();
        const targetFileLower = fileName ? fileName.trim().toLowerCase() : '';

        const { materials: existingList } = await getMaterials({
          year,
          subject_code: cleanSubj,
        });

        for (const ext of existingList) {
          const extTitle = ext.title.trim().toLowerCase();
          const extFile = ext.file_name ? ext.file_name.trim().toLowerCase() : '';

          const isSame =
            extTitle === targetTitleLower ||
            (targetFileLower && extFile === targetFileLower) ||
            (targetFileLower && extTitle === targetFileLower) ||
            (extFile && extFile === targetTitleLower);

          if (isSame) {
            await deleteMaterial(ext.id);
            deletedSameNameCount++;
          }
        }
      } catch (delErr) {
        console.warn('Could not auto-delete existing same-name materials:', delErr);
      }
    }

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
      message:
        deletedSameNameCount > 0
          ? `Study material uploaded successfully. Replaced & deleted ${deletedSameNameCount} existing file(s) with the same name.`
          : 'Study material uploaded successfully',
      deletedSameNameCount,
      material: newMaterial,
    });
  } catch (error: any) {
    console.error('Upload material error:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload material' }, { status: 500 });
  }
}
