import { describe, expect, it } from 'vitest';
import { landingActions } from './landingMenu';

describe('landingActions', () => {
  it('offers start, tutorial, and options on a fresh install', () => {
    expect(landingActions(false).map((action) => action.id)).toEqual([
      'start',
      'tutorial',
      'options',
    ]);
  });

  it('puts continue first when a save exists', () => {
    expect(landingActions(true).map((action) => action.id)).toEqual([
      'continue',
      'start',
      'tutorial',
      'options',
    ]);
  });
});
