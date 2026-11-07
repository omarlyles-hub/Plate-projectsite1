import { haversineM } from './geo';

export interface NeighborhoodCentroid {
  name: string;
  lat: number;
  lon: number;
}

/** Approximate centroids; good enough for labelling and filtering, not for borders. */
export const NYC_NEIGHBORHOODS: readonly NeighborhoodCentroid[] = [
  { name: 'West Village', lat: 40.7358, lon: -74.0036 },
  { name: 'Greenwich Village', lat: 40.7336, lon: -73.9991 },
  { name: 'East Village', lat: 40.7265, lon: -73.9815 },
  { name: 'SoHo', lat: 40.7233, lon: -74.003 },
  { name: 'NoHo', lat: 40.7273, lon: -73.9926 },
  { name: 'Nolita', lat: 40.7223, lon: -73.9955 },
  { name: 'Little Italy', lat: 40.7191, lon: -73.9973 },
  { name: 'Chinatown', lat: 40.7158, lon: -73.997 },
  { name: 'Lower East Side', lat: 40.715, lon: -73.9843 },
  { name: 'Tribeca', lat: 40.7163, lon: -74.0086 },
  { name: 'Financial District', lat: 40.7075, lon: -74.0089 },
  { name: 'Battery Park City', lat: 40.7115, lon: -74.0158 },
  { name: 'Meatpacking District', lat: 40.7403, lon: -74.0078 },
  { name: 'Chelsea', lat: 40.7465, lon: -74.0014 },
  { name: 'Flatiron', lat: 40.7411, lon: -73.9897 },
  { name: 'Gramercy', lat: 40.7368, lon: -73.9845 },
  { name: 'Kips Bay', lat: 40.7423, lon: -73.9801 },
  { name: 'Murray Hill', lat: 40.7479, lon: -73.9757 },
  { name: 'Midtown', lat: 40.7549, lon: -73.984 },
  { name: 'Midtown East', lat: 40.7557, lon: -73.969 },
  { name: "Hell's Kitchen", lat: 40.7638, lon: -73.9918 },
  { name: 'Upper West Side', lat: 40.787, lon: -73.9754 },
  { name: 'Upper East Side', lat: 40.7736, lon: -73.9566 },
  { name: 'Morningside Heights', lat: 40.81, lon: -73.9626 },
  { name: 'Harlem', lat: 40.8116, lon: -73.9465 },
  { name: 'Washington Heights', lat: 40.8417, lon: -73.9393 },
  { name: 'Williamsburg', lat: 40.7081, lon: -73.9571 },
  { name: 'Greenpoint', lat: 40.7304, lon: -73.9515 },
  { name: 'Bushwick', lat: 40.6944, lon: -73.9213 },
  { name: 'DUMBO', lat: 40.7033, lon: -73.9881 },
  { name: 'Brooklyn Heights', lat: 40.696, lon: -73.9936 },
  { name: 'Cobble Hill', lat: 40.686, lon: -73.9962 },
  { name: 'Carroll Gardens', lat: 40.6795, lon: -73.9991 },
  { name: 'Red Hook', lat: 40.6734, lon: -74.0083 },
  { name: 'Fort Greene', lat: 40.6892, lon: -73.9742 },
  { name: 'Prospect Heights', lat: 40.6775, lon: -73.9692 },
  { name: 'Park Slope', lat: 40.671, lon: -73.9777 },
  { name: 'Crown Heights', lat: 40.6694, lon: -73.9442 },
  { name: 'Bed-Stuy', lat: 40.6872, lon: -73.9418 },
  { name: 'Long Island City', lat: 40.7447, lon: -73.9485 },
  { name: 'Astoria', lat: 40.7644, lon: -73.9235 },
  { name: 'Jackson Heights', lat: 40.7557, lon: -73.8831 },
  { name: 'Flushing', lat: 40.7675, lon: -73.833 },
];

/** Beyond this distance from every centroid a point is labelled as not-in-NYC. */
const MAX_DISTANCE_M = 5_000;
export const ELSEWHERE = 'Elsewhere';

export function nearestNeighborhood(lat: number, lon: number): string {
  let best = ELSEWHERE;
  let bestDist = MAX_DISTANCE_M;
  for (const n of NYC_NEIGHBORHOODS) {
    const d = haversineM(lat, lon, n.lat, n.lon);
    if (d < bestDist) {
      best = n.name;
      bestDist = d;
    }
  }
  return best;
}
