import { ensureWorldTributes } from './influence';
import type { ActiveTribute, Id, Millis, SimEventDraft, WorldState } from './types';

function sortedActiveTributes(world: WorldState): ActiveTribute[] {
  return [...(world.activeTributes ?? [])].sort((left, right) => {
    const cityCmp = left.targetCityId.localeCompare(right.targetCityId);
    if (cityCmp !== 0) return cityCmp;
    return left.actorId.localeCompare(right.actorId);
  });
}

export function cancelTributesForDefeatedCountry(
  world: WorldState,
  countryId: Id,
  at: Millis,
): { world: WorldState; events: SimEventDraft[] } {
  let next = ensureWorldTributes(world);
  const events: SimEventDraft[] = [];
  const remaining: ActiveTribute[] = [];

  for (const tribute of sortedActiveTributes(next)) {
    if (tribute.actorId === countryId || tribute.targetCountryId === countryId) {
      events.push({
        kind: 'tributeAutoEnded',
        at,
        actorId: tribute.actorId,
        targetCityId: tribute.targetCityId,
        reason: 'target-defeated',
        importance: 'medium',
      });
      continue;
    }
    remaining.push(tribute);
  }

  if (events.length === 0) return { world: next, events };
  return { world: { ...next, activeTributes: remaining }, events };
}
