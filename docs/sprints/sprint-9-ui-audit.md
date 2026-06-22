# Sprint 9 Phase 0 — Mobile UI & Tutorial Audit

## 1. Dashboard — Influence card (Phase 9, layout planned Phase 0)

**Mount point:** `DashboardScreen.tsx` between `CountryStatusCard` and `ActiveForcesCard` (after country status, before forces — player sees strategic standing before operational detail).

```
┌─ Dashboard ─────────────────────────────┐
│ [Pending dilemma card if any]           │
│ DispatchesCard                          │
│ CountryStatusCard                       │
│ ┌─ Influence ─────────────────────────┐ │
│ │ INFLUENCE — 3 cities above 30       │ │
│ │ Top: Burgundy 42 · Calais 31 · …    │ │
│ │ [View on World →]                   │ │
│ └─────────────────────────────────────┘ │
│ ActiveForcesCard                        │
│ QuickActionsCard                        │
└─────────────────────────────────────────┘
```

**Data:** New selector `selectDashboardInfluenceSummary(world, playerId)` in `playerView.ts` or `influenceSelector.ts` — cities where player influence ≥ 1, sorted desc, cap 3 lines + count of threshold-ready (30/50/70/100).

**Tutorial (Q6):** Card visible at Beat 6 (`handoff`) with tooltip on first render; collapsed to single line before graduation optional.

**Reuse:** `TerminalCard`, `terminal` theme, `LinkText` / `navigateTo` for World deep link (`tab: 'world', focusTerritoryId`).

---

## 2. WorldScreen — per-territory influence

**File:** `WorldScreen.tsx` — rows from `playerWorldIntel(world)`.

**Addition per row (subtitle line):**

```
Paris                    [Live intelligence]
England · Capital        Influence: 12
```

- **Own influence:** exact value + threshold proximity (`→ Pressure at 30`).
- **Other factions' influence (fog):** qualitative band only when player has live or stale intel on city — e.g. `Foreign influence: moderate` (bands: none / low / moderate / high / dominant). Magnitudes hidden per Q5.
- **Unknown intel:** no influence line (same as no economic detail today).

**Selector:** `formatTerritoryInfluenceLine(world, playerId, territoryId, intelState)` — respects `playerVisibility` tristate.

**Deep link:** Existing `focusTerritoryId` param — no new route needed.

---

## 3. DiplomacyScreen — country rollup

**File:** `DiplomacyScreen.tsx` — `ExpandableRow` per `selectDiplomacyTargets` entry.

**Addition inside expanded country panel:**

```
Influence (your sway)
  Σ 87 across 4 cities
  Calais 31 · Dijon 28 · …
  [Pressure available → Order]
```

- Sum player influence over cities `ownerId === targetCountryId`.
- Threshold action chips only when any city meets gate; tap → `Order` with `presetDestinationId` + `presetInfluenceAction` (new param, Phase 8).
- **Allied targets:** show "Allied — influence actions blocked" instead of action chips.

**Reuse:** `ExpandableRow`, `LinkText`, `useFocusHighlight` for `focusCountryId` route param (already exists).

---

## 4. OrderScreen — accelerators + threshold actions

**File:** `OrderScreen.tsx` — currently force-move only.

**Phase 8 layout:** Add mode toggle or top section "Influence actions" when `destinationId` selects a foreign city:

```
┌─ Order ─────────────────────────────────┐
│ Destination: Burgundy (Burgundy)      │
│ ── Influence ──                         │
│ Your influence: 42                      │
│ [Diplomatic Mission] [Cultural] [Subvert]│
│ [Pressure 30+] [Tribute 50+] …          │
│ ── Forces ── (existing move UI)       │
└─────────────────────────────────────────┘
```

- Accelerators disabled when allied, defeated owner, or insufficient funding/cooldown.
- Threshold actions disabled below gate; show cost/consumption in `CostBlock` pattern from `TerritoryScreen`.
- **Reuse Sprint 7c:** `route.params.presetDestinationId`, `presetForceId` — add `presetInfluenceAction?: InfluenceActionId`; `deepLinks.ts` expansion mirrors `order` presets.

