import type { TutorialBeatId, WorldState } from 'sim';
import { TUTORIAL_BEAT_COPY, type BeatCopy } from 'shared';

export interface TutorialSelectorInput {
  world: WorldState | null;
  lastDismissedBeat: TutorialBeatId | null;
}

export interface TutorialSelectorOutput {
  isActive: boolean;
  currentBeat: TutorialBeatId | null;
  currentBeatCopy: BeatCopy | null;
  shouldShowBanner: boolean;
}

export function selectTutorialState(input: TutorialSelectorInput): TutorialSelectorOutput {
  const { world, lastDismissedBeat } = input;
  const tutorial = world?.tutorial;

  if (!tutorial?.active) {
    return {
      isActive: false,
      currentBeat: tutorial?.currentBeat ?? null,
      currentBeatCopy: null,
      shouldShowBanner: false,
    };
  }

  const currentBeat = tutorial.currentBeat;
  if (currentBeat === null) {
    return {
      isActive: true,
      currentBeat: null,
      currentBeatCopy: null,
      shouldShowBanner: false,
    };
  }

  const currentBeatCopy = TUTORIAL_BEAT_COPY[currentBeat];
  const shouldShowBanner = currentBeat !== lastDismissedBeat;

  return {
    isActive: true,
    currentBeat,
    currentBeatCopy,
    shouldShowBanner,
  };
}
