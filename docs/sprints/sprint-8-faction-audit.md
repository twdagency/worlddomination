# Sprint 8 — Faction usage audit

**Branch:** `sprint-8/country-city` from `main` @ `9fd3c53` (tag `sprint-7c-final`)  
**Audit date:** Phase 0  
**Decision:** Model 3 — `Faction` → `Country` rename; `Territory` type name unchanged (semantically a city until Sprint 9).

---

## Executive summary

| Area | Files touched | Approx. `faction`/`Faction` references |
|------|---------------|----------------------------------------|
| `packages/sim/src` | 33 | **692** |
| `packages/sim/tests` | 53 | **699** |
| `apps/mobile` (src + tests) | 36 | **322** |
| `packages/shared` (scenarios + helpers) | ~12 | **~120** (est.) |
| **Total codebase** | **~134** | **~1,800** |

Rename scope is **large but mechanical**. The highest-risk surfaces are not identifier strings but **persisted JSON shape** (`world.factions`), **dispatch event payloads** (`factionId` on 15+ event kinds), and **diplomacy graph keys** (`alliances`, `treaties`, `reputation`, `pendingProposals`).

**Critical schema correction:** `Faction` does **not** own a `territories: Id[]` array today. City ownership is **only** via `Territory.ownerId`. Country city lists must be **derived** at migration time (`Object.values(world.territories).filter(t => t.ownerId === countryId)`).

---

## 1. Type definitions

### `Faction` interface (`packages/sim/src/types.ts`)

```typescript
export interface Faction {
  id: Id;
  leaderId: Id;
  isPlayer: boolean;
  funding: number;
  manpower: number;
  manpowerCap: number;
  resources?: Partial<Record<ResourceId, number>>;
  policies?: Policies;
  diplomacy?: Record<Id, DiplomacyState>;  // legacy nested map — largely superseded by Sprint 6 reputation
  tension?: Record<Id, number>;
  identityTags?: string[];
}
```

**Missing vs Sprint 8 target `Country`:** `capitalTerritoryId`, `defeated`, explicit city list (derived today).

### `WorldState` political keys

| Key | Shape | Notes |
|-----|-------|-------|
| `factions` | `Record<Id, Faction>` | Primary rename target → `countries` |
| `alliances` | `AlliancePair[]` (`factionA`, `factionB`) | ID strings preserved; field names may alias in Phase 1 |
| `treaties` | `Treaty[]` (`parties: [Id, Id]`) | Territory-scoped intel |
| `reputation` | `Record<observer, Record<subject, number>>` | All keys are faction/country IDs |
| `pendingProposals` | `from`, `to` IDs | Diplomacy proposals |
| `pendingDilemmas` | `factionId` | Player dilemmas |

### Related types using faction terminology

- `PendingDilemma.factionId`
- `Order.setPolicy.factionId`
- `IntelRecord.observerFaction` (not renamed in Sprint 8 per scope)
- `AlliancePair.factionA` / `factionB`
- `BattleReport.attackerId` / `defenderId` (faction IDs, not renamed in events)

### Mobile / shared types

- `apps/mobile/src/game/factionDisplay.ts` — `FactionIdentity` (leader + country name display)
- `packages/shared/src/playerFaction.ts` — `resolvePlayerFactionId` (canonical player lookup)

---

## 2. Sim modules (by reference count)

