import React, { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { createSprint4World } from 'shared';
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
  loadDispatches,
  loadLastActiveMs,
  loadWorld,
  saveDispatches,
  saveLastActiveMs,
  saveWorld,
} from '../storage/worldStorage';

interface GameContextValue {
  ready: boolean;
  world: WorldState;
  dispatches: SimEvent[];
  awayMs: number;
  /** Wall-clock ms for live ETA display (campaign time tracks real time). */
  wallNowMs: number;
  confirmMove: (unitId: string, toTerritoryId: string, stanceOnArrival?: TransitOrder['stanceOnArrival']) => Promise<void>;
  issueBuild: (territoryId: string, unitTypeId: string, count?: number) => Promise<void>;
  issueUpgradeInfra: (territoryId: string) => Promise<void>;
  skipNext: () => Promise<void>;
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
  const [ready, setReady] = useState(false);
  const [world, setWorld] = useState<WorldState>(() => createSprint4World());
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
    const merged = mergeDispatches(prevDispatches, events);
    setWorld(advanced);
    setDispatches(merged);
    await persist(advanced, merged);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [storedWorld, storedDispatches, lastActive] = await Promise.all([
        loadWorld(),
        loadDispatches(),
        loadLastActiveMs(),
      ]);
      if (cancelled) return;
      await applyCatchUp(
        storedWorld ?? createSprint4World(),
        storedDispatches,
        lastActive,
      );
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

  // Live wall clock for ETA countdowns; catch up sim when an arrival is due.
  useEffect(() => {
    if (!ready) return;

    const onTick = () => {
      const now = Date.now();
      setWallNowMs(now);

      const current = worldRef.current;
      const next = nextEventMs(current);
      if (next === null || next > now) return;

      const { world: advanced, events } = catchUp(current, now);
      const merged = mergeDispatches(dispatchesRef.current, events);
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
    const merged = mergeDispatches(dispatches, events);
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
    const merged = mergeDispatches(dispatches, events);
    setWorld(nextWorld);
    setDispatches(merged);
    await persist(nextWorld, merged);
  };

  const issueUpgrade = async (territoryId: string) => {
    const { world: nextWorld, events } = issueUpgradeInfra(world, territoryId);
    const merged = mergeDispatches(dispatches, events);
    setWorld(nextWorld);
    setDispatches(merged);
    await persist(nextWorld, merged);
  };

  const skipNext = async () => {
    const result = skipToNextEvent(world);
    if (!result) return;
    const merged = mergeDispatches(dispatches, result.events);
    setWorld(result.world);
    setDispatches(merged);
    await persist(result.world, merged);
  };

  return (
    <GameContext.Provider
      value={{ ready, world, dispatches, awayMs, wallNowMs, confirmMove, issueBuild: issueBuildOrder, issueUpgradeInfra: issueUpgrade, skipNext }}
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
