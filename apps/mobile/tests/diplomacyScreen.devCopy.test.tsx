import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DIPLOMACY_SCREEN = path.resolve(__dirname, '../src/screens/DiplomacyScreen.tsx');

describe('DiplomacyScreen player copy', () => {
  it('replaces dev-facing diplomacy hint with player-facing copy', () => {
    const source = fs.readFileSync(DIPLOMACY_SCREEN, 'utf8');
    expect(source).not.toContain('Player actions are unconditional');
    expect(source).toContain(
      'Propose alliances and treaties to other leaders. Your standing and their disposition affect their decisions.',
    );
  });
});
