import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyInfluenceOrders,
  areAllied,
  DIPLOMATIC_PRESSURE_ALLY_OF_TARGET_REPUTATION_PENALTY,
  DIPLOMATIC_PRESSURE_COST,
  DIPLOMATIC_PRESSURE_INFLUENCE_COST,
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
  DIPLOMATIC_PRESSURE_OBSERVER_REPUTATION_PENALTY,
  DIPLOMATIC_PRESSURE_TARGET_REPUTATION_PENALTY,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  getInfluence,
  playerProposeAlliance,
  stampEvents,
  tick,
} from '../src';
import { formAlliance } from '../src/diplomacy';
import { DEFAULT_TREATY_DURATION_MS } from '../src/diplomaticDispatch';
import { setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import {
  addPendingProposal,
  deterministicProposalId,
  proposalExpiresAt,
} from '../src/pendingProposals';
import { tagOrder } from './fixtures';
import type { PendingProposal, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function pressureWorld(overrides: Partial<WorldState> = {}): WorldState {
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

function allianceProposal(
  world: WorldState,
  from: string = PLAYER,
  to: string = ROME,
  at: number = START_MS,
): PendingProposal {
  return {
    id: deterministicProposalId(from, to, at, 'alliance'),
    from,
    to,
    type: 'alliance',
    proposedAt: at,
    expiresAt: proposalExpiresAt(at),
  };
}

function treatyProposal(
  world: WorldState,
  from: string = PLAYER,
  to: string = ROME,
  territoryId: string = PARIS,
  at: number = START_MS,
): PendingProposal {
  return {
    id: deterministicProposalId(from, to, at, 'treaty', territoryId),
    from,
    to,
    type: 'treaty',
    scope: { territoryIds: [territoryId] },
    durationMs: DEFAULT_TREATY_DURATION_MS,
    proposedAt: at,
    expiresAt: proposalExpiresAt(at),
  };
}

function pressureOrder(
  world: WorldState,
  proposalKind: 'accept-alliance' | 'accept-treaty' = 'accept-alliance',
  targetCityId: string = PARIS,
  targetCountryId: string = ROME,
) {
  return tagOrder(
    world,
    {
      kind: 'diplomatic-pressure',
      ownerId: PLAYER,
      targetCityId,
      targetCountryId,
      proposalKind,
    },
    PLAYER,
  );
}

function withAllianceProposal(world: WorldState): WorldState {
  return addPendingProposal(world, allianceProposal(world));
}

function withInfluence(world: WorldState, value: number, cityId: string = PARIS): WorldState {
  return setInfluence(world, cityId, PLAYER, value, START_MS);
}

describe('diplomatic pressure (Sprint 9 Phase 4)', () => {
  it('rejects when influence is below 30', () => {
    let world = withAllianceProposal(pressureWorld());
    world = withInfluence(world, 29);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-influence');
    expect(areAllied(result.world, PLAYER, ROME)).toBe(false);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(29);
  });

  it('rejects when gold is insufficient', () => {
    let world = withAllianceProposal(
      pressureWorld({
        factions: {
          ...pressureWorld().factions,
          [PLAYER]: { ...pressureWorld().factions[PLAYER]!, funding: DIPLOMATIC_PRESSURE_COST - 1 },
        },
      }),
    );
    world = withInfluence(world, 35);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('insufficient-gold');
  });

  it('rejects when no matching pending proposal exists', () => {
    const world = withInfluence(pressureWorld(), 35);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('no-pending-proposal');
  });

  it('rejects when target country is allied', () => {
    let world = withAllianceProposal(formAlliance(pressureWorld(), PLAYER, ROME, START_MS).world);
    world = withInfluence(world, 35);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('target-is-allied');
  });

  it('rejects when target country is defeated', () => {
    let world = withAllianceProposal(
      pressureWorld({
        countries: {
          ...pressureWorld().countries,
          [ROME]: { ...pressureWorld().countries![ROME]!, defeated: true },
        },
      }),
    );
    world = withInfluence(world, 35);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events[0]?.kind).toBe('orderRejected');
    expect(result.events[0]?.reason).toBe('target-owner-defeated');
  });

  it('forces alliance acceptance and emits diplomaticPressureApplied', () => {
    let world = withAllianceProposal(pressureWorld());
    world = withInfluence(world, 35);
    const beforeGold = world.factions[PLAYER]!.funding;
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events.some((event) => event.kind === 'diplomaticPressureApplied')).toBe(true);
    expect(result.events.some((event) => event.kind === 'allianceFormed')).toBe(true);
    expect(areAllied(result.world, PLAYER, ROME)).toBe(true);
    expect(result.world.pendingProposals).toHaveLength(0);
    expect(result.world.factions[PLAYER]!.funding).toBe(beforeGold - DIPLOMATIC_PRESSURE_COST);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(15);
  });

  it('forces treaty acceptance for a pending treaty proposal', () => {
    let world = addPendingProposal(pressureWorld(), treatyProposal(pressureWorld()));
    world = withInfluence(world, 40);
    const result = applyInfluenceOrders(
      world,
      [pressureOrder(world, 'accept-treaty')],
      START_MS,
    );
    expect(result.events.some((event) => event.kind === 'diplomaticPressureApplied')).toBe(true);
    expect(result.events.some((event) => event.kind === 'treatyFormed')).toBe(true);
    expect(
      result.world.treaties.some(
        (treaty) =>
          treaty.parties.includes(PLAYER) &&
          treaty.parties.includes(ROME) &&
          treaty.scope.territoryIds.includes(PARIS),
      ),
    ).toBe(true);
  });

  it('deducts gold and influence costs on success', () => {
    let world = withAllianceProposal(pressureWorld());
    world = withInfluence(world, 30);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(
      DIPLOMATIC_PRESSURE_MIN_INFLUENCE - DIPLOMATIC_PRESSURE_INFLUENCE_COST,
    );
    expect(result.world.factions[PLAYER]!.funding).toBe(50_000 - DIPLOMATIC_PRESSURE_COST);
  });

  it('applies reputation cascade to target, observers, and target allies', () => {
    let world = withAllianceProposal(formAlliance(pressureWorld(), ROME, STEPPE, START_MS).world);
    world = withInfluence(world, 45);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    const pressure = result.events.find((event) => event.kind === 'diplomaticPressureApplied');
    expect(pressure?.reputationDeltas[ROME]).toBe(DIPLOMATIC_PRESSURE_TARGET_REPUTATION_PENALTY);
    expect(pressure?.reputationDeltas[BRITAIN]).toBe(DIPLOMATIC_PRESSURE_OBSERVER_REPUTATION_PENALTY);
    expect(pressure?.reputationDeltas[STEPPE]).toBe(
      DIPLOMATIC_PRESSURE_OBSERVER_REPUTATION_PENALTY +
        DIPLOMATIC_PRESSURE_ALLY_OF_TARGET_REPUTATION_PENALTY,
    );
    expect(result.world.reputation[ROME]![PLAYER]).toBe(DIPLOMATIC_PRESSURE_TARGET_REPUTATION_PENALTY);
    expect(result.world.reputation[STEPPE]![PLAYER]).toBe(-15);
  });

  it('forces only the matching proposal when alliance and treaty are both pending', () => {
    let world = pressureWorld();
    world = addPendingProposal(world, allianceProposal(world));
    world = addPendingProposal(world, treatyProposal(world, PLAYER, ROME, PARIS));
    world = withInfluence(world, 50);
    const result = applyInfluenceOrders(
      world,
      [pressureOrder(world, 'accept-treaty', PARIS)],
      START_MS,
    );
    expect(result.events.some((event) => event.kind === 'treatyFormed')).toBe(true);
    expect(areAllied(result.world, PLAYER, ROME)).toBe(false);
    expect(result.world.pendingProposals.some((proposal) => proposal.type === 'alliance')).toBe(true);
    expect(result.world.pendingProposals.some((proposal) => proposal.type === 'treaty')).toBe(false);
  });

  it('is deterministic for identical worlds and orders', () => {
    let world = withAllianceProposal(pressureWorld());
    world = withInfluence(world, 35);
    const order = pressureOrder(world);
    const a = applyInfluenceOrders(world, [order], START_MS);
    const b = applyInfluenceOrders(world, [order], START_MS);
    expect(a.world.alliances).toEqual(b.world.alliances);
    expect(a.world.reputation).toEqual(b.world.reputation);
    expect(a.world.influence).toEqual(b.world.influence);
    expect(a.events.map((event) => event.kind)).toEqual(b.events.map((event) => event.kind));
  });

  it('integration: propose, reject, accumulate influence, then pressure forms alliance', () => {
    let world = pressureWorld();
    const proposed = playerProposeAlliance(world, PLAYER, ROME, START_MS);
    world = proposed.world;
    expect(proposed.events.some((event) => event.kind === 'allianceDeclined')).toBe(true);
    expect(areAllied(world, PLAYER, ROME)).toBe(false);

    world = addPendingProposal(world, allianceProposal(world));
    world = withInfluence(world, 35);
    const pressured = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(pressured.events.some((event) => event.kind === 'allianceFormed')).toBe(true);
    expect(areAllied(pressured.world, PLAYER, ROME)).toBe(true);
  });

  it('integration: reputation cascade dispatch is visible to observers and target allies', () => {
    let world = withAllianceProposal(formAlliance(pressureWorld(), ROME, STEPPE, START_MS).world);
    world = withInfluence(world, 40);
    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    const stamped = stampEvents(result.world, result.events);
    const pressure = stamped.events.find((event) => event.kind === 'diplomaticPressureApplied')!;
    const line = dispatchLineForEvent(stamped.world, pressure);
    expect(line).toContain('DIPLOMATIC PRESSURE');
    expect(line).toContain('alliance');
    expect(
      filterDispatchesForFaction(stamped.world, stamped.events, BRITAIN).some(
        (event) => event.kind === 'diplomaticPressureApplied',
      ),
    ).toBe(true);
    expect(
      filterDispatchesForFaction(stamped.world, stamped.events, STEPPE).some(
        (event) => event.kind === 'diplomaticPressureApplied',
      ),
    ).toBe(true);
  });

  it('runs diplomatic pressure inside tick()', () => {
    let world = withAllianceProposal(pressureWorld());
    world = withInfluence(world, 35);
    const { world: after, events } = tick(world, [pressureOrder(world)], 0);
    expect(events.some((event) => event.kind === 'diplomaticPressureApplied')).toBe(true);
    expect(areAllied(after, PLAYER, ROME)).toBe(true);
  });

  it('allows pressure via any city in the target country with sufficient local influence', () => {
    let world = pressureWorld();
    world = addPendingProposal(world, allianceProposal(world));
    world = setInfluence(world, BERLIN, PLAYER, 0, START_MS);
    world = setInfluence(world, PARIS, PLAYER, 35, START_MS);
    const result = applyInfluenceOrders(
      world,
      [pressureOrder(world, 'accept-alliance', PARIS, ROME)],
      START_MS,
    );
    expect(areAllied(result.world, PLAYER, ROME)).toBe(true);
    expect(getInfluence(result.world, PARIS, PLAYER)).toBe(15);
    expect(getInfluence(result.world, BERLIN, PLAYER)).toBe(0);
  });
});
