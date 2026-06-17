import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { BeatCopy } from 'shared';
import type { SimEvent, TransitOrder, TutorialBeatId, WorldState, Millis } from 'sim';
import {
  evaluateBeatProgression,
  getDilemmaById,
  graduateTutorial,
  hasPendingProposalBetween,
  nextEventMs,
  playerAcceptProposal,
  playerBreakAlliance,
  playerDeclineProposal,
  playerFactionId,
  playerProposeAlliance,
  playerProposeTreaty,
  previewMoveEtaMs,
  resolveDilemma,
  stampEvents,
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
  FIRST_TIME_SCENARIO_ID,
  resolveScenarioId,
  type DevScenarioId,
  type ScenarioId,
} from './scenarios';
import {
  clearCampaignStorage,
  loadDispatches,
  loadLastActiveMs,
  loadLastViewedDispatchesAt,
  loadScenarioId,
  loadWorld,
  saveDispatches,
  saveLastActiveMs,
  saveLastViewedDispatchesAt,
  saveScenarioId,
  saveTutorialOnboarded,
  saveWorld,
} from '../storage/worldStorage';
import { selectTutorialState, type TutorialBannerMode } from './tutorialSelector';
import {
  resolveDilemmaModalState,
  type DilemmaModalState,
} from './dilemmaModalController';

export interface TutorialContextSlice {
  isTutorialActive: boolean;
  currentBeat: TutorialBeatId | null;
  currentBeatCopy: BeatCopy | null;
  isBannerDismissed: boolean;
  shouldShowBanner: boolean;
  bannerMode: TutorialBannerMode;
  isHandoffReady: boolean;
  dismissBanner: () => void;
  restoreBanner: () => void;
  collapseTutorialBanner: () => void;
  expandTutorialBanner: () => void;
  graduate: () => Promise<void>;
}

interface GameContextValue extends TutorialContextSlice {
  ready: boolean;
  world: WorldState;
  dispatches: SimEvent[];
  awayMs: number;
  lastViewedDispatchesAt: Millis;
  markDispatchesViewed: () => void;
  scenarioId: ScenarioId;
  wallNowMs: number;
  actionFeedback: ActionFeedback | null;
  clearActionFeedback: () => void;
  resolvePendingDilemma: (dilemmaId: string, optionId: string) => Promise<void>;
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
  dilemmaModalState: DilemmaModalState;
  dismissDilemmaModal: () => void;
  openDilemmaModal: (dilemmaId: string) => void;
}

const GameContext = React.createContext<GameContextValue | null>(null);

