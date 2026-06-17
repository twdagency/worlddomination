import type { Dilemma } from 'shared';

export const FOREIGN_RULE_DILEMMA: Dilemma = {
  id: 'foreign-rule',
  title: 'The fall of France',
  // Campaign-defining conquest moment — must surface as a blocking crisis modal.
  urgency: 'crisis',
  prompt:
    'Paris has fallen. Henry IV is defeated. The lands of France are yours — but the people are not. You must decide how to administer this conquered country.',
  options: [
    {
      id: 'harsh-repression',
      label: 'Harsh repression',
      description:
        'Crush dissent. Extract maximum value. Other nations will note your cruelty.',
      consequences: [
        { kind: 'resourceDelta', resource: 'gold', amount: 200 },
        { kind: 'standingDelta', amount: -30 },
        { kind: 'reputationDelta', target: 'all-others', amount: -15 },
      ],
      identityShift: { tags: ['authoritarian', 'harsh'] },
    },
    {
      id: 'conciliation',
      label: 'Conciliation and integration',
      description:
        'Win hearts. Build loyalty. The path is slow but the foundation is solid.',
      consequences: [
        { kind: 'resourceDelta', resource: 'gold', amount: 50 },
        { kind: 'standingDelta', amount: 20 },
        { kind: 'reputationDelta', target: 'all-others', amount: 10 },
      ],
      identityShift: { tags: ['liberal', 'merciful'] },
    },
    {
      id: 'exploit-extract',
      label: 'Exploit and extract',
      description: 'Strip the city of its wealth. Worry about consequences later.',
      consequences: [
        { kind: 'resourceDelta', resource: 'gold', amount: 400 },
        { kind: 'standingDelta', amount: -40 },
        { kind: 'reputationDelta', target: 'all-others', amount: -25 },
      ],
      identityShift: { tags: ['mercantilist', 'harsh'] },
    },
  ],
};
