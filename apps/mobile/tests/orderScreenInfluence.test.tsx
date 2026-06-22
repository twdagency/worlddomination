import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('order screen influence mode', () => {
  it('renders move, build, and influence mode segment', () => {
    const order = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );
    const segment = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/OrderModeSegment.tsx'),
      'utf8',
    );
    expect(order).toContain('OrderModeSegment');
    expect(segment).toContain('testID={`order-mode-${entry.id}`}');
    expect(segment).toContain("id: 'influence'");
  });

  it('renders three accelerator and four threshold action cards', () => {
    const panel = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/OrderInfluencePanel.tsx'),
      'utf8',
    );
    const catalog = fs.readFileSync(
      path.resolve(__dirname, '../src/game/influenceSelector.ts'),
      'utf8',
    );
    expect(panel).toContain('Accelerators');
    expect(panel).toContain('Threshold actions');
    expect(catalog).toContain("'diplomatic-mission'");
    expect(catalog).toContain("'defection-claim'");
  });

  it('shows rejection reason on disabled actions', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/OrderInfluencePanel.tsx'),
      'utf8',
    );
    expect(source).toContain('actionCardDisabled');
    expect(source).toContain('influence-action-rejection-');
  });

  it('executes influence orders through issueInfluence', () => {
    const order = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );
    const panel = fs.readFileSync(
      path.resolve(__dirname, '../src/components/influence/OrderInfluencePanel.tsx'),
      'utf8',
    );
    expect(order).toContain('issueInfluence');
    expect(panel).toContain('influence-action-execute-');
  });
});
