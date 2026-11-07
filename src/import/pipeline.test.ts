import { describe, expect, it } from 'vitest';
import type { MealCandidate, VenueCandidate } from '../core/types';
import type { FoodClassifier } from './foodClassifier';
import { fingerprint, runImport, type ImportDeps } from './pipeline';
import type { PhotoMeta } from './readExif';

const NOW = Date.UTC(2026, 10, 7, 12, 0, 0);
const DAY = 86_400_000;
const LAT = 40.7358;
const LON = -74.0036;

const file = (name: string) => new File(['x'], name, { lastModified: 1 });

interface Fixture {
  meta: Record<string, PhotoMeta>;
  food: Record<string, number>;
}

function setup(fx: Fixture, overrides: Partial<ImportDeps> = {}) {
  const saved: MealCandidate[] = [];
  const photos = new Map<string, Blob>();
  const scanned = new Set<string>();
  let idCounter = 0;
  const classifier: FoodClassifier = {
    classify: async (blob) => {
      const name = (blob as unknown as { _name: string })._name;
      return fx.food[name] ?? 0;
    },
    dispose: () => undefined,
  };
  const deps: ImportDeps = {
    repo: {
      hasScanned: async (fp) => scanned.has(fp),
      markScanned: async (fps) => fps.forEach((f) => scanned.add(f)),
      savePhoto: async (id, blob) => void photos.set(id, blob),
      saveCandidates: async (items) => void saved.push(...items),
      listVenues: async () => [],
    },
    readMeta: async (f) => fx.meta[f.name] ?? { lat: null, lon: null, date: NOW - 2 * DAY, dateSource: 'file' as const },
    makeThumbnail: async (f) => Object.assign(new Blob(['t']), { _name: f.name }),
    classifier,
    venueSource: {
      search: async (): Promise<VenueCandidate[]> => [
        {
          name: 'Via Carota',
          address: '51 Grove St',
          latitude: LAT,
          longitude: LON,
          mapItemId: 'node/1',
          neighborhood: 'West Village',
          distanceM: 10,
        },
      ],
    },
    lookupEnabled: true,
    now: () => NOW,
    newId: () => `id-${++idCounter}`,
    ...overrides,
  };
  return { deps, saved, photos, scanned };
}

