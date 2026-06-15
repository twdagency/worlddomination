import { INFRA_UPGRADE_BASE_COST, MAX_INFRA_LEVEL } from 'sim';
import type { ResourceId, UnitType, WorldState } from 'sim';
import type { BuildCheckResult } from 'sim';

export interface CostLine {
  id: string;
  label: string;
  required: number;
  available: number;
}

export interface CostPreview {
  lines: CostLine[];
  affordable: boolean;
  shortfallLabel?: string;
}

const RESOURCE_LABELS: Record<ResourceId, string> = {
  fuel: 'Fuel',
  steel: 'Steel',
  rareMetals: 'Rare metals',
  food: 'Food',
};

function firstShortfall(lines: CostLine[]): string | undefined {
  const missing = lines.find((line) => line.available < line.required);
  if (!missing) return undefined;
  const deficit = missing.required - missing.available;
  return `Need ${Math.ceil(deficit).toLocaleString()} more ${missing.label.toLowerCase()} (have ${Math.floor(missing.available).toLocaleString()}, need ${Math.ceil(missing.required).toLocaleString()})`;
}

export function evaluateCostLines(lines: CostLine[]): CostPreview {
  const affordable = lines.every((line) => line.available >= line.required);
  return {
    lines,
    affordable,
    shortfallLabel: affordable ? undefined : firstShortfall(lines),
  };
}

export function infraUpgradeCostPreview(
  world: WorldState,
  territoryId: string,
  factionId: string,
): CostPreview {
  const territory = world.territories[territoryId];
  const faction = world.factions[factionId];
  if (!territory || !faction) {
    return { lines: [], affordable: false, shortfallLabel: 'Territory unavailable' };
  }
  if (territory.infraLevel >= MAX_INFRA_LEVEL) {
    return { lines: [], affordable: false, shortfallLabel: 'Infrastructure already at maximum level' };
  }

  const required = INFRA_UPGRADE_BASE_COST * territory.infraLevel;
  return evaluateCostLines([
    {
      id: 'funding',
      label: 'Funding',
      required,
      available: faction.funding,
    },
  ]);
}

export function unitBuildCostPreview(
  world: WorldState,
  territoryId: string,
  unitType: UnitType,
  factionId: string,
): CostPreview {
  const territory = world.territories[territoryId];
  const faction = world.factions[factionId];
  if (!territory || !faction) {
    return { lines: [], affordable: false, shortfallLabel: 'Territory unavailable' };
  }

  const lines: CostLine[] = [
    {
      id: 'funding',
      label: 'Funding',
      required: unitType.fundingCost,
      available: faction.funding,
    },
    {
      id: 'manpower',
      label: 'Manpower',
      required: unitType.manpowerCost,
      available: faction.manpower,
    },
  ];

  for (const [resourceId, perUnit] of Object.entries(unitType.billOfMaterials ?? {})) {
    const amount = perUnit ?? 0;
    if (amount <= 0) continue;
    const key = resourceId as ResourceId;
    lines.push({
      id: key,
      label: RESOURCE_LABELS[key],
      required: amount,
      available: territory.resources[key] ?? 0,
    });
  }

  return evaluateCostLines(lines);
}

export function costPreviewFromBuildCheck(
  world: WorldState,
  territoryId: string,
  unitType: UnitType,
  factionId: string,
  check: BuildCheckResult | undefined,
): CostPreview {
  const preview = unitBuildCostPreview(world, territoryId, unitType, factionId);
  if (check?.ok) return preview;
  if (check && !check.ok) {
    return {
      ...preview,
      affordable: false,
    };
  }
  return preview;
}
export function treatyOfferLine(territoryName: string): CostLine {
  return {
    id: 'offer',
    label: `Access offered: ${territoryName}`,
    required: 1,
    available: 1,
  };
}
