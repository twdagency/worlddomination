import { describe, expect, it } from 'vitest';
import { terminal } from '../theme/terminal';
import { dispatchAccent } from './dispatchAccent';

describe('dispatchAccent', () => {
  it('separates combat, production, and influence traffic', () => {
    expect(dispatchAccent('battle')).toBe(terminal.danger);
    expect(dispatchAccent('secured')).toBe(terminal.accent);
    expect(dispatchAccent('culturalCampaignApplied')).toBe(terminal.stale);
    expect(dispatchAccent('diplomaticMissionStarted')).toBe(terminal.stale);
    expect(dispatchAccent('coupSuccess')).toBe(terminal.warning);
    expect(dispatchAccent('annexationCompleted')).toBe(terminal.warning);
  });
});
