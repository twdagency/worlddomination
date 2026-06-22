import { areAllied } from './diplomacy';
import type { Id, Order, WorldState } from './types';

export type InfluenceOrderRejectionReason =
  | 'insufficient-influence'
  | 'no-pending-proposal'
  | 'unsupported-proposal-kind'
  | 'target-country-mismatch'
  | 'active-treaty-exists'
  | 'tribute-already-active'
  | 'no-active-tribute'
  | 'insufficient-gold'
  | 'insufficient-manpower'
  | 'target-is-own-city'
  | 'target-is-allied'
  | 'target-owner-defeated'
  | 'target-city-unknown'
  | 'mission-already-active'
  | 'cultural-campaign-cooldown'
  | 'no-active-mission';

const INFLUENCE_ORDER_KINDS = new Set<Order['kind']>([
  'diplomatic-mission',
  'cultural-campaign',
  'influence-subversion',
  'cancel-diplomatic-mission',
  'diplomatic-pressure',
  'tribute-extraction',
  'tribute-cancel',
  'coup-attempt',
  'defection-claim',
]);

export function isInfluenceOrder(order: Order): boolean {
  return INFLUENCE_ORDER_KINDS.has(order.kind);
}

function isOwnerDefeated(world: WorldState, ownerId: Id | undefined): boolean {
  if (!ownerId) return true;
  return world.countries?.[ownerId]?.defeated === true;
}

export function validateInfluenceTarget(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
): { ok: true; ownerId: Id } | { ok: false; reason: InfluenceOrderRejectionReason } {
  const city = world.territories[targetCityId];
  if (!city) return { ok: false, reason: 'target-city-unknown' };
  const cityOwnerId = city.ownerId;
  if (!cityOwnerId) return { ok: false, reason: 'target-city-unknown' };
  if (cityOwnerId === ownerId) return { ok: false, reason: 'target-is-own-city' };
  if (areAllied(world, ownerId, cityOwnerId)) return { ok: false, reason: 'target-is-allied' };
  if (isOwnerDefeated(world, cityOwnerId)) return { ok: false, reason: 'target-owner-defeated' };
  return { ok: true, ownerId: cityOwnerId };
}
