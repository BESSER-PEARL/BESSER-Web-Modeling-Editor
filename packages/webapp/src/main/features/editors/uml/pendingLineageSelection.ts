/**
 * The source element a "← Source" lineage link selects once the source
 * diagram's editor is set up. Kept outside the editor component: opening the
 * source diagram unmounts it (the editor view shows a skeleton while loading).
 */
let pending: { diagramId: string; elementId: string } | null = null;

export function setPendingLineageSelection(diagramId: string, elementId: string): void {
  pending = { diagramId, elementId };
}

export function clearPendingLineageSelection(): void {
  pending = null;
}

/** The element to select in `diagramId`'s editor, consumed on read; null for any other diagram. */
export function takePendingLineageSelection(diagramId: string | undefined): string | null {
  if (!pending || pending.diagramId !== diagramId) return null;
  const { elementId } = pending;
  pending = null;
  return elementId;
}
