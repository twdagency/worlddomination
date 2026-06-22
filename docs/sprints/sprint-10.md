# Sprint 10 — AI Influence Agency + Architectural Cleanup

**Branch:** `sprint-10/ai-agency` from `sprint-9-final` @ `571d909`  
**Baseline:** 842 tests (565 sim + 277 mobile)  
**Target:** ~970+ tests (~130 new)  
**Sprint exit:** Real-device cold-play + `sprint-10-final` tag

## Theme

Land AI agency for influence — accelerators, threshold actions, and 2 new Set B actions (Intelligence + Annexation). Distribute architectural cleanup (cycle hygiene + Faction→Country rename) across phases.

## Phase plan

| Phase | Theme | Est. new tests |
|-------|--------|----------------|
| 0 | Design pass + audit + branch setup | minimal (placeholders) |
| 1 | Cycle hygiene — 6 of 12 cycles | ~12 |
| 2 | AI passive influence awareness in scoring | ~12 |
| 3 | Faction → Country ID rename | ~8 |
| 4 | AI accelerator usage | ~20 |
| 5 | AI threshold action usage | ~18 |
| 6 | Intelligence (30+) action + AI | ~16 |
| 7 | Annexation (70+) action + AI | ~18 |
| 8 | Balance pass + UI polish | ~10 |
| 9 | Real-device cold-play + tag | manual |

## Phase 0 deliverables

| Doc | Path |
|-----|------|
| Cycle audit | [sprint-10-cycle-audit.md](./sprint-10-cycle-audit.md) |
| Faction rename | [sprint-10-faction-rename.md](./sprint-10-faction-rename.md) |
| AI agency audit | [sprint-10-ai-agency-audit.md](./sprint-10-ai-agency-audit.md) |
| Risks | [sprint-10-risks.md](./sprint-10-risks.md) |

## Out of scope (Sprint 11+)

Remaining 6 cycles, Territory→City rename, 5 Set B actions, AI Tier 3–4, trade, tech tree, mechanical food upkeep, AI-initiated treaty proposals.

## Scope discipline

- Stop-and-report after each phase
- `intel.forwardcompat.test.ts` unchanged
- `tutorial.ts` does not import new AI modules
- Mid-sprint additions → `docs/deferred-backlog.md`
