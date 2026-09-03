import {
  applyUnitLosses,
  computeWithdrawalCasualties,
  gatherTerritoryDefenders,
  nearestFriendlyTerritory,
  partitionDefendersByRetreat,
  resolveBattle,
  sidePower,
} from './combat';
import { areAllied } from './diplomacy';
import { findCountry, recordConquerorOnTerritoryCapture } from './country';
import { recordDestroyedScoutIntel, ensureIntelStore } from './intel';
import { emitIntelReportEvents } from './intelDispatch';
import {
  formatBattleNarrative,
} from './reports';
import type { Id, IntelStore, Millis, SimEventDraft, Unit, WorldState } from './types';

export interface ArrivalResolution {
  units: WorldState['units'];
  territories: WorldState['territories'];
  countries?: WorldState['countries'];
  rng: WorldState['rng'];
  intel: IntelStore;
  events: SimEventDraft[];
}

function noteTerritoryCapture(
  world: WorldState,
  countries: WorldState['countries'] | undefined,
  territoryId: Id,
  previousOwnerId: Id | undefined,
  newOwnerId: Id,
): WorldState['countries'] | undefined {
  if (!countries) return countries;
  return recordConquerorOnTerritoryCapture(
    { ...world, countries },
    territoryId,
    previousOwnerId,
    newOwnerId,
  ).countries;
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

function resolvePeacefulAllyArrival(
  world: WorldState,
  arrivingUnit: Unit,
  territoryId: Id,
  fromTerritoryId: Id | undefined,
  at: Millis,
  stanceOnArrival: 'assault' | 'secure' | 'hold',
): ArrivalResolution {
  const events: SimEventDraft[] = [];
  const units = { ...world.units };
  const allyFactionId = world.territories[territoryId]?.ownerId;
  const originId = fromTerritoryId ?? arrivingUnit.locationId;

  if (originId) {
    units[arrivingUnit.id] = {
      ...arrivingUnit,
      locationId: originId,
      transit: undefined,
    };
  } else {
    delete units[arrivingUnit.id];
  }

  if (allyFactionId) {
    events.push({
      kind: 'allyArrivalPeaceful',
      at,
      countryId: arrivingUnit.ownerId,
      allyFactionId,
      territoryId,
      fromTerritoryId: originId ?? territoryId,
      unitId: arrivingUnit.id,
      importance: 'medium',
    });

    if (stanceOnArrival === 'assault') {
      events.push({
        kind: 'orderRedirectedToAlly',
        at,
        orderingFactionId: arrivingUnit.ownerId,
        territoryId,
        newOwnerId: allyFactionId,
        unitId: arrivingUnit.id,
        fromTerritoryId: originId ?? territoryId,
        importance: 'medium',
      });
    }
  }

  return {
    units,
    territories: { ...world.territories },
    countries: world.countries,
    rng: world.rng,
    intel: ensureIntelStore(world),
    events,
  };
}

function captureTerritory(
  world: WorldState,
  territories: WorldState['territories'],
  countries: WorldState['countries'] | undefined,
  territoryId: Id,
  previousOwnerId: Id | undefined,
  newOwnerId: Id,
  at: Millis,
): {
  territories: WorldState['territories'];
  countries: WorldState['countries'] | undefined;
  events: SimEventDraft[];
} {
  const territory = territories[territoryId];
  if (!territory) {
    return { territories, countries, events: [] };
  }
  if (findCountry({ ...world, countries }, newOwnerId)?.defeated === true) {
    return { territories, countries, events: [] };
  }

  const nextTerritories = {
    ...territories,
    [territoryId]: { ...territory, ownerId: newOwnerId },
  };
  const nextCountries = noteTerritoryCapture(
    { ...world, territories: nextTerritories },
    countries,
    territoryId,
    previousOwnerId,
    newOwnerId,
  );

  return {
    territories: nextTerritories,
    countries: nextCountries,
    events: [
      {
        kind: 'territoryCaptured',
        at,
        territoryId,
        previousOwnerId,
        newOwnerId,
        importance: 'high',
      },
    ],
  };
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
  fromTerritoryId?: Id,
): ArrivalResolution {
  const events: SimEventDraft[] = [];
  let units = { ...world.units, [arrivingUnit.id]: arrivingUnit };
  let territories = { ...world.territories };
  let rng = world.rng;
  let intel = ensureIntelStore(world);
  let countries = world.countries;

  const territory = territories[territoryId];
  if (!territory) {
    return { units, territories, countries, rng, intel, events };
  }

  const attackerId = arrivingUnit.ownerId;
  const defenderFactionId = territory.ownerId;

  const isEnemyTerritory =
    defenderFactionId !== undefined && defenderFactionId !== attackerId;

  if (
    isEnemyTerritory &&
    defenderFactionId &&
    areAllied(world, attackerId, defenderFactionId)
  ) {
    return resolvePeacefulAllyArrival(
      world,
      arrivingUnit,
      territoryId,
      fromTerritoryId,
      at,
      stanceOnArrival,
    );
  }

  if (!isEnemyTerritory) {
    if (territory.ownerId === undefined) {
      const captured = captureTerritory(
        { ...world, territories },
        territories,
        countries,
        territoryId,
        undefined,
        attackerId,
        at,
      );
      territories = captured.territories;
      countries = captured.countries;
      events.push(...captured.events);
      if (captured.events.length > 0) {
        events.push({
          kind: 'secured',
          at,
          territoryId,
          countryId: attackerId,
          unitIds: [arrivingUnit.id],
          enemyWithdrew: false,
          importance: 'high',
        });
      }
    }
    return { units, territories, countries, rng, intel, events };
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

    const unitsBeforeWithdrawal = { ...units };
    units = applyUnitLosses(units, casualties.defenderLossesByUnit);
    units = applyUnitLosses(units, casualties.attackerLossesByUnit);
    const intelBeforeWithdrawal = intel;
    intel = recordDestroyedScoutIntel(
      { ...world, units: unitsBeforeWithdrawal, territories, rng },
      unitsBeforeWithdrawal,
      units,
      at,
      intel,
    );
    events.push(
      ...emitIntelReportEvents(
        { ...world, units, territories, rng, intel },
        intelBeforeWithdrawal,
        intel,
        at,
      ),
    );

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
      countryId: defenderFactionId,
      unitIds: fleeing.map((u) => u.id),
      toTerritoryId: relocated.destroyed ? undefined : relocated.fallbackId ?? undefined,
      destroyed: relocated.destroyed,
      defenderLosses: defenderLossesReported,
      attackerLosses: casualties.attackerLosses,
      underFire,
      importance: 'high',
    });

    defenders = standing;
  }

  if (defenders.length === 0) {
    const captured = captureTerritory(
      { ...world, territories },
      territories,
      countries,
      territoryId,
      defenderFactionId,
      attackerId,
      at,
    );
    territories = captured.territories;
    countries = captured.countries;
    events.push(...captured.events);
    const survivor = units[arrivingUnit.id];
    if (survivor) {
      units[arrivingUnit.id] = { ...survivor, locationId: territoryId };
    }
    if (captured.events.length > 0) {
      events.push({
        kind: 'secured',
        at,
        territoryId,
        countryId: attackerId,
        unitIds: [arrivingUnit.id].filter((id) => units[id]),
        enemyWithdrew: fleeing.length > 0,
        importance: 'high',
      });
    }
    return { units, territories, countries, rng, intel, events };
  }

  if (!willAssault) {
    return { units, territories, countries, rng, intel, events };
  }

  const unitsBeforeBattle = { ...units };
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
  const intelBeforeBattle = intel;
  intel = recordDestroyedScoutIntel(
    { ...world, units: unitsBeforeBattle, territories, rng },
    unitsBeforeBattle,
    units,
    at,
    intel,
  );
  events.push(
    ...emitIntelReportEvents(
      { ...world, units, territories, rng, intel },
      intelBeforeBattle,
      intel,
      at,
    ),
  );

  events.push({
    kind: 'battle',
    at,
    territoryId,
    report,
    importance: 'high',
  });

  if (battle.winnerId === attackerId) {
    const captured = captureTerritory(
      { ...world, territories },
      territories,
      countries,
      territoryId,
      defenderFactionId,
      attackerId,
      at,
    );
    territories = captured.territories;
    countries = captured.countries;
    events.push(...captured.events);
    const survivor = units[arrivingUnit.id];
    if (survivor) {
      units[arrivingUnit.id] = { ...survivor, locationId: territoryId };
    }
    if (captured.events.length > 0) {
      events.push({
        kind: 'secured',
        at,
        territoryId,
        countryId: attackerId,
        unitIds: [arrivingUnit.id].filter((id) => units[id]),
        enemyWithdrew: false,
        importance: 'high',
      });
    }
  } else {
    delete units[arrivingUnit.id];
  }

  return { units, territories, countries, rng, intel, events };
}
