import { describe, expect, it, vi } from 'vitest';
import { createSprint4World } from 'shared';
import {
  buildActionFeedback,
  dispatchActionFeedback,
  previewBuildBlockedMessage,
} from './actionFeedback';
import { mergeDispatches } from './actions';

const START_MS = 1_700_000_000_000;
const LONDON = 'territory-london';
const PARIS = 'territory-paris';
const PLAYER = 'faction-player';

describe('buildActionFeedback', () => {
  it('formats move success with route and ETA', () => {
    const world = createSprint4World(START_MS);
    const feedback = buildActionFeedback(
      'move',
      world,
      [
        {
          kind: 'departure',
          at: START_MS,
          unitId: 'unit-player-mg',
          ownerId: PLAYER,
          fromTerritoryId: LONDON,
          toTerritoryId: PARIS,
          unitTypeId: 'mg-armor-t5',
          count: 10,
          stanceOnArrival: 'assault',
          intent: 'attack',
          source: 'direct',
          beatId: 'beat-move',
          decisionTickMs: START_MS,
        },
      ],
      {
        unitId: 'unit-player-mg',
        fromTerritoryId: LONDON,
        toTerritoryId: PARIS,
        moveEtaMs: START_MS + 12 * 3_600_000,
      },
    );

    expect(feedback.success).toBe(true);
    expect(feedback.toastMessage).toMatch(/Forces moving from London to Paris/i);
    expect(feedback.toastMessage).toMatch(/ETA/i);
    expect(feedback.dispatchEvents).toHaveLength(1);
  });

  it('surfaces buildBlocked failures with specific reasons', () => {
    const world = createSprint4World(START_MS);
    const feedback = buildActionFeedback(
      'build',
      world,
      [
        {
          kind: 'buildBlocked',
          at: START_MS,
          territoryId: LONDON,
          reason: 'Cannot build Scout — missing food',
          importance: 'medium',
        },
      ],
      { territoryId: LONDON, unitTypeId: 'scout-t1' },
    );

    expect(feedback.success).toBe(false);
    expect(feedback.toastTone).toBe('error');
    expect(feedback.toastMessage).toMatch(/missing food/i);
    expect(feedback.inline.isError).toBe(true);
  });

  it('uses blockedMessage for client-side validation without sim events', () => {
    const world = createSprint4World(START_MS);
    const message = previewBuildBlockedMessage(world, LONDON, 'riflemen-t3', 1);
    expect(message).toBeDefined();

    const feedback = buildActionFeedback('build', world, [], {
      territoryId: LONDON,
      unitTypeId: 'riflemen-t3',
      blockedMessage: message,
    });

    expect(feedback.success).toBe(false);
    expect(feedback.toastMessage).toBe(message);
    expect(feedback.dispatchEvents).toHaveLength(0);
  });
});

describe('dispatchActionFeedback', () => {
  it('invokes toast, merges dispatch events, and returns inline feedback', () => {
    const world = createSprint4World(START_MS);
    const showToast = vi.fn();
    const events = [
      {
        kind: 'allianceDeclined' as const,
        at: START_MS,
        from: PLAYER,
        to: 'faction-rome',
        declinedBy: 'faction-rome',
        beatId: 'beat',
        decisionTickMs: START_MS,
        importance: 'medium' as const,
      },
    ];

    const result = dispatchActionFeedback(
      {
        action: 'proposeAlliance',
        priorWorld: world,
        nextWorld: world,
        events,
        context: { targetFactionId: 'faction-rome' },
        showToast,
      },
      mergeDispatches,
      [],
    );

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(result.feedback.success).toBe(false);
    expect(result.dispatches).toHaveLength(1);
    expect(result.feedback.inline.summary).toMatch(/declined/i);
  });
});
