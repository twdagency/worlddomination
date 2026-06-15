export * from './types';
export * from './constants';
export * from './geo';
export { tick } from './tick';
export { nextRandom } from './rng';
export { incomePerHour, extractionPerHour, accrueEconomy } from './economy';
export type { AccruedIncome } from './economy';
export { manpowerRegenPerHour, accrueManpower } from './manpower';
export {
  applyBuildOrders,
  buildDurationMs,
  canBuild,
  formatBuildBlockedMessage,
  maxBuildableTier,
  pendingProductionMs,
  resolveProductionCompletions,
  territoryIncomePerHour,
} from './production';
export type { BuildBlockedReason, BuildCheckResult } from './production';
export {
  applyMoveOrders,
  resolveArrivals,
  effectiveSpeedKmh,
  estimateTravelMs,
  transitFraction,
  buildTransit,
  pendingArrivalMs,
} from './movement';
export { advanceTo, mergeAccruedIncome, nextEventMs, unitPosition, previewMoveEtaMs, moveDistanceKm } from './clock';
export {
  assertAiOrders,
  applyTempoCommitment,
  collectAiOrders,
  committedCount,
  decideOrders,
  isAiDecisionMs,
  isAttackTargetVisible,
  isMoveTargetVisible,
  nextAiDecisionMs,
  tempoCommitFraction,
  TEMPO_COMMIT_FRACTION,
  transitAwareIntelMultiplier,
} from './ai';
export {
  computeVisibility,
  getFactionVisibility,
  isTerritoryVisible,
  isUnitVisible,
  scoutRangeKm,
  visibleEnemyUnits,
  visibleTerritories,
} from './visibility';
export type { FactionVisibility } from './visibility';
export { activeDirectSight, activeSight, territoriesObservedByScoutUnit } from './sight';
export type { ActiveDirectSight, ActiveSight } from './sight';
export {
  SCOUT_BUILD_COST_MULT,
  SCOUT_COMBAT_WEIGHT_MULT,
  SCOUT_UNIT_RANGE_MULT,
  SCOUT_UNIT_TYPE_ID,
  isScoutUnit,
  isScoutUnitType,
  scoutUnitRangeKm,
} from './scout';
export {
  captureTerritorySnapshot,
  emptyIntelStore,
  ensureIntelStore,
  factionIntelRecords,
  INTEL_DECAY_WINDOW_MS,
  isRecordExpired,
  mergeAllTerritoryVisibility,
  mergeTerritoryVisibility,
  pruneExpiredRecords,
  pruneAlliedIntelOnBreak,
  pruneRecordsByObserver,
  recordDestroyedScoutIntel,
  recordDirectObservations,
  recordAlliedObservations,
  recordIntelObservations,
  recordTreatyObservations,
  recordScoutFinalObservations,
} from './intel';
export {
  applyUnitLosses,
  computeWithdrawalCasualties,
  defenderWouldRetreat,
  gatherTerritoryDefenders,
  nearestFriendlyTerritory,
  partitionDefendersByRetreat,
  powerRatio,
  resolveBattle,
  sidePower,
  unitPowerPerSoldier,
  unitStackPower,
} from './combat';
export {
  formatArrivalNarrative,
  formatBattleNarrative,
  formatDepartureNarrative,
  formatProductionNarrative,
  formatSecuredNarrative,
  formatWithdrawalNarrative,
} from './reports';
export {
  assertActionableOrderTagged,
  beatHeader,
  buildDispatchFeed,
  computeBeatId,
  dispatchLineForEvent,
  filterDispatchesForFaction,
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  formatIntelReportLine,
  groupEventsByBeat,
  intentFromMoveStance,
  isDispatchVisibleToFaction,
  playerFactionId,
  taggedOrderFields,
} from './dispatch';
export { formatIntelSourceLabel } from './intelDisplay';
export {
  REPUTATION_PENALTY_ALLIANCE_BREAK_BETRAYED,
  REPUTATION_PENALTY_ALLIANCE_BREAK_OBSERVER,
  applyAllianceBreakReputationPenalty,
  createInitialReputation,
} from './reputation';
export {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_BREAK_THRESHOLD,
  ALLIANCE_PROPOSE_THRESHOLD,
  RELATIVE_POWER_PEER_RATIO_MAX,
  RELATIVE_POWER_PEER_RATIO_MIN,
  applyAiDiplomaticDecisions,
  factionMilitaryPower,
  isEnemyOf,
  scoreAllianceAcceptance,
  scoreAllianceBreak,
  scoreAllianceProposal,
  sharedEnemies,
} from './diplomaticAi';
export {
  areAllied,
  breakAlliance,
  diplomacyDefaults,
  ensureWorldDiplomacy,
  formAlliance,
  formTreaty,
  getActiveTreaties,
  getAlliancesFor,
  getTreatiesBetween,
  normalizeFactionPair,
  pruneExpiredTreaties,
} from './diplomacy';
export type { FormTreatyParams } from './diplomacy';
export {
  emitIntelReportEvents,
  inferIntelReportIntent,
  intelReportFromRecord,
  resolveIntelReportVariant,
} from './intelDispatch';
export type { IntelReportVariant } from './intelDispatch';
export type { DispatchBeatGroup, DispatchFeedItem } from './dispatch';
export type { ScoutingPriority, DiplomaticPosture } from './types';
export {
  compactDispatchFeed,
  renderCompactDigestText,
  renderDigestText,
} from './compaction';
export {
  COMPACTION_THRESHOLD_MS,
  DISPATCH_LINE_CAP,
  arrivalImportance,
  departureImportance,
  factionIdFromEvent,
  mediumCompactionCategory,
  resolveEventImportance,
} from './importance';
export type { DispatchImportance } from './types';
export type { MediumCompactionCategory } from './importance';
export { computeStance, orderIntentsInWindow, STANCE_WINDOW_MS, stanceLabel } from './stance';
export type { FactionStance } from './stance';
export { resolveHostileArrival } from './arrivalCombat';
