# Sprint 8 Phase 10 — Ownership Context Audit

Inventory of UI surfaces where territory names appear, with ownership-context status after Phase 10.

## Summary

| Surface | Status | Notes |
|---------|--------|-------|
| OrderScreen destinations | **Fixed (Phase 5 → Phase 10)** | Refactored to `TerritoryOwnerLabel` with inline + stance + leader |
| ForcesScreen transit rows | **Fixed** | Origin inline, destination compact + stance + leader |
| Dashboard Active Forces card | **Fixed** | `getDashboardActiveForcesSummary` includes origin/dest owners + ETA |
| WorldScreen territory rows | **Already OK** | `selectTerritoryCountryContext` + country line (Phase 5/9) |
| TerritoryScreen header | **Already OK** | Player-owned territories only; header shows territory + player country |
| TerritoryScreen adjacent refs | **N/A** | No adjacent-territory list in current UI |
| DiplomacyScreen capital links | **Already OK** | Capital name shown under `formatDiplomacyCountryTitle` ("Rome — led by Caesar") |
| DiplomacyScreen treaty picker | **Already OK** | Player-owned territory names only (implicit player ownership) |
| Dashboard Empire Status | **Already OK** | Country-centric cards, not bare territory names |
| DefeatedCountriesScreen | **Already OK** | `formatDefeatedTerritoryLine` with conqueror / formerly-held annotation |
| DispatchesScreen | **Sim fix** | `dispatch.ts` formatters now use `territoryLabelWithOwner` |
| TutorialBanner beat copy | **Documented exception** | Intentionally short; France established narratively in Beat 1 |

## Per-surface detail

### WorldScreen rows

- Title: `formatWorldTerritoryTitle` (capital star)
- Subtitle: `formatWorldTerritoryCountryLine` — `"Rome — led by Caesar"`
- Defeated filter: `formatDefeatedTerritoryLine` — `"Paris — Spain (conquered from Rome)"`

### TerritoryScreen

- Lists player-held territories from `playerTerritories` selector.
- Header uses territory name; country context implicit (player holdings).
- No neighbor/adjacency list to annotate.

### DispatchesScreen

Dispatch text is unstructured narrative (Phase 7 Q2(c) deferral). Phase 10 audited `packages/sim/src/dispatch.ts`:

**Updated formatters** (territory mentions now include owner country or `(unclaimed)`):

- `formatIntentDepartureLine` — from/to labels
- `formatIntentArrivalLine` — arrival place
- `formatBuildStartedLine` / `formatInfraUpgradedLine` — construction site
- `formatIntelReportLine` — scout/allied/treaty intel locations
- `formatAllyArrivalPeacefulLine` — arrival + return origin
- `formatOrderRedirectedToAllyLine` — redirected territory
- `formatTreatyProposedLine` — treaty scope territory
- `formatCapitalRelocatedLine` — old/new capitals
- `formatCountryDefeatedLine` — final territory

**Out of scope (Sprint 9 / reports layer):**

- `packages/sim/src/reports.ts` — battle narratives, production ready lines, withdrawal text still use bare territory names. These are post-action reports, not decision-context surfaces.

### DashboardScreen

- **Empire Status**: country cards via `CountryStatusCard` — no bare territory names.
- **Active Forces**: Phase 10 adds `from London (Britain) → Paris · Rome · HOSTILE · Caesar · ETA 4h` pattern.

### ForcesScreen

- In-transit subtitle: `IN TRANSIT London (Britain) → Paris · Rome · HOSTILE · Caesar`
- Expanded secondary repeats origin/destination labels with stance on destination.

### DiplomacyScreen

- Country rows: `formatDiplomacyCountryTitle` + capital link (capital name within country row — ownership implicit).
- Treaty offer picker: player territories only.

### DefeatedCountriesScreen

- Historical territory references use Phase 9 defeated formatting.

### TutorialBanner

- Beat copy mentions "Paris" without parenthetical owner labels.
- **Exception confirmed**: tutorial copy stays short; ownership established via Beat 1 dispatch context.

## Component: TerritoryOwnerLabel

Path: `apps/mobile/src/components/TerritoryOwnerLabel.tsx`

Pure resolution: `apps/mobile/src/game/territoryOwnerLabel.ts`

| Variant | Example |
|---------|---------|
| `inline` | `Paris (Rome)` |
| `compact` | `Paris · Rome` |
| `verbose` | `Paris — Rome, led by Caesar` |

Decision context (Order, force destinations): inline/compact + `showStance` + `showLeader`.

Unowned: `(unclaimed)` / `· unclaimed` / `— unclaimed` by variant.

Defeated orphaned territories: `formerly {country}` with muted italic styling.

## Consistency rules (post Phase 10)

1. Every territory name in decision UI includes country context (minimum).
2. Force/order destinations also show stance + leader where hostile/allied/neutral.
3. Defeated historical territories use Phase 9 muted + formerly-held annotation.
4. Tutorial beat copy is the documented exception.
