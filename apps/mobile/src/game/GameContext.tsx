import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { BeatCopy } from 'shared';
import type { SimEvent, TransitOrder, TutorialBeatId, WorldState } from 'sim';
import {
  hasPendingProposalBetween,
  nextEventMs,
  playerAcceptProposal,
  playerBreakAlliance,
  playerDeclineProposal,
  playerFactionId,
  playerProposeAlliance,
  playerProposeTreaty,
  previewMoveEtaMs,
} from 'sim';
import {
  catchUp,
  issueBuild,
  issueMove,
  issueUpgradeInfra,
  mergeDispatches,
  skipToNextEvent,
} from './actions';
import {
  buildActionFeedback,
  dispatchActionFeedback,
  type ActionFeedback,
  type ActionFeedbackContext,
  type ActionKind,
} from './actionFeedback';
import { useToast } from '../components/feedback/ToastProvider';
import {
  createWorldForScenario,
  DEFAULT_SCENARIO_ID,
  isDevScenarioId,
  type DevScenarioId,
} from './scenarios';
import {
  clearCampaignStorage,
  loadDispatches,
  loadLastActiveMs,
  loadScenarioId,
  loadWorld,
  saveDispatches,
  saveLastActiveMs,
  saveScenarioId,
  saveWorld,
} from '../storage/worldStorage';
import { selectTutorialState } from './tutorialSelector';

export interface TutorialContextSlice {
  isTutorialActive: boolean;
  currentBeat: TutorialBeatId | null;
  currentBeatCopy: BeatCopy | null;
  isBannerDismissed: boolean;
  shouldShowBanner: boolean;
  dismissBanner: () => void;
  restoreBanner: () => void;
}

interface GameContextValue extends TutorialContextSlice {
  ready: boolean;
  world: WorldState;
  dispatches: SimEvent[];
  awayMs: number;
  scenarioId: DevScenarioId;
  wallNowMs: number;
  actionFeedback: ActionFeedback | null;
  clearActionFeedback: () => void;
  confirmMove: (
    unitId: string,
    toTerritoryId: string,
    stanceOnArrival?: TransitOrder['stanceOnArrival'],
  ) => Promise<void>;
  issueBuild: (territoryId: string, unitTypeId: string, count?: number) => Promise<void>;
  issueUpgradeInfra: (territoryId: string) => Promise<void>;
  skipNext: () => Promise<void>;
  loadScenario: (id: DevScenarioId) => Promise<void>;
  proposeAlliance: (targetFactionId: string) => Promise<void>;
  breakAlliance: (allyFactionId: string) => Promise<void>;
  proposeTreaty: (targetFactionId: string, territoryId: string) => Promise<void>;
  acceptProposal: (proposalId: string) => Promise<void>;
  declineProposal: (proposalId: string) => Promise<void>;
}

const GameContext = React.createContext<GameContextValue | null>(null);

async function persist(world: WorldState, dispatches: SimEvent[]): Promise<void> {
  await Promise.all([
    saveWorld(world),
    saveDispatches(dispatches),
    saveLastActiveMs(Date.now()),
  ]);
}

