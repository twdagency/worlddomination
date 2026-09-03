# Sprint 11 — Structural integrity + influence completion

**Branch:** `sprint-11/architecture-cleanup` from `sprint-10-final` @ `5e27dff`  
**Baseline:** 989 tests (683 sim + 306 mobile) — CI verify `33776078396`; local madge 2026-09-03  
**Target:** ~1,030+ tests (~40 new)  
**Sprint exit:** Real-device cold-play + `sprint-11-final` tag

## Theme

Finish the architectural cleanup Sprint 10 started (require cycles + Faction→Country event fields) and land the next Set B influence action (Annexation), with the player/AI influence cadence treated as a locked design decision to confirm—not reopen—unless cold-play says otherwise.

## Phase plan

| Phase | Theme | Type | Est. new tests |
|-------|--------|------|----------------|
| 0 | Branch + plan (this doc) | standard | placeholders |
| 1 | Cycle hygiene — current remaining chains | cleanup | ~10 |
| 2 | Faction→Country rename phase 2 (event fields + migration; slugs optional) | cleanup | ~12 |
| 3 | Next Set B action(s) + cadence confirmation (P0-2) | content | ~18 |
| 4 | Real-device cold-play + `sprint-11-final` tag | manual | — |

## Phase 0 deliverables

| Doc | Path |
|-----|------|
| Cycle audit | [sprint-11-cycle-audit.md](./sprint-11-cycle-audit.md) |
| Rename phase 2 | [sprint-11-faction-rename.md](./sprint-11-faction-rename.md) |
| Risks | [sprint-11-risks.md](./sprint-11-risks.md) |
| Sprint 10 inputs | [sprint-10.md](./sprint-10.md), [sprint-10-cycle-audit.md](./sprint-10-cycle-audit.md), [sprint-10-faction-rename.md](./sprint-10-faction-rename.md), [sprint-10-ai-agency-audit.md](./sprint-10-ai-agency-audit.md) §6 Annexation |

## Out of scope (Sprint 12+)

- Push notifications
- Territory→City rename
- Country ID slug rename (`faction-*` → `country-*`) unless Phase 2 has leftover capacity **and** is explicitly greenlit
- Remaining unnamed Set B actions (no in-repo inventory of the original eleven)
- AI Tier 3–4, trade, tech tree, mechanical food upkeep, AI-initiated treaty proposals
- Sim test-file type debt (~210 errors) unless it blocks Phase 1–3

## Scope discipline

Stop-and-report after each phase. Mid-sprint additions → `docs/deferred-backlog.md`.

- `intel.forwardcompat.test.ts` unchanged
- `tutorial.ts` does not import new influence/AI modules
- Annexation reuses `territoryOwnership.ts` / defeat cascade; no parallel capture path

## Phase 2 — COMPLETE

- SimEvent payload field `factionId` → `countryId` (writers emit `countryId` only)
- PendingDilemma and `setPolicy` order field follow the same rename
- `migrateLegacyCountryIdFields` / `backfillLegacyDispatchEventIds` copy saved `factionId` → `countryId` and drop the old key
- `filterDispatchesForCountry` with deprecated `filterDispatchesForFaction` alias
- ID slugs unchanged (`faction-*`)
- Tests: **688** sim passed (+2 Phase 2 contracts vs Phase 1)

## Phase 1 — COMPLETE

- Madge `packages/sim/src/index.ts`: **3 → 0** cycles (70 files; no longer walks shared barrel)
- `playerIdentity.ts` — `playerFactionId` leaf; `tutorial.ts` no longer imports `dispatch.ts`
- `orderRejectedMessage.ts` — assault rejection copy; `influenceOrderMessages` / `dispatch` no longer import `movement` for formatters
- `shared/dilemmas` and `sim/types` package exports — dilemma + leader/unit types skip sim/shared barrels
- Tests: **686** sim passed (+3 vs Sprint 10 CI 683); 2 Phase 2–3 todos remain
- Optional `diplomaticDispatch.ts` barrel consolidation **not** done (cycles already 0)

## Phase 1 note (retarget)

Sprint 10's "remaining 6 sim chains" **did not exist**. Phase 1 broke the **3** cycles madge reported at sprint start.

## Phase 3 note (cadence)

P0-2 from the Sprint 10 project review **already shipped**: player and AI share `canActorIssueInfluenceOrder` / `INFLUENCE_CHANNEL_ORDER_KINDS`; intelligence and tribute-cancel stay outside the slot; player may act at t=0. Phase 3 **confirms** that lock (Annexation is spend-side and **consumes** the channel) rather than re-litigating options a/b/c unless playtest evidence appears.
