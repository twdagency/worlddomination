import type { Leader } from 'sim';

export const LEADERS: Leader[] = [
  {
    id: 'leader-alexander',
    name: 'Alexander',
    region: 'Macedon',
    era: 'Classical',
    weights: { aggression: 9, risk: 7, economy: 4, expansion: 10, scoutingPriority: 'broad' },
    traits: { landSpeedMult: 1.15, attackCombatMod: 1.1 },
    tempo: 'fast',
  },
  {
    id: 'leader-caesar',
    name: 'Caesar',
    region: 'Rome',
    era: 'Classical',
    weights: { aggression: 8, risk: 6, economy: 7, expansion: 8, scoutingPriority: 'broad' },
    traits: { incomeMult: 1.1, buildTimeMult: 0.95 },
    tempo: 'steady',
  },
  {
    id: 'leader-genghis',
    name: 'Genghis',
    region: 'Steppe',
    era: 'Medieval',
    weights: { aggression: 10, risk: 8, economy: 3, expansion: 9, scoutingPriority: 'aggressive' },
    traits: { landSpeedMult: 1.25, attackCombatMod: 1.15 },
    tempo: 'fast',
  },
  {
    id: 'leader-elizabeth',
    name: 'Elizabeth',
    region: 'Britain',
    era: 'Early Modern',
    weights: { aggression: 5, risk: 4, economy: 9, expansion: 7, scoutingPriority: 'defensive' },
    traits: { incomeMult: 1.2, seaSpeedMult: 1.15, homeDefenseCombatMod: 1.1 },
    tempo: 'slow',
  },
];

export const LEADERS_BY_ID: Record<string, Leader> = Object.fromEntries(
  LEADERS.map((l) => [l.id, l]),
);
