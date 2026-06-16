export interface IdentityShift {
  tags: string[];
}

export interface DilemmaConsequenceResourceDelta {
  kind: 'resourceDelta';
  resource: 'gold';
  amount: number;
}

export interface DilemmaConsequenceReputationDelta {
  kind: 'reputationDelta';
  target: 'all-others';
  amount: number;
}

export interface DilemmaConsequenceStandingDelta {
  kind: 'standingDelta';
  amount: number;
}

export interface DilemmaConsequenceTerritoryEffect {
  kind: 'territoryEffect';
  effect: string;
}

export type DilemmaConsequence =
  | DilemmaConsequenceResourceDelta
  | DilemmaConsequenceReputationDelta
  | DilemmaConsequenceStandingDelta
  | DilemmaConsequenceTerritoryEffect;

export interface DilemmaOption {
  id: string;
  label: string;
  description: string;
  consequences: DilemmaConsequence[];
  identityShift: IdentityShift;
}

export interface Dilemma {
  id: string;
  title: string;
  prompt: string;
  options: DilemmaOption[];
}
