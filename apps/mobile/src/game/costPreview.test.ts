import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import {
  evaluateCostLines,
  infraUpgradeCostPreview,
  treatyOfferLine,
  unitBuildCostPreview,
} from './costPreview';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const PLAYER = 'faction-player';

describe('costPreview', () => {
  it('marks affordable when all lines meet requirements', () => {
    const preview = evaluateCostLines([
      { id: 'funding', label: 'Funding', required: 100, available: 500 },
      { id: 'manpower', label: 'Manpower', required: 10, available: 50 },
    ]);
    expect(preview.affordable).toBe(true);
    expect(preview.shortfallLabel).toBeUndefined();
  });

  it('surfaces first shortfall when funding is insufficient', () => {
    const preview = evaluateCostLines([
      { id: 'funding', label: 'Funding', required: 1_000, available: 200 },
    ]);
    expect(preview.affordable).toBe(false);
    expect(preview.shortfallLabel).toMatch(/funding/i);
  });

  it('computes infra upgrade cost from territory level', () => {
    const world = createSprint4World(START_MS);
    const preview = infraUpgradeCostPreview(world, LONDON, PLAYER);
    expect(preview.lines).toHaveLength(1);
    expect(preview.lines[0]?.required).toBeGreaterThan(0);
  });

  it('includes bill-of-materials lines for unit builds', () => {
    const world = createSprint4World(START_MS);
    const infantry = world.unitTypes['infantry-t2'];
    expect(infantry).toBeDefined();
    const preview = unitBuildCostPreview(world, LONDON, infantry!, PLAYER);
    expect(preview.lines.some((line) => line.id === 'funding')).toBe(true);
    expect(preview.lines.some((line) => line.id === 'manpower')).toBe(true);
  });

  it('formats treaty offer as a single cost line', () => {
    const line = treatyOfferLine('Paris');
    expect(line.label).toMatch(/Paris/);
  });
});
