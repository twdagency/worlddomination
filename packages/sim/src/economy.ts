import {
  DEFAULT_TRAIT,
  EXTRACTION_INFRA_MULT,
  INFRA_YIELD_MULT,
  MS_PER_HOUR,
} from './constants';
import type { Id, Leader, ResourceId, Territory, WorldState } from './types';

export interface AccruedIncome {
  funding: number;
  /** Per-territory extraction gains — the only resource accrual ledger. */
  resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>>;
}

function leaderIncomeMult(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader: Leader | undefined = faction
    ? world.leaders[faction.leaderId]
    : undefined;
  return leader?.traits.incomeMult ?? DEFAULT_TRAIT;
}

/** Funding income per real hour for a single territory. */
export function incomePerHour(
  territory: Territory,
  incomeMult: number = DEFAULT_TRAIT,
): number {
  return territory.baseYield * (1 + INFRA_YIELD_MULT * territory.infraLevel) * incomeMult;
}

/** Per-resource extraction per hour (scaled by infra). */
export function extractionPerHour(
  territory: Territory,
  resourceId: ResourceId,
): number {
  const base = territory.extraction?.[resourceId] ?? 0;
  if (base <= 0) return 0;
  return base * (1 + EXTRACTION_INFRA_MULT * territory.infraLevel);
}

function scaleByElapsed(perHour: number, elapsedMs: number): number {
  return (perHour * elapsedMs) / MS_PER_HOUR;
}

function addTerritoryResource(
  byTerritory: Record<Id, Partial<Record<ResourceId, number>>>,
  territoryId: Id,
  resourceId: ResourceId,
  amount: number,
): Record<Id, Partial<Record<ResourceId, number>>> {
  if (amount <= 0) return byTerritory;
  const territoryAccrual = { ...byTerritory[territoryId] };
  territoryAccrual[resourceId] = (territoryAccrual[resourceId] ?? 0) + amount;
  return { ...byTerritory, [territoryId]: territoryAccrual };
}

/** Accrue faction funding and territory resource stocks over `elapsedMs`. Pure. */
export function accrueEconomy(
  world: WorldState,
  elapsedMs: number,
): { factions: WorldState['factions']; territories: WorldState['territories']; accrued: AccruedIncome } {
  if (elapsedMs <= 0) {
    return {
      factions: world.factions,
      territories: world.territories,
      accrued: { funding: 0, resourcesByTerritory: {} },
    };
  }

  const factions = { ...world.factions };
  const territories = { ...world.territories };
  let totalFunding = 0;
  let resourcesByTerritory: Record<Id, Partial<Record<ResourceId, number>>> = {};

  for (const territory of Object.values(world.territories)) {
    if (!territory.ownerId) continue;

    const faction = factions[territory.ownerId];
    if (!faction) continue;

    const incomeMult = leaderIncomeMult(world, territory.ownerId);
    const fundingGain = scaleByElapsed(incomePerHour(territory, incomeMult), elapsedMs);
    if (fundingGain > 0) {
      factions[territory.ownerId] = {
        ...faction,
        funding: faction.funding + fundingGain,
      };
      totalFunding += fundingGain;
    }

    const nextResources = { ...territory.resources };
    let territoryChanged = false;

    for (const resourceId of ['fuel', 'steel', 'rareMetals', 'food'] as const) {
      const gain = scaleByElapsed(extractionPerHour(territory, resourceId), elapsedMs);
      if (gain <= 0) continue;
      nextResources[resourceId] = (nextResources[resourceId] ?? 0) + gain;
      resourcesByTerritory = addTerritoryResource(
        resourcesByTerritory,
        territory.id,
        resourceId,
        gain,
      );
      territoryChanged = true;
    }

    if (territoryChanged) {
      territories[territory.id] = { ...territory, resources: nextResources };
    }
  }

  return {
    factions,
    territories,
    accrued: { funding: totalFunding, resourcesByTerritory },
  };
}
