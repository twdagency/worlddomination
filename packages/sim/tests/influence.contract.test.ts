import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyCoupAttempt,
  applyDefectionClaim,
  applyDiplomaticPressure,
  COUP_INFLUENCE_COST_SUCCESS,
  DIPLOMATIC_PRESSURE_INFLUENCE_COST,
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
  getInfluence,
  queueAllianceProposal,
} from '../src';
import { ensureWorldInfluence, setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import type { WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const PARIS = 'territory-paris';
const LONDON = 'territory-london';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function funded(world: WorldState): WorldState {
  const factions = { ...world.factions };
  for (const [id, faction] of Object.entries(factions)) {
    factions[id] = { ...faction, funding: 50_000, manpower: 500 };
  }
  return { ...world, factions };
}

describe('influence layer contracts (Sprint 9)', () => {
  it('threshold actions consume influence per Q4 spec gates and costs', () => {
    const base = funded(migrate(ensureWorldInfluence(createSprint4World(START_MS))));
    const berlin = 'territory-berlin';
    const pressureWorld = setInfluence(base, berlin, PLAYER, DIPLOMATIC_PRESSURE_MIN_INFLUENCE, START_MS);
    const queued = queueAllianceProposal(pressureWorld, PLAYER, STEPPE, START_MS);
    const pressure = applyDiplomaticPressure(
      queued.world,
      PLAYER,
      berlin,
      STEPPE,
      'accept-alliance',
      START_MS,
    );
    expect(pressure.events.some((event) => event.kind === 'diplomaticPressureApplied')).toBe(true);
    expect(getInfluence(pressure.world, berlin, PLAYER)).toBe(
      DIPLOMATIC_PRESSURE_MIN_INFLUENCE - DIPLOMATIC_PRESSURE_INFLUENCE_COST,
    );

    let coupWorld = setInfluence(base, PARIS, PLAYER, 80, START_MS);
    for (let seed = 0; seed < 200; seed++) {
      const attempt = applyCoupAttempt({ ...coupWorld, rng: { seed } }, PLAYER, PARIS, START_MS);
      if (attempt.events.some((event) => event.kind === 'coupSuccess')) {
        coupWorld = attempt.world;
        break;
      }
    }
    expect(getInfluence(coupWorld, PARIS, PLAYER)).toBe(80 - COUP_INFLUENCE_COST_SUCCESS);
  });

  it('defection at 100 resets other factions influence on that city to 0', () => {
    const world = setInfluence(
      setInfluence(funded(migrate(ensureWorldInfluence(createSprint4World(START_MS)))), PARIS, PLAYER, 100, START_MS),
      PARIS,
      STEPPE,
      40,
      START_MS,
    );
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(result.events.some((event) => event.kind === 'defectionOccurred')).toBe(true);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(0);
    expect(getInfluence(result.world, PARIS, STEPPE)).toBe(0);
  });
});
