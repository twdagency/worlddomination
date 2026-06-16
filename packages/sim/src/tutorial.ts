import type { Millis, TutorialBeatId, TutorialState, WorldState } from './types';

export const TUTORIAL_BEAT_ORDER: readonly TutorialBeatId[] = [
  'movement',
  'combat',
  'economy',
  'pinch',
  'governance',
  'handoff',
] as const;

export const TUTORIAL_ACTIVE_TIME_MULTIPLIER = 30;
export const STANDARD_TIME_MULTIPLIER = 1;

/** Tutorial scenario faction/territory ids (shared with scenario-tutorial factory). */
export const PLAYER_TUTORIAL_FACTION_ID = 'faction-britain-tutorial';
export const TUTORIAL_HOME_TERRITORY_ID = 'territory-london-tutorial';

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
export function graduateTutorial(world: WorldState, at: Millis): WorldState {
  const existing = world.tutorial;
  if (existing && !existing.active && existing.graduatedAt !== null) {
    return {
      ...world,
      timeMultiplier: STANDARD_TIME_MULTIPLIER,
      tutorial: existing,
    };
  }

  const tutorial: TutorialState = {
    active: false,
    currentBeat: null,
    completedBeats: existing?.completedBeats ?? [...TUTORIAL_BEAT_ORDER],
    startedAt: existing?.startedAt ?? at,
    graduatedAt: existing?.graduatedAt ?? at,
  };

  return {
    ...world,
    timeMultiplier: STANDARD_TIME_MULTIPLIER,
    tutorial,
  };
}
