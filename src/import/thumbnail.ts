import { IMPORT_CONFIG } from './importConfig';

/**
 * Decodes a photo and returns a small JPEG thumbnail. The original is never stored.
 * Returns null when the browser can't decode the file (e.g. HEIC outside Safari).
 */
export async function makeThumbnail(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, IMPORT_CONFIG.thumbMaxPx / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', IMPORT_CONFIG.thumbQuality),
    );
  } catch {
    return null;
  }
}
