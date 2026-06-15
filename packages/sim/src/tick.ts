import type { AccruedIncome } from './economy';
import type { Order, SimEvent, WorldState } from './types';
import { MS_PER_DAY } from './constants';
import { accrueEconomy } from './economy';
import { ensureIntelStore, recordDirectObservations } from './intel';
import { accrueManpower } from './manpower';
import { applyMoveOrders, resolveArrivals } from './movement';
import { applyBuildOrders, resolveProductionCompletions } from './production';

/**
 * Pure. Advances the world by `elapsedMs`, applies `orders`, resolves events in
 * chronological order. Never mutates `world`. Deterministic given inputs.
 */
export function tick(
  world: WorldState,
  orders: Order[],
  elapsedMs: number,
): { world: WorldState; events: SimEvent[]; accrued: AccruedIncome } {
  const events: SimEvent[] = [];

  const { units: unitsAfterMoves, events: departureEvents } = applyMoveOrders(world, orders);
  events.push(...departureEvents);

  const {
    factions: factionsAfterBuilds,
    territories: territoriesAfterBuilds,
    events: buildEvents,
  } = applyBuildOrders({ ...world, units: unitsAfterMoves }, orders);
  events.push(...buildEvents);

  const nowMs = world.nowMs + elapsedMs;
  const day = Math.floor((nowMs - world.startMs) / MS_PER_DAY) + 1;

  const preAccrual: WorldState = {
    ...world,
    units: unitsAfterMoves,
    factions: factionsAfterBuilds,
    territories: territoriesAfterBuilds,
    nowMs,
    day,
  };

  const economy = accrueEconomy(preAccrual, elapsedMs);
  const factionsAfterManpower = accrueManpower(preAccrual, elapsedMs);

  const factions: WorldState['factions'] = {};
  for (const id of new Set([
    ...Object.keys(factionsAfterManpower),
    ...Object.keys(economy.factions),
  ])) {
    const base = factionsAfterManpower[id] ?? economy.factions[id];
    if (!base) continue;
    factions[id] = {
      ...base,
      funding: economy.factions[id]?.funding ?? base.funding,
      manpower: factionsAfterManpower[id]?.manpower ?? base.manpower,
    };
  }

  const afterEconomy: WorldState = {
    ...preAccrual,
    factions,
    territories: economy.territories,
  };

  const {
    units: unitsAfterProduction,
    territories: territoriesAfterProduction,
    events: productionEvents,
  } = resolveProductionCompletions(afterEconomy, nowMs);
  events.push(...productionEvents);

  const {
    units: unitsAfterArrivals,
    territories,
    rng,
    events: arrivalEvents,
  } = resolveArrivals(
    { ...afterEconomy, units: unitsAfterProduction, territories: territoriesAfterProduction },
    nowMs,
  );
  events.push(...arrivalEvents);

  const resolved: WorldState = {
    ...afterEconomy,
    units: unitsAfterArrivals,
    territories,
    rng,
    intel: ensureIntelStore(world),
  };

  const next: WorldState = {
    ...resolved,
    intel: recordDirectObservations(resolved),
  };

  return { world: next, events, accrued: economy.accrued };
}
