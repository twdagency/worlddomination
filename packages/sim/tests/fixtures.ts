import { describe, it, expect } from 'vitest';
import type { Faction, Id, Leader, Order, OrderIntent, Territory, Unit, UnitType, WorldState } from '../src/types';
import { intentFromMoveStance, taggedOrderFields } from '../src/dispatch';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';

export const LONDON: Territory = {
  id: 'territory-london',
  name: 'London',
  coord: { lat: 51.5074, lon: -0.1278 },
  ownerId: 'faction-player',
  baseYield: 100,
  infraLevel: 1,
  resources: {},
};

export const NEW_YORK: Territory = {
  id: 'territory-new-york',
  name: 'New York',
  coord: { lat: 40.7128, lon: -74.006 },
  ownerId: undefined,
  baseYield: 80,
  infraLevel: 1,
  resources: {},
};

export const PARIS: Territory = {
  id: 'territory-paris',
  name: 'Paris',
  coord: { lat: 48.8566, lon: 2.3522 },
  ownerId: undefined,
  baseYield: 70,
  infraLevel: 1,
  resources: {},
};

const BASELINE_LEADER: Leader = {
  id: 'leader-baseline',
  name: 'Baseline',
  region: 'Test',
  era: 'Modern',
  weights: { aggression: 5, risk: 5, economy: 5, expansion: 5 },
  traits: {},
  tempo: 'steady',
};

export function makeFaction(leaderId: string): Faction {
  return {
    id: 'faction-player',
    leaderId,
    isPlayer: true,
    funding: 10_000,
    manpower: 5_000,
    manpowerCap: 10_000,
  };
}

export function makeWorld(overrides: Partial<WorldState> = {}): WorldState {
  const startMs = 1_700_000_000_000;
  const leaders: Record<string, Leader> = {
    [BASELINE_LEADER.id]: BASELINE_LEADER,
    ...LEADERS_BY_ID,
  };

  const unitTypes: Record<string, UnitType> = { ...UNIT_TYPES_BY_ID };

  const defaultUnit: Unit = {
    id: 'unit-1',
    typeId: 'mg-armor-t5',
    ownerId: 'faction-player',
    count: 1,
    locationId: LONDON.id,
    stance: 'defend',
  };

  return {
    nowMs: startMs,
    day: 1,
    startMs,
    rng: { seed: 42 },
    territories: {
      [LONDON.id]: LONDON,
      [NEW_YORK.id]: NEW_YORK,
      [PARIS.id]: PARIS,
    },
    units: { [defaultUnit.id]: defaultUnit },
    factions: { 'faction-player': makeFaction('leader-baseline') },
    leaders,
    unitTypes,
    intel: {},
    scenarioId: 'test-sprint1',
    ...overrides,
  };
}

export function withLeader(world: WorldState, leaderId: string): WorldState {
  return {
    ...world,
    factions: {
      ...world.factions,
      'faction-player': { ...world.factions['faction-player'], leaderId },
    },
  };
}

export function withSecondUnit(world: WorldState, unit: Unit): WorldState {
  return {
    ...world,
    units: { ...world.units, [unit.id]: unit },
  };
}

const DEFAULT_FACTION = 'faction-player';

export function tagOrder(
  world: WorldState,
  order: Omit<Order, 'intent' | 'beatId' | 'decisionTickMs'>,
  factionId: Id = DEFAULT_FACTION,
  decisionTickMs: number = world.nowMs,
  intent?: OrderIntent,
): Order {
  if (order.kind === 'move') {
    const unit = world.units[order.unitId];
    const resolvedIntent =
      intent ??
      intentFromMoveStance(
        order.stanceOnArrival,
        unit?.ownerId ?? factionId,
        order.toTerritoryId,
        world,
      );
    return { ...order, ...taggedOrderFields(factionId, decisionTickMs, resolvedIntent) };
  }
  if (order.kind === 'build' || order.kind === 'upgradeInfra') {
    return {
      ...order,
      ...taggedOrderFields(factionId, decisionTickMs, intent ?? 'build'),
    };
  }
  return order as Order;
}
