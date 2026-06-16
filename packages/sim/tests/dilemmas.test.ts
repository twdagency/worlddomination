import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  enqueuePendingDilemma,
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  resolveDilemma,
} from '../src';

const START_MS = 1_700_600_000_000;

describe('dilemmas', () => {
  it('enqueuePendingDilemma adds a pending entry idempotently', () => {
    const world = createTutorialWorld(START_MS);
    const first = enqueuePendingDilemma(world, 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, START_MS);
    const second = enqueuePendingDilemma(first, 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, START_MS);
    expect(first.pendingDilemmas).toHaveLength(1);
    expect(second.pendingDilemmas).toHaveLength(1);
  });

  it('resolveDilemma applies conciliation gold and standing consequences', () => {
    const world = enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    const beforeFunding = world.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding ?? 0;
    const { world: resolved } = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    expect(resolved.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding).toBe(beforeFunding + 50);
    expect(resolved.pendingDilemmas).toHaveLength(0);
    expect(resolved.territories['territory-london-tutorial']?.standing).toBe(70);
  });

  it('resolveDilemma appends identity tags from the chosen option', () => {
    const world = enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    const { world: resolved } = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    expect(resolved.factions[PLAYER_TUTORIAL_FACTION_ID]?.identityTags).toEqual([
      'liberal',
      'merciful',
    ]);
  });

  it('resolveDilemma emits dilemmaResolved event', () => {
    const world = enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    const { events } = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'dilemmaResolved',
        at: START_MS,
        factionId: PLAYER_TUTORIAL_FACTION_ID,
        dilemmaId: 'foreign-rule',
        optionId: 'conciliation',
        importance: 'high',
      }),
    ]);
  });

  it('resolveDilemma is idempotent when dilemma is not pending', () => {
    const world = createTutorialWorld(START_MS);
    const first = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    const second = resolveDilemma(
      first.world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    expect(second.events).toEqual([]);
    expect(second.world).toBe(first.world);
  });

  it('harsh and exploit options apply distinct funding deltas', () => {
    const baseFunding = 500;
    const base = enqueuePendingDilemma(
      {
        ...createTutorialWorld(START_MS),
        factions: {
          ...createTutorialWorld(START_MS).factions,
          [PLAYER_TUTORIAL_FACTION_ID]: {
            ...createTutorialWorld(START_MS).factions[PLAYER_TUTORIAL_FACTION_ID]!,
            funding: baseFunding,
          },
        },
      },
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    );
    const harsh = resolveDilemma(
      base,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'harsh-repression',
      START_MS,
    ).world;
    const exploit = resolveDilemma(
      enqueuePendingDilemma(
        {
          ...createTutorialWorld(START_MS),
          factions: {
            ...createTutorialWorld(START_MS).factions,
            [PLAYER_TUTORIAL_FACTION_ID]: {
              ...createTutorialWorld(START_MS).factions[PLAYER_TUTORIAL_FACTION_ID]!,
              funding: baseFunding,
            },
          },
        },
        'foreign-rule',
        PLAYER_TUTORIAL_FACTION_ID,
        START_MS,
      ),
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'exploit-extract',
      START_MS,
    ).world;
    expect(harsh.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding).toBe(baseFunding + 200);
    expect(exploit.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding).toBe(baseFunding + 400);
  });

  it('dilemma resolution advances governance beat through beat progression', () => {
    const world = {
      ...enqueuePendingDilemma(createTutorialWorld(START_MS), 'foreign-rule', PLAYER_TUTORIAL_FACTION_ID, START_MS),
      tutorial: {
        active: true,
        currentBeat: 'governance' as const,
        completedBeats: ['movement', 'combat', 'economy', 'pinch'] as const,
        startedAt: 0,
        graduatedAt: null,
      },
    };
    const { events } = resolveDilemma(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      START_MS,
    );
    const progressed = evaluateBeatProgression(world, events);
    expect(progressed.world.tutorial?.completedBeats).toContain('governance');
    expect(progressed.world.tutorial?.completedBeats).toContain('handoff');
    expect(progressed.world.tutorial?.currentBeat).toBeNull();
  });
});
