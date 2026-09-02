import { describe, expect, it } from 'vitest';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BEAT_PREDICATES,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
} from '../src';
import type { SimEvent } from '../src/types';

const START_MS = 1_700_500_000_000;

function predicateFor(beat: (typeof TUTORIAL_BEAT_PREDICATES)[number]['beat']) {
  const found = TUTORIAL_BEAT_PREDICATES.find((entry) => entry.beat === beat);
  if (!found) throw new Error(`missing predicate ${beat}`);
  return found;
}

describe('tutorial beat predicates', () => {
  const world = createTutorialWorld(START_MS);

  it('combat completes on player capture of Paris', () => {
    const event: SimEvent = {
      kind: 'territoryCaptured',
      at: START_MS,
      territoryId: TUTORIAL_PARIS_TERRITORY_ID,
      previousOwnerId: 'faction-france-tutorial',
      newOwnerId: PLAYER_TUTORIAL_FACTION_ID,
    };
    expect(predicateFor('combat').isComplete(event, world)).toBe(true);
  });

  it('combat ignores captures of non-Paris territories', () => {
    const event: SimEvent = {
      kind: 'territoryCaptured',
      at: START_MS,
      territoryId: TUTORIAL_BURGUNDY_TERRITORY_ID,
      newOwnerId: PLAYER_TUTORIAL_FACTION_ID,
    };
    expect(predicateFor('combat').isComplete(event, world)).toBe(false);
  });

  it('economy completes on Paris infrastructure upgrade', () => {
    const event: SimEvent = {
      kind: 'infraUpgraded',
      at: START_MS,
      territoryId: TUTORIAL_PARIS_TERRITORY_ID,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
      infraLevel: 2,
      intent: 'build',
      source: 'direct',
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('economy').isComplete(event, world)).toBe(true);
  });

  it('economy ignores infrastructure upgrades in foreign territory', () => {
    const event: SimEvent = {
      kind: 'infraUpgraded',
      at: START_MS,
      territoryId: TUTORIAL_HOME_TERRITORY_ID,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
      infraLevel: 2,
      intent: 'build',
      source: 'direct',
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('economy').isComplete(event, world)).toBe(false);
  });

  it('pinch completes via Burgundy conquest', () => {
    const event: SimEvent = {
      kind: 'territoryCaptured',
      at: START_MS,
      territoryId: TUTORIAL_BURGUNDY_TERRITORY_ID,
      newOwnerId: PLAYER_TUTORIAL_FACTION_ID,
    };
    expect(predicateFor('pinch').isComplete(event, world)).toBe(true);
  });

  it('pinch completes via treaty with Burgundy', () => {
    const event: SimEvent = {
      kind: 'treatyFormed',
      at: START_MS,
      treatyId: 'treaty-test',
      parties: [PLAYER_TUTORIAL_FACTION_ID, TUTORIAL_BURGUNDY_FACTION_ID],
      territoryIds: [TUTORIAL_CALAIS_TERRITORY_ID],
      expiresAt: START_MS + 48 * 3_600_000,
      initiatingFaction: PLAYER_TUTORIAL_FACTION_ID,
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('pinch').isComplete(event, world)).toBe(true);
  });

  it('pinch completes via food infrastructure on London', () => {
    const event: SimEvent = {
      kind: 'infraUpgraded',
      at: START_MS,
      territoryId: TUTORIAL_HOME_TERRITORY_ID,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
      infraLevel: 2,
      intent: 'build',
      source: 'direct',
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('pinch').isComplete(event, world)).toBe(true);
  });

  it('governance completes on foreign-rule dilemma resolution', () => {
    const event: SimEvent = {
      kind: 'dilemmaResolved',
      at: START_MS,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
      dilemmaId: 'foreign-rule',
      optionId: 'conciliation',
    };
    expect(predicateFor('governance').isComplete(event, world)).toBe(true);
  });

  it('influence completes on a player diplomatic mission', () => {
    const event: SimEvent = {
      kind: 'diplomaticMissionStarted',
      at: START_MS,
      ownerId: PLAYER_TUTORIAL_FACTION_ID,
      targetCityId: TUTORIAL_BURGUNDY_TERRITORY_ID,
      expiresAt: START_MS + 14 * 86_400_000,
    };
    expect(predicateFor('influence').isComplete(event, world)).toBe(true);
  });

  it('influence ignores ordinary sight intel reports', () => {
    const event: SimEvent = {
      kind: 'intelReport',
      at: START_MS,
      observerFaction: PLAYER_TUTORIAL_FACTION_ID,
      territoryId: TUTORIAL_BURGUNDY_TERRITORY_ID,
      source: 'direct',
      variant: 'activity',
      intent: 'expand',
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('influence').isComplete(event, world)).toBe(false);
  });

  it('handoff completes on tutorialHandoffReady synthetic event', () => {
    const event: SimEvent = {
      kind: 'tutorialHandoffReady',
      at: START_MS,
      factionId: PLAYER_TUTORIAL_FACTION_ID,
    };
    expect(predicateFor('handoff').isComplete(event, world)).toBe(true);
  });

  it('movement predicate still ignores home arrivals', () => {
    const event: SimEvent = {
      kind: 'arrival',
      at: START_MS,
      unitId: 'unit-britain-infantry',
      territoryId: TUTORIAL_HOME_TERRITORY_ID,
      ownerId: PLAYER_TUTORIAL_FACTION_ID,
      unitTypeId: 'levy-t1',
      count: 1,
      stanceOnArrival: 'hold',
      fromTerritoryId: TUTORIAL_PARIS_TERRITORY_ID,
      intent: 'defend',
      source: 'direct',
      beatId: 'test',
      decisionTickMs: START_MS,
    };
    expect(predicateFor('movement').isComplete(event, world)).toBe(false);
  });
});
