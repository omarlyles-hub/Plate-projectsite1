import { NYC_NEIGHBORHOODS } from '../core/neighborhoods';
import type { Dish, Meal, MealCandidate, PriceFeel, Rating, Venue, VenueCandidate } from '../core/types';
import type { Repository } from './repo';

/**
 * Demo data: 25 fictional meals at fictional restaurants across NYC neighborhoods,
 * plus a few pending triage cards. Photos are "demo:*" ids rendered as generated tiles.
 */

const DAY = 86_400_000;

function at(neighborhood: string, dLat = 0, dLon = 0): { latitude: number; longitude: number } {
  const n = NYC_NEIGHBORHOODS.find((x) => x.name === neighborhood);
  if (!n) throw new Error(`unknown neighborhood ${neighborhood}`);
  return { latitude: n.lat + dLat, longitude: n.lon + dLon };
}

interface VenueSeed {
  name: string;
  address: string;
  neighborhood: string;
  dLat?: number;
  dLon?: number;
}

const VENUES: VenueSeed[] = [
  { name: 'Marrow & Ash', address: '14 Grove St', neighborhood: 'West Village', dLat: 0.0006 },
  { name: 'Little Fennel', address: '88 E 7th St', neighborhood: 'East Village', dLon: 0.0008 },
  { name: 'Caldera Pizza', address: '211 Bedford Ave', neighborhood: 'Williamsburg', dLat: 0.0009 },
  { name: 'Noodle Parlor Seven', address: '7 Mott St', neighborhood: 'Chinatown', dLon: -0.0005 },
  { name: 'Hearth & Rye', address: '402 5th Ave', neighborhood: 'Park Slope', dLat: -0.0008 },
  { name: 'The Gilded Fig', address: '310 Amsterdam Ave', neighborhood: 'Upper West Side', dLat: -0.004 },
  { name: 'Koji Counter', address: '63 Spring St', neighborhood: 'SoHo', dLon: 0.0007 },
  { name: 'Salt Bay Oyster Bar', address: '120 Hudson St', neighborhood: 'Tribeca', dLat: 0.0005 },
  { name: 'Casa Naranja', address: '31-12 Broadway', neighborhood: 'Astoria', dLat: 0.0004 },
  { name: 'Sundial Cafe', address: '56 Franklin St', neighborhood: 'Greenpoint', dLon: -0.0006 },
  { name: 'Bao & Bell', address: '140 Orchard St', neighborhood: 'Lower East Side', dLat: 0.0007 },
  { name: 'Tandoor Nights', address: '37-45 74th St', neighborhood: 'Jackson Heights', dLat: 0.0003 },
  { name: "Rosa's Bakery", address: '1840 Adam Clayton Powell Jr Blvd', neighborhood: 'Harlem', dLat: 0.0006 },
  { name: 'Verde Table', address: '215 DeKalb Ave', neighborhood: 'Fort Greene', dLon: 0.0006 },
  { name: 'The Brass Pony', address: '640 9th Ave', neighborhood: "Hell's Kitchen", dLat: 0.0005 },
  { name: 'Lantern House', address: '41-28 Main St', neighborhood: 'Flushing', dLon: 0.0007 },
];

/** [dish, order again?] */
type D = [string, boolean];

interface MealSeed {
  venue: number;
  daysAgo: number;
  rating: Rating;
  price?: PriceFeel;
  note?: string;
  with?: string;
  dishes: D[];
  photos: number;
}

