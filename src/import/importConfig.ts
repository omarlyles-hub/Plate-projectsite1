/** Tunable import constants. Adjust here; nothing else hard-codes these values. */
export const IMPORT_CONFIG = {
  /** Only photos taken within this many months are considered. */
  lookbackMonths: 12,
  /** Food score (0..1) a photo needs to be kept. Raise for fewer false positives. */
  foodThreshold: 0.5,
  /** Longest edge of the stored thumbnail, in px. Originals are never stored. */
  thumbMaxPx: 480,
  thumbQuality: 0.8,
  /** Zero-shot CLIP model run in a Web Worker (downloaded once, then cached by the browser). */
  modelId: 'Xenova/clip-vit-base-patch32',
  /** Phrases that count as "food". Scores are summed across these. */
  foodLabels: [
    'a plate of food',
    'a restaurant dish',
    'a bowl of food',
    'a dessert',
    'a cocktail or drink',
    'a pizza or sandwich',
  ],
  /** Phrases that compete with the food labels. */
  nonFoodLabels: [
    'a person',
    'a selfie',
    'a landscape',
    'a building',
    'a street',
    'a pet',
    'a screenshot',
    'a document',
    'a car',
    'an empty room',
  ],
} as const;

export function lookbackStart(now: number, months = IMPORT_CONFIG.lookbackMonths): number {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return d.getTime();
}
