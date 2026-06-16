import { describe, it, expect } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { tick } from '../src/tick';
import { resolveHostileArrival } from '../src/arrivalCombat';
import { formAlliance } from '../src/diplomacy';
import { resolveBattle } from '../src/combat';
import {
  WITHDRAWAL_ATTACKER_LOSS,
  WITHDRAWAL_DEFENDER_LOSS,
} from '../src/constants';
import {
  COMBAT_UNIT_TYPES,
  CONTESTED,
  FRIENDLY_FALLBACK,
  makeCombatWorld,
  stack,
} from './combatFixtures';

describe('arrivalCombat integration', () => {
  it('assault on defended territory produces battle event', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 200, CONTESTED.id, 'defend'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'assault');

    expect(result.events.some((e) => e.kind === 'battle')).toBe(true);
    expect(result.territories[CONTESTED.id].ownerId).toBe('faction-attacker');
  });

  it('fighting withdrawal under Assault: partial losses, survivors relocate', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'assault');

    const withdrawal = result.events.find((e) => e.kind === 'withdrawal');
    const secured = result.events.find((e) => e.kind === 'secured');
    const expectedDefenderLosses = Math.floor(50 * WITHDRAWAL_DEFENDER_LOSS);
    const expectedAttackerLosses = Math.floor(10 * WITHDRAWAL_ATTACKER_LOSS);

    expect(withdrawal).toMatchObject({
      kind: 'withdrawal',
      destroyed: false,
      toTerritoryId: FRIENDLY_FALLBACK.id,
      defenderLosses: expectedDefenderLosses,
      attackerLosses: expectedAttackerLosses,
      underFire: true,
    });
    expect(secured).toMatchObject({ kind: 'secured', enemyWithdrew: true });
    expect(result.units.d1?.count).toBe(50 - expectedDefenderLosses);
    expect(result.units.d1?.locationId).toBe(FRIENDLY_FALLBACK.id);
    expect(result.units.a1?.count).toBe(10 - expectedAttackerLosses);
    expect(result.territories[CONTESTED.id].ownerId).toBe('faction-attacker');
    expect(result.events.some((e) => e.kind === 'battle')).toBe(false);
  });

  it('clean withdrawal under Hold: no losses, defender relocates whole', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'hold');

    const withdrawal = result.events.find((e) => e.kind === 'withdrawal');
    expect(withdrawal).toMatchObject({
      defenderLosses: 0,
      attackerLosses: 0,
      underFire: false,
      destroyed: false,
    });
    expect(result.units.d1?.count).toBe(50);
    expect(result.units.a1?.count).toBe(10);
    expect(result.territories[CONTESTED.id].ownerId).toBe('faction-attacker');
  });

  it('clean withdrawal under Secure: no losses, defender relocates whole', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'secure');

    const withdrawal = result.events.find((e) => e.kind === 'withdrawal');
    expect(withdrawal).toMatchObject({
      defenderLosses: 0,
      attackerLosses: 0,
      underFire: false,
    });
    expect(result.units.d1?.count).toBe(50);
  });

  it('withdrawal losses are less than a stand-and-fight battle', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const withdrawalResult = resolveHostileArrival(
      world,
      arriving,
      CONTESTED.id,
      world.nowMs,
      'assault',
    );
    const withdrawal = withdrawalResult.events.find((e) => e.kind === 'withdrawal');
    expect(withdrawal?.kind).toBe('withdrawal');

    const battle = resolveBattle({
      world,
      attackerUnits: [world.units.a1],
      defenderUnits: [world.units.d1],
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    expect(withdrawal.defenderLosses).toBeLessThan(battle.report.defenderLosses);
    expect(withdrawal.defenderLosses).toBeGreaterThan(0);
    expect(withdrawal.defenderLosses).toBeLessThan(50);
  });

  it('retreat with no fallback destroys defenders; attacker still takes rearguard losses', () => {
    const world = makeCombatWorld({
      territories: { [CONTESTED.id]: CONTESTED },
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'assault');

    expect(result.units.d1).toBeUndefined();
    expect(result.events.find((e) => e.kind === 'withdrawal')).toMatchObject({
      destroyed: true,
      defenderLosses: 50,
      attackerLosses: Math.floor(10 * WITHDRAWAL_ATTACKER_LOSS),
      underFire: true,
    });
    expect(result.units.a1?.count).toBe(10 - Math.floor(10 * WITHDRAWAL_ATTACKER_LOSS));
  });

  it('mixed garrison: retreat stacks flee under fire, defend stacks still fight', () => {
    const world = makeCombatWorld({
      units: {
        a1: stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id),
        d1: stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
        d2: stack('d2', 'infantry-t2', 'faction-defender', 20, CONTESTED.id, 'defend'),
      },
    });

    const arriving = { ...world.units.a1, locationId: CONTESTED.id, transit: undefined };
    const result = resolveHostileArrival(world, arriving, CONTESTED.id, world.nowMs, 'assault');

    const withdrawal = result.events.find((e) => e.kind === 'withdrawal');
    expect(withdrawal).toMatchObject({
      underFire: true,
      defenderLosses: Math.floor(50 * WITHDRAWAL_DEFENDER_LOSS),
    });
    expect(result.events.some((e) => e.kind === 'battle')).toBe(true);
    expect(result.units.d2).toBeUndefined();
    expect(result.territories[CONTESTED.id].ownerId).toBe('faction-attacker');
  });

  it('advanceTo resolves battle while offline', () => {
    const world = makeCombatWorld({
      nowMs: 0,
      startMs: 0,
      unitTypes: COMBAT_UNIT_TYPES,
      territories: {
        [CONTESTED.id]: { ...CONTESTED, ownerId: 'faction-defender' },
        'territory-attacker-base': {
          id: 'territory-attacker-base',
          name: 'Base',
          coord: { lat: 34, lon: -8 },
          ownerId: 'faction-attacker',
          baseYield: 50,
          infraLevel: 1,
          resources: {},
        },
      },
      units: {
        a1: {
          id: 'a1',
          typeId: 'mg-armor-t5',
          ownerId: 'faction-attacker',
          count: 10,
          stance: 'defend',
          transit: {
            fromId: 'territory-attacker-base',
            toCoord: CONTESTED.coord,
            toTerritoryId: CONTESTED.id,
            departMs: 0,
            arriveMs: 1000,
            distanceKm: 100,
            stanceOnArrival: 'assault',
          },
        },
        d1: stack('d1', 'levy-t1', 'faction-defender', 200, CONTESTED.id, 'defend'),
      },
    });

    const { events } = tick(world, [], 1000);
    expect(events.some((e) => e.kind === 'battle')).toBe(true);
    expect(events.some((e) => e.kind === 'arrival')).toBe(true);
  });

  it('assault on ally-held territory emits orderRedirectedToAlly for the attacker', () => {
    const START_MS = 1_700_000_000_000;
    const PLAYER = 'faction-player';
    const GENGHIS = 'faction-steppe';
    const BERLIN = 'territory-berlin';
    const LONDON = 'territory-london';

    const world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;
    const arriving = {
      ...world.units['unit-player-mg']!,
      locationId: BERLIN,
      transit: undefined,
    };

    const result = resolveHostileArrival(
      world,
      arriving,
      BERLIN,
      START_MS,
      'assault',
      LONDON,
    );

    const redirected = result.events.find((event) => event.kind === 'orderRedirectedToAlly');
    expect(redirected).toMatchObject({
      kind: 'orderRedirectedToAlly',
      orderingFactionId: PLAYER,
      territoryId: BERLIN,
      newOwnerId: GENGHIS,
      unitId: 'unit-player-mg',
      fromTerritoryId: LONDON,
    });
  });
});
