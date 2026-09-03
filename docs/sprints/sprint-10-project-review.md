# Sprint 10 — Full project review

**Date:** Sprint 10, post-Phase 6 (Intelligence Action + AI Usage accepted)
**Baseline at review:** 932 tests passing (654 sim / 278 mobile), 0 internal sim import cycles
**Scope:** Gameplay, features, security, UI/UX, stability, accuracy, tooling

Review conducted across four parallel audits: sim architecture/stability, mobile UI/UX, gameplay balance, and security/tooling. Findings below are ordered by impact, not by category.

---

## Headline finding

**System depth has outrun playability.** The simulation layer is strong — deterministic, cycle-free, extensively tested, no `any` types, no security surface. But three findings mean the game as currently assembled cannot deliver the experience the systems describe:

1. There is no victory condition. The game cannot be won.
2. Player influence actions run in zero game-time and bypass the daily cadence the AI obeys, so the Phase 4–6 influence competition is one-sided in actual play.
3. `gather-intelligence` (Phase 6) has no player-facing UI. The AI can use it; the player cannot.

---

## P0 — Blocking

### P0-1 — No victory condition implemented — FIXED

Last-country-standing: `evaluateLastCountryStanding` emits `victory` and sets `world.victorId` after country sync when exactly one undefeated country remains and at least one other country has been defeated. Tutorial worlds are skipped. Player win surfaces `PlayerVictoryOverlay` on the dashboard.

Original finding:

### P0-1 — No victory condition implemented (original)

`kind: 'victory'` exists as a `SimEvent` variant (`packages/sim/src/types.ts:572`) and `victoryThreshold?: number` exists on `WorldState` (`types.ts:941`). **Neither is read or emitted anywhere in the codebase.** Grep confirms the only other references are in `docs/sprints/sim-foundation.md:178,201` (Sprint 6 plan).

`docs/design-canon.md:110-128` specifies surrender (capital lost + city count below threshold) and coalition/joint victory modes. Both are deferred and never landed. Prior audits already noted this (`sprint-8-capital-defeat-audit.md:57`, `sprint-8-faction-audit.md:194`).

**Consequence:** Defeat works (country with zero territories triggers the `defeatCountry` cascade, `country.ts:227-270`), but a player who conquers every rival gets no ending — the game continues indefinitely. Every system built through ten sprints, including the entire influence layer, points at an ending that does not exist.

**Also missing:** `victoryThreshold` is an optional `WorldState` field with **no migration** in `ensureWorldMigrations`. Harmless today because nothing reads it; must be added when victory lands.

**Recommendation:** Own sprint, not a phase. Needs a design decision on win mode (domination fraction / capital-based surrender / coalition) before implementation.

---

### P0-2 — Player influence actions are free and unopposed — FIXED

Player now shares the AI daily influence channel (accelerate XOR threshold). Intelligence and tribute-cancel stay outside the slot. First-day delay remains AI-only so the player can still act at t=0; a second same-timestamp channel action is rejected with `influence-channel-on-cooldown`.

Original finding:

### P0-2 — Player influence actions are free and unopposed (original)

`apps/mobile/src/game/actions.ts:151-162` — `issueInfluenceOrder` dispatches every influence order through `tick(world, [order], 0)` with **zero elapsed milliseconds**.

Two effects compound:

| Effect | Mechanism |
|---|---|
| Player has no cadence limit | AI is capped at one influence action per actor per day via `resolveAiDailyInfluenceChannel` (`aiInfluenceCadence.ts:18-38`). No equivalent cap exists on the player path. |
| AI cannot respond | `tick.ts:131` gates `applyAiInfluenceOrders` / `applyAiThresholdOrders` / `applyAiIntelligenceOrders` behind `elapsedMs > 0`. A zero-duration tick skips all AI influence agency. |

**Exploit:** five consecutive subversions (+20 influence each, 4,000 gold each = 20,000 gold total) take a city from 0 to 100 influence, enabling costless capture via `defection-claim` — in **zero game-time, with zero AI counterplay**.

This directly undercuts the Phase 4 goal ("player faces real competition for influence") and the Phase 5 cadence model that was deliberately locked as one shared daily budget. The player operates outside the clock the AI is bound by.

