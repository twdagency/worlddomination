import {
  CASUALTY_K,
  COMBAT_RNG_VARIANCE_ENABLED,
  DEFAULT_TERRAIN_MOD,
  DEFAULT_TRAIT,
  RETREAT_THRESHOLD,
  TECH_FACTOR,
  WITHDRAWAL_ATTACKER_LOSS,
  WITHDRAWAL_DEFENDER_LOSS,
} from './constants';
import { haversineKm } from './geo';
import { nextRandom } from './rng';
import { isScoutUnit, SCOUT_COMBAT_WEIGHT_MULT } from './scout';
import type { BattleReport, Coord, Id, RngState, Unit, UnitType, WorldState } from './types';

export interface SidePowerBreakdown {
  rawPower: number;
  modifiedPower: number;
  totalCount: number;
}

/** Combat power for a single stack (before leader/terrain modifiers). */
export function unitStackPower(world: WorldState, unit: Unit): number {
  const unitType = world.unitTypes[unit.typeId];
  if (!unitType) return 0;
  let power = unit.count * unitPowerPerSoldier(unitType);
  if (isScoutUnit(world, unit)) {
    power *= SCOUT_COMBAT_WEIGHT_MULT;
  }
  return power;
}

export function unitPowerPerSoldier(unitType: UnitType): number {
  return unitType.combatValue * TECH_FACTOR ** unitType.tier;
}

function leaderTrait(world: WorldState, factionId: Id, key: 'attackCombatMod' | 'homeDefenseCombatMod'): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.traits[key] ?? DEFAULT_TRAIT;
}

/** Aggregate side power with leader and terrain modifiers applied. */
export function sidePower(
  world: WorldState,
  units: Unit[],
  role: 'attacker' | 'defender',
  terrainMod: number = DEFAULT_TERRAIN_MOD,
): SidePowerBreakdown {
  const rawPower = units.reduce((sum, u) => sum + unitStackPower(world, u), 0);
  const totalCount = units.reduce((sum, u) => sum + u.count, 0);
  if (units.length === 0) {
    return { rawPower: 0, modifiedPower: 0, totalCount: 0 };
  }

  const factionId = units[0].ownerId;
  const trait =
    role === 'attacker'
      ? leaderTrait(world, factionId, 'attackCombatMod')
      : leaderTrait(world, factionId, 'homeDefenseCombatMod');

  const modifiedPower = rawPower * trait * terrainMod;
  return { rawPower, modifiedPower, totalCount };
}

export function powerRatio(attackerPower: number, defenderPower: number): number {
  if (defenderPower <= 0) return attackerPower > 0 ? Infinity : 1;
  return attackerPower / defenderPower;
}

export function partitionDefendersByRetreat(
  defenderUnits: Unit[],
  attackerPower: number,
  defenderPower: number,
): { standing: Unit[]; fleeing: Unit[] } {
  const standing = defenderUnits.filter((u) => u.stance !== 'retreat-if-outnumbered');
  const fleeCandidates = defenderUnits.filter((u) => u.stance === 'retreat-if-outnumbered');

  const outpowered =
    fleeCandidates.length > 0 &&
    attackerPower > 0 &&
    defenderPower / attackerPower < RETREAT_THRESHOLD;

  if (!outpowered) {
    return { standing: defenderUnits, fleeing: [] };
  }

  if (standing.length > 0) {
    return { standing, fleeing: fleeCandidates };
  }

  return { standing: [], fleeing: fleeCandidates };
}

export function defenderWouldRetreat(
  defenderUnits: Unit[],
  attackerPower: number,
  defenderPower: number,
): boolean {
  const { standing, fleeing } = partitionDefendersByRetreat(
    defenderUnits,
    attackerPower,
    defenderPower,
  );
  return fleeing.length > 0 && standing.length === 0;
}

/** Nearest friendly territory by great-circle distance; excludes `excludeId`. */
export function nearestFriendlyTerritory(
  world: WorldState,
  factionId: Id,
  fromCoord: Coord,
  excludeId?: Id,
): Id | null {
  let bestId: Id | null = null;
  let bestKm = Infinity;

  for (const territory of Object.values(world.territories)) {
    if (territory.id === excludeId) continue;
    if (territory.ownerId !== factionId) continue;
    const km = haversineKm(fromCoord, territory.coord);
    if (km < bestKm) {
      bestKm = km;
      bestId = territory.id;
    }
  }

  return bestId;
}

function distributeLosses(units: Unit[], totalLosses: number): Record<Id, number> {
  const losses: Record<Id, number> = {};
  if (units.length === 0 || totalLosses <= 0) {
    for (const u of units) losses[u.id] = 0;
    return losses;
  }

  const totalCount = units.reduce((s, u) => s + u.count, 0);
  let assigned = 0;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (i === units.length - 1) {
      losses[u.id] = Math.min(u.count, totalLosses - assigned);
    } else {
      const share = Math.floor((totalLosses * u.count) / totalCount);
      losses[u.id] = Math.min(u.count, share);
      assigned += losses[u.id];
    }
  }
  return losses;
}

export interface ResolveBattleInput {
  world: WorldState;
  attackerUnits: Unit[];
  defenderUnits: Unit[];
  attackerId: Id;
  defenderId: Id;
  terrainMod?: number;
  enableRngVariance?: boolean;
}

