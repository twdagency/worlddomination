import { describe, expect, it } from 'vitest';
import { createSprint4World, resolvePlayerFactionId } from 'shared';
import {
  formatFactionIdentityLine,
  getFactionIdentity,
  territoriesOwnedByFaction,
} from './factionDisplay';

const START_MS = 1_700_000_000_000;

describe('factionDisplay', () => {
  it('formats player identity with owned cities', () => {
    const world = createSprint4World(START_MS);
    const playerId = resolvePlayerFactionId(world)!;
    const identity = getFactionIdentity(world, playerId);
    expect(identity.primaryLine).toBe('Elizabeth — Britain');
    expect(identity.compactLine).toBe('Elizabeth of Britain');
    expect(identity.territoryNames).toContain('London');
  });

  it('formats AI faction with leader and holdings', () => {
    const world = createSprint4World(START_MS);
    const identity = getFactionIdentity(world, 'faction-rome');
    expect(identity.primaryLine).toBe('Caesar — Rome');
    expect(formatFactionIdentityLine(identity)).toMatch(/Paris/);
  });

  it('uses Philip II for the Spain faction at Madrid', () => {
    const world = createSprint4World(START_MS);
    const identity = getFactionIdentity(world, 'faction-britain');
    expect(identity.leaderName).toBe('Philip II');
    expect(identity.countryName).toBe('Spain');
    expect(territoriesOwnedByFaction(world, 'faction-britain')).toEqual(['Madrid']);
  });
});
