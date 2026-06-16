import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import { createTutorialWorld } from 'shared';
import { diplomacyTargetFactionIds, diplomacyTargetFactions } from './diplomacySelector';

const START_MS = 1_700_000_000_000;

describe('diplomacySelector', () => {
  it('excludes the sprint-4 player faction from diplomacy targets', () => {
    const world = createSprint4World(START_MS);
    const targets = diplomacyTargetFactionIds(world);

    expect(targets).not.toContain('faction-player');
    expect(targets).toHaveLength(3);
  });

  it('excludes the tutorial player faction from diplomacy targets', () => {
    const world = createTutorialWorld(START_MS);
    const targets = diplomacyTargetFactions(world);

    expect(targets.some((faction) => faction.isPlayer)).toBe(false);
    expect(targets).toHaveLength(2);
    expect(targets.map((faction) => faction.id)).not.toContain('faction-britain-tutorial');
  });

  it('returns empty when world has only the player faction', () => {
    const world = createTutorialWorld(START_MS);
    const lonePlayer = {
      ...world,
      factions: {
        'faction-britain-tutorial': world.factions['faction-britain-tutorial']!,
      },
    };

    expect(diplomacyTargetFactionIds(lonePlayer)).toEqual([]);
  });
});
