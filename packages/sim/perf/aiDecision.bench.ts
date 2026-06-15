/**
 * Sprint 5 performance baseline runner.
 *
 * Usage (from packages/sim):
 *   pnpm bench:ai
 *   pnpm bench:ai -- --write-baseline
 *
 * Not part of CI — run on demand before sprint close or when touching ai/clock/dispatch.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { advanceTo } from '../src/clock';
import { renderDigestText } from '../src/dispatch';
import { compactDispatchFeed, renderCompactDigestText } from '../src/compaction';
import { collectAiOrders } from '../src/ai';
import { AI_DECISION_INTERVAL_MS } from '../src/constants';
import { computeStance, STANCE_WINDOW_MS } from '../src/stance';
import { buildBenchWorld } from './benchWorld';

const BENCH_START_MS = 1_700_000_000_000;
const WARMUP = 25;
const SAMPLES = 100;

interface BenchResult {
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

function benchAdvanceTo(hours: number, runs = 5): BenchResult {
  const targetMs = BENCH_START_MS + hours * 3_600_000;
  let eventCount = 0;
  const timings: number[] = [];

  for (let run = 0; run < runs + WARMUP; run++) {
    const world = createSprint4World(BENCH_START_MS);
    const t0 = performance.now();
    const { events } = advanceTo(world, targetMs);
    const elapsed = performance.now() - t0;
    if (run >= WARMUP) {
      timings.push(elapsed);
      eventCount = events.length;
    }
  }

  timings.sort((a, b) => a - b);
  return {
    label: `${hours}h skip`,
    medianMs: timings[Math.floor(timings.length / 2)],
    p95Ms: percentile(timings, 95),
    meta: { events: eventCount },
  };
}

function fmtMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  if (ms < 10) return `${ms.toFixed(2)} ms`;
  return `${ms.toFixed(1)} ms`;
}

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function runBenchmarks(): {
  decision: BenchResult[];
  advance: BenchResult[];
  legibility: BenchResult[];
  legibilitySharePct: number;
} {
  const decisionMs = BENCH_START_MS + AI_DECISION_INTERVAL_MS;

  const decision = ([2, 4, 8] as const).map((aiCount) => {
    const world = buildBenchWorld(aiCount, BENCH_START_MS);
    const territoryCount = Object.keys(world.territories).length;
    const result = bench(`collectAiOrders (${aiCount} AI)`, () => {
      collectAiOrders(world, decisionMs);
    });
    return { ...result, meta: { aiFactions: aiCount, territories: territoryCount } };
  });

  const advance = [6, 24, 72].map((hours) => benchAdvanceTo(hours));

  const sprint4 = createSprint4World(BENCH_START_MS);
  const window24 = 24 * 3_600_000;
  const { events, world: advanced } = advanceTo(sprint4, BENCH_START_MS + window24);
  const awayMs = window24;

  const legibility = [
    bench('renderDigestText (uncompacted)', () => {
      renderDigestText(advanced, events);
    }),
    bench('renderCompactDigestText (24h)', () => {
      renderCompactDigestText(advanced, events, awayMs);
    }),
    bench('compactDispatchFeed (24h)', () => {
      compactDispatchFeed(advanced, events, awayMs);
    }),
    bench('computeStance ×3 factions', () => {
      computeStance(advanced, 'faction-rome', events, advanced.nowMs, STANCE_WINDOW_MS);
      computeStance(advanced, 'faction-steppe', events, advanced.nowMs, STANCE_WINDOW_MS);
      computeStance(advanced, 'faction-britain', events, advanced.nowMs, STANCE_WINDOW_MS);
    }),
  ];

  const advance24 = advance.find((row) => row.label === '24h skip')!.medianMs;
  const legibilityTotal = legibility.reduce((sum, row) => sum + row.medianMs, 0);
  const legibilitySharePct = advance24 > 0 ? (legibilityTotal / advance24) * 100 : 0;

  return { decision, advance, legibility, legibilitySharePct };
}

function renderBaseline(results: ReturnType<typeof runBenchmarks>): string {
  const commit = gitCommit();
  const date = new Date().toISOString().slice(0, 10);

  const decisionRows = results.decision
    .map((row) => {
      const ai = row.meta?.aiFactions ?? '?';
      const territories = row.meta?.territories ?? '?';
      return `| ${ai} | ${territories} | ${fmtMs(row.medianMs)} | ${fmtMs(row.p95Ms)} |`;
    })
    .join('\n');

  const advanceRows = results.advance
    .map((row) => {
      const events = row.meta?.events ?? '—';
      return `| ${row.label} | ${events} | ${fmtMs(row.medianMs)} | ${fmtMs(row.p95Ms)} |`;
    })
    .join('\n');

  const legibilityRows = results.legibility
    .map((row) => `| ${row.label} | ${fmtMs(row.medianMs)} | ${fmtMs(row.p95Ms)} |`)
    .join('\n');

  return `# Sim performance baseline

Recorded: ${date}  
Commit: \`${commit}\`  
Runner: \`packages/sim/perf/aiDecision.bench.ts\`

## Methodology

| Parameter | Value |
|-----------|-------|
| Decision micro-bench | warmup ${WARMUP}, ${SAMPLES} samples, median + p95 |
| \`advanceTo\` macro-bench | warmup ${WARMUP}, 5 timed runs, median + p95 |
| Fixed clock | \`BENCH_START_MS = ${BENCH_START_MS}\` |
| Decision world | synthetic ring (\`buildBenchWorld\`) |
| Skip world | \`createSprint4World\` |
| Legibility sample | 24h sprint4 event batch (${results.advance.find((r) => r.label === '24h skip')?.meta?.events ?? '?'} events) |

Determinism: worlds use fixed seeds and timestamps. Wall-clock times vary by machine — compare against **this** file on the same hardware, not across unrelated environments.

## AI decision cost (\`collectAiOrders\`)

One 6h decision tick, all AI factions.

| AI factions | Territories | Median | p95 |
|-------------|-------------|--------|-----|
${decisionRows}

**Scaling read:** cost should grow roughly linearly with AI faction count (each faction runs the same scorer pipeline once).

## Time engine (\`advanceTo\` on \`createSprint4World\`)

Full catch-up simulation including AI ticks, movement, combat, economy.

| Skip | Events emitted | Median | p95 |
|------|----------------|--------|-----|
${advanceRows}

**Cadence note:** mobile foreground catch-up runs this path when the app resumes; sub-100ms at 24h is comfortable on dev hardware; 72h is the stress case.

## Legibility observer overhead (24h sprint4)

Pure read/render work on the emitted event list — not on the hot simulation path unless the UI renders dispatches.

| Operation | Median | p95 |
|-----------|--------|-----|
${legibilityRows}

**Stack total (median):** ${fmtMs(results.legibility.reduce((s, r) => s + r.medianMs, 0))}  
**Share of 24h \`advanceTo\` median:** ${results.legibilitySharePct.toFixed(2)}%

At current sprint4 scale both sim and observers are sub-millisecond. The share ratio is useful for regression drift; absolute microseconds matter more for mobile UX until skips grow much larger.

Sprint 5 dispatch/compaction/stance is observer-only; overhead should stay a small fraction of simulation cost.

## Review thresholds (guidance)

| Check | Target | Rationale |
|-------|--------|-----------|
| \`collectAiOrders\` @ 4 AI | < 2 ms median | 6h AI cadence; plenty of headroom per tick |
| \`advanceTo\` 24h | < 150 ms median | imperceptible mobile catch-up on resume |
| Legibility stack / 24h sim | < 10% | observers must not dominate sim time |
| p95 / median ratio | < 3× | flags allocation spikes or GC noise |

## How to re-run

\`\`\`bash
pnpm --filter sim bench:ai
pnpm --filter sim bench:ai -- --write-baseline
\`\`\`

Update this file when AI, clock, or legibility paths change materially.
`;
}

function main(): void {
  const writeBaseline = process.argv.includes('--write-baseline');
  const results = runBenchmarks();

  console.log('=== AI decision (collectAiOrders) ===');
  for (const row of results.decision) {
    console.log(
      `${row.label}: median ${fmtMs(row.medianMs)}, p95 ${fmtMs(row.p95Ms)} (${row.meta?.territories} territories)`,
    );
  }

  console.log('\n=== advanceTo (createSprint4World) ===');
  for (const row of results.advance) {
    console.log(
      `${row.label}: median ${fmtMs(row.medianMs)}, p95 ${fmtMs(row.p95Ms)}, events ${row.meta?.events}`,
    );
  }

  console.log('\n=== Legibility observers (24h sprint4) ===');
  for (const row of results.legibility) {
    console.log(`${row.label}: median ${fmtMs(row.medianMs)}, p95 ${fmtMs(row.p95Ms)}`);
  }
  console.log(`Legibility share of 24h advanceTo median: ${results.legibilitySharePct.toFixed(2)}%`);

  if (writeBaseline) {
    const dir = dirname(fileURLToPath(import.meta.url));
    const path = join(dir, 'baseline.md');
    writeFileSync(path, renderBaseline(results), 'utf8');
    console.log(`\nWrote ${path}`);
  }
}

main();
