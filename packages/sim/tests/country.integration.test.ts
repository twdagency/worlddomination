import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import {
  CANONICAL_CAPITALS_BY_SCENARIO,
  ensureWorldCountries,
  recordConquerorOnTerritoryCapture,
  syncCountriesFromFactions,
} from '../src/country';
import { areAllied, formAlliance } from '../src/diplomacy';
import { collectAiOrders } from '../src/ai';
import { dispatchLineForEvent } from '../src/dispatch';
import { ensureWorldMigrations } from '../src/migrations';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  previewMoveEtaMs,
  tick,
} from '../src';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { tagOrder } from './fixtures';
import type { Territory } from '../src/types';

const START_MS = 1_700_000_000_000;
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PLAYER = 'faction-player';
const PARIS = 'territory-paris';
const FRANCE = 'faction-france-tutorial';
const PARIS_TUTORIAL = 'territory-paris-tutorial';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('country scenario integration', () => {
  it('migrates sprint-4 with four countries and canonical capitals', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(4);

    const caps = CANONICAL_CAPITALS_BY_SCENARIO['sprint-4-ai-world']!;
    for (const [countryId, capitalId] of Object.entries(caps)) {
      expect(world.countries![countryId]?.capitalTerritoryId).toBe(capitalId);
      expect(world.countries![countryId]?.defeated).toBe(false);
    }
  });

  it('migrates sprint-5 with ottoman istanbul capital for faction-britain', () => {
    const world = migrate(createSprint5World(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(4);
    expect(world.countries!['faction-britain']?.capitalTerritoryId).toBe('territory-istanbul');
    expect(world.countries!['faction-steppe']?.capitalTerritoryId).toBe('territory-sofia');
    expect(world.countries!['faction-rome']?.capitalTerritoryId).toBe('territory-bucharest');
    expect(world.factions['faction-britain']?.leaderId).toBe('leader-suleiman');
  });

  it('migrates tutorial with three countries and france capital at paris', () => {
    const world = ensureWorldCountries(createTutorialWorld(START_MS));
    expect(Object.keys(world.countries ?? {})).toHaveLength(3);

    const caps = CANONICAL_CAPITALS_BY_SCENARIO.tutorial!;
    for (const [countryId, capitalId] of Object.entries(caps)) {
      expect(world.countries![countryId]?.capitalTerritoryId).toBe(capitalId);
    }
    expect(world.countries!['faction-france-tutorial']?.name).toBeTruthy();
  });

  it('sprint-4: britain capturing paris relocates caesar capital without defeat', () => {
    const lyon: Territory = {
      id: 'territory-lyon-s4',
      name: 'Lyon',
      coord: { lat: 45.75, lon: 4.85 },
      ownerId: ROME,
      baseYield: 60,
      infraLevel: 2,
      resources: {},
    };
    const migrated = migrate(createSprint4World(START_MS));
    let world = ensureWorldCountries({
      ...migrated,
      territories: { ...migrated.territories, [lyon.id]: lyon },
    });

    world = recordConquerorOnTerritoryCapture(world, PARIS, ROME, BRITAIN);
    world = {
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: BRITAIN },
      },
    };

    const { world: synced, events } = syncCountriesFromFactions(world);
    expect(synced.countries![ROME]?.defeated).toBe(false);
    expect(synced.countries![ROME]?.capitalTerritoryId).toBe(lyon.id);
    expect(events.some((e) => e.kind === 'capitalRelocated')).toBe(true);
    expect(events.some((e) => e.kind === 'countryDefeated')).toBe(false);
  });

  it('tutorial: paris assault emits countryDefeated for france (Beat 2 precondition)', () => {
    const world = ensureWorldCountries(createTutorialWorld(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: 'unit-britain-infantry',
        toTerritoryId: PARIS_TUTORIAL,
        stanceOnArrival: 'assault',
      },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const travelMs = previewMoveEtaMs(world, 'unit-britain-infantry', PARIS_TUTORIAL)!.travelMs;
    const result = tick(world, [order], travelMs);

    const defeat = result.events.find((e) => e.kind === 'countryDefeated');
    expect(defeat).toMatchObject({
      kind: 'countryDefeated',
      countryId: FRANCE,
      defeatedBy: PLAYER_TUTORIAL_FACTION_ID,
      finalTerritoryId: PARIS_TUTORIAL,
    });
    expect(result.world.countries![FRANCE]?.defeated).toBe(true);
    expect(dispatchLineForEvent(result.world, defeat!)).toContain('fallen');
  });

  it('round-trips defeated country state through save/load migration', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = {
      ...recordConquerorOnTerritoryCapture(base, PARIS, ROME, BRITAIN),
      territories: {
        ...base.territories,
        [PARIS]: { ...base.territories[PARIS]!, ownerId: BRITAIN },
      },
    };
    const { world: defeatedWorld } = syncCountriesFromFactions(afterCapture);
    expect(defeatedWorld.countries![ROME]?.defeated).toBe(true);

    const roundTrip = ensureWorldMigrations(
      JSON.parse(JSON.stringify(defeatedWorld)) as typeof defeatedWorld,
      { leaders: LEADERS_BY_ID, unitTypes: UNIT_TYPES_BY_ID },
    );
    expect(roundTrip.countries![ROME]?.defeated).toBe(true);
    expect(roundTrip.countries![ROME]?.lastConquerorId).toBe(BRITAIN);
  });

  it('sprint-5: full caesar defeat emits cascade and stops AI orders', () => {
    const world = migrate(createSprint5World(START_MS));
    let scenario = formAlliance(world, ROME, STEPPE, START_MS).world;
    const bucharest = 'territory-bucharest';

    scenario = recordConquerorOnTerritoryCapture(scenario, bucharest, ROME, PLAYER);
    scenario = {
      ...scenario,
      territories: {
        ...scenario.territories,
        [bucharest]: { ...scenario.territories[bucharest]!, ownerId: PLAYER },
      },
    };

    const { world: defeated, events } = syncCountriesFromFactions(scenario);
    expect(events.some((e) => e.kind === 'allianceBroken')).toBe(true);
    expect(events.some((e) => e.kind === 'countryDefeated')).toBe(true);
    expect(areAllied(defeated, ROME, STEPPE)).toBe(false);
    expect(
      collectAiOrders(defeated, START_MS).every((order) => {
        if (order.kind !== 'move') return true;
        return defeated.units[order.unitId]?.ownerId !== ROME;
      }),
    ).toBe(true);
  });

  it('tutorial: france defeat cascade is precondition for Beat 2 hook', () => {
    const world = ensureWorldCountries(createTutorialWorld(START_MS));
    const order = tagOrder(
      world,
      {
        kind: 'move',
        unitId: 'unit-britain-infantry',
        toTerritoryId: PARIS_TUTORIAL,
        stanceOnArrival: 'assault',
      },
      PLAYER_TUTORIAL_FACTION_ID,
    );
    const travelMs = previewMoveEtaMs(world, 'unit-britain-infantry', PARIS_TUTORIAL)!.travelMs;
    const result = tick(world, [order], travelMs);

    const defeat = result.events.find((e) => e.kind === 'countryDefeated');
    expect(defeat).toBeDefined();
    expect(result.world.countries![FRANCE]?.defeated).toBe(true);
    expect(dispatchLineForEvent(result.world, defeat!)).toContain('fallen');
    expect(result.events.filter((e) => e.kind === 'allianceBroken')).toHaveLength(0);
  });
});
