/**
 * Modifiers Index
 * Central export point for all diagram modifiers
 */

export { ModifierFactory } from './factory';
export type { 
  DiagramModifier, 
  DiagramType,
  ModelModification,
  ModificationTarget,
  ModificationChanges
} from './base';
export { ModifierHelpers } from './base';

export { ClassDiagramModifier } from './ClassDiagramModifier';
export { AgentDiagramModifier } from './AgentDiagramModifier';
export { ObjectDiagramModifier } from './ObjectDiagramModifier';
export { StateMachineModifier } from './StateMachineModifier';
