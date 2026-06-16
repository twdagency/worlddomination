import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('DiplomacyScreen focus country', () => {
  it('supports focusCountryId route param and tappable country links', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DiplomacyScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('focusCountryId');
    expect(source).toContain('scrollToIndex');
    expect(source).toContain('diplomacy-country-link-');
    expect(source).toContain('diplomacy-capital-link-');
    expect(source).toContain('useFocusHighlight');
  });

  it('keeps diplomacy list rendering separate from focus handling', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DiplomacyScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('selectDiplomacyTargets');
    expect(source.indexOf('focusCountryId')).toBeLessThan(source.indexOf('renderItem'));
  });
});
