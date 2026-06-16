import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { accrueEconomy, incomePerHour, tick } from '../src';
import { MS_PER_HOUR } from '../src/constants';

const START_MS = 1_700_900_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const MADRID = 'territory-madrid';

function fundingDelta(
  world: ReturnType<typeof createSprint4World>,
  factionId: string,
  elapsedMs: number,
) {
  const before = world.factions[factionId]?.funding ?? 0;
  const after = accrueEconomy(world, elapsedMs).factions[factionId]?.funding ?? 0;
  return after - before;
}

function worldWithAssaultOnLondon(
  attackerId: string,
  elapsedMs: number = 3_600_000,
) {
  const base = createSprint4World(START_MS);
  const london = base.territories[LONDON]!;
  const arriveMs = START_MS + elapsedMs;

  const world = {
    ...base,
    units: {
      'unit-attacker': {
        id: 'unit-attacker',
        typeId: 'levy-t1',
        ownerId: attackerId,
        count: 80,
        locationId: undefined,
        stance: 'defend' as const,
        transit: {
          fromId: PARIS,
          toCoord: london.coord,
          toTerritoryId: LONDON,
          departMs: START_MS,
          arriveMs,
          distanceKm: 300,
          stanceOnArrival: 'assault' as const,
          intent: 'attack' as const,
          beatId: 'capture-income-test',
          decisionTickMs: START_MS,
        },
      },
    },
  };

  return { world, elapsedMs };
}

describe('tick capture income ordering', () => {
  it('does not accrue income for the defender on a territory captured in the same tick', () => {
    const { world, elapsedMs } = worldWithAssaultOnLondon(ROME);
    const fundingBefore = world.factions[PLAYER]!.funding;
    const londonIncomeIfHeld = fundingDelta(world, PLAYER, elapsedMs);

    const result = tick(world, [], elapsedMs);

    const playerDelta = (result.world.factions[PLAYER]?.funding ?? 0) - fundingBefore;
    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(londonIncomeIfHeld).toBeGreaterThan(0);
    expect(playerDelta).toBe(0);
  });

  it('accrues income for the attacker on a territory captured in the same tick', () => {
    const { world, elapsedMs } = worldWithAssaultOnLondon(ROME);
    const fundingBefore = world.factions[ROME]!.funding;

    const postCapture = {
      ...world,
      territories: {
        ...world.territories,
        [LONDON]: { ...world.territories[LONDON]!, ownerId: ROME },
      },
    };
    const expectedRomeDelta = fundingDelta(postCapture, ROME, elapsedMs);

    const result = tick(world, [], elapsedMs);
    const romeDelta = (result.world.factions[ROME]?.funding ?? 0) - fundingBefore;

    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(expectedRomeDelta).toBeGreaterThan(fundingDelta(world, ROME, elapsedMs));
    expect(romeDelta).toBeCloseTo(expectedRomeDelta, 0);
  });

  it('still accrues income from uncaptured territories for the losing faction', () => {
    const base = createSprint4World(START_MS);
    const elapsedMs = 3_600_000;
    const arriveMs = START_MS + elapsedMs;
    const london = base.territories[LONDON]!;
    const madrid = base.territories[MADRID]!;

    const world = {
      ...base,
      territories: {
        ...base.territories,
        [MADRID]: { ...madrid, ownerId: PLAYER },
      },
      units: {
        'unit-attacker': {
          id: 'unit-attacker',
          typeId: 'levy-t1',
          ownerId: ROME,
          count: 80,
          locationId: undefined,
          stance: 'defend' as const,
          transit: {
            fromId: PARIS,
            toCoord: london.coord,
            toTerritoryId: LONDON,
            departMs: START_MS,
            arriveMs,
            distanceKm: 300,
            stanceOnArrival: 'assault' as const,
            intent: 'attack' as const,
            beatId: 'capture-income-test',
            decisionTickMs: START_MS,
          },
        },
      },
    };

    const fundingBefore = world.factions[PLAYER]!.funding;
    const madridOnly = {
      ...world,
      territories: {
        ...world.territories,
        [LONDON]: { ...london, ownerId: ROME },
      },
    };
    const expectedMadridIncome = fundingDelta(madridOnly, PLAYER, elapsedMs);

    const result = tick(world, [], elapsedMs);
    const playerDelta = (result.world.factions[PLAYER]?.funding ?? 0) - fundingBefore;

    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(result.world.territories[MADRID]?.ownerId).toBe(PLAYER);
    expect(playerDelta).toBeCloseTo(expectedMadridIncome, 0);
  });

  it('accrues income normally when no capture occurs in the tick', () => {
    const world = createSprint4World(START_MS);
    const elapsedMs = 3_600_000;
    const fundingBefore = world.factions[PLAYER]!.funding;
    const expectedDelta = fundingDelta(world, PLAYER, elapsedMs);

    const result = tick(world, [], elapsedMs);
    const playerDelta = (result.world.factions[PLAYER]?.funding ?? 0) - fundingBefore;

    expect(result.world.territories[LONDON]?.ownerId).toBe(PLAYER);
    expect(playerDelta).toBeCloseTo(expectedDelta, 0);
  });

  it('applies post-capture ownership when multiple territories change hands in one tick', () => {
    const base = createSprint4World(START_MS);
    const elapsedMs = 3_600_000;
    const arriveMs = START_MS + elapsedMs;
    const london = base.territories[LONDON]!;
    const madrid = base.territories[MADRID]!;

    const world = {
      ...base,
      territories: {
        ...base.territories,
        [MADRID]: { ...madrid, ownerId: PLAYER },
      },
      units: {
        'unit-rome-london': {
          id: 'unit-rome-london',
          typeId: 'levy-t1',
          ownerId: ROME,
          count: 80,
          locationId: undefined,
          stance: 'defend' as const,
          transit: {
            fromId: PARIS,
            toCoord: london.coord,
            toTerritoryId: LONDON,
            departMs: START_MS,
            arriveMs,
            distanceKm: 300,
            stanceOnArrival: 'assault' as const,
            intent: 'attack' as const,
            beatId: 'capture-a',
            decisionTickMs: START_MS,
          },
        },
        'unit-steppe-madrid': {
          id: 'unit-steppe-madrid',
          typeId: 'levy-t1',
          ownerId: 'faction-steppe',
          count: 80,
          locationId: undefined,
          stance: 'defend' as const,
          transit: {
            fromId: 'territory-berlin',
            toCoord: madrid.coord,
            toTerritoryId: MADRID,
            departMs: START_MS,
            arriveMs,
            distanceKm: 300,
            stanceOnArrival: 'assault' as const,
            intent: 'attack' as const,
            beatId: 'capture-b',
            decisionTickMs: START_MS,
          },
        },
      },
    };

    const playerBefore = world.factions[PLAYER]!.funding;
    const result = tick(world, [], elapsedMs);

    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(result.world.territories[MADRID]?.ownerId).toBe('faction-steppe');
    expect((result.world.factions[PLAYER]?.funding ?? 0) - playerBefore).toBe(0);
  });
});

