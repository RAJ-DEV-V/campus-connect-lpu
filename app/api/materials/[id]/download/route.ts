import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterialById, recordDownload, getAppSettings } from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Please log in to access materials' }, { status: 401 });
    }

    const isAdminOrOwner = Boolean(session.isAdmin || session.isOwner);

    if (!session.community_joined && !isAdminOrOwner) {
      return NextResponse.json(
        { error: 'Community confirmation required to access study materials' },
        { status: 403 }
      );
    }

    // SERVER-SIDE GLOBAL ACCESS CONTROL ENFORCEMENT
    // When allow_user_downloads = false, direct file downloads are disabled globally for normal students.
    // Admin and Owner retain administrative download access for verification and maintenance.
    const settings = await getAppSettings();
    if (!settings.allow_user_downloads && !isAdminOrOwner) {
      return NextResponse.json(
        {
          error: 'Document downloads are currently disabled by administration. You can view this document in Preview mode.',
          code: 'DOWNLOADS_DISABLED_PREVIEW_ONLY',
        },
        { status: 403 }
      );
    }

    const material = await getMaterialById(params.id);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // 1. Record the download in database & increment download count
    await recordDownload(session.userId, material.id);

    // 2. Check if client wants JSON response or direct file stream
    const { searchParams } = new URL(req.url);
    const returnJson = searchParams.get('json') === 'true';

    if (returnJson) {
      return NextResponse.json({
        success: true,
        downloadUrl: material.file_url,
        material: {
          id: material.id,
          title: material.title,
          download_count: material.download_count + 1,
        },
      });
    }

    // 3. Serve direct download with attachment header
    const cleanFilename = `${material.subject_code}_${material.material_type}_${material.title.slice(0, 30)}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // If local file path
    if (material.file_url.startsWith('/uploads/')) {
      const diskPath = path.join(process.cwd(), 'public', material.file_url.replace('/uploads/', 'uploads/'));
      if (fs.existsSync(diskPath)) {
        const fileBuffer = fs.readFileSync(diskPath);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${cleanFilename}"`,
            'Content-Length': fileBuffer.length.toString(),
            'Cache-Control': 'no-cache',
          },
        });
      }
    }

    // If external or Supabase URL, redirect to it
    return NextResponse.redirect(new URL(material.file_url, req.url));
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
