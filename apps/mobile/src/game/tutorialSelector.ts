import type { TutorialBeatId, WorldState } from 'sim';
import { TUTORIAL_BEAT_COPY, type BeatCopy } from 'shared';

export type TutorialBannerMode = 'hidden' | 'collapsed' | 'expanded';

export interface TutorialSelectorInput {
  world: WorldState | null;
  lastDismissedBeat: TutorialBeatId | null;
  bannerCollapsedBeat: TutorialBeatId | null;
}

export interface TutorialSelectorOutput {
  isActive: boolean;
  currentBeat: TutorialBeatId | null;
  currentBeatCopy: BeatCopy | null;
  shouldShowBanner: boolean;
  bannerMode: TutorialBannerMode;
  isHandoffReady: boolean;
}

function resolveBannerBeatKey(
  currentBeat: TutorialBeatId | null,
  isHandoffReady: boolean,
): TutorialBeatId | null {
  if (currentBeat) return currentBeat;
  return isHandoffReady ? 'handoff' : null;
}

function resolveBannerMode(
  shouldShowBanner: boolean,
  beatKey: TutorialBeatId | null,
  bannerCollapsedBeat: TutorialBeatId | null,
): TutorialBannerMode {
  if (!shouldShowBanner || !beatKey) return 'hidden';
  return bannerCollapsedBeat === beatKey ? 'collapsed' : 'expanded';
}

export function selectTutorialState(input: TutorialSelectorInput): TutorialSelectorOutput {
  const { world, lastDismissedBeat, bannerCollapsedBeat } = input;
  const tutorial = world?.tutorial;

  if (!tutorial?.active) {
    return {
      isActive: false,
      currentBeat: tutorial?.currentBeat ?? null,
      currentBeatCopy: null,
      shouldShowBanner: false,
      bannerMode: 'hidden',
      isHandoffReady: false,
    };
  }

  if (tutorial.completedBeats.includes('handoff')) {
    const shouldShowBanner = lastDismissedBeat !== 'handoff';
    const beatKey = resolveBannerBeatKey(null, true);
    return {
      isActive: true,
      currentBeat: null,
      currentBeatCopy: TUTORIAL_BEAT_COPY.handoff,
      shouldShowBanner,
      bannerMode: resolveBannerMode(shouldShowBanner, beatKey, bannerCollapsedBeat),
      isHandoffReady: true,
    };
  }

  const currentBeat = tutorial.currentBeat;
  if (currentBeat === null) {
    return {
      isActive: true,
      currentBeat: null,
      currentBeatCopy: null,
      shouldShowBanner: false,
      bannerMode: 'hidden',
      isHandoffReady: false,
    };
  }

  const currentBeatCopy = TUTORIAL_BEAT_COPY[currentBeat];
  const shouldShowBanner = currentBeat !== lastDismissedBeat;

  return {
    isActive: true,
    currentBeat,
    currentBeatCopy,
    shouldShowBanner,
    bannerMode: resolveBannerMode(shouldShowBanner, currentBeat, bannerCollapsedBeat),
    isHandoffReady: false,
  };
}
