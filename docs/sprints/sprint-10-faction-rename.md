# Sprint 10 Phase 0 — Faction → Country rename audit

**Baseline:** Sprint 8 Phase 0 inventory (~1,800 `faction` string refs). Re-count after Sprint 9 influence layer.

## Reference counts (Sprint 10)

| Pattern | Count | Notes |
|---------|-------|-------|
| Case-insensitive `faction` in `*.{ts,tsx}` | **~2,642** | +~47% vs Sprint 8 estimate; influence orders/events added many `ownerId` / `actorId` fields |
| `\bFaction\b` type identifier | **~30** | Type + test fixtures; `Country` already exists alongside |
| `world.factions` field | Primary runtime store | `world.countries` populated by `ensureWorldCountries` (Sprint 8) |

Sprint 8 audit: `docs/sprints/sprint-8-faction-audit.md` (still authoritative for schema).

---

## ID strategy (locked — no change)

Per Sprint 8 Phase 1 deviation:

- **Opaque IDs stay:** `faction-player`, `faction-rome`, `faction-burgundy-tutorial`, etc.
- **Rename scope:** Type names, field names in code (`factions` → `countries` as canonical), player-facing copy.
- **Do not** mass-rename ID slugs in saves, snapshots, or scenario seeds in Sprint 10.

`resolvePlayerFactionId` → add `resolvePlayerCountryId` alias; deprecate old name through Sprint 10.

---

## Current dual model

```typescript
// packages/sim/src/types.ts
export interface Faction { id, leaderId, isPlayer, funding, manpower, ... }
export interface Country { id, leaderId, isPlayer, capitalTerritoryId, defeated, ... }
```

- `WorldState.factions` — economic + military ledger (funding, manpower).
- `WorldState.countries` — diplomatic identity, capital, defeat flags.
- **1:1 ID mapping** today (`country.id === faction.id`).
- City ownership: `Territory.ownerId` only (no `Faction.territories[]`).

Sprint 10 Phase 3 goal: **`Country` becomes canonical**; `Faction` type alias deprecated; `world.countries` primary with `factions` as migration alias or merged fields.

---

## Rename scope by layer

| Layer | Impact | Sprint 10 Phase 3 approach |
|-------|--------|---------------------------|
| `types.ts` | `Faction` → alias of `Country` or merged interface | Additive; extend `Country` with funding/manpower OR keep split with `countryId` join |
| `migrations.ts` | `ensureFactionFields` → `ensureCountryFields` | Backfill `countries` from `factions` on load |
| Scenarios (`shared`) | Keys in `factions` record | Keep keys; migration copies to `countries` |
| `dispatch.ts` | ~127 `faction` refs | Event field `factionId` → **defer** to Sprint 11 (saved dispatch history) |
| `influence*.ts` | `actorId`, `ownerId` (already country-ish) | Document as country IDs; optional comment-only pass |
| Mobile `factionDisplay.ts` | Display helpers | Rename to `countryDisplay.ts` with re-export alias |
| Tests / snapshots | Heavy `faction-*` IDs in cold-play digests | **No ID changes**; type/import renames only |

---

## Storage migration

| Store | Faction coupling | Migration |
|-------|------------------|-----------|
| Full `WorldState` JSON save | `factions`, `reputation` keys, `alliances` pair IDs | `ensureWorldMigrations`: if `countries` incomplete, `buildCountryFromFaction` for each faction |
| `dispatches` AsyncStorage | Events carry `factionId`, `ownerId`, `actorId` | **No payload rename** in Sprint 10 — IDs unchanged |
| `reputation[observer][subject]` | Subject IDs are faction/country IDs | Keys stable |
| `influence[cityId][actorId]` | Actor = country ID | Stable |
| `intel` records | `observerFaction` field name | Defer field rename; document as country ID |

**Approach:** Additive migration only (Sprint 8 pattern). Old saves load → `countries` backfilled → gameplay uses `countries` for defeat/diplomacy; `factions` retained for economy until Phase 10 cleanup.

---

## Dispatch event fields (separate concern)

Renaming `SimEvent.factionId` → `countryId` touches:

- Saved dispatch history in AsyncStorage
- 12+ cold-play snapshots
- `filterDispatchesForFaction` → `filterDispatchesForCountry`

**Sprint 10:** Type rename + sim internals only.  
**Sprint 11:** Event payload field aliases (`countryId` with `factionId` deprecated getter in migration).

---

## Risk assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large diff (~2,600 string touches if mechanical) | High | Phase 3 mechanical rename only; no behavior change; feature branch |
| Snapshot churn | Medium | Limit to import/type changes; no digest text changes |
| Save break | High | `ensureWorldMigrations` + round-trip test |
| Mobile copy regression | Low | Player-facing text already says "country" in many surfaces |
| AI influence code adds `actorId` before rename | Medium | Phase 3 before Phase 4 AI work OR use `CountryId` type alias from day one in new modules |

---

## Phase 3 estimate

| Work | Est. tests |
|------|------------|
| `Country` canonical + `Faction` alias | ~4 |
| Migration round-trip (legacy save → countries) | ~2 |
| `resolvePlayerCountryId` + selector re-exports | ~2 |
| Invariant: every `factions` key has `countries` entry | ~2 |
| **Total** | **~8** |

Mechanical rename sweep (remove `Faction` alias) deferred to Sprint 11 per original Sprint 8 plan.
