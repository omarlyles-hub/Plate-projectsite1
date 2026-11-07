import { useCallback, useEffect, useState } from 'react';

export type LocationStatus = 'idle' | 'asking' | 'ok' | 'denied' | 'unavailable';

export interface LocationState {
  status: LocationStatus;
  coords: { lat: number; lon: number } | null;
  request: () => void;
}

/**
 * Browser geolocation, requested only on demand (or silently if the user already granted it).
 * The position stays in memory and is never stored or sent anywhere.
 */
export function useLocation(autoIfGranted = false): LocationState {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);

  const request = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unavailable');
      return;
    }
    setStatus('asking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setStatus('ok');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (!autoIfGranted || !('permissions' in navigator)) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((p) => {
        if (!cancelled && p.state === 'granted') request();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [autoIfGranted, request]);

  return { status, coords, request };
}
