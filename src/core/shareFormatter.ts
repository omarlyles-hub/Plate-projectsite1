import { RATING_LABEL, type Rating } from './types';

export interface ShareInput {
  venueName: string;
  neighborhood: string;
  dishes: { name: string; orderAgain: boolean }[];
  rating: Rating;
}

const MAX_DISHES = 3;

/**
 * Clean text for pasting into a message, e.g.
 * "Via Carota, West Village. Get: cacio e pepe, the Tuscan kale. Loved it."
 *
 * Dishes flagged "order again" come first; if none are flagged, any logged dishes are used.
 */
export function formatShare({ venueName, neighborhood, dishes, rating }: ShareInput): string {
  const clean = dishes.map((d) => ({ ...d, name: d.name.trim() })).filter((d) => d.name);
  const flagged = clean.filter((d) => d.orderAgain);
  const pool = flagged.length > 0 ? flagged : clean;

  const seen = new Set<string>();
  const picked: string[] = [];
  for (const d of pool) {
    const key = d.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(d.name);
    if (picked.length === MAX_DISHES) break;
  }

  const head = neighborhood ? `${venueName}, ${neighborhood}.` : `${venueName}.`;
  const get = picked.length > 0 ? ` Get: ${picked.join(', ')}.` : '';
  return `${head}${get} ${RATING_LABEL[rating]}.`;
}
