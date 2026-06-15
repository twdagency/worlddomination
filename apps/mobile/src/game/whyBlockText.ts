import type { BuildBlockedReason, ResourceId, UnitType, WorldState } from 'sim';
import { formatBuildBlockedMessage } from 'sim';

function resourceLabel(id: ResourceId): string {
  const labels: Record<ResourceId, string> = {
    fuel: 'fuel',
    steel: 'steel',
    rareMetals: 'rare metals',
    food: 'food',
  };
  return labels[id];
}

function ownedTerritoriesWithResource(world: WorldState, factionId: string, resource: ResourceId): string[] {
  return Object.values(world.territories)
    .filter((territory) => territory.ownerId === factionId && (territory.extraction?.[resource] ?? 0) > 0)
    .map((territory) => territory.name)
    .slice(0, 3);
}

/** Plain-language constraint explanation for WhyBlock surfaces. */
export function buildWhyExplanation(
  world: WorldState,
  factionId: string,
  territoryId: string,
  unitType: UnitType | undefined,
  reason: BuildBlockedReason,
  territoryResources?: Record<ResourceId, number>,
): string {
  const base = formatBuildBlockedMessage(unitType, reason);
  const territory = world.territories[territoryId];
  const territoryName = territory?.name ?? 'this territory';

  switch (reason.code) {
    case 'missing-resource': {
      const resource = reason.missing ?? 'food';
      const required = unitType?.billOfMaterials?.[resource] ?? 0;
      const available = territoryResources?.[resource] ?? territory?.resources[resource] ?? 0;
      const producers = ownedTerritoriesWithResource(world, factionId, resource);
      const acquire =
        producers.length > 0
          ? `Acquire from: ${producers.join(', ')}`
          : 'Acquire from: conquer resource-rich territories or build extraction infrastructure';
      return `Cannot build ${unitType?.name ?? 'unit'} at ${territoryName} — requires ${required} ${resourceLabel(resource)}, you have ${Math.floor(available)}. ${acquire}.`;
    }
    case 'insufficient-funding': {
      const funding = world.factions[factionId]?.funding ?? 0;
      const required = unitType?.fundingCost ?? 0;
      return `${base} You have ${Math.floor(funding).toLocaleString()} funding; need ${Math.ceil(required).toLocaleString()}. Raise income from territories or wait for accrual.`;
    }
    case 'insufficient-manpower': {
      const manpower = world.factions[factionId]?.manpower ?? 0;
      const required = unitType?.manpowerCost ?? 0;
      return `${base} You have ${Math.floor(manpower).toLocaleString()} manpower; need ${Math.ceil(required).toLocaleString()}. Manpower regenerates hourly across owned territories.`;
    }
    case 'infra-too-low':
      return `${base} Upgrade infrastructure at ${territoryName} to unlock higher-tier production.`;
    default:
      return base;
  }
}

export function infraWhyExplanation(previewShortfall: string | undefined): string | undefined {
  if (!previewShortfall) return undefined;
  return `${previewShortfall}. Funding accrues from territory income while away.`;
}
