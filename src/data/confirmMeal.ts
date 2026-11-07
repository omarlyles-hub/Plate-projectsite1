import { distanceOrInfinity } from '../core/geo';
import { nearestNeighborhood } from '../core/neighborhoods';
import type {
  Dish,
  Meal,
  MealCandidate,
  PriceFeel,
  Rating,
  Venue,
  VenueCandidate,
} from '../core/types';
import type { Repository } from './repo';

export interface Enrichment {
  rating: Rating;
  dishes: { name: string; orderAgain: boolean }[];
  note: string;
  companions?: string;
  priceFeel?: PriceFeel;
}

/** Either one of the proposed candidates, or a name the user typed. */
export type VenueChoice =
  | { kind: 'candidate'; candidate: VenueCandidate }
  | { kind: 'manual'; name: string };

type Repo = Pick<
  Repository,
  'listVenues' | 'saveVenue' | 'saveMeal' | 'replaceDishes' | 'setCandidateStatus'
>;

const norm = (s: string) => s.trim().toLowerCase();

/** What a venue needs to be created or matched; a VenueCandidate satisfies it. */
interface Place {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  mapItemId: string | null;
  neighborhood: string;
  knownVenueId?: string;
}

/** Finds an existing venue the user already has, so repeat visits share one venue page. */
function findExisting(venues: readonly Venue[], c: Place): Venue | undefined {
  if (c.knownVenueId) {
    const byId = venues.find((v) => v.id === c.knownVenueId);
    if (byId) return byId;
  }
  return venues.find(
    (v) =>
      (c.mapItemId !== null && v.mapItemId === c.mapItemId) ||
      (norm(v.name) === norm(c.name) &&
        // With either location unknown, a matching name is the best evidence we have.
        (distanceOrInfinity(v.latitude, v.longitude, c.latitude, c.longitude) <= 200 ||
          v.latitude === null ||
          c.latitude === null)),
  );
}

/**
 * Turns a reviewed triage card into a Meal (and Venue/Dishes as needed) and marks the card
 * confirmed. Returns the new meal id.
 */
export async function confirmCandidate(
  repo: Repo,
  card: MealCandidate,
  choice: VenueChoice,
  enrichment: Enrichment,
  newId: () => string = () => crypto.randomUUID(),
): Promise<string> {
  const venues = await repo.listVenues();

  const hood = (lat: number | null, lon: number | null) =>
    lat === null || lon === null ? '' : nearestNeighborhood(lat, lon);

  const candidate: Place =
    choice.kind === 'candidate'
      ? choice.candidate
      : {
          name: choice.name.trim(),
          address: '',
          latitude: card.latitude,
          longitude: card.longitude,
          mapItemId: null,
          neighborhood: hood(card.latitude, card.longitude),
        };

  if (!candidate.name) throw new Error('A venue name is required');

  let venue = findExisting(venues, candidate);
  if (!venue) {
    venue = {
      id: newId(),
      name: candidate.name,
      address: candidate.address,
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      mapItemId: candidate.mapItemId,
      neighborhood: candidate.neighborhood || hood(candidate.latitude, candidate.longitude),
    };
    await repo.saveVenue(venue);
  }

  const mealId = newId();
  const meal: Meal = {
    id: mealId,
    date: card.date,
    venueId: venue.id,
    photoIds: card.photoIds,
    rating: enrichment.rating,
    note: enrichment.note.trim(),
    companions: enrichment.companions?.trim() || undefined,
    priceFeel: enrichment.priceFeel,
  };
  await repo.saveMeal(meal);

  const dishes: Dish[] = enrichment.dishes
    .map((d) => ({ ...d, name: d.name.trim() }))
    .filter((d) => d.name.length > 0)
    .map((d) => ({ id: newId(), name: d.name, mealId, orderAgain: d.orderAgain }));
  if (dishes.length > 0) await repo.replaceDishes(mealId, dishes);

  await repo.setCandidateStatus(card.id, 'confirmed');
  return mealId;
}
