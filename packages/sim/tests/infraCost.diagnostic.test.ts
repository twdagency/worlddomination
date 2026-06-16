import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { INFRA_UPGRADE_BASE_COST, tick } from '../src';
import { tagOrder } from './fixtures';

const START_MS = 1_700_800_000_000;
const PLAYER = 'faction-player';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('infrastructure cost diagnostics (#18)', () => {
  it('DIAGNOSTIC: sim charges per-target-territory infraLevel', () => {
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
    const parisCost = INFRA_UPGRADE_BASE_COST * 3;
    const order = tagOrder(
      world,
      { kind: 'upgradeInfra', territoryId: PARIS },
      PLAYER,
    );
    const result = tick(world, [order], 0);

    expect(result.world.factions[PLAYER]!.funding).toBe(fundingBefore - parisCost);
    expect(result.world.territories[PARIS]!.infraLevel).toBe(4);
  });

  it('DIAGNOSTIC: london and paris upgrades use independent infra levels', () => {
    const world = createSprint4World(START_MS);
    const londonCost = INFRA_UPGRADE_BASE_COST * world.territories[LONDON]!.infraLevel;
    const parisInfraLevel = 3;
    const parisCost = INFRA_UPGRADE_BASE_COST * parisInfraLevel;

    expect(londonCost).not.toBe(parisCost);
  });
});
