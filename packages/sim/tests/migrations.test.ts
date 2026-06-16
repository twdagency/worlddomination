import { describe, expect, it } from 'vitest';
import { canBuild, SCOUT_UNIT_TYPE_ID } from '../src';
import { ensureWorldMigrations } from '../src/migrations';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { LEADERS_BY_ID } from '../../shared/src/leaders';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const PLAYER = 'faction-player';

describe('ensureWorldMigrations', () => {
  it('merges missing unit types from the canonical catalog', () => {
    const legacy = createSprint4World(START_MS);
    const { [SCOUT_UNIT_TYPE_ID]: _removed, ...withoutScout } = legacy.unitTypes;
    const world = { ...legacy, unitTypes: withoutScout };

    expect(world.unitTypes[SCOUT_UNIT_TYPE_ID]).toBeUndefined();

    const migrated = ensureWorldMigrations(world, { unitTypes: UNIT_TYPES_BY_ID });
    expect(migrated.unitTypes[SCOUT_UNIT_TYPE_ID]).toBeDefined();

    const check = canBuild(migrated, LONDON, SCOUT_UNIT_TYPE_ID, 1, PLAYER);
    expect(check.ok).toBe(true);
  });

  it('preserves diplomacy backfill from ensureWorldDiplomacy', () => {
    const modern = createSprint4World(START_MS);
    const legacy = {
      ...modern,
      alliances: undefined,
      treaties: undefined,
      reputation: undefined,
      pendingProposals: undefined,
    } as unknown as typeof modern;

    const migrated = ensureWorldMigrations(legacy);
    expect(migrated.alliances).toEqual([]);
    expect(migrated.pendingProposals).toEqual([]);
    expect(migrated.reputation).toBeDefined();
  });

  it('merges missing leaders without overwriting stored entries', () => {
    const world = createSprint4World(START_MS);
    const { 'leader-philip': _removed, ...withoutPhilip } = world.leaders;
    const legacy = { ...world, leaders: withoutPhilip };

    const migrated = ensureWorldMigrations(legacy, { leaders: LEADERS_BY_ID });
    expect(migrated.leaders['leader-philip']?.name).toBe('Philip II');
  });

  it('backfills formerAllianceIds with an empty array for already-defeated countries', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS), {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    const defeated = {
      ...world,
      countries: {
        ...world.countries!,
        'faction-rome': {
          ...world.countries!['faction-rome']!,
          defeated: true,
        },
      },
      territories: Object.fromEntries(
        Object.entries(world.territories).map(([id, territory]) => [
          id,
          territory.ownerId === 'faction-rome'
            ? { ...territory, ownerId: 'faction-player' }
            : territory,
        ]),
      ),
    };

    const migrated = ensureWorldMigrations(defeated, {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    expect(migrated.countries!['faction-rome']?.formerAllianceIds).toEqual([]);
  });
});
