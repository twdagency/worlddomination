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
  formatBuildStartedLine,
  formatInfraUpgradedLine,
  formatIntentArrivalLine,
  formatIntentDepartureLine,
  groupEventsByBeat,
  intentFromMoveStance,
  renderDigestText,
  taggedOrderFields,
} from './dispatch';
export type { DispatchBeatGroup, DispatchFeedItem } from './dispatch';
export { resolveHostileArrival } from './arrivalCombat';
