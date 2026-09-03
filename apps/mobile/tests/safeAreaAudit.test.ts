import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SCREENS_DIR = path.resolve(__dirname, '../src/screens');
/** Menu shell sits outside tab navigation and applies insets manually. */
const MANUAL_INSET_ALLOWED = new Set(['LandingScreen.tsx']);

describe('safe area audit', () => {
  it('no screen root uses SafeAreaView', () => {
    const files = fs.readdirSync(SCREENS_DIR).filter((file) => file.endsWith('.tsx'));
    const offenders: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
      if (/SafeAreaView/.test(source)) {
        offenders.push(file);
      }
      if (/paddingTop:\s*.*statusBar|useSafeAreaInsets/.test(source)) {
        if (!MANUAL_INSET_ALLOWED.has(file)) {
          offenders.push(`${file} (manual top inset)`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
