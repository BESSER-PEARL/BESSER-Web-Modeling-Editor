/**
 * Merging an assistant-built system into the open diagram ("Keep and add alongside").
 */

import type { BESSERModel } from './UMLModelingService';

/** Vertical gap between the existing content and the elements a merge adds. */
const MERGE_GAP_Y = 100;

/**
 * Merge a complete system into an existing model. Elements the system shares
 * with the model (same id) keep their current state; a shared classifier only
 * gains the members it did not have.
 */
export function mergeSystemIntoModel(currentModel: BESSERModel, systemData: any): BESSERModel {
  const elements: Record<string, any> = { ...currentModel.elements };
  for (const [id, element] of Object.entries<any>(systemData.elements || {})) {
    const existing = elements[id];
    if (!existing) {
      elements[id] = element;
      continue;
    }
    for (const key of ['attributes', 'methods']) {
      if (Array.isArray(existing[key]) && Array.isArray(element?.[key])) {
        elements[id] = { ...elements[id], [key]: [...new Set([...existing[key], ...element[key]])] };
      }
    }
  }
  return {
    ...currentModel,
    elements,
    relationships: {
      ...systemData.relationships,
      ...currentModel.relationships,
    },
    size: systemData.size || currentModel.size,
  };
}

const extent = (elements: any[]) => {
  const placed = elements.filter((e) => e?.bounds);
  if (!placed.length) return null;
  return {
    minX: Math.min(...placed.map((e) => e.bounds.x)),
    minY: Math.min(...placed.map((e) => e.bounds.y)),
    maxY: Math.max(...placed.map((e) => e.bounds.y + (e.bounds.height ?? 0))),
  };
};

/** Move the elements of ``system`` that ``existingModel`` lacks below the existing content (in place). */
export function placeBelow(system: any, existingModel: any): any {
  const existingElements = existingModel?.elements || {};
  const added = Object.values((system?.elements || {}) as Record<string, any>).filter(
    (e) => !(e.id in existingElements),
  );
  const existing = extent(Object.values(existingElements));
  const incoming = extent(added);
  if (!existing || !incoming) return system;
  const dx = existing.minX - incoming.minX;
  const dy = existing.maxY + MERGE_GAP_Y - incoming.minY;
  added.forEach((e) => {
    if (e.bounds) e.bounds = { ...e.bounds, x: e.bounds.x + dx, y: e.bounds.y + dy };
  });
  return system;
}
