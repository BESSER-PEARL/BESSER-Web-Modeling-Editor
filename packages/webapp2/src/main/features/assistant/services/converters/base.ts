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

// Re-export from shared module
export { generateUniqueId } from '../shared-types';
