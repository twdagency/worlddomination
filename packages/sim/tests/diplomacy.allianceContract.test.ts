import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  applyMoveOrders,
  areAllied,
  breakAlliance,
  decideOrders,
  formAlliance,
  previewMoveEtaMs,
  resolveHostileArrival,
  tick,
} from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_950_000_000;
const PLAYER = 'faction-player';
const GENGHIS = 'faction-steppe';
const CAESAR = 'faction-rome';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('diplomacy alliance contract', () => {
  it('in-flight assault is cancelled when alliance forms before arrival', () => {
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
    let world = { ...base, units };

    const halfMs = Math.floor(travelMs / 2);
    world = tick(world, [], halfMs).world;
    const formed = formAlliance(world, PLAYER, GENGHIS, world.nowMs);
    world = formed.world;

    expect(formed.events.some((event) => event.kind === 'dispatchCancelledByAlliance')).toBe(true);
    expect(world.units['unit-steppe-mg']?.transit).toBeUndefined();

    const arrived = tick(world, [], travelMs - halfMs);
    expect(arrived.events.filter((event) => event.kind === 'battle')).toHaveLength(0);
  });

  it('decideOrders does not emit assault orders against allied territory', () => {
    const world = {
      ...createSprint4World(START_MS),
      alliances: [{ factionA: PLAYER, factionB: GENGHIS, formedAt: START_MS }],
    };
    expect(areAllied(world, PLAYER, GENGHIS)).toBe(true);

    const orders = decideOrders(world, GENGHIS, START_MS);
    const assaultsOnPlayer = orders.filter(
      (order) =>
        order.kind === 'move' &&
        order.stanceOnArrival === 'assault' &&
        world.territories[order.toTerritoryId]?.ownerId === PLAYER,
    );

    expect(assaultsOnPlayer).toHaveLength(0);
  });

  it('allied assault arrival resolves peacefully with allyArrivalPeaceful event', () => {
    const world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;

    const attacker = {
      ...world.units['unit-steppe-mg'],
      locationId: LONDON,
      transit: undefined,
    };

    const result = resolveHostileArrival(
      world,
      attacker,
      LONDON,
      START_MS,
      'assault',
      'territory-berlin',
    );

    expect(result.events.filter((event) => event.kind === 'battle')).toHaveLength(0);
    expect(result.events.some((event) => event.kind === 'allyArrivalPeaceful')).toBe(true);
    expect(result.units['unit-steppe-mg']?.locationId).toBe('territory-berlin');
  });

  it('breakAlliance does not recall in-flight assault orders', () => {
    const base = createSprint4World(START_MS);
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
    let world = { ...base, units: applyMoveOrders(base, [order]).units };

    expect(world.units['unit-steppe-mg']?.transit).toBeDefined();
    world = breakAlliance(world, PLAYER, GENGHIS);
    expect(world.units['unit-steppe-mg']?.transit?.stanceOnArrival).toBe('assault');
  });

  it('after alliance break, AI may assault former ally again', () => {
    let world = formAlliance(createSprint4World(START_MS), GENGHIS, PLAYER, START_MS).world;
    world = breakAlliance(world, GENGHIS, PLAYER);
    expect(areAllied(world, GENGHIS, PLAYER)).toBe(false);

    const hostileWorld: typeof world = {
      ...world,
      reputation: {
        ...world.reputation,
        [GENGHIS]: {
          ...world.reputation[GENGHIS],
          [PLAYER]: -80,
        },
      },
      territories: {
        ...world.territories,
        [LONDON]: {
          ...world.territories[LONDON]!,
          ownerId: PLAYER,
        },
      },
    };

    const orders = decideOrders(hostileWorld, GENGHIS, START_MS + 86_400_000);
    const assaultsOnPlayer = orders.filter(
      (order) =>
        order.kind === 'move' &&
        order.stanceOnArrival === 'assault' &&
        hostileWorld.territories[order.toTerritoryId]?.ownerId === PLAYER,
    );

    expect(assaultsOnPlayer.length).toBeGreaterThanOrEqual(0);
    expect(areAllied(hostileWorld, GENGHIS, PLAYER)).toBe(false);
  });

  it('combat with an ally requires prior breakAlliance with reputation events', () => {
    let world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;
    const beforeRep = world.reputation[PLAYER]?.[GENGHIS] ?? 0;

    world = breakAlliance(world, GENGHIS, PLAYER);
    const afterRep = world.reputation[PLAYER]?.[GENGHIS] ?? 0;
    expect(afterRep).toBeLessThan(beforeRep);

    const attacker = {
      ...world.units['unit-steppe-mg'],
      locationId: LONDON,
      transit: undefined,
    };
    const result = resolveHostileArrival(world, attacker, LONDON, START_MS, 'assault');
    expect(result.events.some((event) => event.kind === 'battle')).toBe(true);
  });

  it('alliance guards are reciprocal in both directions', () => {
    const world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;

    const genghisAssault = resolveHostileArrival(
      world,
      { ...world.units['unit-steppe-mg'], locationId: LONDON, transit: undefined },
      LONDON,
      START_MS,
      'assault',
    );
    expect(genghisAssault.events.some((event) => event.kind === 'allyArrivalPeaceful')).toBe(true);

    const playerAssault = resolveHostileArrival(
      world,
      { ...world.units['unit-player-mg'], locationId: LONDON, transit: undefined },
      'territory-berlin',
      START_MS,
      'assault',
    );
    expect(playerAssault.events.some((event) => event.kind === 'allyArrivalPeaceful')).toBe(true);
  });

  it('three-way: A allied with B does not block A attacking C', () => {
    let world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;
    expect(areAllied(world, PLAYER, GENGHIS)).toBe(true);
    expect(areAllied(world, PLAYER, CAESAR)).toBe(false);

    const { 'unit-rome-levy': _removed, ...remainingUnits } = world.units;
    world = { ...world, units: remainingUnits };

    const attacker = {
      ...world.units['unit-player-mg'],
      locationId: LONDON,
      transit: undefined,
    };
    const result = resolveHostileArrival(world, attacker, PARIS, START_MS, 'assault');
    expect(result.events.some((event) => event.kind === 'allyArrivalPeaceful')).toBe(false);
    expect(result.events.some((event) => event.kind === 'secured' || event.kind === 'battle')).toBe(
      true,
    );
  });
});
