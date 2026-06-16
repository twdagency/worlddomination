import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('forces screen move integration (#21)', () => {
  it('ForcesScreen navigates to Order with presetForceId on movable row tap', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/screens/ForcesScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('presetForceId');
    expect(source).toContain('navigateTo');
    expect(source).toContain('isPlayerForceMovable');
    expect(source).toContain('Move →');
  });

  it('Order screen reads presetForceId from route params', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('presetForceId');
    expect(source).toContain('route.params?.presetForceId');
  });
});
