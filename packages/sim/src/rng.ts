// Deterministic PRNG (mulberry32). The ONLY source of randomness in /sim.
import type { RngState } from './types';

/** Returns a float in [0,1) and the advanced RNG state. Pure. */
export function nextRandom(state: RngState): { value: number; state: RngState } {
  let t = (state.seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: { seed: t } };
}
