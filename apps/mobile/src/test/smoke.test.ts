import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';

describe('mobile test harness', () => {
  it('resolves workspace aliases and player faction helper', () => {
    const world = createSprint4World();
    expect(resolvePlayerFactionId(world)).toBeDefined();
  });
});
