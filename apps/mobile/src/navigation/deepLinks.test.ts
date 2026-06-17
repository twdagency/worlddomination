import { describe, expect, it, vi } from 'vitest';
import { navigateTo } from './deepLinks';

describe('deepLinks.navigateTo', () => {
  it('opens Dispatches on the Home stack', () => {
    const navigate = vi.fn();
    navigateTo({ navigate } as never, { tab: 'home', screen: 'dispatches' });

    expect(navigate).toHaveBeenCalledWith('Dashboard', {
      screen: 'Dispatches',
      params: {
        dispatchId: undefined,
        unreadOnly: undefined,
      },
    });
  });

  it('opens Dispatches scrolled to a specific dispatch', () => {
    const navigate = vi.fn();
    navigateTo({ navigate } as never, {
      tab: 'home',
      screen: 'dispatches',
      dispatchId: 'evt-battle-42',
    });

    expect(navigate).toHaveBeenCalledWith('Dashboard', {
      screen: 'Dispatches',
      params: {
        dispatchId: 'evt-battle-42',
        unreadOnly: undefined,
      },
    });
  });

  it('cross-stacks to the Order screen on Actions', () => {
    const navigate = vi.fn();
    navigateTo({ navigate } as never, { tab: 'actions', screen: 'order' });

    expect(navigate).toHaveBeenCalledWith('Actions', { screen: 'Order' });
  });
});
