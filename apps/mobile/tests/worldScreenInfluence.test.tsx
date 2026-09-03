import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { formatThresholdStars } from '../src/game/influenceDisplay';

describe('world screen influence indicators', () => {
  it('shows player influence value and threshold stars on territory rows', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/WorldScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('world-influence-');
    expect(source).toContain('formatInfluenceValue');
    expect(source).toContain('formatThresholdStars');
  });

  it('shows fogged competitor influence without exact values', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/WorldScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('formatFoggedActorInfluence');
    expect(source).not.toContain('competingActors.map((actor) => actor.actorName + actor.');
  });

  it('assigns threshold stars at 30, 70, and 100', () => {
    expect(formatThresholdStars(29)).toBe('');
    expect(formatThresholdStars(30)).toBe('★');
    expect(formatThresholdStars(70)).toBe('★★');
    expect(formatThresholdStars(100)).toBe('★★★');
  });
});

describe('world screen influence data', () => {
  it('does not show influence section for player-owned cities', () => {
    const w = ensureWorldMigrations(createSprint4World(), {
      leaders: LEADERS_BY_ID,
      unitTypes: UNIT_TYPES_BY_ID,
    });
    const london = Object.values(w.territories).find((t) => t.ownerId === 'faction-player');
    expect(london).toBeTruthy();
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/WorldScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('!playerOwnsCity');
  });
});
