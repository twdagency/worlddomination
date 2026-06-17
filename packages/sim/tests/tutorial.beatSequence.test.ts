import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  accrueEconomy,
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  resolveDilemma,
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
const FRANCE = 'faction-france-tutorial';

function march(
  world: ReturnType<typeof createTutorialWorld>,
  toTerritoryId: string,
) {
  const order = tagOrder(
    world,
    {
      kind: 'move',
      unitId: UNIT,
      toTerritoryId,
      stanceOnArrival: 'assault',
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

function expectGovernanceGate(world: ReturnType<typeof createTutorialWorld>) {
  expect(world.tutorial?.completedBeats).toContain('pinch');
  expect(world.tutorial?.completedBeats).not.toContain('governance');
  expect(world.tutorial?.currentBeat).toBe('governance');
  expect(hasForeignRulePending(world)).toBe(true);
}

describe('tutorial beat sequence invariants (Sprint 8.5)', () => {
  it('enqueues foreign-rule on conquest pinch without completing governance', () => {
    const afterPinch = march(worldAtPinchBeat(), BURGUNDY).world;
    expectGovernanceGate(afterPinch);
  });

  it('enqueues foreign-rule on treaty pinch without completing governance', () => {
    const world = worldAtPinchBeat();
    const treatyFormed: SimEventDraft = {
      kind: 'treatyFormed',
      at: world.nowMs,
      parties: [PLAYER_TUTORIAL_FACTION_ID, TUTORIAL_BURGUNDY_FACTION_ID],
      territoryIds: [BURGUNDY],
      expiresAt: world.nowMs + 48 * 3_600_000,
      importance: 'medium',
    };
    const afterPinch = evaluateBeatProgression(world, [treatyFormed]).world;
    expectGovernanceGate(afterPinch);
  });

  it('enqueues foreign-rule on food-infra pinch without completing governance', () => {
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
    const afterPinch = tick(world, [homeUpgrade], 0).world;
    expectGovernanceGate(afterPinch);
  });

  it('does not emit handoff until governance completes via dilemma resolution', () => {
    const afterPinch = march(worldAtPinchBeat(), BURGUNDY);
    expectGovernanceGate(afterPinch.world);

    const resolved = resolveDilemma(
      afterPinch.world,
      PLAYER_TUTORIAL_FACTION_ID,
      'foreign-rule',
      'conciliation',
      afterPinch.world.nowMs,
    );
    const progressed = evaluateBeatProgression(resolved.world, resolved.events);

    expect(progressed.world.tutorial?.completedBeats).toContain('governance');
    expect(progressed.world.tutorial?.completedBeats).toContain('handoff');
    expect(progressed.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(true);
  });

  it('does not accrue income for a territory lost to capture in the same tick', () => {
    const world = createTutorialWorld(START_MS);
    const franceBefore = world.factions[FRANCE]!.funding;
    const travelMs = previewMoveEtaMs(world, UNIT, PARIS)!.travelMs;
    const staleFranceIncome =
      accrueEconomy(world, travelMs).factions[FRANCE]!.funding - franceBefore;

    const result = march(world, PARIS);

    expect(result.world.territories[PARIS]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
    const franceDelta = (result.world.factions[FRANCE]?.funding ?? 0) - franceBefore;
    expect(staleFranceIncome).toBeGreaterThan(0);
    expect(franceDelta).toBe(0);
  });
});