**Note:** the `elapsedMs > 0` guard was added in Phase 4 as a correct defensive measure against day-0 AI spam. The guard is not the bug; the interaction between the guard and the zero-elapsed player order path is.

**Recommendation:** Design decision required. Options: (a) player influence orders consume game-time / a daily slot symmetric with AI, (b) AI gets a reaction window after player influence orders, (c) player orders queue to the next real tick. Do not change unilaterally — this is a core pacing decision.

---

### P0-3 — `gather-intelligence` unreachable for the player — FIXED

Surfaced in the Order influence panel (Reconnaissance section), territory shortcuts, tooltips, and `issueInfluenceOrder`. `tribute-cancel` is on the same path. Selector unlocks intelligence at 30+ (with per-city cooldown) and cancel only when a tribute is active.

Original finding:

Phase 6 shipped the intelligence action sim-side (`intelligenceGather.ts`) and wired AI usage (`aiIntelligenceOrders.ts`). Mobile has **no path to issue it**:

- Absent from `ACTION_CATALOG` (`apps/mobile/src/game/influenceSelector.ts:93-153`)
- No branch in `issueInfluenceOrder` (`actions.ts:122-163`)
- No deep-link preset in `deepLinkForInfluenceAction` (`navigation/deepLinks.ts:43-54`)

Mobile *renders* intel report lines produced by the action (`DispatchFeedRow.tsx:47-50`), so if the AI gathers intelligence the player sees the dispatch — but cannot gather intelligence themselves. Newest feature, AI-only.

**`tribute-cancel` has the same gap:** the sim supports it, it is excluded from tooltips (`influenceTooltips.ts:4`) and absent from the catalog and `issueInfluenceOrder`. The player can start a tribute and has no way to end one.

---

## P1 — Gameplay and balance

### P1-1 — Tribute at the 50 floor lasts one day

`TRIBUTE_INFLUENCE_FLOOR = 50` (`influenceActions.ts:290-291`), drain `TRIBUTE_INFLUENCE_DRAIN_PER_DAY = 1` (`:292`), auto-end when influence `< 50` (`:504-506`). Starting a tribute at exactly 50 yields **one day** of extraction for a 5,000 gold setup — roughly 742 gold on Paris (25% of 2,970 daily). Net loss unless influence is well above the floor.

### P1-2 — Dead constants that misdescribe actual behavior — FIXED

Coup failure now uses `COUP_FAILURE_INFLUENCE_REMAINDER = 0` (the wipe the tooltip already described). `COUP_INFLUENCE_COST_FAILURE = 70` is gone. `DEFECTION_INFLUENCE_COST` is aliased to `DEFECTION_INFLUENCE_REQUIRED` and documented as the stack `clearInfluenceForCity` consumes. Shared thresholds live in `influenceConstants.ts`.

Original finding:

| Constant | Declared | Actual behavior |
|---|---|---|
| `COUP_INFLUENCE_COST_FAILURE = 70` | `influenceActions.ts:733` | Coup failure sets influence to **0** (`:986`), not −70. Constant unused. |
| `DEFECTION_INFLUENCE_COST = 100` | `influenceActions.ts:1009` (exported via `index.ts:329`) | Defection **clears** influence (`:1076`) without spending it. Constant never deducted. |
| `TRADE_CONTRIBUTION_PER_DAY = 0` | `influence.ts:26` | Trade passive influence unimplemented; guarded stub at `:314-315`. |

Exported constants that don't describe behavior are a correctness hazard for anyone tuning balance from the constant list.

### P1-3 — Isolationist posture is near-inert

`isolationistShouldAct` (`aiInfluenceScoring.ts:91-93`) blocks all offensive influence until foreign influence in the actor's **own** cities reaches 30. `aiThresholdScoring.ts:165-167` additionally hard-blocks coup and defection for the posture regardless. In Sprint 4, Caesar takes no influence-layer action until infiltrated. Military AI still runs.

### P1-4 — Loyal posture coup aversion (already logged as Phase 9 tuning watch)

`postureThresholdModifier` returns **−3.0** for loyal + `coup-attempt` (`aiThresholdScoring.ts:95`), against typical positive signal totals of ~2–4. Confirmed: loyal AIs will effectively never coup except against a player capital with high intel-informed success rate. Existing backlog entry stands.

### P1-5 — Design canon divergence at threshold 30 — DOCUMENTED

