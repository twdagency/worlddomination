import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations, setInfluence } from 'sim';
import {
  influenceMagnitude,
  selectCityInfluence,
  selectInfluenceForDiplomacy,
  selectPlayerInfluenceSummary,
} from '../src/game/influenceSelector';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const ROME = 'faction-rome';
const PARIS = 'territory-paris';
const BERLIN = 'territory-berlin';

function world() {
  return ensureWorldMigrations(createSprint4World(START_MS), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('influenceSelector', () => {
  it('returns empty summary when player has no influence', () => {
    const summary = selectPlayerInfluenceSummary(world());
    expect(summary?.activeCityCount).toBe(0);
    expect(summary?.summaryLine).toBe('');
    expect(summary?.topTarget).toBeNull();
  });

  it('rolls up cities with player influence', () => {
    let w = world();
    w = setInfluence(w, PARIS, PLAYER, 47, START_MS);
    w = setInfluence(w, BERLIN, PLAYER, 12, START_MS);
    const summary = selectPlayerInfluenceSummary(w);
    expect(summary?.activeCityCount).toBe(2);
    expect(summary?.summaryLine).toContain('Paris (47)');
    expect(summary?.summaryLine).toContain('Berlin (12)');
  });

  it('fogs other actors by magnitude tier', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 40, START_MS);
    w = setInfluence(w, PARIS, ROME, 25, START_MS);
    const view = selectCityInfluence(w, PARIS, PLAYER);
    expect(view?.competingActors[0]?.visibleMagnitude).toBe(influenceMagnitude(25));
    expect(view?.competingActors[0]?.visibleMagnitude).toBe('low');
  });

  it('marks high magnitude competitors at 70+', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 40, START_MS);
    w = setInfluence(w, PARIS, ROME, 75, START_MS);
    const view = selectCityInfluence(w, PARIS, PLAYER);
    expect(view?.competingActors[0]?.visibleMagnitude).toBe('high');
  });

  it('reflects threshold action unlock state from influence level', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 23, START_MS);
    const low = selectCityInfluence(w, PARIS, PLAYER);
    const tribute = low?.availableActions.find((action) => action.kind === 'tribute-extraction');
    expect(tribute?.unlocked).toBe(false);
    expect(tribute?.rejectionReason).toContain('50');

    w = setInfluence(w, PARIS, PLAYER, 100, START_MS);
    const high = selectCityInfluence(w, PARIS, PLAYER);
    expect(high?.availableActions.find((action) => action.kind === 'defection-claim')?.unlocked).toBe(true);
  });

  it('reports cultural campaign cooldown remaining', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 20, START_MS);
    w = {
      ...w,
      culturalCampaigns: [
        {
          ownerId: PLAYER,
          targetCityId: PARIS,
          appliedAt: START_MS,
          cooldownUntil: START_MS + 12 * 86_400_000,
        },
      ],
    };
    const view = selectCityInfluence(w, PARIS, PLAYER);
    const cultural = view?.availableActions.find((action) => action.kind === 'cultural-campaign');
    expect(cultural?.unlocked).toBe(false);
    expect(cultural?.cooldownRemainingMs).toBeGreaterThan(0);
    expect(cultural?.rejectionReason).toContain('Available in');
  });

  it('excludes defeated countries from competing actors', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 40, START_MS);
    w = setInfluence(w, PARIS, ROME, 35, START_MS);
    w = {
      ...w,
      countries: {
        ...w.countries,
        [ROME]: { ...w.countries![ROME]!, defeated: true },
      },
    };
    const view = selectCityInfluence(w, PARIS, PLAYER);
    expect(view?.competingActors).toHaveLength(0);
  });

  it('unlocks gather-intelligence at 30 and reports per-city cooldown', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 29, START_MS);
    const locked = selectCityInfluence(w, PARIS, PLAYER)?.availableActions.find(
      (action) => action.kind === 'gather-intelligence',
    );
    expect(locked?.unlocked).toBe(false);
    expect(locked?.rejectionReason).toContain('30');

    w = setInfluence(w, PARIS, PLAYER, 30, START_MS);
    const ready = selectCityInfluence(w, PARIS, PLAYER)?.availableActions.find(
      (action) => action.kind === 'gather-intelligence',
    );
    expect(ready?.unlocked).toBe(true);

    w = {
      ...w,
      intelligenceGathers: [
        {
          ownerId: PLAYER,
          targetCityId: PARIS,
          gatheredAt: START_MS,
          cooldownUntil: START_MS + 12 * 86_400_000,
        },
      ],
    };
    const cooling = selectCityInfluence(w, PARIS, PLAYER)?.availableActions.find(
      (action) => action.kind === 'gather-intelligence',
    );
    expect(cooling?.unlocked).toBe(false);
    expect(cooling?.cooldownRemainingMs).toBeGreaterThan(0);
    expect(cooling?.rejectionReason).toMatch(/Available in|cooldown/i);
  });

  it('unlocks tribute-cancel only when a tribute is active', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 55, START_MS);
    const idle = selectCityInfluence(w, PARIS, PLAYER)?.availableActions.find(
      (action) => action.kind === 'tribute-cancel',
    );
    expect(idle?.unlocked).toBe(false);
    expect(idle?.rejectionReason).toMatch(/no active tribute/i);

    w = {
      ...w,
      activeTributes: [
        {
          actorId: PLAYER,
          targetCityId: PARIS,
          targetCountryId: ROME,
          startedAt: START_MS,
          lastAccrualAt: START_MS,
          resentment: 0,
          minorRebellionEmitted: false,
          totalGoldExtracted: 0,
          totalResourceExtracted: {},
        },
      ],
    };
    const active = selectCityInfluence(w, PARIS, PLAYER);
    expect(active?.hasActiveTribute).toBe(true);
    expect(active?.availableActions.find((action) => action.kind === 'tribute-cancel')?.unlocked).toBe(
      true,
    );
  });

  it('locks channel actions after the player spends the daily slot', () => {
    let w = setInfluence(world(), PARIS, PLAYER, 40, START_MS);
    w = {
      ...w,
      aiInfluenceCooldowns: { [PLAYER]: START_MS },
    };
    const view = selectCityInfluence(w, PARIS, PLAYER);
    const mission = view?.availableActions.find((action) => action.kind === 'diplomatic-mission');
    const intel = view?.availableActions.find((action) => action.kind === 'gather-intelligence');
    expect(mission?.unlocked).toBe(false);
    expect(mission?.rejectionReason).toMatch(/today.s influence action/i);
    expect(intel?.unlocked).toBe(true);
  });

  it('builds diplomacy rollups for countries with 30+ sway', () => {
    const w = setInfluence(world(), PARIS, PLAYER, 35, START_MS);
    const rollups = selectInfluenceForDiplomacy(w);
    expect(rollups).toHaveLength(1);
    expect(rollups[0]?.countryId).toBe(ROME);
    expect(rollups[0]?.citiesUnderSway).toBe(1);
  });
});
