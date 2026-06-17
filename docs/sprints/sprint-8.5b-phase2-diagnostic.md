# Sprint 8.5b Phase 2 — Badge Clearing Diagnostic

**Branch:** `sprint-8.5b/badge-fix` (on top of `55b6cd6`)  
**Status:** Diagnostic only — no fix yet  
**Device result (Phase 1):** Badge appears ✅ · Dashboard clear ❌ · Dispatches clear blocked · Persistence ❌

---

## Static audit

### Navigation / focus (Hypothesis A)

| Check | Finding |
|-------|---------|
| `useFocusEffect` import | `@react-navigation/native` — correct in `DashboardScreen.tsx:3`, `DispatchesScreen.tsx:3` |
| Callback shape | `useCallback` wrapper — correct |
| Dashboard placement | `DashboardHome` is root of `HomeStackNavigator` (`HomeStackNavigator.tsx:14`) |
| Tab wiring | Home tab mounts `HomeStackNavigator` (`RootTabs.tsx:165-166`), `initialRouteName="Dashboard"` (`RootTabs.tsx:138`) |
| Header placement | `PersistentHeader` is **outside** `Tab.Navigator` but inside `GameProvider` (`RootTabs.tsx:125`) — should still re-render on context updates |

**Risk:** If user previously opened Dispatches via bell, Home stack may still be on `Dispatches` when switching back to Home tab — `DashboardScreen` focus would **not** fire; `DispatchesScreen` focus would. Both screens call `markDispatchesViewed`. Device logs must distinguish which focus line appears.

**Risk:** `useFocusEffect` not firing is plausible on device but **not** evidenced statically — requires logs.

### Context / state propagation (Hypothesis B)

| Check | Finding |
|-------|---------|
| State | `lastViewedDispatchesAt` in `GameContext.tsx:129`, exposed `GameContext.tsx:536` |
| `markDispatchesViewed` | Sets state + `saveLastViewedDispatchesAt` (`GameContext.tsx:260-264`) |
| Stale closure | `useCallback` with `[]` deps — OK |
| **Hydration race** | Separate `useEffect` loads AsyncStorage **after mount** (`GameContext.tsx:266-270`) with **no guard** against overwriting a newer `markDispatchesViewed` value |

**Hydration race scenario (Hypothesis B′):**

1. `lastViewedDispatchesAt` starts at `0`
2. `ready=true` → Dashboard focuses → `markDispatchesViewed` sets `T1`, persists async
3. Hydration completes later with stale `T0` from storage → `setLastViewedDispatchesAt(T0)` **overwrites** `T1`

This explains persistence failure if saves never win the race, or if hydration always reapplies old storage on cold start after a failed mid-session mark.

### Caller audit (Hypothesis C)

| Caller | Passes `lastViewedDispatchesAt`? | File:line |
|--------|----------------------------------|-----------|
| `PersistentHeader` | ✅ from `useGame()` | `PersistentHeader.tsx:23-34` |
| `DashboardScreen` digest badge | ✅ from `useGame()` | `DashboardScreen.tsx:28-46` |
| Tests | ✅ explicit `0` or test values | `dashboardUnreadCount.test.ts` |

**Hypothesis C ruled out statically** — no caller uses old signature or hardcoded `0` at runtime.

### Timeline mismatch (Hypothesis D — not in original list, high priority)

| Clock | Source |
|-------|--------|
| `markDispatchesViewed` | `Date.now()` (wall clock) — `GameContext.tsx:261` |
| `event.at` on dispatches | `world.nowMs` at emit time — sim (`clock.ts:97`, `movement.ts:138`, etc.) |
| Tests | Use same numeric timeline (e.g. `at: 100`, `lastViewedAt: 250`) — **never exercises wall vs sim skew** |

`catchUp(world, Date.now())` should align `world.nowMs` to wall clock at catch-up boundaries (`GameContext.tsx:315`, `381`). Between ticks, `event.at` should still be `≤` wall `Date.now()` at creation.

