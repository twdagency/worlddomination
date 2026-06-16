import type { Id, WorldState } from 'sim';
import { selectTerritoryCountryContext } from './countrySelector';
import { classifyDestination, type DestinationStance } from './orderDestinations';

export type TerritoryOwnerLabelVariant = 'inline' | 'compact' | 'verbose';

export interface TerritoryOwnerLabelOptions {
  variant?: TerritoryOwnerLabelVariant;
  showLeader?: boolean;
  showStance?: boolean;
  stance?: DestinationStance;
  recommended?: boolean;
  playerId?: Id;
  ownerIdOverride?: Id;
}

export interface ResolvedTerritoryOwnerLabel {
  text: string;
  defeated: boolean;
  unclaimed: boolean;
}

function leaderNameFromContext(
  context: NonNullable<ReturnType<typeof selectTerritoryCountryContext>>,
): string | undefined {
  if (!context.country) return undefined;
  return context.country.leaderName;
}

function countryNameFromContext(
  context: NonNullable<ReturnType<typeof selectTerritoryCountryContext>>,
): string | undefined {
  if (context.orphanedFormerCountry) return context.orphanedFormerCountry;
  return context.country?.name;
}

function isDefeatedContext(
  context: NonNullable<ReturnType<typeof selectTerritoryCountryContext>>,
): boolean {
  return Boolean(context.country?.defeated);
}

function isUnclaimedContext(
  context: NonNullable<ReturnType<typeof selectTerritoryCountryContext>>,
): boolean {
  return !context.ownerId && !context.orphanedFormerCountry;
}

function appendDecisionContext(
  text: string,
  options: TerritoryOwnerLabelOptions,
  leaderName?: string,
): string {
  let result = text;
  if (options.recommended) result += ' · Suggested';
  if (!options.showStance || !options.stance) return result;

  if (options.stance === 'hostile' || options.stance === 'allied') {
    result += ` · ${options.stance.toUpperCase()}`;
    if (options.showLeader && leaderName) result += ` · ${leaderName}`;
  } else if (options.stance === 'neutral') {
    result += ' · NEUTRAL';
    if (options.showLeader && leaderName) result += ` · ${leaderName}`;
  }
  return result;
}

export function resolveTerritoryOwnerLabel(
  world: WorldState,
  territoryId: Id,
  options: TerritoryOwnerLabelOptions = {},
): ResolvedTerritoryOwnerLabel {
  const variant = options.variant ?? 'inline';
  const context = selectTerritoryCountryContext(
    world,
    territoryId,
    options.ownerIdOverride,
  );
  if (!context) {
    return { text: territoryId, defeated: false, unclaimed: true };
  }

  const { territoryName } = context;
  const countryName = countryNameFromContext(context);
  const leaderName = leaderNameFromContext(context);
  const defeated = isDefeatedContext(context);
  const unclaimed = isUnclaimedContext(context);

  let text: string;
  if (context.orphanedFormerCountry) {
    if (variant === 'verbose') {
      text = `${territoryName} — contested, formerly ${context.orphanedFormerCountry}`;
    } else if (variant === 'compact') {
      text = `${territoryName} · formerly ${context.orphanedFormerCountry}`;
    } else {
      text = `${territoryName} (formerly ${context.orphanedFormerCountry})`;
    }
  } else if (unclaimed) {
    if (variant === 'verbose') {
      text = `${territoryName} — unclaimed`;
    } else if (variant === 'compact') {
      text = `${territoryName} · unclaimed`;
    } else {
      text = `${territoryName} (unclaimed)`;
    }
  } else if (variant === 'verbose') {
    const leaderSuffix =
      options.showLeader && leaderName ? `, led by ${leaderName}` : '';
    text = `${territoryName} — ${countryName ?? 'unknown'}${leaderSuffix}`;
  } else if (variant === 'compact') {
    text = `${territoryName} · ${countryName ?? 'unknown'}`;
  } else {
    text = countryName ? `${territoryName} (${countryName})` : territoryName;
  }

  text = appendDecisionContext(text, options, leaderName);

  return { text, defeated, unclaimed };
}

/** Order-screen row title — preserves Phase 5 decision-context phrasing. */
export function formatDestinationRowTitle(
  territoryName: string,
  stance: DestinationStance,
  ownerCountryName?: string,
  ownerLeaderName?: string,
  recommended?: boolean,
): string {
  let title = territoryName;
  if (ownerCountryName) title += ` (${ownerCountryName})`;
  if (recommended) title += ' · Suggested';
  if (stance === 'hostile' || stance === 'allied') {
    title += ` · ${stance.toUpperCase()}`;
    if (ownerLeaderName) title += ` · ${ownerLeaderName}`;
  } else if (stance === 'neutral') {
    title += ' · NEUTRAL';
    if (ownerLeaderName) title += ` · ${ownerLeaderName}`;
  }
  return title;
}

export function formatDestinationDecisionLabel(
  world: WorldState,
  territoryId: Id,
  playerId: Id | undefined,
  ownerIdOverride?: Id,
  recommended?: boolean,
): ResolvedTerritoryOwnerLabel {
  const ownerId = ownerIdOverride ?? world.territories[territoryId]?.ownerId;
  const stance = classifyDestination(world, playerId, territoryId, ownerId);
  return resolveTerritoryOwnerLabel(world, territoryId, {
    variant: 'inline',
    showStance: true,
    showLeader: true,
    stance,
    recommended,
    playerId,
    ownerIdOverride,
  });
}

export function formatTransitEndpointLabel(
  world: WorldState,
  territoryId: Id,
  variant: 'inline' | 'compact' = 'inline',
  playerId?: Id,
  ownerIdOverride?: Id,
  includeStance = false,
): string {
  const ownerId = ownerIdOverride ?? world.territories[territoryId]?.ownerId;
  const stance = includeStance
    ? classifyDestination(world, playerId, territoryId, ownerId)
    : undefined;
  return resolveTerritoryOwnerLabel(world, territoryId, {
    variant,
    showStance: includeStance,
    showLeader: includeStance,
    stance,
    playerId,
    ownerIdOverride,
  }).text;
}
