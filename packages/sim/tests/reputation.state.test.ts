import { describe, it, expect } from 'vitest';
import {
  breakAlliance,
  ensureWorldDiplomacy,
  formAlliance,
} from '../src/diplomacy';
import {
  REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED,
  REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER,
  createInitialReputation,
} from '../src/reputation';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

const START_MS = 1_700_000_000_000;
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const ELIZABETH = 'faction-player';
const BRITAIN = 'faction-britain';

describe('reputation state', () => {
  it('createInitialReputation materializes all-pairs-zero excluding self', () => {
    const world = createSprint4World(START_MS);
    const reputation = createInitialReputation(world.factions);

    expect(reputation[ELIZABETH][CAESAR]).toBe(0);
    expect(reputation[CAESAR][GENGHIS]).toBe(0);
    expect(reputation[ELIZABETH][ELIZABETH]).toBeUndefined();
    expect(Object.keys(reputation)).toHaveLength(4);
    for (const observer of Object.keys(reputation)) {
      for (const subject of Object.keys(reputation[observer])) {
        expect(reputation[observer][subject]).toBe(0);
      }
    }
  });

  it('migration backfills reputation and preserves partial stored values', () => {
    const modern = createSprint4World(START_MS);
    const legacy = JSON.parse(JSON.stringify(modern)) as Record<string, unknown>;
    delete legacy.reputation;

    const backfilled = ensureWorldDiplomacy(legacy as typeof modern);
    expect(backfilled.reputation[GENGHIS][CAESAR]).toBe(0);
    expect(backfilled.reputation[BRITAIN][ELIZABETH]).toBe(0);

    const partial = {
      ...modern,
      reputation: {
        [ELIZABETH]: { [CAESAR]: -20 },
      },
    } as unknown as typeof modern;

    const migrated = ensureWorldDiplomacy(partial);
    expect(migrated.reputation[ELIZABETH][CAESAR]).toBe(-20);
    expect(migrated.reputation[GENGHIS][CAESAR]).toBe(0);
  });

  it('alliance-break penalty applies betrayed -40 and observer -20 without touching breaker view', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const broken = breakAlliance(allied, GENGHIS, CAESAR);

    expect(broken.reputation[CAESAR][GENGHIS]).toBe(REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED);
    expect(broken.reputation[ELIZABETH][GENGHIS]).toBe(REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER);
    expect(broken.reputation[BRITAIN][GENGHIS]).toBe(REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER);

    expect(broken.reputation[GENGHIS][CAESAR]).toBe(0);
    expect(broken.reputation[GENGHIS][ELIZABETH]).toBe(0);
    expect(broken.reputation[CAESAR][ELIZABETH]).toBe(0);
    expect(broken.reputation[ELIZABETH][BRITAIN]).toBe(0);
  });

  it('repeated identical break sequences produce identical reputation', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;

    const first = breakAlliance(allied, GENGHIS, CAESAR);
    const second = breakAlliance(
      formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world,
      GENGHIS,
      CAESAR,
    );

    expect(first.reputation).toEqual(second.reputation);
  });

  it('breaking a non-existent alliance is a no-op for reputation', () => {
    const world = createSprint4World(START_MS);
    const broken = breakAlliance(world, GENGHIS, CAESAR);

    expect(broken).toBe(world);
    expect(broken.reputation).toEqual(world.reputation);
  });
});
