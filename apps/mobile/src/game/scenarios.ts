import { createSprint4World, createSprint5World } from 'shared';
import type { WorldState } from 'sim';

export type DevScenarioId = 'sprint-4-ai-world' | 'sprint-5-legibility-demo';

export interface DevScenario {
  id: DevScenarioId;
  label: string;
  blurb: string;
  create: (nowMs?: number) => WorldState;
}

export const DEV_SCENARIOS: readonly DevScenario[] = [
  {
    id: 'sprint-4-ai-world',
    label: 'Sprint 4 — Western Europe',
    blurb: 'London · Paris assault · Berlin/Madrid fogged',
    create: createSprint4World,
  },
  {
    id: 'sprint-5-legibility-demo',
    label: 'Sprint 5 — Balkan Tri-border',
    blurb: 'Belgrade · Bucharest/Sofia visible · Istanbul fogged',
    create: createSprint5World,
  },
] as const;

export const DEFAULT_SCENARIO_ID: DevScenarioId = 'sprint-4-ai-world';

export function createWorldForScenario(id: DevScenarioId, nowMs: number = Date.now()): WorldState {
  const scenario = DEV_SCENARIOS.find((entry) => entry.id === id);
  return (scenario ?? DEV_SCENARIOS[0]).create(nowMs);
}

export function isDevScenarioId(value: string): value is DevScenarioId {
  return DEV_SCENARIOS.some((entry) => entry.id === value);
}
