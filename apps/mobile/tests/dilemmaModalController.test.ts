import { describe, expect, it, vi, afterEach } from 'vitest';
import { createTutorialWorld } from 'shared';
import * as sim from 'sim';
import type { WorldState } from 'sim';
import {
  enqueuePendingDilemma,
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  resolveDilemma,
} from 'sim';
import type { Dilemma } from 'shared';
import {
  resolveDilemmaModalState,
  shouldShowDilemmaModal,
} from '../src/game/dilemmaModalController';

const START_MS = 1_700_600_000_000;

const STANDARD_DILEMMA: Dilemma = {
  id: 'court-intrigue',
  title: 'Court intrigue',
  prompt: 'A courtier seeks favor.',
  urgency: 'standard',
  options: [
    {
      id: 'promote',
      label: 'Promote',
      description: 'Elevate the courtier.',
      consequences: [],
      identityShift: { tags: [] },
    },
  ],
};

function pendingWorld(dilemmaIds: string[]) {
  const base = createTutorialWorld(START_MS);
  return {
    ...base,
    pendingDilemmas: dilemmaIds.map((dilemmaId, index) => ({
      dilemmaId,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
      offeredAt: START_MS + index,
    })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('shouldShowDilemmaModal', () => {
  it('returns crisis-tier dilemma first when pending', () => {
    const originalGetDilemmaById = sim.getDilemmaById;
    vi.spyOn(sim, 'getDilemmaById').mockImplementation((id: string) => {
      if (id === 'court-intrigue') return STANDARD_DILEMMA;
      return originalGetDilemmaById(id);
    });

    const world = pendingWorld(['court-intrigue', 'foreign-rule']);
    expect(shouldShowDilemmaModal(world, new Set())).toEqual({
      dilemmaId: 'foreign-rule',
      urgency: 'crisis',
    });
  });

  it('returns standard dilemma when no crisis is pending and none dismissed', () => {
    const originalGetDilemmaById = sim.getDilemmaById;
    vi.spyOn(sim, 'getDilemmaById').mockImplementation((id: string) => {
      if (id === 'court-intrigue') return STANDARD_DILEMMA;
      return originalGetDilemmaById(id);
    });

    expect(shouldShowDilemmaModal(pendingWorld(['court-intrigue']), new Set())).toEqual({
      dilemmaId: 'court-intrigue',
      urgency: 'standard',
    });
  });

  it('returns null when standard dilemmas were dismissed and no crisis remains', () => {
    const originalGetDilemmaById = sim.getDilemmaById;
    vi.spyOn(sim, 'getDilemmaById').mockImplementation((id: string) => {
      if (id === 'court-intrigue') return STANDARD_DILEMMA;
      return originalGetDilemmaById(id);
    });

    expect(
      shouldShowDilemmaModal(pendingWorld(['court-intrigue']), new Set(['court-intrigue'])),
    ).toBeNull();
  });

  it('still returns crisis dilemmas even when listed in dismissed ids', () => {
    const world = enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    expect(shouldShowDilemmaModal(world, new Set(['foreign-rule']))).toEqual({
      dilemmaId: 'foreign-rule',
      urgency: 'crisis',
    });
  });

  it('hides modal when resolved dilemmas leave pending empty', () => {
    const world = createTutorialWorld(START_MS);
    const state = resolveDilemmaModalState({
      world,
      dismissedDilemmaIds: new Set(),
      manualDilemmaId: null,
    });
    expect(state.visible).toBe(false);
  });
});

describe('resolveDilemmaModalState', () => {
  it('blocks navigation for crisis dilemmas', () => {
    const world = enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    const state = resolveDilemmaModalState({
      world,
      dismissedDilemmaIds: new Set(),
      manualDilemmaId: null,
    });
    expect(state.visible).toBe(true);
    expect(state.blocksNavigation).toBe(true);
    expect(state.canDismiss).toBe(false);
  });
});

describe('tutorial Beat 5 integration', () => {
  function governanceBeatWorld(): WorldState {
    return {
      ...enqueuePendingDilemma(
        createTutorialWorld(START_MS),
        'foreign-rule',
        PLAYER_TUTORIAL_FACTION_ID,
        START_MS,
      ),
      tutorial: {
        active: true,
        currentBeat: 'governance',
        completedBeats: ['movement', 'combat', 'economy', 'pinch'],
        startedAt: 0,
        graduatedAt: null,
      },
    };
  }

  it('auto-surfaces Foreign Rule as a crisis modal during governance beat', () => {
    const world = governanceBeatWorld();

    const modal = resolveDilemmaModalState({
      world,
      dismissedDilemmaIds: new Set(),
      manualDilemmaId: null,
    });

    expect(modal.visible).toBe(true);
    expect(modal.dilemmaId).toBe('foreign-rule');
    expect(modal.urgency).toBe('crisis');
  });

  it('closes modal and advances governance beat after resolution', () => {
    const world = governanceBeatWorld();

    const { world: resolved, events } = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    const progressed = evaluateBeatProgression(world, events);

    const after = resolveDilemmaModalState({
      world: resolved,
      dismissedDilemmaIds: new Set(),
      manualDilemmaId: null,
    });

    expect(after.visible).toBe(false);
    expect(progressed.world.tutorial?.completedBeats).toContain('governance');
  });
});
