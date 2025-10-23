/**
 * Diagram Type Converters
 * Handles conversion from simplified specs to Apollon format for all diagram types
 */

export type DiagramType = 'ClassDiagram' | 'ObjectDiagram' | 'StateMachineDiagram' | 'AgentDiagram';

/**
 * Base interface for all diagram converters
 */
export interface DiagramConverter {
  getDiagramType(): DiagramType;
  convertSingleElement(spec: any, position?: { x: number; y: number }): any;
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

  reset(): void {
    this.usedPositions.clear();
  }
}

/**
 * Generate unique ID
 */
export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;
}
