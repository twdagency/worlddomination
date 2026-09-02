import { otherParty } from './diplomaticEvents';
import {
  factionName,
  hoursUntil,
  isPlayerFaction,
  subject,
  territoryLabelWithOwner,
  territoryName,
} from './dispatchFormatHelpers';
import { findCountry } from './country';
import type { Id, SimEvent, WorldState } from './types';

export function formatAllianceFormedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceFormed' }>,
  viewingFaction?: Id,
): string {
  const [a, b] = event.parties;
  if (viewingFaction && (viewingFaction === a || viewingFaction === b)) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Alliance formed with ${factionName(world, other)}.`;
  }
  return `DIPLOMACY — ${factionName(world, a)} and ${factionName(world, b)} have formed an alliance.`;
}

export function formatAllianceBrokenLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceBroken' }>,
  viewingFaction?: Id,
): string {
  const breaker = factionName(world, event.breaker);
  const betrayed = factionName(world, event.betrayed);
  if (viewingFaction === event.betrayed) {
    return `DIPLOMACY — ${breaker} has broken our alliance.`;
  }
  return `DIPLOMACY — ${breaker} has broken alliance with ${betrayed}.`;
}

export function formatTreatyFormedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyFormed' }>,
  viewingFaction?: Id,
): string {
  const scopeCount = event.territoryIds.length;
  const hours = Math.round((event.expiresAt - event.at) / 3_600_000);
  if (viewingFaction && (viewingFaction === event.parties[0] || viewingFaction === event.parties[1])) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Treaty formed with ${factionName(world, other)} covering ${scopeCount} ${scopeCount === 1 ? 'territory' : 'territories'} until +${hours}h.`;
  }
  return `DIPLOMACY — Treaty formed (${scopeCount} territories, +${hours}h).`;
}

export function formatTreatyExpiredLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyExpired' }>,
  viewingFaction?: Id,
): string {
  if (viewingFaction && (viewingFaction === event.parties[0] || viewingFaction === event.parties[1])) {
    const other = otherParty(event.parties, viewingFaction);
    return `DIPLOMACY — Treaty with ${factionName(world, other)} has expired.`;
  }
  return `DIPLOMACY — Treaty has expired.`;
}

export function formatAllyArrivalPeacefulLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allyArrivalPeaceful' }>,
): string {
  const allyName = factionName(world, event.allyFactionId);
  const place = territoryLabelWithOwner(world, event.territoryId);
  const origin = territoryLabelWithOwner(world, event.fromTerritoryId);
  return `DIPLOMACY — Forces from ${allyName} arrived at ${place} — peaceful, returned to ${origin}.`;
}

export function formatDispatchCancelledByAllianceLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'dispatchCancelledByAlliance' }>,
): string {
  const allyName = factionName(world, event.allyFactionId);
  return `DIPLOMACY — Order cancelled — alliance with ${allyName} formed mid-transit.`;
}

export function formatOrderRedirectedToAllyLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'orderRedirectedToAlly' }>,
): string {
  const allyName = factionName(world, event.newOwnerId);
  const place = territoryLabelWithOwner(world, event.territoryId);
  return `DIPLOMACY — Assault cancelled — ${place} now held by allied ${allyName}.`;
}

export function formatAllianceProposedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceProposed' }>,
): string {
  const proposer = factionName(world, event.from);
  const hours = hoursUntil(event.expiresAt, event.at);
  return `DIPLOMACY — ${proposer} proposes alliance. (Expires in ${hours}h.)`;
}

export function formatAllianceDeclinedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'allianceDeclined' }>,
  viewingFaction?: Id,
): string {
  const other = event.declinedBy === event.from ? event.to : event.from;
  const otherName = factionName(world, other);
  if (viewingFaction === event.declinedBy) {
    return `DIPLOMACY — You declined alliance with ${otherName}.`;
  }
  return `DIPLOMACY — ${factionName(world, event.declinedBy)} declined alliance with ${otherName}.`;
}

export function formatTreatyProposedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyProposed' }>,
): string {
  const proposer = factionName(world, event.from);
  const place = territoryLabelWithOwner(world, event.territoryIds[0] ?? '');
  const hours = hoursUntil(event.expiresAt, event.at);
  return `DIPLOMACY — ${proposer} proposes intel treaty on ${place}. (Expires in ${hours}h.)`;
}

export function formatTreatyDeclinedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'treatyDeclined' }>,
  viewingFaction?: Id,
): string {
  const other = event.declinedBy === event.from ? event.to : event.from;
  const otherName = factionName(world, other);
  if (viewingFaction === event.declinedBy) {
    return `DIPLOMACY — You declined treaty with ${otherName}.`;
  }
  return `DIPLOMACY — ${factionName(world, event.declinedBy)} declined treaty with ${otherName}.`;
}

