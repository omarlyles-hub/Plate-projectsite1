import exifr from 'exifr';

export interface PhotoMeta {
  lat: number;
  lon: number;
  /** Epoch ms. */
  date: number;
}

/**
 * Reads GPS and capture time from a photo's EXIF block. Returns null when the photo has
 * no location (such photos are ignored) or the file can't be parsed.
 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta | null> {
  try {
    const data = (await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      pick: ['DateTimeOriginal', 'CreateDate', 'latitude', 'longitude'],
    })) as
      | {
          latitude?: number;
          longitude?: number;
          DateTimeOriginal?: Date;
          CreateDate?: Date;
        }
      | undefined;
    if (!data) return null;
    const { latitude, longitude } = data;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      (latitude === 0 && longitude === 0)
    ) {
      return null;
    }
    const taken = data.DateTimeOriginal ?? data.CreateDate;
    const date = taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.getTime() : file.lastModified;
    return { lat: latitude, lon: longitude, date };
  } catch {
    return null;
  }
}
