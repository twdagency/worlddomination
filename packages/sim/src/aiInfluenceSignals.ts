import { areAllied } from './diplomacy';
import { getInfluence } from './influence';
import { isInfluenceAgencyDisabled, resolvePlayerFactionId } from './aiInfluenceAgency';
import type { DiplomaticPosture, Id, LeaderWeights, WorldState } from './types';

/** Per 10 influence points of attacker's own standing in the target city. */
export const ATTACK_OWN_INFLUENCE_PENALTY = -0.5;

/** Per 10 influence points when a third party has destabilizing (50+) presence. */
export const ATTACK_THIRD_PARTY_INFLUENCE_BONUS = 0.3;

export const DESTABILIZED_INFLUENCE_THRESHOLD = 50;

/** Per 10 foreign influence points when defending own cities. */
export const DEFEND_FOREIGN_INFLUENCE_BONUS = 0.4;

/** Extra defense priority per competing foreign actor with positive influence. */
export const DEFEND_MULTI_ACTOR_BONUS = 2;

/** Per 10 player influence in target — slight reluctance to assault sympathetic cities. */
export const ATTACK_PLAYER_SYMPATHY_PENALTY = -0.2;

export function maxForeignInfluenceInCity(
  world: WorldState,
  cityId: Id,
  excludeActorId: Id,
  minValue = 0,
): number {
  const row = world.influence?.[cityId];
  if (!row) return 0;

  let max = 0;
  for (const [actorId, state] of Object.entries(row)) {
    if (actorId === excludeActorId) continue;
    const value = state?.value ?? 0;
    if (value >= minValue) {
      max = Math.max(max, value);
    }
  }
  return max;
}

export function foreignInfluencePressure(
  world: WorldState,
  cityId: Id,
  ownerId: Id,
): { total: number; actorCount: number } {
  const row = world.influence?.[cityId];
  if (!row) return { total: 0, actorCount: 0 };

  let total = 0;
  let actorCount = 0;
  for (const [actorId, state] of Object.entries(row)) {
    if (actorId === ownerId) continue;
    const value = state?.value ?? 0;
    if (value > 0) {
      total += value;
      actorCount++;
    }
  }
  return { total, actorCount };
}

export function attackInfluenceSignal(
  world: WorldState,
  attackerId: Id,
  targetCityId: Id,
): number {
  if (isInfluenceAgencyDisabled(world)) return 0;

  const ownerId = world.territories[targetCityId]?.ownerId;
  if (!ownerId || ownerId === attackerId) return 0;
  if (areAllied(world, attackerId, ownerId)) return 0;

  const ownInfluence = getInfluence(world, targetCityId, attackerId);
  let signal = (ownInfluence / 10) * ATTACK_OWN_INFLUENCE_PENALTY;

  const destabilized = maxForeignInfluenceInCity(
    world,
    targetCityId,
    attackerId,
    DESTABILIZED_INFLUENCE_THRESHOLD,
  );
  if (destabilized >= DESTABILIZED_INFLUENCE_THRESHOLD) {
    signal += (destabilized / 10) * ATTACK_THIRD_PARTY_INFLUENCE_BONUS;
  }

  const playerId = resolvePlayerFactionId(world);
  if (playerId && playerId !== attackerId) {
    const playerInfluence = getInfluence(world, targetCityId, playerId);
    if (playerInfluence > 0) {
      signal += (playerInfluence / 10) * ATTACK_PLAYER_SYMPATHY_PENALTY;
    }
  }

  return signal === 0 ? 0 : signal;
}

export function defendInfluenceSignal(
  world: WorldState,
  defenderId: Id,
  ownCityId: Id,
): number {
  if (isInfluenceAgencyDisabled(world)) return 0;
  if (world.territories[ownCityId]?.ownerId !== defenderId) return 0;

  const { total, actorCount } = foreignInfluencePressure(world, ownCityId, defenderId);
  if (total <= 0) return 0;

  let signal = (total / 10) * DEFEND_FOREIGN_INFLUENCE_BONUS;
  if (actorCount >= 2) {
    signal += actorCount * DEFEND_MULTI_ACTOR_BONUS;
  }
  return signal;
}

export function moveReinforceInfluenceSignal(
  world: WorldState,
  moverId: Id,
  targetCityId: Id,
): number {
  if (isInfluenceAgencyDisabled(world)) return 0;
  return defendInfluenceSignal(world, moverId, targetCityId) * 0.5;
}

export function attackInfluencePostureModifier(
  posture: DiplomaticPosture,
  aggression: number,
  ownInfluence: number,
  destabilized: boolean,
): number {
  let mod = 0;

  switch (posture) {
    case 'opportunist':
      if (destabilized) mod += 3;
      if (ownInfluence >= 30) mod += 1.5;
      break;
    case 'loyal':
      break;
    case 'isolationist':
      break;
  }

  if (aggression >= 8 && destabilized) {
    mod += 2;
  }

  return mod;
}

export function defendInfluencePostureModifier(
  posture: DiplomaticPosture,
  foreignInfluenceTotal: number,
): number {
  if (foreignInfluenceTotal <= 0) return 0;

  switch (posture) {
    case 'loyal':
      return (foreignInfluenceTotal / 10) * 0.5;
    case 'opportunist':
      return (foreignInfluenceTotal / 10) * 0.15;
    case 'isolationist':
      return (foreignInfluenceTotal / 10) * 0.25;
  }
}

export function computeAttackInfluenceScoreAdjustment(
  world: WorldState,
  attackerId: Id,
  targetCityId: Id,
  weights: LeaderWeights,
): number {
  const base = attackInfluenceSignal(world, attackerId, targetCityId);
  const ownInfluence = getInfluence(world, targetCityId, attackerId);
  const destabilized =
    maxForeignInfluenceInCity(
      world,
      targetCityId,
      attackerId,
      DESTABILIZED_INFLUENCE_THRESHOLD,
    ) >= DESTABILIZED_INFLUENCE_THRESHOLD;

  return (
    base +
    attackInfluencePostureModifier(
      weights.diplomaticPosture,
      weights.aggression,
      ownInfluence,
      destabilized,
    )
  );
}

export function computeDefendInfluenceScoreAdjustment(
  world: WorldState,
  defenderId: Id,
  ownCityId: Id,
  weights: LeaderWeights,
): number {
  const base = defendInfluenceSignal(world, defenderId, ownCityId);
  const { total } = foreignInfluencePressure(world, ownCityId, defenderId);
  return base + defendInfluencePostureModifier(weights.diplomaticPosture, total);
}

export function computeMoveReinforceInfluenceScoreAdjustment(
  world: WorldState,
  moverId: Id,
  targetCityId: Id,
  weights: LeaderWeights,
): number {
  const base = moveReinforceInfluenceSignal(world, moverId, targetCityId);
  const { total } = foreignInfluencePressure(world, targetCityId, moverId);
  return base + defendInfluencePostureModifier(weights.diplomaticPosture, total) * 0.5;
}
