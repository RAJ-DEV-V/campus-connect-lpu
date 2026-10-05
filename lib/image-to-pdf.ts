import { PDFDocument } from 'pdf-lib';

export interface DocumentItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
  type: 'image' | 'pdf' | 'other';
  pageCount?: number;
}

// Backward compatibility alias
export type ImagePageItem = DocumentItem;

export interface MergeProgress {
  current: number;
  total: number;
  stage: string;
}

export type MergeImagesProgress = MergeProgress;

/**
 * Normalizes an image file (JPG, PNG, WEBP, etc.) into high-quality JPEG Uint8Array bytes
 * and captures its natural dimensions, scaling down if resolution exceeds 2400px to maintain
 * crisp readability while keeping memory and PDF size lean.
 */
async function processImageForPdf(file: File): Promise<{ buffer: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const MAX_DIM = 2400; // 2400px preserves ultra-sharp handwriting, diagrams, & formulas
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      if (!width || !height) {
        width = 1200;
        height = 1600;
      }

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // Fill white background to prevent transparent PNGs from turning black
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error(`Failed to convert image "${file.name}" to JPEG`));
            return;
          }
          const arrayBuffer = await blob.arrayBuffer();
          resolve({
            buffer: new Uint8Array(arrayBuffer),
            width,
            height,
          });
        },
        'image/jpeg',
        0.90
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load image "${file.name}". Please ensure it is a valid image file.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Combines multiple files (PDFs, Images, or a mix of both) into a single multi-page PDF document.
 * - For PDF files: copies and preserves all original vector and raster pages.
 * - For Image files: scales each image cleanly to document points on its own dedicated page.
 */
export async function mergeDocumentsToPdf(
  files: File[],
  pdfTitle: string,
  onProgress?: (progress: MergeProgress) => void
): Promise<File> {
  if (!files || files.length === 0) {
    throw new Error('No files provided for PDF conversion.');
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(pdfTitle || 'Campus Connect Study Material');
  pdfDoc.setCreator('Campus Connect LPU Document Engine');
  pdfDoc.setProducer('Campus Connect LPU');

  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        stage: `Processing ${isPdf ? 'PDF document' : 'page'} ${i + 1} of ${total}: "${file.name}"...`,
      });
    }

    if (isPdf) {
      try {
        const fileBytes = await file.arrayBuffer();
        const srcDoc = await PDFDocument.load(fileBytes, { ignoreEncryption: true });
        const copiedPages = await pdfDoc.copyPages(srcDoc, srcDoc.getPageIndices());
        for (const page of copiedPages) {
          pdfDoc.addPage(page);
        }
      } catch (pdfErr) {
        console.warn(`Error reading PDF "${file.name}", attempting fallback:`, pdfErr);
        // If PDF reading fails (e.g. encrypted or corrupted header), throw informative error
        throw new Error(`Could not merge "${file.name}". The PDF might be password-protected or corrupted.`);
      }
    } else {
      // It's an image (JPG, PNG, WEBP, etc.)
      const { buffer, width, height } = await processImageForPdf(file);
      const embeddedImage = await pdfDoc.embedJpg(buffer);

      const maxPoints = 842;
      const aspect = width / height;
      let pageW: number;
      let pageH: number;

      if (aspect <= 1) {
        pageH = maxPoints;
        pageW = Math.round(maxPoints * aspect);
      } else {
        pageW = maxPoints;
        pageH = Math.round(maxPoints / aspect);
      }

      const page = pdfDoc.addPage([pageW, pageH]);
      page.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: pageW,
        height: pageH,
      });
    }
  }

  if (onProgress) {
    onProgress({
      current: total,
      total,
      stage: 'Building final combined PDF document...',
    });
  }

  const pdfBytes = await pdfDoc.save();

  // Clean filename
  const cleanBaseName = (pdfTitle || 'Combined_Study_Material')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);

  const finalFileName = cleanBaseName.endsWith('.pdf') ? cleanBaseName : `${cleanBaseName}.pdf`;

  return new File([pdfBytes.buffer as ArrayBuffer], finalFileName, {
    type: 'application/pdf',
    lastModified: Date.now(),
  });
}

// Backward-compatible alias
export const mergeImagesToPdf = mergeDocumentsToPdf;
