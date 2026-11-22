/**
 * Diagram Type Converters
 * Handles conversion from simplified specs to Apollon format for all diagram types
 */

import { DiagramType } from '../shared-types';
import { LAYOUT_COLUMNS, LAYOUT_H_GAP, LAYOUT_V_GAP, LAYOUT_START_X, LAYOUT_START_Y } from '../shared/layoutUtils';

export type { DiagramType };

export interface DiagramPosition {
  x: number;
  y: number;
}

/**
 * Base interface for all diagram converters
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

interface PlacedElement {
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Shift element bounds so the centre of the content's bounding box sits on the
 * origin. The canvas draws elements inside <svg x="50%" y="50%">, so model
 * coordinate (0,0) is the visual centre of the canvas; content pinned to
 * x>=0 / y>=0 would land in the bottom-right quadrant. Flow geometry is a
 * placeholder the layouter recomputes, so only element bounds move.
 * Returns the content size, or null when there are no elements.
 */
export const centerElementsOnOrigin = (
  elements: Record<string, PlacedElement>,
): { width: number; height: number } | null => {
  const placed = Object.values(elements);
  if (!placed.length) return null;
  const minX = Math.min(...placed.map((e) => e.bounds.x));
  const minY = Math.min(...placed.map((e) => e.bounds.y));
  const maxX = Math.max(...placed.map((e) => e.bounds.x + e.bounds.width));
  const maxY = Math.max(...placed.map((e) => e.bounds.y + e.bounds.height));
  const offsetX = -(minX + maxX) / 2;
  const offsetY = -(minY + maxY) / 2;
  placed.forEach((e) => {
    e.bounds.x += offsetX;
    e.bounds.y += offsetY;
  });
  return { width: maxX - minX, height: maxY - minY };
};

// Re-export from shared module
export { generateUniqueId } from '../shared-types';
