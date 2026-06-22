# Sprint 9 Phase 0 — Diplomatic, City-State & AI Audit

Audit date: Sprint 9 Phase 0 (`sprint-9/influence` from `sprint-8-final` @ `dd6c48d`).

## 1. Alliances

### Storage

- **Type:** `AlliancePair { factionA, factionB, formedAt }` on `WorldState.alliances` (lexicographic pair order).
- **Defaults / migration:** `diplomacyDefaults()` → `[]`; `ensureWorldDiplomacy()` sorts and backfills.
- **Mutations:** `formAlliance`, `breakAlliance`, `dissolveAlliancesForDefeatedCountry` in `packages/sim/src/diplomacy.ts`.
- **Events:** `allianceFormedEvent`, `allianceBrokenEvent` via `packages/sim/src/diplomaticDispatch.ts`.

### `areAllied` consumers (influence-relevant)

| File | Usage |
|------|--------|
| `packages/sim/src/diplomacy.ts` | Guard on `formAlliance`; defeat dissolution checks |
| `packages/sim/src/diplomaticAi.ts` | Proposal/accept/break scoring; skips allied pairs |
| `packages/sim/src/ai.ts` | `scoreAttack` skips allied territory owners |
| `packages/sim/src/arrivalCombat.ts` | Allied assault prohibition at combat resolution |
| `apps/mobile/src/game/orderDestinations.ts` | `classifyDestination` → `'allied'` stance filter |
| `apps/mobile/src/game/playerView.ts` | Move destination filtering; diplomacy digest allies |
| `apps/mobile/src/screens/DiplomacyScreen.tsx` | Alliance propose/break UI gates |

**Phase 1 rule:** All influence threshold actions and accelerators targeting a city MUST reject when `areAllied(world, actorId, territory.ownerId)` (or owner country is allied). Reuse `areAllied` — do not duplicate alliance logic on `Faction.diplomacy` (legacy field, not authoritative).

### Player diplomacy surface

- `packages/sim/src/playerDiplomacy.ts` — player propose/accept/decline/break; queues proposals.
- `apps/mobile/src/game/GameContext.tsx` — wires `proposeAlliance`, `breakAlliance`, etc.
- Mobile selectors: `selectDiplomacyTargets` in `countrySelector.ts` (excludes player, includes defeated filter).

---

## 2. Treaties

### Storage

- **Type:** `Treaty { id, parties: [Id, Id], scope: { territoryIds: Id[] }, formedAt, expiresAt }` on `WorldState.treaties`.
- **Scope is per-territory, not per-country.** `proposeTreaty` in `playerDiplomacy.ts` supplies explicit `territoryIds` (mobile: `evaluateCostLines` / treaty offer UI on `DiplomacyScreen`).
- **Intel coupling:** `recordTreatyObservations` (`intel.ts`) copies direct/scout records for territories **in treaty scope only** — treaty-granted sight is city-scoped.
- **Lifecycle:** `pruneExpiredTreaties` in tick step 6; `expireTreatiesForDefeatedCountry` on defeat cascade.

### Influence design implication

Passive influence from treaty presence should accrue **per scoped city**, not as a country-wide blanket. A treaty over Calais only boosts influence in Calais (and cities the design doc specifies), matching intel semantics.

