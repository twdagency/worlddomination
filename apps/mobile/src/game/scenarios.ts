import { createSprint4World, createSprint5World, createTutorialWorld } from 'shared';
import type { WorldState } from 'sim';

export type DevScenarioId = 'sprint-4-ai-world' | 'sprint-5-legibility-demo';

export type ScenarioId = DevScenarioId | 'tutorial';

export interface DevScenario {
  id: DevScenarioId;
  label: string;
  blurb: string;
  create: (nowMs?: number) => WorldState;
}

export interface Scenario {
  id: ScenarioId;
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

const TUTORIAL_SCENARIO: Scenario = {
  id: 'tutorial',
  label: 'Tutorial — Channel March',
  blurb: 'London food pinch · Paris assault · Burgundy treaty path',
  create: createTutorialWorld,
};

export const SCENARIOS: readonly Scenario[] = [...DEV_SCENARIOS, TUTORIAL_SCENARIO];

export const DEFAULT_SCENARIO_ID: DevScenarioId = 'sprint-4-ai-world';

export const FIRST_TIME_SCENARIO_ID: ScenarioId = 'tutorial';

export function resolveScenarioId(
  storedScenarioId: string | null,
  hasStoredWorld: boolean,
): ScenarioId {
  if (!hasStoredWorld) return FIRST_TIME_SCENARIO_ID;
  if (storedScenarioId && isScenarioId(storedScenarioId)) return storedScenarioId;
  return DEFAULT_SCENARIO_ID;
}

export function getScenarioFactory(id: ScenarioId): (nowMs?: number) => WorldState {
  const scenario = SCENARIOS.find((entry) => entry.id === id);
  if (!scenario) {
    throw new Error(`Unknown scenario: ${id}`);
  }
  return scenario.create;
}

export function createWorldForScenario(id: ScenarioId, nowMs: number = Date.now()): WorldState {
  return getScenarioFactory(id)(nowMs);
}

export function isDevScenarioId(value: string): value is DevScenarioId {
  return DEV_SCENARIOS.some((entry) => entry.id === value);
}

export function isScenarioId(value: string): value is ScenarioId {
  return SCENARIOS.some((entry) => entry.id === value);
}
