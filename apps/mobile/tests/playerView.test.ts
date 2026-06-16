import { describe, expect, it } from 'vitest';
import { createSprint4World, createTutorialWorld, resolvePlayerFactionId } from 'shared';
import {
  getDashboardEmpireSummary,
  playerMovableUnits,
  playerOwnedTerritories,
} from '../src/game/playerView';

const START_MS = 1_700_000_000_000;
const TUTORIAL_FUNDING = 8_000;

describe('playerView faction resolution', () => {
  it('tutorial world returns Britain-tutorial faction state with correct funding', () => {
    const world = createTutorialWorld(START_MS);
    expect(resolvePlayerFactionId(world)).toBe('faction-britain-tutorial');

    const summary = getDashboardEmpireSummary(world);
    expect(summary?.factionId).toBe('faction-britain-tutorial');
    expect(summary?.funding).toBe(TUTORIAL_FUNDING);

    const units = playerMovableUnits(world);
    expect(units.length).toBeGreaterThanOrEqual(1);
    expect(units.every((unit) => unit.ownerId === 'faction-britain-tutorial')).toBe(true);
  });

  it('sprint-4 world returns player state correctly', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world);

    expect(playerId).toBeDefined();
    expect(world.factions[playerId!]?.isPlayer).toBe(true);

    const summary = getDashboardEmpireSummary(world);
    expect(summary?.factionId).toBe(playerId);
    expect(summary?.funding).toBe(world.factions[playerId!]?.funding);

    const owned = playerOwnedTerritories(world);
    expect(owned.every((territory) => territory.ownerId === playerId)).toBe(true);
  });

  it('falls back gracefully when no isPlayer faction exists', () => {
    const world = createSprint4World(START_MS);
    const withoutPlayer = {
      ...world,
      factions: Object.fromEntries(
        Object.entries(world.factions).map(([id, faction]) => [
          id,
          { ...faction, isPlayer: false },
        ]),
      ),
    };

    expect(resolvePlayerFactionId(withoutPlayer)).toBeUndefined();
    expect(getDashboardEmpireSummary(withoutPlayer)).toBeNull();
    expect(playerMovableUnits(withoutPlayer)).toEqual([]);
  });

  it('resolvePlayerFactionId returns undefined for empty factions', () => {
    const world = {
      ...createSprint4World(START_MS),
      factions: {},
    };

    expect(resolvePlayerFactionId(world)).toBeUndefined();
  });
});
