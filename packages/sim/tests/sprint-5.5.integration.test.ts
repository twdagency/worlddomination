import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  computeVisibility,
  decideOrders,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  INTEL_DECAY_WINDOW_MS,
  previewMoveEtaMs,
  renderDigestText,
  SCOUT_UNIT_TYPE_ID,
  tick,
} from '../src';
import { haversineKm } from '../src/geo';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { tagOrder } from './fixtures';
import { analyzeFactionScoutTransits, type ScoutTransitReport } from './scoutTransitAnalysis';
import type { DispatchEvent, Order, WorldState } from '../src/types';

const PLAYER = 'faction-player';
const START_S4 = 1_700_900_000_000;
const START_S5 = 1_700_950_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;

const S4_BERLIN = 'territory-berlin';
const S4_LONDON = 'territory-london';
const S4_PARIS = 'territory-paris';
const S4_MADRID = 'territory-madrid';
const STEPPE = 'faction-steppe';
const S5_ISTANBUL = 'territory-istanbul';
const S5_BELGRADE = 'territory-belgrade';

function genghisScoutFixture(): WorldState {
  const base = createSprint4World(START_S4);
  return {
    ...base,
    units: {
      ...Object.fromEntries(
        Object.entries(base.units).filter(([, unit]) => unit.ownerId !== STEPPE),
      ),
      'unit-steppe-scout': {
        id: 'unit-steppe-scout',
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: STEPPE,
        count: 1,
        locationId: S4_BERLIN,
        stance: 'hold',
      },
    },
    intel: {},
  };
}

function etaReport(world: WorldState, scoutId: string, territoryId: string) {
  const preview = previewMoveEtaMs(world, scoutId, territoryId);
  const travelMs = preview?.travelMs ?? null;
  return {
    territoryId,
    distanceKm: preview ? Math.round(preview.distanceKm) : null,
    travelMs,
    travelHours: travelMs !== null ? travelMs / 3_600_000 : null,
    exceedsDecayWindow: travelMs !== null ? travelMs > INTEL_DECAY_WINDOW_MS : null,
  };
}

function transitFromOrder(world: WorldState, order: Order): ScoutTransitReport | null {
  if (order.kind !== 'move') return null;

  const preview = previewMoveEtaMs(world, order.unitId, order.toTerritoryId);
  const from = world.territories[world.units[order.unitId]?.locationId ?? ''];
  const to = world.territories[order.toTerritoryId];
  const distanceKm = from && to ? Math.round(haversineKm(from.coord, to.coord)) : 0;
  const travelMs = preview?.travelMs ?? 0;

  return {
    unitId: order.unitId,
    fromTerritoryId: from?.id ?? '',
    toTerritoryId: order.toTerritoryId,
    distanceKm,
    transitMs: travelMs,
    transitHours: travelMs / 3_600_000,
    exceedsDecayWindow: travelMs > INTEL_DECAY_WINDOW_MS,
  };
}

function territoryState(world: WorldState, territoryId: string) {
  return computeVisibility(world, PLAYER).territoryStates[territoryId]?.state;
}

function withPlayerScout(world: WorldState, homeTerritoryId: string, scoutId = 'unit-player-scout'): WorldState {
  return {
    ...world,
    units: {
      ...world.units,
      [scoutId]: {
        id: scoutId,
        typeId: SCOUT_UNIT_TYPE_ID,
        ownerId: PLAYER,
        count: 1,
        locationId: homeTerritoryId,
        stance: 'hold',
      },
    },
  };
}

function playerDigest(world: WorldState, events: DispatchEvent[]): string {
  const visible = filterDispatchesForFaction(world, events, PLAYER);
  return renderDigestText(world, visible, undefined, PLAYER);
}

function runIntelArc(
  base: WorldState,
  homeTerritoryId: string,
  targetTerritoryId: string,
): { states: string[]; arcDigest: string } {
  expect(territoryState(base, targetTerritoryId)).toBe('unknown');

  const world = withPlayerScout(base, homeTerritoryId);
  const arcEvents: DispatchEvent[] = [];
  const states: string[] = ['unknown'];

  const { world: withScout, events: observeEvents } = tick(world, [], 3_600_000);
  arcEvents.push(...observeEvents);
  states.push(territoryState(withScout, targetTerritoryId) ?? 'missing');
  expect(territoryState(withScout, targetTerritoryId)).toBe('live');

  const assaultOrder = tagOrder(withScout, {
    kind: 'move',
    unitId: 'unit-player-scout',
    toTerritoryId: targetTerritoryId,
    stanceOnArrival: 'assault',
    count: 1,
  }) as Order;

  const { world: afterDepart, events: departEvents } = tick(withScout, [assaultOrder], 0);
  arcEvents.push(...departEvents);

  const transit = afterDepart.units['unit-player-scout']!.transit!;
  const { world: afterDeath, events: battleEvents } = tick(
    afterDepart,
    [],
    transit.arriveMs - afterDepart.nowMs,
  );
  arcEvents.push(...battleEvents);
  states.push(territoryState(afterDeath, targetTerritoryId) ?? 'missing');
  expect(territoryState(afterDeath, targetTerritoryId)).toBe('stale');

  const { world: decayed } = tick(afterDeath, [], INTEL_DECAY_WINDOW_MS + 1);
  states.push(territoryState(decayed, targetTerritoryId) ?? 'missing');
  expect(territoryState(decayed, targetTerritoryId)).toBe('unknown');

  const arcDigest = playerDigest(afterDeath, arcEvents);
  expect(arcDigest.length).toBeGreaterThan(0);
  expect(arcEvents.some((event) => dispatchLineForEvent(afterDeath, event).includes('DEPARTURE'))).toBe(
    true,
  );

  return { states, arcDigest };
}

