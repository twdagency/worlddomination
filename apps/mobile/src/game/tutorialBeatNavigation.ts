import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  type TutorialBeatId,
  type WorldState,
} from 'sim';
import type { DashboardScreenName } from './playerView';

/** Beat → screen the banner instructs the player to open (auto-collapse on arrival). */
export const TUTORIAL_BEAT_NAV_TARGET: Partial<Record<TutorialBeatId, DashboardScreenName>> = {
  movement: 'Order',
  combat: 'Dispatches',
  economy: 'Territory',
  influence: 'Order',
};

export interface ActiveTutorialRoute {
  tab: string;
  stackScreen?: string;
}

/** First remaining Burgundian city the influence beat can teach against. */
export function selectTutorialInfluencePresetCityId(world: WorldState | null): string | undefined {
  if (!world) return undefined;
  for (const cityId of [TUTORIAL_BURGUNDY_TERRITORY_ID, TUTORIAL_CALAIS_TERRITORY_ID]) {
    const ownerId = world.territories[cityId]?.ownerId;
    if (!ownerId || ownerId === PLAYER_TUTORIAL_FACTION_ID) continue;
    if (world.countries?.[ownerId]?.defeated) continue;
    return cityId;
  }
  return undefined;
}

export function matchesTutorialNavTarget(
  target: DashboardScreenName,
  route: ActiveTutorialRoute,
): boolean {
  if (target === 'Dispatches') {
    return route.tab === 'Dashboard' && route.stackScreen === 'Dispatches';
  }

  if (target === 'Order' || target === 'Territory' || target === 'Diplomacy' || target === 'Forces') {
    return route.tab === 'Actions' && route.stackScreen === target;
  }

  return route.tab === target;
}