**Do not duplicate:** `orderDestinations.ts` stance classification stays for moves; influence actions use separate eligibility helper `influenceActionEligibility(world, playerId, cityId, action)`.

---

## 5. TerritoryScreen — detail breakdown

**File:** `TerritoryScreen.tsx` — per owned or selectable territory expandable cards.

**Foreign cities (player doesn't own):** When viewing via territory picker / deep link, show influence section:

```
Influence here: 42
Sources: Proximity +2/day · Cultural campaign +8
Next threshold: Tribute (50) — 8 more
[Launch action → Order]
```

**Owned cities:** Player's influence on own cities N/A (influence is always *in foreign cities* toward player's faction). Section hidden for `ownerId === playerId`.

**Reuse:** `ExpandableRow`, `WhyBlock`, `CostBlock`, `LinkText` → Order deep link.

---

## 6. Tutorial integration touchpoints

### Beat 6 (handoff) copy

**File:** `packages/shared/src/tutorialBeatCopy.ts` — `handoff` entry.

**Proposed addition to `body`:**

> Influence builds in foreign cities over time — through proximity, diplomacy, and deliberate campaigns. After graduation, watch the Dashboard influence card and the World map for cities where your sway opens new options.

**`hint`:** One sentence on passive + active model; no mechanic tutorial beat.

**Isolation:** Copy-only change in `shared` — no `tutorial.ts` import of influence modules.

### Dashboard mount

See §1 — render `InfluenceCard` when `world.influence` has any player entries OR `currentBeat === 'handoff'` (show empty state: "Influence will accumulate in foreign cities").

### Tooltip system (NEW — Phase 9)

No tooltip infrastructure exists (`grep` confirms zero matches).

**Requirements:**

| Piece | Proposal |
|-------|-----------|
| Storage | `AsyncStorage` `@worlddomination/tooltipsSeen` — `Record<TooltipId, true>` |
| API | `TooltipAnchor { id, message, children }` — shows callout on first mount if not seen |
| Dismiss | Tap to dismiss → persist seen |
| Scope | Sprint 9: `influence-dashboard`, `influence-world-row`, `influence-order-actions` |
| Tests | `apps/mobile/tests/influenceTooltip.contract.test.tsx` (Phase 0 placeholder) |

**Pattern reference:** `TutorialBanner` hint expand (`tutorialBanner.test.tsx`) for copy tone; do not couple tooltip to tutorial state machine.

### Tutorial scenario seed (Burgundy by Beat 6)

**Scenario:** `packages/shared/src/scenario-tutorial.ts` — player Britain, Burgundy owns Burgundy + Calais; pinch beat references treaty with Burgundy.

**Recommendation:** **No explicit `initialInfluence` seed.** Reasons:

1. Passive proximity from player-held Paris to Burgundy/Calais should accrue organically during beats 1–5 at 30× speed.
2. Pinch beat treaty path creates alliance/treaty state — alliance passive term applies per Q5.
3. Manual seed risks tutorial tests coupling to magic numbers; tune passive rates in Phase 1/9 if handoff demo is too thin.

**Fallback (Phase 9 only):** Optional `influence` block on scenario world bootstrap in `scenario-tutorial.ts` (shared data, not `tutorial.ts` logic) — e.g. `{ 'territory-burgundy-tutorial': { 'faction-britain-tutorial': { value: 15 } } }` if cold-play shows zero at graduation.

### `tutorial.ts` isolation

Confirmed: `tutorial.ts` imports only `tutorialConstants`, `events`, `dispatch` — no influence imports in Sprint 9. Beat progression stays in `beatController.ts`; influence does not gate beats.

---

## 7. Navigation / deep link inventory

| Surface | Existing route | New params |
|---------|----------------|------------|
| Dashboard → World | `navigateTo({ tab: 'world', focusTerritoryId })` | — |
| Diplomacy → Order | `deepLinkForEntity` / `navigateTo` | `presetInfluenceAction` |
| Territory → Order | `deepLinkForEntity('territory', id)` | same |
| World row → Territory/Order | `useDeepLinkNavigation` | `presetInfluenceAction` optional |

Extend `deepLinks.ts` validation in Phase 8 alongside `orderScreenPreset.test.tsx` pattern.
