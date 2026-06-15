import { describe, expect, it } from 'vitest';
import { formatCatchUpBody, formatCatchUpHeading } from './catchUpSummaryText';

describe('catchUp summary text', () => {
  it('formats current status copy', () => {
    const summary = {
      mode: 'current' as const,
      awayMs: 0,
      critical: [],
      notableCount: 0,
      routineCount: 0,
      totalCount: 0,
    };

    expect(formatCatchUpHeading(summary)).toBe('Current status');
    expect(formatCatchUpBody(summary)).toMatch(/no catch-up required/i);
  });

  it('formats away summary with categorized counts', () => {
    const summary = {
      mode: 'away' as const,
      awayMs: 6 * 3_600_000,
      critical: [{ id: '1', label: 'Alliance proposed', atMs: 1 }],
      notableCount: 2,
      routineCount: 5,
      totalCount: 8,
    };

    expect(formatCatchUpHeading(summary)).toMatch(/While you were away/i);
    expect(formatCatchUpBody(summary)).toMatch(/8 events occurred/i);
    expect(formatCatchUpBody(summary)).toMatch(/Notable: 2/i);
  });
});
