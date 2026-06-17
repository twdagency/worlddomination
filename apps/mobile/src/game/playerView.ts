import {
  areAllied,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  pendingProposalsForFaction,
  resolveEventImportance,
  type Id,
  type Millis,
  type SimEvent,
} from 'sim';
import {
  computeVisibility,
  type FactionVisibility,
  type IntelSource,
  type Territory,
  type TerritorySnapshot,
  type TerritoryVisibilityState,
  type Unit,
  type WorldState,
} from 'sim';
import { resolvePlayerFactionId } from 'shared';
import { formatDateTime, formatDuration } from '../utils/format';
import { formatFactionIdentityLine, getFactionIdentity } from './factionDisplay';
import { formatTransitEndpointLabel } from './territoryOwnerLabel';

export { resolvePlayerFactionId } from 'shared';

/**
 * When true, map/order views show all territories and units (fog off).
 * Bypasses the intel store entirely — every territory renders as live `direct`.
 * Gate for cold-read debugging during UI work; do not enable in production builds.
 */
export const DEV_REVEAL = false;

export interface TerritoryIntelDisplay {
  territoryId: string;
  state: 'live' | 'stale' | 'unknown';
  name: string;
  sources: IntelSource[];
  lastObservedAt?: number;
  snapshot?: TerritorySnapshot;
  ownerAffiliation?: string;
}

function revealAll(world: WorldState): FactionVisibility {
  const territoryStates: Record<string, TerritoryVisibilityState> = {};
  for (const territory of Object.values(world.territories)) {
    territoryStates[territory.id] = {
      state: 'live',
      snapshot: {
        ownerId: territory.ownerId,
        infraLevel: territory.infraLevel,
        garrisonCount: 0,
        visibleEnemyGarrison: 0,
        inTransitCount: 0,
      },
      sources: ['direct'],
    };
  }
  return {
    territoryStates,
    territoryIds: new Set(Object.keys(world.territories)),
    unitIds: new Set(Object.keys(world.units)),
  };
}

/** Player fog-of-war — same rules as AI via `computeVisibility`. */
export function playerVisibility(world: WorldState): FactionVisibility {
  if (DEV_REVEAL) {
    return revealAll(world);
  }
  const factionId = resolvePlayerFactionId(world);
  if (!factionId) {
    return { territoryStates: {}, territoryIds: new Set(), unitIds: new Set() };
  }
  return computeVisibility(world, factionId);
}

function territoryName(world: WorldState, territoryId: string): string {
  return world.territories[territoryId]?.name ?? territoryId;
}

/** Tri-state intel for one territory — primary UI read path in Phase 2+. */
export function getTerritoryIntelDisplay(
  world: WorldState,
  territoryId: string,
): TerritoryIntelDisplay {
  const intel = playerVisibility(world).territoryStates[territoryId] ?? { state: 'unknown' };

  if (intel.state === 'unknown') {
    return { territoryId, state: 'unknown', name: 'Unknown', sources: [] };
  }

  const ownerId =
    intel.snapshot?.ownerId ?? world.territories[territoryId]?.ownerId;
  const ownerAffiliation =
    ownerId && world.factions[ownerId]
      ? formatFactionIdentityLine(getFactionIdentity(world, ownerId))
      : undefined;

  return {
    territoryId,
    state: intel.state,
    name: territoryName(world, territoryId),
    sources: intel.sources,
    lastObservedAt: intel.state === 'stale' ? intel.lastObservedAt : undefined,
    snapshot: intel.snapshot,
    ownerAffiliation,
  };
}

/** All territories with live / stale / unknown rendering metadata. */
export function playerWorldIntel(world: WorldState): TerritoryIntelDisplay[] {
  return Object.keys(world.territories)
    .sort((a, b) => territoryName(world, a).localeCompare(territoryName(world, b)))
    .map((territoryId) => getTerritoryIntelDisplay(world, territoryId));
}

/** Live geometric sight only — unchanged Sprint 5 semantics. */
export function playerVisibleTerritories(world: WorldState): Territory[] {
  const { territoryIds } = playerVisibility(world);
  return Object.values(world.territories).filter((territory) =>
    territoryIds.has(territory.id),
  );
}

export function playerOwnedTerritories(world: WorldState): Territory[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];
  return Object.values(world.territories).filter(
    (territory) => territory.ownerId === playerId,
  );
}

export function playerMovableUnits(world: WorldState): Unit[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];
  const { unitIds } = playerVisibility(world);
  return Object.values(world.units).filter(
    (unit) =>
      unitIds.has(unit.id) &&
      unit.ownerId === playerId &&
      !unit.transit &&
      unit.locationId,
  );
}

