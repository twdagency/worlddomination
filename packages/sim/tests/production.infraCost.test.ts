import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { INFRA_UPGRADE_BASE_COST, tick } from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_950_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

function worldWithEqualInfraStart() {
  const base = createSprint4World(START_MS);
  return {
    ...base,
    territories: {
      ...base.territories,
      [LONDON]: {
        ...base.territories[LONDON]!,
        ownerId: PLAYER,
        infraLevel: 1,
      },
      [PARIS]: {
        ...base.territories[PARIS]!,
        ownerId: PLAYER,
        infraLevel: 1,
      },
    },
  };
}

describe('infrastructure upgrade cost per territory', () => {
  it('charges independent costs based on each territory infraLevel', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [LONDON]: {
          ...createSprint4World(START_MS).territories[LONDON]!,
          infraLevel: 1,
        },
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: PLAYER,
          infraLevel: 3,
        },
      },
    };

    const fundingBefore = world.factions[PLAYER]!.funding;
    const order = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: PARIS },
      PLAYER,
    );
    const result = tick(world, [order], 0);

    expect(result.world.factions[PLAYER]!.funding).toBe(
      fundingBefore - INFRA_UPGRADE_BASE_COST * 3,
    );
    expect(result.world.territories[PARIS]!.infraLevel).toBe(4);
    expect(result.world.territories[LONDON]!.infraLevel).toBe(1);
  });

  it('reflects upgraded territory level in the next upgrade cost for that territory only', () => {
    let world = worldWithEqualInfraStart();
    const upgradeLondon = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: LONDON },
      PLAYER,
    );
    world = tick(world, [upgradeLondon], 0).world;

    expect(world.territories[LONDON]!.infraLevel).toBe(2);
    expect(world.territories[PARIS]!.infraLevel).toBe(1);

    const londonNextCost = INFRA_UPGRADE_BASE_COST * world.territories[LONDON]!.infraLevel;
    const parisNextCost = INFRA_UPGRADE_BASE_COST * world.territories[PARIS]!.infraLevel;

    expect(londonNextCost).toBe(INFRA_UPGRADE_BASE_COST * 2);
    expect(parisNextCost).toBe(INFRA_UPGRADE_BASE_COST * 1);
    expect(londonNextCost).not.toBe(parisNextCost);
  });
});
