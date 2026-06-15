/** Pure expand/collapse id toggle for disclosure rows. */
export function toggleExpandedRow(currentId: string | null, rowId: string): string | null {
  return currentId === rowId ? null : rowId;
}

export function isRowExpanded(currentId: string | null, rowId: string): boolean {
  return currentId === rowId;
}
