import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  computeVisibility,
  dispatchLineForEvent,
  INTEL_DECAY_WINDOW_MS,
  isScoutUnit,
  previewMoveEtaMs,
  SCOUT_COMBAT_WEIGHT_MULT,
  SCOUT_UNIT_RANGE_MULT,
  SCOUT_UNIT_TYPE_ID,
  tick,
  unitStackPower,
} from '../src';
import { BASE_SCOUT_RANGE_KM } from '../src/constants';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { tagOrder } from './fixtures';
import type { Order, WorldState } from '../src/types';

const START_MS = 1_700_300_000_000;
const BERLIN = 'territory-berlin';
const LONDON = 'territory-london';

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

describe('scout unit', () => {
  it('applies reduced combat weight', () => {
    const world = withLondonScout(createSprint4World(START_MS));
    const scout = world.units['unit-player-scout'];
    const levy = {
      ...scout,
      id: 'levy',
      typeId: 'levy-t1',
      count: 1,
    };
    const scoutPower = unitStackPower(world, scout);
    const levyPower = unitStackPower(world, levy);
    expect(scoutPower / levyPower).toBeCloseTo(SCOUT_COMBAT_WEIGHT_MULT, 5);
    expect(isScoutUnit(world, scout)).toBe(true);
  });

  it('extends visibility beyond direct range from London', () => {
    const base = createSprint4World(START_MS);
    expect(computeVisibility(base, 'faction-player').territoryStates[BERLIN]?.state).toBe(
      'unknown',
    );

    const { world: observed } = tick(withLondonScout(base), [], 3_600_000);
    const berlin = computeVisibility(observed, 'faction-player').territoryStates[BERLIN];
    expect(berlin?.state).toBe('live');
    if (berlin?.state === 'live') {
      expect(berlin.sources).toContain('scout');
    }

    const extendedKm = BASE_SCOUT_RANGE_KM * SCOUT_UNIT_RANGE_MULT;
    expect(extendedKm).toBeGreaterThan(900);
  });

  it('records scout-sourced intel in the store', () => {
    const { world } = tick(withLondonScout(createSprint4World(START_MS)), [], 3_600_000);
    const records = world.intel['faction-player'] ?? [];
    const berlinScout = records.filter(
      (record) => record.territoryId === BERLIN && record.source === 'scout',
    );
    expect(berlinScout.length).toBeGreaterThan(0);
  });

  it('transitions Berlin live → stale immediately when scout dies in assault', () => {
    const world = withLondonScout(createSprint4World(START_MS));
    const moveOrder = tagOrder(world, {
      kind: 'move',
      unitId: 'unit-player-scout',
      toTerritoryId: BERLIN,
      stanceOnArrival: 'assault',
      count: 1,
    }) as Order;

    const { world: afterDepart } = tick(world, [moveOrder], 0);
    const transit = afterDepart.units['unit-player-scout']?.transit;
    expect(transit).toBeDefined();

    const arriveMs = transit!.arriveMs;
    const { world: afterArrival, events } = tick(
      afterDepart,
      [],
      arriveMs - afterDepart.nowMs,
    );

    expect(events.some((event) => event.kind === 'battle')).toBe(true);
    expect(afterArrival.units['unit-player-scout']).toBeUndefined();

    const berlinState = computeVisibility(
      { ...afterArrival, nowMs: arriveMs },
      'faction-player',
    ).territoryStates[BERLIN];
    expect(berlinState?.state).toBe('stale');
    if (berlinState?.state === 'stale') {
      expect(berlinState.sources).toContain('scout');
      expect(berlinState.lastObservedAt).toBeLessThanOrEqual(arriveMs);
    }
  });

  it('scout lifecycle is deterministic from seed', () => {
    const world = withLondonScout(createSprint4World(START_MS));
    const eta = previewMoveEtaMs(world, 'unit-player-scout', BERLIN)!;
    const endMs = eta.etaMs + 6 * 3_600_000;

    const run = () => {
      let current = world;
      const allEvents: unknown[] = [];
      while (current.nowMs < endMs) {
        const result = advanceTo(current, Math.min(endMs, current.nowMs + 6 * 3_600_000));
        current = result.world;
        allEvents.push(result.events);
      }
      return { intel: current.intel, berlin: computeVisibility(current, 'faction-player').territoryStates[BERLIN] };
    };

    expect(run()).toEqual(run());
  });

  it('Berlin becomes unknown after scout intel decays', () => {
    const world = withLondonScout(createSprint4World(START_MS));
    const { world: afterTick } = tick(world, [], 3_600_000);
    const { world: afterDecay } = tick(
      {
        ...afterTick,
        units: Object.fromEntries(
          Object.entries(afterTick.units).filter(([id]) => id !== 'unit-player-scout'),
        ),
      },
      [],
      INTEL_DECAY_WINDOW_MS + 3_600_000,
    );

    expect(computeVisibility(afterDecay, 'faction-player').territoryStates[BERLIN]?.state).toBe(
      'unknown',
    );
  });

  it('cold play arc: Berlin unknown → live (scout) → stale (death) → unknown (decay)', () => {
    const base = createSprint4World(START_MS);
    const berlinState = (w: WorldState) =>
      computeVisibility(w, 'faction-player').territoryStates[BERLIN]?.state;

    expect(berlinState(base)).toBe('unknown');

    const world = withLondonScout(base);
    const { world: withScout } = tick(world, [], 3_600_000);
    expect(berlinState(withScout)).toBe('live');

    const assaultOrder = tagOrder(withScout, {
      kind: 'move',
      unitId: 'unit-player-scout',
      toTerritoryId: BERLIN,
      stanceOnArrival: 'assault',
      count: 1,
    }) as Order;

    const { world: afterDepart, events: departEvents } = tick(withScout, [assaultOrder], 0);
    const dispatch: string[] = departEvents.map((event) =>
      dispatchLineForEvent(afterDepart, event),
    );

    const transit = afterDepart.units['unit-player-scout']!.transit!;
    const { world: afterDeath, events: battleEvents } = tick(
      afterDepart,
      [],
      transit.arriveMs - afterDepart.nowMs,
    );
    dispatch.push(...battleEvents.map((event) => dispatchLineForEvent(afterDeath, event)));

    expect(afterDeath.units['unit-player-scout']).toBeUndefined();
    expect(berlinState(afterDeath)).toBe('stale');

    const { world: decayed } = tick(afterDeath, [], INTEL_DECAY_WINDOW_MS + 1);
    expect(berlinState(decayed)).toBe('unknown');

    expect(dispatch.some((line) => line.toLowerCase().includes('berlin'))).toBe(true);
    expect(dispatch.some((line) => line.includes('DEPARTURE'))).toBe(true);
  });
});
