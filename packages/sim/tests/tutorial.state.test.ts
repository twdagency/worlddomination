import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import {
  createInitialTutorialState,
  ensureWorldMigrations,
  ensureWorldTimeMultiplier,
  getNextBeat,
  getTimeMultiplier,
  graduateTutorial,
  isBeatComplete,
  markBeatComplete,
  TUTORIAL_BEAT_ORDER,
  TUTORIAL_ACTIVE_TIME_MULTIPLIER,
} from '../src';

const START_MS = 1_700_000_000_000;

function worldWithTutorial(at: number = START_MS) {
  const base = createSprint4World(at);
  const tutorial = createInitialTutorialState(at);
  return {
    ...base,
    tutorial,
    timeMultiplier: TUTORIAL_ACTIVE_TIME_MULTIPLIER,
  };
}

describe('tutorial state', () => {
  it('createInitialTutorialState starts at movement with empty completed beats', () => {
    const state = createInitialTutorialState(START_MS);
    expect(state.active).toBe(true);
    expect(state.currentBeat).toBe('movement');
    expect(state.completedBeats).toEqual([]);
    expect(state.graduatedAt).toBeNull();
    expect(state.startedAt).toBe(START_MS);
  });

  it('markBeatComplete advances currentBeat along TUTORIAL_BEAT_ORDER', () => {
    let state = createInitialTutorialState(START_MS);
    state = markBeatComplete(state, 'movement', START_MS);
    expect(state.completedBeats).toEqual(['movement']);
    expect(state.currentBeat).toBe('combat');
    expect(isBeatComplete(state, 'movement')).toBe(true);
  });

  it('markBeatComplete is idempotent for the same beat', () => {
    let state = markBeatComplete(createInitialTutorialState(START_MS), 'movement', START_MS);
    const again = markBeatComplete(state, 'movement', START_MS + 1);
    expect(again.completedBeats).toEqual(['movement']);
    expect(again.currentBeat).toBe('combat');
  });

  it('markBeatComplete sets currentBeat to null after handoff', () => {
    let state = createInitialTutorialState(START_MS);
    for (const beat of TUTORIAL_BEAT_ORDER) {
      state = markBeatComplete(state, beat, START_MS);
    }
    expect(state.currentBeat).toBeNull();
    expect(state.completedBeats).toEqual([...TUTORIAL_BEAT_ORDER]);
    expect(getNextBeat(state)).toBeNull();
  });

  it('graduateTutorial atomically deactivates tutorial and resets time multiplier', () => {
    const world = worldWithTutorial();
    const graduated = graduateTutorial(world, START_MS + 60_000);
    expect(graduated.tutorial?.active).toBe(false);
    expect(graduated.tutorial?.graduatedAt).toBe(START_MS + 60_000);
    expect(graduated.timeMultiplier).toBe(1);
    expect(graduated.tutorial?.currentBeat).toBeNull();
  });

  it('graduateTutorial is idempotent and preserves the first graduatedAt', () => {
    const world = worldWithTutorial();
    const first = graduateTutorial(world, START_MS + 60_000);
    const second = graduateTutorial(first, START_MS + 120_000);
    expect(second.tutorial?.graduatedAt).toBe(START_MS + 60_000);
    expect(second.timeMultiplier).toBe(1);
    expect(second.tutorial?.active).toBe(false);
  });

  it('getNextBeat returns the first uncompleted beat in order', () => {
    const initial = createInitialTutorialState(START_MS);
    expect(getNextBeat(initial)).toBe('movement');

    let state = markBeatComplete(initial, 'movement', START_MS);
    expect(getNextBeat(state)).toBe('combat');

    for (const beat of TUTORIAL_BEAT_ORDER) {
      state = markBeatComplete(state, beat, START_MS);
    }
    expect(getNextBeat(state)).toBeNull();
  });
});

describe('tutorial migration', () => {
  it('leaves tutorial undefined and sets timeMultiplier to 1 on fresh worlds', () => {
    const world = createSprint4World(START_MS);
    const migrated = ensureWorldTimeMultiplier(world);
    expect(migrated.tutorial).toBeUndefined();
    expect(migrated.timeMultiplier).toBe(1);
    expect(getTimeMultiplier(migrated)).toBe(1);
  });

  it('backfills partial tutorial objects while preserving existing fields', () => {
    const world = {
      ...createSprint4World(START_MS),
      tutorial: {
        active: true,
        completedBeats: ['movement'] as const,
      },
    } as unknown as ReturnType<typeof createSprint4World>;

    const migrated = ensureWorldMigrations(world);
    expect(migrated.tutorial?.active).toBe(true);
    expect(migrated.tutorial?.completedBeats).toEqual(['movement']);
    expect(migrated.tutorial?.currentBeat).toBeNull();
    expect(migrated.tutorial?.startedAt).toBe(0);
    expect(migrated.tutorial?.graduatedAt).toBeNull();
    expect(migrated.timeMultiplier).toBe(1);
  });
});

describe('tutorial determinism', () => {
  it('produces structurally identical states for the same beat sequence', () => {
    const run = () => {
      let state = createInitialTutorialState(START_MS);
      for (const beat of ['movement', 'combat', 'economy'] as const) {
        state = markBeatComplete(state, beat, START_MS);
      }
      return state;
    };

    expect(run()).toEqual(run());
  });
});
