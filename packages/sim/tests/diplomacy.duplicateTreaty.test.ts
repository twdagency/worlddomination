import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyInfluenceOrders,
  formTreaty,
  getTreatiesBetween,
  hasActiveTreatyOn,
  playerProposeTreaty,
  scoreTreatyAcceptance,
  TREATY_ACCEPT_THRESHOLD,
} from '../src';
import { DEFAULT_TREATY_DURATION_MS } from '../src/diplomaticDispatch';
import { ensureWorldMigrations } from '../src/migrations';
import {
  addPendingProposal,
  deterministicProposalId,
  proposalExpiresAt,
} from '../src/pendingProposals';
import { tagOrder } from './fixtures';
import type { PendingProposal, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const GENGHIS = 'faction-steppe';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';
const DURATION = DEFAULT_TREATY_DURATION_MS;

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function activeTreatyWorld(at: number = START_MS): WorldState {
  const base = migrate(createSprint4World(at));
  return formTreaty(base, {
    partyA: PLAYER,
    partyB: GENGHIS,
    territoryIds: [BERLIN],
    formedAt: at,
    expiresAt: at + DURATION,
  });
}

function treatyProposal(
  from: string = PLAYER,
  to: string = GENGHIS,
  territoryId: string = BERLIN,
  at: number = START_MS,
): PendingProposal {
  return {
    id: deterministicProposalId(from, to, at, 'treaty', territoryId),
    from,
    to,
    type: 'treaty',
    scope: { territoryIds: [territoryId] },
    durationMs: DURATION,
    proposedAt: at,
    expiresAt: proposalExpiresAt(at),
  };
}

function pressureOrder(world: WorldState, territoryId: string = BERLIN) {
  return tagOrder(
    world,
    {
      kind: 'diplomatic-pressure',
      ownerId: PLAYER,
      targetCityId: territoryId,
      targetCountryId: GENGHIS,
      proposalKind: 'accept-treaty',
    },
    PLAYER,
  );
}

describe('duplicate treaty guard', () => {
  it('hasActiveTreatyOn returns true for an active treaty', () => {
    const world = activeTreatyWorld();
    expect(hasActiveTreatyOn(world, PLAYER, GENGHIS, BERLIN, START_MS)).toBe(true);
  });

  it('hasActiveTreatyOn returns false for an expired treaty', () => {
    const world = activeTreatyWorld();
    expect(hasActiveTreatyOn(world, PLAYER, GENGHIS, BERLIN, START_MS + DURATION)).toBe(false);
  });

  it('hasActiveTreatyOn returns false for a treaty on a different territory', () => {
    const world = activeTreatyWorld();
    expect(hasActiveTreatyOn(world, PLAYER, GENGHIS, PARIS, START_MS)).toBe(false);
  });

  it('hasActiveTreatyOn is order-independent for party arguments', () => {
    const world = activeTreatyWorld();
    expect(hasActiveTreatyOn(world, GENGHIS, PLAYER, BERLIN, START_MS)).toBe(true);
  });

  it('playerProposeTreaty silently skips when an active treaty exists', () => {
    const world = activeTreatyWorld();
    expect(scoreTreatyAcceptance(world, GENGHIS, PLAYER, BERLIN)).toBeGreaterThanOrEqual(
      TREATY_ACCEPT_THRESHOLD,
    );

    const result = playerProposeTreaty(world, PLAYER, GENGHIS, BERLIN, START_MS + 3_600_000);
    expect(result.events).toHaveLength(0);
    expect(getTreatiesBetween(result.world, PLAYER, GENGHIS)).toHaveLength(1);
  });

  it('formTreaty rejects overlapping scope even at a different formedAt', () => {
    const world = activeTreatyWorld();
    const next = formTreaty(world, {
      partyA: PLAYER,
      partyB: GENGHIS,
      territoryIds: [BERLIN],
      formedAt: START_MS + 3_600_000,
      expiresAt: START_MS + 3_600_000 + DURATION,
    });
    expect(next.treaties).toHaveLength(1);
  });

  it('applyDiplomaticPressure rejects treaty pressure on an already-covered city', () => {
    let world = activeTreatyWorld();
    world = addPendingProposal(world, treatyProposal());
    world = {
      ...world,
      influence: {
        ...world.influence,
        [BERLIN]: {
          value: 40,
          lastAccrualAt: START_MS,
          lastDecayAt: START_MS,
          sources: [],
        },
      },
    };

    const result = applyInfluenceOrders(world, [pressureOrder(world)], START_MS);
    expect(result.events.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(result.events.some((event) => event.kind === 'treatyFormed')).toBe(false);
    expect(getTreatiesBetween(result.world, PLAYER, GENGHIS)).toHaveLength(1);
  });
});
