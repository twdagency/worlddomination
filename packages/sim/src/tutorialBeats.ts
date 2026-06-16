import type { Id, SimEvent, TutorialBeatId, WorldState } from './types';
import { enqueuePendingDilemma } from './dilemmas';
import {
  PLAYER_TUTORIAL_FACTION_ID,
  TUTORIAL_BURGUNDY_FACTION_ID,
  TUTORIAL_BURGUNDY_TERRITORY_ID,
  TUTORIAL_CALAIS_TERRITORY_ID,
  TUTORIAL_HOME_TERRITORY_ID,
  TUTORIAL_PARIS_TERRITORY_ID,
} from './tutorial';

export interface BeatPredicate {
  beat: TutorialBeatId;
  isComplete(event: SimEvent, world: WorldState): boolean;
}

function isPlayerArrivalAwayFromHome(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'arrival' &&
    event.ownerId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId !== TUTORIAL_HOME_TERRITORY_ID
  );
}

function isPlayerParisCapture(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'territoryCaptured' &&
    event.newOwnerId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_PARIS_TERRITORY_ID
  );
}

function isPlayerInfraUpgrade(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'infraUpgraded' &&
    event.factionId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_PARIS_TERRITORY_ID
  );
}

function treatyIncludesFaction(parties: [Id, Id], factionId: Id): boolean {
  return parties[0] === factionId || parties[1] === factionId;
}

function isPinchResolved(event: SimEvent, _world: WorldState): boolean {
  if (
    event.kind === 'territoryCaptured' &&
    event.newOwnerId === PLAYER_TUTORIAL_FACTION_ID &&
    (event.territoryId === TUTORIAL_BURGUNDY_TERRITORY_ID ||
      event.territoryId === TUTORIAL_CALAIS_TERRITORY_ID)
  ) {
    return true;
  }

  if (
    event.kind === 'treatyFormed' &&
    treatyIncludesFaction(event.parties, PLAYER_TUTORIAL_FACTION_ID) &&
    treatyIncludesFaction(event.parties, TUTORIAL_BURGUNDY_FACTION_ID)
  ) {
    return true;
  }

  if (
    event.kind === 'infraUpgraded' &&
    event.factionId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_HOME_TERRITORY_ID
  ) {
    return true;
  }

  return false;
}

function isPinchConquest(event: SimEvent): boolean {
  return (
    event.kind === 'territoryCaptured' &&
    event.newOwnerId === PLAYER_TUTORIAL_FACTION_ID &&
    (event.territoryId === TUTORIAL_BURGUNDY_TERRITORY_ID ||
      event.territoryId === TUTORIAL_CALAIS_TERRITORY_ID)
  );
}

function isForeignRuleResolved(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'dilemmaResolved' &&
    event.factionId === PLAYER_TUTORIAL_FACTION_ID &&
    event.dilemmaId === 'foreign-rule'
  );
}

function isTutorialHandoffReady(event: SimEvent, _world: WorldState): boolean {
  return (
    event.kind === 'tutorialHandoffReady' &&
    event.factionId === PLAYER_TUTORIAL_FACTION_ID
  );
}

export const TUTORIAL_BEAT_PREDICATES: readonly BeatPredicate[] = [
  { beat: 'movement', isComplete: isPlayerArrivalAwayFromHome },
  { beat: 'combat', isComplete: isPlayerParisCapture },
  { beat: 'economy', isComplete: isPlayerInfraUpgrade },
  { beat: 'pinch', isComplete: isPinchResolved },
  { beat: 'governance', isComplete: isForeignRuleResolved },
  { beat: 'handoff', isComplete: isTutorialHandoffReady },
];

export function isPinchConquestEvent(event: SimEvent): boolean {
  return isPinchConquest(event);
}
