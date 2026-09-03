import type { Id, Millis, SimEvent, TutorialBeatId, TutorialState, WorldState } from './types';
import {
  PLAYER_TUTORIAL_FACTION_ID,
} from '../../shared/src/tutorialConstants';
import { stampEvents } from './events';
import { playerFactionId } from './dispatch';

export const TUTORIAL_BEAT_ORDER: readonly TutorialBeatId[] = [
  'movement',
  'combat',
  'economy',
  'pinch',
  'governance',
  'influence',
  'handoff',
] as const;

export const TUTORIAL_ACTIVE_TIME_MULTIPLIER = 30;
export const STANDARD_TIME_MULTIPLIER = 1;
/** Max wall-clock wait for player marches/builds while the tutorial is active. */
export const TUTORIAL_MAX_PLAYER_ACTION_WALL_MS = 2_000;

export function isActiveTutorial(world: WorldState): boolean {
  return world.tutorial?.active === true;
}

export function isTutorialPlayerFaction(world: WorldState, factionId: Id): boolean {
  if (!isActiveTutorial(world)) return false;
  const player = playerFactionId(world);
  return player !== undefined && player === factionId;
}

/** Game-ms ceiling for a player action so wall wait stays within the tutorial cap. */
export function tutorialPlayerActionGameCapMs(world: WorldState): Millis {
  const multiplier = world.timeMultiplier ?? STANDARD_TIME_MULTIPLIER;
  return TUTORIAL_MAX_PLAYER_ACTION_WALL_MS * multiplier;
}

export function capTutorialPlayerActionGameMs(world: WorldState, gameMs: Millis): Millis {
  if (!isActiveTutorial(world)) return gameMs;
  return Math.min(gameMs, tutorialPlayerActionGameCapMs(world));
}

export {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
} from '../../shared/src/tutorialConstants';

export function createInitialTutorialState(startedAt: Millis): TutorialState {
  return {
    active: true,
    currentBeat: 'movement',
    completedBeats: [],
    startedAt,
    graduatedAt: null,
  };
}

export function isBeatComplete(state: TutorialState, beat: TutorialBeatId): boolean {
  return state.completedBeats.includes(beat);
}

export function getNextBeat(state: TutorialState): TutorialBeatId | null {
  for (const beat of TUTORIAL_BEAT_ORDER) {
    if (!state.completedBeats.includes(beat)) {
      return beat;
    }
  }
  return null;
}

export function markBeatComplete(
  state: TutorialState,
  beat: TutorialBeatId,
  _at: Millis,
): TutorialState {
  const completedBeats = state.completedBeats.includes(beat)
    ? state.completedBeats
    : [...state.completedBeats, beat];

  return {
    ...state,
    completedBeats,
    currentBeat: getNextBeat({ ...state, completedBeats }),
  };
}

/** Ends the tutorial in one atomic world update: inactive, standard time rate, graduation timestamp set. */
export function graduateTutorial(
  world: WorldState,
  at: Millis,
): { world: WorldState; events: SimEvent[] } {
  const existing = world.tutorial;
  if (existing && !existing.active && existing.graduatedAt !== null) {
    return {
      world: {
        ...world,
        timeMultiplier: STANDARD_TIME_MULTIPLIER,
        tutorial: existing,
      },
      events: [],
    };
  }

  const tutorial: TutorialState = {
    active: false,
    currentBeat: null,
    completedBeats: existing?.completedBeats ?? [...TUTORIAL_BEAT_ORDER],
    startedAt: existing?.startedAt ?? at,
    graduatedAt: existing?.graduatedAt ?? at,
  };

  const factionId = playerFactionId(world) ?? PLAYER_TUTORIAL_FACTION_ID;
  const graduatedWorld: WorldState = {
    ...world,
    timeMultiplier: STANDARD_TIME_MULTIPLIER,
    tutorial,
  };

  const stamped = stampEvents(graduatedWorld, [
    {
      kind: 'tutorialGraduated',
      at,
      factionId,
      importance: 'high',
    },
  ]);

  return {
    world: stamped.world,
    events: stamped.events,
  };
}
