import { describe, it, expect } from 'vitest';
import { tick } from '../src/tick';
import { buildTransit } from '../src/movement';
import { previewMoveEtaMs } from '../src/clock';
import { MS_PER_HOUR } from '../src/constants';
import { LONDON, NEW_YORK, makeWorld, withLeader } from './fixtures';

describe('movement', () => {
  it('arrival fires at arriveMs, not before', () => {
    const world = makeWorld();
    const unit = world.units['unit-1'];
    const transit = buildTransit(world, unit, NEW_YORK.id, 'hold', world.nowMs)!;
    const travelMs = transit.arriveMs - transit.departMs;

    const justBefore = tick(
      world,
      [{ kind: 'move', unitId: 'unit-1', toTerritoryId: NEW_YORK.id, stanceOnArrival: 'hold' }],
      travelMs - 1,
    );
    expect(justBefore.events.filter((e) => e.kind === 'arrival')).toHaveLength(0);
    expect(justBefore.world.units['unit-1'].transit).toBeDefined();

    const atArrival = tick(
      world,
      [{ kind: 'move', unitId: 'unit-1', toTerritoryId: NEW_YORK.id, stanceOnArrival: 'hold' }],
      travelMs,
    );
    const arrivals = atArrival.events.filter((e) => e.kind === 'arrival');
    expect(arrivals).toHaveLength(1);
    expect(arrivals[0].at).toBe(transit.arriveMs);
    expect(atArrival.world.units['unit-1'].locationId).toBe(NEW_YORK.id);
    expect(atArrival.world.units['unit-1'].transit).toBeUndefined();
  });

  it('emits departure event when move order is issued', () => {
    const world = makeWorld();
    const { events } = tick(
      world,
      [{ kind: 'move', unitId: 'unit-1', toTerritoryId: NEW_YORK.id, stanceOnArrival: 'hold' }],
      0,
    );
    expect(events).toContainEqual({
      kind: 'departure',
      at: world.nowMs,
      unitId: 'unit-1',
      fromTerritoryId: LONDON.id,
      toTerritoryId: NEW_YORK.id,
      ownerId: 'faction-player',
      unitTypeId: 'mg-armor-t5',
      count: 1,
      stanceOnArrival: 'hold',
    });
  });

  it('Genghis landSpeedMult produces shorter ETA than baseline', () => {
    const baseline = previewMoveEtaMs(makeWorld(), 'unit-1', NEW_YORK.id)!;
    const genghis = previewMoveEtaMs(withLeader(makeWorld(), 'leader-genghis'), 'unit-1', NEW_YORK.id)!;

    expect(genghis.etaMs).toBeLessThan(baseline.etaMs);
    expect(genghis.speedKmh).toBeGreaterThan(baseline.speedKmh);
  });

  it('London to New York ETA is multi-day at armor speed', () => {
    const preview = previewMoveEtaMs(makeWorld(), 'unit-1', NEW_YORK.id)!;
    const travelHours = preview.travelMs / MS_PER_HOUR;
    expect(travelHours).toBeGreaterThan(24);
    expect(preview.distanceKm).toBeGreaterThan(5000);
  });

  it('rejects move to the territory the unit is already in', () => {
    const world = makeWorld();
    expect(buildTransit(world, world.units['unit-1'], LONDON.id, 'hold', world.nowMs)).toBeNull();
    expect(previewMoveEtaMs(world, 'unit-1', LONDON.id)).toBeNull();

    const { events, world: next } = tick(
      world,
      [{ kind: 'move', unitId: 'unit-1', toTerritoryId: LONDON.id, stanceOnArrival: 'hold' }],
      0,
    );
    expect(events).toHaveLength(0);
    expect(next.units['unit-1'].transit).toBeUndefined();
    expect(next.units['unit-1'].locationId).toBe(LONDON.id);
  });
});
