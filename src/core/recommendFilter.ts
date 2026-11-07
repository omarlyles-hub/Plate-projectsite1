import { distanceOrInfinity } from './geo';
import { RATING_RANK, type Dish, type Meal, type PriceFeel, type Rating, type Venue } from './types';

export interface VenueSummary {
  venue: Venue;
  visits: number;
  lastVisit: number;
  /** Mean of all visit ratings, rounded to the nearest rating. */
  rating: Rating;
  /** The price feel recorded on the most recent visit that has one. */
  priceFeel?: PriceFeel;
  /** Distinct dishes flagged "order again", across every visit. */
  orderAgain: string[];
  /** Distinct dishes ever logged. */
  allDishes: string[];
  /** Set by filterVenues when a location is given. */
  distanceM?: number;
}

const BY_RANK: Rating[] = ['meh', 'good', 'loved'];

function distinct(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const n of names) {
    const key = n.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(n.trim());
  }
  return out;
}

/** Collapses meals and dishes into one row per venue, newest visit first within each venue. */
export function summarizeVenues(
  venues: readonly Venue[],
  meals: readonly Meal[],
  dishes: readonly Dish[],
): VenueSummary[] {
  const dishesByMeal = new Map<string, Dish[]>();
  for (const d of dishes) {
    const list = dishesByMeal.get(d.mealId);
    if (list) list.push(d);
    else dishesByMeal.set(d.mealId, [d]);
  }

  const out: VenueSummary[] = [];
  for (const venue of venues) {
    const visits = meals.filter((m) => m.venueId === venue.id).sort((a, b) => b.date - a.date);
    if (visits.length === 0) continue;
    const ranks = visits.map((m) => RATING_RANK[m.rating]);
    const mean = ranks.reduce((a, b) => a + b, 0) / ranks.length;
    const visitDishes = visits.flatMap((m) => dishesByMeal.get(m.id) ?? []);
    out.push({
      venue,
      visits: visits.length,
      lastVisit: visits[0].date,
      rating: BY_RANK[Math.min(2, Math.max(0, Math.round(mean) - 1))],
      priceFeel: visits.find((m) => m.priceFeel !== undefined)?.priceFeel,
      orderAgain: distinct(visitDishes.filter((d) => d.orderAgain).map((d) => d.name)),
      allDishes: distinct(visitDishes.map((d) => d.name)),
    });
  }
  return out;
}

export interface RecommendQuery {
  /** Exact neighborhood name, or null/undefined for any. */
  neighborhood?: string | null;
  /** When set, only venues within radiusM of this point, sorted by distance within a rating. */
  near?: { lat: number; lon: number; radiusM: number } | null;
  minRating?: Rating | null;
  /** When non-empty, only venues whose price feel is one of these. */
  prices?: readonly PriceFeel[];
}

/** Filters the user's own venues. Best rating first, then nearest (if located), then most visited. */
export function filterVenues(summaries: readonly VenueSummary[], q: RecommendQuery): VenueSummary[] {
  const prices = q.prices ?? [];
  const results: VenueSummary[] = [];

  for (const s of summaries) {
    if (q.neighborhood && s.venue.neighborhood !== q.neighborhood) continue;
    if (q.minRating && RATING_RANK[s.rating] < RATING_RANK[q.minRating]) continue;
    if (prices.length > 0 && (s.priceFeel === undefined || !prices.includes(s.priceFeel))) continue;

    let distanceM: number | undefined;
    if (q.near) {
      // Venues without a location can't be "near" anyone.
      distanceM = distanceOrInfinity(q.near.lat, q.near.lon, s.venue.latitude, s.venue.longitude);
      if (distanceM > q.near.radiusM) continue;
    }
    results.push({ ...s, distanceM });
  }

  return results.sort(
    (a, b) =>
      RATING_RANK[b.rating] - RATING_RANK[a.rating] ||
      (a.distanceM ?? 0) - (b.distanceM ?? 0) ||
      b.visits - a.visits ||
      b.lastVisit - a.lastVisit,
  );
}

/** Neighborhoods present in the log, most-logged first. */
export function neighborhoodsInLog(summaries: readonly VenueSummary[]): string[] {
  const counts = new Map<string, number>();
  for (const s of summaries) {
    if (!s.venue.neighborhood) continue;
    counts.set(s.venue.neighborhood, (counts.get(s.venue.neighborhood) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
}