| File | Refs | Role |
|------|------|------|
| `dispatch.ts` | 110 | Dispatch lines, visibility, beat grouping — heavy `factionId` / `ownerId` |
| `ai.ts` | 105 | `collectAiOrders` iterates all non-player factions |
| `intel.ts` | 51 | Observer/receiver faction keys in intel store |
| `diplomacy.ts` | 39 | Alliances, treaties, recall, break |
| `dilemmas.ts` | 35 | Pending dilemmas keyed by faction |
| `production.ts` | 34 | Build orders per faction |
| `diplomaticAi.ts` | 30 | AI diplomacy proposals |
| `types.ts` | 28 | Core definitions |
| `intelDispatch.ts` | 21 | Intel report emission |
| `arrivalCombat.ts` | 21 | Capture events (`newOwnerId`) |
| `compaction.ts` | 20 | Digest grouping by faction |
| `sight.ts` | 19 | Visibility |
| `reports.ts` | 19 | Battle narratives |
| `manpower.ts` | 18 | Per-faction accrual |
| `visibility.ts` | 16 | Fog-of-war |
| `economy.ts` | 15 | Income loops `territory.ownerId` → faction |
| `reputation.ts` | 14 | Observer/subject matrices |
| `diplomaticDispatch.ts` | 13 | Alliance/treaty events |
| `tick.ts` | 11 | Economy merge across faction keys |
| `stance.ts` | 10 | Combat stance |
| `combat.ts` | 10 | Battle resolution |
| `migrations.ts` | 8 | `ensureFactionFields` — Phase 1 extends here |
| `tutorialBeats.ts` | 8 | Beat predicates use `PLAYER_TUTORIAL_FACTION_ID` |
| `playerDiplomacy.ts` | 8 | Player accept/decline |
| Others | ≤4 each | `movement`, `scout`, `tutorial`, `beatController`, etc. |

**Exports:** `packages/sim/src/index.ts` re-exports ~9 faction-named symbols (`playerFactionId`, `filterDispatchesForFaction`, etc.).

---

## 3. Mobile surfaces

| File | Refs | Role |
|------|------|------|
| `playerView.ts` | 49 | Dashboard, intel, badges, diplomacy urgent items |
| `GameContext.tsx` | 27 | Action dispatch, dilemma resolve |
| `DiplomacyScreen.tsx` | 25 | Faction list, proposals, treaties |
| `actionFeedback.ts` | 19 | Toast copy with faction names |
| `factionDisplay.ts` | 11 | `getFactionIdentity`, leader/country lines |
| `diplomacySelector.ts` | 8 | `diplomacyTargetFactions` — **Issue #9 surface** |
| `OrderScreen.tsx` | 4 | Owner display via `getFactionIdentity` |
| `PersistentHeader.tsx` | 4 | Empire summary |
| `TerritoryScreen.tsx` | 12 | Player faction builds |

**Player-facing copy** still says "faction" in few places; most UI uses leader names ("Elizabeth", "Genghis"). Canon expects **"country"** in player-facing text — see Risk R3.

---

## 4. Tests

| Bucket | Files with faction refs | Total refs |
|--------|-------------------------|------------|
| `packages/sim/tests` | 53 | 699 |
| `apps/mobile` tests | ~15 | ~80 |
| Snapshots | 3 | ~30 |

**Hardcoded faction ID literals:** `faction-player` appears in **~60 files** across sim tests, scenarios, and mobile tests. Tutorial IDs: `faction-britain-tutorial`, `faction-france-tutorial`, `faction-burgundy-tutorial`.

**Fixture centralization:** `packages/sim/tests/fixtures.ts` (23 refs) — primary migration hub for test IDs.

**Forward-compat canary:** `intel.forwardcompat.test.ts` (40 refs) — must remain stable or update only with explicit approval.

---

## 5. Scenarios

### Sprint 4 (`packages/shared/src/scenario-sprint4.ts`)

- 4 factions: `faction-player`, `faction-rome`, `faction-steppe`, `faction-britain`
- Territories assigned via `ownerId` on each city
- No capital field; "capital" only in test commentary (enemy home cities)

### Sprint 5 (`packages/shared/src/scenario-sprint5.ts`)

- Extended world; same faction ID pattern
- Suleiman rename completed in 7c (no duplicate leader)

### Tutorial (`packages/shared/src/scenario-tutorial.ts`)

- `faction-britain-tutorial` (player), `faction-france-tutorial` (Paris only), `faction-burgundy-tutorial` (Burgundy + Calais)
- France is **single-city** — ideal for Option β defeat on Paris capture
- Constants in `packages/shared/src/tutorialConstants.ts`

---

## 6. Storage / persistence

