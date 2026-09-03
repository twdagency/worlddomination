import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { INFLUENCE_ACTION_TOOLTIPS } from '../src/game/influenceTooltips';

describe('influence action tooltips', () => {
  it('renders info icons on action cards', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/OrderInfluencePanel.tsx'),
      'utf8',
    );
    expect(source).toContain('TooltipInfoIcon');
    expect(source).toContain('influence-action-info-');
  });

  it('defines tooltip copy for each influence action', () => {
    const kinds = [
      'diplomatic-mission',
      'cultural-campaign',
      'influence-subversion',
      'diplomatic-pressure',
      'tribute-extraction',
      'coup-attempt',
      'annexation-claim',
      'defection-claim',
    ] as const;

    for (const kind of kinds) {
      const tooltip = INFLUENCE_ACTION_TOOLTIPS[kind];
      expect(tooltip.id).toContain('tooltip-influence');
      expect(tooltip.body.length).toBeGreaterThan(20);
      expect(tooltip.showOncePerSession).toBe(true);
      expect(tooltip.persistDismissal).toBeFalsy();
    }
  });
});
