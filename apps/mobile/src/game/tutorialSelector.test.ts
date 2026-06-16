import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import { createTutorialWorld } from 'shared';
import { TUTORIAL_BEAT_COPY } from 'shared';
import { TUTORIAL_BEAT_ORDER } from 'sim';
import { selectTutorialState } from './tutorialSelector';

const START_MS = 1_700_400_000_000;

describe('tutorial selector', () => {
  it('returns inactive when world is null', () => {
    const result = selectTutorialState({ world: null, lastDismissedBeat: null });
    expect(result).toEqual({
      isActive: false,
      currentBeat: null,
      currentBeatCopy: null,
      shouldShowBanner: false,
    });
  });

  it('returns inactive for non-tutorial worlds', () => {
    const world = createSprint4World(START_MS);
    const result = selectTutorialState({ world, lastDismissedBeat: null });
    expect(result.isActive).toBe(false);
    expect(result.shouldShowBanner).toBe(false);
  });

  it('shows movement copy when tutorial is active and not dismissed', () => {
    const world = createTutorialWorld(START_MS);
    const result = selectTutorialState({ world, lastDismissedBeat: null });
    expect(result.isActive).toBe(true);
    expect(result.currentBeat).toBe('movement');
    expect(result.currentBeatCopy).toEqual(TUTORIAL_BEAT_COPY.movement);
    expect(result.shouldShowBanner).toBe(true);
  });

  it('hides banner when the current beat was dismissed', () => {
    const world = createTutorialWorld(START_MS);
    const result = selectTutorialState({ world, lastDismissedBeat: 'movement' });
    expect(result.shouldShowBanner).toBe(false);
    expect(result.currentBeatCopy).toEqual(TUTORIAL_BEAT_COPY.movement);
  });

  it('restores banner when current beat changes after a prior dismiss', () => {
    const world = createTutorialWorld(START_MS);
    const advanced: typeof world = {
      ...world,
      tutorial: {
        ...world.tutorial!,
        currentBeat: 'combat',
        completedBeats: ['movement'],
      },
    };
    const result = selectTutorialState({ world: advanced, lastDismissedBeat: 'movement' });
    expect(result.currentBeat).toBe('combat');
    expect(result.shouldShowBanner).toBe(true);
    expect(result.currentBeatCopy).toEqual(TUTORIAL_BEAT_COPY.combat);
  });

  it('never shows banner after tutorial graduation', () => {
    const world = createTutorialWorld(START_MS);
    const graduated = {
      ...world,
      tutorial: {
        ...world.tutorial!,
        active: false,
        currentBeat: null,
        graduatedAt: START_MS + 60_000,
      },
      timeMultiplier: 1,
    };
    const result = selectTutorialState({ world: graduated, lastDismissedBeat: 'movement' });
    expect(result.isActive).toBe(false);
    expect(result.shouldShowBanner).toBe(false);
  });

  it('hides banner when all beats are complete but graduation has not fired', () => {
    const world = createTutorialWorld(START_MS);
    const preGraduation = {
      ...world,
      tutorial: {
        ...world.tutorial!,
        currentBeat: null,
        completedBeats: [...TUTORIAL_BEAT_ORDER],
      },
    };
    const result = selectTutorialState({ world: preGraduation, lastDismissedBeat: null });
    expect(result.isActive).toBe(true);
    expect(result.shouldShowBanner).toBe(false);
    expect(result.currentBeatCopy).toBeNull();
  });

  it('defines copy for every tutorial beat', () => {
    for (const beat of TUTORIAL_BEAT_ORDER) {
      expect(TUTORIAL_BEAT_COPY[beat]?.title).toBeTruthy();
      expect(TUTORIAL_BEAT_COPY[beat]?.body).toBeTruthy();
      expect(TUTORIAL_BEAT_COPY[beat]?.beat).toBe(beat);
    }
  });
});
