import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import { breakAlliance, formAlliance } from 'sim';
import { classifyDestination } from '../src/game/orderDestinations';
import { formatDestinationRowTitle } from '../src/game/territoryOwnerLabel';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const GENGHIS = 'faction-steppe';
const LONDON = 'territory-london';
const BERLIN = 'territory-berlin';
const PARIS = 'territory-paris';

describe('order destination classifier', () => {
  it('classifies player territory as friendly', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world);

    expect(classifyDestination(world, playerId, LONDON)).toBe('friendly');
  });

  it('classifies unowned territory as neutral', () => {
    const world = {
      ...createSprint4World(START_MS),
      territories: {
        ...createSprint4World(START_MS).territories,
        [PARIS]: {
          ...createSprint4World(START_MS).territories[PARIS]!,
          ownerId: undefined,
        },
      },
    };

    expect(classifyDestination(world, PLAYER, PARIS)).toBe('neutral');
  });

  it('classifies ally territory as allied', () => {
    const world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;

    expect(classifyDestination(world, PLAYER, BERLIN, GENGHIS)).toBe('allied');
  });

  it('classifies hostile faction territory as hostile', () => {
    const world = createSprint4World(START_MS);

    expect(classifyDestination(world, PLAYER, BERLIN, GENGHIS)).toBe('hostile');
  });

  it('reverts ally territory to hostile after alliance breaks', () => {
    let world = formAlliance(createSprint4World(START_MS), PLAYER, GENGHIS, START_MS).world;
    world = breakAlliance(world, PLAYER, GENGHIS);

    expect(classifyDestination(world, PLAYER, BERLIN, GENGHIS)).toBe('hostile');
  });

  it('formats destination rows with country and leader context', () => {
    expect(
      formatDestinationRowTitle('Bucharest', 'hostile', 'Rome', 'Caesar'),
    ).toBe('Bucharest (Rome) · HOSTILE · Caesar');
  });

  it('keeps allied destination labeling with country context', () => {
    expect(
      formatDestinationRowTitle('Berlin', 'allied', 'Steppe', 'Genghis'),
    ).toBe('Berlin (Steppe) · ALLIED · Genghis');
  });
});
