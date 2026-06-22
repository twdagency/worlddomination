import type { Id } from 'sim';

export type InfluenceMagnitude = 'low' | 'moderate' | 'high';

export function influenceMagnitude(value: number): InfluenceMagnitude {
  if (value >= 70) return 'high';
  if (value >= 30) return 'moderate';
  return 'low';
}

export function formatInfluenceMagnitudeLabel(magnitude: InfluenceMagnitude): string {
  switch (magnitude) {
    case 'low':
      return 'low influence';
    case 'moderate':
      return 'moderate influence';
    case 'high':
      return 'high influence';
  }
}

export function formatFoggedActorInfluence(actorName: string, magnitude: InfluenceMagnitude): string {
  return `${actorName}: ${formatInfluenceMagnitudeLabel(magnitude)}`;
}

export function formatThresholdStars(influence: number): string {
  if (influence >= 100) return '★★★';
  if (influence >= 70) return '★★';
  if (influence >= 30) return '★';
  return '';
}

export function formatInfluenceValue(influence: number): string {
  return `${Math.round(influence)}/100`;
}

export function formatCooldownDays(remainingMs: number): string {
  const days = Math.max(1, Math.ceil(remainingMs / 86_400_000));
  return `Available in ${days}d`;
}

export function formatSourceContribution(kind: string, contribution: number): string {
  const label = kind.replace(/-/g, ' ');
  const sign = contribution >= 0 ? '+' : '';
  return `${label}: ${sign}${contribution}/day`;
}

export function formatNetRatePerDay(rate: number): string {
  if (rate === 0) return '0/day';
  const sign = rate > 0 ? '+' : '';
  return `${sign}${rate.toFixed(rate % 1 === 0 ? 0 : 1)}/day`;
}

export function factionDisplayName(
  world: { factions: Record<string, { leaderId?: string }>; leaders: Record<string, { name?: string }> },
  factionId: Id,
): string {
  const leaderId = world.factions[factionId]?.leaderId;
  return world.leaders[leaderId ?? '']?.name ?? factionId;
}
