import { interpolateGreatCircle } from './geo';
import type { Coord, Id, WorldState } from './types';

/** Interpolated current position of a unit (stationary or in transit). */
export function unitPosition(world: WorldState, unitId: Id): Coord {
  const unit = world.units[unitId];
  if (!unit) throw new Error(`Unknown unit: ${unitId}`);

  if (unit.transit) {
    const from = world.territories[unit.transit.fromId];
    if (!from) throw new Error(`Unknown origin territory: ${unit.transit.fromId}`);

    const fraction =
      world.nowMs <= unit.transit.departMs
        ? 0
        : world.nowMs >= unit.transit.arriveMs
          ? 1
          : (world.nowMs - unit.transit.departMs) /
            (unit.transit.arriveMs - unit.transit.departMs);

    return interpolateGreatCircle(from.coord, unit.transit.toCoord, fraction);
  }

  if (unit.locationId) {
    const territory = world.territories[unit.locationId];
    if (!territory) throw new Error(`Unknown territory: ${unit.locationId}`);
    return territory.coord;
  }

  throw new Error(`Unit ${unitId} has no position`);
}
