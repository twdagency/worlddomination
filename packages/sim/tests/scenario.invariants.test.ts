import { describe, expect, it } from 'vitest';
import { resolvePlayerFactionId } from 'shared';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { createSprint5World } from '../../shared/src/scenario-sprint5';
import { createTutorialWorld } from '../../shared/src/scenario-tutorial';

const START_MS = 1_700_000_000_000;

const scenarios = [
  { name: 'sprint-4', factory: createSprint4World },
  { name: 'sprint-5', factory: createSprint5World },
  { name: 'tutorial', factory: createTutorialWorld },
] as const;

describe('scenario invariants — apply to all shipped scenarios', () => {
  scenarios.forEach(({ name, factory }) => {
    it(`${name}: no two factions share a leaderId`, () => {
      const world = factory(START_MS);
      const leaderIds = Object.values(world.factions).map((faction) => faction.leaderId);
      const unique = new Set(leaderIds);
      expect(unique.size).toBe(leaderIds.length);
    });

    it(`${name}: every faction has a leader assigned`, () => {
      const world = factory(START_MS);
      for (const faction of Object.values(world.factions)) {
        expect(world.leaders[faction.leaderId]).toBeDefined();
      }
    });

    it(`${name}: exactly one faction has isPlayer=true`, () => {
      const world = factory(START_MS);
      const playerFactions = Object.values(world.factions).filter((faction) => faction.isPlayer);
      expect(playerFactions).toHaveLength(1);
    });

    it(`${name}: resolvePlayerFactionId returns valid faction`, () => {
      const world = factory(START_MS);
      const playerId = resolvePlayerFactionId(world);
      expect(playerId).toBeDefined();
      expect(world.factions[playerId!]).toBeDefined();
      expect(world.factions[playerId!]?.isPlayer).toBe(true);
    });
  });
});
