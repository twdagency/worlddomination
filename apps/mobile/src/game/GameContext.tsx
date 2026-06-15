import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SimEvent, TransitOrder, WorldState } from 'sim';
import { nextEventMs } from 'sim';
import {
  catchUp,
  issueBuild,
  issueMove,
  issueUpgradeInfra,
  mergeDispatches,
  skipToNextEvent,
} from './actions';
import {
  playerAcceptProposal,
  playerBreakAlliance,
  playerDeclineProposal,
  playerFactionId,
  playerProposeAlliance,
  playerProposeTreaty,
} from 'sim';
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

interface GameContextValue {
  ready: boolean;
  world: WorldState;
  dispatches: SimEvent[];
  awayMs: number;
  scenarioId: DevScenarioId;
  /** Wall-clock ms for live ETA display (campaign time tracks real time). */
  wallNowMs: number;
  confirmMove: (unitId: string, toTerritoryId: string, stanceOnArrival?: TransitOrder['stanceOnArrival']) => Promise<void>;
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
  const [ready, setReady] = useState(false);
  const [scenarioId, setScenarioId] = useState<DevScenarioId>(DEFAULT_SCENARIO_ID);
  const [world, setWorld] = useState<WorldState>(() => createWorldForScenario(DEFAULT_SCENARIO_ID));
  const [dispatches, setDispatches] = useState<SimEvent[]>([]);
  const [awayMs, setAwayMs] = useState(0);
  const [wallNowMs, setWallNowMs] = useState(() => Date.now());
  const worldRef = useRef(world);
  const dispatchesRef = useRef(dispatches);
  worldRef.current = world;
  dispatchesRef.current = dispatches;

  const hasPendingEvents = nextEventMs(world) !== null;

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
    const { world: nextWorld, events } = issueMove(world, unitId, toTerritoryId, stanceOnArrival);
    const merged = mergeDispatches(nextWorld, dispatches, events);
    setWorld(nextWorld);
    setDispatches(merged);
    await persist(nextWorld, merged);
  };

  const issueBuildOrder = async (
    territoryId: string,
    unitTypeId: string,
    count: number = 1,
  ) => {
    const { world: nextWorld, events } = issueBuild(world, territoryId, unitTypeId, count);
    const merged = mergeDispatches(nextWorld, dispatches, events);
    setWorld(nextWorld);
    setDispatches(merged);
    await persist(nextWorld, merged);
  };

  const issueUpgrade = async (territoryId: string) => {
    const { world: nextWorld, events } = issueUpgradeInfra(world, territoryId);
    const merged = mergeDispatches(nextWorld, dispatches, events);
    setWorld(nextWorld);
    setDispatches(merged);
    await persist(nextWorld, merged);
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
    setWorld(fresh);
    await clearCampaignStorage();
    await Promise.all([saveScenarioId(id), saveWorld(fresh), saveDispatches([]), saveLastActiveMs(Date.now())]);
  };

  const applyDiplomacy = async (
    result: { world: WorldState; events: SimEvent[] },
  ) => {
    const merged = mergeDispatches(result.world, dispatches, result.events);
    setWorld(result.world);
    setDispatches(merged);
    await persist(result.world, merged);
  };

  const proposeAlliance = async (targetFactionId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyDiplomacy(playerProposeAlliance(world, playerId, targetFactionId, world.nowMs));
  };

  const breakAlliance = async (allyFactionId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyDiplomacy(playerBreakAlliance(world, playerId, allyFactionId, world.nowMs));
  };

  const proposeTreaty = async (targetFactionId: string, territoryId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyDiplomacy(
      playerProposeTreaty(world, playerId, targetFactionId, territoryId, world.nowMs),
    );
  };

  const acceptProposal = async (proposalId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyDiplomacy(playerAcceptProposal(world, playerId, proposalId, world.nowMs));
  };

  const declineProposal = async (proposalId: string) => {
    const playerId = playerFactionId(world);
    if (!playerId) return;
    await applyDiplomacy(playerDeclineProposal(world, playerId, proposalId, world.nowMs));
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
