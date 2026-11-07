import { describe, expect, it } from 'vitest';
import type { Dish, Meal, MealCandidate, Venue } from '../core/types';
import { buildDemoData } from './seed';
import { HybridRepository } from './hybridRepo';
import { FakeCloud, MemoryStore } from './testing';
import {
  candidateToRow,
  dishToRow,
  mealToRow,
  rowToCandidate,
  rowToDish,
  rowToMeal,
  rowToVenue,
  venueToRow,
} from './rows';

const venue = (id: string, extra: Partial<Venue> = {}): Venue => ({
  id, name: id, address: '1 Main', latitude: 40.73, longitude: -74, mapItemId: 'node/1', neighborhood: 'SoHo', ...extra,
});
const meal = (id: string, venueId: string, extra: Partial<Meal> = {}): Meal => ({
  id, venueId, date: Date.UTC(2026, 5, 1, 19), photoIds: ['p1'], rating: 'loved', note: 'n', ...extra,
});
const dish = (id: string, mealId: string): Dish => ({ id, mealId, name: 'Pasta', orderAgain: true });
const card = (id: string): MealCandidate => ({
  id, date: Date.UTC(2026, 5, 2), latitude: 40.7, longitude: -74, photoIds: ['p'], status: 'pending',
  candidates: [{ name: 'X', address: '', latitude: 40.7, longitude: -74, mapItemId: null, neighborhood: 'SoHo', distanceM: 5 }],
});

function setup() {
  const local = new MemoryStore();
  const cloud = new FakeCloud();
  const errors: (string | null)[] = [];
  const repo = new HybridRepository(local, cloud, (m) => errors.push(m));
  return { local, cloud, repo, errors };
}

describe('row mappers', () => {
  it('round-trips every record type', () => {
    const v = venue('v1');
    const m = meal('m1', 'v1', { companions: 'Dev', priceFeel: 3 });
    const d = dish('d1', 'm1');
    const c = card('c1');
    expect(rowToVenue(venueToRow(v))).toEqual(v);
    expect(rowToMeal(mealToRow(m))).toEqual(m);
    expect(rowToDish(dishToRow(d))).toEqual(d);
    expect(rowToCandidate(candidateToRow(c))).toEqual(c);
  });

  it('maps absent optional meal fields to null and back to undefined', () => {
    const row = mealToRow(meal('m1', 'v1'));
    expect(row.companions).toBeNull();
    expect(row.price_feel).toBeNull();
    const back = rowToMeal(row);
    expect(back.companions).toBeUndefined();
    expect(back.priceFeel).toBeUndefined();
  });

  it('stores dates as ISO strings and never leaks user_id', () => {
    const row = mealToRow(meal('m1', 'v1'));
    expect(row.date).toBe('2026-06-01T19:00:00.000Z');
    expect(Object.keys(row)).not.toContain('user_id');
  });
});

