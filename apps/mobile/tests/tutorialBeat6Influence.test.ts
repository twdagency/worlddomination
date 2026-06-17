import { describe, expect, it } from 'vitest';
import type { TutorialBeatId } from 'sim';
import { TUTORIAL_BEAT_COPY } from 'shared';
import { createTutorialWorld } from 'shared';
import { selectTutorialState } from '../src/game/tutorialSelector';

const START_MS = 1_700_700_000_000;
const HANDOFF_BEATS: TutorialBeatId[] = [
  'movement',
  'combat',
  'economy',
  'pinch',
  'governance',
  'handoff',
];

describe('tutorial Beat 6 influence copy', () => {
  it('includes influence onboarding in handoff hint', () => {
    expect(TUTORIAL_BEAT_COPY.handoff.hint).toContain('influence');
    expect(TUTORIAL_BEAT_COPY.handoff.hint).toContain('Dashboard');
    expect(TUTORIAL_BEAT_COPY.handoff.title).toBe('Your campaign begins');
  });

  it('keeps handoff readiness at graduation without regression', () => {
    const base = createTutorialWorld(START_MS);
    const world = {
      ...base,
      tutorial: {
        ...base.tutorial!,
        active: true,
        completedBeats: HANDOFF_BEATS,
        currentBeat: null,
      },
    };

    const state = selectTutorialState({
      world,
      lastDismissedBeat: null,
      bannerCollapsedBeat: null,
    });

    expect(state.isHandoffReady).toBe(true);
    expect(state.currentBeatCopy).toEqual(TUTORIAL_BEAT_COPY.handoff);
    expect(state.shouldShowBanner).toBe(true);
  });
});
