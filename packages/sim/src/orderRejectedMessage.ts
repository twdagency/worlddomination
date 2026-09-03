export type AssaultOrderRejectionReason = 'cannot-assault-own-territory';

export function formatOrderRejectedMessage(reason: AssaultOrderRejectionReason | string): string {
  if (reason === 'cannot-assault-own-territory') {
    return 'Cannot issue assault on own territory.';
  }
  return reason;
}
