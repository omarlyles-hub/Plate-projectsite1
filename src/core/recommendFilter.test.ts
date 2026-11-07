import { describe, expect, it } from 'vitest';
import { buildDemoData } from '../data/seed';
import { filterVenues, neighborhoodsInLog, summarizeVenues } from './recommendFilter';
import { NYC_NEIGHBORHOODS } from './neighborhoods';
import type { Dish, Meal, Venue } from './types';

const NOW = Date.UTC(2026, 10, 7, 12);
const demo = buildDemoData(NOW);
const all = summarizeVenues(demo.venues, demo.meals, demo.dishes);

const venue = (id: string, extra: Partial<Venue> = {}): Venue => ({
  id, name: id, address: '', latitude: 40.73, longitude: -74.0, mapItemId: null, neighborhood: 'SoHo', ...extra,
});
const meal = (id: string, venueId: string, rating: Meal['rating'], date = 1, extra: Partial<Meal> = {}): Meal => ({
  id, venueId, rating, date, photoIds: [], note: '', ...extra,
});

describe('summarizeVenues', () => {
  it('has one row per visited venue with aggregated visits and dishes', () => {
    expect(all).toHaveLength(16);
    const marrow = all.find((s) => s.venue.name === 'Marrow & Ash')!;
    expect(marrow.visits).toBe(4);
    expect(marrow.orderAgain).toContain('Cacio e pepe');
    expect(marrow.orderAgain.filter((d) => d === 'Cacio e pepe')).toHaveLength(1);
    expect(marrow.rating).toBe('loved');
  });

  it('averages ratings and rounds to the nearest rating', () => {
    const v = [venue('v')];
    const m = [meal('1', 'v', 'loved'), meal('2', 'v', 'meh')];
    expect(summarizeVenues(v, m, [])[0].rating).toBe('good'); // (3 + 1) / 2 = 2
  });

  it('skips venues with no meals and uses the latest recorded price', () => {
    const v = [venue('v'), venue('empty')];
    const m = [meal('1', 'v', 'good', 1, { priceFeel: 2 }), meal('2', 'v', 'good', 5)];
    const out = summarizeVenues(v, m, []);
    expect(out).toHaveLength(1);
    expect(out[0].priceFeel).toBe(2);
  });

  it('keeps dish names case-insensitively distinct', () => {
    const d: Dish[] = [
      { id: '1', mealId: '1', name: 'Pasta', orderAgain: true },
      { id: '2', mealId: '2', name: 'pasta ', orderAgain: true },
    ];
    const out = summarizeVenues([venue('v')], [meal('1', 'v', 'good'), meal('2', 'v', 'good')], d);
    expect(out[0].orderAgain).toEqual(['Pasta']);
  });
});

describe('filterVenues', () => {
  it('filters by neighborhood', () => {
    const out = filterVenues(all, { neighborhood: 'West Village' });
    expect(out.map((s) => s.venue.name)).toEqual(['Marrow & Ash']);
  });

  it('filters by minimum rating', () => {
    const loved = filterVenues(all, { minRating: 'loved' });
    expect(loved.length).toBeGreaterThan(0);
    expect(loved.every((s) => s.rating === 'loved')).toBe(true);
    const good = filterVenues(all, { minRating: 'good' });
    expect(good.length).toBeGreaterThan(loved.length);
    expect(good.some((s) => s.rating === 'meh')).toBe(false);
  });

  it('filters by price feel and excludes unpriced venues when active', () => {
    const v = [venue('a'), venue('b'), venue('c')];
    const m = [
      meal('1', 'a', 'good', 1, { priceFeel: 2 }),
      meal('2', 'b', 'good', 1, { priceFeel: 4 }),
      meal('3', 'c', 'good', 1),
    ];
    const s = summarizeVenues(v, m, []);
    expect(filterVenues(s, { prices: [2] }).map((x) => x.venue.id)).toEqual(['a']);
    expect(filterVenues(s, { prices: [2, 4] })).toHaveLength(2);
    expect(filterVenues(s, { prices: [] })).toHaveLength(3);
  });

  it('applies a near-me radius and sorts nearest first within a rating', () => {
    const wv = NYC_NEIGHBORHOODS.find((n) => n.name === 'West Village')!;
    const near = filterVenues(all, { near: { lat: wv.lat, lon: wv.lon, radiusM: 1500 } });
    expect(near.length).toBeGreaterThan(0);
    expect(near.every((s) => (s.distanceM ?? Infinity) <= 1500)).toBe(true);
    expect(near.some((s) => s.venue.neighborhood === 'Flushing')).toBe(false);
    const lovedOnly = near.filter((s) => s.rating === 'loved');
    const dists = lovedOnly.map((s) => s.distanceM!);
    expect(dists).toEqual([...dists].sort((a, b) => a - b));
  });

  it('leaves venues with no location out of near-me results but keeps them elsewhere', () => {
    const v = [venue('placed'), venue('nowhere', { latitude: null, longitude: null, neighborhood: '' })];
    const m = [meal('1', 'placed', 'loved'), meal('2', 'nowhere', 'loved')];
    const s = summarizeVenues(v, m, []);
    const near = filterVenues(s, { near: { lat: 40.73, lon: -74.0, radiusM: 1500 } });
    expect(near.map((x) => x.venue.id)).toEqual(['placed']);
    expect(filterVenues(s, {}).map((x) => x.venue.id).sort()).toEqual(['nowhere', 'placed']);
  });

  it('combines filters', () => {
    const out = filterVenues(all, { neighborhood: 'West Village', minRating: 'loved', prices: [3] });
    expect(out).toHaveLength(1);
    expect(filterVenues(all, { neighborhood: 'West Village', prices: [1] })).toHaveLength(0);
  });

  it('ranks loved above good', () => {
    const out = filterVenues(all, {});
    const ranks = out.map((s) => ({ loved: 3, good: 2, meh: 1 })[s.rating]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));
  });
});

describe('neighborhoodsInLog', () => {
  it('lists neighborhoods in the log', () => {
    const hoods = neighborhoodsInLog(all);
    expect(hoods).toContain('West Village');
    expect(new Set(hoods).size).toBe(hoods.length);
  });
});
