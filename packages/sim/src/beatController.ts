import type { SimEvent, TutorialBeatId, WorldState } from './types';
import { enqueuePendingDilemma } from './dilemmas';
import {
  isBeatComplete,
  markBeatComplete,
  PLAYER_TUTORIAL_FACTION_ID,
} from './tutorial';
import {
  type BeatPredicate,
  isPinchConquestEvent,
  TUTORIAL_BEAT_PREDICATES,
} from './tutorialBeats';

export interface BeatController {
  /** Returns world with tutorial state updated when the current beat predicate matches. */
  evaluate(event: SimEvent, world: WorldState): WorldState;
}

function applyBeatSideEffects(
  world: WorldState,
  beat: TutorialBeatId,
  event: SimEvent,
): WorldState {
  if (beat === 'pinch') {
    if (isPinchConquestEvent(event)) {
      return enqueuePendingDilemma(world, 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, event.at);
    }
    if (world.tutorial) {
      const skipped = markBeatComplete(world.tutorial, 'governance', event.at);
      return { ...world, tutorial: skipped };
    }
  }
  return world;
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

      let next: WorldState = {
        ...world,
        tutorial: markBeatComplete(tutorial, currentBeat, event.at),
      };
      next = applyBeatSideEffects(next, currentBeat, event);
      return next;
    },
  };
}

function maybeEmitTutorialHandoff(world: WorldState): { world: WorldState; events: SimEvent[] } {
  const tutorial = world.tutorial;
  if (!tutorial?.active || tutorial.currentBeat !== 'handoff') {
    return { world, events: [] };
  }
  if (isBeatComplete(tutorial, 'handoff')) {
    return { world, events: [] };
  }

  const controller = createBeatController();
  const event: SimEvent = {
    kind: 'tutorialHandoffReady',
    at: world.nowMs,
    factionId: PLAYER_TUTORIAL_FACTION_ID,
    importance: 'medium',
  };
  return {
    world: controller.evaluate(event, world),
    events: [event],
  };
}

/** Feeds tick-emitted events through the beat controller in emission order. */
export function evaluateBeatProgression(
  world: WorldState,
  events: readonly SimEvent[],
  controller: BeatController = createBeatController(),
): { world: WorldState; events: SimEvent[] } {
  let next = world;
  const emitted: SimEvent[] = [];

  for (const event of events) {
    next = controller.evaluate(event, next);
    const handoff = maybeEmitTutorialHandoff(next);
    next = handoff.world;
    emitted.push(...handoff.events);
  }

  const trailingHandoff = maybeEmitTutorialHandoff(next);
  next = trailingHandoff.world;
  emitted.push(...trailingHandoff.events);

  return { world: next, events: emitted };
}