`design-canon.md` now states 30 unlocks pressure and intelligence; unrest / fund-factions remains deferred.

Original finding:

`design-canon.md:148` specifies 30 unlocks "fund factions / unrest." Implementation uses 30 for `DIPLOMATIC_PRESSURE_MIN_INFLUENCE` and `INTELLIGENCE_MIN_INFLUENCE` only. No unrest mechanic exists. Either implement or amend canon.

### P1-6 — Runaway leader with no brake

Territory count drives income (`incomePerHour`, `economy.ts:24-28`) and manpower regen (`manpower.ts:11-18`) linearly. Defeat cascade removes competitors permanently. No rubber-banding, no coalition-against-leader response, no victory freeze. Compounds with P0-1: unbounded snowball with no ending.

### P1-7 — Military conquest trivializes the influence path

Sprint 4/5 player starts with 10× `mg-armor-t5` against Rome's 120× `levy-t1`. With `TECH_FACTOR = 1.6` and the tier exponent (`constants.ts:21`, `combat.ts:34`), direct assault is dramatically cheaper than the 20,000 gold influence path to the same city. The influence layer needs a reason to exist relative to the army the player already has.

### P1-8 — Tutorial teaches none of the influence/diplomacy layer — FIXED

Seventh beat `influence` sits between governance and handoff. Completes on a player influence-channel success or bought intelligence. Skips only when no undefeated foreign city remains. AI influence agency stays suppressed.

Original finding:

### P1-8 — Tutorial teaches none of the influence/diplomacy layer (original)

Six beats (`tutorialBeats.ts:98-105`): movement, combat, economy, pinch, governance, handoff. Influence appears only in handoff hint copy (`packages/shared/src/tutorialBeatCopy.ts:45`). The deepest system in the game — four sprints of work — is entirely untaught. AI influence agency is also fully suppressed during tutorial (`aiInfluenceAgency.ts:4-6`), correctly, but that means no exposure at all.

### P1-9 — Scenario adjacency limits the influence contest

`INFLUENCE_ADJACENCY_THRESHOLD_KM = 800` (`influence.ts:20`). In Sprint 4 only London↔Paris qualifies; Berlin and Madrid cannot accrue proximity-passive influence on London without conquest or alliance first. Sprint 5 deliberately places Istanbul at 811 km (just outside) — intentional per comment, but worth confirming the flagship scenario supports the multi-actor competition the AI now models.

### P1-10 — Competitor halving compounds first-mover advantage

`influence.ts:324-330` halves all positive passive sources for every actor once any competitor reaches 50. First to 50 slows all rivals. May be intentional; note the hardcoded `50` has no named constant (see P2-5).

---

## P1 — UI/UX and resilience

### P1-11 — No error boundary anywhere in `apps/mobile` — FIXED

`AppErrorBoundary` wraps the app tree; Reset campaign clears storage and remounts `GameProvider`.

Original finding:

Any render throw crashes to a blank screen with no recovery.

### P1-12 — Corrupt save is unrecoverable — FIXED

`loadWorld` / `loadDispatches` now return null / `[]` on `JSON.parse` or migration failure. `GameContext` boot is wrapped in try/finally so `ready` always flips. `persist` swallows disk-write failures so an action is not rolled back in memory. `clearCampaignStorage` now also clears `scenarioId`.

Original finding:

`worldStorage.ts:18` and `:31` call `JSON.parse` with no try/catch. A corrupt world or dispatch blob produces an unhandled rejection, `ready` never flips in `GameContext`, and the app hangs permanently on "Loading campaign…" (`RootTabs.tsx:116-122`) with no reset path reachable from the UI.

Related: `clearCampaignStorage` (`worldStorage.ts:84-91`) does not clear `scenarioId` or `tutorialOnboarded`, so a "reset" leaves state behind.

### P1-13 — Silent dispatch history loss on scenario skew — FIXED

Boot now toasts `Campaign scenario changed — dispatch history was reset.` when a stored world does not match the resolved scenario.

Original finding:

`GameContext.tsx:347-349` discards all stored dispatches when `storedWorld.scenarioId !== resolvedScenarioId`, without warning the player.

### P1-14 — Territory influence shortcuts inconsistent with the Order panel — FIXED

Shortcuts now include subversion, intelligence, pressure, tribute, and cancel (cancel only while a tribute is active), matching the Order panel catalog.

