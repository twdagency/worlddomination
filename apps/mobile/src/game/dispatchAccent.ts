import { terminal } from '../theme/terminal';

const COMBAT_DANGER = new Set(['battle']);
const COMBAT_WARNING = new Set(['withdrawal']);
const PRODUCTION = new Set(['income', 'production', 'buildStarted', 'infraUpgraded', 'secured']);
const INFLUENCE_THRESHOLD = new Set([
  'diplomaticPressureApplied',
  'tributeStarted',
  'tributeMinorRebellion',
  'tributeMajorRebellion',
  'coupSuccess',
  'coupFailure',
  'defectionOccurred',
  'annexationCompleted',
  'subversionDiscovered',
]);
const INFLUENCE_ROUTINE = new Set([
  'diplomaticMissionStarted',
  'diplomaticMissionExpired',
  'diplomaticMissionExpelled',
  'culturalCampaignApplied',
  'intelReport',
]);

/** Color token for a dispatch kind so influence, combat, and production scan apart. */
export function dispatchAccent(kind: string): string {
  if (COMBAT_DANGER.has(kind)) return terminal.danger;
  if (COMBAT_WARNING.has(kind) || kind === 'buildBlocked') return terminal.warning;
  if (PRODUCTION.has(kind)) return terminal.accent;
  if (INFLUENCE_THRESHOLD.has(kind)) return terminal.warning;
  if (INFLUENCE_ROUTINE.has(kind)) return terminal.stale;
  return terminal.text;
}
