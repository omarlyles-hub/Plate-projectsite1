import { distanceOrInfinity, haversineM } from './geo';
import { nearestNeighborhood } from './neighborhoods';
import type { Venue, VenueCandidate } from './types';

/** A place lookup. The real implementation queries OpenStreetMap; tests inject stubs. */
export interface VenueSource {
  search(lat: number, lon: number, radiusM: number): Promise<VenueCandidate[]>;
}

export interface MatchOptions {
  /** False when the user has turned lookup off: skips the network entirely. */
  lookupEnabled: boolean;
  /** Venues already in the user's log. */
  knownVenues: readonly Venue[];
  maxCandidates?: number;
  searchRadiusM?: number;
  /** How close a logged venue must be to be offered as a fallback. */
  knownRadiusM?: number;
  /** Search is abandoned (treated as empty) after this long. */
  timeoutMs?: number;
}

export type MatchSource = 'search' | 'known' | 'unknown';

export interface MatchResult {
  candidates: VenueCandidate[];
  /** Where the top candidate came from, for UI hints and tests. */
  source: MatchSource;
  /** True when lookup was enabled but the search threw or timed out (as opposed to finding nothing). */
  lookupFailed: boolean;
}

// The timeout must exceed the sum of the source's own per-endpoint timeouts so a backup
// endpoint gets its turn before the matcher gives up.
const DEFAULTS = { maxCandidates: 3, searchRadiusM: 75, knownRadiusM: 150, timeoutMs: 20_000 };
/** A venue the user has visited before ranks as if it were this much closer (m). */
const KNOWN_BOOST_M = 40;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('venue search timed out')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

const norm = (s: string) => s.trim().toLowerCase();

function findKnown(c: VenueCandidate, known: readonly Venue[]): Venue | undefined {
  return known.find(
    (v) =>
      (c.mapItemId !== null && v.mapItemId === c.mapItemId) ||
      (norm(v.name) === norm(c.name) &&
        // A venue saved without a location matches on name alone.
        (v.latitude === null ||
          v.longitude === null ||
          haversineM(v.latitude, v.longitude, c.latitude, c.longitude) <= 150)),
  );
}

function fromKnown(
  v: Venue & { latitude: number; longitude: number },
  lat: number,
  lon: number,
): VenueCandidate {
  return {
    name: v.name,
    address: v.address,
    latitude: v.latitude,
    longitude: v.longitude,
    mapItemId: v.mapItemId,
    neighborhood: v.neighborhood,
    distanceM: distanceOrInfinity(lat, lon, v.latitude, v.longitude),
    knownVenueId: v.id,
  };
}

const hasLocation = (v: Venue): v is Venue & { latitude: number; longitude: number } =>
  v.latitude !== null && v.longitude !== null;

/**
 * Proposes up to three venues for a meal location.
 *
 * Fallback chain when the lookup returns nothing, throws, times out or is disabled:
 *   1. venues already in the user's log within `knownRadiusM`;
 *   2. a single synthetic "Unknown place" candidate that needs a typed name.
 */
export async function matchVenue(
  lat: number,
  lon: number,
  source: VenueSource,
  options: MatchOptions,
): Promise<MatchResult> {
  const o = { ...DEFAULTS, ...options };
  const neighborhood = nearestNeighborhood(lat, lon);

  let found: VenueCandidate[] = [];
  let lookupFailed = false;
  if (o.lookupEnabled) {
    try {
      found = await withTimeout(source.search(lat, lon, o.searchRadiusM), o.timeoutMs);
    } catch {
      found = [];
      lookupFailed = true;
    }
  }

  const ranked = found
    .map((c) => {
      const known = findKnown(c, o.knownVenues);
      const withHood = { ...c, neighborhood: c.neighborhood || neighborhood };
      const candidate: VenueCandidate = known
        ? { ...withHood, knownVenueId: known.id }
        : withHood;
      return { candidate, score: c.distanceM - (known ? KNOWN_BOOST_M : 0) };
    })
    .sort((a, b) => a.score - b.score)
    .map((r) => r.candidate);

  // De-duplicate by id/name, then pad with nearby logged venues.
  const seen = new Set<string>();
  const result: VenueCandidate[] = [];
  const push = (c: VenueCandidate) => {
    const key = c.mapItemId ?? `${norm(c.name)}@${c.latitude.toFixed(4)}`;
    if (seen.has(key) || result.length >= o.maxCandidates) return;
    seen.add(key);
    result.push(c);
  };
  ranked.forEach(push);

  const nearbyKnown = o.knownVenues
    .filter(hasLocation)
    .map((v) => fromKnown(v, lat, lon))
    .filter((c) => c.distanceM <= o.knownRadiusM)
    .sort((a, b) => a.distanceM - b.distanceM);
  nearbyKnown.forEach(push);

  if (result.length > 0) {
    return { candidates: result, source: ranked.length > 0 ? 'search' : 'known', lookupFailed };
  }

  return {
    candidates: [
      {
        name: `Unknown place, ${neighborhood}`,
        address: '',
        latitude: lat,
        longitude: lon,
        mapItemId: null,
        neighborhood,
        distanceM: 0,
        needsManualName: true,
      },
    ],
    source: 'unknown',
    lookupFailed,
  };
}
