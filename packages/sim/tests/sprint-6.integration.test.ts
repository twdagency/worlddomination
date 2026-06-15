/**
 * Sprint 6 Phase 7 — integration cold-plays and exit validation.
 *
 * Exit checklist (Sprint 6 diplomacy):
 * [x] Alliance/treaty/reputation state (Phase 0–1)
 * [x] Allied + treaty intel emission (Phase 2)
 * [x] AI diplomatic heuristics (Phase 4b)
 * [x] Transit-aware scout scoring (Phase 4c)
 * [x] Dispatch integration for diplomacy + intel sources (Phase 5)
 * [x] Player diplomacy + pending proposals (Phase 6)
 * [x] Fog parity extended for alliance/treaty intel (Phase 7)
 * [x] intel.forwardcompat.test.ts unchanged
 * [x] Perf baseline updated
 */
import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  areAllied,
  diplomaticRelationshipStatus,
  playerAcceptProposal,
  playerBreakAlliance,
  playerProposeAlliance,
  playerFactionId,
  reputationCategory,
  renderDigestText,
  resolveEventImportance,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import type { SimEvent, WorldState } from '../src/types';

const START_S4 = 1_700_900_000_000;
const START_S5 = 1_700_960_000_000;
const SIX_HOURS_MS = 6 * 3_600_000;
const FORTY_EIGHT_HOURS_MS = 48 * 3_600_000;

const PLAYER = 'faction-player';
const BRITAIN = 'faction-britain';
const CAESAR = 'faction-rome';
const GENGHIS = 'faction-steppe';

function britainPlayerWorld(base: WorldState): WorldState {
  const { [PLAYER]: _player, ...aiFactions } = base.factions;
  const territories = { ...base.territories };
  const london = territories['territory-london'];
  if (london) {
    territories['territory-london'] = { ...london, ownerId: BRITAIN };
  }
  const units = Object.fromEntries(
    Object.entries(base.units).map(([id, unit]) => [
      id,
      unit.ownerId === PLAYER ? { ...unit, ownerId: BRITAIN } : unit,
    ]),
  );
  return {
    ...base,
    territories,
    units,
    factions: {
      ...aiFactions,
      [BRITAIN]: { ...base.factions[BRITAIN]!, isPlayer: true },
    },
  };
}

function runSprint4ColdPlay(): {
  world: WorldState;
  events: SimEvent[];
  observation: Record<string, unknown>;
} {
  let world = britainPlayerWorld(createSprint4World(START_S4));
  const playerId = playerFactionId(world)!;
  const events: SimEvent[] = [];

  expect(diplomaticRelationshipStatus(world, playerId, CAESAR)).toBe('neutral');
  expect(reputationCategory(world.reputation[playerId]?.[CAESAR] ?? 0)).toBe('Neutral');

  const caesarProposal = playerProposeAlliance(world, playerId, CAESAR, world.nowMs);
  world = caesarProposal.world;
  events.push(...caesarProposal.events);
  expect(caesarProposal.events.some((event) => event.kind === 'allianceDeclined')).toBe(true);

  const toFirstProposal = advanceTo(world, START_S4 + SIX_HOURS_MS);
  world = toFirstProposal.world;
  events.push(...toFirstProposal.events);

  const incoming = world.pendingProposals.find(
    (proposal) => proposal.from === GENGHIS && proposal.to === playerId,
  );
  expect(incoming).toBeDefined();
  const accepted = playerAcceptProposal(world, playerId, incoming!.id, world.nowMs);
  world = accepted.world;
  events.push(...accepted.events);
  expect(areAllied(world, playerId, GENGHIS)).toBe(true);

  const withAlliance = advanceTo(world, world.nowMs + FORTY_EIGHT_HOURS_MS);
  world = withAlliance.world;
  events.push(...withAlliance.events);

  const alliedIntelLines = events.filter(
    (event) =>
      event.kind === 'intelReport' &&
      event.source === 'allied' &&
      (event.receiverFaction ?? event.observerFaction) === playerId,
  );

  const broken = playerBreakAlliance(world, playerId, GENGHIS, world.nowMs);
  world = broken.world;
  events.push(...broken.events);
  const breakEvent = broken.events.find((event) => event.kind === 'allianceBroken');
  expect(breakEvent).toBeDefined();
  expect(resolveEventImportance(world, breakEvent!)).toBe('high');

  const digest = renderDigestText(world, events, undefined, playerId);

  return {
    world,
    events,
    observation: {
      caesarDeclined: true,
      allianceAccepted: true,
      alliedIntelCount: alliedIntelLines.length,
      genghisReputationLabel: reputationCategory(world.reputation[GENGHIS]?.[playerId] ?? 0),
      breakImportance: resolveEventImportance(world, breakEvent!),
      digest,
    },
  };
}

function runSprint5ColdPlay(): {
  world: WorldState;
  events: SimEvent[];
  observation: Record<string, unknown>;
} {
  let world = createSprint5World(START_S5);
  const playerId = playerFactionId(world)!;
  const events: SimEvent[] = [];

  const caesarProposal = playerProposeAlliance(world, playerId, CAESAR, world.nowMs);
  world = caesarProposal.world;
  events.push(...caesarProposal.events);

  const toFirstProposal = advanceTo(world, START_S5 + SIX_HOURS_MS);
  world = toFirstProposal.world;
  events.push(...toFirstProposal.events);

  const incoming = world.pendingProposals.find(
    (proposal) => proposal.to === playerId && proposal.type === 'alliance',
  );
  if (incoming) {
    const accepted = playerAcceptProposal(world, playerId, incoming.id, world.nowMs);
    world = accepted.world;
    events.push(...accepted.events);
  }

  const withAlliance = advanceTo(world, world.nowMs + FORTY_EIGHT_HOURS_MS);
  world = withAlliance.world;
  events.push(...withAlliance.events);

  let brokenReputationLabel = 'Neutral';
  if (areAllied(world, playerId, GENGHIS)) {
    const broken = playerBreakAlliance(world, playerId, GENGHIS, world.nowMs);
    world = broken.world;
    events.push(...broken.events);
    brokenReputationLabel = reputationCategory(world.reputation[GENGHIS]?.[playerId] ?? 0);
  }

  const digest = renderDigestText(world, events, undefined, playerId);

  return {
    world,
    events,
    observation: {
      caesarDeclined: caesarProposal.events.some((event) => event.kind === 'allianceDeclined'),
      playerAlliedWithGenghis: events.some((event) => event.kind === 'allianceFormed'),
      genghisReputationLabel: brokenReputationLabel,
      digest,
    },
  };
}

describe('sprint 6 integration', () => {
  it('sprint4 britain-player diplomacy protocol', () => {
    const { observation } = runSprint4ColdPlay();
    expect(observation.genghisReputationLabel).toBe('Wary');
    expect(observation.breakImportance).toBe('high');
    expect(observation.alliedIntelCount).toBeGreaterThan(0);
    expect(observation).toMatchSnapshot('sprint6-phase7-sprint4-cold-play');
  });

  it('sprint5 player diplomacy protocol', () => {
    const { observation } = runSprint5ColdPlay();
    expect(observation).toMatchSnapshot('sprint6-phase7-sprint5-cold-play');
  });

  it('cold-play protocols are deterministic from seed', () => {
    const a = runSprint4ColdPlay().observation;
    const b = runSprint4ColdPlay().observation;
    expect(a).toEqual(b);

    const c = runSprint5ColdPlay().observation;
    const d = runSprint5ColdPlay().observation;
    expect(c).toEqual(d);
  });
});
