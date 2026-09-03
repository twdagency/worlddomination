import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  createBeatController,
  evaluateBeatProgression,
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  TUTORIAL_HOME_TERRITORY_ID,
  tick,
} from '../src';
import type { SimEvent } from '../src/types';
import { tagOrder } from './fixtures';

const START_MS = 1_700_300_000_000;
const PARIS = 'territory-paris-tutorial';
const FRANCE = 'faction-france-tutorial';

function arrivalEvent(
  overrides: Partial<Extract<SimEvent, { kind: 'arrival' }>> = {},
): Extract<SimEvent, { kind: 'arrival' }> {
  return {
    kind: 'arrival',
    at: START_MS,
    unitId: 'unit-britain-infantry',
    territoryId: PARIS,
    ownerId: PLAYER_TUTORIAL_FACTION_ID,
    unitTypeId: 'levy-t1',
    count: 1,
    stanceOnArrival: 'assault',
    fromTerritoryId: TUTORIAL_HOME_TERRITORY_ID,
    intent: 'attack',
    source: 'direct',
    beatId: 'test-beat',
    decisionTickMs: START_MS,
    ...overrides,
  };
}

function buildStartedEvent(): Extract<SimEvent, { kind: 'buildStarted' }> {
  return {
    kind: 'buildStarted',
    at: START_MS,
    territoryId: TUTORIAL_HOME_TERRITORY_ID,
    countryId: PLAYER_TUTORIAL_FACTION_ID,
    unitTypeId: 'levy-t1',
    count: 1,
    intent: 'build',
    source: 'direct',
    beatId: 'economy-test',
    decisionTickMs: START_MS,
  };
}

describe('beat controller', () => {
  const controller = createBeatController();

  it('is a no-op on non-tutorial worlds', () => {
    const world = createSprint4World(START_MS);
    const event = arrivalEvent({ ownerId: 'faction-player', territoryId: 'territory-paris' });
    const next = controller.evaluate(event, world);
    expect(next).toBe(world);
    expect(next.tutorial).toBeUndefined();
  });

  it('leaves tutorial world unchanged when no predicate matches', () => {
    const world = createTutorialWorld(START_MS);
    const next = controller.evaluate(
      { kind: 'income', at: START_MS, funding: 10, resourcesByTerritory: {} },
      world,
    );
    expect(next.tutorial).toEqual(world.tutorial);
  });

  it('movement predicate advances to combat when the player arrives away from home', () => {
    const world = createTutorialWorld(START_MS);
    const next = controller.evaluate(arrivalEvent(), world);
    expect(next.tutorial?.completedBeats).toEqual(['movement']);
    expect(next.tutorial?.currentBeat).toBe('combat');
  });

  it('movement predicate ignores arrivals at London (home territory)', () => {
    const world = createTutorialWorld(START_MS);
    const next = controller.evaluate(
      arrivalEvent({ territoryId: TUTORIAL_HOME_TERRITORY_ID }),
      world,
    );
    expect(next.tutorial).toEqual(world.tutorial);
  });

  it('movement predicate ignores arrivals by AI factions', () => {
    const world = createTutorialWorld(START_MS);
    const next = controller.evaluate(
      arrivalEvent({ ownerId: FRANCE, territoryId: PARIS }),
      world,
    );
    expect(next.tutorial).toEqual(world.tutorial);
  });

  it('is idempotent when the same triggering event is evaluated twice', () => {
    const world = createTutorialWorld(START_MS);
    const event = arrivalEvent();
    const afterFirst = controller.evaluate(event, world);
    const afterSecond = controller.evaluate(event, afterFirst);
    expect(afterSecond.tutorial).toEqual(afterFirst.tutorial);
    expect(afterSecond.tutorial?.completedBeats).toEqual(['movement']);
  });

  it('later-beat predicates do not fire during movement', () => {
    const world = createTutorialWorld(START_MS);
    const next = controller.evaluate(buildStartedEvent(), world);
    expect(next.tutorial?.currentBeat).toBe('movement');
    expect(next.tutorial?.completedBeats).toEqual([]);
  });

  it('tick integration completes movement beat on London → Paris arrival', () => {
    const world = createTutorialWorld(START_MS);
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: 'unit-britain-infantry',
        toTerritoryId: PARIS,
        stanceOnArrival: 'assault',
      },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const travelMs = previewMoveEtaMs(world, 'unit-britain-infantry', PARIS)!.travelMs;
    const { world: afterMarch } = tick(world, [order], travelMs);

    expect(afterMarch.tutorial?.completedBeats).toContain('movement');
    expect(afterMarch.tutorial?.completedBeats).toContain('combat');
    expect(afterMarch.tutorial?.currentBeat).toBe('economy');
  });

  it('does not complete pinch or offer Foreign Rule after the player is defeated', () => {
    const base = createTutorialWorld(START_MS);
    const player = base.countries![PLAYER_TUTORIAL_FACTION_ID]!;
    const world = {
      ...base,
      tutorial: {
        active: true,
        currentBeat: 'pinch' as const,
        completedBeats: ['movement', 'combat', 'economy'] as const,
        startedAt: 0,
        graduatedAt: null,
      },
      pendingDilemmas: [
        {
          dilemmaId: 'foreign-rule',
          countryId: PLAYER_TUTORIAL_FACTION_ID,
          offeredAt: START_MS,
        },
      ],
      countries: {
        ...base.countries,
        [PLAYER_TUTORIAL_FACTION_ID]: { ...player, defeated: true },
      },
      factions: {
        ...base.factions,
        [PLAYER_TUTORIAL_FACTION_ID]: { ...base.factions[PLAYER_TUTORIAL_FACTION_ID]!, defeated: true },
      },
    };
    const capture = {
      kind: 'territoryCaptured' as const,
      at: START_MS,
      territoryId: 'territory-burgundy-tutorial',
      previousOwnerId: 'faction-burgundy-tutorial',
      newOwnerId: PLAYER_TUTORIAL_FACTION_ID,
      importance: 'high' as const,
    };

    const next = controller.evaluate(capture, world);
    expect(next.tutorial?.currentBeat).toBe('pinch');
    expect(next.tutorial?.completedBeats).toEqual(['movement', 'combat', 'economy']);

    const progressed = evaluateBeatProgression(world, [capture]);
    expect(progressed.world.pendingDilemmas ?? []).toHaveLength(0);
    expect(progressed.world.tutorial?.currentBeat).toBe('pinch');
  });

  it('determinism: identical worlds and event sequences yield identical tutorial states', () => {
    const run = () => {
      const world = createTutorialWorld(START_MS);
      const event = arrivalEvent();
      return controller.evaluate(event, world).tutorial;
    };
    expect(run()).toEqual(run());
  });
});
