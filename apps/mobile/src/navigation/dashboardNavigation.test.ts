import { describe, expect, it } from 'vitest';
import { resolveDashboardNavigation, resolveDashboardTarget } from './dashboardNavigation';

describe('dashboard navigation resolution', () => {
  it('maps primary tabs directly', () => {
    expect(resolveDashboardNavigation('Dispatches')).toEqual({ tab: 'Dispatches' });
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