async function persist(world: WorldState, dispatches: SimEvent[]): Promise<void> {
  await Promise.all([
    saveWorld(world),
    saveDispatches(dispatches),
    saveLastActiveMs(Date.now()),
  ]);
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [ready, setReady] = useState(false);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(FIRST_TIME_SCENARIO_ID);
  const [world, setWorld] = useState<WorldState>(() =>
    createWorldForScenario(FIRST_TIME_SCENARIO_ID),
  );
  const [dispatches, setDispatches] = useState<SimEvent[]>([]);
  const [awayMs, setAwayMs] = useState(0);
  const [lastViewedDispatchesAt, setLastViewedDispatchesAt] = useState<Millis>(0);
  const [wallNowMs, setWallNowMs] = useState(() => Date.now());
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback | null>(null);
  const [lastDismissedBeat, setLastDismissedBeat] = useState<TutorialBeatId | null>(null);
  const [dismissedDilemmaIds, setDismissedDilemmaIds] = useState<Set<string>>(() => new Set());
  const [manualDilemmaId, setManualDilemmaId] = useState<string | null>(null);
  const [bannerCollapsedBeat, setBannerCollapsedBeat] = useState<TutorialBeatId | null>(null);
  const worldRef = useRef(world);
  const dispatchesRef = useRef(dispatches);
  worldRef.current = world;
  dispatchesRef.current = dispatches;

  const hasPendingEvents = nextEventMs(world) !== null;

  const tutorialState = useMemo(
    () => selectTutorialState({ world, lastDismissedBeat, bannerCollapsedBeat }),
    [world, lastDismissedBeat, bannerCollapsedBeat],
  );

  const tutorialBeatKey = useMemo((): TutorialBeatId | null => {
    if (tutorialState.currentBeat) return tutorialState.currentBeat;
    return tutorialState.isHandoffReady ? 'handoff' : null;
  }, [tutorialState.currentBeat, tutorialState.isHandoffReady]);

  useEffect(() => {
    setBannerCollapsedBeat(null);
  }, [tutorialBeatKey]);

  const dismissBanner = useCallback(() => {
    const tutorial = worldRef.current.tutorial;
    if (!tutorial?.active) return;
    const beat =
      tutorial.currentBeat ??
      (tutorial.completedBeats.includes('handoff') ? ('handoff' as TutorialBeatId) : null);
    if (beat) setLastDismissedBeat(beat);
  }, []);

  const graduate = useCallback(async () => {
    const { world: nextWorld, events } = graduateTutorial(worldRef.current, Date.now());
    const merged = mergeDispatches(nextWorld, dispatchesRef.current, events);
    setWorld(nextWorld);
    setDispatches(merged);
    setLastDismissedBeat(null);
    setBannerCollapsedBeat(null);
    await saveTutorialOnboarded(true);
    await persist(nextWorld, merged);
    showToast('Your tutorial is complete. The campaign continues at standard speed.', 'success');
  }, [showToast]);

  const dilemmaModalState = useMemo(
    () =>
      resolveDilemmaModalState({
        world: ready ? world : null,
        dismissedDilemmaIds,
        manualDilemmaId,
      }),
    [ready, world, dismissedDilemmaIds, manualDilemmaId],
  );

  const dismissDilemmaModal = useCallback(() => {
    if (!dilemmaModalState.dilemmaId || !dilemmaModalState.canDismiss) return;
    setDismissedDilemmaIds((current) => {
      const next = new Set(current);
      next.add(dilemmaModalState.dilemmaId!);
      return next;
    });
    setManualDilemmaId(null);
  }, [dilemmaModalState.canDismiss, dilemmaModalState.dilemmaId]);

  const openDilemmaModal = useCallback((dilemmaId: string) => {
    setManualDilemmaId(dilemmaId);
  }, []);

  const resolvePendingDilemma = useCallback(
    async (dilemmaId: string, optionId: string) => {
      const playerId = playerFactionId(worldRef.current);
      if (!playerId) return;

      const dilemma = getDilemmaById(dilemmaId);
      const option = dilemma?.options.find((entry) => entry.id === optionId);
      const resolved = resolveDilemma(
        worldRef.current,
        playerId,
        dilemmaId,
        optionId,
        Date.now(),
      );
      const progressed = evaluateBeatProgression(resolved.world, resolved.events);
      const handoffStamped = stampEvents(progressed.world, progressed.events);
      const allEvents = [...resolved.events, ...handoffStamped.events];
      const nextWorld = handoffStamped.world;
      const merged = mergeDispatches(nextWorld, dispatchesRef.current, allEvents);
      setWorld(nextWorld);
      setDispatches(merged);
      setManualDilemmaId(null);
      setDismissedDilemmaIds((current) => {
        if (!current.has(dilemmaId)) return current;
        const next = new Set(current);
        next.delete(dilemmaId);
        return next;
      });
      await persist(nextWorld, merged);
      if (option) {
        showToast(`Decision made: ${option.label}`, 'success');
      }
    },
    [showToast],
  );

  const restoreBanner = useCallback(() => {
    setLastDismissedBeat(null);
    const tutorial = worldRef.current.tutorial;
    const beat =
      tutorial?.currentBeat ??
      (tutorial?.completedBeats.includes('handoff') ? ('handoff' as TutorialBeatId) : null);
    if (beat) setBannerCollapsedBeat(beat);
  }, []);

  const collapseTutorialBanner = useCallback(() => {
    if (!tutorialBeatKey) return;
    setBannerCollapsedBeat(tutorialBeatKey);
  }, [tutorialBeatKey]);

  const expandTutorialBanner = useCallback(() => {
    setBannerCollapsedBeat(null);
  }, []);

  const clearActionFeedback = useCallback(() => {
    setActionFeedback(null);
  }, []);

  const markDispatchesViewed = useCallback(() => {
    const now = Date.now();
    setLastViewedDispatchesAt(now);
    void saveLastViewedDispatchesAt(now);
  }, []);

  useEffect(() => {
    void loadLastViewedDispatchesAt().then((stored) => {
      if (stored !== null) setLastViewedDispatchesAt(stored);
    });
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

      const hasStoredWorld = storedWorld !== null;
      const id = resolveScenarioId(storedScenarioId, hasStoredWorld);
      setScenarioId(id);

      const worldMatchesScenario = hasStoredWorld && storedWorld!.scenarioId === id;
      const baseWorld = worldMatchesScenario ? storedWorld! : createWorldForScenario(id);
      const baseDispatches = worldMatchesScenario ? storedDispatches : [];

      if (!hasStoredWorld) {
        await saveScenarioId(id);
      }

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
    setLastViewedDispatchesAt(0);
    setActionFeedback(null);
    setLastDismissedBeat(null);
    setBannerCollapsedBeat(null);
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
        lastViewedDispatchesAt,
        markDispatchesViewed,
        scenarioId,
        wallNowMs,
        actionFeedback,
        clearActionFeedback,
        isTutorialActive: tutorialState.isActive,
        currentBeat: tutorialState.currentBeat,
        currentBeatCopy: tutorialState.currentBeatCopy,
        isBannerDismissed: tutorialState.isHandoffReady
          ? lastDismissedBeat === 'handoff'
          : tutorialState.currentBeat !== null &&
            tutorialState.currentBeat === lastDismissedBeat,
        shouldShowBanner: tutorialState.shouldShowBanner,
        bannerMode: tutorialState.bannerMode,
        isHandoffReady: tutorialState.isHandoffReady,
        dismissBanner,
        restoreBanner,
        collapseTutorialBanner,
        expandTutorialBanner,
        graduate,
        resolvePendingDilemma,
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
        dilemmaModalState,
        dismissDilemmaModal,
        openDilemmaModal,
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
