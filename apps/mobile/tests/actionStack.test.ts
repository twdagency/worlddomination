import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ACTION_STACK_SCREEN_OPTIONS,
  ACTION_STACK_TASK_SCREENS,
} from '../src/navigation/actionStackConfig';

const SCREENS_DIR = path.resolve(__dirname, '../src/screens');

describe('action stack navigation', () => {
  it('hides the native stack header for task screens', () => {
    expect(ACTION_STACK_SCREEN_OPTIONS.headerShown).toBe(false);
  });

  it('task screens render an in-screen back button', () => {
    const offenders: string[] = [];

    for (const screen of ACTION_STACK_TASK_SCREENS) {
      const file = `${screen}Screen.tsx`;
      const source = fs.readFileSync(path.join(SCREENS_DIR, file), 'utf8');
      if (!source.includes('ScreenBackButton')) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
