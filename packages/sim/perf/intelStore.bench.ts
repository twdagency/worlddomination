/**
 * Sprint 5.5 intel store performance baseline.
 *
 * Usage (from packages/sim):
 *   pnpm bench:intel
 */
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { advanceTo } from '../src/clock';
import {
  factionIntelRecords,
  mergeAllTerritoryVisibility,
  pruneExpiredRecords,
  recordIntelObservations,
} from '../src/intel';

const BENCH_START_MS = 1_700_000_000_000;
const WARMUP = 25;
const SAMPLES = 100;

export interface BenchResult {
  label: string;
  medianMs: number;
  p95Ms: number;
  meta?: Record<string, string | number>;
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

export function fmtMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(1)} ms`;
}

export function runIntelBenchmarks(): {
  intel: BenchResult[];
  recordCounts: Record<string, number>;
} {
  const hours = [24, 72] as const;
  const intel: BenchResult[] = [];
  const recordCounts: Record<string, number> = {};

  for (const h of hours) {
    const { world } = advanceTo(createSprint4World(BENCH_START_MS), BENCH_START_MS + h * 3_600_000);
    const factions = Object.keys(world.factions);
    let totalRecords = 0;
    for (const factionId of factions) {
      totalRecords += factionIntelRecords(world, factionId).length;
    }
    recordCounts[`${h}h`] = totalRecords;

    intel.push(
      bench(`mergeAllTerritoryVisibility ×${factions.length} (${h}h world)`, () => {
        for (const factionId of factions) {
          mergeAllTerritoryVisibility(world, factionId);
        }
      }),
    );

    intel.push(
      bench(`recordIntelObservations (${h}h world)`, () => {
        recordIntelObservations(world);
      }),
    );

    intel.push(
      bench(`pruneExpiredRecords all factions (${h}h world)`, () => {
        for (const factionId of factions) {
          pruneExpiredRecords(factionIntelRecords(world, factionId), world.nowMs);
        }
      }),
    );
  }

  return { intel, recordCounts };
}

function main(): void {
  const results = runIntelBenchmarks();

  console.log('=== Intel store (createSprint4World) ===');
  for (const row of results.intel) {
    console.log(`${row.label}: median ${fmtMs(row.medianMs)}, p95 ${fmtMs(row.p95Ms)}`);
  }
  console.log('\nRecord counts (all factions):');
  for (const [label, count] of Object.entries(results.recordCounts)) {
    console.log(`  ${label}: ${count} records`);
  }
}

main();
