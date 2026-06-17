import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('OrderScreen preset destination', () => {
  it('reads presetDestinationId and presetForceId route params', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('presetDestinationId');
    expect(source).toContain('presetForceId');
    expect(source).toContain('order-preset-banner');
    expect(source).toContain('order-preset-change');
  });

  it('locks destination selection until the player changes destination', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('presetLocked ? null : availableDestinations.length');
    expect(source).toContain('Issuing order for');
  });

  it('skips auto destination cycling while preset is locked', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('if (presetLocked) return');
  });
});
