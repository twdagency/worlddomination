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
import { makeWorld, tagOrder } from './fixtures';
import { applyMoveOrders, previewMoveEtaMs } from '../src';

const START_MS = 1_700_000_000_000;
const BERLIN = 'territory-berlin';
const LONDON = 'territory-london';
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const ELIZABETH = 'faction-player';

describe('diplomacy state', () => {
  it('forming an alliance creates a normalized pair and areAllied returns true', () => {
    const world = createSprint4World(START_MS);
    const formed = formAlliance(world, GENGHIS, CAESAR, START_MS);

    expect(areAllied(formed.world, GENGHIS, CAESAR)).toBe(true);
    expect(formed.world.alliances).toEqual([
      { factionA: CAESAR, factionB: GENGHIS, formedAt: START_MS },
    ]);
  });

  it('breaking an alliance removes the pair', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const broken = breakAlliance(allied, CAESAR, GENGHIS);

    expect(areAllied(broken, GENGHIS, CAESAR)).toBe(false);
    expect(broken.alliances).toEqual([]);
  });

  it('formAlliance is idempotent for existing alliances', () => {
    const once = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS);
    const twice = formAlliance(once.world, CAESAR, GENGHIS, START_MS + 1);

    expect(twice.world).toEqual(once.world);
    expect(twice.events).toEqual([]);
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

    expect(forward.world.alliances).toEqual(reverse.world.alliances);
    expect(normalizeFactionPair(GENGHIS, CAESAR)).toEqual([CAESAR, GENGHIS]);
  });

  it('forming alliances in different orders yields identical sorted state', () => {
    const world = createSprint4World(START_MS);
    const pathA = formAlliance(
      formAlliance(world, CAESAR, GENGHIS, START_MS).world,
      ELIZABETH,
      CAESAR,
      START_MS + 1,
    ).world;
    const pathB = formAlliance(
      formAlliance(world, ELIZABETH, CAESAR, START_MS + 1).world,
      GENGHIS,
      CAESAR,
      START_MS,
    ).world;

    expect(pathA.alliances).toEqual(pathB.alliances);
  });

  it('getAlliancesFor returns sorted ally ids', () => {
    const world = formAlliance(
      formAlliance(createSprint4World(START_MS), CAESAR, GENGHIS, START_MS).world,
      ELIZABETH,
      CAESAR,
      START_MS,
    ).world;

    expect(getAlliancesFor(world, CAESAR).sort()).toEqual(
      [ELIZABETH, GENGHIS].sort(),
    );
  });

  it('formAlliance recalls in-flight assault orders between newly allied factions', () => {
    const base = createSprint4World(START_MS);
    const travelMs = previewMoveEtaMs(base, 'unit-steppe-mg', LONDON)!.travelMs;
    const order = tagOrder(
      base,
      {
        kind: 'move',
        unitId: 'unit-steppe-mg',
        toTerritoryId: LONDON,
        stanceOnArrival: 'assault',
      },
      GENGHIS,
    );
    const { units } = applyMoveOrders(base, [order]);
    const inTransit = { ...base, units };

    const formed = formAlliance(inTransit, ELIZABETH, GENGHIS, START_MS + travelMs / 2);

    expect(formed.events.some((event) => event.kind === 'dispatchCancelledByAlliance')).toBe(true);
    expect(formed.world.units['unit-steppe-mg']?.transit).toBeUndefined();
    expect(formed.world.units['unit-steppe-mg']?.locationId).toBeDefined();
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
