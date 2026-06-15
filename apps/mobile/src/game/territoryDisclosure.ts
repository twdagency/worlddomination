import type { Territory, WorldState } from 'sim';

export interface ActiveBuildEntry {
  territoryId: string;
  territoryName: string;
  unitTypeId: string;
  count: number;
  remainingMs: number;
}

export function territoryHasFoodShortage(territory: Territory): boolean {
  const food = territory.resources.food ?? 0;
  return food < 100;
}

export function territoryGlanceSubtitle(territory: Territory): string {
  const queue = territory.buildQueue?.length ?? 0;
  const facility = territory.infraLevel < 3 ? 'Depot' : 'Arsenal';
  const queuePart = queue > 0 ? ` · ${queue} building` : '';
  const foodPart = territoryHasFoodShortage(territory) ? ' · food low' : '';
  return `Infra ${territory.infraLevel} · ${facility}${queuePart}${foodPart}`;
}

export function sortTerritoriesForDisplay(territories: Territory[]): Territory[] {
  return [...territories].sort((a, b) => {
    const aQueue = (a.buildQueue?.length ?? 0) > 0 ? 1 : 0;
    const bQueue = (b.buildQueue?.length ?? 0) > 0 ? 1 : 0;
    if (aQueue !== bQueue) return bQueue - aQueue;

    const aFood = territoryHasFoodShortage(a) ? 1 : 0;
    const bFood = territoryHasFoodShortage(b) ? 1 : 0;
    if (aFood !== bFood) return bFood - aFood;

    return a.name.localeCompare(b.name);
  });
}

export function collectActiveBuilds(
  world: WorldState,
  territories: Territory[],
): ActiveBuildEntry[] {
  const entries: ActiveBuildEntry[] = [];
  for (const territory of territories) {
    for (const item of territory.buildQueue ?? []) {
      const completeAt = item.startMs + item.durationMs;
      entries.push({
        territoryId: territory.id,
        territoryName: territory.name,
        unitTypeId: item.unitTypeId,
        count: item.count,
        remainingMs: Math.max(0, completeAt - world.nowMs),
      });
    }
  }
  return entries.sort((a, b) => a.remainingMs - b.remainingMs);
}
