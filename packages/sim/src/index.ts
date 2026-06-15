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
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  groupEventsByBeat,
  intentFromMoveStance,
  taggedOrderFields,
} from './dispatch';
export type { DispatchBeatGroup, DispatchFeedItem } from './dispatch';
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
