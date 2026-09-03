import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  ANNEXATION_OBSERVER_REPUTATION_PENALTY,
  ANNEXATION_TARGET_REPUTATION_PENALTY,
  applyAnnexationClaim,
  applyInfluenceOrders,
  backfillLegacyDispatchEventIds,
  canActorIssueInfluenceOrder,
  ensureWorldMigrations,
  filterDispatchesForCountry,
  filterDispatchesForFaction,
  setInfluence,
} from '../src';
import { playerFactionId } from '../src/playerIdentity';
import { migrateLegacyCountryIdFields } from '../src/eventCountryId';
import { tagOrder } from './fixtures';
import type { SimEvent, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('sprint-11 contracts', () => {
  it('Phase 1: player country identity is a dispatch-free leaf', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS));
    expect(playerFactionId(world)).toBe(PLAYER);
  });

  it('Phase 2: legacy dispatch events with factionId migrate to countryId and remain filterable', () => {
    const world = ensureWorldMigrations(createSprint4World(START_MS));
    const legacy = {
      kind: 'orderRejected',
      at: START_MS,
      factionId: PLAYER,
      reason: 'Cannot issue assault on own territory.',
      importance: 'medium',
    };
    const [migrated] = backfillLegacyDispatchEventIds([legacy as unknown as SimEvent]);
    expect(migrated).toMatchObject({ kind: 'orderRejected', countryId: PLAYER });
    expect('factionId' in migrated).toBe(false);
    expect(migrated.eventId).toBe('legacy-0');
    expect(filterDispatchesForCountry(world, [migrated], PLAYER)).toEqual([migrated]);
    expect(filterDispatchesForFaction(world, [migrated], PLAYER)).toEqual([migrated]);
  });

  it('Phase 2: pending dilemmas with factionId migrate to countryId on world load', () => {
    const base = ensureWorldMigrations(createSprint4World(START_MS));
    const migrated = ensureWorldMigrations({
      ...base,
      pendingDilemmas: [
        { dilemmaId: 'foreign-rule', factionId: PLAYER, offeredAt: START_MS } as never,
      ],
    });
    expect(migrated.pendingDilemmas).toEqual([
      { dilemmaId: 'foreign-rule', countryId: PLAYER, offeredAt: START_MS },
    ]);
    expect(migrateLegacyCountryIdFields({ kind: 'victory', at: START_MS, countryId: PLAYER })).toEqual({
      kind: 'victory',
      at: START_MS,
      countryId: PLAYER,
    });
  });

  it('Phase 3: Annexation at 70+ influence transfers ownership peacefully, consumes the daily influence channel, and applies reputation cascade', () => {
    const base = migrate(createSprint4World(START_MS));
    const world = setInfluence(
      {
        ...base,
        aiInfluenceAgencySuppressed: true,
        factions: {
          ...base.factions,
          [PLAYER]: { ...base.factions[PLAYER]!, funding: 50_000, manpower: 100, isPlayer: true },
        },
      },
      PARIS,
      PLAYER,
      70,
      START_MS,
    );
    const beforeBritain = world.reputation[BRITAIN]?.[PLAYER] ?? 0;
    const beforeSteppe = world.reputation[STEPPE]?.[PLAYER] ?? 0;
    const result = applyAnnexationClaim(world, PLAYER, PARIS, START_MS);
    expect(result.world.territories[PARIS]!.ownerId).toBe(PLAYER);
    expect(result.events.some((event) => event.kind === 'annexationCompleted')).toBe(true);
    expect(result.world.reputation[ROME]![PLAYER]).toBe(ANNEXATION_TARGET_REPUTATION_PENALTY);
    expect(result.world.reputation[BRITAIN]?.[PLAYER]).toBe(
      beforeBritain + ANNEXATION_OBSERVER_REPUTATION_PENALTY,
    );
    expect(result.world.reputation[STEPPE]?.[PLAYER]).toBe(
      beforeSteppe + ANNEXATION_OBSERVER_REPUTATION_PENALTY,
    );

    const applied = applyInfluenceOrders(
      world,
      [tagOrder(world, { kind: 'annexation-claim', ownerId: PLAYER, targetCityId: PARIS }, PLAYER)],
      START_MS,
    );
    expect(canActorIssueInfluenceOrder(applied.world, PLAYER, START_MS)).toBe(false);
  });
});