describe('sprint 5.5 integration', () => {
  it('sprint4: live → stale → unknown arc on Berlin', () => {
    const { states, arcDigest } = runIntelArc(
      createSprint4World(START_S4),
      S4_LONDON,
      S4_BERLIN,
    );
    expect(states).toEqual(['unknown', 'live', 'stale', 'unknown']);
    expect(arcDigest).toMatchSnapshot('sprint4-intel-arc-digest');
  });

  it('sprint5: live → stale → unknown arc on Istanbul', () => {
    const { states, arcDigest } = runIntelArc(
      createSprint5World(START_S5),
      S5_BELGRADE,
      S5_ISTANBUL,
    );
    expect(states).toEqual(['unknown', 'live', 'stale', 'unknown']);
    expect(arcDigest).toMatchSnapshot('sprint5-intel-arc-digest');
  });

  it('sprint4: 24h cold-play player digest', () => {
    const { events, world } = advanceTo(createSprint4World(START_S4), START_S4 + TWENTY_FOUR_HOURS_MS);
    const digest = renderDigestText(world, events, undefined, PLAYER);
    expect(digest).toMatchSnapshot('sprint4-cold-play-24h-digest');
    expect(digest).not.toContain('Scouts report Caesar forces massing at Paris');
  });

  it('sprint5: 24h cold-play player digest', () => {
    const { events, world } = advanceTo(createSprint5World(START_S5), START_S5 + TWENTY_FOUR_HOURS_MS);
    const digest = renderDigestText(world, events, undefined, PLAYER);
    expect(digest).toMatchSnapshot('sprint5-cold-play-24h-digest');
    expect(digest).not.toContain('Scouts report');
  });

  it('72h sprint4: records Genghis scout activity and transit-time risk', () => {
    const { events, world } = advanceTo(createSprint4World(START_S4), START_S4 + SEVENTY_TWO_HOURS_MS);
    const steppeScoutBuilds = events.filter(
      (event) =>
        event.kind === 'buildStarted' &&
        event.factionId === STEPPE &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const steppeScoutMoves = events.filter(
      (event) =>
        event.kind === 'departure' &&
        event.ownerId === STEPPE &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const steppeIntel = events.filter(
      (event) => event.kind === 'intelReport' && event.observerFaction === STEPPE,
    );
    const transits = analyzeFactionScoutTransits(world, events, STEPPE);

    const observation = {
      scoutBuilds: steppeScoutBuilds.length,
      scoutMoves: steppeScoutMoves.length,
      intelReports: steppeIntel.length,
      transits,
      anyStaleOnArrival: transits.some((row) => row.exceedsDecayWindow),
    };
    expect(observation).toMatchSnapshot('genghis-72h-scout-observation');
    // 72h cold-play: no steppe scout orders — attack/build outcompete scouting.
    // Transit-time stale-on-arrival analysis applies when a scout exists (see next test).
  });

  it('Genghis scout fixture: transit-aware scoring disqualifies stale-on-arrival scout holds', () => {
    const world = genghisScoutFixture();
    const orders = decideOrders(world, STEPPE, world.nowMs);
    const holdScoutMove = orders.find(
      (order) =>
        order.kind === 'move' &&
        order.intent === 'defend' &&
        order.stanceOnArrival === 'hold',
    );

    const capitalEtas = [S4_LONDON, S4_PARIS, S4_MADRID].map((territoryId) =>
      etaReport(world, 'unit-steppe-scout', territoryId),
    );

    const report = {
      chosenHoldScoutTarget: holdScoutMove?.kind === 'move' ? holdScoutMove.toTerritoryId : null,
      capitalEtas,
      decayWindowHours: INTEL_DECAY_WINDOW_MS / 3_600_000,
    };
    expect(report).toMatchSnapshot('genghis-scout-transit-vs-decay');
    expect(capitalEtas.every((row) => row.exceedsDecayWindow)).toBe(true);
    expect(holdScoutMove).toBeUndefined();
  });
});
