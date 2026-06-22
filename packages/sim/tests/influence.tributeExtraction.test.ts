import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  accrueTributes,
  applyInfluenceOrders,
  defeatCountry,
  DIPLOMATIC_MISSION_COST,
  findActiveTribute,
  getInfluence,
  incomePerHour,
  recordConquerorOnTerritoryCapture,
  tick,
  TRIBUTE_EXTRACTION_COST,
  TRIBUTE_INFLUENCE_DRAIN_PER_DAY,
  TRIBUTE_INFLUENCE_FLOOR,
  TRIBUTE_MAJOR_REBELLION_OBSERVER_REPUTATION_PENALTY,
  TRIBUTE_MAJOR_REBELLION_TARGET_REPUTATION_PENALTY,
  TRIBUTE_RESENTMENT_GROWTH_PER_DAY,
  TRIBUTE_RESENTMENT_MAJOR_REBELLION,
  TRIBUTE_RESENTMENT_MINOR_REBELLION,
} from '../src';
import { MS_PER_DAY, MS_PER_HOUR } from '../src/constants';
import { formAlliance } from '../src/diplomacy';
import { setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';
const MS_DAY = MS_PER_DAY;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function tributeWorld(overrides: Partial<WorldState> = {}): WorldState {
  const base = migrate(createSprint4World(START_MS));
  return {
    ...base,
    aiInfluenceAgencySuppressed: true,
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

function withInfluence(world: WorldState, value: number, cityId: string = PARIS): WorldState {
  return setInfluence(world, cityId, PLAYER, value, START_MS);
}

function tributeStartOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'tribute-extraction', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function tributeCancelOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'tribute-cancel', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function missionOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function startTribute(world: WorldState, cityId: string = PARIS) {
  return applyInfluenceOrders(world, [tributeStartOrder(world, cityId)], START_MS);
}

describe('tribute extraction (Sprint 9 Phase 5)', () => {
  it('rejects when influence is below 50', () => {
    let world = withInfluence(tributeWorld(), 49);
    const result = applyInfluenceOrders(world, [tributeStartOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-influence');
    expect(world.activeTributes ?? []).toHaveLength(0);
  });

  it('rejects when gold is insufficient', () => {
    let world = withInfluence(
      tributeWorld({
        factions: {
          ...tributeWorld().factions,
          [PLAYER]: { ...tributeWorld().factions[PLAYER]!, funding: TRIBUTE_EXTRACTION_COST - 1 },
        },
      }),
      55,
    );
    const result = applyInfluenceOrders(world, [tributeStartOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-gold');
  });

  it('rejects when a tribute is already active on the city', () => {
    let world = withInfluence(tributeWorld(), 55);
    world = startTribute(world).world;
    const result = applyInfluenceOrders(world, [tributeStartOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('tribute-already-active');
  });

  it('creates ActiveTribute and deducts setup cost on success', () => {
    let world = withInfluence(tributeWorld(), 55);
    const beforeGold = world.factions[PLAYER]!.funding;
    const result = startTribute(world);
    expect(result.events.some((event) => event.kind === 'tributeStarted')).toBe(true);
    expect(result.world.activeTributes).toHaveLength(1);
    expect(findActiveTribute(result.world, PLAYER, PARIS)?.resentment).toBe(0);
    expect(result.world.factions[PLAYER]!.funding).toBe(beforeGold - TRIBUTE_EXTRACTION_COST);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(55);
  });

  it('transfers gold and food on accrual', () => {
    let world = withInfluence(tributeWorld(), 55);
    const started = startTribute(world);
    world = {
      ...started.world,
      territories: {
        ...started.world.territories,
        [PARIS]: {
          ...started.world.territories[PARIS]!,
          extraction: { food: 10 },
          resources: { food: 100 },
        },
      },
    };
    const beforeActorGold = world.factions[PLAYER]!.funding;
    const beforeTargetGold = world.factions[ROME]!.funding;
    const accrued = accrueTributes(world, START_MS + MS_DAY);
    const tribute = findActiveTribute(accrued.world, PLAYER, PARIS)!;
    const paris = world.territories[PARIS]!;
    const leader = world.leaders[world.factions[ROME]!.leaderId]!;
    const dailyGold =
      incomePerHour(paris, leader.traits.incomeMult ?? 1) * (MS_PER_DAY / MS_PER_HOUR) * 0.25;
    expect(tribute.totalGoldExtracted).toBeCloseTo(dailyGold, 4);
    expect(accrued.world.factions[PLAYER]!.funding).toBeGreaterThan(beforeActorGold);
    expect(accrued.world.factions[ROME]!.funding).toBeLessThan(beforeTargetGold);
    expect(tribute.totalResourceExtracted.food).toBeGreaterThan(0);
    expect(accrued.events.some((event) => event.kind === 'tributeAccrued')).toBe(true);
  });

  it('drains influence by 1 per game-day', () => {
    let world = withInfluence(startTribute(withInfluence(tributeWorld(), 55)).world, 55);
    const after = accrueTributes(world, START_MS + MS_DAY);
    expect(getInfluence(after.world, PARIS, PLAYER)).toBe(55 - TRIBUTE_INFLUENCE_DRAIN_PER_DAY);
  });

  it('grows resentment at 2 per day without events below minor threshold', () => {
    let world = startTribute(withInfluence(tributeWorld(), 65)).world;
    const after = accrueTributes(world, START_MS + MS_DAY * 10);
    const tribute = findActiveTribute(after.world, PLAYER, PARIS)!;
    expect(tribute.resentment).toBe(TRIBUTE_RESENTMENT_GROWTH_PER_DAY * 10);
    expect(after.events.some((event) => event.kind === 'tributeMinorRebellion')).toBe(false);
  });

  it('emits minor rebellion when resentment reaches 40', () => {
    let world = startTribute(withInfluence(tributeWorld(), 75)).world;
    const after = accrueTributes(world, START_MS + MS_DAY * 20);
    expect(after.events.some((event) => event.kind === 'tributeMinorRebellion')).toBe(true);
    expect(findActiveTribute(after.world, PLAYER, PARIS)?.minorRebellionEmitted).toBe(true);
  });

  it('emits major rebellion at resentment 80 and ends tribute', () => {
    let world = startTribute(withInfluence(tributeWorld(), 80)).world;
    const after = accrueTributes(world, START_MS + MS_DAY * 40);
    expect(after.events.some((event) => event.kind === 'tributeMajorRebellion')).toBe(true);
    expect(findActiveTribute(after.world, PLAYER, PARIS)).toBeUndefined();
    expect(getInfluence(after.world, PARIS, PLAYER)).toBe(0);
    expect(after.world.reputation[ROME]![PLAYER]).toBe(
      TRIBUTE_MAJOR_REBELLION_TARGET_REPUTATION_PENALTY,
    );
    expect(after.world.reputation[STEPPE]![PLAYER]).toBe(
      TRIBUTE_MAJOR_REBELLION_OBSERVER_REPUTATION_PENALTY,
    );
  });

  it('auto-ends when influence drops below 50', () => {
    let world = startTribute(withInfluence(tributeWorld(), 52)).world;
    const after = accrueTributes(world, START_MS + MS_DAY * 3);
    expect(findActiveTribute(after.world, PLAYER, PARIS)).toBeUndefined();
    const ended = after.events.find((event) => event.kind === 'tributeAutoEnded');
    expect(ended?.reason).toBe('influence-floor');
  });

  it('auto-ends when target country is defeated', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    world = recordConquerorOnTerritoryCapture(world, PARIS, ROME, PLAYER);
    world = {
      ...world,
      territories: {
        ...world.territories,
        [PARIS]: { ...world.territories[PARIS]!, ownerId: PLAYER },
      },
    };
    const defeated = defeatCountry(world, ROME, START_MS + MS_DAY).world;
    expect(defeated.activeTributes ?? []).toHaveLength(0);
  });

  it('voluntarily cancels without reputation penalty', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    const beforeRep = world.reputation[ROME]?.[PLAYER] ?? 0;
    const cancelled = applyInfluenceOrders(world, [tributeCancelOrder(world)], START_MS + MS_DAY);
    expect(cancelled.events.some((event) => event.kind === 'tributeVoluntarilyEnded')).toBe(true);
    expect(findActiveTribute(cancelled.world, PLAYER, PARIS)).toBeUndefined();
    expect(cancelled.world.reputation[ROME]?.[PLAYER] ?? 0).toBe(beforeRep);
  });

  it('is deterministic for identical worlds and ticks', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    const at = START_MS + MS_DAY * 5;
    const a = accrueTributes(world, at);
    const b = accrueTributes(world, at);
    expect(a.world.activeTributes).toEqual(b.world.activeTributes);
    expect(a.events.map((event) => event.kind)).toEqual(b.events.map((event) => event.kind));
  });

  it('allows simultaneous tributes on multiple cities', () => {
    let world = withInfluence(tributeWorld(), 55, PARIS);
    world = withInfluence(world, 55, BERLIN);
    world = applyInfluenceOrders(
      world,
      [tributeStartOrder(world, PARIS), tributeStartOrder(world, BERLIN)],
      START_MS,
    ).world;
    expect(world.activeTributes).toHaveLength(2);
  });

  it('integration: 50-day campaign reaches major rebellion organically', () => {
    let world = startTribute(withInfluence(tributeWorld(), 90)).world;
    let events: string[] = [];
    for (let day = 1; day <= 50; day++) {
      const step = tick(world, [], MS_DAY);
      world = step.world;
      events.push(...step.events.map((event) => event.kind));
    }
    expect(events).toContain('tributeMinorRebellion');
    expect(events).toContain('tributeMajorRebellion');
    expect(world.activeTributes ?? []).toHaveLength(0);
  });

  it('integration: diplomatic mission offsets tribute drain for net-stable influence', () => {
    let world = withInfluence(tributeWorld(), 70);
    world = applyInfluenceOrders(
      world,
      [tributeStartOrder(world), missionOrder(world)],
      START_MS,
    ).world;
    expect(world.factions[PLAYER]!.funding).toBe(50_000 - TRIBUTE_EXTRACTION_COST - DIPLOMATIC_MISSION_COST);
    const after = accrueTributes(world, START_MS + MS_DAY);
    expect(getInfluence(after.world, PARIS, PLAYER)).toBeGreaterThanOrEqual(TRIBUTE_INFLUENCE_FLOOR);
  });

  it('integration: voluntary cancel before minor rebellion allows restart', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    world = accrueTributes(world, START_MS + MS_DAY * 10).world;
    world = applyInfluenceOrders(world, [tributeCancelOrder(world)], START_MS + MS_DAY * 10).world;
    expect(findActiveTribute(world, PLAYER, PARIS)).toBeUndefined();
    const restarted = startTribute(withInfluence(world, 55));
    expect(restarted.events.some((event) => event.kind === 'tributeStarted')).toBe(true);
    expect(findActiveTribute(restarted.world, PLAYER, PARIS)?.resentment).toBe(0);
  });

  it('auto-ends when actor allies with target mid-tribute', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    world = formAlliance(world, PLAYER, ROME, START_MS + MS_DAY).world;
    const after = accrueTributes(world, START_MS + MS_DAY * 2);
    expect(after.events.some((event) => event.kind === 'tributeAutoEnded')).toBe(true);
    expect(
      after.events.find((event) => event.kind === 'tributeAutoEnded')?.reason,
    ).toBe('alliance-formed');
  });

  it('runs tribute accrual inside tick at step 5d', () => {
    let world = startTribute(withInfluence(tributeWorld(), 60)).world;
    const { events } = tick(world, [], MS_DAY);
    expect(events.some((event) => event.kind === 'tributeAccrued')).toBe(true);
  });
});
