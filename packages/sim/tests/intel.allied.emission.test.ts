import { describe, it, expect } from 'vitest';
import {
  breakAlliance,
  computeVisibility,
  factionIntelRecords,
  formAlliance,
  INTEL_DECAY_WINDOW_MS,
  pruneRecordsByObserver,
  recordAlliedObservations,
  recordIntelObservations,
  tick,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { SCOUT_UNIT_TYPE_ID } from '../src/scout';
import type { IntelRecord, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';
const ELIZABETH = 'faction-player';
const BRITAIN = 'faction-britain';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';

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

describe('allied intel emission', () => {
  it("copies ally direct records into the partner store as 'allied'", () => {
    const base = createSprint4World(START_MS);
    const allied = formAlliance(base, GENGHIS, CAESAR, START_MS).world;
    const observedAt = START_MS + 3_600_000;
    const snapshot = {
      ownerId: GENGHIS,
      infraLevel: 2,
      garrisonCount: 8,
      visibleEnemyGarrison: 0,
      inTransitCount: 0,
    };

    const withGenghisIntel: WorldState = {
      ...allied,
      nowMs: observedAt,
      intel: {
        ...allied.intel,
        [GENGHIS]: [directRecord(GENGHIS, BERLIN, observedAt, snapshot)],
      },
    };

    const store = recordAlliedObservations(withGenghisIntel, observedAt);
    const caesarAllied = (store[CAESAR] ?? []).filter((record) => record.source === 'allied');

    expect(caesarAllied).toHaveLength(1);
    expect(caesarAllied[0]?.observerFaction).toBe(GENGHIS);
    expect(caesarAllied[0]?.territoryId).toBe(BERLIN);
    expect(caesarAllied[0]?.snapshot).toEqual(snapshot);
    expect(caesarAllied[0]?.expiresAt).toBeNull();
  });

  it('preserves observerFaction as the original observer, not the receiver', () => {
    const base = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const observedAt = START_MS + 1_000;
    const world: WorldState = {
      ...base,
      nowMs: observedAt,
      intel: {
        ...base.intel,
        [GENGHIS]: [
          directRecord(GENGHIS, PARIS, observedAt, {
            ownerId: CAESAR,
            infraLevel: 1,
            garrisonCount: 120,
            visibleEnemyGarrison: 0,
            inTransitCount: 0,
          }),
        ],
      },
    };

    const store = recordAlliedObservations(world, observedAt);
    const shared = store[CAESAR]?.find((record) => record.source === 'allied');

    expect(shared?.observerFaction).toBe(GENGHIS);
    expect(shared?.observerFaction).not.toBe(CAESAR);
  });

  it('does not re-share allied records (non-transitive)', () => {
    const base = createSprint4World(START_MS);
    let world = formAlliance(base, GENGHIS, CAESAR, START_MS).world;
    world = formAlliance(world, GENGHIS, BRITAIN, START_MS).world;
    const observedAt = START_MS + 2_000;

    world = {
      ...world,
      nowMs: observedAt,
      intel: {
        ...world.intel,
        [GENGHIS]: [
          directRecord(GENGHIS, BERLIN, observedAt, {
            ownerId: GENGHIS,
            infraLevel: 1,
            garrisonCount: 8,
            visibleEnemyGarrison: 0,
            inTransitCount: 0,
          }),
          {
            observerFaction: BRITAIN,
            territoryId: 'territory-madrid',
            observationTime: observedAt,
            snapshot: {
              ownerId: BRITAIN,
              infraLevel: 1,
              garrisonCount: 40,
              visibleEnemyGarrison: 0,
              inTransitCount: 0,
            },
            source: 'allied',
            expiresAt: null,
            confidence: 1.0,
          },
        ],
      },
    };

    const store = recordAlliedObservations(world, observedAt);
    const caesarAllied = (store[CAESAR] ?? []).filter((record) => record.source === 'allied');

    expect(caesarAllied.some((record) => record.territoryId === BERLIN)).toBe(true);
    expect(caesarAllied.some((record) => record.territoryId === 'territory-madrid')).toBe(false);
    expect(caesarAllied.some((record) => record.observerFaction === BRITAIN)).toBe(false);
  });

  it('breakAlliance immediately prunes allied records from both factions', () => {
    const base = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const observedAt = START_MS + 4_000;
    const withIntel: WorldState = {
      ...base,
      nowMs: observedAt,
      intel: {
        ...base.intel,
        [GENGHIS]: [
          directRecord(GENGHIS, BERLIN, observedAt, {
            ownerId: GENGHIS,
            infraLevel: 1,
            garrisonCount: 8,
            visibleEnemyGarrison: 0,
            inTransitCount: 0,
          }),
        ],
      },
    };

    const shared = recordAlliedObservations(withIntel, observedAt);
    const beforeBreak: WorldState = { ...withIntel, intel: shared };
    expect(
      (beforeBreak.intel[CAESAR] ?? []).some(
        (record) => record.source === 'allied' && record.observerFaction === GENGHIS,
      ),
    ).toBe(true);

    const broken = breakAlliance(beforeBreak, GENGHIS, CAESAR);
    expect(
      (broken.intel[CAESAR] ?? []).some(
        (record) => record.source === 'allied' && record.observerFaction === GENGHIS,
      ),
    ).toBe(false);
    expect(
      (broken.intel[GENGHIS] ?? []).some(
        (record) => record.source === 'allied' && record.observerFaction === CAESAR,
      ),
    ).toBe(false);
  });

  it('allied records decay via the 24h observation window', () => {
    const observedAt = START_MS;
    const record: IntelRecord = {
      observerFaction: GENGHIS,
      territoryId: BERLIN,
      observationTime: observedAt,
      snapshot: {
        ownerId: GENGHIS,
        infraLevel: 1,
        garrisonCount: 1,
        visibleEnemyGarrison: 0,
        inTransitCount: 0,
      },
      source: 'allied',
      expiresAt: null,
      confidence: 0.9,
    };

    const world = {
      ...createSprint4World(observedAt + INTEL_DECAY_WINDOW_MS + 1),
      intel: { [CAESAR]: [record] },
    };

    expect(factionIntelRecords(world, CAESAR)).toHaveLength(0);
  });

  it('tick records direct/scout first, then emits allied shares at the boundary', () => {
    const world = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const withScouts: WorldState = {
      ...world,
      units: {
        ...world.units,
        'scout-genghis': {
          id: 'scout-genghis',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: GENGHIS,
          count: 1,
          locationId: BERLIN,
          stance: 'hold',
        },
        'scout-caesar': {
          id: 'scout-caesar',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: CAESAR,
          count: 1,
          locationId: PARIS,
          stance: 'hold',
        },
      },
    };

    const { world: observed } = tick(withScouts, [], 3_600_000);
    const genghisAllied = (observed.intel[CAESAR] ?? []).filter((record) => record.source === 'allied');
    const caesarAllied = (observed.intel[GENGHIS] ?? []).filter((record) => record.source === 'allied');

    expect(genghisAllied.length).toBeGreaterThan(0);
    expect(caesarAllied.length).toBeGreaterThan(0);
    expect(genghisAllied.every((record) => record.observerFaction === GENGHIS)).toBe(true);
    expect(caesarAllied.every((record) => record.observerFaction === CAESAR)).toBe(true);
  });

  it('pruneRecordsByObserver removes only allied records from the named observer', () => {
    const records = [
      directRecord(GENGHIS, BERLIN, START_MS, {
        ownerId: GENGHIS,
        infraLevel: 1,
        garrisonCount: 1,
        visibleEnemyGarrison: 0,
        inTransitCount: 0,
      }),
      {
        observerFaction: GENGHIS,
        territoryId: PARIS,
        observationTime: START_MS,
        snapshot: {
          ownerId: CAESAR,
          infraLevel: 1,
          garrisonCount: 2,
          visibleEnemyGarrison: 0,
          inTransitCount: 0,
        },
        source: 'allied' as const,
        expiresAt: null,
        confidence: 1.0,
      },
    ];

    const pruned = pruneRecordsByObserver(records, GENGHIS);
    expect(pruned).toHaveLength(1);
    expect(pruned[0]?.source).toBe('direct');
  });

  it('production code emits allied records when alliances exist', () => {
    const world = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const withDirect = recordIntelObservations(world);
    const withAllied = recordAlliedObservations({ ...world, intel: withDirect });

    const alliedRecords = Object.values(withAllied).flatMap(
      (records) => records?.filter((record) => record.source === 'allied') ?? [],
    );
    expect(alliedRecords.length).toBeGreaterThan(0);
  });

  it('shared allied intel can make foreign territory live for the receiver', () => {
    const base = formAlliance(createSprint4World(START_MS), GENGHIS, CAESAR, START_MS).world;
    const observedAt = START_MS + 5_000;
    const world: WorldState = {
      ...base,
      nowMs: observedAt,
      intel: recordAlliedObservations(
        {
          ...base,
          nowMs: observedAt,
          intel: {
            ...base.intel,
            [GENGHIS]: [
              directRecord(GENGHIS, BERLIN, observedAt, {
                ownerId: GENGHIS,
                infraLevel: 2,
                garrisonCount: 8,
                visibleEnemyGarrison: 0,
                inTransitCount: 0,
              }),
            ],
          },
        },
        observedAt,
      ),
    };

    const caesarView = computeVisibility(world, CAESAR).territoryStates[BERLIN];
    expect(caesarView?.state).toBe('live');
    if (caesarView?.state === 'live') {
      expect(caesarView.sources).toContain('allied');
    }
  });
});