Original finding:

`ForeignTerritoryInfluenceDetail.tsx:131-134` offers diplomatic mission, cultural campaign, coup, defection. Missing: subversion, diplomatic pressure, tribute extraction — all available on the Order screen panel. Two different action surfaces disagree on what exists.

### P1-15 — Accessibility gaps

- No `allowFontScaling` / `maxFontSizeMultiplier` anywhere in `apps/mobile`
- Influence Execute buttons have `accessibilityRole` but no `accessibilityLabel` (`OrderInfluencePanel.tsx:73-78`)
- No accessibility props on the action menu grid (`ActionMenuScreen.tsx:20-29`), world filter chips (`WorldScreen.tsx:88-111`), diplomacy actions (`DiplomacyScreen.tsx:335-357`), dispatch feed rows (`DispatchFeedRow.tsx:64-66`)
- Touch targets below 44pt: diplomacy chips at `paddingVertical: 6`, header icons at `minHeight: 32` (`PersistentHeader.tsx:162-194`)
- Color-only encoding: diplomacy stance (`DiplomacyScreen.tsx:327`), threshold stars `★/★★/★★★` with no text alternative (`WorldScreen.tsx:286-298`), stale intel card border (`:231`)
- `hitSlop` only on `LinkText`, `TutorialBanner`, `TooltipOverlay`

### P1-16 — Completed dashboard components never mounted — PARTIAL

`CatchUpSummary` now mounts on the Dashboard when `awayMs` is past the collapse window. `UrgentQueue` and `NavigationGrid` stay unmounted — they overlap DispatchesCard / QuickActionsCard.

Original finding:

Built, styled, tested, wired to nothing:

| Component | Backing selector |
|---|---|
| `components/dashboard/CatchUpSummary.tsx` | `getDashboardCatchUpSummary` (`playerView.ts:371-431`) |
| `components/dashboard/UrgentQueue.tsx` | `getDashboardUrgentItems` / `getDashboardUrgentCount` |
| `components/dashboard/NavigationGrid.tsx` | `getDashboardNavCards` (`playerView.ts:560-580`) |

Dashboard uses `QuickActionsCard` instead. Real finished work sitting dark — either mount or delete.

### P1-17 — Digest flood risk from AI influence volume

Medium-importance AI events (`diplomaticMissionStarted`, `culturalCampaignApplied`, `intelReport`) are only compacted when the player has been away 12+ hours (`COMPACTION_THRESHOLD_MS`, `importance.ts:6`). With three AI actors now issuing influence orders daily, the active-session feed fills with undifferentiated lines, and `DispatchFeedRow.tsx:11-20` gives influence events no distinct accent to scan by. Also: `markDispatchesViewed` fires on Dashboard focus, clearing the unread badge before the player has read the full feed.

### P1-18 — Player never sees AI covert subversion success

`subversionApplied` is actor-private by design (`dispatch.ts:474-500`); only `subversionDiscovered` is public. Correct per Sprint 9 canon, but means a player losing an influence race has limited signal about why until a discovery fires.

---

## P2 — Tooling, process, code health

### P2-1 — No CI, no git hooks — FIXED (CI)

No `.github/`, no `.husky/`. Nothing enforced lint, typecheck, or tests; all verification was manual per phase. `.github/workflows/verify.yml` now runs lint + typecheck + test on push and PR. Git hooks still absent — deliberately, since CI covers the same ground without slowing local commits.

### P2-2 — Lint is broken and unenforced — FIXED

`npm run lint` reported **115 errors** (46 in `src` across both packages, 69 in tests), all `no-unused-vars` or `prefer-const`. No behavioral bugs, but the signal was dead, so a real unused-variable bug would not have surfaced. Now 0.

### P2-3 — No `.gitattributes` — FIXED

Root cause of the CRLF diff churn manually reverted before every Sprint 10 commit.

### P2-4 — Missing `typecheck` script; TypeScript version skew — PARTIALLY FIXED

`typecheck` and `verify` scripts added; `packages/sim` is now type-checked for the first time. **Still open:** root devDependency `typescript@^5.8.3` vs `apps/mobile` `typescript@~6.0.3` (a major-version skew across workspaces), and the ~210 test-file type errors deferred to the backlog.

### P2-5 — Stray untracked root `tsconfig.json` — FIXED

