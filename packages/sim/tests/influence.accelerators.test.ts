import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyInfluenceOrders,
  CULTURAL_CAMPAIGN_BURST,
  CULTURAL_CAMPAIGN_COOLDOWN_MS,
  CULTURAL_CAMPAIGN_COST,
  DIPLOMATIC_MISSION_COST,
  DIPLOMATIC_MISSION_DURATION_MS,
  expireActiveInfluenceEffects,
  getInfluence,
  INFLUENCE_SUBVERSION_BURST,
  INFLUENCE_SUBVERSION_COST,
  INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS,
  INFLUENCE_SUBVERSION_REPUTATION_PENALTY,
  tick,
} from '../src';
import { formAlliance } from '../src/diplomacy';
import { ensureWorldMigrations } from '../src/migrations';
import { accruePassiveInfluence, setInfluence } from '../src/influence';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const PARIS_ID = 'territory-paris';
const LONDON_ID = 'territory-london';
const UNIT = 'unit-player-mg';
const MS_DAY = 86_400_000;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function influenceWorld(overrides: Partial<WorldState> = {}): WorldState {
  const base = migrate(createSprint4World(START_MS));
  return {
    ...base,
    factions: {
      ...base.factions,
      [PLAYER]: {
        ...base.factions[PLAYER]!,
        funding: 50_000,
        manpower: 100,
        isPlayer: true,
      },
    },
    ...overrides,
  };
}

function missionOrder(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId: PARIS_ID },
    PLAYER,
  );
}

function campaignOrder(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'cultural-campaign', ownerId: PLAYER, targetCityId: PARIS_ID },
    PLAYER,
  );
}

function subversionOrder(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'influence-subversion', ownerId: PLAYER, targetCityId: PARIS_ID },
    PLAYER,
  );
}

function worldThatDiscoversSubversion(): WorldState {
  for (let seed = 0; seed < 500; seed++) {
    const world = influenceWorld({ rng: { seed } });
    const result = applyInfluenceOrders(world, [subversionOrder(world)], START_MS);
    if (result.events.some((event) => event.kind === 'subversionDiscovered')) {
      return world;
    }
  }
  throw new Error('no discovering seed found');
}

