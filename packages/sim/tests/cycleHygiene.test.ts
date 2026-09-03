import { describe, expect, it } from 'vitest';
import { computeBeatId } from '../src/beatId';
import { allianceFormedEvent } from '../src/diplomaticEvents';
import { formatAllianceFormedLine } from '../src/diplomaticDispatchLines';
import {
  ALLIANCE_ACCEPT_THRESHOLD,
  scoreAllianceAcceptance,
  scoreTreatyAcceptance,
  TREATY_ACCEPT_THRESHOLD,
} from '../src/diplomaticScoring';
import { ensureWorldMigrations } from '../src/migrations';
import {
  DIPLOMATIC_PRESSURE_MIN_INFLUENCE,
  INTELLIGENCE_MIN_INFLUENCE,
  INFLUENCE_SWAY_THRESHOLD,
} from '../src/influenceConstants';
import { formatInfluenceOrderRejectedMessage } from '../src/influenceOrderMessages';
import { isInfluenceOrder, validateInfluenceTarget } from '../src/influenceOrderValidation';
import { formatOrderRejectedMessage } from '../src/orderRejectedMessage';
import { playerFactionId } from '../src/playerIdentity';
import { captureCityForCoup } from '../src/territoryOwnership';
import { createSprint4World } from '../../shared/src/scenario-sprint4';

const START_MS = 1_700_900_000_000;

function world() {
  return ensureWorldMigrations(createSprint4World(START_MS));
}

describe('cycle hygiene — extracted modules', () => {
  it('diplomaticScoring exports thresholds and scoring without cyclic init', () => {
    const w = world();
    expect(ALLIANCE_ACCEPT_THRESHOLD).toBe(50);
    expect(TREATY_ACCEPT_THRESHOLD).toBe(35);
    expect(scoreAllianceAcceptance(w, 'faction-rome', 'faction-player')).toBeTypeOf('number');
    expect(scoreTreatyAcceptance(w, 'faction-rome', 'faction-player', 'territory-paris')).toBeTypeOf(
      'number',
    );
  });

  it('diplomaticEvents exports event builders without dispatch import', () => {
    const draft = allianceFormedEvent('faction-a', 'faction-b', 1_000, 'faction-a');
    expect(draft.kind).toBe('allianceFormed');
    expect(draft.beatId).toBe(computeBeatId('faction-a', 1_000, 'direct'));
  });

  it('diplomaticDispatchLines formats alliance lines without influenceAccelerators', () => {
    const w = world();
    const line = formatAllianceFormedLine(w, {
      kind: 'allianceFormed',
      at: w.nowMs,
      parties: ['faction-player', 'faction-rome'],
      initiatingFaction: 'faction-player',
      beatId: 'abc',
      decisionTickMs: w.nowMs,
      importance: 'high',
      eventId: 'evt-1',
    });
    expect(line).toContain('DIPLOMACY');
  });

  it('territoryOwnership transfers city ownership for coup path', () => {
    const w = world();
    const targetCityId = 'territory-paris';
    const previousOwner = w.territories[targetCityId]?.ownerId;
    expect(previousOwner).toBeTruthy();

    const result = captureCityForCoup(
      w,
      targetCityId,
      'faction-player',
      previousOwner!,
      w.nowMs,
    );
    expect(result.world.territories[targetCityId]?.ownerId).toBe('faction-player');
    expect(result.events[0]?.kind).toBe('territoryCaptured');
  });

  it('influenceOrderValidation classifies influence orders', () => {
    const w = world();
    expect(
      isInfluenceOrder({
        kind: 'annexation-claim',
        ownerId: 'faction-player',
        targetCityId: 'territory-paris',
      }),
    ).toBe(true);
    const check = validateInfluenceTarget(w, 'faction-player', 'territory-london');
    expect(check.ok).toBe(false);
    if (!check.ok) expect(check.reason).toBe('target-is-own-city');
  });

  it('influenceConstants is a leaf with one sway threshold for pressure and intelligence', () => {
    expect(INFLUENCE_SWAY_THRESHOLD).toBe(30);
    expect(DIPLOMATIC_PRESSURE_MIN_INFLUENCE).toBe(INTELLIGENCE_MIN_INFLUENCE);
    expect(INTELLIGENCE_MIN_INFLUENCE).toBe(INFLUENCE_SWAY_THRESHOLD);
  });

  it('influenceOrderMessages formats rejection copy without validation imports', () => {
    expect(formatInfluenceOrderRejectedMessage('insufficient-gold')).toContain('gold');
    expect(formatInfluenceOrderRejectedMessage('target-is-allied')).toContain('allied');
  });

  it('playerIdentity resolves the player without importing dispatch', () => {
    expect(playerFactionId(world())).toBe('faction-player');
  });

  it('orderRejectedMessage formats assault rejection without movement', () => {
    expect(formatOrderRejectedMessage('cannot-assault-own-territory')).toContain('own territory');
    expect(formatInfluenceOrderRejectedMessage('cannot-assault-own-territory')).toContain(
      'own territory',
    );
  });
});
