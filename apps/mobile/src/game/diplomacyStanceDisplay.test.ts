import { describe, expect, it } from 'vitest';
import { formatStanceDetail, stanceTone } from './diplomacyStanceDisplay';

describe('diplomacy stance display', () => {
  it('maps stance labels to tone bands', () => {
    expect(stanceTone('Hostile')).toBe('danger');
    expect(stanceTone('Defensive')).toBe('warning');
    expect(stanceTone('Developing')).toBe('accent');
    expect(stanceTone('Unknown')).toBe('muted');
  });

  it('formats tertiary disclosure copy', () => {
    expect(formatStanceDetail('Active')).toBe('Posture (24h observed orders): Active');
  });
});
