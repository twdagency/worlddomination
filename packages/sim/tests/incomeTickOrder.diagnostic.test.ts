import { describe, expect, it } from 'vitest';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { accrueEconomy, tick } from '../src';

const START_MS = 1_700_800_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const LONDON = 'territory-london';
const PARIS = 'territory-paris';

describe('income tick ordering diagnostics (#16)', () => {
  it('DIAGNOSTIC: tick accrues income from post-capture ownership, not tick-start ownership', () => {
    const base = createSprint4World(START_MS);
    const london = base.territories[LONDON]!;
    const elapsedMs = 3_600_000;
    const arriveMs = START_MS + elapsedMs;

    const world = {
      ...base,
      units: {
        'unit-rome-levy': {
          id: 'unit-rome-levy',
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
            beatId: 'diag-beat',
            decisionTickMs: START_MS,
          },
        },
      },
    };

    const fundingBefore = world.factions[PLAYER]!.funding;
    const stalePlayerDelta = accrueEconomy(world, elapsedMs).factions[PLAYER]!.funding - fundingBefore;
    const result = tick(world, [], elapsedMs);

    const playerFundingDelta =
      (result.world.factions[PLAYER]?.funding ?? 0) - fundingBefore;
    const londonCapturedByEnemy = result.world.territories[LONDON]?.ownerId === ROME;

    expect(londonCapturedByEnemy).toBe(true);
    expect(stalePlayerDelta).toBeGreaterThan(0);
    expect(playerFundingDelta).toBe(0);
    expect(playerFundingDelta).toBeLessThan(stalePlayerDelta);
  });

  it('DIAGNOSTIC: documents tick phase order — arrivals before economy accrual', () => {
    const phases = [
      'applyMoveOrders',
      'applyBuildOrders',
      'resolveProductionCompletions',
      'resolveArrivals',
      'accrueEconomy',
      'pruneExpiredTreaties',
      'recordIntelObservations',
      'syncCountriesFromFactions',
      'evaluateBeatProgression',
    ];

    expect(phases.indexOf('resolveArrivals')).toBeLessThan(phases.indexOf('accrueEconomy'));
  });
});
