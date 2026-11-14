import { afterEach, describe, expect, it, vi } from 'vitest';
import { newUuid } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('newUuid', () => {
  it('returns a v4 uuid using crypto.randomUUID when available', () => {
    expect(newUuid()).toMatch(V4);
  });

  it('falls back to getRandomValues when randomUUID is missing (insecure context)', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = new Set(Array.from({ length: 200 }, () => newUuid()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toMatch(V4);
  });
});
