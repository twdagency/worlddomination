import {
  computePassiveInfluenceSources,
  COUP_ATTEMPT_GOLD_COST,
  COUP_ATTEMPT_MANPOWER_COST,
  COUP_INFLUENCE_FLOOR,
  CULTURAL_CAMPAIGN_COOLDOWN_MS,
  CULTURAL_CAMPAIGN_COST,
  DEFECTION_GOLD_COST,
  DEFECTION_INFLUENCE_REQUIRED,
  DEFECTION_MANPOWER_COST,
  DIPLOMATIC_MISSION_COST,
  DIPLOMATIC_PRESSURE_COST,
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
  findActiveTribute,
  findPendingProposalForPressure,
  formatInfluenceOrderRejectedMessage,
  getInfluence,
  getInfluenceState,
  hasActiveDiplomaticMission,
  INFLUENCE_CAP,
  INFLUENCE_DECAY_PER_DAY,
  INFLUENCE_SUBVERSION_COST,
  INFLUENCE_SUBVERSION_MANPOWER_COST,
  TRIBUTE_EXTRACTION_COST,
  TRIBUTE_INFLUENCE_FLOOR,
  validateCoupAttempt,
  validateDefectionClaim,
  validateDiplomaticPressure,
  validateTributeExtraction,
  type InfluenceActionKind,
  type InfluenceOrderKind,
  type InfluenceSource,
  type PressureProposalKind,
  type WorldState,
} from 'sim';
import type { Id } from 'sim';
import { resolvePlayerFactionId } from 'shared';
import { selectCountryById } from './countrySelector';
import {
  factionDisplayName,
  formatCooldownDays,
  formatInfluenceMagnitudeLabel,
  formatInfluenceValue,
  formatThresholdStars,
  influenceMagnitude,
} from './influenceDisplay';

export type InfluenceOrderActionKind =
  | Extract<InfluenceOrderKind, 'diplomatic-mission' | 'cultural-campaign' | 'influence-subversion'>
  | InfluenceActionKind;

export interface AvailableInfluenceAction {
  kind: InfluenceOrderActionKind;
  label: string;
  description: string;
  unlocked: boolean;
  thresholdRequired: number;
  cost: { gold: number; manpower?: number };
  cooldownRemainingMs?: number;
  rejectionReason?: string;
}

export interface CityInfluenceView {
  cityId: Id;
  cityName: string;
  countryId: Id;
  countryName: string;
  playerInfluence: number;
  influenceSources: InfluenceSource[];
  hasActiveMission: boolean;
  hasActiveTribute: boolean;
  competingActors: { actorId: Id; actorName: string; visibleMagnitude: 'low' | 'moderate' | 'high' }[];
  availableActions: AvailableInfluenceAction[];
  decayPerDay: number;
}

export interface InfluenceSummaryView {
  activeCityCount: number;
  summaryLine: string;
  topTarget: CityInfluenceView | null;
  cities: CityInfluenceView[];
}

export interface CountryInfluenceRollup {
  countryId: Id;
  countryName: string;
  citiesUnderSway: number;
  cities: { cityId: Id; cityName: string; playerInfluence: number }[];
}

const PRESSURE_KINDS: PressureProposalKind[] = ['accept-alliance', 'accept-treaty'];

