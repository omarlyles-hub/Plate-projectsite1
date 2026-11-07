import { describe, expect, it, vi } from 'vitest';
import { matchVenue, type VenueSource } from './venueMatcher';
import type { Venue, VenueCandidate } from './types';

const LAT = 40.7358;
const LON = -74.0036;

const cand = (name: string, distanceM: number, extra: Partial<VenueCandidate> = {}): VenueCandidate => ({
  name,
  address: '',
  latitude: LAT,
  longitude: LON,
  mapItemId: `node/${name}`,
  neighborhood: '',
  distanceM,
  ...extra,
});

const stub = (results: VenueCandidate[]): VenueSource => ({ search: async () => results });
const throwing: VenueSource = {
  search: async () => {
    throw new Error('network down');
  },
};

const known = (id: string, name: string, extra: Partial<Venue> = {}): Venue => ({
  id,
  name,
  address: '1 Main St',
  latitude: LAT,
  longitude: LON,
  mapItemId: null,
  neighborhood: 'West Village',
  ...extra,
});

describe('matchVenue: normal lookup', () => {
  it('returns the closest three candidates, nearest first', async () => {
    const src = stub([cand('d', 60), cand('a', 10), cand('c', 40), cand('b', 20)]);
    const r = await matchVenue(LAT, LON, src, { lookupEnabled: true, knownVenues: [] });
    expect(r.source).toBe('search');
    expect(r.candidates.map((c) => c.name)).toEqual(['a', 'b', 'c']);
  });

  it('fills a missing neighborhood from the NYC table', async () => {
    const r = await matchVenue(LAT, LON, stub([cand('a', 5)]), {
      lookupEnabled: true,
      knownVenues: [],
    });
    expect(r.candidates[0].neighborhood).toBe('West Village');
  });

  it('boosts a venue the user has visited before', async () => {
    const src = stub([cand('Stranger', 20), cand('Regular', 50, { mapItemId: 'node/9' })]);
    const r = await matchVenue(LAT, LON, src, {
      lookupEnabled: true,
      knownVenues: [known('v1', 'Regular', { mapItemId: 'node/9' })],
    });
    expect(r.candidates[0].name).toBe('Regular');
    expect(r.candidates[0].knownVenueId).toBe('v1');
  });

  it('de-duplicates identical results', async () => {
    const src = stub([cand('a', 5), cand('a', 6)]);
    const r = await matchVenue(LAT, LON, src, { lookupEnabled: true, knownVenues: [] });
    expect(r.candidates).toHaveLength(1);
  });
});

describe('matchVenue: fallback when MapKit-style lookup returns nothing', () => {
  it('uses venues already in the log within range when search is empty', async () => {
    const r = await matchVenue(LAT, LON, stub([]), {
      lookupEnabled: true,
      knownVenues: [known('v1', 'Via Carota'), known('far', 'Far Away', { latitude: LAT + 0.01 })],
    });
    expect(r.source).toBe('known');
    expect(r.candidates.map((c) => c.name)).toEqual(['Via Carota']);
    expect(r.candidates[0].knownVenueId).toBe('v1');
  });

  it('falls back to logged venues when the search throws', async () => {
    const r = await matchVenue(LAT, LON, throwing, {
      lookupEnabled: true,
      knownVenues: [known('v1', 'Via Carota')],
    });
    expect(r.source).toBe('known');
    expect(r.candidates[0].name).toBe('Via Carota');
  });

  it('returns a synthetic manual-entry candidate when nothing else exists', async () => {
    const r = await matchVenue(LAT, LON, stub([]), { lookupEnabled: true, knownVenues: [] });
    expect(r.source).toBe('unknown');
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].needsManualName).toBe(true);
    expect(r.candidates[0].name).toContain('West Village');
    expect(r.candidates[0].mapItemId).toBeNull();
  });

  it('returns the manual-entry candidate when the search throws and the log is empty', async () => {
    const r = await matchVenue(LAT, LON, throwing, { lookupEnabled: true, knownVenues: [] });
    expect(r.source).toBe('unknown');
    expect(r.candidates[0].needsManualName).toBe(true);
  });

  it('treats a hung search as empty after the timeout', async () => {
    const hung: VenueSource = { search: () => new Promise(() => undefined) };
    const r = await matchVenue(LAT, LON, hung, {
      lookupEnabled: true,
      knownVenues: [],
      timeoutMs: 20,
    });
    expect(r.source).toBe('unknown');
  });

  it('never calls the source when lookup is switched off', async () => {
    const search = vi.fn(async () => [cand('a', 1)]);
    const r = await matchVenue(LAT, LON, { search }, {
      lookupEnabled: false,
      knownVenues: [known('v1', 'Via Carota')],
    });
    expect(search).not.toHaveBeenCalled();
    expect(r.source).toBe('known');
  });

  it('pads sparse search results with nearby logged venues', async () => {
    const r = await matchVenue(LAT, LON, stub([cand('New Spot', 10)]), {
      lookupEnabled: true,
      knownVenues: [known('v1', 'Via Carota')],
    });
    expect(r.source).toBe('search');
    expect(r.candidates.map((c) => c.name)).toEqual(['New Spot', 'Via Carota']);
  });
});
