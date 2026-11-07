import type {
  CandidateStatus,
  Dish,
  Meal,
  MealCandidate,
  PriceFeel,
  Rating,
  Venue,
  VenueCandidate,
} from '../core/types';

/** Row shapes of the Supabase tables (snake_case). user_id is filled in by the database. */

export interface VenueRow {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  map_item_id: string | null;
  neighborhood: string;
}
export interface MealRow {
  id: string;
  date: string;
  venue_id: string;
  photo_ids: string[];
  rating: Rating;
  note: string;
  companions: string | null;
  price_feel: number | null;
}
export interface DishRow {
  id: string;
  meal_id: string;
  name: string;
  order_again: boolean;
}
export interface CandidateRow {
  id: string;
  date: string;
  latitude: number | null;
  longitude: number | null;
  photo_ids: string[];
  candidates: VenueCandidate[];
  status: CandidateStatus;
}

export const venueToRow = (v: Venue): VenueRow => ({
  id: v.id,
  name: v.name,
  address: v.address,
  latitude: v.latitude,
  longitude: v.longitude,
  map_item_id: v.mapItemId,
  neighborhood: v.neighborhood,
});
export const rowToVenue = (r: VenueRow): Venue => ({
  id: r.id,
  name: r.name,
  address: r.address,
  latitude: r.latitude,
  longitude: r.longitude,
  mapItemId: r.map_item_id,
  neighborhood: r.neighborhood,
});

export const mealToRow = (m: Meal): MealRow => ({
  id: m.id,
  date: new Date(m.date).toISOString(),
  venue_id: m.venueId,
  photo_ids: m.photoIds,
  rating: m.rating,
  note: m.note,
  companions: m.companions ?? null,
  price_feel: m.priceFeel ?? null,
});
export const rowToMeal = (r: MealRow): Meal => ({
  id: r.id,
  date: Date.parse(r.date),
  venueId: r.venue_id,
  photoIds: r.photo_ids,
  rating: r.rating,
  note: r.note,
  companions: r.companions ?? undefined,
  priceFeel: (r.price_feel ?? undefined) as PriceFeel | undefined,
});

export const dishToRow = (d: Dish): DishRow => ({
  id: d.id,
  meal_id: d.mealId,
  name: d.name,
  order_again: d.orderAgain,
});
export const rowToDish = (r: DishRow): Dish => ({
  id: r.id,
  mealId: r.meal_id,
  name: r.name,
  orderAgain: r.order_again,
});

export const candidateToRow = (c: MealCandidate): CandidateRow => ({
  id: c.id,
  date: new Date(c.date).toISOString(),
  latitude: c.latitude,
  longitude: c.longitude,
  photo_ids: c.photoIds,
  candidates: c.candidates,
  status: c.status,
});
export const rowToCandidate = (r: CandidateRow): MealCandidate => ({
  id: r.id,
  date: Date.parse(r.date),
  latitude: r.latitude,
  longitude: r.longitude,
  photoIds: r.photo_ids,
  candidates: r.candidates,
  status: r.status,
});