| Store | Format | Faction coupling |
|-------|--------|------------------|
| `STORAGE_KEYS.world` | Full `WorldState` JSON | **`factions` key baked in** — migration required |
| `STORAGE_KEYS.dispatches` | `SimEvent[]` JSON | Events carry `factionId`, `ownerId`, `orderingFactionId`, etc. |
| `STORAGE_KEYS.scenarioId` | string | No faction IDs |
| Migrations | `ensureWorldMigrations` | `ensureFactionFields` backfills `identityTags`; pattern established for Phase 1 `countries` backfill |

**No separate faction-indexed tables.** Rename is a world-shape migration + dispatch event field aliases (if any).

---

## 7. Dispatch events carrying faction/country IDs

| Event kind | Field(s) | Visibility notes |
|------------|----------|------------------|
| `departure` / `arrival` | `ownerId` | Move owner |
| `buildStarted` / `infraUpgraded` / `production` / `buildBlocked` | `factionId` | Builder |
| `battle` | `report.attackerId`, `report.defenderId` | Combat parties |
| `withdrawal` / `secured` | `factionId` | Occupier |
| `intelReport` | `observerFaction`, `receiverFaction` | Private intel |
| `allianceFormed` / `allianceBroken` | `parties` / breaker IDs | Global or party |
| `treatyFormed` / `treatyExpired` | `parties` | Treaty parties |
| `allianceProposed` / `treatyProposed` | `from`, `to` | Proposal targets |
| `allianceDeclined` / `treatyDeclined` | `from`, `to`, `declinedBy` | |
| `territoryCaptured` | `newOwnerId`, `previousOwnerId` | **Defeat trigger surface** |
| `dilemmaResolved` | `factionId` | Player country |
| `tutorialHandoffReady` / `tutorialGraduated` | `factionId` | |
| `allyArrivalPeaceful` | `factionId`, `allyFactionId` | |
| `dispatchCancelledByAlliance` | `factionId`, `allyFactionId` | |
| `orderRedirectedToAlly` | `orderingFactionId`, `newOwnerId` | |
| `victory` | `factionId` | Not yet emitted in gameplay |

**Sprint 8 additions (planned):** `countryDefeated` (or equivalent) with `countryId`, `conquerorId`, `capitalTerritoryId`.

---

## 8. Rename scope estimate

| Phase | Effort | Notes |
|-------|--------|-------|
| **Phase 1** — `Country` type + `world.countries` + migration alias | **L** | Types, migrations, scenarios; keep `Faction` type alias |
| **Phase 2** — Capital + defeat sim logic | **M** | `arrivalCombat`, new events, capital relocation |
| **Phases 3–4** — Tutorial Option β | **M** | France defeat, beat predicates, dilemma copy |
| **Phases 5–9** — Structural integrity (IA, deep link, dilemma modal, defeated UI) | **M–L** | Mostly mobile; fewer sim renames |
| **Phase 10–11** — Rename sweep + cleanup | **L** | Test fixtures, snapshots, remove `Faction` alias |

**Unexpected finding:** Dispatch and diplomacy layers are more entangled than a simple type rename — **event payload field names** and **saved dispatch history** mean we should prefer **additive migration** (`countries` + `Faction` alias) over a flag-day string replace.

**Recommended Phase 1 approach:**

1. Add `Country` interface and `world.countries` (copy from `factions` on load).
2. Keep `world.factions` as deprecated alias synced in `ensureWorldMigrations`.
3. Defer event field renames (`factionId` → `countryId`) to Phase 10 unless trivial alias getters exist.
4. Scenario files gain explicit `capitalTerritoryId` per country in Phase 2.

---

## 9. ID naming convention (unchanged in Phase 1)

Existing IDs (`faction-player`, `faction-france-tutorial`) can remain as stable string keys through Sprint 8. **Renaming ID strings** (e.g. `faction-player` → `country-britain`) is **out of scope** unless required — would break saves, tests, and snapshots. Phase 1+ should treat IDs as opaque; display names come from leaders/regions.
