import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyAiInfluenceOrders,
  applyAiThresholdOrders,
  applyGatherIntelligence,
  collectAiInfluenceOrders,
  collectAiThresholdOrders,
  isAiInfluenceAgencyActive,
  isInfluenceAgencyDisabled,
  latestIntelligenceRecord,
  pickBestAiInfluenceAction,
  scoreAiInfluenceAction,
  type Faction,
} from '../src';
import { ensureWorldInfluence, setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { MS_PER_DAY } from '../src/constants';
import type { Country, WorldState } from '../src/types';

const START_MS = 1_700_900_000_000;
const STEPPE = 'faction-steppe';
const PLAYER = 'faction-player';
const LONDON = 'territory-london';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function richAi(world: WorldState): WorldState {
  const factions = { ...world.factions };
  for (const [id, faction] of Object.entries(factions)) {
    if (faction.isPlayer) continue;
    factions[id] = { ...faction, funding: 50_000, manpower: 500 };
  }
  return { ...world, factions };
}

describe('Sprint 10 contracts', () => {
  it('Phase 1: country.ts does not import influenceActions or influenceAccelerators directly', () => {
    const countrySource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/country.ts'),
      'utf8',
    );
    expect(countrySource).not.toMatch(/from '\.\/influenceActions'/);
    expect(countrySource).not.toMatch(/from '\.\/influenceAccelerators'/);
  });

  it('Phase 3: Faction type alias remains valid for backward compat after Country canonicalization', () => {
    const country: Country = {
      id: 'faction-test',
      name: 'Test',
      leaderId: 'leader-test',
      capitalTerritoryId: LONDON,
      funding: 1,
      manpower: 1,
      defeated: false,
    };
    const alias: Faction = country;
    expect(alias.id).toBe(country.id);
  });

  it('Phase 4: AI accelerator scoring applies leader posture modifier (e.g. opportunist favors Subversion)', () => {
    const world = richAi(migrate(ensureWorldInfluence(createSprint4World(START_MS))));
    const at = world.startMs + MS_PER_DAY;
    const subversion = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: LONDON,
      accelerator: 'influence-subversion',
    }, at);
    const mission = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: LONDON,
      accelerator: 'diplomatic-mission',
    }, at);
    expect(subversion.score).toBeGreaterThan(mission.score);
  });

  it('Phase 4: AI issues Diplomatic Mission against player-owned city when influence gap and posture favor it', () => {
    const world = richAi(migrate(ensureWorldInfluence(createSprint4World(START_MS))));
    const at = world.startMs + MS_PER_DAY;
    const best = pickBestAiInfluenceAction(world, 'faction-britain', at);
    expect(best?.candidate.accelerator).toBe('diplomatic-mission');
    expect(best?.candidate.targetCityId).toBe(LONDON);
  });

  it('Phase 5: AI issues Coup against player city when threshold, gold, and posture favor high-risk transfer', () => {
    const world = richAi(
      setInfluence(
        migrate(ensureWorldInfluence(createSprint4World(START_MS))),
        LONDON,
        STEPPE,
        75,
        START_MS,
      ),
    );
    const at = world.startMs + MS_PER_DAY;
    const orders = collectAiThresholdOrders(world, at).filter((order) => order.ownerId === STEPPE);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('coup-attempt');
    expect(orders[0]?.targetCityId).toBe(LONDON);
  });

  it('Phase 6: Intelligence action at 30+ influence emits intelReport with enriched snapshot fields', () => {
    const world = richAi(
      setInfluence(
        migrate(ensureWorldInfluence(createSprint4World(START_MS))),
        LONDON,
        STEPPE,
        35,
        START_MS,
      ),
    );
    const at = world.startMs + MS_PER_DAY;
    const result = applyGatherIntelligence(world, STEPPE, LONDON, at);
    expect(
      result.events.some((event) => event.kind === 'intelReport' && event.source === 'intelligence'),
    ).toBe(true);
    expect(latestIntelligenceRecord(result.world, STEPPE, LONDON, at)?.snapshot.enriched).toBeDefined();
  });

  it('AI influence agency is active on production factory worlds by default', () => {
    const world = migrate(createSprint4World(START_MS));
    expect(world.aiInfluenceAgencySuppressed).toBeUndefined();
    expect(isAiInfluenceAgencyActive(world)).toBe(true);
  });

  it.todo(
    'Phase 7: Annexation at 70+ influence transfers ownership peacefully and applies reputation cascade',
  );

  it('Phase 8: tutorial playthrough beat sequence unchanged — AI influence orders suppressed in tutorial scenario', () => {
    const world = migrate(ensureWorldInfluence(createTutorialWorld(START_MS)));
    expect(isInfluenceAgencyDisabled(world)).toBe(true);
    expect(collectAiInfluenceOrders(world, world.nowMs)).toEqual([]);
    expect(collectAiThresholdOrders(world, world.nowMs)).toEqual([]);
    expect(applyAiInfluenceOrders(world, world.nowMs).events).toEqual([]);
    expect(applyAiThresholdOrders(world, world.nowMs).events).toEqual([]);
  });
});
