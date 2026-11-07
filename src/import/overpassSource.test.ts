import { describe, expect, it, vi } from 'vitest';
import {
  buildQuery,
  createOverpassSource,
  parseOverpass,
  type OverpassElement,
} from './overpassSource';

const LAT = 40.7358;
const LON = -74.0036;

const sample: { elements: OverpassElement[] } = {
  elements: [
    {
      type: 'node',
      id: 2,
      lat: LAT + 0.0003,
      lon: LON,
      tags: { name: 'Far Cafe', amenity: 'cafe' },
    },
    {
      type: 'way',
      id: 1,
      center: { lat: LAT + 0.00005, lon: LON },
      tags: {
        name: 'Via Carota',
        amenity: 'restaurant',
        'addr:housenumber': '51',
        'addr:street': 'Grove Street',
        'addr:suburb': 'West Village',
      },
    },
    { type: 'node', id: 3, lat: LAT, lon: LON, tags: { amenity: 'bar' } },
  ],
};

describe('parseOverpass', () => {
  it('maps elements, skips unnamed ones and sorts by distance', () => {
    const out = parseOverpass(sample, LAT, LON);
    expect(out.map((c) => c.name)).toEqual(['Via Carota', 'Far Cafe']);
    expect(out[0].mapItemId).toBe('way/1');
    expect(out[0].address).toBe('51 Grove Street');
    expect(out[0].neighborhood).toBe('West Village');
    expect(out[0].distanceM).toBeLessThan(out[1].distanceM);
  });

  it('handles an empty or missing element list', () => {
    expect(parseOverpass({}, LAT, LON)).toEqual([]);
  });
});

describe('buildQuery', () => {
  it('asks for food amenities and bakeries around the point', () => {
    const q = buildQuery(40.7358, -74.0036, 75);
    expect(q).toContain('around:75,40.7358,-74.0036');
    expect(q).toContain('restaurant');
    expect(q).toContain('bakery');
  });
});

describe('createOverpassSource', () => {
  const ok = () => new Response(JSON.stringify(sample), { status: 200 });

  it('rounds coordinates, caches repeat lookups and parses results', async () => {
    const fetchFn = vi.fn(async () => ok());
    const src = createOverpassSource({ fetchFn, minIntervalMs: 0 });
    const a = await src.search(LAT + 0.00001, LON, 75);
    const b = await src.search(LAT, LON + 0.00001, 75);
    expect(a[0].name).toBe('Via Carota');
    expect(b).toBe(a);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const body = (fetchFn.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body;
    expect(body.get('data')).toContain('40.7358,-74.0036');
  });

  it('falls back to the second endpoint when the first fails', async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('busy', { status: 429 }))
      .mockResolvedValueOnce(ok());
    const src = createOverpassSource({ fetchFn, minIntervalMs: 0 });
    const out = await src.search(LAT, LON, 75);
    expect(out).toHaveLength(2);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('rejects when every endpoint fails', async () => {
    const fetchFn = vi.fn(async () => new Response('no', { status: 500 }));
    const src = createOverpassSource({ fetchFn, minIntervalMs: 0 });
    await expect(src.search(LAT, LON, 75)).rejects.toThrow();
  });
});
