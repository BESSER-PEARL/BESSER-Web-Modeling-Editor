/**
 * Diagram Type Converters
 * Handles conversion from simplified specs to BESSER WME format for all diagram types
 */

import type { BesserNode } from '@besser/wme';
import { DiagramType } from '../shared-types';
import { LAYOUT_COLUMNS, LAYOUT_H_GAP, LAYOUT_V_GAP, LAYOUT_START_X, LAYOUT_START_Y } from '../shared/layoutUtils';

export type { DiagramType };

export interface DiagramPosition {
  x: number;
  y: number;
}

/**
 * Base interface for all diagram converters.
 *
 * UML converters (Class / Object / StateMachine / Agent) are v4-native:
 *  - `convertSingleElement` returns a partial `{nodes: BesserNode[],
 *    edges: BesserEdge[]}` fragment accepted by
 *    `UMLModelingService.mergeElementIntoModel`,
 *  - `convertCompleteSystem` returns a full canonical v4 model
 *    (`{version: '4.0.0', type, nodes[], edges[], assessments}`) that
 *    passes the webapp's `isUMLModel` guard and loads directly into the
 *    editor.
 * GUI / quantum converters keep their editor-specific shapes.
 */
export interface DiagramConverter {
  getDiagramType(): DiagramType;
  convertSingleElement(spec: any, position?: DiagramPosition): any;
  convertCompleteSystem(spec: any): any;
}

/**
 * Position generator for elements
 */
export class PositionGenerator {
  private usedPositions: Set<string> = new Set();
  private readonly gridStepX = LAYOUT_H_GAP;
  private readonly gridStepY = LAYOUT_V_GAP;
  private readonly startX = LAYOUT_START_X;
  private readonly startY = LAYOUT_START_Y;

  getNextPosition(index: number = 0): { x: number; y: number } {
    const column = index % LAYOUT_COLUMNS;
    const row = Math.floor(index / LAYOUT_COLUMNS);
    const x = this.startX + column * this.gridStepX;
    const y = this.startY + row * this.gridStepY;

    const key = `${x},${y}`;
    if (this.usedPositions.has(key)) {
      return this.getNextPosition(index + 1);
    }
    
    this.usedPositions.add(key);
    return { x, y };
  }

  reservePosition(position: DiagramPosition): void {
    this.usedPositions.add(`${position.x},${position.y}`);
  }

  reset(): void {
    this.usedPositions.clear();
  }
}

const toFiniteNumber = (value: unknown): number | undefined => {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined;
};

export const extractSpecPosition = (spec: any): DiagramPosition | undefined => {
  if (!spec || typeof spec !== 'object') {
    return undefined;
  }

  const fromNested = spec.position && typeof spec.position === 'object' ? spec.position : undefined;
  const x = toFiniteNumber(fromNested?.x ?? spec.x);
  const y = toFiniteNumber(fromNested?.y ?? spec.y);
  if (typeof x !== 'number' || typeof y !== 'number') {
    return undefined;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
};

/**
 * Shift a v4 model so the bounding box of its nodes is centred on the origin,
 * which keeps the viewport-recentering in `useModelInjection` stable. Only
 * top-level nodes move: children are positioned relative to their parent.
 * Edges carry no route points; the editor routes them.
 */
export const centerNodesOnOrigin = (model: { nodes?: BesserNode[] }): void => {
  const nodes = Array.isArray(model.nodes) ? model.nodes : [];
  if (!nodes.length) return;

  const byId = new Map<string, BesserNode>(nodes.map((n) => [n.id, n]));
  const absoluteOrigin = (node: BesserNode, depth = 0): { x: number; y: number } => {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (!parent || depth > 64) return { x: node.position.x, y: node.position.y };
    const p = absoluteOrigin(parent, depth + 1);
    return { x: p.x + node.position.x, y: p.y + node.position.y };
  };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  nodes.forEach((n) => {
    const { x, y } = absoluteOrigin(n);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (n.width ?? 0));
    maxY = Math.max(maxY, y + (n.height ?? 0));
  });

  const offsetX = -(minX + maxX) / 2;
  const offsetY = -(minY + maxY) / 2;
  nodes.forEach((n) => {
    if (n.parentId) return;
    n.position = { x: n.position.x + offsetX, y: n.position.y + offsetY };
  });
};

// Re-export from shared module
export { generateUniqueId } from '../shared-types';
