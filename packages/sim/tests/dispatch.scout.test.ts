import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  computeBeatId,
  dispatchLineForEvent,
  emitIntelReportEvents,
  formatIntelReportLine,
  groupEventsByBeat,
  renderDigestText,
  SCOUT_UNIT_TYPE_ID,
  tick,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { tagOrder } from './fixtures';
import type { IntelRecord, Order, SimEvent, WorldState } from '../src/types';

const START_MS = 1_700_400_000_000;
const TWELVE_HOURS_MS = 12 * 3_600_000;
const LONDON = 'territory-london';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';

function withLondonScout(world: WorldState): WorldState {
  return {
    ...world,
    units: {
      ...world.units,
      'unit-player-scout': {
        id: 'unit-player-scout',
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: 'faction-player',
        count: 1,
        locationId: LONDON,
        stance: 'hold',
      },
    },
  };
}

describe('scout dispatch integration', () => {
  it('uses mechanical scout phrasing variants', () => {
    const world = createSprint4World(START_MS);
    const base = {
      kind: 'intelReport' as const,
      at: world.nowMs,
      observerFaction: 'faction-player',
      territoryId: BERLIN,
      source: 'scout' as const,
      beatId: computeBeatId('faction-player', world.nowMs, 'scout'),
      decisionTickMs: world.nowMs,
    };

    expect(
      formatIntelReportLine(world, {
        ...base,
        variant: 'activity',
        subjectFactionId: 'faction-steppe',
        intent: 'defend',
      }),
    ).toBe('INTEL — Scouts report Genghis activity at Berlin (Steppe)');

    expect(
      formatIntelReportLine(world, {
        ...base,
        variant: 'massing',
        subjectFactionId: 'faction-steppe',
        intent: 'attack',
      }),
    ).toBe('INTEL — Scouts report Genghis forces massing at Berlin (Steppe)');

    expect(
      formatIntelReportLine(world, {
        ...base,
        variant: 'construction',
        intent: 'build',
      }),
    ).toBe('INTEL — Scouts report construction at Berlin (Steppe)');
  });

  it('emits scout intelReport on tick when scout observes', () => {
    const { events } = tick(withLondonScout(createSprint4World(START_MS)), [], 3_600_000);
    const reports = events.filter((event) => event.kind === 'intelReport');
    expect(reports.length).toBeGreaterThan(0);
    expect(reports[0]).toMatchObject({ source: 'scout', territoryId: BERLIN });
    expect(dispatchLineForEvent(createSprint4World(START_MS), reports[0])).toContain(
      'Scouts report',
    );
  });

  it('dedupes scout report when direct also observes same territory same tick', () => {
    const world = createSprint4World(START_MS);
    const observationTime = world.nowMs;
    const snapshot = {
      ownerId: 'faction-steppe',
      infraLevel: 1,
      garrisonCount: 8,
      visibleEnemyGarrison: 0,
      inTransitCount: 0,
      buildQueueCount: 0,
    };
    const scoutRecord: IntelRecord = {
      observerFaction: 'faction-player',
      territoryId: BERLIN,
      observationTime,
      source: 'scout',
      snapshot,
    };
    const directRecord: IntelRecord = {
      ...scoutRecord,
      source: 'direct',
    };

    const events = emitIntelReportEvents(
      world,
      { 'faction-player': [] },
      { 'faction-player': [scoutRecord, directRecord] },
      observationTime,
    );
    expect(events.filter((event) => event.kind === 'intelReport')).toHaveLength(0);
  });

  it('groups direct movement and scout reports as distinct beats', () => {
    const world = createSprint4World(START_MS);
    const decisionTickMs = world.nowMs;
    const departure: SimEvent = {
      kind: 'departure',
      at: world.nowMs,
      unitId: 'unit-player-scout',
      fromTerritoryId: LONDON,
      toTerritoryId: BERLIN,
      ownerId: 'faction-player',
      unitTypeId: SCOUT_UNIT_TYPE_ID,
      count: 1,
      stanceOnArrival: 'assault',
      intent: 'attack',
      source: 'direct',
      beatId: computeBeatId('faction-player', decisionTickMs, 'direct'),
      decisionTickMs,
    };
    const scoutReport: SimEvent = {
      kind: 'intelReport',
      at: world.nowMs,
      observerFaction: 'faction-player',
      territoryId: PARIS,
      source: 'scout',
      variant: 'activity',
      subjectFactionId: 'faction-rome',
      intent: 'defend',
      beatId: computeBeatId('faction-player', decisionTickMs, 'scout'),
      decisionTickMs,
    };

    expect(groupEventsByBeat(world, [departure, scoutReport])).toHaveLength(2);
  });

  it('dedupes per tick only — scout report fires after direct source ends', () => {
    const world = createSprint4World(START_MS);
    const observationTime = world.nowMs;
    const snapshot = {
      ownerId: 'faction-steppe',
      infraLevel: 1,
      garrisonCount: 8,
      visibleEnemyGarrison: 0,
      inTransitCount: 0,
      buildQueueCount: 0,
    };
    const scoutRecord: IntelRecord = {
      observerFaction: 'faction-player',
      territoryId: BERLIN,
      observationTime,
      source: 'scout',
      snapshot,
    };
    const directRecord: IntelRecord = { ...scoutRecord, source: 'direct' };

    const deduped = emitIntelReportEvents(
      world,
      { 'faction-player': [] },
      { 'faction-player': [scoutRecord, directRecord] },
      observationTime,
    );
    expect(deduped.filter((event) => event.kind === 'intelReport')).toHaveLength(0);

    const nextTick = observationTime + 3_600_000;
    const scoutOnly = emitIntelReportEvents(
      world,
      { 'faction-player': [directRecord] },
      { 'faction-player': [directRecord, { ...scoutRecord, observationTime: nextTick }] },
      nextTick,
    );
    expect(scoutOnly.filter((event) => event.kind === 'intelReport')).toHaveLength(1);
  });

  it('cold-read: build scout, move toward Berlin, skip 12h digest', () => {
    let world = createSprint4World(START_MS);
    const allEvents: SimEvent[] = [];

    const buildOrder = tagOrder(world, {
      kind: 'build',
      territoryId: LONDON,
      unitTypeId: SCOUT_UNIT_TYPE_ID,
      count: 1,
    }) as Order;

    const built = tick(world, [buildOrder], 0);
    world = built.world;
    allEvents.push(...built.events);

    const queueItem = world.territories[LONDON]?.buildQueue?.[0];
    expect(queueItem).toBeDefined();
    const completeAt = queueItem!.startMs + queueItem!.durationMs;
    const afterBuild = advanceTo(world, completeAt);
    world = afterBuild.world;
    allEvents.push(...afterBuild.events);

    const scoutId = Object.keys(world.units).find(
      (id) => world.units[id]?.typeId === SCOUT_UNIT_TYPE_ID,
    );
    expect(scoutId).toBeDefined();

    const moveOrder = tagOrder(world, {
      kind: 'move',
      unitId: scoutId!,
      toTerritoryId: BERLIN,
      stanceOnArrival: 'hold',
      count: 1,
    }) as Order;

    const moved = tick(world, [moveOrder], 0);
    world = moved.world;
    allEvents.push(...moved.events);

    const afterSkip = advanceTo(world, world.nowMs + TWELVE_HOURS_MS);
    world = afterSkip.world;
    allEvents.push(...afterSkip.events);

    const digest = renderDigestText(world, allEvents);
    expect(digest).toMatchSnapshot('cold-read-scout-digest');
    expect(digest).toContain('Scouts report');
    expect(digest).not.toContain('Scout patrol');
    expect(digest).not.toContain('Scouts probe');
  });
});
