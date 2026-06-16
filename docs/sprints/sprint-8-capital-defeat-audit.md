# Sprint 8 — Capital, defeat, and tutorial impact audits

Companion to `sprint-8-faction-audit.md`. Phase 0 findings only.

---

## Capital / city audit

### Does `capital` exist in the data model?

**No.** `Territory` (`packages/sim/src/types.ts`) has: `id`, `name`, `coord`, `ownerId`, yields, `infraLevel`, `resources`, `buildQueue` — **no `isCapital` or `capitalTerritoryId`**.

Country→city relationship is **only** `Territory.ownerId === factionId`.

### Where is "capital" implied today?

| Location | How "capital" is implied |
|----------|--------------------------|
| `docs/design-canon.md` | Canon spec only — not implemented |
| `packages/sim/tests/sprint-5.5.integration.test.ts` | Test variable `capitalEtas` = travel time to **enemy home cities** (London, Paris, Madrid from Berlin) — not a capital field |
| `packages/sim/tests/ai.scout.transit.test.ts` | "sprint4 capitals" = same home-city heuristic for scout decay window |
| `packages/sim/tests/scenario.sprint5.test.ts` | "nearby capitals" = fog visibility to major owned cities |
| `apps/mobile/src/game/factionDisplay.ts` | `territoriesOwnedByFaction` → sorted city names; **first alphabetically ≠ capital** |
| `nearestFriendlyTerritory` (`combat.ts`) | Retreat destination — closest friendly city, not capital |

### Do scenarios specify a capital?

**No.** Sprint 4/5/Tutorial assign `ownerId` per territory only. Tutorial France owns **only Paris** — de facto capital = only city.

### Does UI show "capital" to the player?

**No.** Player sees city names (London, Paris) and leader lines (`Elizabeth of England`). No capital label anywhere in mobile screens.

### Sprint 8 Phase 2 implication

- Add `Country.capitalTerritoryId` (required on new worlds; migration derives from **scenario manifest** or **first owned city by stable sort** as fallback).
- Auto-relocate: on capital capture, if `ownedCities.length > 0`, pick new capital (recommend: highest `infraLevel`, then name sort).
- Tutorial France: single city → capture triggers defeat, not relocation.

---

## Defeat detection audit

### What happens when a faction has zero territories?

**Today: nothing special.** The faction record remains in `world.factions` with no `defeated` flag.

| System | Behavior with zero cities |
|--------|---------------------------|
| **Diplomacy screen** | Faction still listed (`diplomacyTargetFactions` filters only `!== playerId`) — **Issue #9** |
| **AI turns** | `collectAiOrders` includes all `!isPlayer` factions — **zero-city AI still ticked**; `decideOrders` returns `[]` when no owned territories for most actions |
| **Economy** | `accrueEconomy` iterates territories; zero cities → **no income** but faction funding/manpower unchanged |
| **Manpower** | `accrueManpower` still runs per faction key |
| **Alliances / treaties** | **Not auto-dissolved** on conquest |
| **Reputation** | Unchanged |
| **Units** | Orphan units possible if faction loses last city while units in transit — ownership unchanged |
| **Victory** | `victory` event type exists but **not emitted** in current gameplay |
| **UI removal** | No natural removal from diplomacy or dispatch targets |

### Gaps vs Sprint 8 canon (Q2 + Q3)

| Gap | Sprint 8 fix |
|-----|--------------|
| No defeat detection | Capital captured **AND** zero cities held → `countryDefeated` event |
| Defeated stays active in diplomacy | `defeated: true`; filter from active diplomacy (Phase 9 UI) |
| Alliances persist | `breakAlliance` cascade on defeat (Phase 2) |
| Treaties persist | Expire treaties involving defeated country (Phase 2) |
| AI still scheduled | Skip defeated countries in `collectAiOrders` (Phase 2) |
| Leader "removed with country" (canon) | Leader remains in `world.leaders` for history; country `defeated` gates active play |

---

## Tutorial impact analysis (Option β)

**Decision:** France (`faction-france-tutorial`) defeated in **Beat 2** when Paris falls.

### Beat flow today

| Beat | Predicate | Trigger event |
|------|-----------|---------------|
| 1 movement | Arrival away from London | `arrival` at non-home |
| 2 combat | Paris captured | `territoryCaptured` at `territory-paris-tutorial`, `newOwnerId` = player |
| 3 economy | Infra upgrade in Paris | `infraUpgraded` |
| 4 pinch | Burgundy conquest OR treaty OR home infra | `territoryCaptured` / `treatyFormed` / `infraUpgraded` |
| 5 governance | Foreign rule dilemma resolved | `dilemmaResolved` (`foreign-rule`) |
| 6 handoff | Tutorial handoff ready | `tutorialHandoffReady` |

