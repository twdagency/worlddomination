import { describe, it } from 'vitest';

/**
 * Phase 2 contract — capital designation and auto-relocation on capture.
 * @see docs/sprints/sprint-8-capital-defeat-audit.md
 */
describe('country capital (Phase 2 contract)', () => {
  it.todo('exposes capitalTerritoryId on Country from scenario manifest');
  it.todo('relocates capital to another owned city when capital is captured but cities remain');
  it.todo('does not relocate when the captured city was the only holding (defeat path instead)');
  it.todo('applies capital income or infra bonuses per canon (if implemented in Phase 2)');
});
