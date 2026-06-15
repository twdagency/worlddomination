import type { BattleReport, Id, SimEvent, TransitOrder, WorldState } from './types';

function factionName(world: WorldState, factionId: Id): string {
  const leaderId = world.factions[factionId]?.leaderId;
  const leader = leaderId ? world.leaders[leaderId] : undefined;
  return leader?.name ?? factionId;
}

function territoryName(world: WorldState, territoryId: Id): string {
  return world.territories[territoryId]?.name ?? territoryId;
}

function lossPhrase(n: number): string {
  if (n === 0) return 'no casualties';
  if (n === 1) return '1 wounded';
  return `${n} casualties`;
}

function unitTypeLabel(world: WorldState, unitTypeId: Id): string {
  return world.unitTypes[unitTypeId]?.name ?? unitTypeId;
}

function forceLabel(world: WorldState, unitTypeId: Id, count: number): string {
  return `${count}× ${unitTypeLabel(world, unitTypeId)}`;
}

function isPlayerFaction(world: WorldState, factionId: Id): boolean {
  return world.factions[factionId]?.isPlayer === true;
}

function departureIntentPhrase(
  world: WorldState,
  stance: TransitOrder['stanceOnArrival'],
  ownerId: Id,
  toTerritoryId: Id,
): string {
  const destOwner = world.territories[toTerritoryId]?.ownerId;
  const hostile = destOwner !== undefined && destOwner !== ownerId;
  const targetsPlayer = destOwner !== undefined && isPlayerFaction(world, destOwner);

  if (stance === 'assault') {
    if (hostile && targetsPlayer) return ' (assault inbound)';
    if (hostile) return ' (assault)';
    return ' (advance)';
  }
  if (stance === 'secure') return ' (to occupy)';
  return ' (reinforcing)';
}

function arrivalContextPhrase(
  world: WorldState,
  stance: TransitOrder['stanceOnArrival'],
  ownerId: Id,
  territoryId: Id,
): string {
  const destOwner = world.territories[territoryId]?.ownerId;
  const hostile = destOwner !== undefined && destOwner !== ownerId;

  if (stance === 'assault' && hostile) return ' — contact expected';
  if (stance === 'secure') return ' — occupying';
  return '';
}

/** Evocative dispatch text for a unit departure (snapshot fields on the event). */
export function formatDepartureNarrative(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'departure' }>,
): string {
  const from = territoryName(world, event.fromTerritoryId);
  const to = territoryName(world, event.toTerritoryId);
  const force = forceLabel(world, event.unitTypeId, event.count);
  const intent = departureIntentPhrase(
    world,
    event.stanceOnArrival,
    event.ownerId,
    event.toTerritoryId,
  );

  if (isPlayerFaction(world, event.ownerId)) {
    return `DEPARTURE — Your ${force} left ${from} for ${to}${intent}`;
  }

  const who = factionName(world, event.ownerId);
  return `INTEL — ${who}'s ${force} departed ${from} → ${to}${intent}`;
}

/** Evocative dispatch text for a unit arrival (snapshot fields on the event). */
export function formatArrivalNarrative(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'arrival' }>,
): string {
  const place = territoryName(world, event.territoryId);
  const force = forceLabel(world, event.unitTypeId, event.count);
  const context = arrivalContextPhrase(
    world,
    event.stanceOnArrival,
    event.ownerId,
    event.territoryId,
  );

  if (isPlayerFaction(world, event.ownerId)) {
    return `ARRIVAL — Your ${force} reached ${place}${context}`;
  }

  const who = factionName(world, event.ownerId);
  return `INTEL — ${who}'s ${force} reached ${place}${context}`;
}

/** Evocative dispatch text for completed production. */
export function formatProductionNarrative(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'production' }>,
): string {
  const place = territoryName(world, event.territoryId);
  const force = forceLabel(world, event.unitTypeId, event.count);

  if (isPlayerFaction(world, event.factionId)) {
    return `PRODUCTION — Your ${force} ready at ${place}`;
  }

  const who = factionName(world, event.factionId);
  return `INTEL — ${who} — ${force} ready at ${place}`;
}

/** Evocative dispatch text for a resolved battle. */
export function formatBattleNarrative(report: BattleReport, world: WorldState, territoryId: Id): string {
  const place = territoryName(world, territoryId);
  const attacker = factionName(world, report.attackerId);
  const defender = factionName(world, report.defenderId);
  const winner = factionName(world, report.winnerId);
  const loser = report.winnerId === report.attackerId ? defender : attacker;

  const winnerLosses =
    report.winnerId === report.attackerId ? report.attackerLosses : report.defenderLosses;
  const loserLosses =
    report.winnerId === report.attackerId ? report.defenderLosses : report.attackerLosses;

  if (loserLosses > 0 && winnerLosses === 0) {
    return `${winner} at ${place} — ${loser} annihilated, ${lossPhrase(winnerLosses)}.`;
  }
  if (winnerLosses > 0 && loserLosses > 0) {
    return `Bloody clash at ${place}: ${winner} prevailed over ${loser} (${lossPhrase(winnerLosses)}, enemy ${loserLosses} fallen).`;
  }
  return `${winner} secured ${place} against ${loser} — ${lossPhrase(winnerLosses)}.`;
}

export function formatWithdrawalNarrative(
  world: WorldState,
  territoryId: Id,
  factionId: Id,
  toTerritoryId: Id | undefined,
  destroyed: boolean,
  defenderLosses: number,
  attackerLosses: number,
  underFire: boolean,
): string {
  const from = territoryName(world, territoryId);
  const who = factionName(world, factionId);
  if (destroyed || !toTerritoryId) {
    if (underFire && attackerLosses > 0) {
      return `${who} was cut off at ${from} — force destroyed; rearguard cost the pursuer ${attackerLosses}.`;
    }
    return `${who} was cut off at ${from} with nowhere to run — force destroyed.`;
  }
  const to = territoryName(world, toTerritoryId);
  if (underFire) {
    const rearguard =
      defenderLosses === 0
        ? 'no losses covering the retreat'
        : defenderLosses === 1
          ? '1 lost covering the retreat'
          : `${defenderLosses} lost covering the retreat`;
    const pursuit =
      attackerLosses > 0
        ? attackerLosses === 1
          ? '; pursuer took 1 casualty'
          : `; pursuer took ${attackerLosses} casualties`
        : '';
    return `${who} withdrew from ${from} to ${to} under fire — ${rearguard}${pursuit}.`;
  }
  return `${who} withdrew from ${from} to ${to} unopposed.`;
}

export function formatSecuredNarrative(
  world: WorldState,
  territoryId: Id,
  factionId: Id,
  enemyWithdrew: boolean,
): string {
  const place = territoryName(world, territoryId);
  const who = factionName(world, factionId);
  if (enemyWithdrew) {
    return `${who} secured ${place} — enemy had withdrawn.`;
  }
  return `${who} secured ${place} without resistance.`;
}
