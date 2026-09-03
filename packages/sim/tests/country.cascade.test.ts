import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { collectAiOrders } from '../src/ai';
import { applyAiDiplomaticDecisions } from '../src/diplomaticAi';
import {
  defeatCountry,
  recordConquerorOnTerritoryCapture,
  syncCountriesFromFactions,
} from '../src/country';
import {
  areAllied,
  formAlliance,
  formTreaty,
  getAlliancesFor,
  getTreatiesBetween,
} from '../src/diplomacy';
import { buildDispatchFeed } from '../src/dispatch';
import { stampEvents } from '../src/events';
import { ensureWorldMigrations } from '../src/migrations';
import { REPUTATION_PENALTY_ALLY_DEFEATED } from '../src/reputation';
import type { Id, WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function captureCity(
  world: WorldState,
  territoryId: Id,
  previousOwnerId: Id,
  newOwnerId: Id,
): WorldState {
  const withConqueror = recordConquerorOnTerritoryCapture(
    world,
    territoryId,
    previousOwnerId,
    newOwnerId,
  );
  return {
    ...withConqueror,
    territories: {
      ...withConqueror.territories,
      [territoryId]: {
        ...withConqueror.territories[territoryId]!,
        ownerId: newOwnerId,
      },
    },
  };
}

function defeatRome(world: WorldState): WorldState {
  return syncCountriesFromFactions(captureCity(world, PARIS, ROME, BRITAIN)).world;
}

describe('country defeat cascade (Phase 3)', () => {
  it('dissolves one alliance and emits allianceBroken when defeated', () => {
    const base = migrate(createSprint4World(START_MS));
    const allied = formAlliance(base, ROME, STEPPE, START_MS).world;
    const { world, events } = defeatCountry(
      captureCity(allied, PARIS, ROME, BRITAIN),
      ROME,
      START_MS,
    );

    expect(areAllied(world, ROME, STEPPE)).toBe(false);
    expect(events.filter((e) => e.kind === 'allianceBroken')).toHaveLength(1);
    expect(events.at(-1)?.kind).toBe('countryDefeated');
  });

  it('dissolves two alliances in deterministic ally ID order', () => {
    const base = migrate(createSprint4World(START_MS));
    let world = formAlliance(base, ROME, STEPPE, START_MS).world;
    world = formAlliance(world, ROME, BRITAIN, START_MS).world;

    const { world: defeated, events } = defeatCountry(
      captureCity(world, PARIS, ROME, PLAYER),
      ROME,
      START_MS,
    );

    expect(getAlliancesFor(defeated, ROME)).toHaveLength(0);
    const broken = events.filter((e) => e.kind === 'allianceBroken');
    expect(broken).toHaveLength(2);
    expect(broken.map((e) => (e.kind === 'allianceBroken' ? e.betrayed : ''))).toEqual([
      BRITAIN,
      STEPPE,
    ]);
  });

  it('applies -10 ally-defeated reputation without observer penalties', () => {
    const base = migrate(createSprint4World(START_MS));
    const allied = formAlliance(base, ROME, STEPPE, START_MS).world;
    const { world } = defeatCountry(captureCity(allied, PARIS, ROME, BRITAIN), ROME, START_MS);

    expect(world.reputation[STEPPE][ROME]).toBe(REPUTATION_PENALTY_ALLY_DEFEATED);
    expect(world.reputation[PLAYER][ROME]).toBe(0);
    expect(world.reputation[BRITAIN][ROME]).toBe(0);
    expect(world.reputation[ROME][STEPPE]).toBe(0);
  });

  it('expires treaties and emits treatyExpired events', () => {
    const base = migrate(createSprint4World(START_MS));
    const withTreaty = formTreaty(base, {
      partyA: ROME,
      partyB: PLAYER,
      territoryIds: [PARIS],
      formedAt: START_MS,
      expiresAt: START_MS + 48 * 3_600_000,
    });

    const { world, events } = defeatCountry(
      captureCity(withTreaty, PARIS, ROME, BRITAIN),
      ROME,
      START_MS,
    );

    expect(getTreatiesBetween(world, ROME, PLAYER)).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'treatyExpired')).toHaveLength(1);
    expect(events.at(-1)?.kind).toBe('countryDefeated');
  });

  it('emits alliance breaks before treaty expirations then countryDefeated', () => {
    const base = migrate(createSprint4World(START_MS));
    let world = formAlliance(base, ROME, STEPPE, START_MS).world;
    world = formTreaty(world, {
      partyA: ROME,
      partyB: PLAYER,
      territoryIds: [PARIS],
      formedAt: START_MS,
      expiresAt: START_MS + 48 * 3_600_000,
    });

    const { events } = defeatCountry(captureCity(world, PARIS, ROME, BRITAIN), ROME, START_MS);
    expect(events.map((e) => e.kind)).toEqual([
      'allianceBroken',
      'treatyExpired',
      'countryDefeated',
    ]);
  });

  it('skips defeated countries in collectAiOrders', () => {
    const base = migrate(createSprint4World(START_MS));
    const defeated = defeatRome(base);

    const orders = collectAiOrders(defeated, START_MS);
    for (const order of orders) {
      if (order.kind === 'move') {
        expect(defeated.units[order.unitId]?.ownerId).not.toBe(ROME);
      } else if (order.kind === 'build' || order.kind === 'upgradeInfra') {
        expect(order.factionId).not.toBe(ROME);
      }
    }
  });

  it('skips defeated countries in applyAiDiplomaticDecisions', () => {
    const base = migrate(createSprint4World(START_MS));
    const allied = formAlliance(base, ROME, STEPPE, START_MS).world;
    const defeated = defeatRome(allied);

    const { events } = applyAiDiplomaticDecisions(defeated, START_MS);
    expect(
      events.filter(
        (event) =>
          event.kind === 'allianceBroken' &&
          (event.breaker === ROME || event.betrayed === ROME),
      ),
    ).toHaveLength(0);
  });

  it('is idempotent when defeatCountry runs on an already-defeated country', () => {
    const base = migrate(createSprint4World(START_MS));
    const first = defeatCountry(captureCity(base, PARIS, ROME, BRITAIN), ROME, START_MS);
    const second = defeatCountry(first.world, ROME, START_MS);

    expect(second.events).toHaveLength(0);
    expect(second.world).toBe(first.world);
  });

  it('handles same-tick double defeat of allied countries deterministically', () => {
    const base = migrate(createSprint4World(START_MS));
    let world = formAlliance(base, ROME, STEPPE, START_MS).world;
    world = captureCity(world, PARIS, ROME, BRITAIN);
    world = captureCity(world, BERLIN, STEPPE, PLAYER);

    const { world: defeated, events } = syncCountriesFromFactions(world);
    expect(defeated.countries![ROME]?.defeated).toBe(true);
    expect(defeated.countries![STEPPE]?.defeated).toBe(true);
    expect(events.map((e) => e.kind)).toEqual([
      'allianceBroken',
      'countryDefeated',
      'countryDefeated',
    ]);
    expect(
      events
        .filter((e) => e.kind === 'countryDefeated')
        .map((e) => (e.kind === 'countryDefeated' ? e.countryId : '')),
    ).toEqual([ROME, STEPPE]);
  });

  it('builds dispatch feed rows in cascade emission order', () => {
    const base = migrate(createSprint4World(START_MS));
    const allied = formAlliance(base, ROME, STEPPE, START_MS).world;
    const { world, events } = defeatCountry(
      captureCity(allied, PARIS, ROME, BRITAIN),
      ROME,
      START_MS,
    );
    const stamped = stampEvents(world, events);
    const feed = buildDispatchFeed(stamped.world, stamped.events);

    expect(feed.map((item) => item.event.kind)).toEqual(['allianceBroken', 'countryDefeated']);
  });

  it('keeps reputation matrix internally consistent after cascade', () => {
    const base = migrate(createSprint4World(START_MS));
    const allied = formAlliance(base, ROME, STEPPE, START_MS).world;
    const { world } = defeatCountry(captureCity(allied, PARIS, ROME, BRITAIN), ROME, START_MS);

    for (const observer of Object.keys(world.factions).sort()) {
      for (const subject of Object.keys(world.factions).sort()) {
        if (observer === subject) {
          expect(world.reputation[observer]?.[subject]).toBeUndefined();
        } else {
          expect(typeof world.reputation[observer]?.[subject]).toBe('number');
        }
      }
    }
  });

  it('removes pending dilemmas for the defeated country', () => {
    const base = migrate(createSprint4World(START_MS));
    const withDilemma = {
      ...base,
      pendingDilemmas: [{ dilemmaId: 'dilemma-test', countryId: ROME, offeredAt: START_MS }],
    };
    const { world } = defeatCountry(captureCity(withDilemma, PARIS, ROME, BRITAIN), ROME, START_MS);
    expect(world.pendingDilemmas?.some((entry) => entry.countryId === ROME)).toBe(false);
  });
});

