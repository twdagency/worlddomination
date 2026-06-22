# Sprint 10 Phase 0 — AI agency infrastructure audit

Covers: AI scoring (§4), Intelligence action (§5), Annexation action (§6), Tutorial impact (§7).

---

## 4. AI scoring infrastructure

### Current architecture

| Module | Decision types | Combination |
|--------|----------------|-------------|
| `ai.ts` | `move`, `build`, `upgradeInfra`, scout variants | **`decideOrders` picks max score** among `scoreDefend`, `scoreAttack`, `scoreExpand`, `scoreScoutMove`, `scoreScoutBuild`, `scoreBuild` — not weighted sum |
| `diplomaticAi.ts` | Alliance accept/propose/break, treaty accept | Additive sub-scores per signal; threshold gates (`ALLIANCE_ACCEPT_THRESHOLD`); posture multipliers |
| `collectAiOrders` | Emits military/economy orders only | **No influence orders today** |

### Leader posture entry points

- `LeaderProfile.weights` — per-intent multipliers in `ai.ts` (`attack`, `defend`, `expand`, `scout`, `build`).
- `LeaderProfile.tempo` — commit fraction (how many units act per tick).
- `diplomaticAi.ts` — `posture` enum (`opportunist`, `loyal`, `isolationist`, …) modifies alliance/treaty scores directly.

### Gaps for Sprint 10

- No passive influence awareness in military scoring (e.g. high player influence on border city does not affect `scoreDefend`).
- No unified scoring framework — diplomatic and military are separate pipelines.
- `tick` AI path: `collectAiOrders` → military only; diplomatic AI runs in separate `collectDiplomaticAiActions` path.

### Proposal: influence scoring (Depth 2)

**New module:** `packages/sim/src/aiInfluenceScoring.ts`

```text
scoreInfluenceAccelerator(world, actorId, targetCityId, kind) → number
scoreThresholdAction(world, actorId, targetCityId, kind) → number
applyPostureModifier(score, posture, actionKind) → number
```

**Integration:**

1. **Phase 2:** Read `world.influence` in existing `scoreDefend` / `scoreAttack` as passive signal (defend bonus when own influence high on city; attack penalty when defender influence high).
2. **Phase 4–5:** New `collectAiInfluenceOrders(world)` called from tick after diplomatic pass; picks max among eligible accelerators + threshold actions per actor per tick (cap 1 influence order per actor per day to limit dispatch noise).
3. **Posture:** Reuse `diplomaticAi` posture lookup via `getLeaderForFaction` — opportunist favors Coup/Subversion; loyal suppresses Coup vs allies; isolationist suppresses Diplomatic Mission abroad.
4. **Combination:** Same max-score pattern as `decideOrders` for consistency; separate influence pass avoids polluting military scores.

**Not in Sprint 10:** Weighted multi-signal fusion (Tier 3 lookahead).

---

## 5. Intelligence action (30+ influence)

### Existing intel infrastructure (Sprint 5/5.5)

| File | Role |
|------|------|
| `intel.ts` | `IntelRecord`, `IntelSnapshot`, sources: `direct` \| `scout` \| `treaty` \| `allied` |
| `intelDispatch.ts` | Emits `intelReport` events; formats digest lines |
| Scout orders | `scoreScoutMove` / `scoreScoutBuild` → movement → `arrivalCombat` may trigger scout intel |

### Intelligence action design

| Aspect | Recommendation |
|--------|----------------|
| Order kind | New `influenceThreshold` action: `kind: 'intelligence'` (or `gatherIntelligence`) on existing influence order union |
| Threshold | 30+ influence on target city (actor = order issuer) |
| Cost | Gold + cooldown (mirror Pressure/Tribute pattern in `influenceActions.ts`) |
| Intel enrichment | Extend `IntelSnapshot` with optional `enriched?: { garrisonDetail, productionQueue, standingBreakdown }` — only populated when source is `intelligence` |
| Event | Reuse `intelReport` with `source: 'intelligence'` (add to union) — **no new event kind** |
| Emission | Call `emitIntelReport` from `applyIntelligenceAction` in `influenceActions.ts` → `intelDispatch` formatter adds "Intelligence report" line variant |

### Integration points

