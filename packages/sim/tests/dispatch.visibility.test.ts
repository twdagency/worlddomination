import { describe, it, expect } from 'vitest';
import {
  computeBeatId,
  filterDispatchesForFaction,
  isDispatchVisibleToFaction,
  renderDigestText,
} from '../src/dispatch';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import type { SimEvent } from '../src/types';

const START_MS = 1_700_700_000_000;
const PLAYER = 'faction-player';
const PARIS = 'territory-paris';

describe('dispatch visibility', () => {
  it('hides other factions intelReport from the player feed', () => {
    const world = createSprint4World(START_MS);
    const elizabethReport: SimEvent = {
      kind: 'intelReport',
      at: world.nowMs,
      observerFaction: 'faction-britain',
      territoryId: PARIS,
      source: 'scout',
      variant: 'massing',
      subjectFactionId: 'faction-rome',
      intent: 'attack',
      beatId: computeBeatId('faction-britain', world.nowMs, 'scout'),
      decisionTickMs: world.nowMs,
    };

    expect(isDispatchVisibleToFaction(world, elizabethReport, PLAYER)).toBe(false);
    expect(filterDispatchesForFaction(world, [elizabethReport], PLAYER)).toHaveLength(0);
  });

  it('shows the player own intelReport', () => {
    const world = createSprint4World(START_MS);
    const playerReport: SimEvent = {
      kind: 'intelReport',
      at: world.nowMs,
      observerFaction: PLAYER,
      territoryId: 'territory-berlin',
      source: 'scout',
      variant: 'activity',
      subjectFactionId: 'faction-steppe',
      intent: 'defend',
      beatId: computeBeatId(PLAYER, world.nowMs, 'scout'),
      decisionTickMs: world.nowMs,
    };

    expect(isDispatchVisibleToFaction(world, playerReport, PLAYER)).toBe(true);
  });
});
