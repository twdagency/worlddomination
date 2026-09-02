import type { AccruedIncome } from './economy';
import type { Order, SimEvent, SimEventDraft, WorldState } from './types';
import { MS_PER_DAY } from './constants';
import { accrueEconomy } from './economy';
import { pruneExpiredTreaties } from './diplomacy';
import { expiredTreatyEvents } from './diplomaticDispatch';
import {
  ensureIntelStore,
  recordAlliedObservations,
  recordIntelObservations,
  recordTreatyObservations,
} from './intel';
import { emitIntelReportEvents } from './intelDispatch';
import { evaluateBeatProgression } from './beatController';
import { evaluateLastCountryStanding, syncCountriesFromFactions } from './country';
import { accrueManpower } from './manpower';
import { applyMoveOrders, resolveArrivals } from './movement';
import { applyBuildOrders, resolveProductionCompletions } from './production';
import { accruePassiveInfluence } from './influence';
import { accrueTributes } from './influenceActions';
import { applyInfluenceOrders, expireActiveInfluenceEffects } from './influenceAccelerators';
import { applyAiInfluenceOrders } from './aiInfluenceOrders';
import { applyAiThresholdOrders } from './aiThresholdOrders';
import { applyAiIntelligenceOrders } from './aiIntelligenceOrders';
import { stampEvents } from './events';

/**
 * Pure. Advances the world by `elapsedMs`, applies `orders`, resolves events in
 * chronological order. Never mutates `world`. Deterministic given inputs.
 *
 * Tick pipeline:
 * 1. applyInfluenceOrders — player influence accelerators + threshold actions
 * 2. applyMoveOrders — departures enter transit
 * 3. applyBuildOrders — queued construction
 * 4. resolveProductionCompletions — infra/build finishes
 * 5. resolveArrivals — combat, captures
 * 6. accrueEconomy + accrueManpower
 * 6a. applyAiInfluenceOrders — daily slot: accelerate XOR threshold-spend
 * 6a. applyAiThresholdOrders — threshold spend (shared daily channel)
 * 6a. applyAiIntelligenceOrders — parallel recon (per-actor,city cooldown)
 * 6b. accruePassiveInfluence — passive accrual + decay
 * 6c. expireActiveInfluenceEffects — mission expiry, campaign cooldown prune
 * 6d. accrueTributes
 * 7. pruneExpiredTreaties → intel → syncCountries → last-standing victory → beat progression
 */
export function tick(
  world: WorldState,
  orders: Order[],
  elapsedMs: number,
): { world: WorldState; events: SimEvent[]; accrued: AccruedIncome } {
  const events: SimEventDraft[] = [];

  const influenceOrders = applyInfluenceOrders(world, orders, world.nowMs);
  const workingWorld = influenceOrders.world;
  events.push(...influenceOrders.events);

  const { units: unitsAfterMoves, events: departureEvents } = applyMoveOrders(workingWorld, orders);
  events.push(...departureEvents);

  const {
    factions: factionsAfterBuilds,
    territories: territoriesAfterBuilds,
    events: buildEvents,
  } = applyBuildOrders({ ...workingWorld, units: unitsAfterMoves }, orders);
  events.push(...buildEvents);

  const nowMs = world.nowMs + elapsedMs;
  const day = Math.floor((nowMs - world.startMs) / MS_PER_DAY) + 1;

  const preCombat: WorldState = {
    ...workingWorld,
    units: unitsAfterMoves,
    factions: factionsAfterBuilds,
    territories: territoriesAfterBuilds,
    nowMs,
    day,
  };

  const {
    units: unitsAfterProduction,
    territories: territoriesAfterProduction,
    events: productionEvents,
  } = resolveProductionCompletions(preCombat, nowMs);
  events.push(...productionEvents);

  const {
    units: unitsAfterArrivals,
    territories,
    countries: countriesAfterArrivals,
    rng,
    events: arrivalEvents,
    intel: intelAfterArrivals,
  } = resolveArrivals(
    { ...preCombat, units: unitsAfterProduction, territories: territoriesAfterProduction },
    nowMs,
  );
  events.push(...arrivalEvents);

  const postCombat: WorldState = {
    ...preCombat,
    units: unitsAfterArrivals,
    territories,
    countries: countriesAfterArrivals ?? preCombat.countries,
    rng,
    intel: intelAfterArrivals ?? ensureIntelStore(world),
  };

  const economy = accrueEconomy(postCombat, elapsedMs);
  const factionsAfterManpower = accrueManpower(postCombat, elapsedMs);

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

  let afterEconomy: WorldState = {
    ...postCombat,
    factions,
    territories: economy.territories,
  };

  if (elapsedMs > 0) {
    const aiInfluence = applyAiInfluenceOrders(afterEconomy, nowMs);
    afterEconomy = aiInfluence.world;
    events.push(...aiInfluence.events);

    const aiThreshold = applyAiThresholdOrders(afterEconomy, nowMs);
    afterEconomy = aiThreshold.world;
    events.push(...aiThreshold.events);

    const aiIntelligence = applyAiIntelligenceOrders(afterEconomy, nowMs);
    afterEconomy = aiIntelligence.world;
    events.push(...aiIntelligence.events);
  }

  const afterInfluence = accruePassiveInfluence(afterEconomy, nowMs);
  const afterInfluenceEffects = expireActiveInfluenceEffects(afterInfluence, nowMs);
  events.push(...afterInfluenceEffects.events);

  const afterTributes = accrueTributes(afterInfluenceEffects.world, nowMs);
  events.push(...afterTributes.events);

  const afterDiplomacy = pruneExpiredTreaties(afterTributes.world, nowMs);
  events.push(...expiredTreatyEvents(afterEconomy.treaties, afterDiplomacy.treaties, nowMs));

  const priorIntel = ensureIntelStore(afterDiplomacy);
  const afterDirectIntel = recordIntelObservations(afterDiplomacy);
  const afterAlliedIntel = recordAlliedObservations({
    ...afterDiplomacy,
    intel: afterDirectIntel,
  });
  const nextIntel = recordTreatyObservations({
    ...afterDiplomacy,
    intel: afterAlliedIntel,
  });
  events.push(...emitIntelReportEvents(afterDiplomacy, priorIntel, nextIntel));

  let next: WorldState = {
    ...afterDiplomacy,
    intel: nextIntel,
  };

  const countrySync = syncCountriesFromFactions(next);
  next = countrySync.world;
  events.push(...countrySync.events);

  const standing = evaluateLastCountryStanding(next, nowMs);
  next = standing.world;
  events.push(...standing.events);

  const progression = evaluateBeatProgression(next, events);
  next = progression.world;
  events.push(...progression.events);

  const stamped = stampEvents(next, events);
  return { world: stamped.world, events: stamped.events, accrued: economy.accrued };
}
