import { describe, it, expect } from 'vitest';
import { haversineKm, interpolateGreatCircle } from '../src/geo';

const LONDON = { lat: 51.5074, lon: -0.1278 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
const PARIS = { lat: 48.8566, lon: 2.3522 };

// Reference great-circle distances (km).
const LONDON_NYC_KM = 5570;
const LONDON_PARIS_KM = 344;

describe('geo', () => {
  it('haversineKm matches London–New York within 1%', () => {
    const d = haversineKm(LONDON, NEW_YORK);
    expect(d).toBeGreaterThan(LONDON_NYC_KM * 0.99);
    expect(d).toBeLessThan(LONDON_NYC_KM * 1.01);
  });

  it('haversineKm matches London–Paris within 1%', () => {
    const d = haversineKm(LONDON, PARIS);
    expect(d).toBeGreaterThan(LONDON_PARIS_KM * 0.99);
    expect(d).toBeLessThan(LONDON_PARIS_KM * 1.01);
  });

  it('interpolateGreatCircle returns endpoints at fraction 0 and 1', () => {
    expect(interpolateGreatCircle(LONDON, NEW_YORK, 0)).toEqual(LONDON);
    expect(interpolateGreatCircle(LONDON, NEW_YORK, 1)).toEqual(NEW_YORK);
  });

  it('interpolateGreatCircle mid-point lies along the arc', () => {
    const mid = interpolateGreatCircle(LONDON, NEW_YORK, 0.5);
    const total = haversineKm(LONDON, NEW_YORK);
    const viaMid = haversineKm(LONDON, mid) + haversineKm(mid, NEW_YORK);
    expect(viaMid).toBeGreaterThan(total * 0.98);
    expect(viaMid).toBeLessThan(total * 1.02);
  });
});
