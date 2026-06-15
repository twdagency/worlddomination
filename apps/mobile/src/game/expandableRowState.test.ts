import { describe, expect, it } from 'vitest';
import { isRowExpanded, toggleExpandedRow } from './expandableRowState';

describe('expandableRowState', () => {
  it('opens a collapsed row', () => {
    expect(toggleExpandedRow(null, 'row-a')).toBe('row-a');
  });

  it('closes an open row when toggled again', () => {
    expect(toggleExpandedRow('row-a', 'row-a')).toBeNull();
  });

  it('switches between rows', () => {
    expect(toggleExpandedRow('row-a', 'row-b')).toBe('row-b');
  });

  it('reports expansion state', () => {
    expect(isRowExpanded('row-a', 'row-a')).toBe(true);
    expect(isRowExpanded('row-a', 'row-b')).toBe(false);
  });
});
