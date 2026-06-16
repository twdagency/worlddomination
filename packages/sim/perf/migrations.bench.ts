import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { LEADERS_BY_ID } from '../../shared/src/leaders';
import { UNIT_TYPES_BY_ID } from '../../shared/src/units';
import { SCOUT_UNIT_TYPE_ID } from '../src/scout';
import { ensureWorldMigrations } from '../src/migrations';
import type { WorldState } from '../src/types';

const BENCH_START_MS = 1_700_000_000_000;
const WARMUP = 25;
const SAMPLES = 100;

export interface BenchResult {
  label: string;
  medianMs: number;
  p95Ms: number;
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function bench(label: string, fn: () => void, samples = SAMPLES): BenchResult {
  for (let i = 0; i < WARMUP; i++) fn();
  const timings: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = performance.now();
    fn();
    timings.push(performance.now() - t0);
  }
  timings.sort((a, b) => a - b);
  return {
    label,
    medianMs: timings[Math.floor(timings.length / 2)],
    p95Ms: percentile(timings, 95),
  };
}

/** Sprint 6-era save shape missing post-5.5 unit types and post-7a leaders. */
export function legacySprint6Save(): WorldState {
  const world = createSprint4World(BENCH_START_MS);
  const { [SCOUT_UNIT_TYPE_ID]: _scout, ...withoutScout } = world.unitTypes;
  const { 'leader-philip': _philip, ...withoutPhilip } = world.leaders;
  return {
    ...world,
    unitTypes: withoutScout,
    leaders: withoutPhilip,
    alliances: undefined as unknown as WorldState['alliances'],
    pendingProposals: undefined as unknown as WorldState['pendingProposals'],
  };
}

export function runMigrationBenchmarks(): BenchResult[] {
  const legacy = legacySprint6Save();
  const catalog = { unitTypes: UNIT_TYPES_BY_ID, leaders: LEADERS_BY_ID };

  return [
    bench('ensureWorldMigrations (legacy save)', () => {
      ensureWorldMigrations(legacy, catalog);
    }),
    bench('ensureWorldMigrations (fresh save)', () => {
      ensureWorldMigrations(createSprint4World(BENCH_START_MS), catalog);
    }),
  ];
}
