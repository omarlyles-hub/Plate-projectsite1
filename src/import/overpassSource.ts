import { haversineM, roundCoord } from '../core/geo';
import type { VenueSource } from '../core/venueMatcher';
import type { VenueCandidate } from '../core/types';

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const FOOD_AMENITIES = 'restaurant|cafe|bar|pub|fast_food|ice_cream|food_court|biergarten';

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildQuery(lat: number, lon: number, radiusM: number): string {
  const around = `around:${Math.round(radiusM)},${lat},${lon}`;
  return (
    `[out:json][timeout:15];(` +
    `nwr(${around})["amenity"~"^(${FOOD_AMENITIES})$"]["name"];` +
    `nwr(${around})["shop"="bakery"]["name"];` +
    `);out center tags 30;`
  );
}

/** Pure parser, exported for tests. */
export function parseOverpass(
  json: { elements?: OverpassElement[] },
  lat: number,
  lon: number,
): VenueCandidate[] {
  const out: VenueCandidate[] = [];
  for (const el of json.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name?.trim();
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (!name || elLat === undefined || elLon === undefined) continue;
    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    out.push({
      name,
      address: street,
      latitude: elLat,
      longitude: elLon,
      mapItemId: `${el.type}/${el.id}`,
      neighborhood: tags['addr:suburb'] ?? tags['addr:neighbourhood'] ?? '',
      distanceM: haversineM(lat, lon, elLat, elLon),
    });
  }
  return out.sort((a, b) => a.distanceM - b.distanceM);
}

interface Options {
  fetchFn?: typeof fetch;
  /** Minimum spacing between requests, to be polite to the public servers. */
  minIntervalMs?: number;
  /** Per-endpoint timeout. Two endpoints must fit inside the matcher's overall timeout. */
  timeoutMs?: number;
  /** After this many consecutive failed lookups the source stops trying for `cooldownMs`. */
  maxConsecutiveFailures?: number;
  cooldownMs?: number;
  now?: () => number;
}

/**
 * OpenStreetMap Overpass lookup. Coordinates are rounded to 4 decimals (about 11 m)
 * before leaving the device; requests are serialised and cached by rounded location.
 */
export function createOverpassSource(options: Options = {}): VenueSource {
  const fetchFn = options.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const minInterval = options.minIntervalMs ?? 1000;
  const timeoutMs = options.timeoutMs ?? 8_000;
  const maxFailures = options.maxConsecutiveFailures ?? 2;
  const cooldownMs = options.cooldownMs ?? 60_000;
  const clock = options.now ?? Date.now;
  const cache = new Map<string, VenueCandidate[]>();
  let chain: Promise<unknown> = Promise.resolve();
  let lastRequestAt = 0;
  // Circuit breaker: when the public servers are down, don't make a big import crawl
  // through one slow timeout per meal.
  let consecutiveFailures = 0;
  let blockedUntil = 0;

  async function request(query: string): Promise<{ elements?: OverpassElement[] }> {
    let lastError: unknown;
    for (const endpoint of ENDPOINTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetchFn(endpoint, {
          method: 'POST',
          body: new URLSearchParams({ data: query }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        return (await res.json()) as { elements?: OverpassElement[] };
      } catch (e) {
        lastError = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Overpass unavailable');
  }

  return {
    search(lat, lon, radiusM) {
      const rLat = roundCoord(lat);
      const rLon = roundCoord(lon);
      const key = `${rLat},${rLon},${radiusM}`;
      const cached = cache.get(key);
      if (cached) return Promise.resolve(cached);

      const run = async () => {
        if (clock() < blockedUntil) throw new Error('Overpass temporarily skipped after repeated failures');
        const wait = lastRequestAt + minInterval - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastRequestAt = Date.now();
        try {
          const json = await request(buildQuery(rLat, rLon, radiusM));
          const result = parseOverpass(json, lat, lon);
          cache.set(key, result);
          consecutiveFailures = 0;
          return result;
        } catch (e) {
          consecutiveFailures += 1;
          if (consecutiveFailures >= maxFailures) {
            blockedUntil = clock() + cooldownMs;
            consecutiveFailures = 0;
          }
          throw e;
        }
      };
      const next = chain.then(run, run);
      chain = next.catch(() => undefined);
      return next;
    },
  };
}
