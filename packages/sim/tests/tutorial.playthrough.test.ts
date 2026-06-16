import { describe, expect, it } from 'vitest';
import { TUTORIAL_BEAT_COPY } from '../../shared/src/tutorialBeatCopy';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  playerProposeTreaty,
  previewMoveEtaMs,
  resolveDilemma,
  TUTORIAL_BEAT_ORDER,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  tick,
} from '../src';
import { collectAiOrders } from '../src/ai';
import { INFRA_UPGRADE_BASE_COST } from '../src/constants';
import { FOREIGN_RULE_DILEMMA } from '../src/dilemmas/foreignRule';
import { tagOrder } from './fixtures';

const START_MS = 1_700_700_000_000;
const UNIT = 'unit-britain-infantry';
const PARIS = TUTORIAL_PARIS_TERRITORY_ID;
const BURGUNDY = TUTORIAL_BURGUNDY_TERRITORY_ID;
const HOME = TUTORIAL_HOME_TERRITORY_ID;
const BURGUNDY_FACTION = TUTORIAL_BURGUNDY_FACTION_ID;
const FRANCE = 'faction-france-tutorial';

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

function totalFood(world: ReturnType<typeof createTutorialWorld>) {
  const london = world.territories[HOME]?.resources.food ?? 0;
  const paris = world.territories[PARIS]?.resources.food ?? 0;
  return london + paris;
}

function completeThroughEconomy(world: ReturnType<typeof createTutorialWorld>) {
  const toParis = march(world, PARIS);
  let next = toParis.world;
  expect(next.tutorial?.completedBeats).toContain('movement');
  expect(next.tutorial?.completedBeats).toContain('combat');
  expect(next.tutorial?.currentBeat).toBe('economy');
  expect(next.territories[PARIS]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
  expect(next.countries?.[FRANCE]?.defeated).toBe(true);

  const fundingNeeded = INFRA_UPGRADE_BASE_COST * (next.territories[PARIS]?.infraLevel ?? 1);
  expect(next.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding ?? 0).toBeGreaterThanOrEqual(
    fundingNeeded,
  );

  const upgrade = tagOrder(
    next,
    { kind: 'upgradeInfra', territoryId: PARIS },
    PLAYER_TUTORIAL_FACTION_ID,
  );
  next = tick(next, [upgrade], 0).world;
  expect(next.tutorial?.completedBeats).toContain('economy');
  expect(next.tutorial?.currentBeat).toBe('pinch');
  return next;
}

function finishGovernance(world: ReturnType<typeof createTutorialWorld>) {
  expect(world.tutorial?.completedBeats).toContain('pinch');
  expect(world.tutorial?.currentBeat).toBe('governance');
  expect(world.pendingDilemmas?.some((entry) => entry.dilemmaId === 'foreign-rule')).toBe(true);
  expect(TUTORIAL_BEAT_COPY.governance.title).toContain('France');
  expect(FOREIGN_RULE_DILEMMA.prompt).toContain('Henry IV is defeated');

  const resolved = resolveDilemma(
    world,
    PLAYER_TUTORIAL_FACTION_ID,
    'foreign-rule',
    'conciliation',
    world.nowMs,
  );
  const progressed = evaluateBeatProgression(resolved.world, resolved.events);
  const next = progressed.world;

  expect(next.tutorial?.completedBeats).toEqual([...TUTORIAL_BEAT_ORDER]);
  expect(next.tutorial?.currentBeat).toBeNull();
  expect(next.tutorial?.active).toBe(true);
  expect(next.factions[PLAYER_TUTORIAL_FACTION_ID]?.identityTags).toEqual([
    'liberal',
    'merciful',
  ]);
  expect(progressed.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(true);
  return next;
}

describe('tutorial playthrough', () => {
  it('runs the conquest-path tutorial deterministically through all six beats', () => {
    let world = createTutorialWorld(START_MS);
    expect(world.tutorial?.currentBeat).toBe('movement');
    expect(totalFood(world)).toBe(25);

    world = completeThroughEconomy(world);
    expect(
      collectAiOrders(world, world.nowMs).every((order) => {
        if (order.kind !== 'move') return true;
        return world.units[order.unitId]?.ownerId !== FRANCE;
      }),
    ).toBe(true);
    const foodAfterEconomy = totalFood(world);
    expect(foodAfterEconomy).toBeGreaterThanOrEqual(20);
    expect(foodAfterEconomy).toBeLessThanOrEqual(80);

    world = march(world, BURGUNDY).world;
    finishGovernance(world);
  });

  it('runs the treaty-path tutorial through all six beats', () => {
    let world = completeThroughEconomy(createTutorialWorld(START_MS));

    const treaty = playerProposeTreaty(
      world,
      PLAYER_TUTORIAL_FACTION_ID,
      BURGUNDY_FACTION,
      HOME,
      world.nowMs,
    );
    expect(treaty.events.some((event) => event.kind === 'treatyFormed')).toBe(true);
    const progressed = evaluateBeatProgression(treaty.world, treaty.events);
    world = progressed.world;

    finishGovernance(world);
  });

  it('runs the food-infra-path tutorial through all six beats', () => {
    const base = completeThroughEconomy(createTutorialWorld(START_MS));
    let world = {
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
    world = tick(world, [homeUpgrade], 0).world;

    finishGovernance(world);
  });
});
