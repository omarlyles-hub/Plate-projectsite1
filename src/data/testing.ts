import type { CandidateStatus, Dish, Meal, MealCandidate, Settings, Venue } from '../core/types';
import { DEFAULT_SETTINGS } from '../core/types';
import type { CloudApi } from './cloudApi';
import type { LocalStore } from './hybridRepo';

/** In-memory stand-ins used by unit tests (IndexedDB and Supabase are not available there). */

export class MemoryStore implements LocalStore {
  venues = new Map<string, Venue>();
  meals = new Map<string, Meal>();
  dishes = new Map<string, Dish>();
  candidates = new Map<string, MealCandidate>();
  photos = new Map<string, Blob>();
  scanned = new Set<string>();
  settings: Settings = { ...DEFAULT_SETTINGS };
  private listeners = new Set<() => void>();

  private emit() {
    this.listeners.forEach((l) => l());
  }
  onChange(l: () => void) {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }

  async listVenues() { return [...this.venues.values()]; }
  async getVenue(id: string) { return this.venues.get(id); }
  async saveVenue(v: Venue) { this.venues.set(v.id, v); this.emit(); }
  async deleteVenue(id: string) { this.venues.delete(id); this.emit(); }

  async listMeals() { return [...this.meals.values()]; }
  async getMeal(id: string) { return this.meals.get(id); }
  async saveMeal(m: Meal) { this.meals.set(m.id, m); this.emit(); }
  async deleteMeal(id: string) {
    this.meals.delete(id);
    for (const d of [...this.dishes.values()]) if (d.mealId === id) this.dishes.delete(d.id);
    this.emit();
  }

  async listDishes() { return [...this.dishes.values()]; }
  async dishesForMeal(mealId: string) { return [...this.dishes.values()].filter((d) => d.mealId === mealId); }
  async replaceDishes(mealId: string, dishes: Dish[]) {
    for (const d of [...this.dishes.values()]) if (d.mealId === mealId) this.dishes.delete(d.id);
    dishes.forEach((d) => this.dishes.set(d.id, d));
    this.emit();
  }

  async listCandidates(status?: CandidateStatus) {
    return [...this.candidates.values()].filter((c) => !status || c.status === status).sort((a, b) => b.date - a.date);
  }
  async saveCandidates(items: MealCandidate[]) { items.forEach((c) => this.candidates.set(c.id, c)); this.emit(); }
  async setCandidateStatus(id: string, status: CandidateStatus) {
    const c = this.candidates.get(id);
    if (c) this.candidates.set(id, { ...c, status });
    this.emit();
  }
  async deleteCandidate(id: string) { this.candidates.delete(id); this.emit(); }

  async savePhoto(id: string, blob: Blob) { this.photos.set(id, blob); }
  async getPhoto(id: string) { return this.photos.get(id); }
  async hasScanned(fp: string) { return this.scanned.has(fp); }
  async markScanned(fps: string[]) { fps.forEach((f) => this.scanned.add(f)); }
  async getSettings() { return this.settings; }
  async saveSettings(s: Settings) { this.settings = s; this.emit(); }

  async putAll(data: { venues: Venue[]; meals: Meal[]; dishes: Dish[] }) {
    data.venues.forEach((v) => this.venues.set(v.id, v));
    data.meals.forEach((m) => this.meals.set(m.id, m));
    data.dishes.forEach((d) => this.dishes.set(d.id, d));
    this.emit();
  }
  async clearDemo() {
    for (const m of [...this.meals.values()]) if (m.isDemo) this.meals.delete(m.id);
    for (const v of [...this.venues.values()]) if (v.isDemo) this.venues.delete(v.id);
    for (const id of [...this.candidates.keys()]) if (id.startsWith('demo-')) this.candidates.delete(id);
    this.emit();
  }
  async clearAll() {
    this.venues.clear(); this.meals.clear(); this.dishes.clear(); this.candidates.clear();
    this.photos.clear(); this.scanned.clear();
    this.emit();
  }
}

export class FakeCloud implements CloudApi {
  venues = new Map<string, Venue>();
  meals = new Map<string, Meal>();
  dishes = new Map<string, Dish>();
  candidates = new Map<string, MealCandidate>();
  /** When set, every call rejects with this message. */
  failWith: string | null = null;

  private check() { if (this.failWith) throw new Error(this.failWith); }

  async listVenues() { this.check(); return [...this.venues.values()]; }
  async getVenue(id: string) { this.check(); return this.venues.get(id); }
  async upsertVenue(v: Venue) { this.check(); this.venues.set(v.id, v); }

  async listMeals() { this.check(); return [...this.meals.values()]; }
  async getMeal(id: string) { this.check(); return this.meals.get(id); }
  async upsertMeal(m: Meal) { this.check(); this.meals.set(m.id, m); }
  async deleteMeal(id: string) {
    this.check();
    this.meals.delete(id);
    for (const d of [...this.dishes.values()]) if (d.mealId === id) this.dishes.delete(d.id);
  }

  async listDishes() { this.check(); return [...this.dishes.values()]; }
  async dishesForMeal(mealId: string) { this.check(); return [...this.dishes.values()].filter((d) => d.mealId === mealId); }
  async replaceDishes(mealId: string, dishes: Dish[]) {
    this.check();
    for (const d of [...this.dishes.values()]) if (d.mealId === mealId) this.dishes.delete(d.id);
    dishes.forEach((d) => this.dishes.set(d.id, d));
  }

  async listCandidates(status?: CandidateStatus) {
    this.check();
    return [...this.candidates.values()].filter((c) => !status || c.status === status);
  }
  async upsertCandidates(items: MealCandidate[]) { this.check(); items.forEach((c) => this.candidates.set(c.id, c)); }
  async setCandidateStatus(id: string, status: CandidateStatus) {
    this.check();
    const c = this.candidates.get(id);
    if (c) this.candidates.set(id, { ...c, status });
  }

  async deleteAll() {
    this.check();
    this.venues.clear(); this.meals.clear(); this.dishes.clear(); this.candidates.clear();
  }
}
