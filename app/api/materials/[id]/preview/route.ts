import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterialById, recordMaterialOpen } from '@/lib/db';
import { supabase } from '@/lib/db/supabase';
import {
  extractDriveFileId,
  getDrivePreviewUrl,
  getDriveDownloadUrl,
  getDriveDirectDownloadUrl,
} from '@/lib/drive-service';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json({ error: 'Please log in to view materials' }, { status: 401 });
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

    // Record open event in user's history asynchronously (does NOT touch download_count)
    if (session.userId) {
      recordMaterialOpen(session.userId, material.id).catch((err) => {
        console.warn('Asynchronous open history recording notice:', err);
      });
    }

    const { searchParams } = new URL(req.url);
    const returnSignedUrl = searchParams.get('signed') === 'true';

    // Multi-file bundle handling (if material.file_url is a JSON array)
    let targetFileUrl = material.file_url;
    let targetTitle = material.title;
    let targetFileSize = material.file_size;

    if (material.file_url.startsWith('[')) {
      try {
        const fileList = JSON.parse(material.file_url);
        if (Array.isArray(fileList) && fileList.length > 0) {
          const fileIndex = parseInt(searchParams.get('fileIndex') || '0', 10);
          const chosen = fileList[fileIndex] || fileList[0];
          if (chosen && chosen.url) {
            targetFileUrl = chosen.url;
            if (chosen.title || chosen.name) targetTitle = `${material.title} - ${chosen.title || chosen.name}`;
            if (chosen.size) targetFileSize = chosen.size;
          }
        }
      } catch (e) {
        console.warn('Failed to parse multi-file JSON in preview route:', e);
      }
    }

    // 0. If stored in Google Drive
    const driveId = extractDriveFileId(targetFileUrl);
    if (driveId) {
      const drivePreviewUrl = getDrivePreviewUrl(driveId);
      if (returnSignedUrl) {
        return NextResponse.json({
          success: true,
          signedUrl: targetFileUrl,
          previewUrl: drivePreviewUrl,
          driveFileId: driveId,
          isGoogleDrive: true,
          material: {
            id: material.id,
            title: targetTitle,
            file_size: targetFileSize,
          },
        });
      }

      // If client requests direct binary stream for high-performance in-browser PDF.js canvas rendering
      const isStream = searchParams.get('stream') === 'true';
      if (isStream) {
        try {
          const directUrl = getDriveDirectDownloadUrl(driveId);
          let driveRes = await fetch(directUrl);
          if (!driveRes.ok || driveRes.headers.get('content-type')?.includes('text/html')) {
            driveRes = await fetch(getDriveDownloadUrl(driveId));
          }
          if (driveRes.ok) {
            const contentType = driveRes.headers.get('content-type') || '';
            // If Google returns confirm page for >25MB files, extract confirm token
            if (contentType.includes('text/html')) {
              const html = await driveRes.text();
              const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
              if (confirmMatch) {
                const confirmUrl = `https://drive.google.com/uc?export=download&id=${driveId}&confirm=${confirmMatch[1]}`;
                driveRes = await fetch(confirmUrl);
              }
            }
            if (driveRes.ok && !driveRes.headers.get('content-type')?.includes('text/html')) {
              const finalContentType = driveRes.headers.get('content-type') || 'application/pdf';
              const arrayBuffer = await driveRes.arrayBuffer();
              return new NextResponse(arrayBuffer, {
                status: 200,
                headers: {
                  'Content-Type': finalContentType.includes('pdf') ? 'application/pdf' : finalContentType,
                  'Content-Length': arrayBuffer.byteLength.toString(),
                  'Cache-Control': 'private, max-age=3600',
                },
              });
            }
          }
        } catch (streamErr) {
          console.warn('Google Drive direct stream notice:', streamErr);
        }
      }

      // Direct 307 temporary redirect to Google Drive native preview
      // Zero serverless function egress / Fast Origin transfer!
      return NextResponse.redirect(drivePreviewUrl, 307);
    }

    // 1. If stored in Supabase Storage
    if (targetFileUrl.includes('/study-materials/')) {
      const parts = targetFileUrl.split('/study-materials/');
      const storagePath = decodeURIComponent(parts[1]?.split('?')[0] || '');

      if (storagePath && supabase) {
        if (returnSignedUrl) {
          const { data: signedData, error: signError } = await supabase.storage
            .from('study-materials')
            .createSignedUrl(storagePath, 3600);

          if (!signError && signedData?.signedUrl) {
            return NextResponse.json({
              success: true,
              signedUrl: signedData.signedUrl,
              material: {
                id: material.id,
                title: targetTitle,
                file_size: targetFileSize,
              },
            });
          }
        }

        // Direct 307 Redirect to Supabase Storage CDN public URL
        // Supabase CDN handles all egress bytes directly. Zero Vercel Fast Origin cost!
        const { data: publicUrlData } = supabase.storage
          .from('study-materials')
          .getPublicUrl(storagePath);

        if (publicUrlData?.publicUrl) {
          return NextResponse.redirect(publicUrlData.publicUrl, 307);
        }
      }
    }

    // 2. Direct external URL redirect
    if (targetFileUrl.startsWith('http')) {
      if (returnSignedUrl) {
        return NextResponse.json({
          success: true,
          signedUrl: targetFileUrl,
          material: {
            id: material.id,
            title: targetTitle,
            file_size: targetFileSize,
          },
        });
      }

      // 307 Redirect directly to origin URL — zero byte transfer through Vercel Functions
      return NextResponse.redirect(targetFileUrl, 307);
    }

    return NextResponse.json({ error: 'Document file could not be retrieved' }, { status: 404 });
  } catch (error: any) {
    console.error('Preview stream error:', error);
    return NextResponse.json({ error: error.message || 'Failed to stream document' }, { status: 500 });
  }
}
