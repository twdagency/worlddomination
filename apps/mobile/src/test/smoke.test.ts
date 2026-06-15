import { describe, expect, it } from 'vitest';
import { PLAYER_FACTION_ID } from '../game/playerView';

describe('mobile test harness', () => {
  it('resolves workspace aliases and mobile modules', () => {
    expect(PLAYER_FACTION_ID).toBe('faction-player');
  });
});
