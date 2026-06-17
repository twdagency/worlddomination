import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('influence tooltip contracts (Sprint 9 Phase 9)', () => {
  it('tooltip provider mounts at app root above navigation', () => {
    const app = fs.readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');
    expect(app).toContain('TooltipProvider');
    expect(app).toContain('<RootTabs />');
  });

  it('dashboard influence card uses persistent first-view tooltip', () => {
    const card = fs.readFileSync(
      path.resolve(__dirname, '../src/components/dashboard/InfluenceCard.tsx'),
      'utf8',
    );
    expect(card).toContain('INFLUENCE_CARD_FIRST_VIEW_TOOLTIP');
    expect(card).toContain('trigger="first-mount"');
    expect(card).toContain('mountDelayMs={500}');
  });
});
