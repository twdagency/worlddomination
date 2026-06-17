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
  validateAssaultOrder,
  formatOrderRejectedMessage,
} from './movement';
export type { AssaultOrderRejectionReason } from './movement';
export { advanceTo, mergeAccruedIncome, nextEventMs, unitPosition, previewMoveEtaMs, moveDistanceKm, getTimeMultiplier } from './clock';
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
  REPUTATION_PENALTY_ALLY_DEFEATED,
  applyAllianceBreakReputationPenalty,
  applyDefeatAllianceDissolutionReputationPenalty,
  createInitialReputation,
} from './reputation';
export {
  ALLIANCE_ACCEPT_THRESHOLD,
  ALLIANCE_BREAK_THRESHOLD,
  ALLIANCE_PROPOSE_THRESHOLD,
  RELATIVE_POWER_PEER_RATIO_MAX,
  RELATIVE_POWER_PEER_RATIO_MIN,
  TREATY_ACCEPT_THRESHOLD,
  applyAiDiplomaticDecisions,
  factionMilitaryPower,
  isEnemyOf,
  scoreAllianceAcceptance,
  scoreAllianceBreak,
  scoreAllianceProposal,
  scoreTreatyAcceptance,
  sharedEnemies,
} from './diplomaticAi';
export {
  allianceBrokenEvent,
  allianceDeclinedEvent,
  allianceFormedEvent,
  allianceProposedEvent,
  DEFAULT_TREATY_DURATION_MS,
  expiredTreatyEvents,
  garrisonDescriptor,
  treatyDeclinedEvent,
  treatyExpiredEvent,
  treatyFormedEvent,
  treatyProposedEvent,
} from './diplomaticDispatch';
export {
  diplomaticRelationshipStatus,
} from './diplomacyDisplay';
export type { DiplomaticRelationshipStatus } from './diplomacyDisplay';
export {
  expirePendingProposals,
  playerAcceptProposal,
  playerBreakAlliance,
  playerDeclineProposal,
  playerProposeAlliance,
  playerProposeTreaty,
  queueAllianceProposal,
} from './playerDiplomacy';
export {
  deterministicProposalId,
  hasPendingProposalBetween,
  pendingProposalsForFaction,
  proposalExpiresAt,
} from './pendingProposals';
export { reputationCategory } from './reputationDisplay';
export type { ReputationCategory } from './reputationDisplay';
export { ensureWorldMigrations, ensureWorldTimeMultiplier } from './migrations';
export {
  activeCountries,
  CANONICAL_CAPITALS,
  CANONICAL_CAPITALS_BY_SCENARIO,
  citiesOf,
  countryToFaction,
  defeatCountry,
  ensureWorldCountries,
  factionToCountry,
  findCountry,
  isCountryDefeated,
  recordConquerorOnTerritoryCapture,
  relocateCapitalIfNeeded,
  resolveCanonicalCapital,
  selectNewCapital,
  setCountryCapital,
  setCountryDefeated,
  syncCountriesFromFactions,
} from './country';
export type { CountrySyncResult } from './country';
export {
  backfillLegacyDispatchEventIds,
  DEFAULT_NEXT_EVENT_ID,
  emit,
  ensureWorldEventCounter,
  LEGACY_EVENT_ID_PREFIX,
  nextEventId,
  stampEvents,
} from './events';
export type { WorldMigrationCatalog } from './migrations';
export {
  accruePassiveInfluence,
  applyInfluenceDelta,
  clearInfluenceForCity,
  clearInfluenceForCountry,
  computePassiveInfluenceSources,
  computeInfluenceDecay,
  ensureWorldInfluence,
  getInfluence,
  getInfluenceSources,
  getInfluenceState,
  INFLUENCE_ADJACENCY_THRESHOLD_KM,
  INFLUENCE_CAP,
  INFLUENCE_DECAY_PER_DAY,
  INFLUENCE_FLOOR,
  setInfluence,
} from './influence';
export {
  applyInfluenceOrders,
  CULTURAL_CAMPAIGN_BURST,
  CULTURAL_CAMPAIGN_COOLDOWN_MS,
  CULTURAL_CAMPAIGN_COST,
  DIPLOMATIC_MISSION_COST,
  DIPLOMATIC_MISSION_DURATION_MS,
  expireActiveInfluenceEffects,
  formatInfluenceOrderRejectedMessage,
  hasActiveDiplomaticMission,
  INFLUENCE_SUBVERSION_BURST,
  INFLUENCE_SUBVERSION_COST,
  INFLUENCE_SUBVERSION_DISCOVERY_RATE,
  INFLUENCE_SUBVERSION_MANPOWER_COST,
  INFLUENCE_SUBVERSION_REPUTATION_BOLD_BONUS,
  INFLUENCE_SUBVERSION_REPUTATION_PENALTY,
  isInfluenceOrder,
} from './influenceAccelerators';
export {
  areAllied,
  breakAlliance,
  diplomacyDefaults,
  dissolveAlliancesForDefeatedCountry,
  ensureWorldDiplomacy,
  expireTreatiesForDefeatedCountry,
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
export type { ScoutingPriority, DiplomaticPosture, TutorialBeatId, TutorialState } from './types';
export {
  TUTORIAL_BEAT_ORDER,
  TUTORIAL_ACTIVE_TIME_MULTIPLIER,
  STANDARD_TIME_MULTIPLIER,
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_BURGUNDY_FACTION_ID,
  createInitialTutorialState,
  markBeatComplete,
  graduateTutorial,
  isBeatComplete,
  getNextBeat,
} from './tutorial';
export {
  type BeatPredicate,
  TUTORIAL_BEAT_PREDICATES,
} from './tutorialBeats';
export {
  type BeatController,
  createBeatController,
  evaluateBeatProgression,
} from './beatController';
export {
  enqueuePendingDilemma,
  getDilemmaById,
  resolveDilemma,
} from './dilemmas';
export { FOREIGN_RULE_DILEMMA } from './dilemmas/foreignRule';
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