function resolveScenarioId(stored: string | null): DevScenarioId {
  if (stored && isDevScenarioId(stored)) return stored;
  return DEFAULT_SCENARIO_ID;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [scenarioId, setScenarioId] = useState<DevScenarioId>(DEFAULT_SCENARIO_ID);
  const [world, setWorld] = useState<WorldState>(() => createWorldForScenario(DEFAULT_SCENARIO_ID));
  const [dispatches, setDispatches] = useState<SimEvent[]>([]);
  const [awayMs, setAwayMs] = useState(0);
  const [wallNowMs, setWallNowMs] = useState(() => Date.now());
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [lastDismissedBeat, setLastDismissedBeat] = useState<TutorialBeatId | null>(null);
  const worldRef = useRef(world);
  const dispatchesRef = useRef(dispatches);
  worldRef.current = world;
  dispatchesRef.current = dispatches;

  const hasPendingEvents = nextEventMs(world) !== null;

  const tutorialState = useMemo(
    () => selectTutorialState({ world, lastDismissedBeat }),
    [world, lastDismissedBeat],
  );

  const dismissBanner = useCallback(() => {
    const beat = worldRef.current.tutorial?.currentBeat;
    if (beat) setLastDismissedBeat(beat);
  }, []);

  const restoreBanner = useCallback(() => {
    setLastDismissedBeat(null);
  }, []);

  const clearActionFeedback = useCallback(() => {
    setActionFeedback(null);
  }, []);

  const applyAction = useCallback(
    async (
      action: ActionKind,
      context: ActionFeedbackContext,
      execute: () => { world: WorldState; events: SimEvent[] },
    ) => {
      const result = execute();
      const applied = dispatchActionFeedback(
        {
          action,
          priorWorld: worldRef.current,
          nextWorld: result.world,
          events: result.events,
          context,
          showToast,
        },
        mergeDispatches,
        dispatchesRef.current,
      );
      setWorld(applied.world);
      setDispatches(applied.dispatches);
      setActionFeedback(applied.feedback);
      await persist(applied.world, applied.dispatches);
    },
    [showToast],
  );

  const applyBlockedAction = useCallback(
    async (action: ActionKind, context: ActionFeedbackContext) => {
      const feedback = buildActionFeedback(action, worldRef.current, [], context);
      showToast(feedback.toastMessage, feedback.toastTone);
      setActionFeedback(feedback);
    },
    [showToast],
  );

  const applyCatchUp = async (
    baseWorld: WorldState,
    prevDispatches: SimEvent[],
    lastActive: number | null,
  ) => {
    const now = Date.now();
    setAwayMs(lastActive && lastActive < now ? now - lastActive : 0);
    const { world: advanced, events } = catchUp(baseWorld, now);
    const merged = mergeDispatches(advanced, prevDispatches, events);
    setWorld(advanced);
    setDispatches(merged);
    await persist(advanced, merged);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedWorld, storedDispatches, lastActive, storedScenarioId] = await Promise.all([
        loadWorld(),
        loadDispatches(),
        loadLastActiveMs(),
        loadScenarioId(),
      ]);
      if (cancelled) return;

      const id = resolveScenarioId(storedScenarioId);
      setScenarioId(id);

      const worldMatchesScenario = storedWorld?.scenarioId === id;
      const baseWorld = worldMatchesScenario ? storedWorld! : createWorldForScenario(id);
      const baseDispatches = worldMatchesScenario ? storedDispatches : [];

      await applyCatchUp(baseWorld, baseDispatches, worldMatchesScenario ? lastActive : null);
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const onAppState = async (state: AppStateStatus) => {
      if (state !== 'active') return;
      const [storedWorld, storedDispatches, lastActive] = await Promise.all([
        loadWorld(),
        loadDispatches(),
        loadLastActiveMs(),
      ]);
      await applyCatchUp(storedWorld ?? world, storedDispatches, lastActive);
    };

    const sub = AppState.addEventListener('change', onAppState);
    return () => sub.remove();
  }, [ready, world]);

  useEffect(() => {
    if (!ready) return;

    const onTick = () => {
      const now = Date.now();
      setWallNowMs(now);

      const current = worldRef.current;
      const next = nextEventMs(current);
      if (next === null || next > now) return;

      const { world: advanced, events } = catchUp(current, now);
      const merged = mergeDispatches(advanced, dispatchesRef.current, events);
      setWorld(advanced);
      setDispatches(merged);
      void persist(advanced, merged);
    };

    onTick();
    const id = setInterval(onTick, hasPendingEvents ? 1000 : 60_000);
    return () => clearInterval(id);
  }, [ready, hasPendingEvents]);

  const confirmMove = async (
    unitId: string,
    toTerritoryId: string,
    stanceOnArrival: TransitOrder['stanceOnArrival'] = 'assault',
  ) => {
    const unit = world.units[unitId];
    const preview = previewMoveEtaMs(world, unitId, toTerritoryId);
    await applyAction(
      'move',
      {
        unitId,
        fromTerritoryId: unit?.locationId,
        toTerritoryId,
        stanceOnArrival,
        moveEtaMs: preview?.etaMs,
      },
      () => issueMove(world, unitId, toTerritoryId, stanceOnArrival),
    );
  };

  const issueBuildOrder = async (
    territoryId: string,
    unitTypeId: string,
    count: number = 1,
  ) => {
    await applyAction(
      'build',
      { territoryId, unitTypeId, count },
      () => issueBuild(world, territoryId, unitTypeId, count),
    );
  };

  const issueUpgrade = async (territoryId: string) => {
    await applyAction(
      'upgradeInfra',
      { territoryId },
      () => issueUpgradeInfra(world, territoryId),
    );
  };

  const skipNext = async () => {
    const result = skipToNextEvent(world);
    if (!result) return;
    const merged = mergeDispatches(result.world, dispatches, result.events);
    setWorld(result.world);
    setDispatches(merged);
    await persist(result.world, merged);
  };

  const loadScenario = async (id: DevScenarioId) => {
    if (!__DEV__) return;
    const fresh = createWorldForScenario(id);
    setScenarioId(id);
    setAwayMs(0);
    setDispatches([]);
    setActionFeedback(null);
    setLastDismissedBeat(null);
    setWorld(fresh);
    await clearCampaignStorage();
    await Promise.all([
      saveScenarioId(id),
      saveWorld(fresh),
      saveDispatches([]),
      saveLastActiveMs(Date.now()),
    ]);
  };

  const proposeAlliance = async (targetFactionId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    if (hasPendingProposalBetween(world, playerId, targetFactionId, 'alliance')) {
      await applyBlockedAction('proposeAlliance', {
        targetFactionId,
        blockedMessage: `${world.leaders[world.factions[targetFactionId]?.leaderId ?? '']?.name ?? 'Faction'} — alliance proposal already pending`,
      });
      return;
    }
    await applyAction(
      'proposeAlliance',
      { targetFactionId },
      () => playerProposeAlliance(world, playerId, targetFactionId, world.nowMs),
    );
  };

  const breakAlliance = async (allyFactionId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyAction(
      'breakAlliance',
      { allyFactionId },
      () => playerBreakAlliance(world, playerId, allyFactionId, world.nowMs),
    );
  };

  const proposeTreaty = async (targetFactionId: string, territoryId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    if (hasPendingProposalBetween(world, playerId, targetFactionId, 'treaty')) {
      await applyBlockedAction('proposeTreaty', {
        targetFactionId,
        territoryId,
        blockedMessage: `${world.leaders[world.factions[targetFactionId]?.leaderId ?? '']?.name ?? 'Faction'} — treaty proposal already pending`,
      });
      return;
    }
    await applyAction(
      'proposeTreaty',
      { targetFactionId, territoryId },
      () => playerProposeTreaty(world, playerId, targetFactionId, territoryId, world.nowMs),
    );
  };

  const acceptProposal = async (proposalId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    const proposal = world.pendingProposals.find((row) => row.id === proposalId);
    await applyAction(
      'acceptProposal',
      { proposalId, targetFactionId: proposal?.from },
      () => playerAcceptProposal(world, playerId, proposalId, world.nowMs),
    );
  };

  const declineProposal = async (proposalId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    const proposal = world.pendingProposals.find((row) => row.id === proposalId);
    await applyAction(
      'declineProposal',
      { proposalId, targetFactionId: proposal?.from },
      () => playerDeclineProposal(world, playerId, proposalId, world.nowMs),
    );
  };

  return (
    <GameContext.Provider
      value={{
        ready,
        world,
        dispatches,
        awayMs,
        scenarioId,
        wallNowMs,
        actionFeedback,
        clearActionFeedback,
        isTutorialActive: tutorialState.isActive,
        currentBeat: tutorialState.currentBeat,
        currentBeatCopy: tutorialState.currentBeatCopy,
        isBannerDismissed:
          tutorialState.currentBeat !== null &&
          tutorialState.currentBeat === lastDismissedBeat,
        shouldShowBanner: tutorialState.shouldShowBanner,
        dismissBanner,
        restoreBanner,
        confirmMove,
        issueBuild: issueBuildOrder,
        issueUpgradeInfra: issueUpgrade,
        skipNext,
        loadScenario,
        proposeAlliance,
        breakAlliance,
        proposeTreaty,
        acceptProposal,
        declineProposal,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = React.useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
