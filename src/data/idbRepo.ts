import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_SETTINGS,
  type CandidateStatus,
  type Dish,
  type Meal,
  type MealCandidate,
  type PhotoRecord,
  type Settings,
  type Venue,
} from '../core/types';
import type { Repository } from './repo';

interface PlateDB extends DBSchema {
  venues: { key: string; value: Venue };
  meals: { key: string; value: Meal };
  dishes: { key: string; value: Dish; indexes: { byMeal: string } };
  candidates: { key: string; value: MealCandidate; indexes: { byStatus: string } };
  photos: { key: string; value: PhotoRecord };
  scanned: { key: string; value: { fingerprint: string } };
  settings: { key: string; value: { key: string; value: Settings } };
}

const SETTINGS_KEY = 'app';

export class IdbRepository implements Repository {
  private dbPromise: Promise<IDBPDatabase<PlateDB>>;
  private listeners = new Set<() => void>();

  constructor(name = 'plate') {
    this.dbPromise = openDB<PlateDB>(name, 1, {
      upgrade(db) {
        db.createObjectStore('venues', { keyPath: 'id' });
        db.createObjectStore('meals', { keyPath: 'id' });
        db.createObjectStore('dishes', { keyPath: 'id' }).createIndex('byMeal', 'mealId');
        db.createObjectStore('candidates', { keyPath: 'id' }).createIndex('byStatus', 'status');
        db.createObjectStore('photos', { keyPath: 'id' });
        db.createObjectStore('scanned', { keyPath: 'fingerprint' });
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
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

  async listVenues() {
    return (await this.dbPromise).getAll('venues');
  }
  async getVenue(id: string) {
    return (await this.dbPromise).get('venues', id);
  }
  async saveVenue(venue: Venue) {
    await (await this.dbPromise).put('venues', venue);
    this.emit();
  }

  async listMeals() {
    return (await this.dbPromise).getAll('meals');
  }
  async getMeal(id: string) {
    return (await this.dbPromise).get('meals', id);
  }
  async saveMeal(meal: Meal) {
    await (await this.dbPromise).put('meals', meal);
    this.emit();
  }
  async deleteMeal(id: string) {
    const db = await this.dbPromise;
    const keys = await db.getAllKeysFromIndex('dishes', 'byMeal', id);
    const tx = db.transaction(['meals', 'dishes'], 'readwrite');
    await tx.objectStore('meals').delete(id);
    await Promise.all(keys.map((k) => tx.objectStore('dishes').delete(k)));
    await tx.done;
    this.emit();
  }

  async listDishes() {
    return (await this.dbPromise).getAll('dishes');
  }
  async dishesForMeal(mealId: string) {
    return (await this.dbPromise).getAllFromIndex('dishes', 'byMeal', mealId);
  }
  async replaceDishes(mealId: string, dishes: Dish[]) {
    const db = await this.dbPromise;
    const keys = await db.getAllKeysFromIndex('dishes', 'byMeal', mealId);
    const tx = db.transaction('dishes', 'readwrite');
    await Promise.all(keys.map((k) => tx.store.delete(k)));
    await Promise.all(dishes.map((d) => tx.store.put(d)));
    await tx.done;
    this.emit();
  }

  async listCandidates(status?: CandidateStatus) {
    const db = await this.dbPromise;
    const all = status
      ? await db.getAllFromIndex('candidates', 'byStatus', status)
      : await db.getAll('candidates');
    return all.sort((a, b) => b.date - a.date);
  }
  async saveCandidates(items: MealCandidate[]) {
    const db = await this.dbPromise;
    const tx = db.transaction('candidates', 'readwrite');
    await Promise.all(items.map((i) => tx.store.put(i)));
    await tx.done;
    this.emit();
  }
  async setCandidateStatus(id: string, status: CandidateStatus) {
    const db = await this.dbPromise;
    const item = await db.get('candidates', id);
    if (!item) return;
    await db.put('candidates', { ...item, status });
    this.emit();
  }

  async savePhoto(id: string, blob: Blob) {
    await (await this.dbPromise).put('photos', { id, blob });
  }
  async getPhoto(id: string) {
    return (await (await this.dbPromise).get('photos', id))?.blob;
  }

  async hasScanned(fingerprint: string) {
    return (await (await this.dbPromise).get('scanned', fingerprint)) !== undefined;
  }
  async markScanned(fingerprints: string[]) {
    const db = await this.dbPromise;
    const tx = db.transaction('scanned', 'readwrite');
    await Promise.all(fingerprints.map((fingerprint) => tx.store.put({ fingerprint })));
    await tx.done;
  }

  async getSettings(): Promise<Settings> {
    const row = await (await this.dbPromise).get('settings', SETTINGS_KEY);
    return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
  }
  async saveSettings(settings: Settings) {
    await (await this.dbPromise).put('settings', { key: SETTINGS_KEY, value: settings });
    this.emit();
  }

  async putAll(data: { venues: Venue[]; meals: Meal[]; dishes: Dish[] }) {
    const db = await this.dbPromise;
    const tx = db.transaction(['venues', 'meals', 'dishes'], 'readwrite');
    await Promise.all([
      ...data.venues.map((v) => tx.objectStore('venues').put(v)),
      ...data.meals.map((m) => tx.objectStore('meals').put(m)),
      ...data.dishes.map((d) => tx.objectStore('dishes').put(d)),
    ]);
    await tx.done;
    this.emit();
  }

  async clearDemo() {
    const db = await this.dbPromise;
    const meals = (await db.getAll('meals')).filter((m) => m.isDemo);
    const venues = (await db.getAll('venues')).filter((v) => v.isDemo);
    const mealIds = new Set(meals.map((m) => m.id));
    const dishes = (await db.getAll('dishes')).filter((d) => mealIds.has(d.mealId));
    const candidates = (await db.getAllKeys('candidates')).filter((k) => k.startsWith('demo-'));
    const tx = db.transaction(['venues', 'meals', 'dishes', 'candidates'], 'readwrite');
    await Promise.all([
      ...candidates.map((k) => tx.objectStore('candidates').delete(k)),
      ...meals.map((m) => tx.objectStore('meals').delete(m.id)),
      ...venues.map((v) => tx.objectStore('venues').delete(v.id)),
      ...dishes.map((d) => tx.objectStore('dishes').delete(d.id)),
    ]);
    await tx.done;
    this.emit();
  }

  async clearAll() {
    const db = await this.dbPromise;
    const tx = db.transaction(
      ['venues', 'meals', 'dishes', 'candidates', 'photos', 'scanned'],
      'readwrite',
    );
    await Promise.all([
      tx.objectStore('venues').clear(),
      tx.objectStore('meals').clear(),
      tx.objectStore('dishes').clear(),
      tx.objectStore('candidates').clear(),
      tx.objectStore('photos').clear(),
      tx.objectStore('scanned').clear(),
    ]);
    await tx.done;
    this.emit();
  }
}
