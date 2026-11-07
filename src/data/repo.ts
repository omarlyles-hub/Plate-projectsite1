import type {
  CandidateStatus,
  Dish,
  Meal,
  MealCandidate,
  Settings,
  Venue,
} from '../core/types';

/**
 * Persistence contract. UI and pipeline code depend only on this interface, so the
 * IndexedDB implementation can later be swapped for a Supabase-backed one.
 */
export interface Repository {
  listVenues(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | undefined>;
  saveVenue(venue: Venue): Promise<void>;

  listMeals(): Promise<Meal[]>;
  getMeal(id: string): Promise<Meal | undefined>;
  saveMeal(meal: Meal): Promise<void>;
  deleteMeal(id: string): Promise<void>;

  listDishes(): Promise<Dish[]>;
  dishesForMeal(mealId: string): Promise<Dish[]>;
  /** Replaces all dishes of a meal. */
  replaceDishes(mealId: string, dishes: Dish[]): Promise<void>;

  listCandidates(status?: CandidateStatus): Promise<MealCandidate[]>;
  saveCandidates(items: MealCandidate[]): Promise<void>;
  setCandidateStatus(id: string, status: CandidateStatus): Promise<void>;

  savePhoto(id: string, blob: Blob): Promise<void>;
  getPhoto(id: string): Promise<Blob | undefined>;

  hasScanned(fingerprint: string): Promise<boolean>;
  markScanned(fingerprints: string[]): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;

  /** Bulk insert used by demo seeding. */
  putAll(data: { venues: Venue[]; meals: Meal[]; dishes: Dish[] }): Promise<void>;
  /** Removes every venue, meal and dish flagged isDemo. */
  clearDemo(): Promise<void>;
  clearAll(): Promise<void>;

  /** Subscribe to any write. Returns an unsubscribe function. */
  onChange(listener: () => void): () => void;
}
