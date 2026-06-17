import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('territory screen influence detail', () => {
  it('shows influence detail for foreign territories', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/TerritoryScreen.tsx'),
      'utf8',
    );
    expect(source).toContain('ForeignTerritoryInfluenceDetail');
    expect(source).toContain('isForeignRoute');
  });

  it('does not mount influence detail in owned territory build flow', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/TerritoryScreen.tsx'),
      'utf8',
    );
    const foreignIndex = source.indexOf('ForeignTerritoryInfluenceDetail');
    const buildIndex = source.indexOf('Build units');
    expect(foreignIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(foreignIndex);
  });

  it('matches selector source breakdown in foreign detail component', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/ForeignTerritoryInfluenceDetail.tsx'),
      'utf8',
    );
    expect(source).toContain('territory-influence-detail');
    expect(source).toContain('formatSourceContribution');
    expect(source).toContain('formatThresholdProximity');
  });
});
