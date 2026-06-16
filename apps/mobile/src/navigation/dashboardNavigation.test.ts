import { describe, expect, it } from 'vitest';
import { resolveDashboardNavigation, resolveDashboardTarget } from './dashboardNavigation';

describe('dashboard navigation resolution', () => {
  it('routes dispatches through the Home stack', () => {
    expect(resolveDashboardNavigation('Dispatches')).toEqual({
      tab: 'Dashboard',
      stack: { screen: 'Dispatches' },
    });
    expect(
      resolveDashboardNavigation('Dispatches', { dispatchId: 'evt-battle-1' }),
    ).toEqual({
      tab: 'Dashboard',
      stack: { screen: 'Dispatches', params: { dispatchId: 'evt-battle-1' } },
    });
  });

  it('maps World tab directly', () => {
    expect(resolveDashboardNavigation('World')).toEqual({ tab: 'World' });
  });

  it('routes task screens through the Actions stack', () => {
    expect(resolveDashboardNavigation('Order')).toEqual({
      tab: 'Actions',
      stack: { screen: 'Order' },
    });
  });

  it('passes diplomacy faction expansion params', () => {
    expect(
      resolveDashboardTarget({
        screen: 'Diplomacy',
        factionId: 'faction-rome',
      }),
    ).toEqual({
      tab: 'Actions',
      stack: {
        screen: 'Diplomacy',
        params: { expandFactionId: 'faction-rome' },
      },
    });
  });

  it('passes territory drill-down params', () => {
    expect(
      resolveDashboardTarget({
        screen: 'Territory',
        territoryId: 'territory-london',
      }),
    ).toEqual({
      tab: 'Actions',
      stack: {
        screen: 'Territory',
        params: { territoryId: 'territory-london' },
      },
    });
  });
});