export interface ResolveBattleResult {
  report: BattleReport;
  attackerLossesByUnit: Record<Id, number>;
  defenderLossesByUnit: Record<Id, number>;
  winnerId: Id;
  rng: RngState;
}

/**
 * Deterministic battle resolution. Winner loses floor(count / (winRatio * CASUALTY_K));
 * loser is destroyed. No attacker auto-retreat.
 */
export function resolveBattle(input: ResolveBattleInput): ResolveBattleResult {
  const {
    world,
    attackerUnits,
    defenderUnits,
    attackerId,
    defenderId,
    terrainMod = DEFAULT_TERRAIN_MOD,
    enableRngVariance = COMBAT_RNG_VARIANCE_ENABLED,
  } = input;

  let rng = world.rng;
  const attacker = sidePower(world, attackerUnits, 'attacker', terrainMod);
  const defender = sidePower(world, defenderUnits, 'defender', terrainMod);

  let attackerPower = attacker.modifiedPower;
  let defenderPower = defender.modifiedPower;

  if (enableRngVariance) {
    const aRoll = nextRandom(rng);
    rng = aRoll.state;
    const dRoll = nextRandom(rng);
    rng = dRoll.state;
    attackerPower *= 0.9 + aRoll.value * 0.2;
    defenderPower *= 0.9 + dRoll.value * 0.2;
  }

  const ratio = powerRatio(attackerPower, defenderPower);
  const attackerWins = ratio >= 1;
  const winnerId = attackerWins ? attackerId : defenderId;
  const winRatio = attackerWins ? ratio : powerRatio(defenderPower, attackerPower);

  const winnerCount = attackerWins ? attacker.totalCount : defender.totalCount;

  const winnerLossesTotal = Math.min(
    winnerCount,
    Math.floor(winnerCount / (winRatio * CASUALTY_K)),
  );

  const attackerLossesByUnit = attackerWins
    ? distributeLosses(attackerUnits, winnerLossesTotal)
    : Object.fromEntries(attackerUnits.map((u) => [u.id, u.count]));
  const defenderLossesByUnit = attackerWins
    ? Object.fromEntries(defenderUnits.map((u) => [u.id, u.count]))
    : distributeLosses(defenderUnits, winnerLossesTotal);

  const attackerLosses = Object.values(attackerLossesByUnit).reduce((a, b) => a + b, 0);
  const defenderLosses = Object.values(defenderLossesByUnit).reduce((a, b) => a + b, 0);

  const report: BattleReport = {
    attackerId,
    defenderId,
    attackerPower,
    defenderPower,
    winnerId,
    attackerLosses,
    defenderLosses,
    narrative: '', // filled by reports.ts
  };

  return {
    report,
    attackerLossesByUnit,
    defenderLossesByUnit,
    winnerId,
    rng,
  };
}

/** Apply loss counts to unit stacks; removes stacks at zero. */
export function applyUnitLosses(
  units: Record<Id, Unit>,
  lossesByUnit: Record<Id, number>,
): Record<Id, Unit> {
  const next = { ...units };
  for (const [unitId, lost] of Object.entries(lossesByUnit)) {
    const unit = next[unitId];
    if (!unit || lost <= 0) continue;
    const remaining = unit.count - lost;
    if (remaining <= 0) {
      delete next[unitId];
    } else {
      next[unitId] = { ...unit, count: remaining };
    }
  }
  return next;
}

export interface WithdrawalCasualties {
  defenderLossesByUnit: Record<Id, number>;
  attackerLossesByUnit: Record<Id, number>;
  defenderLosses: number;
  attackerLosses: number;
}

/** Flat-fraction losses when defenders withdraw; zero when not under Assault. */
export function computeWithdrawalCasualties(
  fleeingUnits: Unit[],
  attackerUnits: Unit[],
  underFire: boolean,
): WithdrawalCasualties {
  const zeroDefender = Object.fromEntries(fleeingUnits.map((u) => [u.id, 0]));
  const zeroAttacker = Object.fromEntries(attackerUnits.map((u) => [u.id, 0]));

  if (!underFire || fleeingUnits.length === 0) {
    return {
      defenderLossesByUnit: zeroDefender,
      attackerLossesByUnit: zeroAttacker,
      defenderLosses: 0,
      attackerLosses: 0,
    };
  }

  const fleeingCount = fleeingUnits.reduce((sum, u) => sum + u.count, 0);
  const attackerCount = attackerUnits.reduce((sum, u) => sum + u.count, 0);
  const defenderLosses = Math.min(
    fleeingCount,
    Math.floor(fleeingCount * WITHDRAWAL_DEFENDER_LOSS),
  );
  const attackerLosses = Math.min(
    attackerCount,
    Math.floor(attackerCount * WITHDRAWAL_ATTACKER_LOSS),
  );

  return {
    defenderLossesByUnit: distributeLosses(fleeingUnits, defenderLosses),
    attackerLossesByUnit: distributeLosses(attackerUnits, attackerLosses),
    defenderLosses,
    attackerLosses,
  };
}

export function gatherTerritoryDefenders(
  world: WorldState,
  territoryId: Id,
  defenderFactionId: Id,
): Unit[] {
  return Object.values(world.units).filter(
    (u) => u.locationId === territoryId && u.ownerId === defenderFactionId && !u.transit,
  );
}