Alliance passive bonus is **country-pair** level (all cities owned by ally's country per design Q5 — implement as: for each foreign city, if `areAllied(actor, owner)` apply alliance passive term).

---

## 3. Reputation

### Storage

- **Type:** `Reputation = Record<observerId, Record<subjectId, number>>` on `WorldState.reputation`.
- **Initialization:** `createInitialReputation(factions)` — all non-self pairs at `0`.
- **Mutation helpers:** `applyAllianceBreakReputationPenalty`, `applyDefeatAllianceDissolutionReputationPenalty` in `reputation.ts`.
- **Display:** `reputationCategory`, `reputationDisplay.ts`; `DiplomacyScreen` shows category per target.

### Influence coupling

Threshold actions (Pressure, Tribute, Coup, Defection) should emit reputation deltas via new helpers alongside existing penalty patterns. Observer matrix already materialized — influence actions add `adjustReputation`-style deltas without schema change.

No per-city reputation exists today; influence is the first per-(actor, city) diplomatic scalar.

---

## 4. Diplomatic posture

### Storage

- **On leader:** `Leader.diplomaticPosture: 'opportunist' | 'isolationist' | 'loyal'` (`types.ts`).
- **Mirrored on country:** `Country.diplomaticPosture?` via `buildCountryFromFaction` / `ensureWorldCountries`.
- **AI consumption:** `diplomaticAi.ts` — `postureProposeModifier`, `postureAcceptModifier`, `postureBreakModifier`, `reputationBreakCostWeight`.

### Influence coupling (Sprint 9)

- **Passive accumulation:** Posture modifiers on *target* country's leader can bias passive rates (e.g. isolationist harder to influence) — Phase 1 stub constants OK.
- **AI:** Sprint 9 AI does **not** read `world.influence`. Posture continues to affect alliance AI only.
- **Sprint 10:** AI awareness of player influence on owned cities.

---

## 5. City-level state audit

### Current `Territory` shape (`types.ts`)

```ts
interface Territory {
  id, name, coord, ownerId?, baseYield, infraLevel,
  resources, extraction?, population?, standing?, buildQueue?
}
```

Per-city mutable state lives on `world.territories[id]`. Country-level state lives on `world.countries[id]`. No existing per-(faction, city) field.

### Analogous patterns

| System | Shape | Notes |
|--------|--------|--------|
| Reputation | `observer × subject` (faction × faction) | Country-level, symmetric diplomacy |
| Intel | `intel[observerTerritoryId][]` records | Observer-scoped snapshots per territory |
| `Faction.tension` | `Record<otherFactionId, number>` | Per-pair, not per-city |

Influence is the first **actor × target-city** matrix.

### Storage proposal

```ts
interface InfluenceSource {
  kind: 'proximity' | 'alliance' | 'treaty' | 'mission' | 'cultural' | 'subversion' | 'decay';
  accruedAt: Millis;
  magnitude: number; // contribution snapshot for UI breakdown
}

interface InfluenceRecord {
  value: number;
  lastAccrualAt: Millis;
  lastDecayAt: Millis;
  sources: InfluenceSource[]; // capped list for UI; compaction in Phase 3
}

type InfluenceStore = Record<Id, Record<Id, InfluenceRecord>>;
// world.influence[cityId][actorFactionId]
```

**Rationale:** Outer key = target city (matches treaty scope, territory screens, defeat reset by city). Inner key = influencing faction (player + AI factions for Defection reset semantics).

**Accessors (Phase 1):**

- `getInfluence(world, cityId, actorId): InfluenceRecord | undefined`
- `ensureInfluenceStore(world): WorldState` — migration default `{}`
- `setInfluence(...)` — pure helpers in `packages/sim/src/influence.ts` (new module)

### Migration plan

1. Add optional `influence?: InfluenceStore` to `WorldState`.
2. `ensureWorldInfluence(world)` in `migrations.ts` chain: `influence: world.influence ?? {}`.
3. No backfill for old saves — empty store, passive accrual populates on first ticks after upgrade.
4. Export from `sim/index.ts`; **do not** import from `tutorial.ts` (Sprint 9 isolation rule).

### Defeat cascade hook

`defeatCountry` (`country.ts`) currently: mark defeated → dissolve alliances → expire treaties → clear dilemmas → emit events.

**Add Phase 1 step:** `clearInfluenceForCountry(world, countryId)` — zero/delete `world.influence[cityId][*]` for all cities where `territory.ownerId === countryId` (or all cities ever owned; at defeat, ownership may already be empty — iterate territories by former country via `citiesOf` before ownership transfer, or tag cities at defeat time).

Recommendation: clear on defeat transition in `syncCountriesFromFactions` defeat path alongside `defeatCountry`, keyed by cities that belonged to defeated country at defeat event.

### Capture / ownership change

When city changes owner, **actor's influence on that city persists** (design: influence is in the city population, not the old regime). Defection (100) resets other actors to 0 — separate action.

---

## 6. AI behavior audit

### `ai.ts` — territory-touching scoring

| Function | Territory interaction |
|----------|----------------------|
| `scoreAttack` | Visible foreign territories; skips allies |
| `scoreExpand` | Neutral/foreign secure moves |
| `scoreDefend` | Owned territories under threat |
| `scoreScout` | Target territory selection |
| `ownedTerritories` | Helper for defend/expand |

AI issues `move | build | upgradeInfra` orders only. No `covertOp` influence path in Sprint 9.

### `diplomaticAi.ts`

Runs alliance propose/accept/break and treaty accept scoring. Uses `areAllied`, `sharedEnemies`, military power, posture, reputation thresholds. **Does not read influence.**

### Sprint 9 / 10 split (confirmed)

| Capability | Sprint 9 | Sprint 10 |
|------------|----------|-----------|
| Passive influence accrual on AI cities | Yes (sim ticks) | Yes |
| AI issues influence accelerators / threshold actions | **No** | Yes |
| AI diplomatic scoring reacts to player influence | **No** | Yes |
| AI normal move/build/scout/diplomacy | Yes (unchanged) | Yes |

### Tick insertion point (Phase 1 preview)

After step 5 (`accrueEconomy` + `accrueManpower`), before treaty prune:

```
5b. accrueInfluencePassive (new)
5c. applyInfluenceDecay (Phase 3 — inactive cities, 1/day)
```

Passive runs on day boundaries or sub-daily with `lastAccrualAt` guards — align with `MS_PER_DAY` in `constants.ts`.

---

## 7. Unexpected findings

1. **Baseline test count:** 646 (419 sim + 227 mobile), not 648 — two tests removed or never on `sprint-8-final`; not a blocker.
2. **`Faction.diplomacy` field** exists but Sprint 6+ uses `world.alliances` as source of truth — influence guards must use `areAllied`, not `faction.diplomacy`.
3. **`covertOp` order kind** already in `Order` union with `'subvert'` op — Sprint 9 Subversion accelerator should be a distinct influence order kind to avoid conflating with legacy covert op (recommend `kind: 'influenceAction'` or dedicated accelerator orders in Phase 2).
4. **Treaty scope is city-list** — passive treaty bonus must iterate `treaty.scope.territoryIds`, not all cities of treaty partner.
