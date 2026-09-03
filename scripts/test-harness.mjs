#!/usr/bin/env node
/**
 * Local test harness for World Domination.
 *
 *   pnpm test:harness            sim + mobile
 *   pnpm test:harness game       scenario, tutorial, conquest, victory
 *   pnpm test:harness sim influence
 *   pnpm test:harness --list
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** @typedef {{ package: 'sim' | 'mobile'; filters?: string[]; label: string; blurb: string }} Suite */

/** @type {Record<string, Suite>} */
export const SUITES = {
  sim: {
    package: 'sim',
    label: 'Sim',
    blurb: 'All packages/sim unit and integration tests',
  },
  mobile: {
    package: 'mobile',
    label: 'Mobile',
    blurb: 'All apps/mobile unit tests (some UI files fail on act/env)',
  },
  game: {
    package: 'sim',
    filters: ['scenario', 'tutorial', 'player.conquest', 'victory.lastStanding'],
    label: 'Game',
    blurb: 'Scenario start, tutorial, conquest, and victory',
  },
  influence: {
    package: 'sim',
    filters: ['influence', 'aiInfluence', 'aiThreshold', 'aiIntelligence'],
    label: 'Influence',
    blurb: 'Influence layer + AI agency',
  },
  combat: {
    package: 'sim',
    filters: ['combat', 'arrivalCombat', 'movement', 'stance'],
    label: 'Combat',
    blurb: 'Battles, arrivals, movement, stance',
  },
  diplomacy: {
    package: 'sim',
    filters: ['diplomacy', 'reputation'],
    label: 'Diplomacy',
    blurb: 'Alliances, treaties, reputation',
  },
  dispatch: {
    package: 'sim',
    filters: ['dispatch', 'digest', 'reports'],
    label: 'Dispatch',
    blurb: 'Feed, digest, compaction',
  },
  ai: {
    package: 'sim',
    filters: ['ai.', 'aiInfluence', 'aiThreshold', 'aiIntelligence'],
    label: 'AI',
    blurb: 'Military and influence AI',
  },
  coldplay: {
    package: 'sim',
    filters: ['sprint-5.5', 'sprint-6', 'sprint-9.5', 'sprint-10', 'dispatch.snapshot', 'scenario.sprint5'],
    label: 'Cold-play',
    blurb: 'Long-window scenario snapshots',
  },
};

const ALL_SUITE_ORDER = ['sim', 'mobile'];

function printHelp() {
  console.log(`World Domination test harness

Usage:
  pnpm test:harness [suite...] [vitest filters...]
  pnpm test:harness --list
  pnpm test:harness game --watch

Suites:`);
  const names = ['all', ...Object.keys(SUITES)];
  for (const name of names) {
    if (name === 'all') {
      console.log('  all          sim then mobile (default)');
      continue;
    }
    const suite = SUITES[name];
    console.log(`  ${name.padEnd(12)} ${suite.blurb}`);
  }
  console.log(`
Examples:
  pnpm test:harness game
  pnpm test:harness sim scenario.startArmy
  pnpm test:harness mobile dashboard
`);
}

export function parseArgs(argv) {
  const flags = new Set();
  const positionals = [];
  for (const arg of argv) {
    if (arg === '--') continue;
    if (arg.startsWith('--')) flags.add(arg);
    else positionals.push(arg);
  }
  return { flags, positionals };
}

export function resolveJobs(positionals) {
  if (positionals.length === 0) {
    return ALL_SUITE_ORDER.map((name) => ({ name, ...SUITES[name] }));
  }

  /** @type {Array<{ name: string } & Suite>} */
  const jobs = [];
  const extraFilters = [];

  for (const token of positionals) {
    if (token === 'all') {
      jobs.push(...ALL_SUITE_ORDER.map((name) => ({ name, ...SUITES[name] })));
      continue;
    }
    const suite = SUITES[token];
    if (suite) {
      jobs.push({ name: token, ...suite });
    } else {
      extraFilters.push(token);
    }
  }

  if (jobs.length === 0) {
    jobs.push({ name: 'sim', ...SUITES.sim });
  }

  if (extraFilters.length === 0) return jobs;

  return jobs.map((job) => ({
    ...job,
    filters: [...(job.filters ?? []), ...extraFilters],
  }));
}

function parseVitestCounts(output) {
  const files = output.match(/Test Files\s+([^\n]+)/);
  const tests = output.match(/\n\s+Tests\s+([^\n]+)/);
  return {
    files: files?.[1]?.trim() ?? 'n/a',
    tests: tests?.[1]?.trim() ?? 'n/a',
  };
}

const PACKAGE_DIRS = {
  sim: path.join(ROOT, 'packages', 'sim'),
  mobile: path.join(ROOT, 'apps', 'mobile'),
};

function resolveVitestCli(pkg) {
  const require = createRequire(path.join(PACKAGE_DIRS[pkg], 'package.json'));
  return require.resolve('vitest/vitest.mjs');
}

function runVitest(pkg, filters, watch) {
  const args = watch ? [] : ['run'];
  if (filters?.length) args.push(...filters);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [resolveVitestCli(pkg), ...args], {
      cwd: PACKAGE_DIRS[pkg],
      env: process.env,
    });

    let output = '';
    child.stdout.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stdout.write(text);
    });
    child.stderr.on('data', (chunk) => {
      const text = String(chunk);
      output += text;
      process.stderr.write(text);
    });
    child.on('error', (error) => {
      console.error(error.message);
      resolve({ code: 1, files: 'n/a', tests: error.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? 1, ...parseVitestCounts(output) });
    });
  });
}

export function formatSummary(results) {
  const width = Math.max(...results.map((row) => row.name.length), 6);
  const lines = ['', 'Harness summary', `${'Suite'.padEnd(width)}  Exit  Tests`];
  for (const row of results) {
    const status = row.code === 0 ? 'ok' : 'FAIL';
    lines.push(`${row.name.padEnd(width)}  ${status.padEnd(4)}  ${row.tests}`);
  }
  return lines.join('\n');
}

async function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);

  if (flags.has('--help') || flags.has('-h')) {
    printHelp();
    return 0;
  }

  if (flags.has('--list')) {
    printHelp();
    return 0;
  }

  const watch = flags.has('--watch');
  const jobs = resolveJobs(positionals);

  if (watch && jobs.length > 1) {
    console.error('Watch mode accepts one suite. Example: pnpm test:harness game --watch');
    return 1;
  }

  console.log(`Harness: ${jobs.map((job) => job.name).join(', ')}`);

  const results = [];
  let failed = false;
  for (const job of jobs) {
    console.log(`\n── ${job.label} ──`);
    const result = await runVitest(job.package, job.filters, watch);
    results.push({ name: job.name, ...result });
    if (result.code !== 0) failed = true;
  }

  if (!watch) {
    console.log(formatSummary(results));
  }

  return failed ? 1 : 0;
}

const launchedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (launchedDirectly) {
  main().then((code) => {
    process.exit(code);
  });
}
