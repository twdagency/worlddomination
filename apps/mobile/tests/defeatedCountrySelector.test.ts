import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import {
  dispatchLineForEvent,
  ensureWorldMigrations,
  recordConquerorOnTerritoryCapture,
  stampEvents,
  syncCountriesFromFactions,
} from 'sim';
import {
  formatDefeatedTerritoryLine,
  selectDefeatedCountries,
  selectDefeatedCountryById,
  selectDefeatedWorldTerritories,
} from '../src/game/defeatedCountrySelector';

const START_MS = 1_700_600_000_000;
const PARIS = 'territory-paris';
const ROME = 'faction-rome';
const BRITAIN = 'faction-britain';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function defeatRome(world = migrate(createSprint4World(START_MS))) {
  const allied = {
    ...world,
    alliances: [{ factionA: BRITAIN, factionB: ROME, formedAt: START_MS }],
  };
  return syncCountriesFromFactions({
    ...recordConquerorOnTerritoryCapture(allied, PARIS, ROME, BRITAIN),
    territories: {
      ...allied.territories,
      [PARIS]: { ...allied.territories[PARIS]!, ownerId: BRITAIN },
    },
  });
}

describe('defeatedCountrySelector', () => {
  it('returns defeated countries with historical conqueror and final territory', () => {
    const { world } = defeatRome();
    const defeated = selectDefeatedCountries(world);

    expect(defeated).toHaveLength(1);
    expect(defeated[0]).toMatchObject({
      id: ROME,
      name: 'Rome',
      defeatedBy: BRITAIN,
      defeatedByName: 'Spain',
      finalTerritoryId: PARIS,
      finalTerritoryName: 'Paris',
      formerAlliances: [{ id: BRITAIN, name: 'Spain' }],
    });
  });

  it('selectDefeatedCountryById resolves a single entry', () => {
    const { world } = defeatRome();
    expect(selectDefeatedCountryById(world, ROME)?.leaderName).toBeTruthy();
    expect(selectDefeatedCountryById(world, 'faction-player')).toBeNull();
  });

  it('returns an empty array when no countries are defeated', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(selectDefeatedCountries(world)).toEqual([]);
  });

  it('preserves historical dispatch lines mentioning defeated countries', () => {
    const { world, events } = defeatRome();
    const defeat = events.find((event) => event.kind === 'countryDefeated');
    expect(defeat).toBeTruthy();
    const stamped = stampEvents(world, [defeat!]).events[0]!;
    const line = dispatchLineForEvent(world, stamped);
    expect(line).toContain('Rome');
    expect(line.toLowerCase()).toContain('fallen');
  });

  it('formats conquered territory annotations for the defeated world filter', () => {
    const { world } = defeatRome();
    const rows = selectDefeatedWorldTerritories(world);
    expect(rows).toHaveLength(1);
    expect(formatDefeatedTerritoryLine(rows[0]!)).toBe(
      'Paris — Spain (conquered from Rome)',
    );
  });
});
