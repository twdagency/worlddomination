// All balance numbers live here so tuning never touches logic.

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;

/** Income multiplier per infra level: yield * (1 + INFRA_YIELD_MULT * infraLevel). */
export const INFRA_YIELD_MULT = 0.25;
/** Extraction multiplier per infra level (same formula as income). */
export const EXTRACTION_INFRA_MULT = 0.25;
/** Manpower regen per hour = territory baseYield * this * leader.manpowerRegenMult. */
export const MANPOWER_REGEN_PER_YIELD = 0.5;
/** Depot facilities (infra 1–2) cap buildable unit tier. */
export const DEPOT_MAX_TIER = 2;
/** Arsenal (infra 3+) unlocks higher tiers. */
export const ARSENAL_MIN_INFRA = 3;
export const ARSENAL_MAX_TIER = 5;
export const MAX_INFRA_LEVEL = 5;
/** Funding cost to raise infra by one level (multiplied by current infra). */
export const INFRA_UPGRADE_BASE_COST = 5_000;

export const TECH_FACTOR = 1.6;
export const CASUALTY_K = 2;

export const DEFAULT_TRAIT = 1.0;
export const DEFAULT_TERRAIN_MOD = 1.0;
/** Defender flees if defenderPower/attackerPower falls below this. */
export const RETREAT_THRESHOLD = 0.7;
/** Fraction of withdrawing force lost when breaking contact under Assault. */
export const WITHDRAWAL_DEFENDER_LOSS = 0.3;
/** Fraction of pursuing attacker lost when defender withdraws under Assault. */
export const WITHDRAWAL_ATTACKER_LOSS = 0.1;
/** Optional bounded combat variance via seeded RNG — off by default. */
export const COMBAT_RNG_VARIANCE_ENABLED = false;

/** Great-circle radius within which a faction observes contacts. */
export const BASE_SCOUT_RANGE_KM = 500;
/** Simulated time between AI decision ticks. */
export const AI_DECISION_INTERVAL_MS = 6 * MS_PER_HOUR;