describe('tick capture income integration (Sprint 4)', () => {
  it('cold-play: enemy took London — player receives no London income that tick', () => {
    const { world, elapsedMs } = worldWithAssaultOnLondon(ROME);
    const fundingBefore = world.factions[PLAYER]!.funding;
    const london = world.territories[LONDON]!;
    const londonHourly = incomePerHour(london);

    const result = tick(world, [], elapsedMs);
    const playerDelta = (result.world.factions[PLAYER]?.funding ?? 0) - fundingBefore;
    const londonTickIncome = (londonHourly * elapsedMs) / MS_PER_HOUR;

    expect(result.events.some((event) => event.kind === 'territoryCaptured')).toBe(true);
    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(londonTickIncome).toBeGreaterThan(0);
    expect(playerDelta).toBeLessThan(londonTickIncome);
    expect(playerDelta).toBe(0);
  });

  it('Sprint 4: Caesar holds Paris and gains London income after same-tick capture', () => {
    const { world, elapsedMs } = worldWithAssaultOnLondon(ROME);
    const fundingBefore = world.factions[ROME]!.funding;

    const postCapture = {
      ...world,
      territories: {
        ...world.territories,
        [LONDON]: { ...world.territories[LONDON]!, ownerId: ROME },
      },
    };
    const expectedDelta = fundingDelta(postCapture, ROME, elapsedMs);

    const result = tick(world, [], elapsedMs);
    const romeDelta = (result.world.factions[ROME]?.funding ?? 0) - fundingBefore;

    expect(result.world.territories[PARIS]?.ownerId).toBe(ROME);
    expect(result.world.territories[LONDON]?.ownerId).toBe(ROME);
    expect(romeDelta).toBeCloseTo(expectedDelta, 0);
  });
});