describe('HybridRepository routing', () => {
  it('sends real data to the cloud and not to the device', async () => {
    const { local, cloud, repo } = setup();
    await repo.saveVenue(venue('v1'));
    await repo.saveMeal(meal('m1', 'v1'));
    await repo.replaceDishes('m1', [dish('d1', 'm1')]);
    expect(cloud.venues.size).toBe(1);
    expect(cloud.meals.size).toBe(1);
    expect(cloud.dishes.size).toBe(1);
    expect(local.meals.size).toBe(0);
  });

  it('keeps demo data on the device only', async () => {
    const { local, cloud, repo } = setup();
    const demo = buildDemoData(Date.UTC(2026, 10, 7));
    await repo.putAll({ venues: demo.venues, meals: demo.meals, dishes: demo.dishes });
    await repo.saveCandidates(demo.candidates);
    await repo.saveMeal({ ...demo.meals[0], note: 'edited' });
    expect(local.meals.size).toBe(25);
    expect(cloud.meals.size).toBe(0);
    expect(cloud.candidates.size).toBe(0);
    expect(cloud.venues.size).toBe(0);
  });

  it('merges device and cloud data on read, cloud winning on id clashes', async () => {
    const { local, cloud, repo } = setup();
    await local.saveMeal(meal('a', 'v1', { note: 'local' }));
    await local.saveMeal(meal('shared', 'v1', { note: 'local' }));
    cloud.meals.set('shared', meal('shared', 'v1', { note: 'cloud' }));
    cloud.meals.set('b', meal('b', 'v1'));
    const all = await repo.listMeals();
    expect(all.map((m) => m.id).sort()).toEqual(['a', 'b', 'shared']);
    expect(all.find((m) => m.id === 'shared')?.note).toBe('cloud');
  });

  it('falls back to device data and reports the error when the cloud is down', async () => {
    const { local, cloud, repo, errors } = setup();
    await local.saveMeal(meal('a', 'v1'));
    cloud.failWith = 'relation "public.meals" does not exist';
    const out = await repo.listMeals();
    expect(out.map((m) => m.id)).toEqual(['a']);
    expect(errors.at(-1)).toContain('does not exist');
  });

  it('propagates cloud write failures so the UI can show them', async () => {
    const { cloud, repo } = setup();
    cloud.failWith = 'permission denied';
    await expect(repo.saveMeal(meal('m1', 'v1'))).rejects.toThrow('permission denied');
  });

  it('updates review-queue status on both sides for a non-demo card', async () => {
    const { local, cloud, repo } = setup();
    await local.saveCandidates([card('c1')]);
    cloud.candidates.set('c1', card('c1'));
    await repo.setCandidateStatus('c1', 'confirmed');
    expect(local.candidates.get('c1')?.status).toBe('confirmed');
    expect(cloud.candidates.get('c1')?.status).toBe('confirmed');
  });

  it('deletes a real meal from both sides but a demo meal only locally', async () => {
    const { local, cloud, repo } = setup();
    await local.saveMeal(meal('m1', 'v1'));
    cloud.meals.set('m1', meal('m1', 'v1'));
    await repo.deleteMeal('m1');
    expect(local.meals.size).toBe(0);
    expect(cloud.meals.size).toBe(0);
  });

  it('keeps photos, scan history and settings on the device', async () => {
    const { local, repo } = setup();
    await repo.savePhoto('p', new Blob(['x']));
    await repo.markScanned(['f']);
    await repo.saveSettings({ demoMode: true, venueLookup: false, privacyAccepted: true });
    expect(local.photos.has('p')).toBe(true);
    expect(await repo.hasScanned('f')).toBe(true);
    expect((await repo.getSettings()).demoMode).toBe(true);
  });

  it('erases device and cloud data on clearAll', async () => {
    const { local, cloud, repo } = setup();
    await local.saveMeal(meal('a', 'v1'));
    cloud.meals.set('b', meal('b', 'v1'));
    await repo.clearAll();
    expect(local.meals.size).toBe(0);
    expect(cloud.meals.size).toBe(0);
  });
});

describe('HybridRepository.uploadLocal', () => {
  async function withLocalData() {
    const s = setup();
    await s.local.saveVenue(venue('v1'));
    await s.local.saveMeal(meal('m1', 'v1'));
    await s.local.replaceDishes('m1', [dish('d1', 'm1')]);
    await s.local.saveCandidates([card('c1')]);
    // plus demo data that must stay put
    const demo = buildDemoData(Date.UTC(2026, 10, 7));
    await s.local.putAll({ venues: demo.venues, meals: demo.meals, dishes: demo.dishes });
    return s;
  }

  it('counts only real on-device meals and queue cards as pending', async () => {
    const { repo } = await withLocalData();
    expect(await repo.pendingLocalCount()).toBe(2); // 1 meal + 1 card, demo ignored
  });

  it('moves real data to the cloud, then removes local copies, leaving demo data', async () => {
    const { local, cloud, repo } = await withLocalData();
    const moved = await repo.uploadLocal();
    expect(moved).toBe(1);
    expect(cloud.venues.has('v1')).toBe(true);
    expect(cloud.meals.has('m1')).toBe(true);
    expect(cloud.dishes.has('d1')).toBe(true);
    expect(cloud.candidates.has('c1')).toBe(true);
    expect(local.meals.has('m1')).toBe(false);
    expect(local.venues.has('v1')).toBe(false);
    expect(local.candidates.has('c1')).toBe(false);
    expect(local.meals.size).toBe(25); // demo untouched
    expect(cloud.meals.size).toBe(1);
  });

  it('keeps local copies if the upload fails', async () => {
    const { local, cloud, repo } = await withLocalData();
    cloud.failWith = 'network error';
    await expect(repo.uploadLocal()).rejects.toThrow('network error');
    expect(local.meals.has('m1')).toBe(true);
    expect(local.venues.has('v1')).toBe(true);
  });
});