describe('runImport', () => {
  it('keeps recent food photos and builds one candidate per meal', async () => {
    const { deps, saved, photos } = setup({
      meta: {
        'a.jpg': { lat: LAT, lon: LON, date: NOW - 10 * DAY, dateSource: 'exif' },
        'b.jpg': { lat: LAT, lon: LON, date: NOW - 10 * DAY + 600_000, dateSource: 'exif' },
        'old.jpg': { lat: LAT, lon: LON, date: NOW - 400 * DAY, dateSource: 'exif' },
        'selfie.jpg': { lat: LAT, lon: LON, date: NOW - 5 * DAY, dateSource: 'exif' },
      },
      food: { 'a.jpg': 0.9, 'b.jpg': 0.8, 'old.jpg': 0.9, 'selfie.jpg': 0.1 },
    });
    const files = ['a.jpg', 'b.jpg', 'old.jpg', 'selfie.jpg'].map(file);
    const summary = await runImport(files, deps);

    expect(summary.kept).toBe(2);
    expect(summary.skippedOutsideWindow).toBe(1);
    expect(summary.skippedNotFood).toBe(1);
    expect(summary.candidates).toBe(1);
    expect(photos.size).toBe(2);
    expect(saved).toHaveLength(1);
    expect(saved[0].photoIds).toHaveLength(2);
    expect(saved[0].status).toBe('pending');
    expect(saved[0].candidates[0].name).toBe('Via Carota');
  });

  it('accepts photos without GPS: one taken during a located meal joins it', async () => {
    const { deps, saved, photos } = setup({
      meta: {
        'a.jpg': { lat: LAT, lon: LON, date: NOW - 10 * DAY, dateSource: 'exif' },
        'nogps.jpg': { lat: null, lon: null, date: NOW - 10 * DAY + 1_200_000, dateSource: 'exif' },
      },
      food: { 'a.jpg': 0.9, 'nogps.jpg': 0.9 },
    });
    const summary = await runImport(['a.jpg', 'nogps.jpg'].map(file), deps);
    expect(summary.kept).toBe(2);
    expect(summary.withoutLocation).toBe(1);
    expect(photos.size).toBe(2);
    expect(saved).toHaveLength(1);
    expect(saved[0].photoIds).toHaveLength(2);
    expect(saved[0].latitude).toBe(LAT);
    expect(saved[0].candidates[0].name).toBe('Via Carota');
  });

  it('puts photos with no GPS and no nearby located meal on a time-only card that needs a typed name', async () => {
    let searches = 0;
    const { deps, saved } = setup({
      meta: {
        'x.jpg': { lat: null, lon: null, date: NOW - 8 * DAY, dateSource: 'exif' },
        'y.jpg': { lat: null, lon: null, date: NOW - 8 * DAY + 1_800_000, dateSource: 'exif' },
        'z.jpg': { lat: null, lon: null, date: NOW - 3 * DAY, dateSource: 'exif' },
      },
      food: { 'x.jpg': 0.9, 'y.jpg': 0.9, 'z.jpg': 0.9 },
    });
    deps.venueSource = {
      search: async () => {
        searches += 1;
        return [];
      },
    };
    const summary = await runImport(['x.jpg', 'y.jpg', 'z.jpg'].map(file), deps);
    expect(summary.withoutLocation).toBe(3);
    expect(summary.candidates).toBe(2); // x+y together, z alone
    expect(saved.every((c) => c.latitude === null && c.longitude === null)).toBe(true);
    expect(saved.every((c) => c.candidates.length === 0)).toBe(true);
    expect(searches).toBe(0); // nothing to look up without a location
    expect(summary.lookupFailures).toBe(0);
  });

  it('counts photos that had no capture date and fell back to the file date', async () => {
    const { deps } = setup({
      meta: { 'a.jpg': { lat: null, lon: null, date: NOW - DAY, dateSource: 'file' } },
      food: { 'a.jpg': 0.9 },
    });
    const summary = await runImport([file('a.jpg')], deps);
    expect(summary.usedFileDate).toBe(1);
    expect(summary.kept).toBe(1);
  });

  it('splits photos taken hours apart into separate meals', async () => {
    const { deps, saved } = setup({
      meta: {
        'lunch.jpg': { lat: LAT, lon: LON, date: NOW - 10 * DAY, dateSource: 'exif' },
        'dinner.jpg': { lat: LAT, lon: LON, date: NOW - 10 * DAY + 8 * 3_600_000, dateSource: 'exif' },
      },
      food: { 'lunch.jpg': 0.9, 'dinner.jpg': 0.9 },
    });
    await runImport(['lunch.jpg', 'dinner.jpg'].map(file), deps);
    expect(saved).toHaveLength(2);
  });

  it('skips files it has already scanned', async () => {
    const { deps, scanned } = setup({
      meta: { 'a.jpg': { lat: LAT, lon: LON, date: NOW - DAY, dateSource: 'exif' } },
      food: { 'a.jpg': 0.9 },
    });
    const f = file('a.jpg');
    scanned.add(fingerprint(f));
    const summary = await runImport([f], deps);
    expect(summary.skippedAlreadyScanned).toBe(1);
    expect(summary.kept).toBe(0);
  });

  it('falls back to a manual-entry candidate when venue lookup is off', async () => {
    const { deps, saved } = setup(
      {
        meta: { 'a.jpg': { lat: LAT, lon: LON, date: NOW - DAY, dateSource: 'exif' } },
        food: { 'a.jpg': 0.9 },
      },
      { lookupEnabled: false },
    );
    await runImport([file('a.jpg')], deps);
    expect(saved[0].candidates[0].needsManualName).toBe(true);
  });

  it('counts meals whose venue lookup failed', async () => {
    const { deps, saved } = setup({
      meta: { 'a.jpg': { lat: LAT, lon: LON, date: NOW - DAY, dateSource: 'exif' } },
      food: { 'a.jpg': 0.9 },
    });
    deps.venueSource = {
      search: async () => {
        throw new Error('unreachable');
      },
    };
    const summary = await runImport([file('a.jpg')], deps);
    expect(summary.lookupFailures).toBe(1);
    expect(saved[0].candidates[0].needsManualName).toBe(true);
  });

  it('stops after repeated classifier failures but still reports what it kept', async () => {
    const { deps } = setup({
      meta: Object.fromEntries(
        ['1', '2', '3', '4'].map((n) => [`${n}.jpg`, { lat: LAT, lon: LON, date: NOW - DAY, dateSource: 'exif' }]),
      ),
      food: {},
    });
    deps.classifier = {
      classify: async () => {
        throw new Error('model failed to load');
      },
      dispose: () => undefined,
    };
    const summary = await runImport(['1', '2', '3', '4'].map((n) => file(`${n}.jpg`)), deps);
    expect(summary.stoppedReason).toBe('classifier-failed');
    expect(summary.kept).toBe(0);
  });

  it('can be cancelled', async () => {
    const { deps } = setup({ meta: {}, food: {} });
    const ctrl = new AbortController();
    ctrl.abort();
    const summary = await runImport([file('a.jpg')], deps, undefined, ctrl.signal);
    expect(summary.stoppedReason).toBe('cancelled');
  });
});
