import { describe, expect, it } from 'vitest';
import { createSprint4World } from 'shared';
import { createTutorialWorld } from 'shared';
import { PLAYER_TUTORIAL_FACTION_ID } from 'sim';
import { selectPendingDilemmaCards } from '../src/game/dilemmaSelector';

const START_MS = 1_700_500_000_000;

describe('dilemma selector', () => {
  it('returns an empty array for a null world', () => {
    expect(selectPendingDilemmaCards(null)).toEqual([]);
  });

  it('returns an empty array when no dilemmas are pending', () => {
    const world = createTutorialWorld(START_MS);
    expect(selectPendingDilemmaCards(world)).toEqual([]);
  });

  it('returns one player dilemma card with the correct title', () => {
    const world = createTutorialWorld(START_MS);
    const withDilemma = {
      ...world,
      pendingDilemmas: [
        {
          dilemmaId: 'foreign-rule',
          factionId: PLAYER_TUTORIAL_FACTION_ID,
          offeredAt: START_MS,
        },
      ],
    };

    expect(selectPendingDilemmaCards(withDilemma)).toEqual([
      {
        dilemmaId: 'foreign-rule',
        title: 'How will you rule Paris?',
        factionId: PLAYER_TUTORIAL_FACTION_ID,
      },
    ]);
  });

  it('does not surface dilemmas assigned to AI factions', () => {
    const world = createSprint4World(START_MS);
    const aiFaction = Object.values(world.factions).find((faction) => !faction.isPlayer);
    expect(aiFaction).toBeTruthy();

    const withDilemma = {
      ...world,
      pendingDilemmas: [
        {
          dilemmaId: 'foreign-rule',
          factionId: aiFaction!.id,
          offeredAt: START_MS,
        },
      ],
    };

    expect(selectPendingDilemmaCards(withDilemma)).toEqual([]);
  });
});
