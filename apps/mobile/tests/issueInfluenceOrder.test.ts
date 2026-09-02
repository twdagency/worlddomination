import { describe, expect, it } from 'vitest';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import {
  applyInfluenceOrders,
  ensureWorldMigrations,
  findActiveTribute,
  latestIntelligenceRecord,
  setInfluence,
} from 'sim';
import { issueInfluenceOrder } from '../src/game/actions';

const START_MS = 1_700_000_000_000;
const PLAYER = 'faction-player';
const PARIS = 'territory-paris';

function world() {
  return ensureWorldMigrations(createSprint4World(START_MS), {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('issueInfluenceOrder — player intelligence and tribute cancel', () => {
  it('issues gather-intelligence and writes an enriched intel record', () => {
    const prepared = setInfluence(world(), PARIS, PLAYER, 35, START_MS);
    const result = issueInfluenceOrder(prepared, 'gather-intelligence', PARIS);
    expect(result.events.some((event) => event.kind === 'intelReport' && event.source === 'intelligence')).toBe(
      true,
    );
    const record = latestIntelligenceRecord(result.world, PLAYER, PARIS, prepared.nowMs);
    expect(record?.snapshot.enriched?.garrisonDetail).toBeDefined();
  });

  it('issues tribute-cancel and removes the active tribute', () => {
    const prepared = setInfluence(world(), PARIS, PLAYER, 55, START_MS);
    const started = applyInfluenceOrders(
      prepared,
      [
        {
          kind: 'tribute-extraction',
          ownerId: PLAYER,
          targetCityId: PARIS,
          intent: 'expand',
          beatId: 'test-tribute-start',
          decisionTickMs: START_MS,
        },
      ],
      START_MS,
    );
    expect(findActiveTribute(started.world, PLAYER, PARIS)).toBeDefined();

    const cancelled = issueInfluenceOrder(started.world, 'tribute-cancel', PARIS);
    expect(cancelled.events.some((event) => event.kind === 'tributeVoluntarilyEnded')).toBe(true);
    expect(findActiveTribute(cancelled.world, PLAYER, PARIS)).toBeUndefined();
  });
});
