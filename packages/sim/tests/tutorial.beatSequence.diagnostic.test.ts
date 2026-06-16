import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  tick,
} from '../src';
import type { SimEventDraft } from '../src/types';
import { tagOrder } from './fixtures';

const START_MS = 1_700_800_000_000;
const UNIT = 'unit-britain-infantry';
const PARIS = TUTORIAL_PARIS_TERRITORY_ID;
const BURGUNDY = TUTORIAL_BURGUNDY_TERRITORY_ID;
const HOME = TUTORIAL_HOME_TERRITORY_ID;

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

function worldAtPinchBeat() {
  let world = createTutorialWorld(START_MS);
  world = march(world, PARIS).world;
  const economyUpgrade = tagOrder(
    world,
    { kind: 'upgradeInfra', territoryId: PARIS },
    PLAYER_TUTORIAL_FACTION_ID,
  );
  world = tick(world, [economyUpgrade], 0).world;
  expect(world.tutorial?.currentBeat).toBe('pinch');
  return world;
}

function hasForeignRulePending(world: ReturnType<typeof createTutorialWorld>) {
  return world.pendingDilemmas?.some((entry) => entry.dilemmaId === 'foreign-rule') ?? false;
}

describe('tutorial beat sequence diagnostics (#14)', () => {
  it('DIAGNOSTIC: conquest pinch path enqueues foreign-rule dilemma', () => {
    const world = worldAtPinchBeat();
    const afterPinch = march(world, BURGUNDY).world;

    expect(afterPinch.tutorial?.completedBeats).toContain('pinch');
    expect(afterPinch.tutorial?.currentBeat).toBe('governance');
    expect(hasForeignRulePending(afterPinch)).toBe(true);
  });

  it('DIAGNOSTIC: food-infra pinch path enqueues foreign-rule without auto-completing governance', () => {
    const base = worldAtPinchBeat();
    const world = {
      ...base,
      factions: {
        ...base.factions,
        [PLAYER_TUTORIAL_FACTION_ID]: {
          ...base.factions[PLAYER_TUTORIAL_FACTION_ID]!,
          funding: 50_000,
        },
      },
    };
    const homeUpgrade = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: HOME },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const afterPinch = tick(world, [homeUpgrade], 0);

    expect(afterPinch.world.tutorial?.completedBeats).toContain('pinch');
    expect(hasForeignRulePending(afterPinch.world)).toBe(true);
    expect(afterPinch.world.tutorial?.completedBeats).not.toContain('governance');
    expect(afterPinch.world.tutorial?.currentBeat).toBe('governance');
    expect(afterPinch.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(
      false,
    );
  });

  it('DIAGNOSTIC: treaty pinch path enqueues foreign-rule without auto-completing governance', () => {
    const world = worldAtPinchBeat();
    const treatyFormed: SimEventDraft = {
      kind: 'treatyFormed',
      at: world.nowMs,
      parties: [PLAYER_TUTORIAL_FACTION_ID, TUTORIAL_BURGUNDY_FACTION_ID],
      territoryIds: [BURGUNDY],
      expiresAt: world.nowMs + 48 * 3_600_000,
      importance: 'medium',
    };
    const afterPinch = evaluateBeatProgression(world, [treatyFormed]);

    expect(afterPinch.world.tutorial?.completedBeats).toContain('pinch');
    expect(hasForeignRulePending(afterPinch.world)).toBe(true);
    expect(afterPinch.world.tutorial?.completedBeats).not.toContain('governance');
    expect(afterPinch.world.tutorial?.currentBeat).toBe('governance');
    expect(afterPinch.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(
      false,
    );
  });

  it('DIAGNOSTIC: handoff does not fire until governance completes on non-conquest pinch', () => {
    const base = worldAtPinchBeat();
    const world = {
      ...base,
      factions: {
        ...base.factions,
        [PLAYER_TUTORIAL_FACTION_ID]: {
          ...base.factions[PLAYER_TUTORIAL_FACTION_ID]!,
          funding: 50_000,
        },
      },
    };
    const homeUpgrade = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: HOME },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const afterPinch = tick(world, [homeUpgrade], 0);

    expect(hasForeignRulePending(afterPinch.world)).toBe(true);
    expect(afterPinch.world.tutorial?.currentBeat).toBe('governance');
    expect(
      afterPinch.events.some((event) => event.kind === 'tutorialHandoffReady'),
    ).toBe(false);
    expect(afterPinch.world.tutorial?.completedBeats).not.toContain('handoff');
  });

  it('DIAGNOSTIC: handoff does not fire before governance completes on conquest path', () => {
    const world = worldAtPinchBeat();
    const afterPinch = march(world, BURGUNDY);

    expect(hasForeignRulePending(afterPinch.world)).toBe(true);
    expect(afterPinch.world.tutorial?.currentBeat).toBe('governance');
    expect(afterPinch.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(
      false,
    );
    expect(afterPinch.world.tutorial?.completedBeats).not.toContain('handoff');
  });
});
