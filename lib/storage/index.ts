import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../db/supabase';

export interface UploadOptions {
  fileBuffer: Buffer;
  fileName: string;
  year: number; // 1, 2, 3, 4 (1st to 4th Year)
  subjectCode: string;
  materialType: string;
  contentType?: string;
}

export interface UploadResult {
  fileUrl: string;
  fileSizeFormatted: string;
  storageProvider: 'supabase' | 'local';
}

function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function sanitizePathPart(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
}

export async function uploadStudyMaterialFile(options: UploadOptions): Promise<UploadResult> {
  const { fileBuffer, fileName, year, subjectCode, materialType, contentType } = options;
  const sizeFormatted = formatBytes(fileBuffer.length);

  const cleanSubject = sanitizePathPart(subjectCode).toUpperCase();
  const cleanType = sanitizePathPart(materialType);
  const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');

  const relativeStoragePath = `year-${year}/${cleanSubject}/${cleanType}/${Date.now()}-${cleanName}`;

  // Supabase Storage option
  if (process.env.DATA_PROVIDER === 'supabase' && isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.storage
        .from('study-materials')
        .upload(relativeStoragePath, fileBuffer, {
          contentType: contentType || 'application/pdf',
          upsert: true,
        });

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from('study-materials')
          .getPublicUrl(relativeStoragePath);

        return {
          fileUrl: publicUrlData.publicUrl,
          fileSizeFormatted: sizeFormatted,
          storageProvider: 'supabase',
        };
      } else {
        console.warn('Supabase storage upload failed, falling back to local disk storage:', error);
      }
    } catch (e) {
      console.warn('Supabase upload exception, falling back to local:', e);
    }
  }

  // Local disk storage: public/uploads/year-${year}/${cleanSubject}/${cleanType}/...
  const publicUploadDir = path.join(process.cwd(), 'public', 'uploads', `year-${year}`, cleanSubject, cleanType);
  if (!fs.existsSync(publicUploadDir)) {
    fs.mkdirSync(publicUploadDir, { recursive: true });
  }

  const finalDiskPath = path.join(publicUploadDir, `${Date.now()}-${cleanName}`);
  fs.writeFileSync(finalDiskPath, fileBuffer);

  const webUrl = `/uploads/year-${year}/${cleanSubject}/${cleanType}/${path.basename(finalDiskPath)}`;

  return {
    fileUrl: webUrl,
    fileSizeFormatted: sizeFormatted,
    storageProvider: 'local',
  };
}
