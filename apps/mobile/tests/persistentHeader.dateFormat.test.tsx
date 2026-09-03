import { describe, expect, it } from 'vitest';
import { formatGameClock, formatGameClockDate, formatGameClockTime } from '../src/utils/format';

describe('PersistentHeader date format', () => {
  it('uses a locale-stable Sep + 24h clock', () => {
    const at = new Date(2026, 8, 4, 18, 53).getTime();
    expect(formatGameClockDate(at)).toBe('4 Sep');
    expect(formatGameClockTime(at)).toBe('18:53');
    expect(formatGameClock(at)).toBe('4 Sep · 18:53');
    expect(formatGameClock(at)).not.toMatch(/Sept|Mon|Tue|Wed|Thu|Fri|Sat|Sun|AM|PM/i);
  });
});
