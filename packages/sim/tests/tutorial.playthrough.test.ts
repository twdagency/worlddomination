import { describe, expect, it } from 'vitest';
import { TUTORIAL_BEAT_COPY } from '../../shared/src/tutorialBeatCopy';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  resolveDilemma,
  TUTORIAL_BEAT_ORDER,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
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
  const london = world.territories['territory-london-tutorial']?.resources.food ?? 0;
  const paris = world.territories[PARIS]?.resources.food ?? 0;
  return london + paris;
}

describe('tutorial playthrough', () => {
  it('runs the conquest-path tutorial deterministically through all six beats', () => {
    let world = createTutorialWorld(START_MS);
    expect(world.tutorial?.currentBeat).toBe('movement');
    expect(totalFood(world)).toBe(25);

    const toParis = march(world, PARIS);
    world = toParis.world;
    expect(world.tutorial?.completedBeats).toContain('movement');
    expect(world.tutorial?.completedBeats).toContain('combat');
    expect(world.tutorial?.currentBeat).toBe('economy');
    expect(world.territories[PARIS]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
    expect(world.countries?.[FRANCE]?.defeated).toBe(true);
    expect(
      toParis.events.some(
        (event) => event.kind === 'countryDefeated' && event.countryId === FRANCE,
      ),
    ).toBe(true);
    expect(
      collectAiOrders(world, world.nowMs).every((order) => {
        if (order.kind !== 'move') return true;
        return world.units[order.unitId]?.ownerId !== FRANCE;
      }),
    ).toBe(true);
    const foodAfterParis = totalFood(world);
    expect(foodAfterParis).toBeGreaterThanOrEqual(20);
    expect(foodAfterParis).toBeLessThanOrEqual(80);

    const fundingNeeded = INFRA_UPGRADE_BASE_COST * (world.territories[PARIS]?.infraLevel ?? 1);
    expect(world.factions[PLAYER_TUTORIAL_FACTION_ID]?.funding ?? 0).toBeGreaterThanOrEqual(fundingNeeded);

    const upgrade = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: PARIS },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    world = tick(world, [upgrade], 0).world;
    expect(world.tutorial?.completedBeats).toContain('economy');
    expect(world.tutorial?.currentBeat).toBe('pinch');
    const foodAfterEconomy = totalFood(world);
    expect(foodAfterEconomy).toBeGreaterThanOrEqual(20);
    expect(foodAfterEconomy).toBeLessThanOrEqual(80);

    const toBurgundy = march(world, BURGUNDY);
    world = toBurgundy.world;
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
    world = progressed.world;
    expect(world.tutorial?.completedBeats).toEqual([...TUTORIAL_BEAT_ORDER]);
    expect(world.tutorial?.currentBeat).toBeNull();
    expect(world.tutorial?.active).toBe(true);
    expect(world.factions[PLAYER_TUTORIAL_FACTION_ID]?.identityTags).toEqual([
      'liberal',
      'merciful',
    ]);
    expect(progressed.events.some((event) => event.kind === 'tutorialHandoffReady')).toBe(true);
  });
});
