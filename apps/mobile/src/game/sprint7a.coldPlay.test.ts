import { describe, expect, it } from 'vitest';
import {
  advanceTo,
  applyBuildOrders,
  canBuild,
  dispatchLineForEvent,
  ensureWorldMigrations,
  playerProposeAlliance,
  SCOUT_UNIT_TYPE_ID,
  taggedOrderFields,
} from 'sim';
import { createSprint4World, createSprint5World, LEADERS_BY_ID, resolvePlayerFactionId, UNIT_TYPES_BY_ID } from 'shared';
import { buildActionFeedback } from './actionFeedback';
import {
  getDashboardCatchUpSummary,
  getDashboardEmpireSummary,
  getDashboardNavCards,
  getDashboardUrgentCount,
  getDashboardUrgentItems,
} from './playerView';
import { getFactionIdentity } from './factionDisplay';
import { infraUpgradeCostPreview, unitBuildCostPreview } from './costPreview';
import { PRIMARY_TAB_COUNT } from '../navigation/tabConfig';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const BELGRADE = 'territory-belgrade';
const PLAYER_S4 = resolvePlayerFactionId(createSprint4World(START_MS))!;
const TWENTY_FOUR_HOURS_MS = 24 * 3_600_000;

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    unitTypes: UNIT_TYPES_BY_ID,
    leaders: LEADERS_BY_ID,
  });
}

