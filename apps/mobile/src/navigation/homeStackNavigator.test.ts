import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  HOME_STACK_DETAIL_SCREENS,
  HOME_STACK_SCREEN_OPTIONS,
} from '../navigation/homeStackConfig';

const NAV_DIR = path.resolve(__dirname, '../navigation');
const SCREENS_DIR = path.resolve(__dirname, '../screens');

describe('home stack navigation', () => {
  it('hides the native stack header for detail screens', () => {
    expect(HOME_STACK_SCREEN_OPTIONS.headerShown).toBe(false);
  });

  it('registers DashboardHome as the stack root with Dispatches pushable', () => {
    const source = fs.readFileSync(path.join(NAV_DIR, 'HomeStackNavigator.tsx'), 'utf8');
    expect(source).toContain('name="DashboardHome"');
    expect(source).toContain('component={DashboardScreen}');
    expect(source).toContain('name="Dispatches"');
    expect(source).toContain('component={DispatchesScreen}');
    expect(HOME_STACK_DETAIL_SCREENS).toEqual(['Dispatches']);
  });

  it('Dispatches detail screen renders an in-screen back button', () => {
    const source = fs.readFileSync(path.join(SCREENS_DIR, 'DispatchesScreen.tsx'), 'utf8');
    expect(source).toContain('ScreenBackButton');
    expect(source).toContain('label="Home"');
  });
});
