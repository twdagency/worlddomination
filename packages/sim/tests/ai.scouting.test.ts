import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  collectAiOrders,
  decideOrders,
  renderDigestText,
  SCOUT_UNIT_TYPE_ID,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LONDON, NEW_YORK, PARIS, makeWorld } from './fixtures';
import type { Order, Territory, WorldState } from '../src/types';

const START_MS = 1_700_600_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;
const LONDON_ID = 'territory-london';
const BERLIN_ID = 'territory-berlin';
const MADRID_ID = 'territory-madrid';
const PARIS_ID = 'territory-paris';

function withoutCombatUnits(world: WorldState, factionId: string): WorldState {
  return {
    ...world,
    units: Object.fromEntries(
      Object.entries(world.units).filter(
        ([, unit]) => unit.ownerId !== factionId || isScoutUnitType(world, unit.typeId),
      ),
    ),
  };
}

function isScoutUnitType(world: WorldState, typeId: string): boolean {
  return typeId === SCOUT_UNIT_TYPE_ID;
}

function scoutOrders(orders: Order[]): Order[] {
  return orders.filter(
    (order) =>
      (order.kind === 'build' && order.unitTypeId === SCOUT_UNIT_TYPE_ID) ||
      (order.kind === 'move' &&
        order.unitId &&
        order.stanceOnArrival === 'hold' &&
        order.intent === 'defend'),
  );
}

