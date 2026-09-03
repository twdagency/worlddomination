import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  dispatchLineForEvent,
  evaluateLastCountryStanding,
  stampEvents,
  tick,
} from '../src';
import { ensureWorldMigrations } from '../src/migrations';
import { makeWorld } from './fixtures';
import type { Id, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const FRANCE = 'faction-france-tutorial';
const BURGUNDY = 'faction-burgundy-tutorial';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function markDefeated(world: WorldState, countryIds: Id[]): WorldState {
  const factions = { ...world.factions };
  const countries = { ...(world.countries ?? {}) };
  for (const id of countryIds) {
    if (factions[id]) factions[id] = { ...factions[id]!, defeated: true };
    if (countries[id]) countries[id] = { ...countries[id]!, defeated: true };
  }
  return { ...world, factions, countries };
}

describe('last country standing victory', () => {
  it('does not emit when two of three rivals are still standing', () => {
    const world = markDefeated(migrate(createSprint4World(START_MS)), [ROME]);
    const result = evaluateLastCountryStanding(world, START_MS);
    expect(result.events).toHaveLength(0);
    expect(result.world.victorId).toBeUndefined();
  });

  it('emits once when the last rival falls', () => {
    const world = markDefeated(migrate(createSprint4World(START_MS)), [ROME, STEPPE, BRITAIN]);
    const first = evaluateLastCountryStanding(world, START_MS);
    expect(first.events).toEqual([
      expect.objectContaining({
        kind: 'victory',
        countryId: PLAYER,
        importance: 'high',
      }),
    ]);
    expect(first.world.victorId).toBe(PLAYER);

    const second = evaluateLastCountryStanding(first.world, START_MS + 1);
    expect(second.events).toHaveLength(0);
    expect(second.world.victorId).toBe(PLAYER);
  });

  it('does not emit on a single-country start', () => {
    const world = migrate(makeWorld());
    const result = evaluateLastCountryStanding(world, START_MS);
    expect(result.events).toHaveLength(0);
    expect(result.world.victorId).toBeUndefined();
  });

  it('does not emit when the tutorial last rival would otherwise qualify', () => {
    const world = markDefeated(migrate(createTutorialWorld(START_MS)), [FRANCE, BURGUNDY]);
    const result = evaluateLastCountryStanding(world, START_MS);
    expect(result.events).toHaveLength(0);
    expect(result.world.victorId).toBeUndefined();
  });

  it('lands through tick and formats a public dispatch line', () => {
    const world = markDefeated(migrate(createSprint4World(START_MS)), [ROME, STEPPE, BRITAIN]);
    const result = tick(world, [], 1);
    const victories = result.events.filter((event) => event.kind === 'victory');
    expect(victories).toHaveLength(1);
    expect(result.world.victorId).toBe(PLAYER);

    const stamped = stampEvents(result.world, victories);
    const line = dispatchLineForEvent(stamped.world, stamped.events[0]!);
    expect(line).toMatch(/last country standing/i);
  });
});