/** Stationed at a player-owned territory and not in transit — eligible for a new move order. */
export function isPlayerForceMovable(world: WorldState, unit: Unit): boolean {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId || unit.ownerId !== playerId) return false;
  if (unit.transit || !unit.locationId) return false;
  return world.territories[unit.locationId]?.ownerId === playerId;
}

/** All player stacks visible under fog (stationed or in transit). */
export function playerForces(world: WorldState): Unit[] {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];
  const { unitIds } = playerVisibility(world);
  return Object.values(world.units).filter(
    (unit) => unit.ownerId === playerId && unitIds.has(unit.id),
  );
}

/** In-flight hostile assault orders — clears when recalled or redirected. */
export function playerHostileAssaultsInTransit(world: WorldState): number {
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return 0;

  return playerForces(world).filter((unit) => {
    const transit = unit.transit;
    if (!transit || transit.stanceOnArrival !== 'assault') return false;

    const destId = transit.toTerritoryId;
    if (!destId) return false;

    const destOwner = world.territories[destId]?.ownerId;
    if (!destOwner || destOwner === playerId) return false;
    if (areAllied(world, playerId, destOwner)) return false;
    return true;
  }).length;
}

/** Live sight only — binary fog gate for detail that must reflect current ground truth. */
export function getPlayerVisibleTerritory(
  world: WorldState,
  territoryId: string,
): Territory | undefined {
  const { territoryIds } = playerVisibility(world);
  if (!territoryIds.has(territoryId)) return undefined;
  return world.territories[territoryId];
}

export function getPlayerVisibleTerritoryName(world: WorldState, territoryId: string): string {
  return getPlayerVisibleTerritory(world, territoryId)?.name ?? 'Unknown';
}

/** Live or stale — for labels where historical knowledge is enough. */
export function getPlayerKnownTerritoryName(world: WorldState, territoryId: string): string {
  return getTerritoryIntelDisplay(world, territoryId).name;
}

/** Owner at observation time for stale destinations; live owner for current sight. */
export function ownerIdForIntelDisplay(
  world: WorldState,
  display: TerritoryIntelDisplay,
): string | undefined {
  if (display.state === 'live') {
    return world.territories[display.territoryId]?.ownerId;
  }
  if (display.state === 'stale') {
    return display.snapshot?.ownerId;
  }
  return undefined;
}

/** Move destinations: live and stale territories; unknown filtered out. */
export function playerOrderDestinations(
  world: WorldState,
  fromTerritoryId: string | undefined,
): TerritoryIntelDisplay[] {
  if (!fromTerritoryId) return [];
  return playerWorldIntel(world).filter(
    (display) => display.territoryId !== fromTerritoryId && display.state !== 'unknown',
  );
}

/** @deprecated Use `playerOrderDestinations` for tri-state move targets. */
export function playerMoveDestinations(world: WorldState, fromTerritoryId: string | undefined): Territory[] {
  return playerOrderDestinations(world, fromTerritoryId)
    .filter((display) => display.state === 'live')
    .map((display) => world.territories[display.territoryId])
    .filter((territory): territory is Territory => territory !== undefined);
}

// --- Dashboard selectors (Sprint 7a) ---

/** Collapse catch-up when away duration is under one game-hour (1:1 wall clock). */
export const DASHBOARD_AWAY_COLLAPSE_MS = 3_600_000;

const URGENT_CRISIS_KINDS = new Set<SimEvent['kind']>([
  'battle',
  'withdrawal',
  'buildBlocked',
  'allianceBroken',
]);

const CRISIS_WINDOW_MS = 6 * 3_600_000;
const FOOD_CRITICAL_THRESHOLD = 10;
const FOOD_LOW_THRESHOLD = 25;
const FOOD_PRODUCTION_THRESHOLD = 15;

export type DashboardScreenName =
  | 'Dashboard'
  | 'Dispatches'
  | 'World'
  | 'Order'
  | 'Diplomacy'
  | 'Territory'
  | 'Forces';

export interface DashboardNavTarget {
  screen: DashboardScreenName;
  factionId?: string;
  territoryId?: string;
  dispatchId?: string;
}

export interface DashboardCatchUpCriticalItem {
  id: string;
  label: string;
  atMs: number;
}

export interface DashboardCatchUpSummary {
  mode: 'current' | 'away';
  awayMs: number;
  critical: DashboardCatchUpCriticalItem[];
  notableCount: number;
  routineCount: number;
  totalCount: number;
}

export type DashboardUrgentKind =
  | 'alliance-proposal'
  | 'treaty-proposal'
  | 'crisis'
  | 'build-blocker';

