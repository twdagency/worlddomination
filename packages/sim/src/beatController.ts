import type { SimEventDraft, SimEventKind, TutorialBeatId, WorldState } from './types';
import { findCountry } from './country';
import { dropPendingDilemmasForFaction, enqueuePendingDilemma } from './dilemmas';
import {
  isBeatComplete,
  markBeatComplete,
  PLAYER_TUTORIAL_FACTION_ID,
} from './tutorial';
import {
  hasTutorialForeignInfluenceTarget,
  type BeatPredicate,
  TUTORIAL_BEAT_PREDICATES,
} from './tutorialBeats';

export interface BeatController {
  /** Returns world with tutorial state updated when the current beat predicate matches. */
  evaluate(event: SimEventKind, world: WorldState): WorldState;
}

function applyBeatSideEffects(
  world: WorldState,
  beat: TutorialBeatId,
  event: SimEventKind,
): WorldState {
  if (beat === 'pinch') {
    // All pinch resolution paths trigger Foreign Rule per Sprint 8 Option β.
    // France was defeated in Beat 2 regardless of pinch path.
    return enqueuePendingDilemma(world, 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, event.at);
  }
  return world;
}

export function createBeatController(
  predicates: readonly BeatPredicate[] = TUTORIAL_BEAT_PREDICATES,
): BeatController {
  const predicateByBeat = new Map(predicates.map((predicate) => [predicate.beat, predicate]));

  return {
    evaluate(event: SimEventKind, world: WorldState): WorldState {
      const tutorial = world.tutorial;
      if (tutorial?.active !== true) return world;
      if (findCountry(world, PLAYER_TUTORIAL_FACTION_ID)?.defeated === true) return world;

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

function maybeSkipInfluenceWithoutTarget(world: WorldState): WorldState {
  const tutorial = world.tutorial;
  if (!tutorial?.active || tutorial.currentBeat !== 'influence') return world;
  if (isBeatComplete(tutorial, 'influence')) return world;
  if (hasTutorialForeignInfluenceTarget(world)) return world;
  return {
    ...world,
    tutorial: markBeatComplete(tutorial, 'influence', world.nowMs),
  };
}

function maybeEmitTutorialHandoff(world: WorldState): { world: WorldState; events: SimEventDraft[] } {
  const tutorial = world.tutorial;
  if (!tutorial?.active || tutorial.currentBeat !== 'handoff') {
    return { world, events: [] };
  }
  if (isBeatComplete(tutorial, 'handoff')) {
    return { world, events: [] };
  }

  const controller = createBeatController();
  const event: SimEventDraft = {
    kind: 'tutorialHandoffReady',
    at: world.nowMs,
    countryId: PLAYER_TUTORIAL_FACTION_ID,
    importance: 'medium',
  };
  return {
    world: controller.evaluate(event, world),
    events: [event],
  };
}

/** Feeds tick-emitted events through the beat controller in emission order. */
function playerCountryId(world: WorldState) {
  return Object.values(world.factions).find((faction) => faction.isPlayer)?.id;
}

export function evaluateBeatProgression(
  world: WorldState,
  events: readonly SimEventDraft[],
  controller: BeatController = createBeatController(),
): { world: WorldState; events: SimEventDraft[] } {
  const playerId = playerCountryId(world);
  if (playerId && findCountry(world, playerId)?.defeated === true) {
    return { world: dropPendingDilemmasForFaction(world, playerId), events: [] };
  }

  let next = world;
  const emitted: SimEventDraft[] = [];

  for (const event of events) {
    next = controller.evaluate(event, next);
    next = maybeSkipInfluenceWithoutTarget(next);
    const handoff = maybeEmitTutorialHandoff(next);
    next = handoff.world;
    emitted.push(...handoff.events);
  }

  next = maybeSkipInfluenceWithoutTarget(next);
  const trailingHandoff = maybeEmitTutorialHandoff(next);
  next = trailingHandoff.world;
  emitted.push(...trailingHandoff.events);

  return { world: next, events: emitted };
}
