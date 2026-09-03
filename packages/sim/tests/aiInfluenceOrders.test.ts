import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { decideOrders } from '../src/ai';
import {
  applyAiInfluenceOrders,
  canActorIssueInfluenceOrder,
  collectAiInfluenceOrders,
} from '../src/aiInfluenceOrders';
import {
  computeAttackInfluenceScoreAdjustment,
} from '../src/aiInfluenceSignals';
import { isInfluenceAgencyDisabled } from '../src/aiInfluenceAgency';
import { pickBestAiInfluenceAction, scoreAiInfluenceAction } from '../src/aiInfluenceScoring';
import { advanceTo } from '../src/clock';
import { formAlliance } from '../src/diplomacy';
import {
  applyInfluenceOrders,
  getInfluence,
} from '../src';
import { accruePassiveInfluence, ensureWorldInfluence, setInfluence } from '../src/influence';
import { ensureWorldMigrations } from '../src/migrations';
import { MS_PER_DAY } from '../src/constants';
import { tick } from '../src/tick';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

function eligibleAt(world: WorldState): number {
  return world.startMs + MS_PER_DAY;
}

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const BRITAIN = 'faction-britain';
const ROME = 'faction-rome';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const MADRID = 'territory-madrid';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function sprint4(overrides: Partial<WorldState> = {}): WorldState {
  return migrate({
    ...ensureWorldInfluence(createSprint4World(START_MS)),
    ...overrides,
  });
}

function richAi(
  world: WorldState,
  fundingOverrides: Partial<Record<string, number>> = {},
): WorldState {
  const factions = { ...world.factions };
  for (const [id, faction] of Object.entries(factions)) {
    if (faction.isPlayer) continue;
    factions[id] = {
      ...faction,
      funding: fundingOverrides[id] ?? 50_000,
      manpower: 500,
    };
  }

  if (!world.countries) {
    return { ...world, factions };
  }

  const countries = { ...world.countries };
  for (const [id, country] of Object.entries(countries)) {
    const faction = factions[id];
    if (!faction) continue;
    countries[id] = {
      ...country,
      funding: faction.funding,
      manpower: faction.manpower,
    };
  }

  return { ...world, factions, countries };
}

