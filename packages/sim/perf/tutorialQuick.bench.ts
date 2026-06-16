import { createTutorialWorld } from '../../shared/src/scenario-tutorial';
import { createSprint4World } from '../../shared/src/scenario-sprint4';
import { evaluateBeatProgression } from '../src/beatController';
import { advanceTo } from '../src/clock';

const START_MS = 1_700_000_000_000;

function onceAdvance(factory: (ms: number) => ReturnType<typeof createTutorialWorld>, hours: number) {
  const t0 = performance.now();
  const { events } = advanceTo(factory(START_MS), START_MS + hours * 3_600_000);
  return { medianMs: performance.now() - t0, events: events.length };
}

const tutorial24 = onceAdvance(createTutorialWorld, 24);
const tutorial72 = onceAdvance(createTutorialWorld, 72);
const sprint4_24 = onceAdvance(createSprint4World, 24);

const world = createTutorialWorld(START_MS);
const beatT0 = performance.now();
evaluateBeatProgression(world, [
  {
    kind: 'arrival',
    at: START_MS,
    unitId: 'unit-britain-infantry',
    territoryId: 'territory-paris-tutorial',
    ownerId: 'faction-britain-tutorial',
    intent: 'attack',
    importance: 'low',
  },
]);
const beatMs = performance.now() - beatT0;

console.log(
  JSON.stringify(
    {
      tutorial24hMs: tutorial24.medianMs,
      tutorial24hEvents: tutorial24.events,
      tutorial72hMs: tutorial72.medianMs,
      tutorial72hEvents: tutorial72.events,
      sprint4_24hMs: sprint4_24.medianMs,
      evaluateBeatProgressionMs: beatMs,
    },
    null,
    2,
  ),
);
