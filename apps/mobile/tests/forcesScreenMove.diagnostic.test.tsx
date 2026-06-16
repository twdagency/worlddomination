import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('forces screen move integration diagnostics (#21)', () => {
  it('DIAGNOSTIC: ForcesScreen does not navigate to Order with presetForceId', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/screens/ForcesScreen.tsx'),
      'utf8',
    );

    expect(source).not.toContain('presetForceId');
    expect(source).not.toContain('useNavigation');
    expect(source).not.toContain('navigate(');
  });

  it('DIAGNOSTIC: Order screen already reads presetForceId from route params', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../src/screens/OrderScreen.tsx'),
      'utf8',
    );

    expect(source).toContain('presetForceId');
    expect(source).toContain('route.params?.presetForceId');
  });
});
