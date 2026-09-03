import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  evaluateBeatProgression,
  hasTutorialForeignInfluenceTarget,
  PLAYER_TUTORIAL_FACTION_ID,
  resolveDilemma,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  tick,
} from '../src';
import { enqueuePendingDilemma } from '../src/dilemmas';
import { tagOrder } from './fixtures';

const START_MS = 1_700_710_000_000;

function governanceWorld() {
  return {
    ...enqueuePendingDilemma(
      createTutorialWorld(START_MS),
      'foreign-rule',
      PLAYER_TUTORIAL_FACTION_ID,
      START_MS,
    ),
    tutorial: {
      active: true as const,
      currentBeat: 'governance' as const,
      completedBeats: ['movement', 'combat', 'economy', 'pinch'] as const,
      startedAt: START_MS,
      graduatedAt: null,
    },
  };
}

function resolveGovernance(world: ReturnType<typeof governanceWorld>) {
  const resolved = resolveDilemma(
    world,
    PLAYER_TUTORIAL_FACTION_ID,
    'foreign-rule',
    'conciliation',
    world.nowMs,
  );
  return evaluateBeatProgression(resolved.world, resolved.events);
}

describe('tutorial influence beat', () => {
  it('opens after governance when a foreign city remains', () => {
    const progressed = resolveGovernance(governanceWorld());
    expect(progressed.world.tutorial?.currentBeat).toBe('influence');
    expect(hasTutorialForeignInfluenceTarget(progressed.world)).toBe(true);
    expect(progressed.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(false);
  });

  it('completes on a diplomatic mission and then emits handoff', () => {
    const afterGovernance = resolveGovernance(governanceWorld()).world;
    const mission = tagOrder(
      afterGovernance,
      {
        kind: 'diplomatic-mission',
        ownerId: PLAYER_TUTORIAL_FACTION_ID,
        targetCityId: TUTORIAL_BURGUNDY_TERRITORY_ID,
      },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const result = tick(afterGovernance, [mission], 0);
    expect(result.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(true);
    expect(result.world.tutorial?.completedBeats).toContain('influence');
    expect(result.world.tutorial?.completedBeats).toContain('handoff');
    expect(result.world.tutorial?.currentBeat).toBeNull();
  });

  it('skips when no undefeated foreign city remains', () => {
    const base = governanceWorld();
    const france = 'faction-france-tutorial';
    const skipped = {
      ...base,
      territories: {
        ...base.territories,
        [TUTORIAL_PARIS_TERRITORY_ID]: {
          ...base.territories[TUTORIAL_PARIS_TERRITORY_ID]!,
          ownerId: PLAYER_TUTORIAL_FACTION_ID,
        },
        [TUTORIAL_BURGUNDY_TERRITORY_ID]: {
          ...base.territories[TUTORIAL_BURGUNDY_TERRITORY_ID]!,
          ownerId: PLAYER_TUTORIAL_FACTION_ID,
        },
        [TUTORIAL_CALAIS_TERRITORY_ID]: {
          ...base.territories[TUTORIAL_CALAIS_TERRITORY_ID]!,
          ownerId: PLAYER_TUTORIAL_FACTION_ID,
        },
      },
      countries: {
        ...base.countries,
        [france]: { ...base.countries![france]!, defeated: true },
        [TUTORIAL_BURGUNDY_FACTION_ID]: {
          ...base.countries![TUTORIAL_BURGUNDY_FACTION_ID]!,
          defeated: true,
        },
      },
      factions: {
        ...base.factions,
        [france]: { ...base.factions[france]!, defeated: true },
        [TUTORIAL_BURGUNDY_FACTION_ID]: {
          ...base.factions[TUTORIAL_BURGUNDY_FACTION_ID]!,
          defeated: true,
        },
      },
    };
    expect(hasTutorialForeignInfluenceTarget(skipped)).toBe(false);
    const progressed = resolveGovernance(skipped);
    expect(progressed.world.tutorial?.completedBeats).toContain('influence');
    expect(progressed.world.tutorial?.completedBeats).toContain('handoff');
    expect(progressed.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(true);
  });
});
