import { describe, it, expect } from 'vitest';
import {
  advanceTo,
  collectAiOrders,
  computeStance,
  isAiDecisionMs,
  isTerritoryVisible,
  renderCompactDigestText,
} from '../src';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { AI_DECISION_INTERVAL_MS } from '../src/constants';

const START_MS = 1_700_100_000_000;

describe('scenario sprint5', () => {
  it('loads cleanly with Balkan tri-border geography', () => {
    const world = createSprint5World(START_MS);
    expect(world.scenarioId).toBe('sprint-5-legibility-demo');
    expect(Object.keys(world.territories)).toHaveLength(4);
    expect(world.territories['territory-belgrade']?.name).toBe('Belgrade');
    expect(world.territories['territory-istanbul']?.name).toBe('Istanbul');
  });

  it('player fog hides distant Istanbul while nearby capitals stay visible', () => {
    const world = createSprint5World(START_MS);
    expect(isTerritoryVisible(world, 'faction-player', 'territory-bucharest')).toBe(true);
    expect(isTerritoryVisible(world, 'faction-player', 'territory-sofia')).toBe(true);
    expect(isTerritoryVisible(world, 'faction-player', 'territory-istanbul')).toBe(false);
  });

  it('AI produces orders within one decision tick', () => {
    const world = createSprint5World(START_MS);
    const decisionMs = START_MS + AI_DECISION_INTERVAL_MS;
    expect(isAiDecisionMs(world, decisionMs)).toBe(true);

    const orders = collectAiOrders(world, decisionMs);
    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders) {
      expect(['move', 'build', 'upgradeInfra']).toContain(order.kind);
      if (order.kind !== 'upgradeInfra') {
        expect(order.intent).toBeDefined();
        expect(order.beatId).toBeDefined();
      }
    }
  });

  it('survives a simulated 48h skip with emitted events', () => {
    const world = createSprint5World(START_MS);
    const { events, world: advanced } = advanceTo(world, START_MS + 48 * 3_600_000);
    expect(advanced.nowMs).toBe(START_MS + 48 * 3_600_000);
    expect(events.length).toBeGreaterThan(0);
    expect(events.some((event) => event.kind === 'departure' || event.kind === 'buildStarted')).toBe(
      true,
    );
  });

  it('showcases legibility systems over 24h with distinct faction stances', () => {
    const world = createSprint5World(START_MS);
    const windowMs = 24 * 3_600_000;
    const { events, world: advanced } = advanceTo(world, START_MS + windowMs);

    const digest = renderCompactDigestText(advanced, events, windowMs);
    expect(digest.split('\n').length).toBeLessThanOrEqual(40);

    const rome = computeStance(advanced, 'faction-rome', events, advanced.nowMs);
    const steppe = computeStance(advanced, 'faction-steppe', events, advanced.nowMs);
    const britain = computeStance(advanced, 'faction-britain', events, advanced.nowMs);
    const labels = new Set([rome, steppe, britain]);
    expect(labels.size).toBeGreaterThanOrEqual(2);
    expect(events.some((event) => event.kind === 'departure' && event.intent === 'attack')).toBe(
      true,
    );
  });

  it('locks 24h compact digest for cold-read regression', () => {
    const world = createSprint5World(START_MS);
    const windowMs = 24 * 3_600_000;
    const { events, world: advanced } = advanceTo(world, START_MS + windowMs);
    const digest = renderCompactDigestText(advanced, events, windowMs);
    expect(digest).toMatchSnapshot();
  });
});
