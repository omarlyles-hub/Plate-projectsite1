import { useSyncExternalStore } from 'react';

/** Tiny hash router: "#/venue/abc" -> ["venue", "abc"]. */
const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
};
const getHash = () => window.location.hash;

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, getHash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function go(...segments: string[]) {
  window.location.hash = '/' + segments.map(encodeURIComponent).join('/');
}

export function goBack(fallback: string[]) {
  if (window.history.length > 1) window.history.back();
  else go(...fallback);
}
