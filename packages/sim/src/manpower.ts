import { DEFAULT_TRAIT, MANPOWER_REGEN_PER_YIELD, MS_PER_HOUR } from './constants';
import type { Id, WorldState } from './types';

function leaderManpowerMult(world: WorldState, factionId: Id): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  return leader?.traits.manpowerRegenMult ?? DEFAULT_TRAIT;
}

/** Manpower regenerated per hour for a faction from all held territories. */
export function manpowerRegenPerHour(world: WorldState, factionId: Id): number {
  const mult = leaderManpowerMult(world, factionId);
  let total = 0;
  for (const territory of Object.values(world.territories)) {
    if (territory.ownerId !== factionId) continue;
    total += territory.baseYield * MANPOWER_REGEN_PER_YIELD * mult;
  }
  return total;
}

/** Regenerate manpower pools over `elapsedMs`, respecting caps. Pure. */
export function accrueManpower(
  world: WorldState,
  elapsedMs: number,
): WorldState['factions'] {
  if (elapsedMs <= 0) return world.factions;

  const factions = { ...world.factions };
  for (const factionId of Object.keys(factions)) {
    const faction = factions[factionId];
    if (!faction) continue;

    const gain = (manpowerRegenPerHour(world, factionId) * elapsedMs) / MS_PER_HOUR;
    if (gain <= 0) continue;

    factions[factionId] = {
      ...faction,
      manpower: Math.min(faction.manpowerCap, faction.manpower + gain),
    };
  }

  return factions;
}