export interface DashboardUrgentItem {
  id: string;
  kind: DashboardUrgentKind;
  label: string;
  urgencyScore: number;
  deadlineMs: number;
  navigation: DashboardNavTarget;
}

export type ResourceStatusLevel = 'ok' | 'low' | 'critical';

export interface DashboardResourceStatus {
  id: string;
  label: string;
  amount: number;
  status: ResourceStatusLevel;
}

export interface DashboardEmpireSummary {
  factionId: string;
  leaderName: string;
  regionName: string;
  territoryNames: string[];
  funding: number;
  manpower: number;
  manpowerCap: number;
  resources: DashboardResourceStatus[];
  allianceCount: number;
  era: string;
  gameDateLabel: string;
  gameDay: number;
}

export interface DashboardNavCard {
  screen: Exclude<DashboardScreenName, 'Dashboard'>;
  label: string;
  badgeCount: number;
}

export const DASHBOARD_DISPATCHES_DIGEST_LIMIT = 5;

const IMPORTANCE_RANK = { high: 3, medium: 2, low: 1 } as const;

export interface DashboardDispatchDigestItem {
  eventId: string;
  line: string;
  atMs: number;
  kind: string;
  importance: 'high' | 'medium' | 'low';
}

export interface DashboardActiveForceItem {
  unitId: string;
  label: string;
  detail: string;
  inTransit: boolean;
}

export interface DashboardActiveForcesSummary {
  inTransitCount: number;
  stationedCount: number;
  items: DashboardActiveForceItem[];
}

function isTimestampedEvent(event: SimEvent): event is SimEvent & { at: number } {
  return 'at' in event && typeof event.at === 'number';
}

function foodStatusLevel(amount: number): ResourceStatusLevel {
  if (amount < FOOD_CRITICAL_THRESHOLD) return 'critical';
  if (amount < FOOD_LOW_THRESHOLD) return 'low';
  return 'ok';
}

/** Events since the away window, visibility-gated, categorized by existing importance metadata. */
export function getDashboardCatchUpSummary(
  world: WorldState,
  events: SimEvent[],
  awayMs: number,
  factionId?: Id,
): DashboardCatchUpSummary {
  const resolvedFactionId = factionId ?? resolvePlayerFactionId(world);
  if (!resolvedFactionId) {
    return {
      mode: 'current',
      awayMs,
      critical: [],
      notableCount: 0,
      routineCount: 0,
      totalCount: 0,
    };
  }
  if (awayMs < DASHBOARD_AWAY_COLLAPSE_MS) {
    return {
      mode: 'current',
      awayMs,
      critical: [],
      notableCount: 0,
      routineCount: 0,
      totalCount: 0,
    };
  }

  const sinceMs = world.nowMs - awayMs;
  const visible = filterDispatchesForFaction(world, events, resolvedFactionId).filter(
    (event): event is SimEvent & { at: number } =>
      isTimestampedEvent(event) && event.at > sinceMs,
  );

  let notableCount = 0;
  let routineCount = 0;
  const critical: DashboardCatchUpCriticalItem[] = [];

  for (const event of visible) {
    const importance = resolveEventImportance(world, event);
    if (importance === 'high') {
      critical.push({
        id: `${event.kind}-${event.at}`,
        label: dispatchLineForEvent(world, event, resolvedFactionId),
        atMs: event.at,
      });
    } else if (importance === 'medium') {
      notableCount += 1;
    } else {
      routineCount += 1;
    }
  }

  return {
    mode: 'away',
    awayMs,
    critical,
    notableCount,
    routineCount,
    totalCount: critical.length + notableCount + routineCount,
  };
}

