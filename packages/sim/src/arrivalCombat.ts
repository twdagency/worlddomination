import {
  applyUnitLosses,
  computeWithdrawalCasualties,
  gatherTerritoryDefenders,
  nearestFriendlyTerritory,
  partitionDefendersByRetreat,
  resolveBattle,
  sidePower,
} from './combat';
import {
  formatBattleNarrative,
  formatSecuredNarrative,
} from './reports';
import type { Id, Millis, SimEvent, Unit, WorldState } from './types';

export interface ArrivalResolution {
  units: WorldState['units'];
  territories: WorldState['territories'];
  rng: WorldState['rng'];
  events: SimEvent[];
}

function relocateFleeingDefenders(
  world: WorldState,
  units: WorldState['units'],
  fleeing: Unit[],
  defenderFactionId: Id,
  territoryId: Id,
  territoryCoord: WorldState['territories'][Id]['coord'],
): { units: WorldState['units']; fallbackId: Id | null; destroyed: boolean } {
  const fallbackId = nearestFriendlyTerritory(
    world,
    defenderFactionId,
    territoryCoord,
    territoryId,
  );
  const destroyed = fallbackId === null;
  const next = { ...units };

  for (const def of fleeing) {
    if (def.count <= 0) {
      delete next[def.id];
      continue;
    }
    if (destroyed) {
      delete next[def.id];
    } else {
      next[def.id] = { ...def, locationId: fallbackId };
    }
  }

  return { units: next, fallbackId, destroyed };
}

/**
 * After a unit arrives at `territoryId`, resolve hostile confrontation,
 * retreat, or peaceful occupation. Pure.
 */
export function resolveHostileArrival(
  world: WorldState,
  arrivingUnit: Unit,
  territoryId: Id,
  at: Millis,
  stanceOnArrival: 'assault' | 'secure' | 'hold',
): ArrivalResolution {
  const events: SimEvent[] = [];
  let units = { ...world.units, [arrivingUnit.id]: arrivingUnit };
  let territories = { ...world.territories };
  let rng = world.rng;

  const territory = territories[territoryId];
  if (!territory) {
    return { units, territories, rng, events };
  }

  const attackerId = arrivingUnit.ownerId;
  const defenderFactionId = territory.ownerId;

  const isEnemyTerritory =
    defenderFactionId !== undefined && defenderFactionId !== attackerId;

  if (!isEnemyTerritory) {
    if (territory.ownerId === undefined) {
      territories[territoryId] = { ...territory, ownerId: attackerId };
      events.push({
        kind: 'secured',
        at,
        territoryId,
        factionId: attackerId,
        unitIds: [arrivingUnit.id],
        enemyWithdrew: false,
      });
    }
    return { units, territories, rng, events };
  }

  const willAssault = stanceOnArrival === 'assault';
  const permitsWithdrawal =
    stanceOnArrival === 'assault' || stanceOnArrival === 'hold' || stanceOnArrival === 'secure';

  let defenders = gatherTerritoryDefenders({ ...world, units }, territoryId, defenderFactionId);
  const attackers = [arrivingUnit];

  const attackerBreakdown = sidePower(world, attackers, 'attacker');
  const defenderBreakdown = sidePower(world, defenders, 'defender');

  const { standing, fleeing } = partitionDefendersByRetreat(
    defenders,
    attackerBreakdown.modifiedPower,
    defenderBreakdown.modifiedPower,
  );

  if (fleeing.length > 0 && permitsWithdrawal) {
    const underFire = willAssault;
    const originalFleeingCount = fleeing.reduce((sum, u) => sum + u.count, 0);
    const casualties = computeWithdrawalCasualties(fleeing, attackers, underFire);

    units = applyUnitLosses(units, casualties.defenderLossesByUnit);
    units = applyUnitLosses(units, casualties.attackerLossesByUnit);

    const fleeingSurvivors = fleeing
      .map((u) => units[u.id])
      .filter((u): u is Unit => u !== undefined && u.count > 0);

    const relocated = relocateFleeingDefenders(
      world,
      units,
      fleeingSurvivors,
      defenderFactionId,
      territoryId,
      territory.coord,
    );
    units = relocated.units;

    const defenderLossesReported = relocated.destroyed
      ? originalFleeingCount
      : casualties.defenderLosses;

    events.push({
      kind: 'withdrawal',
      at,
      territoryId,
      factionId: defenderFactionId,
      unitIds: fleeing.map((u) => u.id),
      toTerritoryId: relocated.destroyed ? undefined : relocated.fallbackId ?? undefined,
      destroyed: relocated.destroyed,
      defenderLosses: defenderLossesReported,
      attackerLosses: casualties.attackerLosses,
      underFire,
    });

    defenders = standing;
  }

  if (defenders.length === 0) {
    territories[territoryId] = { ...territory, ownerId: attackerId };
    const survivor = units[arrivingUnit.id];
    if (survivor) {
      units[arrivingUnit.id] = { ...survivor, locationId: territoryId };
    }
    events.push({
      kind: 'secured',
      at,
      territoryId,
      factionId: attackerId,
      unitIds: [arrivingUnit.id].filter((id) => units[id]),
      enemyWithdrew: fleeing.length > 0,
    });
    return { units, territories, rng, events };
  }

  if (!willAssault) {
    return { units, territories, rng, events };
  }

  const battle = resolveBattle({
    world: { ...world, rng },
    attackerUnits: attackers.map((u) => units[u.id] ?? u),
    defenderUnits: defenders,
    attackerId,
    defenderId: defenderFactionId,
  });
  rng = battle.rng;

  const report = {
    ...battle.report,
    narrative: formatBattleNarrative(battle.report, world, territoryId),
  };

  units = applyUnitLosses(units, battle.attackerLossesByUnit);
  units = applyUnitLosses(units, battle.defenderLossesByUnit);

  if (battle.winnerId === attackerId) {
    territories[territoryId] = { ...territory, ownerId: attackerId };
    const survivor = units[arrivingUnit.id];
    if (survivor) {
      units[arrivingUnit.id] = { ...survivor, locationId: territoryId };
    }
  } else {
    delete units[arrivingUnit.id];
  }

  events.push({
    kind: 'battle',
    at,
    territoryId,
    report,
  });

  if (battle.winnerId === attackerId) {
    events.push({
      kind: 'secured',
      at,
      territoryId,
      factionId: attackerId,
      unitIds: [arrivingUnit.id].filter((id) => units[id]),
      enemyWithdrew: false,
    });
  }

  return { units, territories, rng, events };
}
