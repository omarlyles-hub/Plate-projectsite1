import { describe, expect, it } from 'vitest';
import type { Dish, Meal, MealCandidate, Venue, VenueCandidate } from '../core/types';
import { buildDemoData, DEMO_MEAL_COUNT } from './seed';
import { confirmCandidate } from './confirmMeal';

const LAT = 40.7358;
const LON = -74.0036;

function fakeRepo(initialVenues: Venue[] = []) {
  const venues = [...initialVenues];
  const meals: Meal[] = [];
  const dishes: Dish[] = [];
  const statuses: Record<string, string> = {};
  return {
    venues,
    meals,
    dishes,
    statuses,
    repo: {
      listVenues: async () => venues,
      saveVenue: async (v: Venue) => void venues.push(v),
      saveMeal: async (m: Meal) => void meals.push(m),
      replaceDishes: async (_id: string, d: Dish[]) => void dishes.push(...d),
      setCandidateStatus: async (id: string, s: string) => void (statuses[id] = s),
    },
  };
}

const card: MealCandidate = {
  id: 'card-1',
  date: Date.UTC(2026, 5, 1, 19),
  latitude: LAT,
  longitude: LON,
  photoIds: ['p1', 'p2'],
  candidates: [],
  status: 'pending',
};

const cand = (over: Partial<VenueCandidate> = {}): VenueCandidate => ({
  name: 'Via Carota',
  address: '51 Grove St',
  latitude: LAT,
  longitude: LON,
  mapItemId: 'node/1',
  neighborhood: 'West Village',
  distanceM: 10,
  ...over,
});

let n = 0;
const ids = () => `id-${++n}`;

describe('confirmCandidate', () => {
  it('creates a venue, meal and dishes and marks the card confirmed', async () => {
    const f = fakeRepo();
    const mealId = await confirmCandidate(
      f.repo,
      card,
      { kind: 'candidate', candidate: cand() },
      {
        rating: 'loved',
        note: ' great ',
        dishes: [
          { name: ' Cacio e pepe ', orderAgain: true },
          { name: '  ', orderAgain: false },
        ],
      },
      ids,
    );
    expect(f.venues).toHaveLength(1);
    expect(f.meals[0].id).toBe(mealId);
    expect(f.meals[0].note).toBe('great');
    expect(f.meals[0].photoIds).toEqual(['p1', 'p2']);
    expect(f.dishes.map((d) => d.name)).toEqual(['Cacio e pepe']);
    expect(f.statuses['card-1']).toBe('confirmed');
  });

  it('reuses an existing venue by map id so visits share a page', async () => {
    const existing: Venue = {
      id: 'v1', name: 'Via Carota', address: '', latitude: LAT, longitude: LON,
      mapItemId: 'node/1', neighborhood: 'West Village',
    };
    const f = fakeRepo([existing]);
    await confirmCandidate(f.repo, card, { kind: 'candidate', candidate: cand() }, { rating: 'good', note: '', dishes: [] }, ids);
    expect(f.venues).toHaveLength(1);
    expect(f.meals[0].venueId).toBe('v1');
  });

  it('reuses a known venue by name when typed manually near an existing one', async () => {
    const existing: Venue = {
      id: 'v1', name: 'Via Carota', address: '', latitude: LAT, longitude: LON,
      mapItemId: null, neighborhood: 'West Village',
    };
    const f = fakeRepo([existing]);
    await confirmCandidate(f.repo, card, { kind: 'manual', name: ' via carota ' }, { rating: 'meh', note: '', dishes: [] }, ids);
    expect(f.venues).toHaveLength(1);
    expect(f.meals[0].venueId).toBe('v1');
  });

  it('creates a manual venue with a derived neighborhood', async () => {
    const f = fakeRepo();
    await confirmCandidate(f.repo, card, { kind: 'manual', name: 'Corner Spot' }, { rating: 'good', note: '', dishes: [] }, ids);
    expect(f.venues[0].name).toBe('Corner Spot');
    expect(f.venues[0].neighborhood).toBe('West Village');
    expect(f.venues[0].mapItemId).toBeNull();
  });

  it('saves a venue with no location when the photos had no GPS', async () => {
    const f = fakeRepo();
    const unlocated: MealCandidate = { ...card, latitude: null, longitude: null, candidates: [] };
    await confirmCandidate(f.repo, unlocated, { kind: 'manual', name: 'Corner Spot' }, { rating: 'good', note: '', dishes: [] }, ids);
    expect(f.venues[0].latitude).toBeNull();
    expect(f.venues[0].longitude).toBeNull();
    expect(f.venues[0].neighborhood).toBe('');
  });

  it('reuses a venue by name when either side has no location', async () => {
    const located: Venue = {
      id: 'v1', name: 'Corner Spot', address: '', latitude: LAT, longitude: LON,
      mapItemId: null, neighborhood: 'West Village',
    };
    const f = fakeRepo([located]);
    const unlocated: MealCandidate = { ...card, latitude: null, longitude: null, candidates: [] };
    await confirmCandidate(f.repo, unlocated, { kind: 'manual', name: 'corner spot' }, { rating: 'good', note: '', dishes: [] }, ids);
    expect(f.venues).toHaveLength(1);
    expect(f.meals[0].venueId).toBe('v1');
  });

  it('rejects an empty venue name', async () => {
    const f = fakeRepo();
    await expect(
      confirmCandidate(f.repo, card, { kind: 'manual', name: '   ' }, { rating: 'good', note: '', dishes: [] }, ids),
    ).rejects.toThrow();
  });
});

describe('demo data', () => {
  it('has 25 meals across many neighborhoods, all with valid venue refs', () => {
    const d = buildDemoData(Date.UTC(2026, 10, 7));
    expect(DEMO_MEAL_COUNT).toBe(25);
    expect(d.meals).toHaveLength(25);
    const ids = new Set(d.venues.map((v) => v.id));
    expect(d.meals.every((m) => ids.has(m.venueId))).toBe(true);
    expect(new Set(d.venues.map((v) => v.neighborhood)).size).toBeGreaterThanOrEqual(12);
    expect(d.candidates.length).toBeGreaterThan(0);
  });
});
