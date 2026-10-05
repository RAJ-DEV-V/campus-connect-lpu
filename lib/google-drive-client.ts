/**
 * Campus Connect LPU – Direct Browser-to-Google-Drive Resumable Upload Client
 * Bypasses Vercel's 4.5 MB request body limit by streaming files directly to Google Drive API v3.
 */

export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '277645296967-m8dn80c6o3lggtubj6kck3esrd1kbj9d.apps.googleusercontent.com';

const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

// Memory cache for active access token during admin session
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Dynamically load Google Identity Services (GIS) script
 */
export function loadGoogleGsi(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window is undefined'));
    if ((window as any).google?.accounts?.oauth2) {
      return resolve((window as any).google.accounts.oauth2);
    }

    const existingScript = document.getElementById('google-gsi-client') as HTMLScriptElement;
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve((window as any).google?.accounts?.oauth2);
      });
      existingScript.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if ((window as any).google?.accounts?.oauth2) {
        resolve((window as any).google.accounts.oauth2);
      } else {
        reject(new Error('Google Identity Services failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Request or return valid Google OAuth access token for Google Drive
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
  // Check memory cache
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.token;
  }

  // Check sessionStorage
  try {
    const stored = sessionStorage.getItem('cc_gdrive_token');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt > now + 60000) {
        cachedToken = parsed;
        return parsed.token;
      }
    }
  } catch {}

  const oauth2 = await loadGoogleGsi();

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_FILE_SCOPE,
        callback: (resp: any) => {
          if (resp.error) {
            console.error('Google OAuth token error:', resp);
            return reject(new Error(resp.error_description || resp.error || 'Google Drive authorization failed'));
          }
          if (!resp.access_token) {
            return reject(new Error('No access token returned by Google'));
          }

          const expiresIn = parseInt(resp.expires_in || '3599', 10);
          const expiresAt = Date.now() + expiresIn * 1000;
          cachedToken = { token: resp.access_token, expiresAt };

          try {
            sessionStorage.setItem('cc_gdrive_token', JSON.stringify(cachedToken));
          } catch {}

          resolve(resp.access_token);
        },
      });

      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err: any) {
      reject(new Error(err.message || 'Failed to initiate Google authorization popup'));
    }
  });
}

/**
 * Retrieve or create the designated Campus Connect Google Drive folder
 */
export async function getOrCreateDriveFolder(accessToken: string): Promise<string> {
  const configuredFolderId =
    process.env.NEXT_PUBLIC_GOOGLE_DRIVE_FOLDER_ID ||
    (process.env as any).VITE_GOOGLE_DRIVE_FOLDER_ID;

  if (configuredFolderId && configuredFolderId.trim()) {
    return configuredFolderId.trim();
  }

  // Search for existing folder
  try {
    const q = encodeURIComponent("name = 'Campus Connect Study Materials' and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return searchData.files[0].id;
      }
    }
  } catch (e) {
    console.warn('Folder search notice:', e);
  }

  // Create folder once if not found
  try {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Campus Connect Study Materials',
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    if (createRes.ok) {
      const folderData = await createRes.json();
      return folderData.id;
    }
  } catch (e) {
    console.warn('Folder creation notice:', e);
  }

  return '';
}

export interface DriveUploadOptions {
  file: File;
  title: string;
  subjectCode: string;
  year: number;
  materialType: string;
  description?: string;
  onProgress?: (percent: number, loaded: number, total: number) => void;
}

export interface DriveUploadResult {
  fileId: string;
  fileName: string;
  fileSizeFormatted: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  previewUrl: string;
}

function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Perform a direct browser-to-Google-Drive resumable upload
 */
export async function uploadToGoogleDriveResumable(
  options: DriveUploadOptions
): Promise<DriveUploadResult> {
  const { file, title, subjectCode, year, materialType, description, onProgress } = options;

  // 1. Obtain Google Drive OAuth access token
  const accessToken = await getGoogleDriveAccessToken();

  // 2. Resolve target folder
  const folderId = await getOrCreateDriveFolder(accessToken);

  const ext = (file.name || '').toLowerCase();
  let resolvedMime = file.type;
  if (!resolvedMime || resolvedMime === 'application/octet-stream') {
    if (ext.endsWith('.zip')) resolvedMime = 'application/zip';
    else if (ext.endsWith('.rar')) resolvedMime = 'application/vnd.rar';
    else if (ext.endsWith('.7z')) resolvedMime = 'application/x-7z-compressed';
    else if (ext.endsWith('.tar')) resolvedMime = 'application/x-tar';
    else if (ext.endsWith('.gz')) resolvedMime = 'application/gzip';
    else if (ext.endsWith('.pptx')) resolvedMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    else if (ext.endsWith('.ppt')) resolvedMime = 'application/vnd.ms-powerpoint';
    else if (ext.endsWith('.docx')) resolvedMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext.endsWith('.doc')) resolvedMime = 'application/msword';
    else if (ext.endsWith('.xlsx')) resolvedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext.endsWith('.xls')) resolvedMime = 'application/vnd.ms-excel';
    else if (ext.endsWith('.png')) resolvedMime = 'image/png';
    else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) resolvedMime = 'image/jpeg';
    else if (ext.endsWith('.webp')) resolvedMime = 'image/webp';
    else resolvedMime = file.type || 'application/pdf';
  }

  // 3. Initiate Resumable Upload session directly with Google Drive API v3
  const metadata: any = {
    name: file.name,
    mimeType: resolvedMime,
    description: `Campus Connect LPU | ${title} | ${subjectCode} | Year ${year} | ${materialType}${
      description ? ` | ${description}` : ''
    }`,
  };

  if (folderId) {
    metadata.parents = [folderId];
  }

  const initRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': resolvedMime,
      'X-Upload-Content-Length': file.size.toString(),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    let errDetail = '';
    try {
      const errJson = await initRes.json();
      errDetail = errJson.error?.message || JSON.stringify(errJson);
    } catch {
      errDetail = await initRes.text();
    }
    throw new Error(`Google Drive upload initialization failed: ${errDetail || `HTTP ${initRes.status}`}`);
  }

  const uploadLocation = initRes.headers.get('Location');
  if (!uploadLocation) {
    throw new Error('Google Drive API did not return a resumable upload location URI.');
  }

  // 4. Stream file chunks directly to Google Drive via XMLHttpRequest for real-time progress
  const driveFile: any = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadLocation, true);
    xhr.setRequestHeader('Content-Type', resolvedMime);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));
          onProgress(percent, e.loaded, e.total);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch {
          resolve({ id: xhr.getResponseHeader('X-Goog-Upload-Header-Content-Length') || '' });
        }
      } else {
        let errMsg = `Upload failed with status HTTP ${xhr.status}`;
        try {
          const errData = JSON.parse(xhr.responseText);
          errMsg = errData.error?.message || errMsg;
        } catch {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Google Drive resumable upload.'));
    xhr.send(file);
  });

  if (!driveFile || !driveFile.id) {
    throw new Error('Google Drive upload completed but no file ID was returned.');
  }

  const fileId = driveFile.id;

  // 5. Grant read permission so students can preview document
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (permErr) {
    console.warn('Google Drive file permission notice:', permErr);
  }

  const fileUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return {
    fileId,
    fileName: file.name,
    fileSizeFormatted: formatBytes(file.size),
    fileSize: file.size,
    mimeType: resolvedMime,
    fileUrl,
    previewUrl,
  };
}