/** Attention queue ranked by urgency then deadline. */
export function getDashboardUrgentItems(
  world: WorldState,
  events: SimEvent[],
  factionId?: Id,
): DashboardUrgentItem[] {
  const resolvedFactionId = factionId ?? resolvePlayerFactionId(world);
  if (!resolvedFactionId) return [];

  const items: DashboardUrgentItem[] = [];

  for (const proposal of pendingProposalsForFaction(world, resolvedFactionId)) {
    const fromLeaderId = world.factions[proposal.from]?.leaderId;
    const fromName = world.leaders[fromLeaderId ?? '']?.name ?? proposal.from;
    const hoursLeft = Math.max(0, Math.ceil((proposal.expiresAt - world.nowMs) / 3_600_000));
    const kind: DashboardUrgentKind =
      proposal.type === 'alliance' ? 'alliance-proposal' : 'treaty-proposal';
    items.push({
      id: proposal.id,
      kind,
      label: `${fromName} proposes ${proposal.type} — expires in ${hoursLeft}h`,
      urgencyScore: 1_000 - hoursLeft,
      deadlineMs: proposal.expiresAt,
      navigation: { screen: 'Diplomacy', factionId: proposal.from },
    });
  }

  const visible = filterDispatchesForFaction(world, events, resolvedFactionId);
  const crisisSinceMs = world.nowMs - CRISIS_WINDOW_MS;
  for (const event of visible) {
    if (!isTimestampedEvent(event) || event.at < crisisSinceMs) continue;
    if (!URGENT_CRISIS_KINDS.has(event.kind)) continue;
    const importance = resolveEventImportance(world, event);
    if (importance !== 'high' && event.kind !== 'buildBlocked') continue;
    items.push({
      id: `crisis-${event.kind}-${event.at}`,
      kind: 'crisis',
      label: dispatchLineForEvent(world, event, resolvedFactionId),
      urgencyScore: 800 - (world.nowMs - event.at) / 3_600_000,
      deadlineMs: event.at,
      navigation: { screen: 'Dispatches', dispatchId: event.eventId },
    });
  }

  for (const territory of playerOwnedTerritories(world)) {
    const food = territory.resources.food ?? 0;
    const hasQueue = (territory.buildQueue?.length ?? 0) > 0;
    if (!hasQueue || food >= FOOD_PRODUCTION_THRESHOLD) continue;
    items.push({
      id: `food-blocker-${territory.id}`,
      kind: 'build-blocker',
      label: `${territory.name}: food shortage threatens production (${Math.floor(food)} remaining)`,
      urgencyScore: 600,
      deadlineMs: world.nowMs,
      navigation: { screen: 'Territory', territoryId: territory.id },
    });
  }

  return items.sort(
    (left, right) =>
      right.urgencyScore - left.urgencyScore || left.deadlineMs - right.deadlineMs,
  );
}

/** Glance-readable empire snapshot for the dashboard header block. */
export function getDashboardEmpireSummary(
  world: WorldState,
  factionId?: Id,
): DashboardEmpireSummary | null {
  const resolvedFactionId = factionId ?? resolvePlayerFactionId(world);
  if (!resolvedFactionId) return null;

  const faction = world.factions[resolvedFactionId];
  if (!faction) return null;

  const leader = world.leaders[faction.leaderId];
  const identity = getFactionIdentity(world, resolvedFactionId);
  const territories = playerOwnedTerritories(world).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const totalFood = territories.reduce((sum, territory) => sum + (territory.resources.food ?? 0), 0);
  const totalFuel = territories.reduce((sum, territory) => sum + (territory.resources.fuel ?? 0), 0);
  const totalSteel = territories.reduce(
    (sum, territory) => sum + (territory.resources.steel ?? 0),
    0,
  );

  let allianceCount = 0;
  for (const other of Object.values(world.factions)) {
    if (other.id !== resolvedFactionId && areAllied(world, resolvedFactionId, other.id)) {
      allianceCount += 1;
    }
  }

  return {
    factionId: resolvedFactionId,
    leaderName: identity.leaderName,
    regionName: identity.countryName,
    territoryNames: identity.territoryNames,
    funding: faction.funding,
    manpower: Math.floor(faction.manpower),
    manpowerCap: faction.manpowerCap,
    resources: [
      { id: 'food', label: 'Food', amount: totalFood, status: foodStatusLevel(totalFood) },
      {
        id: 'fuel',
        label: 'Fuel',
        amount: totalFuel,
        status: totalFuel < FOOD_CRITICAL_THRESHOLD ? 'low' : 'ok',
      },
      {
        id: 'steel',
        label: 'Steel',
        amount: totalSteel,
        status: totalSteel < FOOD_CRITICAL_THRESHOLD ? 'low' : 'ok',
      },
    ],
    allianceCount,
    era: leader?.era ?? 'Unknown',
    gameDateLabel: formatDateTime(world.nowMs),
    gameDay: world.day,
  };
}

