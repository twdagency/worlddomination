import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  applyMoveOrders,
  areAllied,
  collectAiOrders,
  formAlliance,
  previewMoveEtaMs,
  resolveHostileArrival,
  tick,
} from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_950_000_000;
const PLAYER = 'faction-player';
const GENGHIS = 'faction-steppe';
const LONDON = 'territory-london';

const ARRIVAL_COMBAT_SOURCE = readFileSync(
  join(__dirname, '../src/arrivalCombat.ts'),
  'utf8',
);
const AI_SOURCE = readFileSync(join(__dirname, '../src/ai.ts'), 'utf8');

describe('DIAGNOSTIC alliance contract', () => {
  it('(A) in-flight hostile assault still resolves combat after mid-transit alliance', () => {
    const base = createSprint4World(START_MS);
    const travelMs = previewMoveEtaMs(base, 'unit-steppe-mg', LONDON)!.travelMs;
    expect(travelMs).toBeGreaterThan(0);

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
    world = formAlliance(world, PLAYER, GENGHIS, world.nowMs);
    expect(areAllied(world, PLAYER, GENGHIS)).toBe(true);

    const arrived = tick(world, [], travelMs - halfMs);
    const combatEvents = arrived.events.filter((event) => event.kind === 'battle');

    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #2 (A): post-alliance arrival events', {
      combatCount: combatEvents.length,
      kinds: arrived.events.map((event) => event.kind),
    });

    // Documents current violation: combat fires despite alliance before arrival.
    expect(combatEvents.length).toBeGreaterThan(0);
  });

  it('(B) scoreAttack path has no areAllied guard in ai.ts', () => {
    const scoreAttackBlock = AI_SOURCE.slice(
      AI_SOURCE.indexOf('function scoreAttack'),
      AI_SOURCE.indexOf('function scoreExpand'),
    );

    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #2 (B): scoreAttack references areAllied?', {
      hasAreAlliedGuard: scoreAttackBlock.includes('areAllied'),
    });

    expect(scoreAttackBlock.includes('areAllied')).toBe(false);
  });

  it('(B) collectAiOrders may still emit assault orders against allied player territory', () => {
    const world = {
      ...createSprint4World(START_MS),
      alliances: [{ factionA: PLAYER, factionB: GENGHIS, formedAt: START_MS }],
    };
    expect(areAllied(world, PLAYER, GENGHIS)).toBe(true);

    const orders = collectAiOrders(world, GENGHIS, START_MS);
    const assaultsOnPlayer = orders.filter(
      (order) =>
        order.kind === 'move' &&
        order.stanceOnArrival === 'assault' &&
        world.territories[order.toTerritoryId]?.ownerId === PLAYER,
    );

    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #2 (B): assault orders vs ally this tick', assaultsOnPlayer);

    // Structural gap confirmed even when this tick emits zero orders.
    expect(AI_SOURCE.includes('function scoreAttack')).toBe(true);
  });

  it('(C) arrivalCombat.ts does not check areAllied before hostile resolution', () => {
    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #2 (C): arrivalCombat imports/uses areAllied?', {
      referencesAreAllied: ARRIVAL_COMBAT_SOURCE.includes('areAllied'),
    });

    expect(ARRIVAL_COMBAT_SOURCE.includes('areAllied')).toBe(false);
  });

  it('(C) allied assault arrival at player capital still enters battle resolution', () => {
    let world = createSprint4World(START_MS);
    world = formAlliance(world, PLAYER, GENGHIS, START_MS);

    const attacker = {
      ...world.units['unit-steppe-mg'],
      locationId: LONDON,
      transit: undefined,
    };

    const result = resolveHostileArrival(world, attacker, LONDON, START_MS, 'assault');
    const combatEvents = result.events.filter((event) => event.kind === 'battle');

    // eslint-disable-next-line no-console
    console.log('DIAGNOSTIC #2 (C): allied assault resolution', {
      combatCount: combatEvents.length,
      kinds: result.events.map((event) => event.kind),
    });

    expect(combatEvents.length).toBeGreaterThan(0);
  });
});
