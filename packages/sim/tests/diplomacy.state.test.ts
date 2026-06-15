import { describe, it, expect } from 'vitest';
import {
  areAllied,
  breakAlliance,
  createInitialReputation,
  ensureWorldDiplomacy,
  formAlliance,
  formTreaty,
  getActiveTreaties,
  getAlliancesFor,
  getTreatiesBetween,
  normalizeFactionPair,
  pruneExpiredTreaties,
} from '../src/diplomacy';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { makeWorld } from './fixtures';

const START_MS = 1_700_000_000_000;
const BERLIN = 'territory-berlin';
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const ELIZABETH = 'faction-player';

describe('diplomacy state', () => {
  it('forming an alliance creates a normalized pair and areAllied returns true', () => {
    const world = createSprint4World(START_MS);
    const formed = formAlliance(world, GENGHIS, CAESAR, START_MS);

    expect(areAllied(formed, GENGHIS, CAESAR)).toBe(true);
    expect(formed.alliances).toEqual([
      { factionA: CAESAR, factionB: GENGHIS, formedAt: START_MS },
    ]);
  });

  it('breaking an alliance removes the pair', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS);
    const broken = breakAlliance(allied, CAESAR, GENGHIS);

    expect(areAllied(broken, GENGHIS, CAESAR)).toBe(false);
    expect(broken.alliances).toEqual([]);
  });

  it('formAlliance is idempotent for existing alliances', () => {
    const once = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS);
    const twice = formAlliance(once, CAESAR, GENGHIS, START_MS + 1);

    expect(twice).toBe(once);
    expect(twice.alliances).toEqual(once.alliances);
  });

  it('breakAlliance is a no-op when no alliance exists', () => {
    const world = createSprint4World(START_MS);
    const broken = breakAlliance(world, GENGHIS, CAESAR);

    expect(broken).toBe(world);
    expect(broken.alliances).toEqual([]);
  });

  it('formAlliance normalizes insertion order (Genghis, Caesar) vs (Caesar, Genghis)', () => {
    const world = makeWorld({
      factions: {
        ...makeWorld().factions,
        [CAESAR]: {
          id: CAESAR,
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
        [GENGHIS]: {
          id: GENGHIS,
          leaderId: 'leader-genghis',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
    });

    const forward = formAlliance(world, GENGHIS, CAESAR, START_MS);
    const reverse = formAlliance(world, CAESAR, GENGHIS, START_MS);

    expect(forward.alliances).toEqual(reverse.alliances);
    expect(normalizeFactionPair(GENGHIS, CAESAR)).toEqual([CAESAR, GENGHIS]);
  });

  it('forming alliances in different orders yields identical sorted state', () => {
    const world = createSprint4World(START_MS);
    const pathA = formAlliance(
      formAlliance(world, CAESAR, GENGHIS, START_MS),
      ELIZABETH,
      CAESAR,
      START_MS + 1,
    );
    const pathB = formAlliance(
      formAlliance(world, ELIZABETH, CAESAR, START_MS + 1),
      GENGHIS,
      CAESAR,
      START_MS,
    );

    expect(pathA.alliances).toEqual(pathB.alliances);
  });

  it('getAlliancesFor returns sorted ally ids', () => {
    const world = formAlliance(
      formAlliance(createSprint4World(START_MS), CAESAR, GENGHIS, START_MS),
      ELIZABETH,
      CAESAR,
      START_MS,
    );

    expect(getAlliancesFor(world, CAESAR).sort()).toEqual(
      [ELIZABETH, GENGHIS].sort(),
    );
  });

  it('treaties respect expiresAt and getActiveTreaties filters by game time', () => {
    const world = createSprint4World(START_MS);
    const withTreaty = formTreaty(world, {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + 48 * 3_600_000,
    });

    expect(getActiveTreaties(withTreaty, CAESAR, START_MS)).toHaveLength(1);
    expect(getActiveTreaties(withTreaty, CAESAR, START_MS + 47 * 3_600_000)).toHaveLength(1);
    expect(getActiveTreaties(withTreaty, CAESAR, START_MS + 48 * 3_600_000)).toHaveLength(0);
    expect(getTreatiesBetween(withTreaty, GENGHIS, CAESAR)).toHaveLength(1);
  });

  it('pruneExpiredTreaties removes expired treaties', () => {
    const world = formTreaty(createSprint4World(START_MS), {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + 24 * 3_600_000,
    });

    const pruned = pruneExpiredTreaties(world, START_MS + 24 * 3_600_000);
    expect(pruned.treaties).toEqual([]);
  });

  it('formTreaty uses deterministic content-addressed ids', () => {
    const world = createSprint4World(START_MS);
    const first = formTreaty(world, {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN, 'territory-paris'],
      formedAt: START_MS,
      expiresAt: START_MS + 48 * 3_600_000,
    });
    const duplicate = formTreaty(first, {
      partyA: CAESAR,
      partyB: GENGHIS,
      territoryIds: ['territory-paris', BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + 48 * 3_600_000,
    });

    expect(first.treaties[0]?.id).toMatch(/^treaty-[0-9a-f]{8}$/);
    expect(duplicate).toBe(first);
  });

  it('createInitialReputation materializes all-pairs-zero excluding self', () => {
    const world = createSprint4World(START_MS);
    const reputation = createInitialReputation(world.factions);

    expect(reputation[ELIZABETH][CAESAR]).toBe(0);
    expect(reputation[CAESAR][GENGHIS]).toBe(0);
    expect(reputation[ELIZABETH][ELIZABETH]).toBeUndefined();
    expect(Object.keys(reputation)).toHaveLength(4);
  });

  it('migrates Sprint 5.5 saves without diplomacy fields', () => {
    const modern = createSprint4World(START_MS);
    const legacy = JSON.parse(JSON.stringify(modern)) as Record<string, unknown>;
    delete legacy.alliances;
    delete legacy.treaties;
    delete legacy.reputation;

    const migrated = ensureWorldDiplomacy(legacy as typeof modern);

    expect(migrated.alliances).toEqual([]);
    expect(migrated.treaties).toEqual([]);
    expect(migrated.reputation[ELIZABETH][CAESAR]).toBe(0);
    expect(migrated.reputation[GENGHIS][CAESAR]).toBe(0);
    expect(JSON.stringify(migrated.territories)).toEqual(JSON.stringify(modern.territories));
  });

  it('migration preserves stored reputation values over defaults', () => {
    const modern = createSprint4World(START_MS);
    const legacy = {
      ...modern,
      alliances: undefined,
      treaties: undefined,
      reputation: {
        [ELIZABETH]: { [CAESAR]: -20 },
      },
    } as unknown as typeof modern;

    const migrated = ensureWorldDiplomacy(legacy);
    expect(migrated.reputation[ELIZABETH][CAESAR]).toBe(-20);
    expect(migrated.reputation[GENGHIS][CAESAR]).toBe(0);
  });
});
