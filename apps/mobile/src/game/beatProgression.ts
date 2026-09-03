import { evaluateBeatProgression, stampEvents, type SimEvent, type WorldState } from 'sim';

/** Run tutorial beat progression after a direct player action (diplomacy, dilemmas). */
export function withBeatProgression(result: { world: WorldState; events: SimEvent[] }): {
  world: WorldState;
  events: SimEvent[];
} {
  const progressed = evaluateBeatProgression(result.world, result.events);
  const stamped = stampEvents(progressed.world, progressed.events);
  return {
    world: stamped.world,
    events: [...result.events, ...stamped.events],
  };
}
