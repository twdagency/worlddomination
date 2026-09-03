import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyInfluenceOrders,
  CULTURAL_CAMPAIGN_BURST,
  expireActiveInfluenceEffects,
  INFLUENCE_SUBVERSION_BURST,
  tick,
} from '../src';
import { defeatCountry, recordConquerorOnTerritoryCapture } from '../src/country';
import {
  accruePassiveInfluence,
  computeInfluenceDecay,
  computePassiveInfluenceSources,
  getInfluence,
  INFLUENCE_CAP,
  INFLUENCE_DECAY_PER_DAY,
  setInfluence,
} from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { tagOrder } from './fixtures';
import type { Id, Territory, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const REMOTE = 'territory-remote';
const TARGET = 'territory-target';
const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function city(id: Id, ownerId: Id, lat: number, lon: number): Territory {
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

/** Actor and target cities with no passive influence sources between them. */
function isolatedInfluenceWorld(overrides: Partial<WorldState> = {}): WorldState {
  return migrate({
    nowMs: START_MS,
    startMs: START_MS,
    day: 1,
    rng: { seed: 42 },
    territories: {
      [REMOTE]: city(REMOTE, PLAYER, -33.87, 151.21),
      [TARGET]: city(TARGET, ROME, 64.15, -21.95),
    },
    units: {},
    factions: {
      [PLAYER]: {
        id: PLAYER,
        leaderId: 'leader-elizabeth',
        isPlayer: true,
        funding: 50_000,
        manpower: 100,
        manpowerCap: 100,
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
    unitTypes: UNIT_TYPES_BY_ID,
    intel: {},
    alliances: [],
    treaties: [],
    reputation: {},
    pendingProposals: [],
    scenarioId: 'test',
    influence: {},
    activeDiplomaticMissions: [],
    culturalCampaigns: [],
    ...overrides,
  });
}

function campaignOrder(world: WorldState, targetCityId = TARGET) {
  return tagOrder(
    world,
    { kind: 'cultural-campaign', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function subversionOrder(world: WorldState, targetCityId = TARGET) {
  return tagOrder(
    world,
    { kind: 'influence-subversion', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function missionOrder(world: WorldState, targetCityId = TARGET) {
  return tagOrder(
    world,
    { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

describe('influence decay (Sprint 9 Phase 3)', () => {
  it('exports INFLUENCE_DECAY_PER_DAY = 1', () => {
    expect(INFLUENCE_DECAY_PER_DAY).toBe(1);
  });

  it('decays positive influence 1/day toward 0 when no passive sources exist', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 30, START_MS);
    expect(computePassiveInfluenceSources(world, TARGET, PLAYER).length).toBe(0);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(29);
    expect(computeInfluenceDecay(after, TARGET, PLAYER)).toBe(INFLUENCE_DECAY_PER_DAY);
  });

  it('recovers negative influence 1/day toward 0 when no passive sources exist', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, -10, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(-9);
  });

  it('does not decay influence already at 0', () => {
    const world = isolatedInfluenceWorld();
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(0);
    expect(computeInfluenceDecay(after, TARGET, PLAYER)).toBe(0);
  });

  it('does not decay when a proximity passive source is active', () => {
    let world = migrate(createSprint4World(START_MS));
    world = setInfluence(world, PARIS, PLAYER, 30, START_MS);
    const afterOne = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(afterOne, PARIS, PLAYER)).toBeGreaterThan(30);
    expect(computeInfluenceDecay(afterOne, PARIS, PLAYER)).toBe(0);
  });

  it('does not decay when an active diplomatic mission exists', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 25, START_MS);
    world = applyInfluenceOrders(world, [missionOrder(world)], START_MS).world;
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(25);
    expect(computeInfluenceDecay(after, TARGET, PLAYER)).toBe(0);
  });

  it('decays cultural campaign burst when no ongoing source remains', () => {
    let world = isolatedInfluenceWorld();
    world = applyInfluenceOrders(world, [campaignOrder(world)], START_MS).world;
    expect(getInfluence(world, TARGET, PLAYER)).toBe(CULTURAL_CAMPAIGN_BURST);
    const after30 = accruePassiveInfluence(world, START_MS + MS_DAY * 30);
    expect(getInfluence(after30, TARGET, PLAYER)).toBe(0);
  });

  it('decays subversion burst at 1/day without suppressing from cooldown state', () => {
    let world = isolatedInfluenceWorld();
    world = applyInfluenceOrders(world, [subversionOrder(world)], START_MS).world;
    expect(getInfluence(world, TARGET, PLAYER)).toBe(INFLUENCE_SUBVERSION_BURST);
    const after5 = accruePassiveInfluence(world, START_MS + MS_DAY * 5);
    expect(getInfluence(after5, TARGET, PLAYER)).toBe(INFLUENCE_SUBVERSION_BURST - 5);
  });

  it('recovers war-induced negative influence after assault ends', () => {
    const world = isolatedInfluenceWorld({
      units: {
        'attacker-1': {
          id: 'attacker-1',
          typeId: 'infantry-t2',
          ownerId: PLAYER,
          count: 5,
          locationId: REMOTE,
          stance: 'hold',
          transit: {
            fromTerritoryId: REMOTE,
            toTerritoryId: TARGET,
            departMs: START_MS,
            arriveMs: START_MS + MS_DAY * 5,
            stanceOnArrival: 'assault',
          },
        },
      },
    });
    const duringWar = accruePassiveInfluence(world, START_MS + MS_DAY * 5);
    expect(getInfluence(duringWar, TARGET, PLAYER)).toBe(-10);

    const peace = {
      ...duringWar,
      units: {
        ...duringWar.units,
        'attacker-1': { ...duringWar.units['attacker-1']!, transit: undefined },
      },
    };
    const recovered = accruePassiveInfluence(peace, START_MS + MS_DAY * 10);
    expect(getInfluence(recovered, TARGET, PLAYER)).toBe(-5);
  });

  it('decay floor: positive influence cannot drop below 0 via decay alone', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 3, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY * 10);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(0);
  });

  it('applies fractional decay proportional to elapsed sim time', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 10, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_HOUR * 6);
    expect(getInfluence(after, TARGET, PLAYER)).toBeCloseTo(9.75, 5);
  });

  it('is deterministic for identical worlds and elapsed time', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 42, START_MS);
    const at = START_MS + MS_DAY * 7;
    const a = accruePassiveInfluence(world, at);
    const b = accruePassiveInfluence(world, at);
    expect(a.influence).toEqual(b.influence);
  });

  it('decay begins immediately after diplomatic mission expulsion', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 20, START_MS);
    world = applyInfluenceOrders(world, [missionOrder(world)], START_MS).world;
    world = {
      ...world,
      units: {
        ...world.units,
        'attacker-1': {
          id: 'attacker-1',
          typeId: 'infantry-t2',
          ownerId: PLAYER,
          count: 5,
          locationId: REMOTE,
          stance: 'hold',
          transit: {
            fromTerritoryId: REMOTE,
            toTerritoryId: TARGET,
            departMs: START_MS,
            arriveMs: START_MS + MS_DAY,
            stanceOnArrival: 'assault',
          },
        },
      },
    };
    const expelled = expireActiveInfluenceEffects(world, START_MS);
    expect(expelled.world.activeDiplomaticMissions).toHaveLength(0);
    const peace = { ...expelled.world, units: {} };
    const after = accruePassiveInfluence(peace, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(19);
  });

  it('integration: accelerator burst to 50 decays to 0 over 50 game-days without maintenance', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 50, START_MS);
    for (let day = 1; day <= 50; day++) {
      world = accruePassiveInfluence(world, START_MS + MS_DAY * day);
    }
    expect(getInfluence(world, TARGET, PLAYER)).toBe(0);
  });

  it('integration: proximity city holds while unsourced city decays independently', () => {
    let world = migrate(createSprint4World(START_MS));
    world = setInfluence(world, PARIS, PLAYER, 40, START_MS);
    world = setInfluence(world, BERLIN, PLAYER, 40, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, PARIS, PLAYER)).toBeGreaterThan(40);
    expect(getInfluence(after, BERLIN, PLAYER)).toBe(39);
  });

  it('integration: post-defection zero influence does not decay further', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 100, START_MS);
    world = setInfluence(world, TARGET, PLAYER, 0, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY * 5);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(0);
  });

  it('integration: defeated country cleared influence stays at 0 through decay pass', () => {
    let world = migrate(createSprint4World(START_MS));
    world = setInfluence(world, PARIS, PLAYER, 25, START_MS);
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
    const after = accruePassiveInfluence(defeated, START_MS + MS_DAY * 5);
    expect(getInfluence(after, PARIS, PLAYER)).toBe(0);
  });

  it('decay at cap only moves away from INFLUENCE_CAP, never toward it', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, INFLUENCE_CAP, START_MS);
    const after = accruePassiveInfluence(world, START_MS + MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(INFLUENCE_CAP - INFLUENCE_DECAY_PER_DAY);
  });

  it('decay runs inside tick() passive accrual step', () => {
    let world = isolatedInfluenceWorld();
    world = setInfluence(world, TARGET, PLAYER, 15, START_MS);
    const { world: after } = tick(world, [], MS_DAY);
    expect(getInfluence(after, TARGET, PLAYER)).toBe(14);
  });
});
