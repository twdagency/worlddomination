import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  evaluateBeatProgression,
  graduateTutorial,
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  playerProposeAlliance,
  resolveDilemma,
  TUTORIAL_BEAT_ORDER,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  tick,
} from '../src';
import { INFRA_UPGRADE_BASE_COST } from '../src/constants';
import { tagOrder } from './fixtures';

const START_MS = 1_700_700_000_000;
const UNIT = 'unit-britain-infantry';
const PARIS = TUTORIAL_PARIS_TERRITORY_ID;
const BURGUNDY = TUTORIAL_BURGUNDY_TERRITORY_ID;
const BURGUNDY_FACTION = 'faction-burgundy-tutorial';

function march(
  world: ReturnType<typeof createTutorialWorld>,
  toTerritoryId: string,
  stanceOnArrival: 'assault' | 'secure' | 'hold' = 'assault',
) {
  const order = tagOrder(
    world,
    {
      kind: 'move',
      unitId: UNIT,
      toTerritoryId,
      stanceOnArrival,
    },
    PLAYER_TUTORIAL_FACTION_ID,
  );
  const travelMs = previewMoveEtaMs(world, UNIT, toTerritoryId)!.travelMs;
  return tick(world, [order], travelMs);
}

function completeTutorialPlaythrough() {
  let world = createTutorialWorld(START_MS);

  world = march(world, PARIS).world;

  const fundingNeeded = INFRA_UPGRADE_BASE_COST * (world.territories[PARIS]?.infraLevel ?? 1);
  expect(world.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding ?? 0).toBeGreaterThanOrEqual(
    fundingNeeded,
  );

  const upgrade = tagOrder(
    world,
    { kind: 'upgradeInfra', territoryId: PARIS },
    PLAYER_TUTORIAL_FACTION_ID,
  );
  world = tick(world, [upgrade], 0).world;

  world = march(world, BURGUNDY).world;

  const resolved = resolveDilemma(
    world,
    PLAYER_TUTORIAL_FACTION_ID,
    'foreign-rule',
    'conciliation',
    world.nowMs,
  );
  const progressed = evaluateBeatProgression(resolved.world, resolved.events);
  world = progressed.world;

  expect(world.tutorial?.completedBeats).toEqual([...TUTORIAL_BEAT_ORDER]);
  expect(world.tutorial?.active).toBe(true);
  return world;
}

describe('tutorial post-graduation', () => {
  it('graduates with standard time multiplier and tutorialGraduated event', () => {
    const world = completeTutorialPlaythrough();
    const { world: graduated, events } = graduateTutorial(world, world.nowMs + 1_000);

    expect(graduated.tutorial?.active).toBe(false);
    expect(graduated.tutorial?.graduatedAt).not.toBeNull();
    expect(graduated.timeMultiplier).toBe(1);
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'tutorialGraduated',
        factionId: PLAYER_TUTORIAL_FACTION_ID,
      }),
    ]);
  });

  it('preserves tutorial history after graduation', () => {
    const world = completeTutorialPlaythrough();
    const { world: graduated } = graduateTutorial(world, world.nowMs + 1_000);

    expect(graduated.tutorial?.completedBeats).toEqual([...TUTORIAL_BEAT_ORDER]);
    expect(graduated.tutorial?.graduatedAt).not.toBeNull();
    expect(graduated.territories[PARIS]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
    expect(graduated.territories[BURGUNDY]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
  });

  it('allows sandbox diplomacy actions after graduation', () => {
    const world = completeTutorialPlaythrough();
    const { world: graduated } = graduateTutorial(world, world.nowMs + 1_000);

    const proposal = playerProposeAlliance(
      graduated,
      PLAYER_TUTORIAL_FACTION_ID,
      BURGUNDY_FACTION,
      graduated.nowMs + 2_000,
    );

    expect(proposal.events.length).toBeGreaterThan(0);
    expect(['allianceFormed', 'allianceDeclined']).toContain(proposal.events[0]?.kind);
    expect(proposal.world.tutorial?.active).toBe(false);
  });

  it('keeps identity tags from dilemma resolution after graduation', () => {
    const world = completeTutorialPlaythrough();
    const { world: graduated } = graduateTutorial(world, world.nowMs + 1_000);

    expect(graduated.factions[PLAYER_TUTORIAL_FACTION_ID]?.identityTags).toEqual([
      'liberal',
      'merciful',
    ]);
  });

  it('does not re-emit tutorialGraduated on idempotent graduation', () => {
    const world = completeTutorialPlaythrough();
    const first = graduateTutorial(world, world.nowMs + 1_000);
    const second = graduateTutorial(first.world, world.nowMs + 2_000);

    expect(second.events).toEqual([]);
    expect(second.world.tutorial?.graduatedAt).toBe(first.world.tutorial?.graduatedAt);
  });
});
