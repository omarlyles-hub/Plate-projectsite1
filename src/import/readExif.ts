import exifr from 'exifr';

export interface PhotoMeta {
  /** Null when the photo carries no GPS location. */
  lat: number | null;
  lon: number | null;
  /** Epoch ms. */
  date: number;
  /** Where the date came from: the photo's EXIF, or the file's modified time as a fallback. */
  dateSource: 'exif' | 'file';
}

const validCoord = (lat: unknown, lon: unknown): lat is number =>
  typeof lat === 'number' &&
  typeof lon === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  !(lat === 0 && lon === 0);

type Times = { DateTimeOriginal?: Date; CreateDate?: Date } | undefined;

/**
 * Reads capture time and, when present, GPS from a photo's EXIF block. Photos without a
 * location are still returned (lat/lon null); photos with no date fall back to the file's
 * modified time.
 */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  let gps: { latitude?: number; longitude?: number } | undefined;
  try {
    gps = (await exifr.gps(file)) as typeof gps;
  } catch {
    gps = undefined;
  }

  let times: Times;
  try {
    times = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: false,
      pick: ['DateTimeOriginal', 'CreateDate'],
    })) as Times;
  } catch {
    times = undefined;
  }

  const taken = times?.DateTimeOriginal ?? times?.CreateDate;
  const exifDate = taken instanceof Date && !Number.isNaN(taken.getTime()) ? taken.getTime() : undefined;
  const located = gps !== undefined && validCoord(gps.latitude, gps.longitude);

  return {
    lat: located ? (gps?.latitude as number) : null,
    lon: located ? (gps?.longitude as number) : null,
    date: exifDate ?? file.lastModified,
    dateSource: exifDate !== undefined ? 'exif' : 'file',
  };
}
