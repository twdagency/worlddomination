import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import {
  applyInfluenceOrders,
  canActorIssueInfluenceOrder,
  MS_PER_DAY,
  setInfluence,
} from '../src';
import { ensureWorldMigrations } from '../src/migrations';
import { tagOrder } from './fixtures';
import type { WorldState } from '../src/types';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const STEPPE = 'faction-steppe';
const PARIS = 'territory-paris';

function migrate(world: WorldState): WorldState {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

function fundedWorld(): WorldState {
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
  };
}

function mission(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'diplomatic-mission', ownerId: PLAYER, targetCityId: PARIS },
    PLAYER,
  );
}

function campaign(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'cultural-campaign', ownerId: PLAYER, targetCityId: PARIS },
    PLAYER,
  );
}

function intel(world: WorldState) {
  return tagOrder(
    world,
    { kind: 'gather-intelligence', ownerId: PLAYER, targetCityId: PARIS },
    PLAYER,
  );
}

describe('player influence channel cadence', () => {
  it('lets the player act at world start while AI still waits a day', () => {
    const world = fundedWorld();
    expect(canActorIssueInfluenceOrder(world, PLAYER, START_MS)).toBe(true);
    expect(canActorIssueInfluenceOrder(world, STEPPE, START_MS)).toBe(false);
  });

  it('rejects a second channel action at the same timestamp', () => {
    const world = fundedWorld();
    const first = applyInfluenceOrders(world, [mission(world)], START_MS);
    expect(first.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(true);
    expect(first.world.aiInfluenceCooldowns?.[PLAYER]).toBe(START_MS);

    const second = applyInfluenceOrders(first.world, [campaign(first.world)], START_MS);
    expect(second.events.some((event) => event.kind === 'culturalCampaignApplied')).toBe(false);
    expect(second.events.some((event) => event.kind === 'orderRejected')).toBe(true);
    expect(
      second.events.find((event) => event.kind === 'orderRejected')?.reason,
    ).toBe('influence-channel-on-cooldown');
  });

  it('allows intelligence alongside a channel action in the same tick', () => {
    const world = setInfluence(fundedWorld(), PARIS, PLAYER, 35, START_MS);
    const result = applyInfluenceOrders(world, [intel(world), mission(world)], START_MS);
    expect(result.events.some((event) => event.kind === 'intelReport')).toBe(true);
    expect(result.events.some((event) => event.kind === 'diplomaticMissionStarted')).toBe(true);
    expect(result.world.aiInfluenceCooldowns?.[PLAYER]).toBe(START_MS);
  });

  it('allows another channel action after a full game-day', () => {
    const world = fundedWorld();
    const first = applyInfluenceOrders(world, [mission(world)], START_MS);
    const later = applyInfluenceOrders(first.world, [campaign(first.world)], START_MS + MS_PER_DAY);
    expect(later.events.some((event) => event.kind === 'culturalCampaignApplied')).toBe(true);
    expect(later.world.aiInfluenceCooldowns?.[PLAYER]).toBe(START_MS + MS_PER_DAY);
  });
});
