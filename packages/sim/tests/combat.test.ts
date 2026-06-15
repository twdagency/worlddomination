import { describe, it, expect } from 'vitest';
import {
  defenderWouldRetreat,
  nearestFriendlyTerritory,
  powerRatio,
  resolveBattle,
  sidePower,
  unitPowerPerSoldier,
} from '../src/combat';
import { formatBattleNarrative } from '../src/reports';
import { COMBAT_UNIT_TYPES, CONTESTED, FRIENDLY_FALLBACK, makeCombatWorld, stack } from './combatFixtures';

describe('combat', () => {
  it('tech dominance: 10×t5 defeats 200×t1 with minimal winner losses', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id)];
    const defenders = [stack('d1', 'levy-t1', 'faction-defender', 200, CONTESTED.id)];

    const result = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    expect(result.winnerId).toBe('faction-attacker');
    expect(result.report.attackerLosses).toBeLessThanOrEqual(1);
    expect(result.report.defenderLosses).toBe(200);
    expect(result.defenderLossesByUnit.d1).toBe(200);
  });

  it('near-parity fight (ratio ~1.1) produces heavy losses on both sides', () => {
    const world = makeCombatWorld();
    // Tune counts for ~1.1 power ratio: riflemen t3 cv25 vs infantry t2 cv10
    const t3 = unitPowerPerSoldier(COMBAT_UNIT_TYPES['riflemen-t3']);
    const t2 = unitPowerPerSoldier(COMBAT_UNIT_TYPES['infantry-t2']);
    const defenderCount = 11;
    const attackerCount = Math.round((defenderCount * t2 * 1.1) / t3);

    const attackers = [
      stack('a1', 'riflemen-t3', 'faction-attacker', attackerCount, CONTESTED.id),
    ];
    const defenders = [
      stack('d1', 'infantry-t2', 'faction-defender', defenderCount, CONTESTED.id),
    ];

    const ratio = powerRatio(
      sidePower(world, attackers, 'attacker').modifiedPower,
      sidePower(world, defenders, 'defender').modifiedPower,
    );
    expect(ratio).toBeGreaterThanOrEqual(1.0);
    expect(ratio).toBeLessThan(1.2);

    const result = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    expect(result.report.attackerLosses).toBeGreaterThan(0);
    expect(result.report.defenderLosses).toBe(defenderCount);
  });

  it('determinism: identical inputs produce identical results across 1000 runs', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id)];
    const defenders = [stack('d1', 'levy-t1', 'faction-defender', 200, CONTESTED.id)];

    const first = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    for (let i = 0; i < 1000; i++) {
      const result = resolveBattle({
        world,
        attackerUnits: attackers,
        defenderUnits: defenders,
        attackerId: 'faction-attacker',
        defenderId: 'faction-defender',
      });
      expect(result.report).toEqual(first.report);
      expect(result.attackerLossesByUnit).toEqual(first.attackerLossesByUnit);
      expect(result.defenderLossesByUnit).toEqual(first.defenderLossesByUnit);
      expect(result.winnerId).toBe(first.winnerId);
    }
  });

  it('modifier bounds: 1.3× attack trait cannot make t1 beat t5 blowout', () => {
    const world = makeCombatWorld({
      leaders: {
        'leader-baseline': makeCombatWorld().leaders['leader-baseline'],
        'leader-boosted': {
          id: 'leader-boosted',
          name: 'Boosted',
          region: 'Test',
          era: 'Modern',
          weights: { aggression: 5, risk: 5, economy: 5, expansion: 5 },
          traits: { attackCombatMod: 1.3 },
        },
      },
      factions: {
        'faction-attacker': {
          ...makeCombatWorld().factions['faction-attacker'],
          leaderId: 'leader-boosted',
        },
        'faction-defender': makeCombatWorld().factions['faction-defender'],
      },
    });

    const attackers = [stack('a1', 'levy-t1', 'faction-attacker', 200, CONTESTED.id)];
    const defenders = [stack('d1', 'mg-armor-t5', 'faction-defender', 10, CONTESTED.id)];

    const result = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    expect(result.winnerId).toBe('faction-defender');
  });

  it('retreat with friendly fallback: outpowered defender does not fight', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id)];
    const defenders = [
      stack('d1', 'levy-t1', 'faction-defender', 50, CONTESTED.id, 'retreat-if-outnumbered'),
    ];

    const aPower = sidePower(world, attackers, 'attacker').modifiedPower;
    const dPower = sidePower(world, defenders, 'defender').modifiedPower;
    expect(defenderWouldRetreat(defenders, aPower, dPower)).toBe(true);

    const fallback = nearestFriendlyTerritory(
      world,
      'faction-defender',
      CONTESTED.coord,
      CONTESTED.id,
    );
    expect(fallback).toBe(FRIENDLY_FALLBACK.id);
  });

  it('retreat with no fallback: nearest friendly is null when isolated', () => {
    const world = makeCombatWorld({
      territories: { [CONTESTED.id]: CONTESTED },
    });
    const fallback = nearestFriendlyTerritory(
      world,
      'faction-defender',
      CONTESTED.coord,
      CONTESTED.id,
    );
    expect(fallback).toBeNull();
  });

  it('near-parity: retreat stance still fights when ratio at/above threshold', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'riflemen-t3', 'faction-attacker', 10, CONTESTED.id)];
    const defenders = [
      stack('d1', 'riflemen-t3', 'faction-defender', 9, CONTESTED.id, 'retreat-if-outnumbered'),
    ];

    const aPower = sidePower(world, attackers, 'attacker').modifiedPower;
    const dPower = sidePower(world, defenders, 'defender').modifiedPower;
    expect(dPower / aPower).toBeGreaterThanOrEqual(0.7);
    expect(defenderWouldRetreat(defenders, aPower, dPower)).toBe(false);
  });

  it('power-not-headcount: t5 defenders with retreat stance fight and win vs t1 horde', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'levy-t1', 'faction-attacker', 200, CONTESTED.id)];
    const defenders = [
      stack('d1', 'mg-armor-t5', 'faction-defender', 10, CONTESTED.id, 'retreat-if-outnumbered'),
    ];

    const aPower = sidePower(world, attackers, 'attacker').modifiedPower;
    const dPower = sidePower(world, defenders, 'defender').modifiedPower;
    expect(defenderWouldRetreat(defenders, aPower, dPower)).toBe(false);

    const result = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });
    expect(result.winnerId).toBe('faction-defender');
  });

  it('attacker outpowered: no auto-retreat, near-total attacker casualties', () => {
    const world = makeCombatWorld();
    const attackers = [stack('a1', 'levy-t1', 'faction-attacker', 50, CONTESTED.id)];
    const defenders = [stack('d1', 'mg-armor-t5', 'faction-defender', 10, CONTESTED.id)];

    const result = resolveBattle({
      world,
      attackerUnits: attackers,
      defenderUnits: defenders,
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    });

    expect(result.winnerId).toBe('faction-defender');
    expect(result.report.attackerLosses).toBe(50);
    expect(result.report.defenderLosses).toBeLessThanOrEqual(1);
  });

  it('formatBattleNarrative produces readable dispatch text', () => {
    const world = makeCombatWorld();
    const report = resolveBattle({
      world,
      attackerUnits: [stack('a1', 'mg-armor-t5', 'faction-attacker', 10, CONTESTED.id)],
      defenderUnits: [stack('d1', 'levy-t1', 'faction-defender', 200, CONTESTED.id)],
      attackerId: 'faction-attacker',
      defenderId: 'faction-defender',
    }).report;
    report.narrative = formatBattleNarrative(report, world, CONTESTED.id);
    expect(report.narrative).toContain('Casablanca');
    expect(report.narrative.length).toBeGreaterThan(20);
  });
});
