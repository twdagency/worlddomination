import { findCountry, recordConquerorOnTerritoryCapture } from './country';
import type { Id, Millis, SimEventDraft, WorldState } from './types';

/** Peaceful or coup-driven city ownership transfer with conqueror tracking. */
export function captureCityForCoup(
  world: WorldState,
  targetCityId: Id,
  actorId: Id,
  previousOwnerId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  const territory = world.territories[targetCityId];
  if (!territory) return { world, events: [] };
  if (findCountry(world, actorId)?.defeated === true) return { world, events: [] };

  const territories = {
    ...world.territories,
    [targetCityId]: { ...territory, ownerId: actorId },
  };
  const countries = recordConquerorOnTerritoryCapture(
    { ...world, territories },
    targetCityId,
    previousOwnerId,
    actorId,
  ).countries;

  return {
    world: { ...world, territories, countries },
    events: [
      {
        kind: 'territoryCaptured',
        at,
        territoryId: targetCityId,
        previousOwnerId,
        newOwnerId: actorId,
        importance: 'high',
      },
    ],
  };
}
