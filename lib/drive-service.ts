/**
 * CampusConnect LPU - Centralized Google Drive File Service
 * 
 * Provides unified, decoupled helpers for:
 * - Parsing & extracting Google Drive File IDs (single files, bundles, external links)
 * - Generating standardized preview, download, and embed URLs
 * - Normalizing metadata for database storage and future drive migration
 */

export interface DriveFileMetadata {
  fileId: string | null;
  fileName: string;
  fileSizeFormatted: string;
  mimeType: string;
  isGoogleDrive: boolean;
  isBundle: boolean;
  isExternalLink: boolean;
  previewUrl: string | null;
  downloadUrl: string | null;
  bundleItems?: Array<{
    title: string;
    name: string;
    url: string;
    drive_file_id?: string;
    size?: string;
  }>;
}

/**
 * Extracts a Google Drive File ID from various URL patterns
 */
export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;
  const clean = url.trim();

  // Pattern 1: uc?export=download&id=...
  const idParamMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (idParamMatch) return idParamMatch[1];

  // Pattern 2: /file/d/...
  const fileDMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]{25,})/);
  if (fileDMatch) return fileDMatch[1];

  // Pattern 3: /d/...
  const dMatch = clean.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (dMatch) return dMatch[1];

  // Pattern 4: Raw file ID directly (typically 28-44 chars alphanumeric with _ -)
  if (/^[a-zA-Z0-9_-]{28,45}$/.test(clean)) {
    return clean;
  }

  return null;
}

/**
 * Generates a clean Google Drive preview URL (for embed or browser view)
 */
export function getDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

/**
 * Generates a Google Drive download stream URL
 */
export function getDriveDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Generates Google Drive alternative direct stream download URL
 */
export function getDriveDirectDownloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
}

/**
 * Parses any material's `file_url` into standardized DriveFileMetadata
 */
export function parseMaterialFileMetadata(
  fileUrl: string | null | undefined,
  fallbackTitle: string = 'Document',
  fallbackSize: string = 'Unknown'
): DriveFileMetadata {
  if (!fileUrl) {
    return {
      fileId: null,
      fileName: fallbackTitle,
      fileSizeFormatted: fallbackSize,
      mimeType: 'application/octet-stream',
      isGoogleDrive: false,
      isBundle: false,
      isExternalLink: false,
      previewUrl: null,
      downloadUrl: null,
    };
  }

  const trimmed = fileUrl.trim();

  // 1. Multi-file bundle check (JSON array)
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const primary = parsed[0];
        const primaryDriveId = primary?.drive_file_id || extractDriveFileId(primary?.url);

        return {
          fileId: primaryDriveId,
          fileName: primary?.name || `${fallbackTitle} Bundle`,
          fileSizeFormatted: fallbackSize,
          mimeType: 'application/json',
          isGoogleDrive: Boolean(primaryDriveId),
          isBundle: true,
          isExternalLink: false,
          previewUrl: primaryDriveId ? getDrivePreviewUrl(primaryDriveId) : primary?.url || null,
          downloadUrl: primaryDriveId ? getDriveDownloadUrl(primaryDriveId) : primary?.url || null,
          bundleItems: parsed,
        };
      }
    } catch {
      // Fallback to plain URL handling if JSON parse fails
    }
  }

  // 2. Single Google Drive file check
  const driveId = extractDriveFileId(trimmed);
  if (driveId) {
    return {
      fileId: driveId,
      fileName: fallbackTitle.endsWith('.pdf') ? fallbackTitle : `${fallbackTitle}.pdf`,
      fileSizeFormatted: fallbackSize,
      mimeType: 'application/pdf',
      isGoogleDrive: true,
      isBundle: false,
      isExternalLink: false,
      previewUrl: getDrivePreviewUrl(driveId),
      downloadUrl: getDriveDownloadUrl(driveId),
    };
  }

  // 3. Supabase storage file check
  if (trimmed.includes('supabase.co/storage/v1/object/public/')) {
    return {
      fileId: null,
      fileName: fallbackTitle,
      fileSizeFormatted: fallbackSize,
      mimeType: 'application/pdf',
      isGoogleDrive: false,
      isBundle: false,
      isExternalLink: false,
      previewUrl: trimmed,
      downloadUrl: trimmed,
    };
  }

  // 4. External study resource link
  return {
    fileId: null,
    fileName: fallbackTitle,
    fileSizeFormatted: fallbackSize,
    mimeType: 'text/html',
    isGoogleDrive: false,
    isBundle: false,
    isExternalLink: true,
    previewUrl: trimmed,
    downloadUrl: trimmed,
  };
}

/**
 * Checks whether a material can be opened in the in-browser DocumentViewer (PDFs, Images, Docs).
 * Files such as .zip, .rar, .7z, .tar, .gz, executable binaries, or un-previewable archive formats
 * return FALSE, which permits normal students to download them even when general PDF download is disabled.
 */
export function isMaterialPreviewable(material: {
  file_url?: string;
  file_name?: string | null;
  title?: string;
  mime_type?: string | null;
  material_type?: string;
}): boolean {
  if (!material) return false;

  const url = (material.file_url || '').toLowerCase().trim();
  const name = (material.file_name || material.title || '').toLowerCase().trim();
  const mime = (material.mime_type || '').toLowerCase().trim();

  // Explicit non-previewable archive, presentation, and document extensions
  const nonPreviewableExtensions = [
    '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.tgz',
    '.ppt', '.pptx', '.doc', '.docx', '.xls', '.xlsx',
    '.iso', '.dmg', '.pkg', '.apk', '.exe', '.msi', '.bin',
    '.csv', '.sqlite', '.db'
  ];

  for (const ext of nonPreviewableExtensions) {
    if (name.endsWith(ext) || url.includes(ext)) {
      return false;
    }
  }

  // Non-previewable MIME types
  if (
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('archive') ||
    mime.includes('powerpoint') ||
    mime.includes('presentation') ||
    mime.includes('msword') ||
    mime.includes('wordprocessingml') ||
    mime.includes('octet-stream')
  ) {
    // If it's a PDF or image, it is previewable despite generic octet-stream
    if (!name.endsWith('.pdf') && !name.endsWith('.png') && !name.endsWith('.jpg') && !name.endsWith('.jpeg')) {
      return false;
    }
  }

  // Multi-file bundle: check items
  if (url.startsWith('[')) {
    try {
      const parsed = JSON.parse(material.file_url || '[]');
      if (Array.isArray(parsed) && parsed.length > 0) {
        // If all files in the bundle are non-previewable, return false
        const anyPreviewable = parsed.some((item) => {
          const itemUrl = (item.url || '').toLowerCase();
          const itemName = (item.title || item.name || '').toLowerCase();
          return !nonPreviewableExtensions.some((ext) => itemName.endsWith(ext) || itemUrl.includes(ext));
        });
        return anyPreviewable;
      }
    } catch {}
  }

  return true;
}

