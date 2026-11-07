/** Shared data types. All records are plain JSON-serialisable values with string UUID ids,
 *  so a future Supabase-backed Repository can map them straight onto Postgres tables. */

export type Rating = 'loved' | 'good' | 'meh';
export const RATING_LABEL: Record<Rating, string> = {
  loved: 'Loved it',
  good: 'Good',
  meh: 'Meh',
};
/** Numeric rank used for "minimum rating" filters. */
export const RATING_RANK: Record<Rating, number> = { meh: 1, good: 2, loved: 3 };

/** 1 = $, 4 = $$$$ */
export type PriceFeel = 1 | 2 | 3 | 4;

export interface Venue {
  id: string;
  name: string;
  address: string;
  /** Null for a venue typed by hand from photos that carried no location. */
  latitude: number | null;
  longitude: number | null;
  /** OpenStreetMap element, e.g. "node/123456". Null for manually named venues. */
  mapItemId: string | null;
  neighborhood: string;
  isDemo?: boolean;
}

export interface Meal {
  id: string;
  /** Epoch milliseconds. */
  date: number;
  venueId: string;
  /** Ids into the photo-thumbnail store (or "demo:*" ids that render as generated tiles). */
  photoIds: string[];
  rating: Rating;
  note: string;
  companions?: string;
  priceFeel?: PriceFeel;
  isDemo?: boolean;
}

export interface Dish {
  id: string;
  name: string;
  mealId: string;
  orderAgain: boolean;
}

/** A venue proposal for a meal cluster. */
export interface VenueCandidate {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  mapItemId: string | null;
  neighborhood: string;
  distanceM: number;
  /** Set when this candidate is an existing venue from the user's own log. */
  knownVenueId?: string;
  /** Synthetic placeholder: the user must type a real name in triage. */
  needsManualName?: boolean;
}

export type CandidateStatus = 'pending' | 'skipped' | 'dismissed' | 'confirmed';

/** A persisted triage-queue item: one clustered meal awaiting review. */
export interface MealCandidate {
  id: string;
  date: number;
  /** Null when the photos had no GPS; such cards have no venue candidates and need a typed name. */
  latitude: number | null;
  longitude: number | null;
  photoIds: string[];
  candidates: VenueCandidate[];
  status: CandidateStatus;
}

export interface PhotoRecord {
  id: string;
  /** Downscaled thumbnail. Originals are never stored. */
  blob: Blob;
}

export interface Settings {
  demoMode: boolean;
  /** When false, no Overpass requests are made; venues are typed by hand. */
  venueLookup: boolean;
  /** True once the user has accepted the pre-import privacy explanation. */
  privacyAccepted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  demoMode: false,
  venueLookup: true,
  privacyAccepted: false,
};
