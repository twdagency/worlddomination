import { describe, expect, it } from 'vitest';
import { canBuild, ensureWorldMigrations, SCOUT_UNIT_TYPE_ID } from 'sim';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const PLAYER = 'faction-player';

describe('scout build end-to-end', () => {
  it('migrates a legacy save missing scout-t1 and allows building a scout', () => {
    const fresh = createSprint4World(START_MS);
    const { [SCOUT_UNIT_TYPE_ID]: _removed, ...legacyUnitTypes } = fresh.unitTypes;
    const legacySave = {
      ...fresh,
      unitTypes: legacyUnitTypes,
    };

    expect(canBuild(legacySave, LONDON, SCOUT_UNIT_TYPE_ID, 1, PLAYER).ok).toBe(false);

    const migrated = ensureWorldMigrations(legacySave, {
      unitTypes: UNIT_TYPES_BY_ID,
      leaders: LEADERS_BY_ID,
    });

    const check = canBuild(migrated, LONDON, SCOUT_UNIT_TYPE_ID, 1, PLAYER);
    expect(check.ok).toBe(true);
    expect(migrated.unitTypes[SCOUT_UNIT_TYPE_ID]?.name).toBe('Scout');
  });
});
