/**
 * Shared v4 node/model factory helpers.
 *
 * Single source of truth for the React-Flow (v4) shapes the assistant
 * emits — used by both the converters (system/element specs → model) and
 * the modifiers (in-place model edits) so the two paths produce identical
 * nodes. Shapes follow `packages/library` canon:
 *   - all classifiers are `node.type === 'class'` discriminated by
 *     `data.stereotype` (see `lib/utils/versionConverter.ts`),
 *   - node geometry lives on `width` / `height` / `measured`,
 *   - edge anchors use the lowercase `HandleId` values from
 *     `lib/nodes/wrappers/DefaultNodeWrapper.tsx` (`'left'`, `'right'`, …).
 */

import type { BesserNode } from '@besser/wme';

/** All v4 class-like node types live under `node.type === 'class'`. */
export const CLASS_NODE_TYPE = 'class';

/** Empty canonical v4 model envelope for a given diagram type. */
export function createEmptyV4Model(type: string, title: string = ''): Record<string, any> {
  return {
    version: '4.0.0',
    id: '',
    title,
    type,
    nodes: [],
    edges: [],
    assessments: {},
  };
}

/**
 * Compute a class node's height from its row counts. Mirrors the v3
 * visual budget (50px header + 25px rows + 10px method gap + padding).
 */
export function classNodeHeight(attrCount: number, methodCount: number): number {
  const headerHeight = 50;
  const rowHeight = 25;
  const methodGap = methodCount > 0 ? 10 : 0;
  const padding = 15;
  return Math.max(90, headerHeight + attrCount * rowHeight + methodGap + methodCount * rowHeight + padding);
}

/** Recompute `height` / `measured` on a class node after its rows changed. */
export function recalculateClassNodeHeight(node: BesserNode): void {
  const data: any = node.data || {};
  const attrCount = Array.isArray(data.attributes) ? data.attributes.length : 0;
  const methodCount = Array.isArray(data.methods) ? data.methods.length : 0;
  const h = classNodeHeight(attrCount, methodCount);
  node.height = h;
  node.measured = { width: node.width, height: h };
}

/** Build a v4 class node (`type: 'class'`, stereotype-discriminated). */
export function buildClassNode(opts: {
  id: string;
  name: string;
  stereotype?: string | null;
  x: number;
  y: number;
  width?: number;
  height?: number;
  extraData?: Record<string, unknown>;
}): BesserNode {
  const w = opts.width ?? 220;
  const h = opts.height ?? 90;
  const data: Record<string, unknown> = {
    name: opts.name,
    attributes: [],
    methods: [],
    ...(opts.extraData || {}),
  };
  if (opts.stereotype) {
    data.stereotype = opts.stereotype;
  }
  return {
    id: opts.id,
    type: CLASS_NODE_TYPE as any,
    position: { x: opts.x, y: opts.y },
    width: w,
    height: h,
    measured: { width: w, height: h },
    data,
  };
}

/**
 * Estimate the rendered width of an agent state/intent from its longest
 * text line (~8px per character + padding, matching editor font metrics).
 * The editor auto-sizes elements, so we must match to avoid overlaps.
 */
export function estimateAgentNodeWidth(texts: Array<string | undefined>, baseWidth: number): number {
  let maxW = baseWidth;
  for (const text of texts) {
    if (text) {
      const estimated = text.length * 8 + 40;
      maxW = Math.max(maxW, estimated);
    }
  }
  return Math.max(maxW, baseWidth);
}

/**
 * Map a v3-style compass direction (`'Left'`, `'Up'`, …) to the v4
 * lowercase React-Flow handle id (`'left'`, `'top'`, …). Mirrors the main
 * directions of `convertV3HandleToV4` in the library's versionConverter.
 */
export function directionToHandle(direction: string | undefined, fallback: string): string {
  const map: Record<string, string> = {
    Up: 'top',
    Right: 'right',
    Down: 'bottom',
    Left: 'left',
  };
  if (!direction) return map[fallback] ?? fallback.toLowerCase();
  return map[direction] ?? direction.toLowerCase();
}