const ACTION_CATALOG: {
  kind: InfluenceOrderActionKind;
  label: string;
  description: string;
  thresholdRequired: number;
  gold: number;
  manpower?: number;
}[] = [
  {
    kind: 'diplomatic-mission',
    label: 'Diplomatic Mission',
    description: 'Double passive influence accrual for 14 days.',
    thresholdRequired: 0,
    gold: DIPLOMATIC_MISSION_COST,
  },
  {
    kind: 'cultural-campaign',
    label: 'Cultural Campaign',
    description: 'Burst +10 influence; 30-day cooldown per city.',
    thresholdRequired: 0,
    gold: CULTURAL_CAMPAIGN_COST,
  },
  {
    kind: 'influence-subversion',
    label: 'Subversion',
    description: 'Covert +20 influence with discovery risk.',
    thresholdRequired: 0,
    gold: INFLUENCE_SUBVERSION_COST,
    manpower: INFLUENCE_SUBVERSION_MANPOWER_COST,
  },
  {
    kind: 'diplomatic-pressure',
    label: 'Diplomatic Pressure',
    description: 'Force acceptance of a pending alliance or treaty.',
    thresholdRequired: DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
    gold: DIPLOMATIC_PRESSURE_COST,
  },
  {
    kind: 'tribute-extraction',
    label: 'Tribute Extraction',
    description: 'Drain gold from a city under your sway.',
    thresholdRequired: TRIBUTE_INFLUENCE_FLOOR,
    gold: TRIBUTE_EXTRACTION_COST,
  },
  {
    kind: 'coup-attempt',
    label: 'Coup Attempt',
    description: 'Risky seizure — 60% base success at threshold.',
    thresholdRequired: COUP_INFLUENCE_FLOOR,
    gold: COUP_ATTEMPT_GOLD_COST,
    manpower: COUP_ATTEMPT_MANPOWER_COST,
  },
  {
    kind: 'defection-claim',
    label: 'Defection',
    description: 'Peaceful transfer at maximum influence — no risk.',
    thresholdRequired: DEFECTION_INFLUENCE_REQUIRED,
    gold: DEFECTION_GOLD_COST,
    manpower: DEFECTION_MANPOWER_COST,
  },
];

function culturalCampaignCooldownRemainingMs(
  world: WorldState,
  ownerId: Id,
  targetCityId: Id,
  at: number,
): number {
  const record = (world.culturalCampaigns ?? []).find(
    (entry) =>
      entry.ownerId === ownerId &&
      entry.targetCityId === targetCityId &&
      at < entry.cooldownUntil,
  );
  if (!record) return 0;
  return record.cooldownUntil - at;
}

function isInfluenceTarget(world: WorldState, playerId: Id, cityId: Id): boolean {
  const city = world.territories[cityId];
  if (!city?.ownerId || city.ownerId === playerId) return false;
  if (world.countries?.[city.ownerId]?.defeated) return false;
  return true;
}

function computeNetInfluencePerDay(
  world: WorldState,
  cityId: Id,
  actorId: Id,
): number {
  const sources = computePassiveInfluenceSources(world, cityId, actorId, world.nowMs);
  let rate = sources.reduce((sum, source) => sum + source.contribution, 0);
  if (hasActiveDiplomaticMission(world, actorId, cityId, world.nowMs)) {
    rate *= 2;
  }
  const current = getInfluence(world, cityId, actorId);
  if (rate === 0 && current > 0) {
    return -Math.min(INFLUENCE_DECAY_PER_DAY, current);
  }
  return rate;
}

function resolvePressureEligibility(
  world: WorldState,
  actorId: Id,
  cityId: Id,
): { ok: true; proposalKind: PressureProposalKind } | { ok: false; reason: string } {
  const ownerId = world.territories[cityId]?.ownerId;
  if (!ownerId) return { ok: false, reason: 'Target city not found.' };

  let lastReason = 'No matching pending proposal to force acceptance.';
  for (const proposalKind of PRESSURE_KINDS) {
    const validation = validateDiplomaticPressure(world, actorId, cityId, ownerId, proposalKind);
    if (validation.ok) return { ok: true, proposalKind };
    if (validation.reason !== 'no-pending-proposal' && validation.reason !== 'unsupported-proposal-kind') {
      lastReason = formatInfluenceOrderRejectedMessage(validation.reason);
    }
  }
  return { ok: false, reason: lastReason };
}