Contained `{"compilerOptions": {}, "extends": "expo/tsconfig.base"}` — a mobile-app config at the monorepo root, shadowing `tsconfig.base.json`. Deleted.

### P2-6 — Duplicated constants beyond the logged Phase 6 item

The `INTELLIGENCE_MIN_INFLUENCE` literal is already on the backlog. Others found:

| Value | Duplicated at | Should reference |
|---|---|---|
| `86_400_000` | `diplomaticDispatchLines.ts:278` | `MS_PER_DAY` |
| `24 * 60 * 60 * 1000` | `stance.ts:5` | `MS_PER_DAY` |
| `3_600_000` | `dispatchFormatHelpers.ts:35`, `diplomaticDispatchLines.ts:45` | `MS_PER_HOUR` |
| `12 * 60 * 60 * 1000` | `importance.ts:5` | `12 * MS_PER_HOUR` |
| `50` (competitor halving) | `influence.ts:325` | no named constant exists |
| `600` km (AI range) | `ai.ts:371` | no named constant exists |

### P2-7 — Large modules

`influenceActions.ts` 972 lines, `types.ts` 909 lines, `ai.ts` 539 lines. Past comfortable navigation size; candidates for the next cleanup phase.

### P2-8 — Determinism: unsorted iteration in AI heuristics

Critical paths are correctly sorted (`influence.ts:387-388`, `reputation.ts:14,51,84`, `movement.ts:223-225`, all three AI order collectors). Remaining: `ai.ts` iterates `Object.values(world.territories / units)` unsorted, so **tied** scores can resolve differently by key insertion order. Also `dilemmas.ts:47-50` iterates reputation unsorted where deltas could compound.

### P2-9 — `position.ts` throws inside the tick

`position.ts:7,11,26,30` throw on unknown unit / territory / missing position, reached via `sight.ts:57,98,131,148` during the intel step. `tick()` has no try/catch anywhere, so a corrupt unit reference crashes the simulation rather than degrading.

### P2-10 — Cross-package import cycle via barrels

No cycles within `packages/sim/src` (verified, 65 files). Two cycles exist through the workspace barrels: `shared/index.ts → shared/leaders.ts → sim/index.ts → sim/beatController.ts → sim/dilemmas.ts` (and the `dilemmas/foreignRule.ts` variant). Type-only at source, but bundlers and `madge` see it. Cause: `shared/leaders.ts` imports `type { Leader } from 'sim'`.

### P2-11 — Missing baseline docs

No `README.md` anywhere in the repo. No contributing guide, no architecture overview, no "how to run" doc. 36 files in `docs/` are all sprint logs and audits — excellent process history, no entry point.

### P2-12 — Redundant migration helper

`ensureWorldIntelligenceGathers` (`intelligenceGather.ts:42-47`) duplicates work already done by `ensureWorldAiInfluenceAgency` (`aiInfluenceOrders.ts:35`). Also: `tick.ts:19` imports `ensureWorldTributes` and never uses it, and `tick.ts:153` passes `afterEconomy.treaties` where `afterTributes.treaties` is the semantically correct reference (currently equivalent, but misleading).

---

## Security — clean

No findings requiring action.

| Check | Result |
|---|---|
| Hardcoded secrets / API keys / tokens | None |
| `.env` files | None |
| Network calls (`fetch`, `axios`, XHR, WebSocket) | **None** — app is fully offline / local-first |
| `eval` / `Function` constructor / dynamic `require` | None |
| `any` types in `packages/sim/src` | None |
| `@ts-ignore` / `@ts-expect-error` | None |

Only integrity note: `JSON.parse` of AsyncStorage state without schema validation (see P1-12). This is a corruption-resilience concern, not a confidentiality one — the data is local, single-user, and non-sensitive.

---

## Infrastructure pass — COMPLETE

Landed immediately after the review. Non-behavioral: 932 tests green before and after (654 sim / 278 mobile).

