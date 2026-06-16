import type { SimEvent, TutorialBeatId, WorldState } from './types';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_HOME_TERRITORY_ID,
} from './tutorial';

export interface BeatPredicate {
  beat: TutorialBeatId;
  isComplete(event: SimEvent, world: WorldState): boolean;
}

function isPlayerArrivalAwayFromHome(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'arrival' &&
    event.ownerId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId !== TUTORIAL_HOME_TERRITORY_ID
  );
}

export const TUTORIAL_BEAT_PREDICATES: readonly BeatPredicate[] = [
  {
    beat: 'movement',
    isComplete: isPlayerArrivalAwayFromHome,
  },
  {
    beat: 'combat',
    // SPRINT-7B PHASE-4/5: implement
    isComplete: () => false,
  },
  {
    beat: 'economy',
    // SPRINT-7B PHASE-4/5: implement
    isComplete: () => false,
  },
  {
    beat: 'pinch',
    // SPRINT-7B PHASE-4/5: implement
    isComplete: () => false,
  },
  {
    beat: 'governance',
    // SPRINT-7B PHASE-4/5: implement
    isComplete: () => false,
  },
  {
    beat: 'handoff',
    // SPRINT-7B PHASE-4/5: implement
    isComplete: () => false,
  },
];
