import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  collectAiOrders,
  decideOrders,
  renderDigestText,
  SCOUT_UNIT_TYPE_ID,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { Order, WorldState } from '../src/types';

const START_MS = 1_700_600_000_000;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;
const LONDON = 'territory-london';
const BERLIN = 'territory-berlin';
const MADRID = 'territory-madrid';
const PARIS = 'territory-paris';

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
  it('Genghis scouts hostile borders — move toward enemy capital', () => {
    const base = withoutCombatUnits(createSprint4World(START_MS), 'faction-steppe');
    const world: WorldState = {
      ...base,
      units: {
        ...base.units,
        'unit-steppe-scout': {
          id: 'unit-steppe-scout',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: 'faction-steppe',
          count: 1,
          locationId: BERLIN,
          stance: 'hold',
        },
      },
      intel: {},
    };

    const orders = decideOrders(world, 'faction-steppe', world.nowMs);
    const scouting = scoutOrders(orders);
    expect(scouting.length).toBeGreaterThan(0);
    const move = scouting.find((order) => order.kind === 'move');
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') {
      expect([LONDON, PARIS, MADRID]).toContain(move.toTerritoryId);
      expect(move.stanceOnArrival).toBe('hold');
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
      expect(build.territoryId).toBe(MADRID);
      expect(build.unitTypeId).toBe(SCOUT_UNIT_TYPE_ID);
    } else if (move?.kind === 'move') {
      expect([MADRID, LONDON, PARIS]).toContain(move.toTerritoryId);
      expect(move.stanceOnArrival).toBe('hold');
    }
  });

  it('Caesar scouts broadly — builds scout or probes foreign territory', () => {
    const base = withoutCombatUnits(createSprint4World(START_MS), 'faction-rome');
    const world: WorldState = {
      ...base,
      territories: {
        ...base.territories,
        [PARIS]: {
          ...base.territories[PARIS]!,
          resources: { ...base.territories[PARIS]!.resources, food: 50 },
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
      expect(build.territoryId).toBe(PARIS);
      expect(build.unitTypeId).toBe(SCOUT_UNIT_TYPE_ID);
      return;
    }

    const move = scouting.find((order) => order.kind === 'move');
    expect(move?.kind).toBe('move');
    if (move?.kind === 'move') {
      expect([LONDON, BERLIN, MADRID]).toContain(move.toTerritoryId);
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
    const digest = renderDigestText(advanced, events);
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
    const hasScoutDigest =
      digest.includes('Scouts report') ||
      aiScoutBuilds.length > 0 ||
      aiScoutMoves.length > 0;
    expect(hasScoutDigest).toBe(true);
    expect(digestLines.length).toBeLessThanOrEqual(40);

    if (aiScoutReports.length > 0) {
      const genghisScoutLines = digestLines.filter((line) => line.includes('Scouts report'));
      expect(genghisScoutLines.length).toBeGreaterThan(0);
    }

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
});