const MEALS: MealSeed[] = [
  { venue: 0, daysAgo: 365, rating: 'loved', price: 3, with: 'Maya', note: 'Anniversary dinner, corner table.', dishes: [['Cacio e pepe', true], ['Roasted bone marrow', true], ['Tuscan kale', false]], photos: 3 },
  { venue: 0, daysAgo: 142, rating: 'loved', price: 3, dishes: [['Cacio e pepe', true], ['Charred octopus', false]], photos: 2 },
  { venue: 0, daysAgo: 61, rating: 'good', price: 3, with: 'Dev', dishes: [['Roasted bone marrow', true], ['Tiramisu', false]], photos: 2 },
  { venue: 0, daysAgo: 9, rating: 'loved', price: 3, note: 'Still the best pasta in the Village.', dishes: [['Cacio e pepe', true], ['Tuscan kale', true]], photos: 3 },
  { venue: 1, daysAgo: 233, rating: 'good', price: 2, dishes: [['Fennel sausage pasta', true], ['Burrata toast', false]], photos: 2 },
  { venue: 1, daysAgo: 28, rating: 'loved', price: 2, note: 'Order the burrata toast next time too.', dishes: [['Burrata toast', true], ['Fennel sausage pasta', true]], photos: 2 },
  { venue: 2, daysAgo: 363, rating: 'loved', price: 2, with: 'The Brooklyn crew', dishes: [['Hot honey pie', true]], photos: 3 },
  { venue: 3, daysAgo: 96, rating: 'loved', price: 1, dishes: [['Hand-pulled noodles', true], ['Pork soup dumplings', true]], photos: 2 },
  { venue: 4, daysAgo: 177, rating: 'good', price: 2, dishes: [['Rye tagliatelle', true], ['Charred broccoli', false]], photos: 2 },
  { venue: 4, daysAgo: 40, rating: 'meh', price: 2, note: 'Slow service, pasta was fine.', dishes: [['Rye tagliatelle', false]], photos: 1 },
  { venue: 5, daysAgo: 310, rating: 'good', price: 3, dishes: [['Fig & prosciutto flatbread', true], ['Lamb ragu', false]], photos: 2 },
  { venue: 5, daysAgo: 118, rating: 'meh', price: 3, dishes: [['Lamb ragu', false]], photos: 1 },
  { venue: 6, daysAgo: 77, rating: 'loved', price: 4, with: 'Maya', note: 'Birthday omakase. Worth the splurge.', dishes: [['Omakase set', true], ['Miso black cod', true]], photos: 3 },
  { venue: 7, daysAgo: 205, rating: 'good', price: 3, dishes: [['Oysters', true], ['Lobster roll', true]], photos: 2 },
  { venue: 7, daysAgo: 15, rating: 'loved', price: 3, dishes: [['Oysters', true], ['Lobster roll', false]], photos: 2 },
  { venue: 8, daysAgo: 289, rating: 'loved', price: 1, dishes: [['Tacos al pastor', true], ['Elote', true]], photos: 2 },
  { venue: 8, daysAgo: 52, rating: 'good', price: 1, dishes: [['Tacos al pastor', true]], photos: 1 },
  { venue: 9, daysAgo: 21, rating: 'good', price: 2, dishes: [['Ricotta pancakes', true]], photos: 2 },
  { venue: 10, daysAgo: 160, rating: 'good', price: 2, dishes: [['Pork belly bao', true], ['Scallion pancake', false]], photos: 2 },
  { venue: 10, daysAgo: 5, rating: 'loved', price: 2, with: 'Dev', dishes: [['Pork belly bao', true], ['Scallion pancake', true]], photos: 2 },
  { venue: 11, daysAgo: 128, rating: 'loved', price: 2, dishes: [['Lamb seekh', true], ['Garlic naan', true]], photos: 2 },
  { venue: 12, daysAgo: 34, rating: 'good', price: 1, dishes: [['Concha', true], ['Cortado', false]], photos: 1 },
  { venue: 13, daysAgo: 250, rating: 'good', price: 3, dishes: [['Wild mushroom risotto', true]], photos: 2 },
  { venue: 14, daysAgo: 3, rating: 'meh', price: 2, dishes: [['Smash burger', false]], photos: 1 },
  { venue: 15, daysAgo: 88, rating: 'loved', price: 1, with: 'Mom', dishes: [['Lamb skewers', true], ['Cold sesame noodles', true]], photos: 3 },
];

function atEvening(now: number, daysAgo: number): number {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(19, 30, 0, 0);
  return d.getTime();
}

export const DEMO_MEAL_COUNT = MEALS.length;

export interface DemoData {
  venues: Venue[];
  meals: Meal[];
  dishes: Dish[];
  candidates: MealCandidate[];
}