function evaluateAction(
  world: WorldState,
  actorId: Id,
  cityId: Id,
  entry: (typeof ACTION_CATALOG)[number],
): AvailableInfluenceAction {
  const influence = getInfluence(world, cityId, actorId);
  const cooldownRemainingMs =
    entry.kind === 'cultural-campaign'
      ? culturalCampaignCooldownRemainingMs(world, actorId, cityId, world.nowMs)
      : 0;

  let unlocked = false;
  let rejectionReason: string | undefined;

  if (entry.thresholdRequired > 0 && influence < entry.thresholdRequired) {
    rejectionReason = `Requires ${entry.thresholdRequired} influence — current: ${Math.round(influence)}`;
  } else if (cooldownRemainingMs > 0) {
    rejectionReason = formatCooldownDays(cooldownRemainingMs);
  } else if (entry.kind === 'diplomatic-pressure') {
    const pressure = resolvePressureEligibility(world, actorId, cityId);
    unlocked = pressure.ok;
    if (!pressure.ok) rejectionReason = pressure.reason;
  } else if (entry.kind === 'tribute-extraction') {
    const validation = validateTributeExtraction(world, actorId, cityId);
    unlocked = validation.ok;
    if (!validation.ok) rejectionReason = formatInfluenceOrderRejectedMessage(validation.reason);
  } else if (entry.kind === 'coup-attempt') {
    const validation = validateCoupAttempt(world, actorId, cityId);
    unlocked = validation.ok;
    if (!validation.ok) rejectionReason = formatInfluenceOrderRejectedMessage(validation.reason);
  } else if (entry.kind === 'defection-claim') {
    const validation = validateDefectionClaim(world, actorId, cityId);
    unlocked = validation.ok;
    if (!validation.ok) rejectionReason = formatInfluenceOrderRejectedMessage(validation.reason);
  } else if (entry.kind === 'diplomatic-mission') {
    if (hasActiveDiplomaticMission(world, actorId, cityId, world.nowMs)) {
      rejectionReason = 'A diplomatic mission is already active in this city.';
    } else if ((world.factions[actorId]?.funding ?? 0) < entry.gold) {
      rejectionReason = 'Insufficient gold for this influence action.';
    } else if (!isInfluenceTarget(world, actorId, cityId)) {
      rejectionReason = 'Cannot apply influence in your own cities.';
    } else {
      unlocked = true;
    }
  } else if (entry.kind === 'cultural-campaign') {
    if ((world.factions[actorId]?.funding ?? 0) < entry.gold) {
      rejectionReason = 'Insufficient gold for this influence action.';
    } else if (!isInfluenceTarget(world, actorId, cityId)) {
      rejectionReason = 'Cannot apply influence in your own cities.';
    } else {
      unlocked = true;
    }
  } else if (entry.kind === 'influence-subversion') {
    const faction = world.factions[actorId];
    if (!faction || faction.funding < entry.gold) {
      rejectionReason = 'Insufficient gold for this influence action.';
    } else if (faction.manpower < (entry.manpower ?? 0)) {
      rejectionReason = 'Insufficient manpower for subversion.';
    } else if (!isInfluenceTarget(world, actorId, cityId)) {
      rejectionReason = 'Cannot apply influence in your own cities.';
    } else {
      unlocked = true;
    }
  }

  return {
    kind: entry.kind,
    label: entry.label,
    description: entry.description,
    unlocked,
    thresholdRequired: entry.thresholdRequired,
    cost: { gold: entry.gold, manpower: entry.manpower },
    cooldownRemainingMs: cooldownRemainingMs > 0 ? cooldownRemainingMs : undefined,
    rejectionReason,
  };
}

