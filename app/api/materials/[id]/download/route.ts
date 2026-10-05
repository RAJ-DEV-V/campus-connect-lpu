import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterialById, recordDownload, getAppSettings } from '@/lib/db';
import { extractDriveFileId, getDriveDownloadUrl, isMaterialPreviewable } from '@/lib/drive-service';
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

    const material = await getMaterialById(params.id);
    if (!material) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // SERVER-SIDE ACCESS CONTROL:
    // When allow_user_downloads = false, PDF/previewable documents cannot be downloaded by normal students.
    // HOWEVER: Files that cannot be previewed in the document viewer (e.g. .zip, .rar, .7z, archives)
    // are EXEMPT and permitted for normal students to download so they can access the material.
    const settings = await getAppSettings();
    const canBePreviewed = isMaterialPreviewable(material);

    if (!settings.allow_user_downloads && !isAdminOrOwner && canBePreviewed) {
      return NextResponse.json(
        {
          error: 'Document downloads are currently disabled by administration for previewable files. You can view this document in Preview mode.',
          code: 'DOWNLOADS_DISABLED_PREVIEW_ONLY',
        },
        { status: 403 }
      );
    }

    // 1. Record the download in database & increment download count
    await recordDownload(session.userId, material.id);

    // 2. Check if client wants JSON response or direct file stream
    const { searchParams } = new URL(req.url);
    const returnJson = searchParams.get('json') === 'true';

    let targetFileUrl = material.file_url;
    let targetTitle = material.title;

    if (material.file_url.startsWith('[')) {
      try {
        const fileList = JSON.parse(material.file_url);
        if (Array.isArray(fileList) && fileList.length > 0) {
          const fileIndex = parseInt(searchParams.get('fileIndex') || '0', 10);
          const chosen = fileList[fileIndex] || fileList[0];
          if (chosen && chosen.url) {
            targetFileUrl = chosen.url;
            if (chosen.title || chosen.name) targetTitle = `${material.title}_${chosen.title || chosen.name}`;
          }
        }
      } catch (e) {
        console.warn('Failed to parse multi-file JSON in download route:', e);
      }
    }

    if (returnJson) {
      return NextResponse.json({
        success: true,
        downloadUrl: targetFileUrl,
        material: {
          id: material.id,
          title: targetTitle,
          download_count: material.download_count + 1,
        },
      });
    }

    // 3. Serve direct download with attachment header
    const cleanFilename = `${material.subject_code}_${material.material_type}_${targetTitle.slice(0, 30)}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // If local file path (development only)
    if (targetFileUrl.startsWith('/uploads/')) {
      const diskPath = path.join(process.cwd(), 'public', targetFileUrl.replace('/uploads/', 'uploads/'));
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

    // Google Drive direct download bypass (Google CDN handles all bandwidth at 0 Vercel Fast Origin cost)
    const driveId = extractDriveFileId(targetFileUrl);
    if (driveId) {
      return NextResponse.redirect(getDriveDownloadUrl(driveId), 307);
    }

    // If external or Supabase Storage CDN URL, redirect directly to Supabase CDN at 0 Vercel Fast Origin cost
    return NextResponse.redirect(new URL(targetFileUrl, req.url), 307);
  } catch (error: any) {
    console.error('Download error:', error);
    return NextResponse.json({ error: error.message || 'Download failed' }, { status: 500 });
  }
}