describe('AI scouting behavior', () => {
  it('Genghis scouts hostile borders — move toward reachable enemy territory', () => {
    const startMs = 1_700_900_000_000;
    const base = createSprint4World(startMs);
    const nearHostile: Territory = {
      id: 'territory-near-hostile',
      name: 'Near Hostile',
      coord: { lat: 52.58, lon: 13.42 },
      ownerId: 'faction-rome',
      baseYield: 50,
      infraLevel: 1,
      resources: {},
    };
    const world: WorldState = {
      ...base,
      territories: {
        ...base.territories,
        [nearHostile.id]: nearHostile,
      },
      units: {
        ...Object.fromEntries(
          Object.entries(base.units).filter(([, unit]) => unit.ownerId !== 'faction-steppe'),
        ),
        'unit-steppe-scout': {
          id: 'unit-steppe-scout',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: 'faction-steppe',
          count: 1,
          locationId: BERLIN_ID,
          stance: 'hold',
        },
      },
      intel: {},
    };

    const orders = decideOrders(world, 'faction-steppe', startMs);
    const move = orders.find((order) => order.kind === 'move');
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') {
      expect(move.toTerritoryId).toBe(nearHostile.id);
    }
  });

  it('Elizabeth-AI scouts defensively — build or hold on own frontier', () => {
    const base = withoutCombatUnits(createSprint4World(START_MS), 'faction-britain');
    const world: WorldState = {
      ...base,
      units: Object.fromEntries(
        Object.entries(base.units).filter(([, unit]) => unit.ownerId !== 'faction-britain'),
      ),
      factions: {
        ...base.factions,
        'faction-britain': {
          ...base.factions['faction-britain']!,
          funding: 2_000,
          manpower: 1_000,
        },
      },
      intel: {},
    };

    const orders = decideOrders(world, 'faction-britain', world.nowMs);
    const scoutingOrders = scoutOrders(orders);
    expect(scoutingOrders.length).toBeGreaterThan(0);

    const build = scoutingOrders.find((order) => order.kind === 'build');
    const move = scoutingOrders.find((order) => order.kind === 'move');

    if (build?.kind === 'build') {
      expect(build.territoryId).toBe(MADRID_ID);
      expect(build.unitTypeId).toBe(SCOUT_UNIT_TYPE_ID);
    } else if (move?.kind === 'move') {
      expect([MADRID_ID, LONDON_ID, PARIS_ID]).toContain(move.toTerritoryId);
      expect(move.stanceOnArrival).toBe('hold');
    }
  });

  it('Caesar scouts broadly — builds scout or probes foreign territory', () => {
    const base = withoutCombatUnits(createSprint4World(START_MS), 'faction-rome');
    const world: WorldState = {
      ...base,
      territories: {
        ...base.territories,
        [PARIS_ID]: {
          ...base.territories[PARIS_ID]!,
          resources: { ...base.territories[PARIS_ID]!.resources, food: 50 },
        },
      },
      factions: {
        ...base.factions,
        'faction-rome': {
          ...base.factions['faction-rome']!,
          funding: 2_000,
          manpower: 2_000,
        },
      },
      units: Object.fromEntries(
        Object.entries(base.units).filter(([, unit]) => unit.ownerId !== 'faction-rome'),
      ),
      intel: {},
    };

    const orders = decideOrders(world, 'faction-rome', world.nowMs);
    const scouting = scoutOrders(orders);
    expect(scouting.length).toBeGreaterThan(0);

    const build = scouting.find((order) => order.kind === 'build');
    if (build?.kind === 'build') {
      expect(build.territoryId).toBe(PARIS_ID);
      expect(build.unitTypeId).toBe(SCOUT_UNIT_TYPE_ID);
      return;
    }

    const move = scouting.find((order) => order.kind === 'move');
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') {
      expect([LONDON_ID, BERLIN_ID, MADRID_ID]).toContain(move.toTerritoryId);
      expect(move.stanceOnArrival).toBe('hold');
    }
  });

  it('scouting decisions are deterministic from seed', () => {
    const world = createSprint4World(START_MS);
    const tick = world.nowMs;
    const run = () =>
      Object.values(world.factions)
        .filter((faction) => !faction.isPlayer)
        .flatMap((faction) => decideOrders(world, faction.id, tick));

    expect(run()).toEqual(run());
  });

  it('24h cold-play shows AI scout activity and stays within digest cap', () => {
    const world = createSprint4World(START_MS);
    const { events, world: advanced } = advanceTo(world, START_MS + TWENTY_FOUR_HOURS_MS);
    const digest = renderDigestText(advanced, events, undefined, 'faction-player');
    const digestLines = digest.split('\n').filter((line) => line.trim().length > 0);

    const aiScoutReports = events.filter(
      (event) => event.kind === 'intelReport' && event.observerFaction !== 'faction-player',
    );
    const aiScoutBuilds = events.filter(
      (event) =>
        event.kind === 'buildStarted' &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID &&
        event.factionId !== 'faction-player',
    );
    const aiScoutMoves = events.filter(
      (event) =>
        event.kind === 'departure' &&
        event.ownerId !== 'faction-player' &&
        event.unitTypeId === SCOUT_UNIT_TYPE_ID,
    );

    expect(aiScoutReports.length + aiScoutBuilds.length + aiScoutMoves.length).toBeGreaterThan(0);
    expect(digestLines.length).toBeLessThanOrEqual(40);

    // Other factions' scout intel stays private — not in the player digest.
    expect(digest).not.toContain('Scouts report Caesar forces massing at Paris');

    expect(digest).toMatchSnapshot('ai-scouting-24h-digest');
  });

  it('collectAiOrders only emits standard orders with scout builds and moves', () => {
    const orders = collectAiOrders(createSprint4World(START_MS), START_MS);
    for (const order of orders) {
      expect(['move', 'build', 'upgradeInfra']).toContain(order.kind);
      if (order.kind === 'build' && order.unitTypeId === SCOUT_UNIT_TYPE_ID) {
        expect(order.intent).toBe('build');
      }
    }
  });

  it('attacks directly visible targets despite unknown elsewhere', () => {
    const world = makeWorld({
      territories: {
        [LONDON.id]: { ...LONDON, ownerId: 'faction-ai' },
        [PARIS.id]: { ...PARIS, ownerId: 'faction-player' },
        [NEW_YORK.id]: { ...NEW_YORK, ownerId: 'faction-enemy' },
      },
      units: {
        'unit-ai': {
          id: 'unit-ai',
          typeId: 'mg-armor-t5',
          ownerId: 'faction-ai',
          count: 10,
          locationId: LONDON.id,
          stance: 'defend',
        },
      },
      factions: {
        'faction-ai': {
          id: 'faction-ai',
          leaderId: 'leader-genghis',
          isPlayer: false,
          funding: 25_000,
          manpower: 8_000,
          manpowerCap: 15_000,
        },
        'faction-player': makeWorld().factions['faction-player'],
        'faction-enemy': {
          id: 'faction-enemy',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 10_000,
          manpower: 5_000,
          manpowerCap: 10_000,
        },
      },
      intel: {},
    });

    const orders = decideOrders(world, 'faction-ai', world.nowMs);
    expect(orders[0]?.kind).toBe('move');
    if (orders[0]?.kind === 'move') {
      expect(orders[0].toTerritoryId).toBe(PARIS.id);
      expect(orders[0].stanceOnArrival).toBe('assault');
    }
  });
});
