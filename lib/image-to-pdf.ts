import { PDFDocument } from 'pdf-lib';

export interface ImagePageItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  size: number;
}

export interface MergeImagesProgress {
  current: number;
  total: number;
  stage: string;
}

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

    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not load image "${file.name}". Please ensure it is a valid image file.`));
    };

    img.src = objectUrl;
  });
}

/**
 * Combines multiple image files into a single multi-page PDF document.
 * Each image becomes its own page in the PDF, scaled cleanly to document points.
 */
export async function mergeImagesToPdf(
  files: File[],
  pdfTitle: string,
  onProgress?: (progress: MergeImagesProgress) => void
): Promise<File> {
  if (!files || files.length === 0) {
    throw new Error('No images provided for PDF conversion.');
  }

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(pdfTitle || 'Clubbed Study Notes');
  pdfDoc.setCreator('Campus Connect LPU Document Engine');
  pdfDoc.setProducer('Campus Connect LPU');

  const total = files.length;

  for (let i = 0; i < total; i++) {
    const file = files[i];
    if (onProgress) {
      onProgress({
        current: i + 1,
        total,
        stage: `Processing page ${i + 1} of ${total}: "${file.name}"...`,
      });
    }

    const { buffer, width, height } = await processImageForPdf(file);
    const embeddedImage = await pdfDoc.embedJpg(buffer);

    // Standard PDF points calculation (72 points/inch)
    // Scale so standard A4 max dimension (842 pt) fits comfortably
    const maxPoints = 842;
    const aspect = width / height;
    let pageW: number;
    let pageH: number;

    if (aspect <= 1) {
      // Portrait
      pageH = maxPoints;
      pageW = Math.round(maxPoints * aspect);
    } else {
      // Landscape
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

  if (onProgress) {
    onProgress({
      current: total,
      total,
      stage: 'Building final combined PDF document...',
    });
  }

  const pdfBytes = await pdfDoc.save();

  // Clean filename
  const cleanBaseName = (pdfTitle || 'Combined_Notes')
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
