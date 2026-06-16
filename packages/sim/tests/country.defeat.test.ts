import { describe, expect, it } from 'vitest';
import { resolvePlayerFactionId } from 'shared';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  isCountryDefeated,
  recordConquerorOnTerritoryCapture,
  relocateCapitalIfNeeded,
  selectNewCapital,
  syncCountriesFromFactions,
} from '../src/country';
import { dispatchLineForEvent, isDispatchVisibleToFaction } from '../src/dispatch';
import { ensureWorldMigrations } from '../src/migrations';
import { stampEvents } from '../src/events';
import type { Id, Territory, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const LONDON = 'territory-london';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function extraCity(id: Id, ownerId: Id, infraLevel: number, name = id): Territory {
  return {
    id,
    name,
    coord: { lat: 48, lon: 2 },
    ownerId,
    baseYield: 50,
    infraLevel,
    resources: {},
  };
}

function withExtraTerritories(
  world: WorldState,
  extras: Record<Id, Territory>,
): WorldState {
  return { ...world, territories: { ...world.territories, ...extras } };
}

function captureCity(
  world: WorldState,
  territoryId: Id,
  previousOwnerId: Id,
  newOwnerId: Id,
): WorldState {
  const withConqueror = recordConquerorOnTerritoryCapture(
    world,
    territoryId,
    previousOwnerId,
    newOwnerId,
  );
  return {
    ...withConqueror,
    territories: {
      ...withConqueror.territories,
      [territoryId]: {
        ...withConqueror.territories[territoryId]!,
        ownerId: newOwnerId,
      },
    },
  };
}

describe('country defeat and capital relocation (Phase 2)', () => {
  it('marks a one-city country defeated and emits countryDefeated', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, PARIS, ROME, PLAYER);
    const { world, events } = syncCountriesFromFactions(afterCapture);

    expect(isCountryDefeated(world, ROME)).toBe(true);
    expect(world.countries![ROME]?.defeated).toBe(true);
    expect(events.filter((e) => e.kind === 'countryDefeated')).toHaveLength(1);
    expect(events.some((e) => e.kind === 'capitalRelocated')).toBe(false);
  });

  it('relocates capital to the highest-infra remaining city when capital falls', () => {
    const base = withExtraTerritories(migrate(createSprint4World(START_MS)), {
      'territory-lyon-rome': extraCity('territory-lyon-rome', ROME, 3, 'Lyon'),
      'territory-marseille-rome': extraCity('territory-marseille-rome', ROME, 1, 'Marseille'),
    });
    const afterCapture = captureCity(base, PARIS, ROME, BRITAIN);
    const { world, events } = syncCountriesFromFactions(afterCapture);

    expect(world.countries![ROME]?.defeated).toBe(false);
    expect(world.countries![ROME]?.capitalTerritoryId).toBe('territory-lyon-rome');
    expect(events).toMatchObject([
      {
        kind: 'capitalRelocated',
        countryId: ROME,
        oldCapitalTerritoryId: PARIS,
        newCapitalTerritoryId: 'territory-lyon-rome',
      },
    ]);
  });

  it('does not relocate or defeat when a non-capital city is captured', () => {
    const base = withExtraTerritories(migrate(createSprint4World(START_MS)), {
      'territory-lyon-rome': extraCity('territory-lyon-rome', ROME, 2, 'Lyon'),
    });
    const afterCapture = captureCity(base, 'territory-lyon-rome', ROME, BRITAIN);
    const { world, events } = syncCountriesFromFactions(afterCapture);

    expect(world.countries![ROME]?.capitalTerritoryId).toBe(PARIS);
    expect(world.countries![ROME]?.defeated).toBe(false);
    expect(events).toHaveLength(0);
  });

  it('relocates but does not defeat when one of two cities remains after capital loss', () => {
    const base = withExtraTerritories(migrate(createSprint4World(START_MS)), {
      'territory-lyon-rome': extraCity('territory-lyon-rome', ROME, 2, 'Lyon'),
    });
    const afterCapture = captureCity(base, PARIS, ROME, PLAYER);
    const { world, events } = syncCountriesFromFactions(afterCapture);

    expect(world.countries![ROME]?.defeated).toBe(false);
    expect(world.countries![ROME]?.capitalTerritoryId).toBe('territory-lyon-rome');
    expect(events.some((e) => e.kind === 'capitalRelocated')).toBe(true);
    expect(events.some((e) => e.kind === 'countryDefeated')).toBe(false);
  });

  it('emits only defeat when the captured capital was the last city', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, PARIS, ROME, BRITAIN);
    const { events } = syncCountriesFromFactions(afterCapture);

    expect(events.map((e) => e.kind)).toEqual(['countryDefeated']);
  });

  it('populates defeatedBy from lastConquerorId recorded at capture time', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, PARIS, ROME, BRITAIN);
    expect(afterCapture.countries![ROME]?.lastConquerorId).toBe(BRITAIN);

    const { events } = syncCountriesFromFactions(afterCapture);
    const defeat = events.find((e) => e.kind === 'countryDefeated');
    expect(defeat).toMatchObject({
      kind: 'countryDefeated',
      countryId: ROME,
      defeatedBy: BRITAIN,
      finalTerritoryId: PARIS,
    });
  });

  it('breaks infraLevel ties on capital selection using lexicographic territory ID', () => {
    const cities = [
      extraCity('territory-zulu', ROME, 2),
      extraCity('territory-alpha', ROME, 2),
    ];
    expect(selectNewCapital(cities).id).toBe('territory-alpha');
  });

  it('does not re-emit defeat for an already-defeated country', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, PARIS, ROME, PLAYER);
    const first = syncCountriesFromFactions(afterCapture);
    const second = syncCountriesFromFactions(first.world);

    expect(second.events.filter((e) => e.kind === 'countryDefeated')).toHaveLength(0);
  });

  it('marks landless countries defeated on migration without emitting transition events', () => {
    const base = createSprint4World(START_MS);
    const world = {
      ...base,
      factions: {
        ...base.factions,
        'faction-landless': {
          id: 'faction-landless',
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 0,
          manpower: 0,
          manpowerCap: 0,
        },
      },
    };
    const migrated = migrate(world);
    const { events } = syncCountriesFromFactions(migrated);

    expect(migrated.countries!['faction-landless']?.defeated).toBe(true);
    expect(events.filter((e) => e.kind === 'countryDefeated')).toHaveLength(0);
  });

  it('relocates on intermediate losses and defeats only when the final city falls', () => {
    let world = withExtraTerritories(migrate(createSprint4World(START_MS)), {
      'territory-lyon-rome': extraCity('territory-lyon-rome', ROME, 2, 'Lyon'),
      'territory-marseille-rome': extraCity('territory-marseille-rome', ROME, 1, 'Marseille'),
    });

    world = captureCity(world, PARIS, ROME, BRITAIN);
    const first = syncCountriesFromFactions(world);
    expect(first.events.some((e) => e.kind === 'capitalRelocated')).toBe(true);
    expect(first.events.some((e) => e.kind === 'countryDefeated')).toBe(false);

    world = captureCity(first.world, 'territory-marseille-rome', ROME, PLAYER);
    const second = syncCountriesFromFactions(world);
    expect(second.events).toHaveLength(0);

    world = captureCity(second.world, 'territory-lyon-rome', ROME, STEPPE);
    const third = syncCountriesFromFactions(world);
    expect(third.events.map((e) => e.kind)).toEqual(['countryDefeated']);
    expect(third.world.countries![ROME]?.defeated).toBe(true);
  });

  it('defeats two countries in one sync with deterministic country ID ordering', () => {
    let world = migrate(createSprint4World(START_MS));
    world = captureCity(world, PARIS, ROME, BRITAIN);
    world = captureCity(world, BERLIN, STEPPE, PLAYER);
    const { events } = syncCountriesFromFactions(world);

    const defeats = events.filter((e) => e.kind === 'countryDefeated');
    expect(defeats).toHaveLength(2);
    expect(defeats.map((e) => e.countryId)).toEqual([ROME, STEPPE]);
  });

  it('ignores self-capture when recording lastConquerorId', () => {
    const world = migrate(createSprint4World(START_MS));
    const before = world.countries![ROME]?.lastConquerorId;
    const after = recordConquerorOnTerritoryCapture(world, PARIS, ROME, ROME);
    expect(after.countries![ROME]?.lastConquerorId).toBe(before);
    expect(after.countries![ROME]?.lastLostTerritoryId).toBeUndefined();
  });

  it('keeps resolvePlayerFactionId stable when the player country is defeated', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, LONDON, PLAYER, ROME);
    const { world } = syncCountriesFromFactions(afterCapture);

    expect(world.countries![PLAYER]?.defeated).toBe(true);
    expect(resolvePlayerFactionId(world)).toBe(PLAYER);
    expect(world.factions[PLAYER]?.isPlayer).toBe(true);
  });

  it('relocateCapitalIfNeeded moves capital when the designated capital is lost', () => {
    const base = withExtraTerritories(migrate(createSprint4World(START_MS)), {
      'territory-lyon-rome': extraCity('territory-lyon-rome', ROME, 3, 'Lyon'),
    });
    const afterCapture = captureCity(base, PARIS, ROME, BRITAIN);
    const relocated = relocateCapitalIfNeeded(afterCapture, ROME);
    expect(relocated.countries![ROME]?.capitalTerritoryId).toBe('territory-lyon-rome');
  });

  it('formats defeat and relocation dispatch lines as public events', () => {
    const base = migrate(createSprint4World(START_MS));
    const afterCapture = captureCity(base, PARIS, ROME, BRITAIN);
    const { world, events } = syncCountriesFromFactions(afterCapture);
    const stamped = stampEvents(world, events);

    const defeat = stamped.events.find((e) => e.kind === 'countryDefeated')!;
    expect(dispatchLineForEvent(stamped.world, defeat)).toContain('fallen');
    expect(isDispatchVisibleToFaction(stamped.world, defeat, PLAYER)).toBe(true);
    expect(isDispatchVisibleToFaction(stamped.world, defeat, ROME)).toBe(true);
  });
});

describe('country defeat (Phase 3 contract)', () => {
  it.todo('dissolves alliances involving the defeated country');
  it.todo('expires active treaties involving the defeated country');
  it.todo('excludes defeated country from collectAiOrders');
});
