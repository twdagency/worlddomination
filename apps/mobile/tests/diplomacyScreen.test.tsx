import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, resolvePlayerFactionId, UNIT_TYPES_BY_ID } from 'shared';
import { dispatchLineForEvent, ensureWorldMigrations, formAlliance } from 'sim';
import { formatDiplomacyCountryTitle, selectDiplomacyTargets } from '../src/game/countrySelector';
import { diplomacyTargetFactionIds } from '../src/game/diplomacySelector';

const START_MS = 1_700_000_000_000;

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('DiplomacyScreen country integration', () => {
  it('lists active countries with country name as primary identifier', () => {
    const world = migrate(createSprint4World(START_MS));
    const targets = selectDiplomacyTargets(world);

    expect(targets.map((country) => formatDiplomacyCountryTitle(country))).toContain(
      'Rome — led by Caesar',
    );
    expect(targets.every((country) => country.name.length > 0)).toBe(true);
  });

  it('excludes the player from diplomacy targets', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;

    expect(diplomacyTargetFactionIds(world)).not.toContain(playerId);
    expect(selectDiplomacyTargets(world).some((country) => country.id === playerId)).toBe(false);
  });

  it('keeps alliance partners visible with country-led labels', () => {
    const world = migrate(createSprint4World(START_MS));
    const playerId = resolvePlayerFactionId(world)!;
    const allied = formAlliance(world, playerId, 'faction-steppe', START_MS).world;
    const genghis = selectDiplomacyTargets(allied).find((country) => country.id === 'faction-steppe');

    expect(genghis).toBeDefined();
    expect(formatDiplomacyCountryTitle(genghis!)).toBe('Steppe — led by Genghis');
  });
});

describe('dispatch country events', () => {
  it('formats countryDefeated and capitalRelocated for the mobile feed', () => {
    const world = migrate(createSprint4World(START_MS));
    const defeatLine = dispatchLineForEvent(world, {
      kind: 'countryDefeated',
      at: START_MS,
      eventId: 'evt-defeat',
      countryId: 'faction-rome',
      defeatedBy: 'faction-player',
      finalTerritoryId: 'territory-paris',
    });
    const relocateLine = dispatchLineForEvent(world, {
      kind: 'capitalRelocated',
      at: START_MS,
      eventId: 'evt-relocate',
      countryId: 'faction-rome',
      oldCapitalTerritoryId: 'territory-paris',
      newCapitalTerritoryId: 'territory-lyon',
    });

    expect(defeatLine).toContain('fallen');
    expect(defeatLine).toContain('Paris');
    expect(relocateLine).toContain('relocated');
  });

  it('resolves defeated country names in historical alliance dispatch lines', () => {
    const world = migrate(createSprint4World(START_MS));
    const line = dispatchLineForEvent(world, {
      kind: 'allianceFormed',
      at: START_MS,
      eventId: 'evt-alliance',
      parties: ['faction-rome', 'faction-steppe'],
      initiatingFaction: 'faction-rome',
      beatId: 'beat',
      decisionTickMs: START_MS,
    });

    expect(line).toContain('Caesar');
    expect(line).toContain('Genghis');
  });
});
