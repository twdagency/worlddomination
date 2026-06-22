import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('dashboard influence card', () => {
  it('mounts InfluenceCard between country status and active forces', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DashboardScreen.tsx'),
      'utf8',
    );
    const countryIndex = source.indexOf('<CountryStatusCard');
    const influenceIndex = source.indexOf('<InfluenceCard');
    const forcesIndex = source.indexOf('<ActiveForcesCard');
    expect(countryIndex).toBeGreaterThan(-1);
    expect(influenceIndex).toBeGreaterThan(countryIndex);
    expect(forcesIndex).toBeGreaterThan(influenceIndex);
  });

  it('renders empty state copy when influence summary is present', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/components/dashboard/InfluenceCard.tsx'),
      'utf8',
    );
    expect(source).toContain('dashboard-influence-empty');
    expect(source).toContain('diplomatic missions');
  });

  it('opens influence actions via deep link', () => {
    const dashboard = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/DashboardScreen.tsx'),
      'utf8',
    );
    const card = fs.readFileSync(
      path.resolve(__dirname, '../src/components/dashboard/InfluenceCard.tsx'),
      'utf8',
    );
    expect(dashboard).toContain("orderMode: 'influence'");
    expect(card).toContain('dashboard-influence-open-actions');
  });
});
