/**
 * Diagram Type Converters
 * Handles conversion from simplified specs to Apollon format for all diagram types
 */

import { DiagramType } from '../shared-types';

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
  private readonly gridStepX = 360;
  private readonly gridStepY = 280;
  private readonly startX = -940;
  private readonly startY = -600;

  getNextPosition(index: number = 0): { x: number; y: number } {
    const column = index % 3;
    const row = Math.floor(index / 3);
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
