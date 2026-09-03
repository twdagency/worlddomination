import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  ANNEXATION_GOLD_COST,
  ANNEXATION_INFLUENCE_FLOOR,
  ANNEXATION_OBSERVER_REPUTATION_PENALTY,
  ANNEXATION_TARGET_REPUTATION_PENALTY,
  applyAnnexationClaim,
  applyInfluenceOrders,
  areAllied,
  canActorIssueInfluenceOrder,
  dispatchLineForEvent,
  formAlliance,
  getInfluence,
  MS_PER_DAY,
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
const LONDON = 'territory-london';
const BERLIN = 'territory-berlin';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function annexationWorld(overrides: Partial<WorldState> = {}): WorldState {
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

function annexationOrder(world: WorldState, ownerId: string = PLAYER, targetCityId: string = PARIS) {
  return tagOrder(
    world,
    { kind: 'annexation-claim', ownerId, targetCityId },
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

describe('annexation claim (Sprint 11 Phase 3)', () => {
  it('rejects when influence is below 70', () => {
    const world = withInfluence(annexationWorld(), 69);
    const result = applyInfluenceOrders(world, [annexationOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-influence');
  });

  it('rejects when gold is below 16000', () => {
    const world = withInfluence(
      annexationWorld({
        factions: {
          ...annexationWorld().factions,
          [PLAYER]: { ...annexationWorld().factions[PLAYER]!, funding: 15_999, manpower: 100, isPlayer: true },
        },
      }),
      ANNEXATION_INFLUENCE_FLOOR,
    );
    const result = applyInfluenceOrders(world, [annexationOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-gold');
  });

  it('rejects when target country is allied', () => {
    const world = withInfluence(
      formAlliance(annexationWorld(), PLAYER, ROME, START_MS).world,
      ANNEXATION_INFLUENCE_FLOOR,
    );
    const result = applyInfluenceOrders(world, [annexationOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-is-allied');
  });

  it('rejects when target country is defeated', () => {
    const world = withInfluence(
      annexationWorld({
        countries: {
          ...annexationWorld().countries,
          [ROME]: { ...annexationWorld().countries![ROME]!, defeated: true },
        },
      }),
      ANNEXATION_INFLUENCE_FLOOR,
    );
    const result = applyInfluenceOrders(world, [annexationOrder(world)], START_MS);
    expect(result.events[0]?.reason).toBe('target-owner-defeated');
  });

  it('rejects annexing own city', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR, PLAYER, LONDON);
    const result = applyInfluenceOrders(world, [annexationOrder(world, PLAYER, LONDON)], START_MS);
    expect(result.events[0]?.reason).toBe('target-is-own-city');
  });

  it('successful annexation transfers city ownership without combat', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const garrisonBefore = world.units['unit-rome-levy']!;
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    const captured = result.events.find((event) => event.kind === 'territoryCaptured');
    expect(captured).toMatchObject({
      kind: 'territoryCaptured',
      territoryId: PARIS,
      previousOwnerId: ROME,
      newOwnerId: PLAYER,
      captureKind: 'annexation',
    });
    expect(result.world.units['unit-rome-levy']).toEqual(garrisonBefore);
  });

  it('successful annexation zeroes all actors influence in the city', () => {
    let world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    world = setInfluence(world, PARIS, STEPPE, 40, START_MS);
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(0);
    expect(getInfluence(result.world, PARIS, STEPPE)).toBe(0);
  });

  it('successful annexation spends 16000 gold and leaves manpower unchanged', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const manpowerBefore = world.factions[PLAYER]!.manpower;
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.factions[PLAYER]!.funding).toBe(50_000 - ANNEXATION_GOLD_COST);
    expect(result.world.factions[PLAYER]!.manpower).toBe(manpowerBefore);
  });

  it('successful annexation applies -40 reputation from the victim and -8 from observers', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const beforeBritain = world.reputation[BRITAIN]?.[PLAYER] ?? 0;
    const beforeSteppe = world.reputation[STEPPE]?.[PLAYER] ?? 0;
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(ANNEXATION_TARGET_REPUTATION_PENALTY);
    expect(result.world.reputation[BRITAIN]![PLAYER]).toBe(
      beforeBritain + ANNEXATION_OBSERVER_REPUTATION_PENALTY,
    );
    expect(result.world.reputation[STEPPE]![PLAYER]).toBe(
      beforeSteppe + ANNEXATION_OBSERVER_REPUTATION_PENALTY,
    );
  });

  it('does not auto-break alliances on annexation', () => {
    const allied = formAlliance(
      formAlliance(annexationWorld(), PLAYER, BRITAIN, START_MS).world,
      ROME,
      BRITAIN,
      START_MS,
    ).world;
    const world = withInfluence(allied, ANNEXATION_INFLUENCE_FLOOR);
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(areAllied(result.world, PLAYER, BRITAIN)).toBe(true);
    expect(areAllied(result.world, ROME, BRITAIN)).toBe(true);
  });

  it('auto-cancels active tribute on ownership change', () => {
    let world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    world = applyInfluenceOrders(
      world,
      [tagOrder(world, { kind: 'tribute-extraction', ownerId: PLAYER, targetCityId: PARIS }, PLAYER)],
      START_MS,
    ).world;
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(
      result.events.some(
        (event) => event.kind === 'tributeAutoEnded' && event.reason === 'ownership-changed',
      ),
    ).toBe(true);
    expect(result.world.activeTributes ?? []).toHaveLength(0);
  });

  it('annexing the last city triggers defeat cascade on sync', () => {
    let world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    world = {
      ...world,
      territories: {
        [PARIS]: { ...world.territories[PARIS]! },
      },
    };
    const annexation = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    const synced = syncCountriesFromFactions(annexation.world);
    expect(synced.events.some((event) => event.kind === 'countryDefeated')).toBe(true);
    expect(synced.world.countries![ROME]!.defeated).toBe(true);
  });

  it('allows annexing a capital that is not the last city', () => {
    let world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const paris = world.territories[PARIS]!;
    world = {
      ...world,
      territories: {
        ...world.territories,
        'territory-rome-holdout': {
          ...paris,
          id: 'territory-rome-holdout',
          name: 'Holdout',
          ownerId: ROME,
        },
      },
    };
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    expect(result.events.some((event) => event.kind === 'annexationCompleted')).toBe(true);
    const synced = syncCountriesFromFactions(result.world);
    expect(synced.world.territories['territory-rome-holdout']!.ownerId).toBe(ROME);
    expect(synced.world.countries![ROME]!.defeated).toBe(false);
    expect(
      synced.events.some((event) => event.kind === 'countryDefeated' && event.countryId === ROME),
    ).toBe(false);
  });

  it('is deterministic for identical worlds and orders', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const a = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    const b = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(a.events.map((event) => event.kind)).toEqual(b.events.map((event) => event.kind));
    expect(a.world.territories[PARIS]?.ownerId).toBe(b.world.territories[PARIS]?.ownerId);
    expect(a.world.reputation).toEqual(b.world.reputation);
    expect(a.world.factions[PLAYER]!.funding).toBe(b.world.factions[PLAYER]!.funding);
  });

  it('emits annexationCompleted with public dispatch copy', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    const annexation = result.events.find((event) => event.kind === 'annexationCompleted');
    expect(annexation).toMatchObject({
      kind: 'annexationCompleted',
      actorId: PLAYER,
      targetCityId: PARIS,
      targetCountryId: ROME,
      previousLeaderId: 'leader-caesar',
    });
    const stamped = stampEvents(result.world, result.events);
    const event = stamped.events.find((entry) => entry.kind === 'annexationCompleted')!;
    const line = dispatchLineForEvent(stamped.world, event);
    expect(line).toContain('ANNEXATION —');
    expect(line).toContain('Paris');
  });

  it('consumes the daily influence channel', () => {
    const world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    const first = applyInfluenceOrders(world, [annexationOrder(world)], START_MS);
    expect(first.events.some((event) => event.kind === 'annexationCompleted')).toBe(true);
    expect(first.world.aiInfluenceCooldowns?.[PLAYER]).toBe(START_MS);
    expect(canActorIssueInfluenceOrder(first.world, PLAYER, START_MS)).toBe(false);

    const second = applyInfluenceOrders(first.world, [missionOrder(first.world, BERLIN)], START_MS);
    expect(second.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(false);
    expect(second.events.find((event) => event.kind === 'orderRejected')?.reason).toBe(
      'influence-channel-on-cooldown',
    );

    const nextDay = applyInfluenceOrders(
      first.world,
      [missionOrder(first.world, BERLIN)],
      START_MS + MS_PER_DAY,
    );
    expect(nextDay.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(true);
  });

  it('integration: Sprint 4 Paris annexation defeats Rome through cascade', () => {
    let world = withInfluence(annexationWorld(), ANNEXATION_INFLUENCE_FLOOR);
    world = {
      ...world,
      territories: {
        [PARIS]: { ...world.territories[PARIS]! },
      },
    };
    const { world: afterAnnexation, events } = tick(world, [annexationOrder(world)], 0);
    expect(events.some((event) => event.kind === 'annexationCompleted')).toBe(true);
    expect(events.some((event) => event.kind === 'countryDefeated')).toBe(true);
    expect(afterAnnexation.countries![ROME]!.defeated).toBe(true);
  });
});
