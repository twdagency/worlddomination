import { formatOrderRejectedMessage } from './movement';
import type { PressureProposalKind } from './types';
import type { InfluenceOrderRejectionReason } from './influenceOrderValidation';

export function formatDiplomaticPressureProposalLabel(proposalKind: PressureProposalKind): string {
  switch (proposalKind) {
    case 'accept-alliance':
      return 'alliance';
    case 'accept-treaty':
      return 'treaty';
    case 'concession-territory':
      return 'territory concession';
    case 'concession-resource':
      return 'resource concession';
  }
}

export function formatInfluenceOrderRejectedMessage(
  reason: InfluenceOrderRejectionReason | string,
): string {
  switch (reason) {
    case 'insufficient-gold':
      return 'Insufficient gold for this influence action.';
    case 'insufficient-manpower':
      return 'Insufficient manpower for subversion.';
    case 'target-is-own-city':
      return 'Cannot apply influence in your own cities.';
    case 'target-is-allied':
      return 'Cannot target allied territory with influence actions.';
    case 'target-owner-defeated':
      return 'Cannot target a defeated country.';
    case 'target-city-unknown':
      return 'Target city not found.';
    case 'mission-already-active':
      return 'A diplomatic mission is already active in this city.';
    case 'cultural-campaign-cooldown':
      return 'Cultural campaign is still on cooldown for this city.';
    case 'no-active-mission':
      return 'No active diplomatic mission to cancel.';
    case 'insufficient-influence':
      return 'Insufficient influence for diplomatic pressure (requires 30+).';
    case 'no-pending-proposal':
      return 'No matching pending proposal to force acceptance.';
    case 'unsupported-proposal-kind':
      return 'This diplomatic pressure proposal kind is not yet available.';
    case 'target-country-mismatch':
      return 'Target city is not owned by the specified country.';
    case 'active-treaty-exists':
      return 'An active treaty already covers this territory.';
    case 'tribute-already-active':
      return 'A tribute extraction is already active in this city.';
    case 'no-active-tribute':
      return 'No active tribute extraction to cancel.';
    case 'intelligence-on-cooldown':
      return 'Intelligence gathering is still on cooldown for this city.';
    case 'intelligence-fresh':
      return 'Recent intelligence on this city is still fresh.';
    default:
      return formatOrderRejectedMessage(reason);
  }
}
