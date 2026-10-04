import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth';
import { getMaterialById } from '@/lib/db';
import { supabase } from '@/lib/db/supabase';

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

    const { searchParams } = new URL(req.url);
    const returnSignedUrl = searchParams.get('signed') === 'true';

    // 0. If stored in Google Drive
    const extractDriveId = (url: string): string | null => {
      if (!url) return null;
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) return idMatch[1];
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch) return fileMatch[1];
      const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (dMatch) return dMatch[1];
      return null;
    };

    const driveId = extractDriveId(material.file_url);
    if (driveId) {
      const drivePreviewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
      if (returnSignedUrl) {
        return NextResponse.json({
          success: true,
          signedUrl: material.file_url,
          previewUrl: drivePreviewUrl,
          driveFileId: driveId,
          isGoogleDrive: true,
          material: {
            id: material.id,
            title: material.title,
            file_size: material.file_size,
          },
        });
      }

      // Attempt to stream file directly from Google Drive for native PDF.js rendering
      try {
        const driveDownloadUrls = [
          `https://drive.google.com/uc?export=download&id=${driveId}`,
          `https://drive.usercontent.google.com/download?id=${driveId}&export=download`,
        ];

        for (const dlUrl of driveDownloadUrls) {
          const driveRes = await fetch(dlUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            },
          });

          if (driveRes.ok) {
            const contentType = driveRes.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
              const arrayBuffer = await driveRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              let mimeType = 'application/pdf';
              if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
                mimeType = 'application/pdf';
              } else if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
                mimeType = 'image/jpeg';
              } else if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
                mimeType = 'image/png';
              }

              return new NextResponse(buffer, {
                status: 200,
                headers: {
                  'Content-Type': mimeType,
                  'Content-Disposition': 'inline',
                  'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                  'Access-Control-Allow-Origin': '*',
                  'X-Content-Type-Options': 'nosniff',
                },
              });
            }
          }
        }
      } catch (err) {
        console.warn('Direct stream from Drive failed, falling back to redirect:', err);
      }

      // Redirect direct browser requests to Google Drive native preview
      return NextResponse.redirect(drivePreviewUrl, 307);
    }

    // 1. If stored in Supabase Storage
    if (material.file_url.includes('/study-materials/')) {
      const parts = material.file_url.split('/study-materials/');
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
                title: material.title,
                file_size: material.file_size,
              },
            });
          }
        }

        // Direct binary stream with CORS & Content-Type
        const { data: blob, error } = await supabase.storage
          .from('study-materials')
          .download(storagePath);

        // Determine Content-Type dynamically from magic numbers or extension
        const getContentType = (buf: Buffer, pathOrUrl: string): string => {
          if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
            return 'application/pdf';
          }
          if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
            return 'image/jpeg';
          }
          if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
            return 'image/png';
          }
          if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) {
            return 'image/webp';
          }
          const lower = pathOrUrl.toLowerCase();
          if (lower.endsWith('.png')) return 'image/png';
          if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
          if (lower.endsWith('.webp')) return 'image/webp';
          if (lower.endsWith('.svg')) return 'image/svg+xml';
          return 'application/pdf';
        };

        if (!error && blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const mimeType = getContentType(buffer, storagePath);

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': mimeType,
              'Content-Disposition': 'inline',
              'Cache-Control': 'private, no-cache, no-store, must-revalidate',
              'Access-Control-Allow-Origin': '*',
              'X-Content-Type-Options': 'nosniff',
            },
          });
        }
      }
    }

    // 2. Fallback to direct fetch
    if (material.file_url.startsWith('http')) {
      if (returnSignedUrl) {
        return NextResponse.json({
          success: true,
          signedUrl: material.file_url,
          material: {
            id: material.id,
            title: material.title,
            file_size: material.file_size,
          },
        });
      }

      const response = await fetch(material.file_url);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const lowerUrl = material.file_url.toLowerCase();
        let mimeType = 'application/pdf';
        if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
          mimeType = 'application/pdf';
        } else if (lowerUrl.endsWith('.png') || (buffer[0] === 0x89 && buffer[1] === 0x50)) {
          mimeType = 'image/png';
        } else if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg') || (buffer[0] === 0xff && buffer[1] === 0xd8)) {
          mimeType = 'image/jpeg';
        }

        return new NextResponse(buffer, {
          status: 200,
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': 'inline',
            'Cache-Control': 'private, no-cache, no-store, must-revalidate',
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }

    return NextResponse.json({ error: 'Document file could not be retrieved' }, { status: 404 });
  } catch (error: any) {
    console.error('Preview stream error:', error);
    return NextResponse.json({ error: error.message || 'Failed to stream document' }, { status: 500 });
  }
}
