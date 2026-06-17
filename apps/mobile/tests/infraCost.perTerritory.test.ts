import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { INFRA_UPGRADE_BASE_COST, taggedOrderFields, tick, type WorldState } from 'sim';
import { infraUpgradeCostPreview } from '../src/game/costPreview';

const START_MS = 1_700_950_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

function upgradeInfraOrder(
  world: ReturnType<typeof createSprint4World>,
  territoryId: string,
) {
  return {
    kind: 'upgradeInfra' as const,
    territoryId,
    ...taggedOrderFields(PLAYER, world.nowMs, 'build'),
  };
}

describe('infra upgrade cost preview per territory (#18)', () => {
  it('shows different preview costs after one city is upgraded', () => {
    let world: WorldState = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [LONDON]: {
          ...createSprint4World(START_MS).territories[LONDON]!,
          ownerId: PLAYER,
          infraLevel: 1,
        },
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: PLAYER,
          infraLevel: 1,
        },
      },
    };

    world = tick(world, [upgradeInfraOrder(world, LONDON)], 0).world;

    const londonPreview = infraUpgradeCostPreview(world, LONDON, PLAYER);
    const parisPreview = infraUpgradeCostPreview(world, PARIS, PLAYER);

    expect(londonPreview.lines[0]?.required).toBe(INFRA_UPGRADE_BASE_COST * 2);
    expect(parisPreview.lines[0]?.required).toBe(INFRA_UPGRADE_BASE_COST * 1);
    expect(londonPreview.lines[0]?.required).not.toBe(parisPreview.lines[0]?.required);
  });

  it('matches sim deduction for the next upgrade on each territory', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: PLAYER,
          infraLevel: 3,
        },
      },
    };

    const preview = infraUpgradeCostPreview(world, PARIS, resolvePlayerFactionId(world)!);
    const fundingBefore = world.factions[PLAYER]!.funding;
    const result = tick(world, [upgradeInfraOrder(world, PARIS)], 0);

    expect(preview.lines[0]?.required).toBe(INFRA_UPGRADE_BASE_COST * 3);
    expect(result.world.factions[PLAYER]!.funding).toBe(
      fundingBefore - (preview.lines[0]?.required ?? 0),
    );
  });
});
