# Sprint 11 Phase 2 — Faction → Country rename (event fields + migration)

**Input:** [sprint-10-faction-rename.md](./sprint-10-faction-rename.md) (Phase 3 complete; this is the deferred payload pass)

## Locked from Sprint 10 (do not reopen)

- Opaque IDs stay `faction-*` unless Phase 2 has leftover capacity **and** slug rename is explicitly greenlit
- `Country` is canonical; `Faction` remains a deprecated alias
- `world.countries` primary; `world.factions` synced mirror until a later sweep
- No Territory→City rename (Sprint 12)

## Scope — in

Rename **event / dispatch payload field** `factionId` → `countryId` with additive migration.

Touched surfaces (audit, not a mechanical 2,600-string sweep):

| Layer | Notes |
|-------|--------|
| `SimEvent` variants in `types.ts` | `withdrawal`, `secured`, `production`, `buildStarted`, `infraUpgraded`, `victory`, tutorial/intel variants, pending-dilemma `factionId`, orders `setPolicy` |
| Saved dispatch history (AsyncStorage) | Old events have `factionId`; load path copies to `countryId` |
| `filterDispatchesForFaction` → `filterDispatchesForCountry` | Alias old name |
| Cold-play snapshots | Expect churn; budget into Phase 2 test count |
| Mobile formatters / selectors | Read `countryId ?? factionId` during migration window |

**Migration rule:** Additive. `ensureWorldMigrations` (or dispatch-load helper) sets `countryId` from `factionId` when missing; writers emit `countryId` only after a single cutover commit. Do **not** require both fields forever.

## Scope — out (unless greenlit mid-phase)

- ID slug rename (`faction-player` → `country-player`) — save + snapshot nuclear; backlog item stays Sprint 11+ optional
- Removing `world.factions` mirror
- Mechanical `Faction` type-alias deletion across tests

## Tests (~12)

| Work | Est. |
|------|------|
| Migration: legacy dispatch JSON with `factionId` loads and filters as `countryId` | ~4 |
| New events persist `countryId` and not `factionId` | ~3 |
| Selector/filter alias | ~2 |
| Snapshot / digest contract updates | ~3 |

## Phase 2 — COMPLETE

Delivered: event/dilemma/`setPolicy` field rename + additive load migration. Slug rename **not** taken.

High snapshot churn. Isolate payload rename from Annexation (Phase 3) so influence transfer events are not renamed in the same commit as peaceful capture.
