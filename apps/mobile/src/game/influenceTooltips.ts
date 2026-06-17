import type { InfluenceOrderActionKind } from '../game/influenceSelector';
import type { TooltipDefinition } from '../components/tooltip/types';

type InfluenceActionTooltipKind = Exclude<InfluenceOrderActionKind, 'tribute-cancel'>;

export type { InfluenceActionTooltipKind };

export const INFLUENCE_CARD_FIRST_VIEW_TOOLTIP: TooltipDefinition = {
  id: 'influence-card-first-view',
  title: 'Influence',
  body: 'Influence accumulates over foreign cities. At 30 influence you can pressure their leaders; at 100 they peacefully defect to you.',
  dismissable: true,
  persistDismissal: true,
};

export const INFLUENCE_ACTION_TOOLTIPS: Record<InfluenceActionTooltipKind, TooltipDefinition> = {
  'diplomatic-mission': {
    id: 'tooltip-influence-diplomatic-mission',
    title: 'Diplomatic Mission',
    body: 'Send an envoy to double your passive influence accumulation in this city for 14 days. Mission ends if hostilities arise.',
    dismissable: true,
    showOncePerSession: true,
  },
  'cultural-campaign': {
    id: 'tooltip-influence-cultural-campaign',
    title: 'Cultural Campaign',
    body: 'Spend gold for a +10 influence burst. Each city has a 30-day cooldown before another campaign.',
    dismissable: true,
    showOncePerSession: true,
  },
  'influence-subversion': {
    id: 'tooltip-influence-subversion',
    title: 'Subversion',
    body: 'Covert operation adding +20 influence with a discovery risk. Exposure damages your reputation with the target.',
    dismissable: true,
    showOncePerSession: true,
  },
  'diplomatic-pressure': {
    id: 'tooltip-influence-diplomatic-pressure',
    title: 'Diplomatic Pressure',
    body: 'At 30+ influence, force acceptance of a pending alliance or treaty you proposed. Costs gold and reputation.',
    dismissable: true,
    showOncePerSession: true,
  },
  'tribute-extraction': {
    id: 'tooltip-influence-tribute-extraction',
    title: 'Tribute Extraction',
    body: 'At 50+ influence, drain gold daily from the city. Resentment can spark rebellion if left unchecked.',
    dismissable: true,
    showOncePerSession: true,
  },
  'coup-attempt': {
    id: 'tooltip-influence-coup-attempt',
    title: 'Coup Attempt',
    body: 'At 70+ influence, attempt a violent seizure (~60% base success). Costs gold and manpower; failure collapses your influence.',
    dismissable: true,
    showOncePerSession: true,
  },
  'defection-claim': {
    id: 'tooltip-influence-defection-claim',
    title: 'Defection',
    body: 'At 100 influence, the city peacefully transfers to you with no RNG and no gold cost. All influence in the city is consumed.',
    dismissable: true,
    showOncePerSession: true,
  },
};

export const TERRITORY_INFLUENCE_SOURCES_TOOLTIP: TooltipDefinition = {
  id: 'tooltip-territory-influence-sources',
  title: 'Influence sources',
  body: 'Passive sources include proximity, alliances, treaties, trade, culture, and scout presence. Missions double positive accrual.',
  dismissable: true,
  showOncePerSession: true,
};

export const TERRITORY_INFLUENCE_NET_TOOLTIP: TooltipDefinition = {
  id: 'tooltip-territory-influence-net',
  title: 'Net rate',
  body: 'Net daily change from all sources. Without active sources, influence decays toward zero at 1 per day.',
  dismissable: true,
  showOncePerSession: true,
};

export const TERRITORY_INFLUENCE_THRESHOLD_TOOLTIP: TooltipDefinition = {
  id: 'tooltip-territory-influence-threshold',
  title: 'Threshold proximity',
  body: 'Threshold actions unlock at 30 (pressure), 50 (tribute), 70 (coup), and 100 (defection) influence.',
  dismissable: true,
  showOncePerSession: true,
};
