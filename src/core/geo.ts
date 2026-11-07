const EARTH_RADIUS_M = 6_371_000;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Latitude offset (degrees) that moves a point `metres` due north. */
export function metresToLatDegrees(metres: number): number {
  return (metres / EARTH_RADIUS_M) * (180 / Math.PI);
}

/** Round coordinates, used for cache keys and to limit precision sent to Overpass. */
export function roundCoord(value: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Like haversineM but tolerates missing coordinates: unknown distance is Infinity. */
export function distanceOrInfinity(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null,
): number {
  if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) return Infinity;
  return haversineM(lat1, lon1, lat2, lon2);
}
