import { describe, expect, it, vi } from 'vitest';
import { deepLinkForInfluenceAction, navigateTo } from '../src/navigation/deepLinks';

describe('influence deep links', () => {
  it('routes presetInfluenceAction to Order influence mode', () => {
    expect(deepLinkForInfluenceAction('territory-paris', 'coup-attempt')).toEqual({
      tab: 'actions',
      screen: 'order',
      orderMode: 'influence',
      presetCityId: 'territory-paris',
      presetInfluenceAction: 'coup-attempt',
    });

    const navigate = vi.fn();
    navigateTo({ navigate } as never, deepLinkForInfluenceAction('territory-paris', 'defection-claim'));

    expect(navigate).toHaveBeenCalledWith('Actions', {
      screen: 'Order',
      params: {
        orderMode: 'influence',
        presetCityId: 'territory-paris',
        presetInfluenceAction: 'defection-claim',
      },
    });
  });

  it('presets gather-intelligence and tribute-cancel onto the Order screen', () => {
    expect(deepLinkForInfluenceAction('territory-paris', 'gather-intelligence')).toMatchObject({
      tab: 'actions',
      screen: 'order',
      orderMode: 'influence',
      presetInfluenceAction: 'gather-intelligence',
    });
    expect(deepLinkForInfluenceAction('territory-paris', 'tribute-cancel')).toMatchObject({
      tab: 'actions',
      screen: 'order',
      orderMode: 'influence',
      presetInfluenceAction: 'tribute-cancel',
    });
  });
});