### Where Beat 2 capture happens

1. Player issues assault move to Paris (`OrderScreen` → `confirmMove` → sim `applyMoveOrders`).
2. On arrival, `resolveArrivals` → `resolveHostileArrival` (`arrivalCombat.ts`).
3. Combat resolves; on success `territoryCaptured` + `secured` events emitted; `territories[paris].ownerId` = player.
4. `evaluateBeatProgression` (`tick.ts` end) → `isPlayerParisCapture` in `tutorialBeats.ts` completes Beat 2.

### Events fired today on Paris capture

- `territoryCaptured` (high importance)
- `secured` (high)
- Possibly `battle`, `withdrawal` depending on garrison
- `arrival` (movement completion)
- Beat side effects: none at Beat 2 (dilemma enqueued at Beat 4 pinch conquest only)

### Additional events needed (Sprint 8)

- `countryDefeated` (or canon name) with:
  - `countryId`: `faction-france-tutorial`
  - `conquerorId`: player
  - `capitalTerritoryId`: `territory-paris-tutorial`
  - `at`: capture timestamp
- Cascade: dissolve France alliances (none in tutorial), expire treaties (none), set `countries[faction-france-tutorial].defeated = true`

### Beat 5 / Foreign Rule dilemma copy

Current (`packages/sim/src/dilemmas/foreignRule.ts`):

- Title: "How will you rule Paris?"
- Prompt: "Paris has fallen. Its people are not your own..."

**Recommendation (Phase 4):** Light touch — add defeated-country context without full rewrite:

- Title: "How will you rule conquered France?" or keep Paris-specific (city-level) since dilemma is about **administering Paris**
- Prompt: mention France is defeated / leader removed per canon Option X
- `tutorialBeatCopy.governance` body already says "your country's identity" — OK

Beat 5 predicate (`dilemmaResolved`) **unchanged** — still fires on foreign-rule resolution, not on capture.

### Tutorial touchpoint file list

| File | Change |
|------|--------|
| `packages/sim/src/arrivalCombat.ts` | After capture, invoke defeat evaluator |
| `packages/sim/src/types.ts` | `countryDefeated` event, `Country.defeated` |
| `packages/sim/src/dispatch.ts` | Format defeat dispatch line |
| `packages/sim/src/tutorialBeats.ts` | Beat 2 may also require `countryDefeated` OR keep `territoryCaptured` only |
| `packages/sim/src/beatController.ts` | No change expected |
| `packages/sim/src/dilemmas/foreignRule.ts` | Copy tweak (Phase 4) |
| `packages/shared/src/tutorialBeatCopy.ts` | Beat 2/5 copy tweak (Phase 4) |
| `packages/shared/src/scenario-tutorial.ts` | Set `capitalTerritoryId` for France when Country entity lands |
| `apps/mobile` diplomacy / dispatch | Show defeated France off active list (Phase 9) |
| `packages/sim/tests/tutorial.playthrough.test.ts` | Assert defeat event in Beat 2 path |

---

## Migration strategy outline

### Current save shape (post–7c)

```typescript
WorldState {
  factions: Record<Id, Faction>;  // NOT territories[]
  territories: Record<Id, Territory>;  // ownerId links to faction
  alliances, treaties, reputation, ...
}
```

**Correction:** Phase 0 brief assumed `Faction.territories[]` — **that field does not exist**. Migration must scan `territories` for ownership.

### Phase 1 migration (`ensureWorldMigrations`)

1. For each `faction` in `world.factions`, create `countries[id]` with same fields + defaults:
   - `defeated`: `false` (or `true` if owned city count === 0)
   - `capitalTerritoryId`: from scenario manifest map, else first owned city (stable sort by territory id)
2. Set `world.countries = migrated`; keep `world.factions` as shallow copy for alias period.
3. On save, write both keys (or countries only with read-time backfill).

### Edge cases

| Case | Handling |
|------|----------|
| Faction with zero cities on load | `defeated: true` |
| Faction with cities but no manifest capital | First owned city by ID sort; log warning in dev |
| Orphan `ownerId` pointing to missing faction | Existing invariant tests; migration should not create new orphans |
| Units owned by defeated faction in transit | Phase 2: reassign to conqueror or return to origin — **needs design lock in Phase 2** |
| Player defeated (tutorial shouldn't) | Guard: tutorial France only for Option β |
| Dispatch history with `factionId` | Read-only; formatters use ID lookup in `countries` or `factions` alias |
| `intel.forwardcompat` saves | No schema change to intel keys in Phase 1 if observer IDs unchanged |

### Deprecation

- `Faction` type alias → `Country` through Sprint 8–9
- `world.factions` removed Sprint 9+ after alias period
- `resolvePlayerFactionId` → `resolvePlayerCountryId` alias in Phase 10
