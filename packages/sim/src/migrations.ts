import type { Leader, TutorialState, UnitType, WorldState } from './types';
import { ensureWorldDiplomacy } from './diplomacy';
import { STANDARD_TIME_MULTIPLIER } from './tutorial';

export interface WorldMigrationCatalog {
  /** Canonical unit types merged into saves missing newer entries (e.g. scout-t1). */
  unitTypes?: Record<string, UnitType>;
  /** Canonical leaders merged into saves missing newer entries (e.g. leader-philip). */
  leaders?: Record<string, Leader>;
}

function mergeMissingById<T>(
  existing: Record<string, T> | undefined,
  canonical: Record<string, T>,
): Record<string, T> {
  const merged = { ...(existing ?? {}) };
  for (const [id, value] of Object.entries(canonical)) {
    if (!(id in merged)) {
      merged[id] = value;
    }
  }
  return merged;
}

function normalizeTutorialState(tutorial: Partial<TutorialState>): TutorialState {
  return {
    active: tutorial.active ?? false,
    currentBeat: tutorial.currentBeat ?? null,
    completedBeats: tutorial.completedBeats ?? [],
    startedAt: tutorial.startedAt ?? 0,
    graduatedAt: tutorial.graduatedAt ?? null,
  };
}

/** Backfill time multiplier and partial tutorial objects on older saves. */
export function ensureWorldTimeMultiplier(world: WorldState): WorldState {
  const timeMultiplier = world.timeMultiplier ?? STANDARD_TIME_MULTIPLIER;
  if (world.tutorial === undefined) {
    return { ...world, timeMultiplier };
  }
  return {
    ...world,
    timeMultiplier,
    tutorial: normalizeTutorialState(world.tutorial),
  };
}

function ensureFactionFields(world: WorldState): WorldState {
  const factions: WorldState['factions'] = {};
  for (const [id, faction] of Object.entries(world.factions)) {
    factions[id] = {
      ...faction,
      identityTags: faction.identityTags ?? [],
    };
  }
  return {
    ...world,
    factions,
    pendingDilemmas: world.pendingDilemmas ?? [],
  };
}

/**
 * Additive world-state migrations for saves created before newer sim fields ship.
 * Diplomacy backfill, missing unit types, missing leaders — each field follows the
 * same merge-missing pattern for future Sprint 8+ state shape changes.
 */
export function ensureWorldMigrations(
  world: WorldState,
  catalog: WorldMigrationCatalog = {},
): WorldState {
  let next = ensureWorldDiplomacy(world);

  next = ensureWorldTimeMultiplier(next);

  if (catalog.unitTypes) {
    next = {
      ...next,
      unitTypes: mergeMissingById(next.unitTypes, catalog.unitTypes),
    };
  }

  if (catalog.leaders) {
    next = {
      ...next,
      leaders: mergeMissingById(next.leaders, catalog.leaders),
    };
  }

  next = ensureFactionFields(next);

  return next;
}
