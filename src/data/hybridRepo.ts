import type { CandidateStatus, Dish, Meal, MealCandidate, Settings, Venue } from '../core/types';
import type { CloudApi } from './cloudApi';
import type { Repository } from './repo';

/** The on-device store: a Repository plus the deletes needed to move data to the cloud. */
export interface LocalStore extends Repository {
  deleteVenue(id: string): Promise<void>;
  deleteCandidate(id: string): Promise<void>;
}

/** Demo records (fictional data) never leave the device. */
export const isDemoId = (id: string) => id.startsWith('demo-');

/** Merges two lists by id; later lists win. */
function mergeById<T extends { id: string }>(...lists: T[][]): T[] {
  const map = new Map<string, T>();
  for (const list of lists) for (const item of list) map.set(item.id, item);
  return [...map.values()];
}

/**
 * Real data lives in the cloud; demo data, photo thumbnails, scan history and settings stay
 * on the device. Reads merge both sides (so data created before signing in is still visible
 * until uploaded); writes of real data go to the cloud.
 *
 * If the cloud is unreachable, reads fall back to local data and the error is reported
 * through `onSyncError` rather than leaving screens blank.
 */
export class HybridRepository implements Repository {
  private listeners = new Set<() => void>();

  constructor(
    private local: LocalStore,
    private cloud: CloudApi,
    private onSyncError: (message: string | null) => void = () => undefined,
  ) {
    local.onChange(() => this.emit());
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  onChange(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Cloud read that degrades to a fallback instead of throwing. */
  private async read<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const value = await fn();
      this.onSyncError(null);
      return value;
    } catch (e) {
      this.onSyncError(e instanceof Error ? e.message : 'Cloud sync failed');
      return fallback;
    }
  }

  private async write(fn: () => Promise<void>) {
    await fn();
    this.onSyncError(null);
    this.emit();
  }

  // ---- venues
  async listVenues() {
    return mergeById(await this.local.listVenues(), await this.read(() => this.cloud.listVenues(), []));
  }
  async getVenue(id: string) {
    const local = await this.local.getVenue(id);
    if (isDemoId(id)) return local;
    return (await this.read(() => this.cloud.getVenue(id), undefined)) ?? local;
  }
  async saveVenue(venue: Venue) {
    if (venue.isDemo || isDemoId(venue.id)) return this.local.saveVenue(venue);
    await this.write(() => this.cloud.upsertVenue(venue));
  }

  // ---- meals
  async listMeals() {
    return mergeById(await this.local.listMeals(), await this.read(() => this.cloud.listMeals(), []));
  }
  async getMeal(id: string) {
    const local = await this.local.getMeal(id);
    if (isDemoId(id)) return local;
    return (await this.read(() => this.cloud.getMeal(id), undefined)) ?? local;
  }
  async saveMeal(meal: Meal) {
    if (meal.isDemo || isDemoId(meal.id)) return this.local.saveMeal(meal);
    await this.write(() => this.cloud.upsertMeal(meal));
  }
  async deleteMeal(id: string) {
    await this.local.deleteMeal(id);
    if (!isDemoId(id)) await this.write(() => this.cloud.deleteMeal(id));
  }

  // ---- dishes
  async listDishes() {
    return mergeById(await this.local.listDishes(), await this.read(() => this.cloud.listDishes(), []));
  }
  async dishesForMeal(mealId: string) {
    const local = await this.local.dishesForMeal(mealId);
    if (isDemoId(mealId)) return local;
    return mergeById(local, await this.read(() => this.cloud.dishesForMeal(mealId), []));
  }
  async replaceDishes(mealId: string, dishes: Dish[]) {
    if (isDemoId(mealId)) return this.local.replaceDishes(mealId, dishes);
    await this.write(() => this.cloud.replaceDishes(mealId, dishes));
  }

  // ---- triage queue
  async listCandidates(status?: CandidateStatus) {
    const merged = mergeById(
      await this.local.listCandidates(status),
      await this.read(() => this.cloud.listCandidates(status), []),
    );
    return merged.sort((a, b) => b.date - a.date);
  }
  async saveCandidates(items: MealCandidate[]) {
    const demo = items.filter((c) => isDemoId(c.id));
    const real = items.filter((c) => !isDemoId(c.id));
    if (demo.length > 0) await this.local.saveCandidates(demo);
    if (real.length > 0) await this.write(() => this.cloud.upsertCandidates(real));
  }
  async setCandidateStatus(id: string, status: CandidateStatus) {
    // A card may still be local-only (created before sign-in), so update both sides.
    await this.local.setCandidateStatus(id, status);
    if (!isDemoId(id)) await this.write(() => this.cloud.setCandidateStatus(id, status));
  }

  // ---- device-only stores
  savePhoto(id: string, blob: Blob) {
    return this.local.savePhoto(id, blob);
  }
  getPhoto(id: string) {
    return this.local.getPhoto(id);
  }
  hasScanned(fingerprint: string) {
    return this.local.hasScanned(fingerprint);
  }
  markScanned(fingerprints: string[]) {
    return this.local.markScanned(fingerprints);
  }
  getSettings(): Promise<Settings> {
    return this.local.getSettings();
  }
  saveSettings(settings: Settings) {
    return this.local.saveSettings(settings);
  }
  putAll(data: { venues: Venue[]; meals: Meal[]; dishes: Dish[] }) {
    return this.local.putAll(data); // only used for demo seeding
  }
  clearDemo() {
    return this.local.clearDemo();
  }

  /** Erases this device's data and everything the signed-in user has in the cloud. */
  async clearAll() {
    await this.local.clearAll();
    await this.write(() => this.cloud.deleteAll());
  }

  // ---- moving existing on-device data to the cloud

  /** Real (non-demo) records still stored only on this device. */
  private async localReal() {
    const [venues, meals, dishes, candidates] = await Promise.all([
      this.local.listVenues(),
      this.local.listMeals(),
      this.local.listDishes(),
      this.local.listCandidates(),
    ]);
    const realMeals = meals.filter((m) => !m.isDemo && !isDemoId(m.id));
    const mealIds = new Set(realMeals.map((m) => m.id));
    return {
      venues: venues.filter((v) => !v.isDemo && !isDemoId(v.id)),
      meals: realMeals,
      dishes: dishes.filter((d) => mealIds.has(d.mealId)),
      candidates: candidates.filter((c) => !isDemoId(c.id)),
    };
  }

  async pendingLocalCount(): Promise<number> {
    const r = await this.localReal();
    return r.meals.length + r.candidates.length;
  }

  /** Uploads on-device real data (parents first), then removes the local copies. Returns the number of meals moved. */
  async uploadLocal(): Promise<number> {
    const r = await this.localReal();
    for (const v of r.venues) await this.cloud.upsertVenue(v);
    for (const m of r.meals) await this.cloud.upsertMeal(m);
    for (const m of r.meals) {
      const dishes = r.dishes.filter((d) => d.mealId === m.id);
      if (dishes.length > 0) await this.cloud.replaceDishes(m.id, dishes);
    }
    await this.cloud.upsertCandidates(r.candidates);

    // Only after everything is safely uploaded do the local copies go.
    for (const m of r.meals) await this.local.deleteMeal(m.id);
    for (const v of r.venues) await this.local.deleteVenue(v.id);
    for (const c of r.candidates) await this.local.deleteCandidate(c.id);
    this.onSyncError(null);
    this.emit();
    return r.meals.length;
  }
}
