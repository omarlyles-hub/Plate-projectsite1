import { haversineM } from './geo';
import type { VenueSummary } from './recommendFilter';
import type { Dish, Meal, Venue } from './types';

const DAY = 86_400_000;

/** Meals within `windowDays` of exactly one year before `now`, closest first. */
export function oneYearAgo(meals: readonly Meal[], now: number, windowDays = 3): Meal[] {
  const target = new Date(now);
  target.setFullYear(target.getFullYear() - 1);
  const t = target.getTime();
  return meals
    .filter((m) => Math.abs(m.date - t) <= windowDays * DAY + DAY / 2)
    .sort((a, b) => Math.abs(a.date - t) - Math.abs(b.date - t));
}

export interface NearbyLoved {
  summary: VenueSummary;
  distanceM?: number;
}

/**
 * Venues rated "loved" near a point. Without a location, falls back to the given neighborhood
 * (usually that of the most recent meal).
 */
export function lovedNearby(
  summaries: readonly VenueSummary[],
  here: { lat: number; lon: number } | null,
  fallbackNeighborhood: string | null,
  radiusM = 1500,
  limit = 5,
): NearbyLoved[] {
  const loved = summaries.filter((s) => s.rating === 'loved');
  if (here) {
    return loved
      .map((summary) => ({
        summary,
        distanceM: haversineM(here.lat, here.lon, summary.venue.latitude, summary.venue.longitude),
      }))
      .filter((x) => x.distanceM <= radiusM)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, limit);
  }
  if (!fallbackNeighborhood) return [];
  return loved
    .filter((s) => s.venue.neighborhood === fallbackNeighborhood)
    .sort((a, b) => b.visits - a.visits)
    .slice(0, limit)
    .map((summary) => ({ summary }));
}

export interface OrderAgainEntry {
  dish: string;
  venue: Venue;
  lastOrdered: number;
}

/**
 * Dishes flagged "order again", one per venue+dish, longest-since-ordered first so the
 * list nudges you toward things you haven't had in a while.
 */
export function dishesToOrderAgain(
  venues: readonly Venue[],
  meals: readonly Meal[],
  dishes: readonly Dish[],
  limit = 8,
): OrderAgainEntry[] {
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const mealById = new Map(meals.map((m) => [m.id, m]));
  const latest = new Map<string, OrderAgainEntry>();

  for (const d of dishes) {
    if (!d.orderAgain) continue;
    const meal = mealById.get(d.mealId);
    const venue = meal && venueById.get(meal.venueId);
    if (!meal || !venue) continue;
    const key = `${venue.id}|${d.name.trim().toLowerCase()}`;
    const prev = latest.get(key);
    if (!prev || meal.date > prev.lastOrdered) {
      latest.set(key, { dish: d.name.trim(), venue, lastOrdered: meal.date });
    }
  }
  return [...latest.values()].sort((a, b) => a.lastOrdered - b.lastOrdered).slice(0, limit);
}