describe('influence accelerators (Sprint 9 Phase 2)', () => {
  it('diplomatic mission deducts cost and adds active mission', () => {
    const world = influenceWorld();
    const before = world.factions[PLAYER]!.funding;
    const result = applyInfluenceOrders(world, [missionOrder(world)], START_MS);
    expect(result.world.factions[PLAYER]!.funding).toBe(before - DIPLOMATIC_MISSION_COST);
    expect(result.world.activeDiplomaticMissions).toHaveLength(1);
    expect(result.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(true);
  });

  it('diplomatic mission doubles passive accumulation for the target city', () => {
    const world = influenceWorld();
    const withMission = applyInfluenceOrders(world, [missionOrder(world)], START_MS).world;
    const passiveOnly = accruePassiveInfluence(world, START_MS + MS_DAY);
    const passiveWithMission = accruePassiveInfluence(withMission, START_MS + MS_DAY);
    expect(getInfluence(passiveWithMission, PARIS_ID, PLAYER)).toBeGreaterThan(
      getInfluence(passiveOnly, PARIS_ID, PLAYER),
    );
  });

  it('diplomatic mission expires after 14 game-days', () => {
    let world = applyInfluenceOrders(influenceWorld(), [missionOrder(influenceWorld())], START_MS).world;
    const expired = expireActiveInfluenceEffects(world, START_MS + DIPLOMATIC_MISSION_DURATION_MS);
    expect(expired.world.activeDiplomaticMissions).toHaveLength(0);
    expect(expired.events.some((event) => event.kind === 'diplomaticMissionExpired')).toBe(true);
  });

  it('diplomatic mission is expelled when war is declared against the target country', () => {
    let world = applyInfluenceOrders(influenceWorld(), [missionOrder(influenceWorld())], START_MS).world;
    world = {
      ...world,
      units: {
        ...world.units,
        [UNIT]: {
          ...world.units[UNIT]!,
          transit: {
            fromTerritoryId: LONDON_ID,
            toTerritoryId: PARIS_ID,
            departMs: START_MS,
            arriveMs: START_MS + MS_DAY,
            stanceOnArrival: 'assault',
          },
        },
      },
    };
    const expelled = expireActiveInfluenceEffects(world, START_MS);
    expect(expelled.world.activeDiplomaticMissions).toHaveLength(0);
    expect(expelled.events[0]?.kind).toBe('diplomaticMissionExpelled');
  });

  it('cannot stack diplomatic missions for the same actor and city', () => {
    const world = influenceWorld();
    const first = applyInfluenceOrders(world, [missionOrder(world)], START_MS);
    const second = applyInfluenceOrders(first.world, [missionOrder(first.world)], START_MS);
    expect(second.world.activeDiplomaticMissions).toHaveLength(1);
    expect(second.events.some((event) => event.kind === 'orderRejected')).toBe(true);
  });

  it('cultural campaign deducts cost and applies burst influence', () => {
    const world = influenceWorld();
    const before = world.factions[PLAYER]!.funding;
    const result = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    expect(result.world.factions[PLAYER]!.funding).toBe(before - CULTURAL_CAMPAIGN_COST);
    expect(getInfluence(result.world, PARIS_ID, PLAYER)).toBe(CULTURAL_CAMPAIGN_BURST);
    expect(result.events.some((event) => event.kind === 'culturalCampaignApplied')).toBe(true);
  });

  it('cultural campaign cooldown blocks a second campaign within 30 days', () => {
    const world = influenceWorld();
    const first = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    const second = applyInfluenceOrders(first.world, [campaignOrder(first.world)], START_MS + MS_DAY);
    expect(second.events.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(getInfluence(second.world, PARIS_ID, PLAYER)).toBe(CULTURAL_CAMPAIGN_BURST);
  });

  it('cultural campaign is allowed after cooldown elapses', () => {
    const world = influenceWorld();
    const first = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    const afterCooldown = applyInfluenceOrders(
      first.world,
      [campaignOrder(first.world)],
      START_MS + CULTURAL_CAMPAIGN_COOLDOWN_MS,
    );
    expect(afterCooldown.events.some((event) => event.kind === 'orderRejected')).toBe(false);
    expect(getInfluence(afterCooldown.world, PARIS_ID, PLAYER)).toBe(CULTURAL_CAMPAIGN_BURST * 2);
  });

  it('subversion deducts gold and manpower and applies burst influence', () => {
    const world = influenceWorld();
    const beforeGold = world.factions[PLAYER]!.funding;
    const beforeManpower = world.factions[PLAYER]!.manpower;
    const result = applyInfluenceOrders(world, [subversionOrder(world)], START_MS);
    expect(result.world.factions[PLAYER]!.funding).toBe(beforeGold - INFLUENCE_SUBVERSION_COST);
    expect(result.world.factions[PLAYER]!.manpower).toBe(beforeManpower - 1);
    expect(getInfluence(result.world, PARIS_ID, PLAYER)).toBe(INFLUENCE_SUBVERSION_BURST);
  });

  it('subversion discovery is deterministic for the same rng seed', () => {
    const world = influenceWorld({ rng: { seed: 99_001 } });
    const order = subversionOrder(world);
    const first = applyInfluenceOrders(world, [order], START_MS);
    const second = applyInfluenceOrders(world, [order], START_MS);
    const discovered = (result: typeof first) =>
      result.events.some((event) => event.kind === 'subversionDiscovered');
    expect(discovered(first)).toBe(discovered(second));
  });

  it('subversion discovery applies reputation penalty to the target country', () => {
    const world = worldThatDiscoversSubversion();
    const result = applyInfluenceOrders(world, [subversionOrder(world)], START_MS);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(INFLUENCE_SUBVERSION_REPUTATION_PENALTY);
  });

  it('subversion discovery applies bold bonus to actor allies', () => {
    let world = worldThatDiscoversSubversion();
    world = formAlliance(world, PLAYER, STEPPE, START_MS).world;
    const result = applyInfluenceOrders(world, [subversionOrder(world)], START_MS);
    expect(result.world.reputation[STEPPE]![PLAYER]).toBe(INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS);
  });

  it('rejects influence orders with insufficient gold', () => {
    const world = influenceWorld({
      factions: {
        ...influenceWorld().factions,
        [PLAYER]: { ...influenceWorld().factions[PLAYER]!, funding: 0 },
      },
    });
    const result = applyInfluenceOrders(world, [missionOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
  });

  it('rejects influence orders against allied territory', () => {
    let world = influenceWorld();
    world = formAlliance(world, PLAYER, ROME, START_MS).world;
    const result = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
  });

  it('rejects influence orders when the current owner is defeated', () => {
    const world = influenceWorld({
      countries: {
        ...influenceWorld().countries,
        [ROME]: { ...influenceWorld().countries![ROME]!, defeated: true },
      },
    });
    const result = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
  });

  it('clips cultural campaign burst at the influence cap', () => {
    const world = setInfluence(influenceWorld(), PARIS_ID, PLAYER, 95, START_MS);
    const result = applyInfluenceOrders(world, [campaignOrder(world)], START_MS);
    expect(getInfluence(result.world, PARIS_ID, PLAYER)).toBe(100);
    expect(result.events.find((event) => event.kind === 'culturalCampaignApplied')?.influenceDelta).toBe(5);
  });

  it('issues all three accelerators in one tick', () => {
    const world = influenceWorld();
    const result = tick(
      world,
      [missionOrder(world), campaignOrder(world), subversionOrder(world)],
      0,
    );
    expect(result.world.activeDiplomaticMissions).toHaveLength(1);
    expect(getInfluence(result.world, PARIS_ID, PLAYER)).toBe(
      CULTURAL_CAMPAIGN_BURST + INFLUENCE_SUBVERSION_BURST,
    );
  });

  it('stacks accelerators on the same target with passive accrual under the cap', () => {
    const world = influenceWorld();
    const burst = applyInfluenceOrders(
      world,
      [campaignOrder(world), subversionOrder(world)],
      START_MS,
    ).world;
    const afterMission = applyInfluenceOrders(burst, [missionOrder(burst)], START_MS).world;
    const afterPassive = accruePassiveInfluence(afterMission, START_MS + MS_DAY);
    expect(getInfluence(afterPassive, PARIS_ID, PLAYER)).toBeLessThanOrEqual(100);
    expect(getInfluence(afterPassive, PARIS_ID, PLAYER)).toBeGreaterThan(25);
  });

  it('war declaration mid-mission expels missions targeting that country', () => {
    const world = influenceWorld();
    const assault = tagOrder(
      world,
      {
        kind: 'move',
        unitId: UNIT,
        toTerritoryId: PARIS_ID,
        stanceOnArrival: 'assault',
      },
      PLAYER,
    );
    const result = tick(world, [missionOrder(world), assault], 0);
    expect(result.world.activeDiplomaticMissions ?? []).toHaveLength(0);
    expect(result.events.some((event) => event.kind === 'diplomaticMissionExpelled')).toBe(true);
  });

  it('migrates missing accelerator fields to empty arrays', () => {
    const world = migrate(createSprint4World(START_MS));
    const { activeDiplomaticMissions: _a, culturalCampaigns: _c, ...legacy } = world;
    const migrated = ensureWorldMigrations(legacy as WorldState, {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    expect(migrated.activeDiplomaticMissions).toEqual([]);
    expect(migrated.culturalCampaigns).toEqual([]);
  });
});
