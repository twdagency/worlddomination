/**
 * Sprint 6 diplomacy performance baseline.
 *
 * Usage (from packages/sim):
 *   pnpm bench:diplomacy
 */
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { advanceTo } from '../src/clock';
import { applyAiDiplomaticDecisions } from '../src/diplomaticAi';
import { breakAlliance, formAlliance } from '../src/diplomacy';
import { AI_DECISION_INTERVAL_MS } from '../src/constants';
import {
  recordAlliedObservations,
  recordIntelObservations,
  recordTreatyObservations,
} from '../src/intel';
import { fmtMs, type BenchResult } from './intelStore.bench';

const BENCH_START_MS = 1_700_000_000_000;
const WARMUP = 25;
const SAMPLES = 100;

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
    p95Ms: timings[Math.min(timings.length - 1, Math.ceil(0.95 * timings.length) - 1)],
  };
}

export function runDiplomacyBenchmarks(): {
  diplomacy: BenchResult[];
  alliedRecordCount24h: number;
  treatyRecordCount24h: number;
} {
  const world = createSprint4World(BENCH_START_MS);
  const decisionMs = BENCH_START_MS + AI_DECISION_INTERVAL_MS;
  const alliedWorld = formAlliance(world, 'faction-steppe', 'faction-britain', BENCH_START_MS).world;
  const { world: advanced24 } = advanceTo(alliedWorld, BENCH_START_MS + 24 * 3_600_000);

  let alliedCount = 0;
  let treatyCount = 0;
  for (const records of Object.values(advanced24.intel)) {
    for (const record of records ?? []) {
      if (record.source === 'allied') alliedCount++;
      if (record.source === 'treaty') treatyCount++;
    }
  }

  const diplomacy = [
    bench('applyAiDiplomaticDecisions (sprint4)', () => {
      applyAiDiplomaticDecisions(world, decisionMs);
    }),
    bench('formAlliance', () => {
      formAlliance(world, 'faction-steppe', 'faction-britain', decisionMs);
    }),
    bench('breakAlliance', () => {
      breakAlliance(alliedWorld, 'faction-steppe', 'faction-britain');
    }),
    bench('recordAlliedObservations (24h allied world)', () => {
      recordAlliedObservations(advanced24);
    }),
    bench('recordTreatyObservations (24h allied world)', () => {
      recordTreatyObservations(advanced24);
    }),
    bench('diplomacy intel pipeline per tick', () => {
      const direct = recordIntelObservations(advanced24);
      recordAlliedObservations({ ...advanced24, intel: direct });
      recordTreatyObservations({ ...advanced24, intel: direct });
    }),
  ];

  return {
    diplomacy,
    alliedRecordCount24h: alliedCount,
    treatyRecordCount24h: treatyCount,
  };
}

function main(): void {
  const results = runDiplomacyBenchmarks();
  console.log('=== Diplomacy (createSprint4World) ===');
  for (const row of results.diplomacy) {
    console.log(`${row.label}: median ${fmtMs(row.medianMs)}, p95 ${fmtMs(row.p95Ms)}`);
  }
  console.log(`\nAllied records after 24h skip: ${results.alliedRecordCount24h}`);
  console.log(`Treaty records after 24h skip: ${results.treatyRecordCount24h}`);
}

main();
