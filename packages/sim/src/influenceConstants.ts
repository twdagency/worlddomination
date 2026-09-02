/**
 * Shared influence thresholds. Leaf module — no sim imports — so
 * influenceActions and intelligenceGather can share one source of truth
 * without a require cycle.
 */

/** First actionable foothold: diplomatic pressure and intelligence gather. */
export const INFLUENCE_SWAY_THRESHOLD = 30;

export const DIPLOMATIC_PRESSURE_MIN_INFLUENCE = INFLUENCE_SWAY_THRESHOLD;
export const INTELLIGENCE_MIN_INFLUENCE = INFLUENCE_SWAY_THRESHOLD;

export const TRIBUTE_INFLUENCE_FLOOR = 50;

/** When any rival reaches this value in a city, other actors' positive passive sources are halved. */
export const COMPETITOR_INFLUENCE_HALVE_THRESHOLD = 50;

export const COUP_INFLUENCE_FLOOR = 70;
export const DEFECTION_INFLUENCE_REQUIRED = 100;
