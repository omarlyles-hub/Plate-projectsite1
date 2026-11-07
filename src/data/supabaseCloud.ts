import type { SupabaseClient } from '@supabase/supabase-js';
import type { CandidateStatus, Dish, Meal, MealCandidate, Venue } from '../core/types';
import type { CloudApi } from './cloudApi';
import {
  candidateToRow,
  dishToRow,
  mealToRow,
  rowToCandidate,
  rowToDish,
  rowToMeal,
  rowToVenue,
  venueToRow,
  type CandidateRow,
  type DishRow,
  type MealRow,
  type VenueRow,
} from './rows';

/** Supabase implementation of CloudApi. Row-level security scopes every query to the user. */
export function createSupabaseCloud(client: SupabaseClient): CloudApi {
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what}: ${error.message}`);
  };

  async function selectAll<R>(table: string, what: string, filter?: (q: any) => any): Promise<R[]> {
    let query = client.from(table).select('*');
    if (filter) query = filter(query);
    const { data, error } = await query;
    fail(what, error);
    return (data ?? []) as R[];
  }

  async function upsert(table: string, rows: unknown[], what: string) {
    if (rows.length === 0) return;
    const { error } = await client.from(table).upsert(rows);
    fail(what, error);
  }

  return {
    async listVenues() {
      return (await selectAll<VenueRow>('venues', 'Loading venues')).map(rowToVenue);
    },
    async getVenue(id) {
      const { data, error } = await client.from('venues').select('*').eq('id', id).maybeSingle();
      fail('Loading venue', error);
      return data ? rowToVenue(data as VenueRow) : undefined;
    },
    async upsertVenue(venue: Venue) {
      await upsert('venues', [venueToRow(venue)], 'Saving venue');
    },

    async listMeals() {
      return (await selectAll<MealRow>('meals', 'Loading meals')).map(rowToMeal);
    },
    async getMeal(id) {
      const { data, error } = await client.from('meals').select('*').eq('id', id).maybeSingle();
      fail('Loading meal', error);
      return data ? rowToMeal(data as MealRow) : undefined;
    },
    async upsertMeal(meal: Meal) {
      await upsert('meals', [mealToRow(meal)], 'Saving meal');
    },
    async deleteMeal(id) {
      const { error } = await client.from('meals').delete().eq('id', id);
      fail('Deleting meal', error);
    },

    async listDishes() {
      return (await selectAll<DishRow>('dishes', 'Loading dishes')).map(rowToDish);
    },
    async dishesForMeal(mealId) {
      const rows = await selectAll<DishRow>('dishes', 'Loading dishes', (q) => q.eq('meal_id', mealId));
      return rows.map(rowToDish);
    },
    async replaceDishes(mealId, dishes: Dish[]) {
      const del = await client.from('dishes').delete().eq('meal_id', mealId);
      fail('Replacing dishes', del.error);
      await upsert('dishes', dishes.map(dishToRow), 'Saving dishes');
    },

    async listCandidates(status?: CandidateStatus) {
      const rows = await selectAll<CandidateRow>('meal_candidates', 'Loading review queue', (q) =>
        status ? q.eq('status', status) : q,
      );
      return rows.map(rowToCandidate).sort((a, b) => b.date - a.date);
    },
    async upsertCandidates(items: MealCandidate[]) {
      await upsert('meal_candidates', items.map(candidateToRow), 'Saving review queue');
    },
    async setCandidateStatus(id, status) {
      const { error } = await client.from('meal_candidates').update({ status }).eq('id', id);
      fail('Updating review queue', error);
    },

    async deleteAll() {
      // Venues cascade to meals and dishes; candidates are separate.
      const v = await client.from('venues').delete().not('id', 'is', null);
      fail('Erasing venues', v.error);
      const c = await client.from('meal_candidates').delete().not('id', 'is', null);
      fail('Erasing review queue', c.error);
    },
  };
}
