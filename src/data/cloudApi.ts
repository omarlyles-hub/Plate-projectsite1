import type { CandidateStatus, Dish, Meal, MealCandidate, Venue } from '../core/types';

/** The remote half of the data layer. Implemented over Supabase; faked in tests. */
export interface CloudApi {
  listVenues(): Promise<Venue[]>;
  getVenue(id: string): Promise<Venue | undefined>;
  upsertVenue(venue: Venue): Promise<void>;

  listMeals(): Promise<Meal[]>;
  getMeal(id: string): Promise<Meal | undefined>;
  upsertMeal(meal: Meal): Promise<void>;
  deleteMeal(id: string): Promise<void>;

  listDishes(): Promise<Dish[]>;
  dishesForMeal(mealId: string): Promise<Dish[]>;
  replaceDishes(mealId: string, dishes: Dish[]): Promise<void>;

  listCandidates(status?: CandidateStatus): Promise<MealCandidate[]>;
  upsertCandidates(items: MealCandidate[]): Promise<void>;
  setCandidateStatus(id: string, status: CandidateStatus): Promise<void>;

  /** Deletes every row owned by the signed-in user. */
  deleteAll(): Promise<void>;
}