function buildCompetingActors(
  world: WorldState,
  cityId: Id,
  playerId: Id,
): CityInfluenceView['competingActors'] {
  const row = world.influence?.[cityId];
  if (!row) return [];

  return Object.entries(row)
    .filter(([actorId, state]) => actorId !== playerId && state.value > 0)
    .map(([actorId, state]) => {
      const country = world.countries?.[actorId];
      if (country?.defeated) return null;
      return {
        actorId,
        actorName: factionDisplayName(world, actorId),
        visibleMagnitude: influenceMagnitude(state.value),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.actorName.localeCompare(right.actorName));
}

export function selectCityInfluence(
  world: WorldState | null,
  cityId: Id,
  playerId?: Id,
): CityInfluenceView | null {
  if (!world) return null;
  const actorId = playerId ?? resolvePlayerFactionId(world);
  if (!actorId) return null;

  const city = world.territories[cityId];
  if (!city) return null;

  const countryId = city.ownerId;
  if (!countryId) return null;

  const country = selectCountryById(world, countryId);
  const playerInfluence = Math.min(INFLUENCE_CAP, getInfluence(world, cityId, actorId));
  const influenceState = getInfluenceState(world, cityId, actorId);

  return {
    cityId,
    cityName: city.name,
    countryId,
    countryName: country?.name ?? countryId,
    playerInfluence,
    influenceSources: influenceState?.sources ?? computePassiveInfluenceSources(world, cityId, actorId),
    hasActiveMission: hasActiveDiplomaticMission(world, actorId, cityId, world.nowMs),
    hasActiveTribute: Boolean(findActiveTribute(world, actorId, cityId)),
    competingActors: buildCompetingActors(world, cityId, actorId),
    availableActions: ACTION_CATALOG.map((entry) => evaluateAction(world, actorId, cityId, entry)),
    decayPerDay: computeNetInfluencePerDay(world, cityId, actorId),
  };
}

export function selectInfluenceTargetCityIds(world: WorldState | null, playerId?: Id): Id[] {
  if (!world) return [];
  const actorId = playerId ?? resolvePlayerFactionId(world);
  if (!actorId) return [];
  return Object.keys(world.territories)
    .filter((cityId) => isInfluenceTarget(world, actorId, cityId))
    .sort((left, right) =>
      (world.territories[left]?.name ?? left).localeCompare(world.territories[right]?.name ?? ''),
    );
}

export function selectPlayerInfluenceSummary(world: WorldState | null): InfluenceSummaryView | null {
  if (!world) return null;
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return null;

  const cities = selectInfluenceTargetCityIds(world, playerId)
    .map((cityId) => selectCityInfluence(world, cityId, playerId))
    .filter((entry): entry is CityInfluenceView => entry !== null && entry.playerInfluence > 0)
    .sort((left, right) => right.playerInfluence - left.playerInfluence);

  const activeCityCount = cities.length;
  const summaryLine =
    activeCityCount === 0
      ? ''
      : `Active in ${activeCityCount} ${activeCityCount === 1 ? 'city' : 'cities'}: ${cities
          .slice(0, 3)
          .map((city) => `${city.cityName} (${Math.round(city.playerInfluence)})`)
          .join(', ')}`;

  return {
    activeCityCount,
    summaryLine,
    topTarget: cities[0] ?? null,
    cities,
  };
}

export function selectInfluenceForDiplomacy(world: WorldState | null): CountryInfluenceRollup[] {
  if (!world) return [];
  const playerId = resolvePlayerFactionId(world);
  if (!playerId) return [];

  const byCountry = new Map<Id, CountryInfluenceRollup>();

  for (const cityId of selectInfluenceTargetCityIds(world, playerId)) {
    const view = selectCityInfluence(world, cityId, playerId);
    if (!view || view.playerInfluence < DIPLOMATIC_PRESSURE_MIN_INFLUENCE) continue;

    const existing = byCountry.get(view.countryId) ?? {
      countryId: view.countryId,
      countryName: view.countryName,
      citiesUnderSway: 0,
      cities: [],
    };
    existing.cities.push({
      cityId: view.cityId,
      cityName: view.cityName,
      playerInfluence: view.playerInfluence,
    });
    existing.citiesUnderSway += 1;
    byCountry.set(view.countryId, existing);
  }

  return [...byCountry.values()].sort((left, right) =>
    left.countryName.localeCompare(right.countryName),
  );
}

export function resolvePressureOrderFields(
  world: WorldState,
  actorId: Id,
  cityId: Id,
): { targetCountryId: Id; proposalKind: PressureProposalKind } | null {
  const ownerId = world.territories[cityId]?.ownerId;
  if (!ownerId) return null;

  for (const proposalKind of PRESSURE_KINDS) {
    if (findPendingProposalForPressure(world, actorId, ownerId, proposalKind)) {
      const validation = validateDiplomaticPressure(world, actorId, cityId, ownerId, proposalKind);
      if (validation.ok) return { targetCountryId: ownerId, proposalKind };
    }
  }
  return null;
}

export function formatThresholdProximity(
  view: CityInfluenceView,
): { label: string; detail: string }[] {
  const thresholds = [
    { value: DIPLOMATIC_PRESSURE_MIN_INFLUENCE, label: 'Pressure' },
    { value: TRIBUTE_INFLUENCE_FLOOR, label: 'Tribute' },
    { value: COUP_INFLUENCE_FLOOR, label: 'Coup' },
    { value: DEFECTION_INFLUENCE_REQUIRED, label: 'Defection' },
  ];

  return thresholds.map(({ value, label }) => {
    if (view.playerInfluence >= value) {
      return { label, detail: `${label} available at ${value} (current: ${Math.round(view.playerInfluence)}).` };
    }
    const needed = value - view.playerInfluence;
    return {
      label,
      detail: `${label} at ${value} (${Math.ceil(needed)} more needed).`,
    };
  });
}

export {
  formatInfluenceValue,
  formatInfluenceMagnitudeLabel,
  formatThresholdStars,
  influenceMagnitude,
};
