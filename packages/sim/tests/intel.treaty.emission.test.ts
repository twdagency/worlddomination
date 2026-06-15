import { describe, it, expect } from 'vitest';
import {
  computeVisibility,
  factionIntelRecords,
  formAlliance,
  formTreaty,
  INTEL_DECAY_WINDOW_MS,
  isRecordExpired,
  mergeTerritoryVisibility,
  pruneExpiredRecords,
  recordAlliedObservations,
  recordIntelObservations,
  recordTreatyObservations,
  tick,
} from '../src';
import { activeSight } from '../src/sight';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { IntelRecord, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';
const FORTY_EIGHT_HOURS_MS = 48 * 3_600_000;

function directRecord(
  observerFaction: string,
  territoryId: string,
  observationTime: number,
  snapshot: IntelRecord['snapshot'],
): IntelRecord {
  return {
    observerFaction,
    territoryId,
    observationTime,
    snapshot,
    source: 'direct',
    expiresAt: null,
    confidence: 1.0,
  };
}

const BERLIN_SNAPSHOT = {
  ownerId: GENGHIS,
  infraLevel: 2,
  garrisonCount: 8,
  visibleEnemyGarrison: 0,
  inTransitCount: 0,
};

const PARIS_SNAPSHOT = {
  ownerId: CAESAR,
  infraLevel: 1,
  garrisonCount: 120,
  visibleEnemyGarrison: 0,
  inTransitCount: 0,
};

describe('treaty intel emission', () => {
  it('shares scoped territory intel as treaty-sourced with treaty expiresAt', () => {
    const base = createSprint4World(START_MS);
    const withTreaty = formTreaty(base, {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });
    const observedAt = START_MS + 1_000;

    const world: WorldState = {
      ...withTreaty,
      nowMs: observedAt,
      intel: {
        ...withTreaty.intel,
        [GENGHIS]: [directRecord(GENGHIS, BERLIN, observedAt, BERLIN_SNAPSHOT)],
      },
    };

    const store = recordTreatyObservations(world, observedAt);
    const treatyRecords = (store[CAESAR] ?? []).filter((record) => record.source === 'treaty');

    expect(treatyRecords).toHaveLength(1);
    expect(treatyRecords[0]?.observerFaction).toBe(GENGHIS);
    expect(treatyRecords[0]?.territoryId).toBe(BERLIN);
    expect(treatyRecords[0]?.expiresAt).toBe(START_MS + FORTY_EIGHT_HOURS_MS);
  });

  it('does not share records outside treaty scope', () => {
    const withTreaty = formTreaty(createSprint4World(START_MS), {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });
    const observedAt = START_MS + 2_000;

    const world: WorldState = {
      ...withTreaty,
      nowMs: observedAt,
      intel: {
        ...withTreaty.intel,
        [GENGHIS]: [
          directRecord(GENGHIS, BERLIN, observedAt, BERLIN_SNAPSHOT),
          directRecord(GENGHIS, PARIS, observedAt, PARIS_SNAPSHOT),
        ],
      },
    };

    const store = recordTreatyObservations(world, observedAt);
    const treatyTerritories = (store[CAESAR] ?? [])
      .filter((record) => record.source === 'treaty')
      .map((record) => record.territoryId);

    expect(treatyTerritories).toContain(BERLIN);
    expect(treatyTerritories).not.toContain(PARIS);
  });

  it('drops treaty records from merge when treaty expiresAt is reached', () => {
    const expiresAt = START_MS + FORTY_EIGHT_HOURS_MS;
    const observedAt = START_MS + 1_000;
    const world: WorldState = {
      ...createSprint4World(expiresAt),
      intel: {
        [CAESAR]: [
          {
            observerFaction: GENGHIS,
            territoryId: BERLIN,
            observationTime: observedAt,
            snapshot: BERLIN_SNAPSHOT,
            source: 'treaty',
            expiresAt,
            confidence: 0.8,
          },
        ],
      },
    };

    const records = pruneExpiredRecords(factionIntelRecords(world, CAESAR), world.nowMs);
    expect(records).toHaveLength(0);

    const merged = mergeTerritoryVisibility(
      world,
      CAESAR,
      BERLIN,
      activeSight(world, CAESAR),
    );
    expect(merged.state).toBe('unknown');
  });

  it('decays treaty records before treaty expiresAt when observation is older than decay window', () => {
    const observedAt = START_MS;
    const expiresAt = START_MS + FORTY_EIGHT_HOURS_MS;
    const record: IntelRecord = {
      observerFaction: GENGHIS,
      territoryId: BERLIN,
      observationTime: observedAt,
      snapshot: BERLIN_SNAPSHOT,
      source: 'treaty',
      expiresAt,
      confidence: 1.0,
    };

    const atDecayBoundary = observedAt + INTEL_DECAY_WINDOW_MS + 1;
    expect(isRecordExpired(record, atDecayBoundary)).toBe(true);
    expect(atDecayBoundary).toBeLessThan(expiresAt);
  });

  it('alliance and treaty between same parties accumulate both source types', () => {
    const base = createSprint4World(START_MS);
    let world = formAlliance(base, GENGHIS, CAESAR, START_MS);
    world = formTreaty(world, {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });

    const observedAt = START_MS + 3_000;
    world = {
      ...world,
      nowMs: observedAt,
      intel: {
        ...world.intel,
        [GENGHIS]: [directRecord(GENGHIS, BERLIN, observedAt, BERLIN_SNAPSHOT)],
      },
    };

    const afterAllied = recordAlliedObservations(world, observedAt);
    const afterTreaty = recordTreatyObservations({ ...world, intel: afterAllied }, observedAt);
    const caesarRecords = afterTreaty[CAESAR] ?? [];

    expect(caesarRecords.some((record) => record.source === 'allied')).toBe(true);
    expect(caesarRecords.some((record) => record.source === 'treaty')).toBe(true);

    const merged = mergeTerritoryVisibility(
      { ...world, intel: afterTreaty },
      CAESAR,
      BERLIN,
      activeSight(world, CAESAR),
    );
    expect(merged.state).toBe('live');
    if (merged.state === 'live') {
      expect(merged.sources.sort()).toEqual(['allied', 'treaty']);
    }
  });

  it('does not re-share allied records through treaty emission', () => {
    const withTreaty = formTreaty(createSprint4World(START_MS), {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });
    const observedAt = START_MS + 4_000;

    const world: WorldState = {
      ...withTreaty,
      nowMs: observedAt,
      intel: {
        ...withTreaty.intel,
        [GENGHIS]: [
          {
            observerFaction: CAESAR,
            territoryId: BERLIN,
            observationTime: observedAt,
            snapshot: BERLIN_SNAPSHOT,
            source: 'allied',
            expiresAt: null,
            confidence: 1.0,
          },
        ],
      },
    };

    const store = recordTreatyObservations(world, observedAt);
    expect((store[CAESAR] ?? []).filter((record) => record.source === 'treaty')).toHaveLength(0);
  });

  it('tick runs direct, allied, then treaty emission in order', () => {
    const world = formTreaty(
      formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS),
      {
        partyA: GENGHIS,
        partyB: CAESAR,
        territoryIds: [BERLIN, PARIS],
        formedAt: START_MS,
        expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
      },
    );

    const { world: observed } = tick(world, [], 3_600_000);
    const caesarRecords = observed.intel[CAESAR] ?? [];

    expect(caesarRecords.some((record) => record.source === 'allied')).toBe(true);
    expect(caesarRecords.some((record) => record.source === 'treaty')).toBe(true);
    expect(caesarRecords.every((record) => ['allied', 'treaty', 'direct', 'scout'].includes(record.source))).toBe(
      true,
    );
  });

  it('production code emits treaty records when treaties exist', () => {
    const world = formTreaty(createSprint4World(START_MS), {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });
    const afterDirect = recordIntelObservations(world);
    const afterAllied = recordAlliedObservations({ ...world, intel: afterDirect });
    const afterTreaty = recordTreatyObservations({ ...world, intel: afterAllied });

    const treatyRecords = Object.values(afterTreaty).flatMap(
      (records) => records?.filter((record) => record.source === 'treaty') ?? [],
    );
    expect(treatyRecords.length).toBeGreaterThan(0);
  });

  it('treaty-shared intel can make scoped foreign territory live for the receiver', () => {
    const observedAt = START_MS + 5_000;
    const base = formTreaty(createSprint4World(observedAt), {
      partyA: GENGHIS,
      partyB: CAESAR,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + FORTY_EIGHT_HOURS_MS,
    });

    const world: WorldState = {
      ...base,
      nowMs: observedAt,
      intel: recordTreatyObservations(
        {
          ...base,
          intel: {
            ...base.intel,
            [GENGHIS]: [directRecord(GENGHIS, BERLIN, observedAt, BERLIN_SNAPSHOT)],
          },
        },
        observedAt,
      ),
    };

    const view = computeVisibility(world, CAESAR).territoryStates[BERLIN];
    expect(view?.state).toBe('live');
    if (view?.state === 'live') {
      expect(view.sources).toContain('treaty');
    }
  });
});