export function formatCapitalRelocatedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'capitalRelocated' }>,
): string {
  const country = findCountry(world, event.countryId);
  const countryLabel = country?.name ?? event.countryId;
  const oldName = territoryLabelWithOwner(world, event.oldCapitalTerritoryId);
  const newName = territoryLabelWithOwner(world, event.newCapitalTerritoryId);
  return `Capital of ${countryLabel} relocated from ${oldName} to ${newName}.`;
}

export function formatCountryDefeatedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'countryDefeated' }>,
): string {
  const country = findCountry(world, event.countryId);
  const countryLabel = country?.name ?? event.countryId;
  const leader = world.factions[event.countryId]?.leaderId
    ? (world.leaders[world.factions[event.countryId]!.leaderId]?.name ??
      factionName(world, event.countryId))
    : factionName(world, event.countryId);
  const finalCity = territoryLabelWithOwner(world, event.finalTerritoryId);
  return `${countryLabel} has fallen. ${leader}'s reign ends at ${finalCity}.`;
}

export function formatVictoryLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'victory' }>,
): string {
  const country = findCountry(world, event.factionId);
  const countryLabel = country?.name ?? event.factionId;
  return `${countryLabel} is the last country standing.`;
}

export function formatIntentDepartureLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'departure' }>,
): string {
  const who = subject(world, event.ownerId);
  const from = territoryLabelWithOwner(world, event.fromTerritoryId);
  const to = territoryLabelWithOwner(world, event.toTerritoryId);
  const prefix = isPlayerFaction(world, event.ownerId) ? 'DEPARTURE' : 'INTEL';

  switch (event.intent) {
    case 'attack':
      return `${prefix} — ${who} forces advancing from ${from} toward ${to}`;
    case 'defend':
      return `${prefix} — ${who} forces repositioning to ${to}`;
    case 'expand':
      return `${prefix} — ${who} forces moving to claim ${to}`;
    case 'build':
      return `${prefix} — ${who} forces redeploying to ${to}`;
  }
}

export function formatIntentArrivalLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'arrival' }>,
): string {
  const who = subject(world, event.ownerId);
  const place = territoryLabelWithOwner(world, event.territoryId);
  const prefix = isPlayerFaction(world, event.ownerId) ? 'ARRIVAL' : 'INTEL';

  switch (event.intent) {
    case 'attack':
      return `${prefix} — ${who} forces arrived at ${place} — contact expected`;
    case 'defend':
      return `${prefix} — ${who} forces arrived at ${place}`;
    case 'expand':
      return `${prefix} — ${who} forces arrived to claim ${place}`;
    case 'build':
      return `${prefix} — ${who} forces arrived at ${place}`;
  }
}

export function formatBuildStartedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'buildStarted' }>,
): string {
  const place = territoryLabelWithOwner(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'PRODUCTION' : 'INTEL';
  return `${prefix} — Construction begun at ${place} (${who})`;
}

export function formatInfraUpgradedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'infraUpgraded' }>,
): string {
  const place = territoryLabelWithOwner(world, event.territoryId);
  const who = subject(world, event.factionId);
  const prefix = isPlayerFaction(world, event.factionId) ? 'BUILD' : 'INTEL';
  return `${prefix} — Infrastructure upgraded at ${place} (${who})`;
}

export function formatIntelReportLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'intelReport' }>,
): string {
  const place = territoryLabelWithOwner(world, event.territoryId);
  const prefix = 'INTEL';

  if (event.source === 'allied') {
    const ally = factionName(world, event.observerFaction);
    const who = event.subjectFactionId
      ? factionName(world, event.subjectFactionId)
      : 'enemy';
    switch (event.variant) {
      case 'construction':
        return `${prefix} — ${ally}'s forces report construction at ${place}`;
      case 'massing':
        return `${prefix} — ${ally}'s forces report ${who} forces massing at ${place}`;
      case 'activity':
        return `${prefix} — ${ally}'s forces report ${who} activity at ${place}`;
    }
  }

  if (event.source === 'treaty') {
    const who = event.subjectFactionId
      ? factionName(world, event.subjectFactionId)
      : 'enemy';
    const descriptor = event.garrisonDescriptor ?? 'activity';
    if (event.variant === 'massing' || event.variant === 'construction') {
      return `${prefix} — Per treaty, ${who} activity at ${place}: ${descriptor}`;
    }
    return `${prefix} — Per treaty, ${who} garrison at ${place}: ${descriptor}`;
  }

  switch (event.variant) {
    case 'construction':
      return `${prefix} — Scouts report construction at ${place}`;
    case 'massing': {
      const who = event.subjectFactionId
        ? factionName(world, event.subjectFactionId)
        : 'enemy';
      return `${prefix} — Scouts report ${who} forces massing at ${place}`;
    }
    case 'activity': {
      const who = event.subjectFactionId
        ? factionName(world, event.subjectFactionId)
        : 'enemy';
      return `${prefix} — Scouts report ${who} activity at ${place}`;
    }
  }
}

