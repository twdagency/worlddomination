export const STORAGE_KEYS = {
  world: '@worlddomination/world',
  dispatches: '@worlddomination/dispatches',
  lastActiveMs: '@worlddomination/lastActiveMs',
  lastViewedDispatchesAt: '@worlddomination/lastViewedDispatchesAt',
  scenarioId: '@worlddomination/scenarioId',
  tutorialOnboarded: '@worlddomination/tutorialOnboarded',
} as const;

export const terminal = {
  bg: '#0a0e14',
  card: '#121820',
  border: '#2a3544',
  text: '#c9d1d9',
  muted: '#6e7681',
  stale: '#8b949e',
  accent: '#3fb950',
  tutorial: '#56d364',
  warning: '#d29922',
  danger: '#f85149',
  mono: 'monospace' as const,
};
