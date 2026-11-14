import { clusterPhotos, type TimedPhoto } from '../core/cluster';
import { newUuid } from '../core/uuid';
import { matchVenue, type VenueSource } from '../core/venueMatcher';
import type { MealCandidate } from '../core/types';
import type { Repository } from '../data/repo';
import type { FoodClassifier } from './foodClassifier';
import { IMPORT_CONFIG, lookbackStart } from './importConfig';
import type { PhotoMeta } from './readExif';

export type ImportPhase = 'reading' | 'matching' | 'done';

export interface ImportProgress {
  phase: ImportPhase;
  /** Files examined so far (reading) or clusters matched so far (matching). */
  done: number;
  total: number;
  kept: number;
  /** Photos examined that carried no GPS. They are still imported; their venue is typed by hand. */
  withoutLocation: number;
  /** Photos with no capture date in EXIF, so the file's modified time was used. */
  usedFileDate: number;
  skippedOutsideWindow: number;
  skippedNotFood: number;
  skippedUnreadable: number;
  skippedAlreadyScanned: number;
}

export interface ImportSummary extends ImportProgress {
  /** New triage cards created. */
  candidates: number;
  /** Meals whose venue lookup failed (server unreachable or timed out), so names must be typed. */
  lookupFailures: number;
  /** Set when the run stopped early (cancelled or the classifier kept failing). */
  stoppedReason?: 'cancelled' | 'classifier-failed';
}

export interface ImportDeps {
  repo: Pick<
    Repository,
    'hasScanned' | 'markScanned' | 'savePhoto' | 'saveCandidates' | 'listVenues'
  >;
  readMeta: (file: File) => Promise<PhotoMeta>;
  makeThumbnail: (file: File) => Promise<Blob | null>;
  classifier: FoodClassifier;
  venueSource: VenueSource;
  lookupEnabled: boolean;
  now?: () => number;
  foodThreshold?: number;
  newId?: () => string;
}

const MAX_CONSECUTIVE_CLASSIFIER_ERRORS = 3;

export const fingerprint = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;

/**
 * Scans picked files: keep photos from the last 12 months that look like food (with or
 * without GPS), store thumbnails only, cluster into meals, propose venues where a location
 * exists, and persist triage candidates. Cards for photos without a location carry no venue
 * proposals, so the user types the name.
 */
export async function runImport(
  files: readonly File[],
  deps: ImportDeps,
  onProgress: (p: ImportProgress) => void = () => undefined,
  signal?: AbortSignal,
): Promise<ImportSummary> {
  const now = deps.now?.() ?? Date.now();
  const since = lookbackStart(now);
  const threshold = deps.foodThreshold ?? IMPORT_CONFIG.foodThreshold;
  const newId = deps.newId ?? newUuid;

  const p: ImportProgress = {
    phase: 'reading',
    done: 0,
    total: files.length,
    kept: 0,
    withoutLocation: 0,
    usedFileDate: 0,
    skippedOutsideWindow: 0,
    skippedNotFood: 0,
    skippedUnreadable: 0,
    skippedAlreadyScanned: 0,
  };
  const emit = () => onProgress({ ...p });
  emit();

  const points: TimedPhoto[] = [];
  const scanned: string[] = [];
  let stoppedReason: ImportSummary['stoppedReason'];
  let consecutiveErrors = 0;

  for (const file of files) {
    if (signal?.aborted) {
      stoppedReason = 'cancelled';
      break;
    }
    p.done += 1;
    const fp = fingerprint(file);

    if (await deps.repo.hasScanned(fp)) {
      p.skippedAlreadyScanned += 1;
      emit();
      continue;
    }

    const meta = await deps.readMeta(file);
    if (meta.lat === null || meta.lon === null) p.withoutLocation += 1;
    if (meta.dateSource === 'file') p.usedFileDate += 1;
    if (meta.date < since || meta.date > now + 86_400_000) {
      p.skippedOutsideWindow += 1;
      scanned.push(fp);
      emit();
      continue;
    }

    const thumb = await deps.makeThumbnail(file);
    if (!thumb) {
      p.skippedUnreadable += 1;
      scanned.push(fp);
      emit();
      continue;
    }

    let score: number;
    try {
      score = await deps.classifier.classify(thumb);
      consecutiveErrors = 0;
    } catch {
      consecutiveErrors += 1;
      p.skippedUnreadable += 1;
      emit();
      if (consecutiveErrors >= MAX_CONSECUTIVE_CLASSIFIER_ERRORS) {
        stoppedReason = 'classifier-failed';
        break;
      }
      continue; // not marked scanned: worth retrying next time
    }

    scanned.push(fp);
    if (score < threshold) {
      p.skippedNotFood += 1;
      emit();
      continue;
    }

    const id = newId();
    await deps.repo.savePhoto(id, thumb);
    points.push({ id, date: meta.date, lat: meta.lat, lon: meta.lon });
    p.kept += 1;
    emit();
  }

  await deps.repo.markScanned(scanned);

  // Cluster and match venues for whatever was kept, even if the run stopped early.
  const clusters = clusterPhotos(points);
  p.phase = 'matching';
  p.done = 0;
  p.total = clusters.length;
  emit();

  const knownVenues = await deps.repo.listVenues();
  const candidates: MealCandidate[] = [];
  let lookupFailures = 0;
  for (const cluster of clusters) {
    let proposals: MealCandidate['candidates'] = [];
    if (cluster.lat !== null && cluster.lon !== null) {
      const match = await matchVenue(cluster.lat, cluster.lon, deps.venueSource, {
        lookupEnabled: deps.lookupEnabled,
        knownVenues,
      });
      if (match.lookupFailed) lookupFailures += 1;
      proposals = match.candidates;
    }
    candidates.push({
      id: newId(),
      date: cluster.start,
      latitude: cluster.lat,
      longitude: cluster.lon,
      photoIds: cluster.photos.map((ph) => ph.id),
      candidates: proposals,
      status: 'pending',
    });
    p.done += 1;
    emit();
  }
  await deps.repo.saveCandidates(candidates);

  p.phase = 'done';
  emit();
  return { ...p, candidates: candidates.length, lookupFailures, stoppedReason };
}
