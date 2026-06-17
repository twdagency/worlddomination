import { describe, expect, it } from 'vitest';
import { LEADERS_BY_ID, UNIT_TYPES_BY_ID } from '../../shared/src';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  ensureWorldMigrations,
  TUTORIAL_ACTIVE_TIME_MULTIPLIER,
} from '../src';

const START_MS = 1_700_200_000_000;

const TERRITORY_IDS = [
  'territory-london-tutorial',
  'territory-paris-tutorial',
  'territory-burgundy-tutorial',
  'territory-calais-tutorial',
] as const;

function playerStarterUnit(world: ReturnType<typeof createTutorialWorld>) {
  return Object.values(world.units).find(
    (unit) =>
      unit.ownerId === 'faction-britain-tutorial' &&
      unit.locationId === 'territory-london-tutorial',
  );
}

describe('scenario tutorial', () => {
  it('createTutorialWorld returns world with tutorial active at movement beat', () => {
    const world = createTutorialWorld(START_MS);
    expect(world.tutorial?.active).toBe(true);
    expect(world.tutorial?.currentBeat).toBe('movement');
    expect(world.scenarioId).toBe('tutorial');
    expect(world.countries).toBeDefined();
    expect(Object.keys(world.countries ?? {})).toHaveLength(3);
  });

  it('constructs countries with canonical tutorial capitals at creation', () => {
    const world = createTutorialWorld(START_MS);
    expect(world.countries!['faction-britain-tutorial']?.capitalTerritoryId).toBe(
      'territory-london-tutorial',
    );
    expect(world.countries!['faction-france-tutorial']?.capitalTerritoryId).toBe(
      'territory-paris-tutorial',
    );
    expect(world.countries!['faction-burgundy-tutorial']?.capitalTerritoryId).toBe(
      'territory-burgundy-tutorial',
    );
    for (const country of Object.values(world.countries ?? {})) {
      expect(country.defeated).toBe(false);
    }
  });

  it('createTutorialWorld sets timeMultiplier to 30', () => {
    const world = createTutorialWorld(START_MS);
    expect(world.timeMultiplier).toBe(30);
    expect(world.timeMultiplier).toBe(TUTORIAL_ACTIVE_TIME_MULTIPLIER);
  });

  it('geography has exactly four tutorial territories', () => {
    const world = createTutorialWorld(START_MS);
    expect(Object.keys(world.territories)).toHaveLength(4);
    for (const id of TERRITORY_IDS) {
      expect(world.territories[id]).toBeDefined();
    }
    expect(world.territories['territory-london-tutorial']?.name).toBe('London');
    expect(world.territories['territory-paris-tutorial']?.name).toBe('Paris');
    expect(world.territories['territory-burgundy-tutorial']?.name).toBe('Burgundy');
    expect(world.territories['territory-calais-tutorial']?.name).toBe('Calais');
  });

  it('factions: three tutorial factions; player owns London with tier-1 infantry', () => {
    const world = createTutorialWorld(START_MS);
    expect(Object.keys(world.factions)).toHaveLength(3);
    expect(world.factions['faction-britain-tutorial']?.isPlayer).toBe(true);
    expect(world.territories['territory-london-tutorial']?.ownerId).toBe(
      'faction-britain-tutorial',
    );

    const starter = playerStarterUnit(world);
    expect(starter).toBeDefined();
    expect(starter?.typeId).toBe('levy-t1');
    expect(starter?.count).toBe(1);
  });

  it('food pinch: London scarce, Burgundy surplus, Paris limited conquest gain', () => {
    const world = createTutorialWorld(START_MS);
    expect(world.territories['territory-london-tutorial']?.resources.food).toBe(15);
    expect(world.territories['territory-burgundy-tutorial']?.resources.food).toBeGreaterThanOrEqual(
      100,
    );
    expect(world.territories['territory-paris-tutorial']?.resources.food).toBeLessThanOrEqual(15);
  });

  it('Burgundy and Calais share owner for treaty path', () => {
    const world = createTutorialWorld(START_MS);
    const burgundyOwner = world.territories['territory-burgundy-tutorial']?.ownerId;
    const calaisOwner = world.territories['territory-calais-tutorial']?.ownerId;
    expect(burgundyOwner).toBe('faction-burgundy-tutorial');
    expect(calaisOwner).toBe(burgundyOwner);
  });

  it('round-trip serialization preserves tutorial state', () => {
    const world = createTutorialWorld(START_MS);
    const roundTripped = JSON.parse(JSON.stringify(world)) as ReturnType<typeof createTutorialWorld>;
    expect(roundTripped.tutorial?.active).toBe(true);
    expect(roundTripped.tutorial?.currentBeat).toBe('movement');
    expect(roundTripped.timeMultiplier).toBe(30);
  });

  it('ensureWorldMigrations preserves hand-authored tutorial state', () => {
    const world = createTutorialWorld(START_MS);
    const migrated = ensureWorldMigrations(world, {
      unitTypes: UNIT_TYPES_BY_ID,
      leaders: LEADERS_BY_ID,
    });
    expect(migrated.tutorial?.active).toBe(true);
    expect(migrated.tutorial?.currentBeat).toBe('movement');
    expect(migrated.timeMultiplier).toBe(30);
  });

  it('determinism: two calls produce structurally identical worlds', () => {
    const left = createTutorialWorld(START_MS);
    const right = createTutorialWorld(START_MS);
    expect(left).toEqual(right);
  });
});