| Change | Detail |
|---|---|
| `.gitattributes` added | `* text=auto eol=lf` plus binary exclusions. The index was **already** LF (`git ls-files --eol` → `i/lf`); the working tree was picking up CRLF on checkout, which is what produced the churn. Git now normalizes on `add`, so the phantom diffs stop. |
| Stray root `tsconfig.json` deleted | Was untracked, shadowed `tsconfig.base.json`, contained a mobile-app config |
| `pnpm typecheck` added | Runs `shared` → `sim` → `mobile`. Previously **no typecheck script existed for `packages/sim` at all** |
| `pnpm verify` added | `lint && typecheck && test` — single command, matches what CI runs |
| `pnpm lint:fix` / `format:check` added | Convenience + CI-safe format check |
| Lint: 115 errors → **0** | 35 auto-fixed (`prefer-const`), 63 unused imports auto-stripped, 17 unused variables hand-removed |
| `eslint-plugin-unused-imports` added | Unused *imports* are auto-fixable and always safe to strip; unused *variables* stay a hand-fixed error. Prevents recurrence. |
| `_`-prefix convention honored | Config now applies `^_` to vars, caught errors, and destructured arrays — not just args. The codebase already used `_removed` / `_player` for intentional discards; the config only honored it for arguments. |
| `eslint.config.js` → `.mjs` | Silences the `MODULE_TYPELESS_PACKAGE_JSON` reparse warning on every lint run |
| `packages/sim/tsconfig.json`: `rootDir`/`outDir` removed | Meaningless under `noEmit: true`, and `rootDir: "."` rejected every cross-package import from `packages/shared` — 13 spurious `TS6059` errors |
| `packages/sim/tsconfig.src.json` added | Src-only project; `typecheck` gates on this. Broad `tsconfig.json` retained for IDE coverage of tests, exposed as `typecheck:tests`. |
| `.github/workflows/verify.yml` added | Runs lint + typecheck + test on every push and PR (pnpm 10, Node 22) |

### Two latent defects the new typecheck immediately surfaced

1. **`influenceTooltips.ts` was type-incomplete since Phase 6.** `INFLUENCE_ACTION_TOOLTIPS` is `Record<InfluenceActionTooltipKind, TooltipDefinition>`, and `InfluenceActionTooltipKind` derives from the sim's `InfluenceActionKind` — which Phase 6 extended with `gather-intelligence`. The map was missing that key. This should have failed mobile typecheck from the moment Phase 6 landed. A `gather-intelligence` tooltip has been added; note this is *content only* — the action still is not in `ACTION_CATALOG`, so P0-3 stands.

2. **`canActorGatherIntelligence` had an unused `actorId` parameter** (`aiIntelligenceOrders.ts:34`). Kept for signature symmetry with `canActorIssueInfluenceOrder` and renamed `_actorId` with a comment, since the gate is world-wide rather than per-actor. Also removed a dead `isAiActor` helper in the same file.

Neither was reachable through the old verification path, which is the point: `packages/sim` had never been type-checked.

### Deferred out of this pass

~210 type errors in `packages/sim/tests` (plus 1 perf bench) — logged in `docs/deferred-backlog.md` under "Sprint 11+ — sim test-file type debt". Runtime-harmless (vitest transpiles without type-checking) and dominated by `SimEvent` literals missing `eventId`, which a typed test-event factory in `tests/fixtures.ts` would clear in one pass.

---

## Recommended sequencing

| Order | Work | Rationale |
|---|---|---|
| ~~1~~ | ~~**Infrastructure hour**~~ | **DONE** — see above |
| 2 | **Play a session** | P0-2 is invisible to unit tests and obvious within minutes of play. Confirms whether the influence layer is perceivable at all. |
| 3 | **P0-2 cadence decision** | Design call; the Phase 4–6 competition premise depends on it |
| 4 | **P0-3 surface `gather-intelligence` + `tribute-cancel`** | Small; closes the newest feature gap |
| 5 | **Victory condition (P0-1)** | Own sprint; needs design decision first |
| 6 | **P1-12 error boundary + safe save load** | One afternoon; removes a class of unrecoverable launch failures |
| 7 | Balance pass — P1-1, P1-2, P1-7, and the Phase 9 tuning watches | Best done with cold-play observation in hand |

---

## Sources

Audits run against the working tree post-Phase 6. Line numbers reflect that state. Related prior docs: `docs/deferred-backlog.md`, `docs/design-canon.md`, `docs/sprints/sprint-10.md`, `sprint-10-ai-agency-audit.md`, `sprint-10-cycle-audit.md`, `sprint-8-capital-defeat-audit.md`, `sprint-9-ui-audit.md`.
