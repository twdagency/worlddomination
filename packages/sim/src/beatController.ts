import type { SimEvent, WorldState } from './types';
import { isBeatComplete, markBeatComplete } from './tutorial';
import {
  type BeatPredicate,
  TUTORIAL_BEAT_PREDICATES,
} from './tutorialBeats';

export interface BeatController {
  /** Returns world with tutorial state updated when the current beat predicate matches. */
  evaluate(event: SimEvent, world: WorldState): WorldState;
}

export function createBeatController(
  predicates: readonly BeatPredicate[] = TUTORIAL_BEAT_PREDICATES,
): BeatController {
  const predicateByBeat = new Map(predicates.map((predicate) => [predicate.beat, predicate]));

  return {
    evaluate(event: SimEvent, world: WorldState): WorldState {
      const tutorial = world.tutorial;
      if (tutorial?.active !== true) return world;

      const currentBeat = tutorial.currentBeat;
      if (currentBeat === null) return world;
      if (isBeatComplete(tutorial, currentBeat)) return world;

      const predicate = predicateByBeat.get(currentBeat);
      if (!predicate?.isComplete(event, world)) return world;

      return {
        ...world,
        tutorial: markBeatComplete(tutorial, currentBeat, event.at),
      };
    },
  };
}

/** Feeds tick-emitted events through the beat controller in emission order. */
export function evaluateBeatProgression(
  world: WorldState,
  events: readonly SimEvent[],
  controller: BeatController = createBeatController(),
): WorldState {
  let next = world;
  for (const event of events) {
    next = controller.evaluate(event, next);
  }
  return next;
}
