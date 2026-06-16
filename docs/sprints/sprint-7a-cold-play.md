# Sprint 7a cold-play report

Recorded: 2026-06-15  
Branch: `sprint-7a/ui-foundation`  
Validation: automated protocol (`sprint7a.coldPlay.test.ts`) + structural code audit. Device visual sign-off recommended before merge.

## Scenario: createSprint4World (Western Europe)

| Check | Result |
|-------|--------|
| Dashboard initial route | Yes — `RootTabs` initial route `Dashboard` |
| 4 icon-led tabs | Yes — Home, Dispatches, World, Actions |
| Persistent header | Yes — all screens via `RootTabs` + `PersistentHeader` |
| Distinct leaders | Elizabeth (player), Caesar, Genghis, **Philip II** (Madrid) |
| Legacy migration | Stripped save restores scout-t1 + diplomacy fields |

### Action template — propose treaty (Diplomacy → Caesar)

| Layer | Automated | Device |
|-------|-----------|--------|
| Toast | `buildActionFeedback('proposeAlliance')` produces message | Confirm on device |
| Inline banner | `ActionFeedbackBanner` on DiplomacyScreen | Confirm on device |
| Dispatch | Events merged via `dispatchActionFeedback` | Confirm in Dispatches tab |
| Cost / offer | `CostBlock` + `treatyOfferLine` on territory picker | Confirm on device |
| Disclosure | Faction `ExpandableRow` + reputation tertiary | Confirm on device |

### Action template — build infrastructure (Territory → London upgrade)

| Layer | Automated | Device |
|-------|-----------|--------|
| Toast | `buildActionFeedback('upgradeInfra')` path covered in actionFeedback tests | Confirm on device |
| Inline banner | `ActionFeedbackBanner` on TerritoryScreen | Confirm on device |
| Dispatch | Production events in dispatch log | Confirm on device |
| Cost preview | `infraUpgradeCostPreview` + `CostBlock` inline | Confirm red/green on device |
| WhyBlock | `infraWhyExplanation` on shortfall | Confirm tap-to-expand on device |

### Action template — issue move (Order → confirm pane)

| Layer | Automated | Device |
|-------|-----------|--------|
| Toast | `buildActionFeedback('move')` in actionFeedback tests | Confirm on device |
| Inline banner | `ActionFeedbackBanner` on OrderScreen | Confirm on device |
| Dispatch | Departure events merged | Confirm on device |
| Route / ETA | `previewMoveEtaMs` in confirm `ExpandableRow` | Confirm on device |
| No resource cost | Explicit text in confirm secondary | Confirm on device |

### Philip II diplomatic behavior (72h advance)

- Dispatch lines include **Philip II** (alliance with Genghis, Madrid construction intel).
- No `Elizabeth` + `Madrid` combined labels in player-visible dispatch lines.
- Philip's defensive trait weights produce different timing vs pre-rename baseline (deterministic; snapshots updated intentionally).

### Away / catch-up (6h / 24h)

| Skip | Automated |
|------|-----------|
| 24h catch-up summary | `getDashboardCatchUpSummary` mode `away`, `totalCount > 0` |
| Urgent queue | `getDashboardUrgentItems` returns ranked items |
| 6h | Same selectors; shorter away window validated structurally |

---

## Scenario: createSprint5World (Balkan tri-border)

| Check | Result |
|-------|--------|
| Player at Belgrade | `getDashboardEmpireSummary` includes Belgrade |
| Dashboard after 24h | Catch-up mode `away` |
| Scout build path | `canBuild` scout at Belgrade after migration |
| Faction identity | `getFactionIdentity` returns leader + holdings |

---

## Perf summary (vs Sprint 6 baseline, same hardware)

| Metric | Sprint 6 | Sprint 7a | Delta |
|--------|----------|-----------|-------|
| `advanceTo` 24h | 859 µs | 930 µs | ~+8% (within noise) |
| `advanceTo` 72h | 3.66 ms | 4.13 ms | ~+13% (Philip II trait drift) |
| `collectAiOrders` 4 AI | 236 µs | 228 µs | stable |
| Legibility / 24h sim | 14.7% | 12.9% | stable |
| `ensureWorldMigrations` legacy | — | 3.5 µs | new (load-only) |
| Dashboard selectors | — | < 15 ms each | new |

Migration runs on load only — no `advanceTo` regression from Phase 5.

---

## Visual backlog (device-only, for Sprint 7c)

- Toast timing perceived latency on physical device
- ExpandableRow tap targets at minimum 44pt (verify on device)
- Long city lists in Diplomacy subtitle truncation
- Settings gear affordance (deferred to 7c)

---

## Sprint 7a retro notes

1. **Pure-logic discipline:** 11+ testable mobile modules; 41 new mobile tests this sprint (48 total, 37 net new vs Sprint 6 close).
2. **Option A (no RNTL render tests):** held; recommend staying through 7b unless component regressions appear.
3. **`ensureWorldMigrations`:** durable pattern; backlog documents migrator + legacy-save test requirement.
4. **Action feedback primitive:** `dispatchActionFeedback` — future actions plug in directly.
5. **Disclosure uniform:** `ExpandableRow` / `CostBlock` / `WhyBlock` — future screens reuse without re-deciding.

## Sprint 7b handoff

Tutorial scenario can rely on: Dashboard home, three-layer feedback, progressive disclosure, cost transparency, and migration-safe saves. No additional UI foundation work required before 7b beat authoring.
