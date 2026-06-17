# Sprint 8 — Risk register

| ID | Risk | Severity | Likelihood | Mitigation | Decision phase |
|----|------|----------|------------|------------|----------------|
| **R1** | `Faction`→`Country` rename diff size (~1,800 refs); merge conflicts with concurrent work | High | Medium | Phase 1 uses **additive** `countries` + deprecated `factions` alias; mechanical rename in Phase 10; feature branch isolation | Phase 1, 10 |
| **R2** | Tutorial Option β changes Beat 2 — France defeated on Paris capture breaks beat predicates, playthrough tests, foreign-rule dilemma timing | High | High | Phase 0 tutorial touchpoint doc; Phase 4 dedicated with `tutorial.franceDefeated` contract tests; keep `territoryCaptured` + add `countryDefeated` | Phase 4 |
| **R3** | Player-facing copy still uses implicit "faction" framing; canon expects "country" | Medium | High | Audit copy in `tutorialBeatCopy`, `foreignRule.ts`, `actionFeedback`, diplomacy strings; batch in Phase 9 defeated-UI phase | Phase 9 |
| **R4** | Sprint 6 diplomacy (`alliances`, `treaties`, `reputation`, `pendingProposals`) keyed by faction IDs — migration must preserve graph | High | Low if IDs stable | **Do not rename ID strings** in Sprint 8; only rename types and `world.countries` container; migration copies `factions`→`countries` 1:1 | Phase 1 |
| **R5** | Defeated countries still appear in diplomacy UI (#9) — fix deferred to Phase 9 may surface late integration issues | Medium | High | Phase 2 emits `countryDefeated` + `defeated: true` early; Phase 9 filters `diplomacyTargetFactions` / AI `collectAiOrders`; contract test in Phase 2 | Phase 2, 9 |
| **R6** | Saved dispatch history contains `factionId` fields — old events after upgrade | Medium | Certain | Dispatch formatters accept both aliases during transition; no rewrite of stored events required | Phase 1 |
| **R7** | Capital auto-relocate on capture interacts with tutorial (Paris = France capital and only city) | Medium | Certain | France tutorial: capture = defeat (no relocate case); multi-city scenarios need explicit capital in Phase 2 tests | Phase 2, 4 |
| **R8** | `intel.forwardcompat.test.ts` canary — accidental breakage blocks release | High | Low | File unchanged unless intel schema changes; any Country rename in intel keys needs explicit review | Phase 1+ |

## Top 3 risks (summary)

1. **R1 — Rename blast radius:** Mitigate with additive schema + alias period; avoid ID string renames.
2. **R2 — Tutorial Beat 2 behavior change:** Highest functional risk; needs Phase 4 gate with playthrough re-run.
3. **R4 — Diplomacy graph integrity:** Low likelihood of data loss if migration is copy-only; test with Sprint 6 integration fixtures.

## Scope creep guard

Mid-sprint additions require explicit approval. Surfaces discovered during phases → `docs/deferred-backlog.md` only.
