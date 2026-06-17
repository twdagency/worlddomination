import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
} from '../../shared/src/tutorialConstants';
import { defeatCountry, recordConquerorOnTerritoryCapture } from '../src/country';
import { haversineKm } from '../src/geo';
import {
  accruePassiveInfluence,
  computePassiveInfluenceSources,
  ensureWorldInfluence,
  getInfluence,
  INFLUENCE_ADJACENCY_THRESHOLD_KM,
  INFLUENCE_CAP,
  INFLUENCE_FLOOR,
  setInfluence,
} from '../src/influence';
import { formAlliance, formTreaty } from '../src/diplomacy';
import { ensureWorldMigrations } from '../src/migrations';
import { SCOUT_UNIT_TYPE_ID } from '../src/scout';
import { tick } from '../src/tick';
import type { Id, Territory, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const MS_DAY = 86_400_000;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function minimalWorld(overrides: Partial<WorldState> = {}): WorldState {
  return {
    nowMs: START_MS,
    startMs: START_MS,
    day: 1,
    rng: { seed: 42 },
    territories: {},
    units: {},
    factions: {},
    leaders: {},
    unitTypes: UNIT_TYPES_BY_ID,
    intel: {},
    alliances: [],
    treaties: [],
    reputation: {},
    pendingProposals: [],
    scenarioId: 'test',
    influence: {},
    ...overrides,
  };
}

function city(
  id: Id,
  ownerId: Id,
  lat: number,
  lon: number,
): Territory {
  return {
    id,
    name: id,
    coord: { lat, lon },
    ownerId,
    baseYield: 50,
    infraLevel: 1,
    resources: {},
  };
}

describe('influence passive accumulation (Sprint 9 Phase 1)', () => {
  it('getInfluence returns 0 for cities with no actor influence', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(getInfluence(world, PARIS, PLAYER)).toBe(0);
  });

  it('accrues proximity contribution for adjacent owned cities', () => {
    const world = migrate(createSprint4World(START_MS));
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, PARIS, PLAYER)).toBeGreaterThan(0);
    expect(
      computePassiveInfluenceSources(world, PARIS, PLAYER).some((s) => s.kind === 'proximity'),
    ).toBe(true);
  });

  it('accrues alliance contribution for allied city owners', () => {
    let world = migrate(createSprint4World(START_MS));
    const allied = formAlliance(world, PLAYER, ROME, START_MS).world;
    const after = accruePassiveInfluence(allied, START_MS + MS_DAY);
    const sources = computePassiveInfluenceSources(allied, PARIS, PLAYER, START_MS + MS_DAY);
    expect(sources.some((s) => s.kind === 'alliance' && s.contribution === 2)).toBe(true);
    expect(getInfluence(after, PARIS, PLAYER)).toBeGreaterThan(1);
  });

  it('accrues treaty contribution only for treaty-scoped cities', () => {
    let world = migrate(createSprint4World(START_MS));
    const treaty = formTreaty(world, {
      partyA: PLAYER,
      partyB: STEPPE,
      territoryIds: [BERLIN],
      formedAt: START_MS,
      expiresAt: START_MS + MS_DAY * 30,
    });
    const berlinSources = computePassiveInfluenceSources(treaty, BERLIN, PLAYER, START_MS);
    const parisSources = computePassiveInfluenceSources(treaty, PARIS, PLAYER, START_MS);
    expect(berlinSources.some((s) => s.kind === 'treaty')).toBe(true);
    expect(parisSources.some((s) => s.kind === 'treaty')).toBe(false);
  });

  it('accrues culture contribution when leaders share era and region', () => {
    const world = minimalWorld({
      factions: {
        'faction-a': {
          id: 'faction-a',
          leaderId: 'leader-a',
          isPlayer: true,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
        'faction-b': {
          id: 'faction-b',
          leaderId: 'leader-b',
          isPlayer: false,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
      },
      leaders: {
        'leader-a': {
          id: 'leader-a',
          name: 'A',
          region: 'Gaul',
          era: 'Classical',
          weights: LEADERS_BY_ID['leader-caesar']!.weights,
          traits: {},
          tempo: 'steady',
        },
        'leader-b': {
          id: 'leader-b',
          name: 'B',
          region: 'Gaul',
          era: 'Classical',
          weights: LEADERS_BY_ID['leader-caesar']!.weights,
          traits: {},
          tempo: 'steady',
        },
      },
      territories: {
        'city-a': city('city-a', 'faction-a', 48.0, 2.0),
        'city-b': city('city-b', 'faction-b', 48.1, 2.1),
      },
    });
    const sources = computePassiveInfluenceSources(world, 'city-b', 'faction-a', START_MS);
    expect(sources.some((s) => s.kind === 'culture')).toBe(true);
  });

  it('sums multiple passive sources in accrual', () => {
    let world = migrate(createSprint4World(START_MS));
    world = formAlliance(world, PLAYER, ROME, START_MS).world;
    const rate = computePassiveInfluenceSources(world, PARIS, PLAYER, START_MS).reduce(
      (sum, source) => sum + source.contribution,
      0,
    );
    expect(rate).toBeGreaterThan(2);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, PARIS, PLAYER)).toBeCloseTo(rate, 5);
  });

  it('caps hostile passive accumulation at +1 per day', () => {
    const world = minimalWorld({
      factions: {
        [PLAYER]: {
          id: PLAYER,
          leaderId: 'leader-elizabeth',
          isPlayer: true,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
        [ROME]: {
          id: ROME,
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
      },
      leaders: {
        'leader-elizabeth': LEADERS_BY_ID['leader-elizabeth']!,
        'leader-caesar': LEADERS_BY_ID['leader-caesar']!,
      },
      territories: {
        [LONDON]: city(LONDON, PLAYER, 51.5, -0.1),
        [PARIS]: city(PARIS, ROME, 48.85, 2.35),
      },
      units: {
        'scout-1': {
          id: 'scout-1',
          typeId: SCOUT_UNIT_TYPE_ID,
          ownerId: PLAYER,
          count: 1,
          locationId: PARIS,
          stance: 'hold',
        },
      },
    });
    const rate = computePassiveInfluenceSources(world, PARIS, PLAYER, START_MS).reduce(
      (sum, source) => sum + source.contribution,
      0,
    );
    expect(rate).toBe(1);
  });

  it('applies war reduction when assault dispatches target the owner country', () => {
    const world = minimalWorld({
      factions: {
        [PLAYER]: {
          id: PLAYER,
          leaderId: 'leader-elizabeth',
          isPlayer: true,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
        [ROME]: {
          id: ROME,
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
      },
      leaders: {
        'leader-elizabeth': LEADERS_BY_ID['leader-elizabeth']!,
        'leader-caesar': LEADERS_BY_ID['leader-caesar']!,
      },
      territories: {
        [LONDON]: city(LONDON, PLAYER, 51.5, -0.1),
        [PARIS]: city(PARIS, ROME, 48.85, 2.35),
      },
      units: {
        'attacker-1': {
          id: 'attacker-1',
          typeId: 'infantry-t2',
          ownerId: PLAYER,
          count: 5,
          locationId: LONDON,
          stance: 'hold',
          transit: {
            fromTerritoryId: LONDON,
            toTerritoryId: PARIS,
            departMs: START_MS,
            arriveMs: START_MS + MS_DAY,
            stanceOnArrival: 'assault',
          },
        },
      },
    });
    const sources = computePassiveInfluenceSources(world, PARIS, PLAYER, START_MS);
    expect(sources).toEqual([{ kind: 'proximity', contribution: -2, lastAccrualAt: START_MS }]);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, PARIS, PLAYER)).toBe(-2);
  });

  it('halves contributions when a competitor holds at least 50 influence', () => {
    let world = migrate(createSprint4World(START_MS));
    world = setInfluence(world, PARIS, STEPPE, 55, START_MS);
    const sources = computePassiveInfluenceSources(world, PARIS, PLAYER, START_MS);
    const proximity = sources.find((s) => s.kind === 'proximity');
    expect(proximity?.contribution).toBe(0.5);
  });

  it('does not exceed INFLUENCE_CAP', () => {
    let world = migrate(createSprint4World(START_MS));
    world = formAlliance(world, PLAYER, ROME, START_MS).world;
    const after = accruePassiveInfluence(world, START_MS + MS_DAY * 200);
    expect(getInfluence(after, PARIS, PLAYER)).toBeLessThanOrEqual(INFLUENCE_CAP);
  });

  it('respects INFLUENCE_FLOOR during war pressure', () => {
    let world = minimalWorld({
      factions: {
        [PLAYER]: {
          id: PLAYER,
          leaderId: 'leader-elizabeth',
          isPlayer: true,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
        [ROME]: {
          id: ROME,
          leaderId: 'leader-caesar',
          isPlayer: false,
          funding: 1,
          manpower: 1,
          manpowerCap: 1,
        },
      },
      leaders: {
        'leader-elizabeth': LEADERS_BY_ID['leader-elizabeth']!,
        'leader-caesar': LEADERS_BY_ID['leader-caesar']!,
      },
      territories: {
        [LONDON]: city(LONDON, PLAYER, 51.5, -0.1),
        [PARIS]: city(PARIS, ROME, 48.85, 2.35),
      },
      units: {
        'attacker-1': {
          id: 'attacker-1',
          typeId: 'infantry-t2',
          ownerId: PLAYER,
          count: 5,
          locationId: LONDON,
          stance: 'hold',
          transit: {
            fromTerritoryId: LONDON,
            toTerritoryId: PARIS,
            departMs: START_MS,
            arriveMs: START_MS + MS_DAY * 20,
            stanceOnArrival: 'assault',
          },
        },
      },
    });
    world = setInfluence(world, PARIS, PLAYER, INFLUENCE_FLOOR, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY * 20);
    expect(getInfluence(after, PARIS, PLAYER)).toBeGreaterThanOrEqual(INFLUENCE_FLOOR);
  });

  it('migrates missing influence to an empty store', () => {
    const world = migrate(createSprint4World(START_MS));
    const { influence: _removed, ...without } = world as WorldState & { influence: unknown };
    const legacy = without as WorldState;
    const migrated = ensureWorldMigrations(legacy, {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    expect(migrated.influence).toEqual({});
  });

  it('is deterministic for identical worlds', () => {
    const world = migrate(createSprint4World(START_MS));
    const a = accruePassiveInfluence(world, START_MS + MS_DAY * 5);
    const b = accruePassiveInfluence(world, START_MS + MS_DAY * 5);
    expect(a.influence).toEqual(b.influence);
  });

  it('is idempotent when no sim time advances', () => {
    const world = migrate(createSprint4World(START_MS));
    const once = accruePassiveInfluence(world, START_MS + MS_DAY);
    const twice = accruePassiveInfluence(once, START_MS + MS_DAY);
    expect(twice.influence).toEqual(once.influence);
  });

  it('accrues influence inside tick()', () => {
    const world = migrate(createSprint4World(START_MS));
    const { world: after } = tick(world, [], MS_DAY);
    expect(getInfluence(after, PARIS, PLAYER)).toBeGreaterThan(0);
  });

  it('clears influence on defeated country cities', () => {
    let world = migrate(createSprint4World(START_MS));
    world = setInfluence(world, PARIS, PLAYER, 25, START_MS);
    world = setInfluence(world, PARIS, STEPPE, 10, START_MS);
    world = recordConquerorOnTerritoryCapture(world, PARIS, ROME, PLAYER);
    world = {
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: PLAYER },
      },
    };
    const defeated = defeatCountry(world, ROME, START_MS).world;
    expect(getInfluence(defeated, PARIS, PLAYER)).toBe(0);
    expect(getInfluence(defeated, PARIS, STEPPE)).toBe(0);
    expect(defeated.influence?.[PARIS]).toBeUndefined();
  });

  it('sprint-4: accumulates influence over 30 game-days', () => {
    let world = migrate(createSprint4World(START_MS));
    for (let day = 0; day < 30; day++) {
      world = tick(world, [], MS_DAY).world;
    }
    expect(getInfluence(world, PARIS, PLAYER)).toBeGreaterThan(0);
    expect(getInfluence(world, PARIS, PLAYER)).toBeLessThanOrEqual(INFLUENCE_CAP);
  });

  it('tutorial: player gains passive influence toward Burgundy after extended play', () => {
    let world = migrate(createTutorialWorld(START_MS));
    for (let day = 0; day < 20; day++) {
      world = tick(world, [], MS_DAY).world;
    }
    expect(getInfluence(world, TUTORIAL_BURGUNDY_TERRITORY_ID, PLAYER_TUTORIAL_FACTION_ID)).toBeGreaterThan(
      0,
    );
  });

  it('adjacency: London–Paris is within the influence proximity threshold', () => {
    const world = migrate(createSprint4World(START_MS));
    const london = world.territories[LONDON]!;
    const paris = world.territories[PARIS]!;
    const distance = haversineKm(london.coord, paris.coord);
    expect(distance).toBeLessThan(INFLUENCE_ADJACENCY_THRESHOLD_KM);
    expect(
      computePassiveInfluenceSources(world, PARIS, PLAYER).some((s) => s.kind === 'proximity'),
    ).toBe(true);
  });
});
