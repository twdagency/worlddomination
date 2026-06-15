import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  computeVisibility,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  INTEL_DECAY_WINDOW_MS,
  renderDigestText,
  SCOUT_UNIT_TYPE_ID,
  tick,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { tagOrder } from './fixtures';
import type { DispatchEvent, Order, WorldState } from '../src/types';

const PLAYER = 'faction-player';
const START_S4 = 1_700_900_000_000;
const START_S5 = 1_700_950_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;

const S4_BERLIN = 'territory-berlin';
const S4_LONDON = 'territory-london';
const S5_ISTANBUL = 'territory-istanbul';
const S5_BELGRADE = 'territory-belgrade';

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

  it('72h sprint4: records Genghis scout activity observation (log if absent)', () => {
    const { events } = advanceTo(createSprint4World(START_S4), START_S4 + SEVENTY_TWO_HOURS_MS);
    const steppeScoutBuilds = events.filter(
      (event) =>
        event.kind === 'buildStarted' &&
        event.factionId === 'faction-steppe' &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const steppeScoutMoves = events.filter(
      (event) =>
        event.kind === 'departure' &&
        event.ownerId === 'faction-steppe' &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );
    const steppeIntel = events.filter(
      (event) => event.kind === 'intelReport' && event.observerFaction === 'faction-steppe',
    );

    const observation = {
      scoutBuilds: steppeScoutBuilds.length,
      scoutMoves: steppeScoutMoves.length,
      intelReports: steppeIntel.length,
    };
    expect(observation).toMatchSnapshot('genghis-72h-scout-observation');
    // Sprint 5.5 Phase 7: aggressive scoring did not emit scout orders in 72h cold-play.
    // Logged in docs/deferred-backlog.md — tuning deferred to Sprint 6+.
  });
});
