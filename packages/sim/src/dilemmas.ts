import type { Dilemma, DilemmaConsequence, DilemmaOption } from 'shared/dilemmas';
import type { Faction, Id, Millis, PendingDilemma, Reputation, SimEvent, SimEventDraft, Territory, WorldState } from './types';
import { findCountry } from './country';
import { stampEvents } from './events';
import { FOREIGN_RULE_DILEMMA } from './dilemmas/foreignRule';

const DILEMMAS_BY_ID: Record<string, Dilemma> = {
  [FOREIGN_RULE_DILEMMA.id]: FOREIGN_RULE_DILEMMA,
};

export function getDilemmaById(dilemmaId: Id): Dilemma | undefined {
  return DILEMMAS_BY_ID[dilemmaId];
}

export function dropPendingDilemmasForFaction(world: WorldState, factionId: Id): WorldState {
  const pending = world.pendingDilemmas ?? [];
  const next = pending.filter((entry) => entry.countryId !== factionId);
  if (next.length === pending.length) return world;
  return { ...world, pendingDilemmas: next };
}

export function enqueuePendingDilemma(
  world: WorldState,
  dilemmaId: Id,
  factionId: Id,
  at: Millis,
): WorldState {
  if (findCountry(world, factionId)?.defeated === true) return world;
  const pending = world.pendingDilemmas ?? [];
  if (pending.some((entry) => entry.dilemmaId === dilemmaId && entry.countryId === factionId)) {
    return world;
  }
  const entry: PendingDilemma = { dilemmaId, countryId: factionId, offeredAt: at };
  return { ...world, pendingDilemmas: [...pending, entry] };
}

function applyStandingDelta(territories: Record<Id, Territory>, factionId: Id, delta: number): Record<Id, Territory> {
  const next = { ...territories };
  for (const territory of Object.values(next)) {
    if (territory.ownerId !== factionId) continue;
    next[territory.id] = {
      ...territory,
      standing: (territory.standing ?? 50) + delta,
    };
  }
  return next;
}

function applyReputationDelta(
  reputation: Reputation,
  factionId: Id,
  delta: number,
  factions: Record<Id, Faction>,
): Reputation {
  const next: Reputation = {};
  for (const observer of Object.keys(reputation)) {
    next[observer] = { ...reputation[observer] };
  }
  for (const otherId of Object.keys(factions)) {
    if (otherId === factionId) continue;
    if (!next[otherId]) next[otherId] = {};
    next[otherId][factionId] = (next[otherId][factionId] ?? 0) + delta;
  }
  return next;
}

function applyConsequence(
  world: WorldState,
  factionId: Id,
  consequence: DilemmaConsequence,
): WorldState {
  switch (consequence.kind) {
    case 'resourceDelta': {
      if (consequence.resource !== 'gold') return world;
      const faction = world.factions[factionId];
      if (!faction) return world;
      return {
        ...world,
        factions: {
          ...world.factions,
          [factionId]: {
            ...faction,
            funding: faction.funding + consequence.amount,
          },
        },
      };
    }
    case 'standingDelta':
      return {
        ...world,
        territories: applyStandingDelta(world.territories, factionId, consequence.amount),
      };
    case 'reputationDelta':
      return {
        ...world,
        reputation: applyReputationDelta(
          world.reputation,
          factionId,
          consequence.amount,
          world.factions,
        ),
      };
    case 'territoryEffect':
      return world;
    default:
      return world;
  }
}

function appendIdentityTags(faction: Faction, tags: string[]): Faction {
  const existing = faction.identityTags ?? [];
  const merged = [...existing];
  for (const tag of tags) {
    if (!merged.includes(tag)) merged.push(tag);
  }
  return { ...faction, identityTags: merged };
}

export function resolveDilemma(
  world: WorldState,
  factionId: Id,
  dilemmaId: Id,
  optionId: Id,
  at: Millis,
): { world: WorldState; events: SimEvent[] } {
  const dilemma = getDilemmaById(dilemmaId);
  if (!dilemma) {
    return { world, events: [] };
  }

  const pending = world.pendingDilemmas ?? [];
  const hasPending = pending.some(
    (entry) => entry.dilemmaId === dilemmaId && entry.countryId === factionId,
  );
  if (!hasPending) {
    return { world, events: [] };
  }

  const option: DilemmaOption | undefined = dilemma.options.find((entry) => entry.id === optionId);
  if (!option) {
    return { world, events: [] };
  }

  let next = world;
  for (const consequence of option.consequences) {
    next = applyConsequence(next, factionId, consequence);
  }

  const faction = next.factions[factionId];
  if (faction) {
    next = {
      ...next,
      factions: {
        ...next.factions,
        [factionId]: appendIdentityTags(faction, option.identityShift.tags),
      },
    };
  }

  next = {
    ...next,
    pendingDilemmas: pending.filter(
      (entry) => !(entry.dilemmaId === dilemmaId && entry.countryId === factionId),
    ),
  };

  const event: SimEventDraft = {
    kind: 'dilemmaResolved',
    at,
    countryId: factionId,
    dilemmaId,
    optionId,
    importance: 'high',
  };

  return stampEvents(next, [event]);
}