describe('AI influence accelerator orders', () => {
  it('isolationist without existential threat returns empty orders', () => {
    const world = richAi(sprint4());
    expect(
      collectAiInfluenceOrders(world, world.nowMs).filter((order) => order.ownerId === ROME),
    ).toEqual([]);
  });

  it('opportunist AI issues subversion against player capital when funded', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const orders = collectAiInfluenceOrders(world, at).filter((o) => o.ownerId === STEPPE);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('influence-subversion');
    expect(orders[0]?.targetCityId).toBe(LONDON);
  });

  it('loyal AI prefers diplomatic mission over subversion', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const orders = collectAiInfluenceOrders(world, at).filter((o) => o.ownerId === BRITAIN);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.kind).toBe('diplomatic-mission');
    expect(orders[0]?.kind).not.toBe('influence-subversion');
  });

  it('insufficient gold blocks AI influence orders via reserve check', () => {
    const world = richAi(sprint4(), { [STEPPE]: 500 });
    expect(collectAiInfluenceOrders(world, world.nowMs).filter((o) => o.ownerId === STEPPE)).toEqual(
      [],
    );
  });

  it('enforces per-actor daily cooldown after a successful order', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const first = applyAiInfluenceOrders(world, at);
    expect(first.events.some((e) => e.kind === 'subversionApplied' && e.ownerId === STEPPE)).toBe(
      true,
    );
    expect(canActorIssueInfluenceOrder(first.world, STEPPE, at + 1)).toBe(false);

    const later = collectAiInfluenceOrders(first.world, at + MS_PER_DAY);
    expect(later.some((o) => o.ownerId === STEPPE)).toBe(true);
  });

  it('allows multiple AI actors to issue independently on the same day', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const orders = collectAiInfluenceOrders(world, at);
    const actors = new Set(orders.map((o) => o.ownerId));
    expect(actors.has(STEPPE)).toBe(true);
    expect(actors.has(BRITAIN)).toBe(true);
  });

  it('suppresses subversion for 30 days after discovery for the same actor', () => {
    const world = richAi({
      ...sprint4(),
      aiSubversionDiscoveryLog: [
        { actorId: STEPPE, targetCityId: PARIS, at: START_MS - MS_PER_DAY },
      ],
    });
    const orders = collectAiInfluenceOrders(world, START_MS).filter((o) => o.ownerId === STEPPE);
    expect(orders.every((o) => o.kind !== 'influence-subversion')).toBe(true);
  });

  it('suppresses subversion on a different target city after discovery by same actor', () => {
    const world = richAi({
      ...sprint4(),
      aiSubversionDiscoveryLog: [
        { actorId: STEPPE, targetCityId: PARIS, at: START_MS - 1 },
      ],
    });
    const subversion = collectAiInfluenceOrders(world, START_MS).filter(
      (o) => o.ownerId === STEPPE && o.kind === 'influence-subversion',
    );
    expect(subversion).toHaveLength(0);
  });

  it('prioritizes targets near the 30+ influence threshold', () => {
    const world = richAi(setInfluence(sprint4(), PARIS, STEPPE, 27, START_MS));
    const nearThreshold = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: PARIS,
      accelerator: 'cultural-campaign',
    }, START_MS);
    const farFromThreshold = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: MADRID,
      accelerator: 'cultural-campaign',
    }, START_MS);
    expect(nearThreshold.score).toBeGreaterThan(farFromThreshold.score);
    expect(nearThreshold.rationale.signals.timePressure).toBe(0.8);
  });

  it('returns no orders in tutorial scenarios', () => {
    const world = migrate(ensureWorldInfluence(createTutorialWorld(START_MS)));
    expect(isInfluenceAgencyDisabled(world)).toBe(true);
    expect(collectAiInfluenceOrders(world, world.nowMs)).toEqual([]);
  });

  it('skips defeated AI countries', () => {
    const base = richAi(sprint4());
    const world = {
      ...base,
      countries: {
        ...base.countries!,
        [STEPPE]: { ...base.countries![STEPPE]!, defeated: true },
      },
      factions: {
        ...base.factions,
        [STEPPE]: { ...base.factions[STEPPE]!, defeated: true },
      },
    };
    expect(collectAiInfluenceOrders(world, world.nowMs).some((o) => o.ownerId === STEPPE)).toBe(
      false,
    );
  });

  it('never targets allied countries', () => {
    const allied = formAlliance(richAi(sprint4()), STEPPE, PLAYER, START_MS).world;
    const orders = collectAiInfluenceOrders(allied, START_MS).filter((o) => o.ownerId === STEPPE);
    expect(orders.every((o) => o.targetCityId !== LONDON)).toBe(true);
  });

  it('is deterministic for identical worlds and timestamps', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const a = collectAiInfluenceOrders(world, at);
    const b = collectAiInfluenceOrders(world, at);
    expect(a).toEqual(b);
  });

  it('decision-level: Genghis prefers London over Paris for influence action', () => {
    const world = richAi(sprint4());
    const at = eligibleAt(world);
    const best = pickBestAiInfluenceAction(world, STEPPE, at);
    expect(best?.candidate.targetCityId).toBe(LONDON);
    expect(best?.candidate.accelerator).toBe('influence-subversion');

    const london = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: LONDON,
      accelerator: 'influence-subversion',
    }, at);
    const paris = scoreAiInfluenceAction(world, STEPPE, {
      targetCityId: PARIS,
      accelerator: 'influence-subversion',
    }, at);
    expect(london.score).toBeGreaterThan(paris.score);
  });

  it('Sprint 4 cold-play: Genghis accumulates 20+ influence in London over 30 game-days', () => {
    const world = richAi(sprint4());
    const endMs = START_MS + 30 * MS_PER_DAY;
    const result = advanceTo(world, endMs);
    const influence = getInfluence(result.world, LONDON, STEPPE);
    expect(influence).toBeGreaterThanOrEqual(20);
    expect(
      result.events.some(
        (event) =>
          event.kind === 'subversionApplied' ||
          event.kind === 'culturalCampaignApplied' ||
          event.kind === 'diplomaticMissionStarted',
      ),
    ).toBe(true);
  });
});

describe('AI influence accelerator regressions', () => {
  it('player accelerator usage remains unaffected', () => {
    const world = richAi({
      ...sprint4(),
      factions: {
        ...sprint4().factions,
        [PLAYER]: { ...sprint4().factions[PLAYER]!, funding: 50_000, isPlayer: true },
      },
    });
    const order = tagOrder(
      world,
      { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId: PARIS },
      PLAYER,
    );
    const result = applyInfluenceOrders(world, [order], world.nowMs);
    expect(result.events.some((e) => e.kind === 'diplomaticMissionStarted')).toBe(true);
  });

  it('passive influence accumulation continues after AI influence tick', () => {
    const world = richAi(sprint4());
    const afterAi = applyAiInfluenceOrders(world, eligibleAt(world)).world;
    const accrued = accruePassiveInfluence(afterAi, afterAi.nowMs + MS_PER_DAY);
    expect(accrued.influence).toBeDefined();
  });

  it('Phase 2 attack influence awareness scoring is unchanged', () => {
    const world = sprint4();
    const weights = LEADERS_BY_ID['leader-genghis']!.weights;
    const baseline = computeAttackInfluenceScoreAdjustment(world, STEPPE, PARIS, weights);
    const infiltrated = setInfluence(world, PARIS, STEPPE, 60, world.nowMs);
    const adjusted = computeAttackInfluenceScoreAdjustment(infiltrated, STEPPE, PARIS, weights);
    expect(adjusted).toBeLessThan(baseline);
  });

  it('military AI decideOrders path is unchanged for tutorial suppression', () => {
    const world = migrate(createTutorialWorld(START_MS));
    const orders = decideOrders(world, 'faction-france-tutorial', START_MS);
    expect(orders.length).toBeLessThanOrEqual(1);
  });

  it('tick pipeline applies AI influence orders before passive accrual', () => {
    const world = richAi(sprint4());
    const result = tick(world, [], MS_PER_DAY);
    expect(getInfluence(result.world, LONDON, STEPPE)).toBeGreaterThan(0);
  });
});
