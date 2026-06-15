import { createSprint2World, SPRINT2_TERRITORIES } from './scenario-sprint2';
import type { WorldState } from 'sim';

const SPRINT3_TERRITORY_OVERRIDES = {
  'territory-london': {
    ...SPRINT2_TERRITORIES['territory-london'],
    extraction: { fuel: 12, steel: 8 },
    resources: { steel: 80, food: 40, fuel: 20 },
  },
  'territory-paris': {
    ...SPRINT2_TERRITORIES['territory-paris'],
    extraction: { rareMetals: 6, fuel: 5 },
    resources: {},
  },
  'territory-berlin': {
    ...SPRINT2_TERRITORIES['territory-berlin'],
    extraction: { steel: 10, fuel: 4 },
    resources: {},
  },
  'territory-madrid': {
    ...SPRINT2_TERRITORIES['territory-madrid'],
    extraction: { food: 15 },
    resources: {},
  },
} as const;

/** Sprint 3 demo: economy + production; London lacks rareMetals extraction. */
export function createSprint3World(nowMs: number = Date.now()): WorldState {
  const base = createSprint2World(nowMs);
  return {
    ...base,
    territories: { ...SPRINT3_TERRITORY_OVERRIDES },
    scenarioId: 'sprint-3-economy-demo',
  };
}

export { SPRINT3_TERRITORY_OVERRIDES };