/** Navigation grid cards with actionable badges per task screen. */
export function getDashboardNavCards(
  world: WorldState,
  events: SimEvent[],
  factionId?: Id,
): DashboardNavCard[] {
  const urgent = getDashboardUrgentItems(world, events, factionId);
  const diplomacyBadge = urgent.filter(
    (item) => item.kind === 'alliance-proposal' || item.kind === 'treaty-proposal',
  ).length;
  const territoryBadge = urgent.filter((item) => item.kind === 'build-blocker').length;
  const staleIntel = playerWorldIntel(world).filter((entry) => entry.state === 'stale').length;
  const forcesInTransit = playerForces(world).filter((unit) => unit.transit).length;
  const hostileAssaultsInTransit = playerHostileAssaultsInTransit(world);

  return [
    { screen: 'World', label: 'World', badgeCount: staleIntel > 0 ? staleIntel : 0 },
    { screen: 'Order', label: 'Order', badgeCount: hostileAssaultsInTransit > 0 ? 1 : 0 },
    { screen: 'Diplomacy', label: 'Diplomacy', badgeCount: diplomacyBadge },
    { screen: 'Territory', label: 'Territory', badgeCount: territoryBadge },
    { screen: 'Forces', label: 'Forces', badgeCount: forcesInTransit },
  ];
}

/** Importance-ranked digest for the dashboard dispatches card (max 5). */
export function getDashboardDispatchesDigest(
  world: WorldState,
  events: SimEvent[],
  factionId?: Id,
  limit = DASHBOARD_DISPATCHES_DIGEST_LIMIT,
): DashboardDispatchDigestItem[] {
  const resolvedFactionId = factionId ?? resolvePlayerFactionId(world);
  if (!resolvedFactionId) return [];

  const ranked = filterDispatchesForFaction(world, events, resolvedFactionId)
    .filter((event): event is SimEvent & { at: number } => isTimestampedEvent(event))
    .map((event) => {
      const importance = resolveEventImportance(world, event);
      return {
        eventId: event.eventId,
        line: dispatchLineForEvent(world, event, resolvedFactionId),
        atMs: event.at,
        kind: event.kind,
        importance,
      };
    })
    .sort((left, right) => {
      const rankDiff = IMPORTANCE_RANK[right.importance] - IMPORTANCE_RANK[left.importance];
      if (rankDiff !== 0) return rankDiff;
      return right.atMs - left.atMs;
    });

  return ranked.slice(0, limit);
}

/** High-importance dispatches after last view — crisis window + read-state gated. */
export function getDashboardUnreadDispatchCount(
  world: WorldState,
  events: SimEvent[],
  lastViewedAt: Millis,
  factionId?: Id,
): number {
  const resolvedFactionId = factionId ?? resolvePlayerFactionId(world);
  if (!resolvedFactionId) return 0;

  const crisisSinceMs = world.nowMs - CRISIS_WINDOW_MS;
  let count = 0;
  const unreadHighAt: number[] = [];
  for (const event of filterDispatchesForFaction(world, events, resolvedFactionId)) {
    if (!isTimestampedEvent(event) || event.at < crisisSinceMs) continue;
    if (event.at <= lastViewedAt) continue;
    if (resolveEventImportance(world, event) === 'high') {
      count += 1;
      unreadHighAt.push(event.at);
    }
  }
  console.log('[badge-diag] getDashboardUnreadDispatchCount', {
    lastViewedAt,
    worldNowMs: world.nowMs,
    wallNow: Date.now(),
    count,
    unreadHighAt,
    crisisSinceMs,
  });
  return Math.max(0, count);
}

/** Glance summary of player forces — prioritizes in-transit stacks. */
export function getDashboardActiveForcesSummary(world: WorldState): DashboardActiveForcesSummary {
  const units = playerForces(world);
  const inTransit = units.filter((unit) => unit.transit);
  const stationed = units.filter((unit) => !unit.transit);
  const playerId = resolvePlayerFactionId(world);

  const items: DashboardActiveForceItem[] = inTransit.slice(0, 3).map((unit) => {
    const unitType = world.unitTypes[unit.typeId];
    const destId = unit.transit?.toTerritoryId;
    const originId = unit.locationId;
    const originLabel = originId
      ? formatTransitEndpointLabel(world, originId, 'inline', playerId)
      : 'unknown';
    const destLabel = destId
      ? formatTransitEndpointLabel(world, destId, 'compact', playerId, undefined, true)
      : 'unknown';
    const eta = formatDuration(
      Math.max(0, (unit.transit?.arriveMs ?? 0) - world.nowMs),
    );
    return {
      unitId: unit.id,
      label: unitType?.name ?? unit.id,
      detail: `×${unit.count} from ${originLabel} → ${destLabel} · ETA ${eta}`,
      inTransit: true,
    };
  });

  return {
    inTransitCount: inTransit.length,
    stationedCount: stationed.length,
    items,
  };
}

/** Count urgent items for header badge (Phase 2 persistent header). */
export function getDashboardUrgentCount(
  world: WorldState,
  events: SimEvent[],
  factionId?: Id,
): number {
  return getDashboardUrgentItems(world, events, factionId).length;
}