describe('Sprint 7a cold-play protocol (automated)', () => {
  describe('createSprint4World', () => {
    it('loads with three distinct AI leaders including Philip II at Madrid', () => {
      const world = createSprint4World(START_MS);
      const player = getFactionIdentity(world, PLAYER_S4);
      const rome = getFactionIdentity(world, 'faction-rome');
      const steppe = getFactionIdentity(world, 'faction-steppe');
      const spain = getFactionIdentity(world, 'faction-britain');

      expect(player.leaderName).toBe('Elizabeth');
      expect(rome.leaderName).toBe('Caesar');
      expect(steppe.leaderName).toBe('Genghis');
      expect(spain.leaderName).toBe('Philip II');
      expect(new Set([player.leaderName, rome.leaderName, steppe.leaderName, spain.leaderName]).size).toBe(4);
    });

    it('dashboard selectors work at start and after 24h away', () => {
      const { events, world } = advanceTo(createSprint4World(START_MS), START_MS + TWENTY_FOUR_HOURS_MS);
      const catchUp = getDashboardCatchUpSummary(world, events, TWENTY_FOUR_HOURS_MS);
      const urgent = getDashboardUrgentItems(world, events);
      const empire = getDashboardEmpireSummary(world);
      const nav = getDashboardNavCards(world, events);

      expect(catchUp.mode).toBe('away');
      expect(catchUp.totalCount).toBeGreaterThan(0);
      expect(empire?.leaderName).toBe('Elizabeth');
      expect(nav.length).toBeGreaterThan(0);
      expect(getDashboardUrgentCount(world, events)).toBeGreaterThanOrEqual(0);
      expect(urgent.every((item) => item.label.length > 0)).toBe(true);
    });

    it('scout build works after legacy migration', () => {
      const legacy = createSprint4World(START_MS);
      const { [SCOUT_UNIT_TYPE_ID]: _removed, ...unitTypes } = legacy.unitTypes;
      const migrated = migrate({ ...legacy, unitTypes });
      expect(canBuild(migrated, LONDON, SCOUT_UNIT_TYPE_ID, 1, PLAYER_S4).ok).toBe(true);
    });

    it('cost transparency previews are available for infra and builds', () => {
      const world = createSprint4World(START_MS);
      const scout = world.unitTypes[SCOUT_UNIT_TYPE_ID]!;
      const infra = infraUpgradeCostPreview(world, LONDON, PLAYER_S4);
      const build = unitBuildCostPreview(world, LONDON, scout, PLAYER_S4);
      expect(infra.lines.length).toBeGreaterThan(0);
      expect(build.lines.length).toBeGreaterThan(0);
    });

    it('three-layer feedback builders produce toast and dispatch for representative actions', () => {
      const world = createSprint4World(START_MS);
      const { territories, factions, events: buildEvents } = applyBuildOrders(world, [
        {
          kind: 'build',
          territoryId: LONDON,
          unitTypeId: SCOUT_UNIT_TYPE_ID,
          count: 1,
          ...taggedOrderFields(PLAYER_S4, START_MS, 'build'),
        },
      ]);
      const afterBuild = { ...world, territories, factions };
      const buildFeedback = buildActionFeedback('build', afterBuild, buildEvents, {
        territoryId: LONDON,
        unitTypeId: SCOUT_UNIT_TYPE_ID,
        count: 1,
      });
      expect(buildFeedback.toastMessage.length).toBeGreaterThan(0);
      expect(buildFeedback.dispatchEvents.length).toBeGreaterThan(0);

      const { world: afterDiplomacy, events: diploEvents } = playerProposeAlliance(
        world,
        PLAYER_S4,
        'faction-rome',
        START_MS,
      );
      const diploFeedback = buildActionFeedback('proposeAlliance', afterDiplomacy, diploEvents, {
        targetFactionId: 'faction-rome',
      });
      expect(diploFeedback.toastMessage.length).toBeGreaterThan(0);
    });

    it('Philip II labels Madrid AI dispatches (not duplicate Elizabeth)', () => {
      const { events, world } = advanceTo(createSprint4World(START_MS), START_MS + 72 * 3_600_000);
      const lines = events.map((event) => dispatchLineForEvent(world, event, PLAYER_S4));
      expect(lines.some((line) => line.includes('Philip II'))).toBe(true);
      expect(lines.some((line) => /Elizabeth.*Madrid|Madrid.*Elizabeth/i.test(line))).toBe(false);
    });
  });

  describe('createSprint5World', () => {
    it('loads with dashboard and faction identity across Balkan geography', () => {
      const world = createSprint5World(START_MS);
      const { events, world: advanced } = advanceTo(world, START_MS + TWENTY_FOUR_HOURS_MS);
      const empire = getDashboardEmpireSummary(advanced);
      const playerId = resolvePlayerFactionId(advanced)!;
      const belgrade = getFactionIdentity(advanced, playerId);

      expect(empire?.territoryNames).toContain('Belgrade');
      expect(belgrade.territoryNames).toContain('Belgrade');
      expect(getDashboardCatchUpSummary(advanced, events, TWENTY_FOUR_HOURS_MS).mode).toBe('away');
    });

    it('scout build path is valid on sprint5 player territory', () => {
      const world = migrate(createSprint5World(START_MS));
      const playerId = resolvePlayerFactionId(world)!;
      const scout = world.unitTypes[SCOUT_UNIT_TYPE_ID]!;
      const preview = unitBuildCostPreview(world, BELGRADE, scout, playerId);
      expect(preview.lines.length).toBeGreaterThan(0);
      expect(canBuild(world, BELGRADE, SCOUT_UNIT_TYPE_ID, 1, playerId).ok).toBe(true);
    });
  });

  describe('navigation shell', () => {
    it('exposes four primary tabs per design canon', () => {
      expect(PRIMARY_TAB_COUNT).toBe(4);
    });
  });

  describe('legacy save migration', () => {
    it('restores diplomacy fields and missing catalogs on load', () => {
      const legacy = createSprint4World(START_MS);
      const stripped = {
        ...legacy,
        unitTypes: Object.fromEntries(
          Object.entries(legacy.unitTypes).filter(([id]) => id !== SCOUT_UNIT_TYPE_ID),
        ),
        leaders: Object.fromEntries(
          Object.entries(legacy.leaders).filter(([id]) => id !== 'leader-philip'),
        ),
        alliances: undefined,
        treaties: undefined,
        reputation: undefined,
        pendingProposals: undefined,
      } as unknown as typeof legacy;

      const restored = migrate(stripped);
      expect(restored.unitTypes[SCOUT_UNIT_TYPE_ID]).toBeDefined();
      expect(restored.leaders['leader-philip']?.name).toBe('Philip II');
      expect(restored.alliances).toEqual([]);
      expect(restored.pendingProposals).toEqual([]);
      expect(restored.reputation).toBeDefined();
    });
  });
});

describe('Sprint 7a dashboard selector perf', () => {
  it('dashboard selectors complete within budget on 24h sprint4 world', () => {
    const { events, world } = advanceTo(createSprint4World(START_MS), START_MS + TWENTY_FOUR_HOURS_MS);
    const budgetMs = 15;

    const runs = [
      () => getDashboardCatchUpSummary(world, events, TWENTY_FOUR_HOURS_MS),
      () => getDashboardUrgentItems(world, events),
      () => getDashboardEmpireSummary(world),
      () => getDashboardNavCards(world, events),
      () => getDashboardUrgentCount(world, events),
    ];

    for (const run of runs) {
      const t0 = performance.now();
      run();
      expect(performance.now() - t0).toBeLessThan(budgetMs);
    }
  });
});
