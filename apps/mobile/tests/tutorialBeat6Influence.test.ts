import { describe, expect, it } from 'vitest';
import { TUTORIAL_BEAT_ORDER, type TutorialBeatId } from 'sim';
import { TUTORIAL_BEAT_COPY } from 'shared';
import { createTutorialWorld } from 'shared';
import { selectTutorialState } from '../src/game/tutorialSelector';
import {
  selectTutorialInfluencePresetCityId,
  TUTORIAL_BEAT_NAV_TARGET,
} from '../src/game/tutorialBeatNavigation';
import { TUTORIAL_BURGUNDY_TERRITORY_ID } from 'sim';

const START_MS = 1_700_700_000_000;

describe('tutorial influence beat', () => {
  it('teaches the daily slot and diplomatic mission in dedicated beat copy', () => {
    expect(TUTORIAL_BEAT_COPY.influence.title).toMatch(/sway/i);
    expect(TUTORIAL_BEAT_COPY.influence.body).toMatch(/diplomatic mission/i);
    expect(TUTORIAL_BEAT_COPY.influence.body).toMatch(/one deliberate action per day/i);
    expect(TUTORIAL_BEAT_COPY.influence.hint).toMatch(/influence/i);
    expect(TUTORIAL_BEAT_NAV_TARGET.influence).toBe('Order');
  });

  it('presets Burgundy as the influence-beat target while it remains foreign', () => {
    const world = createTutorialWorld(START_MS);
    expect(selectTutorialInfluencePresetCityId(world)).toBe(TUTORIAL_BURGUNDY_TERRITORY_ID);
  });

  it('keeps handoff readiness at graduation without regression', () => {
    const base = createTutorialWorld(START_MS);
    const world = {
      ...base,
      tutorial: {
        ...base.tutorial!,
        active: true,
        completedBeats: [...TUTORIAL_BEAT_ORDER] as TutorialBeatId[],
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