export function formatDiplomaticMissionLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'diplomaticMissionStarted' }>,
): string {
  return `DIPLOMATIC MISSION — envoy to ${territoryName(world, event.targetCityId)} until day ${Math.ceil((event.expiresAt - world.startMs) / 86_400_000)}`;
}

export function formatDiplomaticMissionExpiredLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'diplomaticMissionExpired' }>,
): string {
  return `DIPLOMATIC MISSION — envoy recalled from ${territoryName(world, event.targetCityId)}`;
}

export function formatDiplomaticMissionExpelledLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'diplomaticMissionExpelled' }>,
): string {
  return `DIPLOMATIC MISSION — envoy expelled from ${territoryName(world, event.targetCityId)} (${event.reason})`;
}

export function formatCulturalCampaignLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'culturalCampaignApplied' }>,
): string {
  return `CULTURAL CAMPAIGN — +${event.influenceDelta} influence in ${territoryName(world, event.targetCityId)}`;
}

export function formatSubversionAppliedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'subversionApplied' }>,
): string {
  return `SUBVERSION — +${event.influenceDelta} covert influence in ${territoryName(world, event.targetCityId)}`;
}

export function formatSubversionDiscoveredLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'subversionDiscovered' }>,
): string {
  return `SUBVERSION EXPOSED — ${factionName(world, event.ownerId)} caught influencing ${factionName(world, event.targetCountryId)}`;
}

export function formatDiplomaticPressureLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'diplomaticPressureApplied' }>,
  proposalLabel: string,
): string {
  return `DIPLOMATIC PRESSURE — ${factionName(world, event.actorId)} forced ${factionName(world, event.targetCountryId)} to accept ${proposalLabel}`;
}

export function formatTributeStartedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeStarted' }>,
): string {
  return `TRIBUTE — extraction begins in ${territoryName(world, event.targetCityId)}`;
}

export function formatTributeAccruedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeAccrued' }>,
): string {
  return `TRIBUTE INCOME — +${Math.round(event.goldTransferred)} gold from ${territoryName(world, event.targetCityId)}`;
}

export function formatTributeMinorRebellionLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeMinorRebellion' }>,
): string {
  return `TRIBUTE UNREST — resentment rising in ${territoryName(world, event.targetCityId)}`;
}

export function formatTributeMajorRebellionLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeMajorRebellion' }>,
): string {
  return `TRIBUTE REBELLION — ${territoryName(world, event.targetCityId)} revolts against ${factionName(world, event.actorId)}`;
}

export function formatTributeAutoEndedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeAutoEnded' }>,
): string {
  return `TRIBUTE ENDED — extraction in ${territoryName(world, event.targetCityId)} (${event.reason})`;
}

export function formatTributeVoluntarilyEndedLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'tributeVoluntarilyEnded' }>,
): string {
  return `TRIBUTE ENDED — ${factionName(world, event.actorId)} withdrew extraction from ${territoryName(world, event.targetCityId)}`;
}

export function formatCoupSuccessLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'coupSuccess' }>,
): string {
  return `COUP SUCCEEDED — ${factionName(world, event.actorId)} seized ${territoryName(world, event.targetCityId)} from ${factionName(world, event.targetCountryId)}`;
}

export function formatCoupFailureLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'coupFailure' }>,
): string {
  return `COUP FAILED — ${factionName(world, event.actorId)}'s influence collapsed in ${territoryName(world, event.targetCityId)}`;
}

export function formatDefectionOccurredLine(
  world: WorldState,
  event: Extract<SimEvent, { kind: 'defectionOccurred' }>,
): string {
  const city = territoryName(world, event.targetCityId);
  const actor = factionName(world, event.actorId);
  const targetCountry = factionName(world, event.targetCountryId);
  const leader =
    world.leaders[event.previousLeaderId]?.name ?? factionName(world, event.targetCountryId);
  return `City defected: ${city} chose ${actor} over ${targetCountry}. ${leader}'s influence wanes.`;
}
