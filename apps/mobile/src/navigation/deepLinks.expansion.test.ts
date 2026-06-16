import { describe, expect, it, vi } from 'vitest';
import { deepLinkForEntity, navigateTo } from './deepLinks';

describe('deepLinkForEntity', () => {
  it('returns Territory screen target for territory entities', () => {
    expect(deepLinkForEntity({ kind: 'territory', id: 'territory-paris' })).toEqual({
      tab: 'actions',
      screen: 'territory',
      territoryId: 'territory-paris',
    });
  });

  it('returns World focusCountry for country view intent', () => {
    expect(deepLinkForEntity({ kind: 'country', id: 'faction-rome' })).toEqual({
      tab: 'world',
      focusCountryId: 'faction-rome',
    });
  });

  it('returns Order preset destination for territory order intent', () => {
    expect(deepLinkForEntity({ kind: 'territory', id: 'territory-paris' }, 'order')).toEqual({
      tab: 'actions',
      screen: 'order',
      presetDestinationId: 'territory-paris',
    });
  });

  it('returns null for leader entities (deferred)', () => {
    expect(deepLinkForEntity({ kind: 'leader', id: 'leader-caesar' })).toBeNull();
  });
});

describe('deepLinks.navigateTo cross-stack', () => {
  it('routes diplomacy focus through the Actions stack from another tab context', () => {
    const navigate = vi.fn();
    navigateTo({ navigate } as never, {
      tab: 'actions',
      screen: 'diplomacy',
      focusCountryId: 'faction-rome',
    });

    expect(navigate).toHaveBeenCalledWith('Actions', {
      screen: 'Diplomacy',
      params: { focusCountryId: 'faction-rome' },
    });
  });

  it('routes world focus through the World stack', () => {
    const navigate = vi.fn();
    navigateTo({ navigate } as never, {
      tab: 'world',
      focusTerritoryId: 'territory-paris',
    });

    expect(navigate).toHaveBeenCalledWith('World', {
      screen: 'WorldHome',
      params: {
        focusTerritoryId: 'territory-paris',
        focusCountryId: undefined,
      },
    });
  });
});
