import { describe, expect, it } from 'vitest';
import { buildDemoData } from '../data/seed';
import { NYC_NEIGHBORHOODS } from './neighborhoods';
import { summarizeVenues } from './recommendFilter';
import { dishesToOrderAgain, lovedNearby, oneYearAgo } from './resurface';
import type { Meal } from './types';

const NOW = new Date(2026, 10, 7, 12).getTime();
const DAY = 86_400_000;
const demo = buildDemoData(NOW);
const summaries = summarizeVenues(demo.venues, demo.meals, demo.dishes);

const meal = (id: string, daysFromYearAgo: number): Meal => {
  const d = new Date(NOW);
  d.setFullYear(d.getFullYear() - 1);
  return { id, venueId: 'v', rating: 'good', note: '', photoIds: [], date: d.getTime() + daysFromYearAgo * DAY };
};

describe('oneYearAgo', () => {
  it('finds meals within three days of a year ago, closest first', () => {
    const out = oneYearAgo([meal('a', 2), meal('b', 0), meal('c', -3), meal('far', 10), meal('recent', 200)], NOW);
    expect(out.map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });

  it('excludes meals just outside the window', () => {
    expect(oneYearAgo([meal('x', 4), meal('y', -4)], NOW)).toHaveLength(0);
  });

  it('finds the seeded one-year-ago meals', () => {
    const out = oneYearAgo(demo.meals, NOW);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });
});

describe('lovedNearby', () => {
  it('returns loved venues within the radius, nearest first', () => {
    const wv = NYC_NEIGHBORHOODS.find((n) => n.name === 'West Village')!;
    const out = lovedNearby(summaries, { lat: wv.lat, lon: wv.lon }, null);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((x) => x.summary.rating === 'loved')).toBe(true);
    expect(out[0].summary.venue.name).toBe('Marrow & Ash');
  });

  it('falls back to the neighborhood when there is no location', () => {
    const out = lovedNearby(summaries, null, 'West Village');
    expect(out.map((x) => x.summary.venue.name)).toEqual(['Marrow & Ash']);
  });

  it('returns nothing without a location or neighborhood', () => {
    expect(lovedNearby(summaries, null, null)).toEqual([]);
  });
});

describe('dishesToOrderAgain', () => {
  it('lists flagged dishes once per venue, oldest first', () => {
    const out = dishesToOrderAgain(demo.venues, demo.meals, demo.dishes, 50);
    const keys = out.map((e) => `${e.venue.id}|${e.dish.toLowerCase()}`);
    expect(new Set(keys).size).toBe(keys.length);
    const times = out.map((e) => e.lastOrdered);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(out.some((e) => e.dish === 'Cacio e pepe')).toBe(true);
  });

  it('uses the most recent order date for a repeated dish', () => {
    const out = dishesToOrderAgain(demo.venues, demo.meals, demo.dishes, 50);
    const cacio = out.find((e) => e.dish === 'Cacio e pepe')!;
    const latest = Math.max(
      ...demo.meals
        .filter((m) => m.venueId === cacio.venue.id && demo.dishes.some((d) => d.mealId === m.id && d.name === 'Cacio e pepe' && d.orderAgain))
        .map((m) => m.date),
    );
    expect(cacio.lastOrdered).toBe(latest);
  });

  it('respects the limit', () => {
    expect(dishesToOrderAgain(demo.venues, demo.meals, demo.dishes, 3)).toHaveLength(3);
  });
});
