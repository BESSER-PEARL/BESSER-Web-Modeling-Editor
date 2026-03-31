/**
 * Shared types and utilities used across converters and modifiers.
 * Single source of truth — do not duplicate these definitions elsewhere.
 */

export type DiagramType =
  | 'ClassDiagram'
  | 'ObjectDiagram'
  | 'StateMachineDiagram'
  | 'AgentDiagram'
  | 'QuantumCircuitDiagram'
  | 'GUINoCodeDiagram';

/**
 * Generate a unique ID with an optional prefix.
 */
export function generateUniqueId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 3)}`;
}
