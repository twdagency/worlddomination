import type { Id, SimEventKind, TutorialBeatId, WorldState } from './types';
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
  isComplete(event: SimEventKind, world: WorldState): boolean;
}

function isPlayerArrivalAwayFromHome(event: SimEventKind, _world: WorldState): boolean {
  return (
    event.kind === 'arrival' &&
    event.ownerId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId !== TUTORIAL_HOME_TERRITORY_ID
  );
}

function isPlayerParisCapture(event: SimEventKind, _world: WorldState): boolean {
  return (
    event.kind === 'territoryCaptured' &&
    event.newOwnerId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_PARIS_TERRITORY_ID
  );
}

function isPlayerInfraUpgrade(event: SimEventKind, _world: WorldState): boolean {
  return (
    event.kind === 'infraUpgraded' &&
    event.countryId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_PARIS_TERRITORY_ID
  );
}

function treatyIncludesFaction(parties: [Id, Id], factionId: Id): boolean {
  return parties[0] === factionId || parties[1] === factionId;
}

function isPinchResolved(event: SimEventKind, _world: WorldState): boolean {
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
    event.countryId === PLAYER_TUTORIAL_FACTION_ID &&
    event.territoryId === TUTORIAL_HOME_TERRITORY_ID
  ) {
    return true;
  }

  return false;
}

function isPinchConquest(event: SimEventKind): boolean {
  return (
    event.kind === 'territoryCaptured' &&
    event.newOwnerId === PLAYER_TUTORIAL_FACTION_ID &&
    (event.territoryId === TUTORIAL_BURGUNDY_TERRITORY_ID ||
      event.territoryId === TUTORIAL_CALAIS_TERRITORY_ID)
  );
}

function isForeignRuleResolved(event: SimEventKind, _world: WorldState): boolean {
  return (
    event.kind === 'dilemmaResolved' &&
    event.countryId === PLAYER_TUTORIAL_FACTION_ID &&
    event.dilemmaId === 'foreign-rule'
  );
}

function isTutorialHandoffReady(event: SimEventKind, _world: WorldState): boolean {
  return (
    event.kind === 'tutorialHandoffReady' &&
    event.countryId === PLAYER_TUTORIAL_FACTION_ID
  );
}

/** Completes on a player influence-channel success or a bought intelligence report. */
function isPlayerInfluenceLesson(event: SimEventKind, _world: WorldState): boolean {
  switch (event.kind) {
    case 'diplomaticMissionStarted':
    case 'culturalCampaignApplied':
    case 'subversionApplied':
      return event.ownerId === PLAYER_TUTORIAL_FACTION_ID;
    case 'diplomaticPressureApplied':
    case 'tributeStarted':
    case 'coupSuccess':
    case 'defectionOccurred':
      return event.actorId === PLAYER_TUTORIAL_FACTION_ID;
    case 'intelReport':
      return (
        event.source === 'intelligence' &&
        (event.observerFaction === PLAYER_TUTORIAL_FACTION_ID ||
          event.receiverFaction === PLAYER_TUTORIAL_FACTION_ID)
      );
    default:
      return false;
  }
}

/** True when at least one undefeated foreign city remains to teach against. */
export function hasTutorialForeignInfluenceTarget(world: WorldState): boolean {
  return Object.values(world.territories).some((territory) => {
    const ownerId = territory.ownerId;
    if (!ownerId || ownerId === PLAYER_TUTORIAL_FACTION_ID) return false;
    const country = world.countries?.[ownerId] ?? world.factions[ownerId];
    return country?.defeated !== true;
  });
}

export const TUTORIAL_BEAT_PREDICATES: readonly BeatPredicate[] = [
  { beat: 'movement', isComplete: isPlayerArrivalAwayFromHome },
  { beat: 'combat', isComplete: isPlayerParisCapture },
  { beat: 'economy', isComplete: isPlayerInfraUpgrade },
  { beat: 'pinch', isComplete: isPinchResolved },
  { beat: 'governance', isComplete: isForeignRuleResolved },
  { beat: 'influence', isComplete: isPlayerInfluenceLesson },
  { beat: 'handoff', isComplete: isTutorialHandoffReady },
];

export function isPinchConquestEvent(event: SimEventKind): boolean {
  return isPinchConquest(event);
}
