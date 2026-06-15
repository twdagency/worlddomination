import type { Leader, UnitType, WorldState } from './types';
import { ensureWorldDiplomacy } from './diplomacy';

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

  return next;
}
