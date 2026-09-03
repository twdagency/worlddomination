import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatSummary, parseArgs, resolveJobs, SUITES } from './test-harness.mjs';

describe('test harness', () => {
  it('defaults to sim then mobile', () => {
    const jobs = resolveJobs([]);
    assert.deepEqual(
      jobs.map((job) => job.name),
      ['sim', 'mobile'],
    );
  });

  it('resolves the game suite to scenario/tutorial/conquest/victory filters', () => {
    const [job] = resolveJobs(['game']);
    assert.equal(job.package, 'sim');
    assert.deepEqual(job.filters, [
      'scenario',
      'tutorial',
      'player.conquest',
      'victory.lastStanding',
    ]);
  });

  it('treats unknown tokens as extra vitest filters on the chosen suite', () => {
    const [job] = resolveJobs(['sim', 'scenario.startArmy']);
    assert.equal(job.name, 'sim');
    assert.deepEqual(job.filters, ['scenario.startArmy']);
  });

  it('defaults unknown filters onto sim when no suite is named', () => {
    const [job] = resolveJobs(['scenario.startArmy']);
    assert.equal(job.name, 'sim');
    assert.deepEqual(job.filters, ['scenario.startArmy']);
  });

  it('parses flags and positionals', () => {
    const parsed = parseArgs(['game', '--watch', '--list']);
    assert.deepEqual([...parsed.flags], ['--watch', '--list']);
    assert.deepEqual(parsed.positionals, ['game']);
  });

  it('formats a summary with fail status', () => {
    const text = formatSummary([
      { name: 'game', code: 0, tests: '42 passed (42)' },
      { name: 'mobile', code: 1, tests: '4 failed | 26 passed (30)' },
    ]);
    assert.match(text, /game\s+ok/);
    assert.match(text, /mobile\s+FAIL/);
  });

  it('exposes the named suites', () => {
    assert.ok(SUITES.game && SUITES.influence && SUITES.coldplay);
  });
});
