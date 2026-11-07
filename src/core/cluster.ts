import { haversineM } from './geo';

export interface PhotoPoint {
  id: string;
  /** Epoch milliseconds. */
  date: number;
  lat: number;
  lon: number;
}

export interface ClusterConfig {
  /** A cluster stays open while its newest photo is at most this old (ms). */
  maxGapMs: number;
  /** A photo joins a cluster when within this distance of the cluster centroid (m). */
  radiusM: number;
  /** A cluster never spans longer than this from first to last photo (ms). */
  maxSpanMs: number;
  /** Clusters with fewer photos are dropped. */
  minPhotos: number;
}

const HOUR = 3_600_000;

export const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  maxGapMs: 3 * HOUR,
  radiusM: 100,
  maxSpanMs: 6 * HOUR,
  minPhotos: 1,
};

export interface MealCluster {
  photos: PhotoPoint[];
  start: number;
  end: number;
  /** Running mean of member coordinates. */
  lat: number;
  lon: number;
}

/**
 * Groups photos into meals by time and place.
 *
 * Photos are visited in time order. Each photo joins the nearest *open* cluster
 * (newest photo within `maxGapMs`, centroid within `radiusM`, total span within
 * `maxSpanMs`); otherwise it starts a new cluster. Comparing against every open
 * cluster, not just the latest, keeps interleaved places (restaurant, bar next door,
 * back at the table) apart. Boundaries are inclusive: exactly 3 h or exactly 100 m joins.
 */
export function clusterMeals(
  points: readonly PhotoPoint[],
  config: ClusterConfig = DEFAULT_CLUSTER_CONFIG,
): MealCluster[] {
  const sorted = [...points].sort((a, b) => a.date - b.date || a.id.localeCompare(b.id));
  const all: MealCluster[] = [];
  let open: MealCluster[] = [];

  for (const p of sorted) {
    open = open.filter((c) => p.date - c.end <= config.maxGapMs);

    let best: MealCluster | undefined;
    let bestDist = Infinity;
    for (const c of open) {
      if (p.date - c.start > config.maxSpanMs) continue;
      const d = haversineM(c.lat, c.lon, p.lat, p.lon);
      if (d <= config.radiusM && d < bestDist) {
        best = c;
        bestDist = d;
      }
    }

    if (best) {
      const n = best.photos.length;
      best.lat = (best.lat * n + p.lat) / (n + 1);
      best.lon = (best.lon * n + p.lon) / (n + 1);
      best.photos.push(p);
      best.end = p.date;
    } else {
      const c: MealCluster = { photos: [p], start: p.date, end: p.date, lat: p.lat, lon: p.lon };
      all.push(c);
      open.push(c);
    }
  }

  return all.filter((c) => c.photos.length >= config.minPhotos);
}
