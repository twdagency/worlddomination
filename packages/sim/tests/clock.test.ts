import { describe, it, expect } from 'vitest';
import { advanceTo, nextEventMs, unitPosition } from '../src/clock';
import { haversineKm } from '../src/geo';
import { tick } from '../src/tick';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LONDON, NEW_YORK, PARIS, makeWorld, tagOrder, withSecondUnit } from './fixtures';
import type { Unit } from '../src/types';

function holdMove(world: ReturnType<typeof makeWorld>, unitId: string, toTerritoryId: string) {
  return tagOrder(world, { kind: 'move', unitId, toTerritoryId, stanceOnArrival: 'hold' });
}

describe('clock', () => {
  it('advanceTo does not mutate the input world', () => {
    const world = makeWorld();
    const frozen = Object.freeze(world);
    expect(() =>
      advanceTo(frozen, world.nowMs + 86_400_000),
    ).not.toThrow();
    expect(world.nowMs).toBe(frozen.nowMs);
    expect(world.units['unit-1'].locationId).toBe(LONDON.id);
  });

  it('nextEventMs returns the soonest arrival', () => {
    const world = makeWorld();
    const { world: afterMove } = tick(world, [holdMove(world, 'unit-1', NEW_YORK.id)], 0);
    const arriveMs = afterMove.units['unit-1'].transit!.arriveMs;
    expect(nextEventMs(afterMove)).toBe(arriveMs);
  });

  it('advanceTo jumps exactly to the next arrival via time-skip', () => {
    const world = makeWorld();
    const { world: afterMove } = tick(world, [holdMove(world, 'unit-1', NEW_YORK.id)], 0);
    const target = nextEventMs(afterMove)!;
    const { world: arrived, events } = advanceTo(afterMove, target);

    expect(arrived.nowMs).toBe(target);
    expect(arrived.units['unit-1'].locationId).toBe(NEW_YORK.id);
    expect(events.filter((e) => e.kind === 'arrival')).toHaveLength(1);
  });

  it('advanceTo is order-independent for non-interacting units', () => {
    const unit2: Unit = {
      id: 'unit-2',
      typeId: 'mg-armor-t5',
      ownerId: 'faction-player',
      count: 1,
      locationId: LONDON.id,
      stance: 'defend',
    };
    const world = withSecondUnit(makeWorld(), unit2);

    const ordersA = [
      holdMove(world, 'unit-1', NEW_YORK.id),
      holdMove(world, 'unit-2', PARIS.id),
    ];
    const ordersB = [ordersA[1], ordersA[0]];

    const { world: wA } = tick(world, ordersA, 0);
    const { world: wB } = tick(world, ordersB, 0);

    const target = Math.max(
      wA.units['unit-1'].transit!.arriveMs,
      wA.units['unit-2'].transit!.arriveMs,
    );

    const resultA = advanceTo(wA, target);
    const resultB = advanceTo(wB, target);

    expect(resultA.world.units['unit-1'].locationId).toBe(NEW_YORK.id);
    expect(resultA.world.units['unit-2'].locationId).toBe(PARIS.id);
    expect(resultB.world.units['unit-1'].locationId).toBe(NEW_YORK.id);
    expect(resultB.world.units['unit-2'].locationId).toBe(PARIS.id);
    expect(resultA.world.nowMs).toBe(resultB.world.nowMs);
  });

  it('unitPosition interpolates along route while in transit', () => {
    const world = makeWorld();
    const { world: moving } = tick(world, [holdMove(world, 'unit-1', NEW_YORK.id)], 0);
    const transit = moving.units['unit-1'].transit!;
    const midMs = moving.nowMs + (transit.arriveMs - transit.departMs) / 2;

    const midWorld = { ...moving, nowMs: midMs };
    const pos = unitPosition(midWorld, 'unit-1');

    const total = haversineKm(LONDON.coord, NEW_YORK.coord);
    const viaPos =
      haversineKm(LONDON.coord, pos) + haversineKm(pos, NEW_YORK.coord);
    expect(viaPos).toBeGreaterThan(total * 0.45);
    expect(viaPos).toBeLessThan(total * 1.05);
  });

  it('advanceTo emits income summary after offline catch-up', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 120,
          infraLevel: 2,
          extraction: { fuel: 10 },
          resources: {},
        },
      },
    });

    const { events, world: advanced } = advanceTo(world, world.nowMs + 14 * 3_600_000);
    const income = events.find((e) => e.kind === 'income');
    expect(income).toMatchObject({ kind: 'income', funding: 2520 });
    expect(income?.kind === 'income' && income.resourcesByTerritory[LONDON.id]?.fuel).toBe(210);
    expect(advanced.factions['faction-player'].funding).toBe(10_000 + 2520);
    expect(advanced.territories[LONDON.id].resources.fuel).toBe(210);
  });

  it('advanceTo accrues income across steps when production completes mid-window', () => {
    const startMs = 1_700_000_000_000;
    const productionMs = 6 * 3_600_000;
    const totalMs = 14 * 3_600_000;
    const world = makeWorld({
      nowMs: startMs,
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 120,
          infraLevel: 2,
          extraction: { fuel: 10 },
          resources: {},
          buildQueue: [
            {
              unitTypeId: 'levy-t1',
              count: 3,
              startMs,
              durationMs: productionMs,
            },
          ],
        },
      },
    });

    const { events, world: advanced } = advanceTo(world, startMs + totalMs);

    const income = events.find((e) => e.kind === 'income');
    expect(income).toMatchObject({ kind: 'income', funding: 2520 });
    expect(income?.kind === 'income' && income.resourcesByTerritory[LONDON.id]?.fuel).toBe(210);

    const production = events.filter((e) => e.kind === 'production');
    expect(production).toHaveLength(1);
    expect(production[0]).toMatchObject({
      kind: 'production',
      at: startMs + productionMs,
      count: 3,
    });

    expect(advanced.nowMs).toBe(startMs + totalMs);
    expect(advanced.factions['faction-player'].funding).toBe(10_000 + 2520);
    const spawned = Object.values(advanced.units).find(
      (u) => u.locationId === LONDON.id && u.typeId === 'levy-t1',
    );
    expect(spawned?.count).toBe(3);
  });

  it('split catch-up windows sum to the same income as one continuous gap', () => {
    const startMs = 1_700_000_000_000;
    const world = makeWorld({
      nowMs: startMs,
      territories: {
        [LONDON.id]: {
          ...LONDON,
          baseYield: 120,
          infraLevel: 2,
          extraction: { fuel: 10 },
          resources: {},
        },
      },
    });

    const midMs = startMs + 6 * 3_600_000;
    const endMs = startMs + 14 * 3_600_000;

    const first = advanceTo(world, midMs);
    const second = advanceTo(first.world, endMs);

    const firstIncome = first.events.find((e) => e.kind === 'income');
    const secondIncome = second.events.find((e) => e.kind === 'income');
    expect(firstIncome?.kind).toBe('income');
    expect(secondIncome?.kind).toBe('income');
    expect(firstIncome?.funding).toBeGreaterThan(0);
    expect(secondIncome?.funding).toBeGreaterThan(0);
    expect(firstIncome?.funding).toBeLessThan(2520);
    expect(secondIncome?.funding).toBeLessThan(2520);

    const totalFunding =
      (firstIncome?.kind === 'income' ? firstIncome.funding : 0) +
      (secondIncome?.kind === 'income' ? secondIncome.funding : 0);

    expect(totalFunding).toBe(2520);
    expect(second.world.factions['faction-player'].funding).toBe(10_000 + 2520);
  });

  it('advanceTo with AI is path-independent to the same target time', () => {
    const startMs = 1_700_000_000_000;
    const world = createSprint4World(startMs);
    const endMs = startMs + 18 * 3_600_000;
    const midMs = startMs + 6 * 3_600_000;

    const single = advanceTo(world, endMs);
    const split = advanceTo(advanceTo(world, midMs).world, endMs);

    expect(split.world.nowMs).toBe(single.world.nowMs);
    expect(split.world.factions).toEqual(single.world.factions);
    expect(split.world.territories).toEqual(single.world.territories);
    expect(split.world.units).toEqual(single.world.units);
  });

  it('advanceTo surfaces AI departures during catch-up', () => {
    const startMs = 1_700_000_000_000;
    const world = createSprint4World(startMs);
    const { events } = advanceTo(world, startMs + 6 * 3_600_000);
    expect(events.some((event) => event.kind === 'departure')).toBe(true);
  });
});