export function buildDemoData(now = Date.now()): DemoData {
  const venues: Venue[] = VENUES.map((v, i) => ({
    id: `demo-venue-${i}`,
    name: v.name,
    address: v.address,
    ...at(v.neighborhood, v.dLat, v.dLon),
    mapItemId: null,
    neighborhood: v.neighborhood,
    isDemo: true,
  }));

  const meals: Meal[] = [];
  const dishes: Dish[] = [];
  MEALS.forEach((m, i) => {
    const id = `demo-meal-${i}`;
    meals.push({
      id,
      date: atEvening(now, m.daysAgo),
      venueId: `demo-venue-${m.venue}`,
      photoIds: Array.from({ length: m.photos }, (_, k) => `demo:${i}:${k}`),
      rating: m.rating,
      note: m.note ?? '',
      companions: m.with,
      priceFeel: m.price,
      isDemo: true,
    });
    m.dishes.forEach(([name, again], k) => {
      dishes.push({ id: `demo-dish-${i}-${k}`, name, mealId: id, orderAgain: again });
    });
  });

  // Pending triage cards, so the swipe flow can be demoed without a photo library.
  const cand = (v: number, distanceM: number): VenueCandidate => ({
    name: VENUES[v].name,
    address: VENUES[v].address,
    ...at(VENUES[v].neighborhood, VENUES[v].dLat, VENUES[v].dLon),
    mapItemId: null,
    neighborhood: VENUES[v].neighborhood,
    distanceM,
    knownVenueId: `demo-venue-${v}`,
  });
  const fresh = (name: string, hood: string, address: string, distanceM: number): VenueCandidate => ({
    name,
    address,
    ...at(hood, 0.0004, 0.0004),
    mapItemId: `node/${Math.abs(name.length * 7919)}`,
    neighborhood: hood,
    distanceM,
  });
  const candidates: MealCandidate[] = [
    {
      id: 'demo-cand-0',
      date: atEvening(now, 1),
      ...at('East Village', 0.0002, 0.0008),
      photoIds: ['demo:c0:0', 'demo:c0:1', 'demo:c0:2'],
      candidates: [cand(1, 12), fresh('Ruby Lane Wine Bar', 'East Village', '90 E 7th St', 38), fresh('Pierogi Palace', 'East Village', '99 2nd Ave', 71)],
      status: 'pending',
    },
    {
      id: 'demo-cand-1',
      date: atEvening(now, 2),
      ...at('Williamsburg', 0.0009, 0),
      photoIds: ['demo:c1:0', 'demo:c1:1'],
      candidates: [cand(2, 8), fresh('Driftwood Tacos', 'Williamsburg', '175 Bedford Ave', 44), fresh('Moxie Coffee', 'Williamsburg', '180 Bedford Ave', 63)],
      status: 'pending',
    },
    {
      id: 'demo-cand-2',
      date: atEvening(now, 6),
      ...at('Chelsea', 0.001, 0.001),
      photoIds: ['demo:c2:0'],
      candidates: [fresh('Juniper & Co', 'Chelsea', '240 W 18th St', 20), fresh('Pearl Dumpling House', 'Chelsea', '248 W 18th St', 55)],
      status: 'pending',
    },
    {
      id: 'demo-cand-3',
      date: atEvening(now, 11),
      ...at('Midtown', 0.001, 0),
      photoIds: ['demo:c3:0', 'demo:c3:1'],
      candidates: [
        {
          name: 'Unknown place, Midtown',
          address: '',
          ...at('Midtown', 0.001, 0),
          mapItemId: null,
          neighborhood: 'Midtown',
          distanceM: 0,
          needsManualName: true,
        },
      ],
      status: 'pending',
    },
  ];

  return { venues, meals, dishes, candidates };
}

export async function seedDemo(repo: Repository, now = Date.now()): Promise<void> {
  const data = buildDemoData(now);
  await repo.putAll({ venues: data.venues, meals: data.meals, dishes: data.dishes });
  await repo.saveCandidates(data.candidates);
}