describe('country defeat cascade integration', () => {
  it('sprint-5: caesar defeat stops AI orders and clears diplomacy', () => {
    const world = migrate(createSprint5World(START_MS));
    const allied = formAlliance(world, ROME, STEPPE, START_MS).world;
    const beforeOrders = collectAiOrders(allied, START_MS).length;

    const bucharest = 'territory-bucharest';
    const defeated = syncCountriesFromFactions(
      captureCity(allied, bucharest, ROME, PLAYER),
    ).world;

    expect(defeated.countries![ROME]?.defeated).toBe(true);
    expect(areAllied(defeated, ROME, STEPPE)).toBe(false);
    expect(collectAiOrders(defeated, START_MS).length).toBeLessThanOrEqual(beforeOrders);
    expect(
      collectAiOrders(defeated, START_MS).every((order) => {
        if (order.kind !== 'move') return true;
        return defeated.units[order.unitId]?.ownerId !== ROME;
      }),
    ).toBe(true);
  });

  it('tutorial: france defeat runs cascade without alliances or treaties', () => {
    const world = migrate(createTutorialWorld(START_MS));
    const paris = 'territory-paris-tutorial';
    const france = 'faction-france-tutorial';
    const player = 'faction-britain-tutorial';

    const { events } = syncCountriesFromFactions(
      captureCity(world, paris, france, player),
    );

    expect(events.map((e) => e.kind)).toEqual(['countryDefeated']);
    expect(events[0]).toMatchObject({
      kind: 'countryDefeated',
      countryId: france,
      defeatedBy: player,
    });
  });
});
