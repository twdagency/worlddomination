import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyDefectionClaim,
  applyInfluenceOrders,
  COUP_ATTEMPT_GOLD_COST,
  COUP_ATTEMPT_MANPOWER_COST,
  COUP_INFLUENCE_FLOOR,
  DEFECTION_INFLUENCE_REQUIRED,
  DEFECTION_TARGET_REPUTATION_PENALTY,
  dispatchLineForEvent,
  formAlliance,
  getInfluence,
  stampEvents,
  syncCountriesFromFactions,
  tick,
} from '../src';
import { setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const MS_DAY = 86_400_000;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function defectionWorld(overrides: Partial<WorldState> = {}): WorldState {
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

function withInfluence(
  world: WorldState,
  value: number,
  actorId: string = PLAYER,
  cityId: string = PARIS,
): WorldState {
  return setInfluence(world, cityId, actorId, value, START_MS);
}

function defectionOrder(world: WorldState, ownerId: string = PLAYER, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'defection-claim', ownerId, targetCityId },
    ownerId,
  );
}

function missionOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function culturalOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'cultural-campaign', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

function subversionOrder(world: WorldState, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'influence-subversion', ownerId: PLAYER, targetCityId },
    PLAYER,
  );
}

describe('defection claim (Sprint 9 Phase 7)', () => {
  it('rejects when influence is below 100', () => {
    const world = withInfluence(defectionWorld(), 99);
    const result = applyInfluenceOrders(world, [defectionOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-influence');
  });

  it('rejects when target country is allied', () => {
    const world = withInfluence(formAlliance(defectionWorld(), PLAYER, ROME, START_MS).world, 100);
    const result = applyInfluenceOrders(world, [defectionOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-is-allied');
  });

  it('rejects when target country is defeated', () => {
    const world = withInfluence(
      defectionWorld({
        countries: {
          ...defectionWorld().countries,
          [ROME]: { ...defectionWorld().countries![ROME]!, defeated: true },
        },
      }),
      100,
    );
    const result = applyInfluenceOrders(world, [defectionOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-owner-defeated');
  });

  it('successful defection transfers city ownership', () => {
    const world = withInfluence(defectionWorld(), 100);
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    expect(result.events.some((event) => event.kind === 'territoryCaptured')).toBe(true);
  });

  it('successful defection zeroes actor influence in the city', () => {
    const world = withInfluence(defectionWorld(), 100);
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(0);
  });

  it('successful defection resets other actors influence in the city', () => {
    let world = withInfluence(defectionWorld(), 100);
    world = setInfluence(world, PARIS, STEPPE, 40, START_MS);
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(getInfluence(result.world, PARIS, STEPPE)).toBe(0);
  });

  it('successful defection applies -25 reputation from target country to actor', () => {
    const world = withInfluence(defectionWorld(), 100);
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(DEFECTION_TARGET_REPUTATION_PENALTY);
  });

  it('successful defection does not penalize observer factions', () => {
    const world = withInfluence(defectionWorld(), 100);
    const beforeBritain = world.reputation[BRITAIN]?.[PLAYER] ?? 0;
    const beforeSteppe = world.reputation[STEPPE]?.[PLAYER] ?? 0;
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.reputation[BRITAIN]?.[PLAYER] ?? 0).toBe(beforeBritain);
    expect(result.world.reputation[STEPPE]?.[PLAYER] ?? 0).toBe(beforeSteppe);
  });

  it('defecting the last city triggers defeat cascade on sync', () => {
    let world = withInfluence(defectionWorld(), 100);
    world = {
      ...world,
      territories: {
        [PARIS]: { ...world.territories[PARIS]! },
      },
    };
    const defection = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    const synced = syncCountriesFromFactions(defection.world);
    expect(synced.events.some((event) => event.kind === 'countryDefeated')).toBe(true);
    expect(synced.world.countries![ROME]!.defeated).toBe(true);
  });

  it('is deterministic for identical worlds and orders', () => {
    const world = withInfluence(defectionWorld(), 100);
    const a = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    const b = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(a.events.map((event) => event.kind)).toEqual(b.events.map((event) => event.kind));
    expect(a.world.territories[PARIS]?.ownerId).toBe(b.world.territories[PARIS]?.ownerId);
    expect(a.world.reputation).toEqual(b.world.reputation);
  });

  it('auto-cancels active tribute on ownership change', () => {
    let world = withInfluence(defectionWorld(), 100);
    const tributeStart = applyInfluenceOrders(world, [
      tagOrder(world, { kind: 'tribute-extraction', ownerId: PLAYER, targetCityId: PARIS }, PLAYER),
    ], START_MS);
    world = tributeStart.world;
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    expect(
      result.events.some(
        (event) => event.kind === 'tributeAutoEnded' && event.reason === 'ownership-changed',
      ),
    ).toBe(true);
    expect(result.world.activeTributes ?? []).toHaveLength(0);
  });

  it('emits defectionOccurred with correct fields and public dispatch copy', () => {
    const world = withInfluence(defectionWorld(), 100);
    const result = applyDefectionClaim(world, PLAYER, PARIS, START_MS);
    const defection = result.events.find((event) => event.kind === 'defectionOccurred');
    expect(defection).toMatchObject({
      kind: 'defectionOccurred',
      actorId: PLAYER,
      targetCityId: PARIS,
      targetCountryId: ROME,
      previousLeaderId: 'leader-caesar',
    });
    const stamped = stampEvents(result.world, result.events);
    const event = stamped.events.find((entry) => entry.kind === 'defectionOccurred')!;
    const line = dispatchLineForEvent(stamped.world, event);
    expect(line).toContain('City defected:');
    expect(line).toContain('Caesar');
  });

  it('first defector wins when multiple actors hold 100 influence in the same tick', () => {
    let world = withInfluence(defectionWorld(), 100);
    world = setInfluence(world, PARIS, STEPPE, 100, START_MS);
    const result = applyInfluenceOrders(
      world,
      [defectionOrder(world), defectionOrder(world, STEPPE)],
      START_MS,
    );
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    expect(getInfluence(result.world, PARIS, STEPPE)).toBe(0);
    expect(result.events.filter((event) => event.kind === 'defectionOccurred')).toHaveLength(1);
    const blocked = applyDefectionClaim(result.world, STEPPE, PARIS, START_MS);
    expect(blocked.events).toHaveLength(0);
    expect(blocked.world.territories[PARIS]!.ownerId).toBe(PLAYER);
  });

  it('integration: passive accrual and accelerators reach 100 influence then defection succeeds', () => {
    let world = defectionWorld();
    world = applyInfluenceOrders(world, [missionOrder(world)], START_MS).world;

    for (let day = 1; day <= 100; day++) {
      const orders = [];
      if (day === 15) orders.push(subversionOrder(world));
      if (day === 31 || day === 61) orders.push(culturalOrder(world));
      const stepped = tick(world, orders, MS_DAY);
      world = stepped.world;
    }

    expect(getInfluence(world, PARIS, PLAYER)).toBeGreaterThanOrEqual(DEFECTION_INFLUENCE_REQUIRED);
    const result = applyInfluenceOrders(world, [defectionOrder(world)], world.nowMs);
    expect(result.events.some((event) => event.kind === 'defectionOccurred')).toBe(true);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
  });

  it('integration: defection is costless and deterministic versus coup material cost and risk', () => {
    const atCoupFloor = withInfluence(defectionWorld(), COUP_INFLUENCE_FLOOR);
    const atDefection = withInfluence(defectionWorld(), DEFECTION_INFLUENCE_REQUIRED);

    const defection = applyDefectionClaim(atDefection, PLAYER, PARIS, START_MS);
    expect(defection.events.some((event) => event.kind === 'defectionOccurred')).toBe(true);
    expect(defection.world.factions[PLAYER]!.funding).toBe(50_000);
    expect(defection.world.factions[PLAYER]!.manpower).toBe(100);
    expect(defection.world.territories[PARIS]!.ownerId).toBe(PLAYER);

    const fundingBeforeCoup = atCoupFloor.factions[PLAYER]!.funding;
    const manpowerBeforeCoup = atCoupFloor.factions[PLAYER]!.manpower;
    const coupSpend = applyInfluenceOrders(
      atCoupFloor,
      [
        tagOrder(
          atCoupFloor,
          { kind: 'coup-attempt', ownerId: PLAYER, targetCityId: PARIS },
          PLAYER,
        ),
      ],
      START_MS,
    );
    expect(coupSpend.world.factions[PLAYER]!.funding).toBe(
      fundingBeforeCoup - COUP_ATTEMPT_GOLD_COST,
    );
    expect(coupSpend.world.factions[PLAYER]!.manpower).toBe(
      manpowerBeforeCoup - COUP_ATTEMPT_MANPOWER_COST,
    );
  });

  it('integration: Sprint 4 Paris defection defeats Rome through cascade', () => {
    let world = withInfluence(defectionWorld(), 100);
    world = {
      ...world,
      territories: {
        [PARIS]: { ...world.territories[PARIS]! },
      },
    };
    const { world: afterDefection, events } = tick(world, [defectionOrder(world)], 0);
    expect(events.some((event) => event.kind === 'defectionOccurred')).toBe(true);
    expect(events.some((event) => event.kind === 'countryDefeated')).toBe(true);
    expect(afterDefection.countries![ROME]!.defeated).toBe(true);
  });
});
