import { describe, it } from 'vitest';

/**
 * Phase 2 contract — country defeat when capital captured and zero cities held.
 * @see docs/sprints/sprint-8-capital-defeat-audit.md
 */
describe('country defeat (Phase 2 contract)', () => {
  it.todo('marks country defeated when capital is captured and no cities remain');
  it.todo('emits countryDefeated event with conqueror and capital territory');
  it.todo('dissolves alliances involving the defeated country');
  it.todo('expires active treaties involving the defeated country');
  it.todo('excludes defeated country from collectAiOrders');
});
