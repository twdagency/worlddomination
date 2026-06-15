import type { Coord } from './types';

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Great-circle distance in kilometres between two coordinates. */
export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Position along the great-circle arc from `a` to `b` at `fraction` ∈ [0, 1]. */
export function interpolateGreatCircle(a: Coord, b: Coord, fraction: number): Coord {
  const t = Math.max(0, Math.min(1, fraction));
  if (t === 0) return { lat: a.lat, lon: a.lon };
  if (t === 1) return { lat: b.lat, lon: b.lon };

  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);

  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );

  if (d === 0) return { lat: a.lat, lon: a.lon };

  const sinD = Math.sin(d);
  const aWeight = Math.sin((1 - t) * d) / sinD;
  const bWeight = Math.sin(t * d) / sinD;

  const x = aWeight * Math.cos(lat1) * Math.cos(lon1) + bWeight * Math.cos(lat2) * Math.cos(lon2);
  const y = aWeight * Math.cos(lat1) * Math.sin(lon1) + bWeight * Math.cos(lat2) * Math.sin(lon2);
  const z = aWeight * Math.sin(lat1) + bWeight * Math.sin(lat2);

  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}
