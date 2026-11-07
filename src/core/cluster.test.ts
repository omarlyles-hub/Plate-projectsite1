import { describe, expect, it } from 'vitest';
import { clusterMeals, clusterPhotos, DEFAULT_CLUSTER_CONFIG, type PhotoPoint, type TimedPhoto } from './cluster';
import { haversineM, metresToLatDegrees } from './geo';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 5, 1, 18, 0, 0);
const LAT = 40.7358;
const LON = -74.0036;

/** A photo `metresNorth` of the base point, `ms` after T0. */
const photo = (id: string, ms: number, metresNorth = 0): PhotoPoint => ({
  id,
  date: T0 + ms,
  lat: LAT + metresToLatDegrees(metresNorth),
  lon: LON,
});

describe('geo helper sanity', () => {
  it('offsets latitude by the requested number of metres', () => {
    const d = haversineM(LAT, LON, LAT + metresToLatDegrees(100), LON);
    expect(d).toBeCloseTo(100, 3);
  });
});

describe('clusterMeals: time threshold', () => {
  it('joins photos exactly 3 hours apart', () => {
    const out = clusterMeals([photo('a', 0), photo('b', 3 * HOUR)]);
    expect(out).toHaveLength(1);
    expect(out[0].photos.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('splits photos 3 hours and 1 second apart', () => {
    const out = clusterMeals([photo('a', 0), photo('b', 3 * HOUR + 1000)]);
    expect(out).toHaveLength(2);
  });

  it('chains photos that are each within the gap of the previous one', () => {
    const out = clusterMeals([photo('a', 0), photo('b', 2.5 * HOUR), photo('c', 5 * HOUR)]);
    expect(out).toHaveLength(1);
  });

  it('breaks a long chain at the max span', () => {
    // Every step is under the 3 h gap, but the total passes 6 h.
    const out = clusterMeals([
      photo('a', 0),
      photo('b', 2.5 * HOUR),
      photo('c', 5 * HOUR),
      photo('d', 7 * HOUR),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].photos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(out[1].photos.map((p) => p.id)).toEqual(['d']);
  });
});

describe('clusterMeals: distance threshold', () => {
  it('joins photos 99 m apart', () => {
    expect(clusterMeals([photo('a', 0, 0), photo('b', 60_000, 99)])).toHaveLength(1);
  });

  it('splits photos 101 m apart', () => {
    expect(clusterMeals([photo('a', 0, 0), photo('b', 60_000, 101)])).toHaveLength(2);
  });

  it('measures distance to the running centroid, not the first photo', () => {
    // Centroid after a(0) and b(90) is 45 m; c at 140 m is 95 m from it, so it joins.
    const out = clusterMeals([photo('a', 0, 0), photo('b', 1000, 90), photo('c', 2000, 140)]);
    expect(out).toHaveLength(1);
    expect(out[0].lat).toBeGreaterThan(LAT);
  });
});

describe('clusterMeals: structure', () => {
  it('keeps interleaved places apart', () => {
    // Restaurant (0 m), bar 300 m away, then back to the restaurant table.
    const out = clusterMeals([
      photo('r1', 0, 0),
      photo('b1', 20 * 60_000, 300),
      photo('r2', 40 * 60_000, 5),
    ]);
    expect(out).toHaveLength(2);
    const restaurant = out.find((c) => c.photos.some((p) => p.id === 'r1'))!;
    expect(restaurant.photos.map((p) => p.id)).toEqual(['r1', 'r2']);
  });

  it('puts a photo in the nearest cluster when two are in range', () => {
    // Two clusters 160 m apart; the new photo is 70 m from one and 90 m from the other.
    const out = clusterMeals([
      photo('a', 0, 0),
      photo('b', 1000, 160),
      photo('c', 2000, 70),
    ]);
    const withA = out.find((c) => c.photos.some((p) => p.id === 'a'))!;
    expect(withA.photos.map((p) => p.id)).toEqual(['a', 'c']);
  });

  it('returns nothing for empty input and one cluster for a single photo', () => {
    expect(clusterMeals([])).toEqual([]);
    const single = clusterMeals([photo('a', 0)]);
    expect(single).toHaveLength(1);
    expect(single[0].start).toBe(single[0].end);
  });

  it('sorts unsorted input and reports start/end', () => {
    const out = clusterMeals([photo('c', 2 * HOUR), photo('a', 0), photo('b', HOUR)]);
    expect(out).toHaveLength(1);
    expect(out[0].photos.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(out[0].start).toBe(T0);
    expect(out[0].end).toBe(T0 + 2 * HOUR);
  });

  it('does not mutate its input', () => {
    const input = [photo('b', HOUR), photo('a', 0)];
    clusterMeals(input);
    expect(input.map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('honours a custom config', () => {
    const cfg = { ...DEFAULT_CLUSTER_CONFIG, maxGapMs: HOUR, radiusM: 20 };
    expect(clusterMeals([photo('a', 0), photo('b', 1.5 * HOUR)], cfg)).toHaveLength(2);
    expect(clusterMeals([photo('a', 0, 0), photo('b', 1000, 30)], cfg)).toHaveLength(2);
    expect(clusterMeals([photo('a', 0, 0), photo('b', 1000, 15)], cfg)).toHaveLength(1);
  });

  it('drops clusters below minPhotos', () => {
    const cfg = { ...DEFAULT_CLUSTER_CONFIG, minPhotos: 2 };
    const out = clusterMeals(
      [photo('a', 0), photo('b', 1000), photo('lonely', 10 * HOUR, 5000)],
      cfg,
    );
    expect(out).toHaveLength(1);
    expect(out[0].photos).toHaveLength(2);
  });
});

describe('clusterPhotos: photos without a location', () => {
  const noGps = (id: string, ms: number): TimedPhoto => ({ id, date: T0 + ms, lat: null, lon: null });

  it('behaves like clusterMeals when every photo has a location', () => {
    const pts = [photo('a', 0), photo('b', HOUR), photo('c', 10 * HOUR)];
    expect(clusterPhotos(pts).map((c) => c.photos.map((p) => p.id))).toEqual(
      clusterMeals(pts).map((c) => c.photos.map((p) => p.id)),
    );
  });

  it('attaches an unlocated photo to a located meal that is within the time gap', () => {
    const out = clusterPhotos([photo('a', 0), noGps('n', 2 * HOUR)]);
    expect(out).toHaveLength(1);
    expect(out[0].photos.map((p) => p.id)).toEqual(['a', 'n']);
    expect(out[0].lat).not.toBeNull();
  });

  it('joins at exactly the gap and splits just beyond it', () => {
    expect(clusterPhotos([photo('a', 0), noGps('n', 3 * HOUR)])).toHaveLength(1);
    expect(clusterPhotos([photo('a', 0), noGps('n', 3 * HOUR + 1000)])).toHaveLength(2);
  });

  it('chooses the located meal nearest in time', () => {
    const out = clusterPhotos([photo('early', 0, 0), photo('late', 5 * HOUR, 500), noGps('n', 4 * HOUR)]);
    const withN = out.find((c) => c.photos.some((p) => p.id === 'n'))!;
    expect(withN.photos.map((p) => p.id)).toContain('late');
  });

  it('does not stretch a located meal beyond the max span', () => {
    // Located meal spans 5.5 h; attaching a photo 2.5 h after its end would make it 8 h.
    const out = clusterPhotos([photo('a', 0), photo('b', 2.7 * HOUR), photo('c', 5.4 * HOUR), noGps('n', 7.9 * HOUR)]);
    expect(out).toHaveLength(2);
    expect(out.find((c) => c.lat === null)?.photos.map((p) => p.id)).toEqual(['n']);
  });

  it('groups remaining unlocated photos by time into location-less clusters', () => {
    const out = clusterPhotos([noGps('a', 0), noGps('b', HOUR), noGps('c', 10 * HOUR)]);
    expect(out).toHaveLength(2);
    expect(out[0].photos.map((p) => p.id)).toEqual(['a', 'b']);
    expect(out[0].lat).toBeNull();
    expect(out[0].lon).toBeNull();
    expect(out[1].photos.map((p) => p.id)).toEqual(['c']);
  });

  it('caps time-only clusters at the max span', () => {
    const out = clusterPhotos([noGps('a', 0), noGps('b', 2.5 * HOUR), noGps('c', 5 * HOUR), noGps('d', 7 * HOUR)]);
    expect(out).toHaveLength(2);
    expect(out[1].photos.map((p) => p.id)).toEqual(['d']);
  });

  it('returns clusters ordered by start time and handles empty input', () => {
    expect(clusterPhotos([])).toEqual([]);
    const out = clusterPhotos([noGps('n', 0), photo('a', 20 * HOUR)]);
    expect(out.map((c) => c.start)).toEqual([T0, T0 + 20 * HOUR]);
  });
});