**If `unreadHighAt` in logs is consistently greater than `lastViewedAt` after `markDispatchesViewed`**, Hypothesis D is confirmed (comparison uses mismatched clocks or sim runs ahead).

---

## Diagnostic instrumentation

Search Metro / Logcat for `[badge-diag]`:

| Log | Location | Meaning |
|-----|----------|---------|
| `hydrated lastViewedAt` | `GameContext.tsx` | AsyncStorage hydration value |
| `markDispatchesViewed called` | `GameContext.tsx` | Mark callback ran |
| `Dashboard focus effect fired` | `DashboardScreen.tsx` | Home stack dashboard focused |
| `Dispatches focus effect fired` | `DispatchesScreen.tsx` | Dispatches screen focused |
| `getDashboardUnreadDispatchCount` | `playerView.ts` | Selector internals + `unreadHighAt[]` |
| `badge selector called` | `PersistentHeader.tsx` | Header render inputs |

### Device reproduction script

1. Clean checkout: `git stash` WIP, `git checkout 55b6cd6` or diagnostic commit on branch
2. `cd apps/mobile && pnpm android`
3. Cold start — note hydration + initial focus + badge selector logs
4. World tab → trigger high-importance dispatch → note badge count
5. Home tab → note whether Dashboard **or** Dispatches focus fires + `markDispatchesViewed`
6. Note badge selector `count` and `unreadHighAt` vs `lastViewedAt`
7. Force-close → reopen → note hydration value vs badge

### Log pattern → hypothesis

| Pattern | Likely cause |
|---------|----------------|
| No `Dashboard focus` / `Dispatches focus` on Home tab | **A** — focus hook not firing |
| Focus + `markDispatchesViewed` but `lastViewedAt` unchanged in next selector log | **B** — state not propagating |
| `markDispatchesViewed` then hydration overwrites with older value | **B′** — hydration race |
| `markDispatchesViewed` runs, `lastViewedAt` updates, but `unreadHighAt` all `> lastViewedAt` | **D** — timeline mismatch |
| `lastViewedAt` updates, `unreadHighAt` empty, but `count > 0` | Selector bug (unlikely) |

---

## Preliminary hypothesis ranking (static only — confirm on device)

1. **D — Timeline / comparison mismatch** (`Date.now()` vs `event.at` / `world.nowMs`) — tests wouldn't catch; matches "badge shows but never clears"
2. **B′ — Hydration race** — explains persistence; may compound cold start
3. **A — Focus not firing** — possible; needs logs
4. **C — Wrong caller** — ruled out statically

---

## Phase 3 fix scope (estimate, pending device logs)

| If confirmed | Fix direction | Effort |
|--------------|---------------|--------|
| **D** | `markDispatchesViewed` uses `world.nowMs` (or `Math.max(Date.now(), world.nowMs)`); store sim clock | Small |
| **B′** | Hydrate in initial `Promise.all` before `ready`, or skip hydration if state already newer | Small |
| **A** | Mark on tab press listener / `navigation.addListener('focus')` on Home stack / `useIsFocused` fallback | Medium |
| **A + stack** | Reset Home stack to `DashboardHome` on tab press | Medium |

## Phase 3 — Fix applied

**Root cause (confirmed on device):** Hypothesis D — `markDispatchesViewed` stored `Date.now()` while dispatch `event.at` uses `world.nowMs`. Tutorial pacing leaves `world.nowMs` far ahead of wall clock; `event.at > lastViewedAt` never clears.

**Fix:** `markDispatchesViewed` uses `worldRef.current.nowMs`; hydration loads in initial `Promise.all` before `ready` (no async race).

**Commit:** `sprint-8.5b: phase-3 fix dispatch read-state sim timeline`


**Unknown from agent side.** Income-display WIP was in the working tree during development; it was **stashed** before Phase 2 (`git stash` — income display WIP). **Recommend re-testing on diagnostic commit with `git status` clean.**

## Q2 — Proceed with Phase 2

**Done** — this document + diagnostic logs committed; device run required to confirm hypothesis.
