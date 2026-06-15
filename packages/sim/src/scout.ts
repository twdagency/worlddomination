import { BASE_SCOUT_RANGE_KM, DEFAULT_TRAIT } from './constants';
import type { Unit, UnitType, WorldState } from './types';

/** Scout unit type id — must match `packages/shared/src/units.ts`. */
export const SCOUT_UNIT_TYPE_ID = 'scout-t1';

/** Build cost multiplier vs a comparable standard unit (infantry-t2 baseline). */
export const SCOUT_BUILD_COST_MULT = 0.5;
/** Applied to combat power in `unitStackPower` for scout stacks. */
export const SCOUT_COMBAT_WEIGHT_MULT = 0.2;
/** Multiplier on faction base scout range for scout unit observers. */
export const SCOUT_UNIT_RANGE_MULT = 2.5;

export function isScoutUnitType(unitType: UnitType | undefined): boolean {
  return unitType?.id === SCOUT_UNIT_TYPE_ID || unitType?.role === 'spy';
}

export function isScoutUnit(world: WorldState, unit: Unit): boolean {
  return isScoutUnitType(world.unitTypes[unit.typeId]);
}

export function scoutUnitRangeKm(world: WorldState, factionId: string): number {
  const faction = world.factions[factionId];
  const leader = faction ? world.leaders[faction.leaderId] : undefined;
  const mult = leader?.traits.scoutRangeMult ?? DEFAULT_TRAIT;
  return BASE_SCOUT_RANGE_KM * mult * SCOUT_UNIT_RANGE_MULT;
}