1. `influenceActions.ts` — `applyIntelligenceOrder` alongside `applyPressureOrder`, `applyCoupOrder`.
2. `intel.ts` — `mergeIntelRecord` accepts enriched snapshot; fog rules unchanged (bands still apply).
3. `influenceActionEligibility.ts` — add `intelligence` eligibility (30+ threshold, not own city, intel not fresh).
4. AI Phase 6 — `scoreThresholdAction(..., 'intelligence')` when border city unknown intel state.

### Risk: scout path competition

Scout and Intelligence both reveal city data. Differentiation:

- Scout: military path, combat risk, basic snapshot.
- Intelligence: influence investment, no unit movement, **enriched** fields (garrison composition, queue).

Forward-compat: `intel.forwardcompat.test.ts` unchanged — new source is additive.

---

## 6. Annexation action (70+ influence)

### Existing pipelines to reuse

| Mechanism | Location | Reuse |
|-----------|----------|-------|
| Peaceful ownership transfer | `captureCityForCoup` in `influenceActions.ts` | Generalize to `transferCityOwnership` in `territoryOwnership.ts` (Phase 1) — Annexation calls without combat roll |
| Conqueror tracking | `recordConquerorOnTerritoryCapture` | Same call path |
| Dispatch | `territoryCaptured` event | New `annexationCompleted` variant or `captureKind: 'annexation'` on existing event |
| Defeat cascade | `syncCountriesFromFactions` in `country.ts` | Runs after ownership change if capital lost |
| Reputation | `applyDiplomaticPressureReputation` pattern | New `applyAnnexationReputation` — peaceful but humiliating (-large to victim, -moderate to observers) |

### Annexation design

| Aspect | Recommendation |
|--------|----------------|
| Threshold | 70+ influence on target city |
| Cost | High gold (TBD Phase 7 balance — suggest 2× Coup cost) |
| Preconditions | Target not player capital; actor not at war with victim OR victim is vassal-like (treaty? — start: no active war only); city not under siege |
| Combat | None — peaceful transfer |
| Units | Garrison remains; ownership flips |
| Influence | Clear or transfer? **Clear actor influence to 0 post-annex** (city now owned — influence model is foreign pressure) |

### Edge cases (Phase 7 tests)

- Annexation triggers defeat if last city / capital rules.
- Annexed city's tribute/pressure setups cancelled.
- Intel records invalidated for old owner observer context.
- Alliance break on annexation? (Recommend: reputation hit, not auto war — cold-play tune).

---

## 7. Tutorial impact assessment

### Current tutorial AI

- `createTutorialWorld` (`scenario-tutorial.ts`) — France + Burgundy AI factions.
- `tutorial.playthrough.test.ts` — drives beats via player orders + `collectAiOrders` for AI military only.
- **No diplomatic AI** in tutorial scenario (`collectDiplomaticAiActions` likely skipped or inert).
- **Passive influence** accrues if tutorial cities have foreign adjacency — verify seed influence values.

### Sprint 10 risks to beat sequence

| Beat concern | Risk | Mitigation |
|--------------|------|------------|
| AI Coup on player city mid-tutorial | High | `isTutorialWorld(world)` guard in `collectAiInfluenceOrders` — return `[]` |
| AI Diplomatic Mission / Subversion dispatch noise | Medium | Same guard; tutorial digest stays player-focused |
| Passive influence → player sees threshold UI early | Low | Tutorial seed: keep AI influence on player cities at 0; suppress accrual vs player in tutorial |
| France/Burgundy unpredictability | Medium | Fixed `LeaderProfile` in tutorial scenario; no opportunist posture on Burgundy |
| Beat copy references diplomacy | None | Beats 1–6 unchanged; influence UI may appear — verify tooltip IDs don't block beat CTAs |

### Recommended suppressions

```typescript
// packages/sim/src/aiInfluence.ts (Phase 4)
function shouldRunAiInfluence(world: WorldState): boolean {
  if (world.scenarioId?.startsWith('tutorial')) return false;
  return true;
}
```

Also skip passive influence accrual against `PLAYER_TUTORIAL_FACTION_ID` in tutorial scenario (Phase 2 optional hardening).

### Contract test

`sprint-10.contract.test.ts` — `it.todo` for full tutorial playthrough beat order unchanged after Sprint 10 modules land.

### `tutorial.ts` isolation

Rule: `packages/shared/src/tutorial.ts` does **not** import from `aiInfluence*.ts`. Beat copy stays in `tutorialBeatCopy.ts`. CI optional grep from Sprint 9 risks.
