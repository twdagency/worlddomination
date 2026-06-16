import { describe, expect, it } from 'vitest';
import { TUTORIAL_BEAT_COPY } from '../../shared/src/tutorialBeatCopy';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { collectAiOrders } from '../src/ai';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  TUTORIAL_BEAT_PREDICATES,
  TUTORIAL_PARIS_TERRITORY_ID,
  tick,
} from '../src';
import { dispatchLineForEvent, isDispatchVisibleToFaction } from '../src/dispatch';
import { FOREIGN_RULE_DILEMMA } from '../src/dilemmas/foreignRule';
import { tagOrder } from './fixtures';

const START_MS = 1_700_800_000_000;
const UNIT = 'unit-britain-infantry';
const PARIS = TUTORIAL_PARIS_TERRITORY_ID;
const FRANCE = 'faction-france-tutorial';

function marchToParis(world: ReturnType<typeof createTutorialWorld>) {
  const order = tagOrder(
    world,
    {
      kind: 'move',
      unitId: UNIT,
      toTerritoryId: PARIS,
      stanceOnArrival: 'assault',
    },
    PLAYER_TUTORIAL_FACTION_ID,
  );
  const travelMs = previewMoveEtaMs(world, UNIT, PARIS)!.travelMs;
  return tick(world, [order], travelMs);
}

function combatPredicate() {
  return TUTORIAL_BEAT_PREDICATES.find((entry) => entry.beat === 'combat')!;
}

describe('tutorial France defeated (Option β)', () => {
  it('Beat 2 Paris capture marks France defeated in the same tick', () => {
    const { world } = marchToParis(createTutorialWorld(START_MS));
    expect(world.countries?.[FRANCE]?.defeated).toBe(true);
    expect(world.territories[PARIS]?.ownerId).toBe(PLAYER_TUTORIAL_FACTION_ID);
  });

  it('emits countryDefeated visible in the player dispatch stream', () => {
    const { world, events } = marchToParis(createTutorialWorld(START_MS));
    const defeat = events.find((event) => event.kind === 'countryDefeated');
    expect(defeat).toMatchObject({
      kind: 'countryDefeated',
      countryId: FRANCE,
      defeatedBy: PLAYER_TUTORIAL_FACTION_ID,
      finalTerritoryId: PARIS,
    });
    expect(dispatchLineForEvent(world, defeat!)).toContain('fallen');
    expect(isDispatchVisibleToFaction(world, defeat!, PLAYER_TUTORIAL_FACTION_ID)).toBe(true);
  });

  it('still completes combat beat via territoryCaptured in the same tick', () => {
    const { events } = marchToParis(createTutorialWorld(START_MS));
    const capture = events.find((event) => event.kind === 'territoryCaptured');
    expect(capture).toMatchObject({
      kind: 'territoryCaptured',
      territoryId: PARIS,
      newOwnerId: PLAYER_TUTORIAL_FACTION_ID,
    });
    expect(combatPredicate().isComplete(capture!, createTutorialWorld(START_MS))).toBe(true);
  });

  it('excludes defeated France from AI orders after Beat 2', () => {
    const { world } = marchToParis(createTutorialWorld(START_MS));
    const orders = collectAiOrders(world, world.nowMs);
    for (const order of orders) {
      if (order.kind === 'move') {
        expect(world.units[order.unitId]?.ownerId).not.toBe(FRANCE);
      } else if (order.kind === 'build' || order.kind === 'upgradeInfra') {
        expect(order.factionId).not.toBe(FRANCE);
      }
    }
  });

  it('governance beat and foreign-rule dilemma copy reflect France defeat', () => {
    expect(TUTORIAL_BEAT_COPY.governance.title).toContain('France');
    expect(TUTORIAL_BEAT_COPY.governance.body).toContain('Henry IV');
    expect(FOREIGN_RULE_DILEMMA.title).toBe('The fall of France');
    expect(FOREIGN_RULE_DILEMMA.prompt).toContain('Henry IV is defeated');
  });
});
