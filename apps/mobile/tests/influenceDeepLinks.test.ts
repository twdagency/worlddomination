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
});
