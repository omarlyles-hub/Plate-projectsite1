import { describe, expect, it } from 'vitest';
import { formatShare } from './shareFormatter';

describe('formatShare', () => {
  it('produces the canonical share text', () => {
    expect(
      formatShare({
        venueName: 'Via Carota',
        neighborhood: 'West Village',
        dishes: [
          { name: 'cacio e pepe', orderAgain: true },
          { name: 'the Tuscan kale', orderAgain: true },
        ],
        rating: 'loved',
      }),
    ).toBe('Via Carota, West Village. Get: cacio e pepe, the Tuscan kale. Loved it.');
  });

  it('prefers order-again dishes over the rest', () => {
    const text = formatShare({
      venueName: 'A',
      neighborhood: 'SoHo',
      dishes: [
        { name: 'soup', orderAgain: false },
        { name: 'pasta', orderAgain: true },
      ],
      rating: 'good',
    });
    expect(text).toBe('A, SoHo. Get: pasta. Good.');
  });

  it('falls back to any dishes when none are flagged, capped at three and de-duplicated', () => {
    const text = formatShare({
      venueName: 'A',
      neighborhood: 'SoHo',
      dishes: ['one', 'One', 'two', 'three', 'four'].map((name) => ({ name, orderAgain: false })),
      rating: 'meh',
    });
    expect(text).toBe('A, SoHo. Get: one, two, three. Meh.');
  });

  it('omits the dish clause and neighborhood when empty', () => {
    expect(formatShare({ venueName: 'A', neighborhood: '', dishes: [], rating: 'loved' })).toBe(
      'A. Loved it.',
    );
  });

  it('ignores blank dish names', () => {
    expect(
      formatShare({
        venueName: 'A',
        neighborhood: 'SoHo',
        dishes: [{ name: '   ', orderAgain: true }],
        rating: 'good',
      }),
    ).toBe('A, SoHo. Good.');
  });
});
