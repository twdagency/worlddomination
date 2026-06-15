import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  allianceFormedEvent,
  allianceBrokenEvent,
  computeBeatId,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  formAlliance,
  formTreaty,
  groupEventsByBeat,
  isDispatchVisibleToFaction,
  playerAcceptProposal,
  playerFactionId,
  recordAlliedObservations,
  recordIntelObservations,
  renderDigestText,
  treatyFormedEvent,
} from '../src';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { SimEvent, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const SEVENTY_TWO_HOURS_MS = 72 * 3_600_000;
const PLAYER = 'faction-player';
const BRITAIN = 'faction-britain';
const GENGHIS = 'faction-steppe';
const CAESAR = 'faction-rome';
const BERLIN = 'territory-berlin';

/** Britain as player: merge London stack into faction-britain so diplomacy and sight match one Elizabeth faction. */
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

describe('dispatch diplomacy', () => {
  it('formats alliance formed for party and observer perspectives', () => {
    const world = createSprint4World(START_MS);
    const event = allianceFormedEvent(GENGHIS, BRITAIN, START_MS, GENGHIS);
    expect(dispatchLineForEvent(world, event, BRITAIN)).toContain('Alliance formed with Genghis');
    expect(dispatchLineForEvent(world, event, CAESAR)).toContain(
      'Philip II and Genghis have formed an alliance',
    );
  });

  it('formats alliance broken for betrayed party vs observers', () => {
    const world = createSprint4World(START_MS);
    const event = allianceBrokenEvent(GENGHIS, BRITAIN, START_MS);
    expect(dispatchLineForEvent(world, event, BRITAIN)).toContain('broken our alliance');
    expect(dispatchLineForEvent(world, event, CAESAR)).toContain('broken alliance with Philip II');
  });

  it('shows alliance events to all factions and hides treaty events from non-parties', () => {
    const world = createSprint4World(START_MS);
    const alliance = allianceFormedEvent(GENGHIS, BRITAIN, START_MS, GENGHIS);
    const treaty = treatyFormedEvent(
      formTreaty(world, {
        partyA: GENGHIS,
        partyB: CAESAR,
        territoryIds: [BERLIN],
        formedAt: START_MS,
        expiresAt: START_MS + 48 * 3_600_000,
      }).treaties[0]!,
      START_MS,
      GENGHIS,
    );

    expect(isDispatchVisibleToFaction(world, alliance, PLAYER)).toBe(true);
    expect(isDispatchVisibleToFaction(world, alliance, CAESAR)).toBe(true);
    expect(isDispatchVisibleToFaction(world, treaty, BRITAIN)).toBe(false);
    expect(isDispatchVisibleToFaction(world, treaty, GENGHIS)).toBe(true);
    expect(isDispatchVisibleToFaction(world, treaty, CAESAR)).toBe(true);
  });

  it('shows allied intel to receiver and hides from non-receivers', () => {
    const world = createSprint4World(START_MS);
    const alliedReport: SimEvent = {
      kind: 'intelReport',
      at: START_MS,
      observerFaction: GENGHIS,
      receiverFaction: BRITAIN,
      territoryId: BERLIN,
      source: 'allied',
      variant: 'activity',
      subjectFactionId: GENGHIS,
      garrisonDescriptor: 'moderate',
      intent: 'defend',
      beatId: computeBeatId(BRITAIN, START_MS, 'allied'),
      decisionTickMs: START_MS,
    };

    expect(isDispatchVisibleToFaction(world, alliedReport, BRITAIN)).toBe(true);
    expect(isDispatchVisibleToFaction(world, alliedReport, GENGHIS)).toBe(false);
    expect(isDispatchVisibleToFaction(world, alliedReport, PLAYER)).toBe(false);
    expect(dispatchLineForEvent(world, alliedReport)).toContain("Genghis's forces report");
  });

  it('formats treaty-sourced intel with per-treaty phrasing', () => {
    const world = createSprint4World(START_MS);
    const report: SimEvent = {
      kind: 'intelReport',
      at: START_MS,
      observerFaction: GENGHIS,
      receiverFaction: CAESAR,
      territoryId: BERLIN,
      source: 'treaty',
      variant: 'activity',
      subjectFactionId: GENGHIS,
      garrisonDescriptor: 'moderate',
      intent: 'defend',
      beatId: computeBeatId(CAESAR, START_MS, 'treaty'),
      decisionTickMs: START_MS,
    };

    expect(dispatchLineForEvent(world, report)).toContain('Per treaty, Genghis garrison at Berlin: moderate');
  });

  it('groups diplomatic events into beats by faction and tick', () => {
    const world = createSprint4World(START_MS);
    const events = [
      allianceFormedEvent(GENGHIS, BRITAIN, START_MS, GENGHIS),
      allianceBrokenEvent(GENGHIS, BRITAIN, START_MS + 1),
    ];
    const beats = groupEventsByBeat(world, events);
    expect(beats).toHaveLength(2);
    expect(beats[0]?.factionId).toBe(GENGHIS);
  });

  it('72h cold-play as Britain includes alliance formation in digest', () => {
    let world = britainPlayerWorld(createSprint4World(START_MS));
    let allEvents: SimEvent[] = [];
    const firstTick = START_MS + 6 * 3_600_000;
    const step1 = advanceTo(world, firstTick);
    world = step1.world;
    allEvents.push(...step1.events);

    const proposal = world.pendingProposals.find(
      (row) => row.from === GENGHIS && row.to === BRITAIN,
    );
    if (proposal) {
      const accepted = playerAcceptProposal(world, BRITAIN, proposal.id, world.nowMs);
      world = accepted.world;
      allEvents.push(...accepted.events);
    }

    const step2 = advanceTo(world, START_MS + SEVENTY_TWO_HOURS_MS);
    world = step2.world;
    allEvents.push(...step2.events);

    const playerId = playerFactionId(world);
    const digest = renderDigestText(world, allEvents, undefined, playerId);

    expect(allEvents.some((event) => event.kind === 'allianceFormed')).toBe(true);
    expect(digest).toContain('DIPLOMACY');
    expect(digest).toContain('Alliance formed with Genghis');
    expect(digest).toContain("Genghis's forces report");
    expect(digest).toContain('Caesar forces advancing');
    expect(filterDispatchesForFaction(world, allEvents, CAESAR).some((e) => e.kind === 'treatyFormed')).toBe(
      false,
    );
  });

  it('emits allied intel dispatch lines to the allied receiver after tick', () => {
    const allied = formAlliance(createSprint4World(START_MS), GENGHIS, BRITAIN, START_MS);
    const observedAt = START_MS + 2_000;
    const withIntel = {
      ...allied,
      nowMs: observedAt,
      intel: recordAlliedObservations(
        {
          ...allied,
          nowMs: observedAt,
          intel: recordIntelObservations({ ...allied, nowMs: observedAt }),
        },
        observedAt,
      ),
    };

    const britainAllied = (withIntel.intel[BRITAIN] ?? []).filter((record) => record.source === 'allied');
    expect(britainAllied.length).toBeGreaterThan(0);

    const { events } = advanceTo(withIntel, observedAt + 6 * 3_600_000);
    const britainFeed = filterDispatchesForFaction(withIntel, events, BRITAIN);
    const alliedLines = britainFeed.filter(
      (event) => event.kind === 'intelReport' && event.source === 'allied',
    );
    expect(alliedLines.length).toBeGreaterThan(0);
    expect(dispatchLineForEvent(withIntel, alliedLines[0]!)).toContain("Genghis's forces report");
  });
});

describe('dispatch diplomacy cold-read snapshot', () => {
  it('britain-player 72h digest includes diplomatic layer', () => {
    let world = britainPlayerWorld(createSprint4World(START_MS));
    let allEvents: SimEvent[] = [];
    const firstTick = START_MS + 6 * 3_600_000;
    const step1 = advanceTo(world, firstTick);
    world = step1.world;
    allEvents.push(...step1.events);

    const proposal = world.pendingProposals.find(
      (row) => row.from === GENGHIS && row.to === BRITAIN,
    );
    if (proposal) {
      const accepted = playerAcceptProposal(world, BRITAIN, proposal.id, world.nowMs);
      world = accepted.world;
      allEvents.push(...accepted.events);
    }

    const step2 = advanceTo(world, START_MS + SEVENTY_TWO_HOURS_MS);
    world = step2.world;
    allEvents.push(...step2.events);

    const digest = renderDigestText(world, allEvents, undefined, playerFactionId(world));
    expect(digest).toMatchSnapshot('sprint6-phase5-britain-72h-digest');
  });
});
