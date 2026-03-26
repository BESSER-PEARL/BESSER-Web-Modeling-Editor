/**
 * Assistant Workspace Services
 * Central export point for all services used by the AssistantWorkspaceDrawer
 */

export { AssistantClient } from './AssistantClient';
export type {
  AssistantWorkspaceContext,
  AssistantActionPayload,
  DiagramSummary,
  InjectionCommand,
  ChatMessage,
  ProjectMetadata,
  SendStatus,
  AssistantClientMode,
} from './assistant-types';

export { generateUniqueId } from './shared-types';
export type { DiagramType } from './shared-types';

export { UMLModelingService } from './UMLModelingService';
export type {
  ClassSpec,
  SystemSpec,
  ModelUpdate,
  BESSERModel,
  ModelModification,
} from './UMLModelingService';

export { RateLimiterService } from './RateLimiterService';
export type {
  RateLimitConfig,
  RateLimitResult,
  RateLimitStatus,
  RateLimiterOptions,
} from './RateLimiterService';

export { ConverterFactory } from './converters';
export type { DiagramConverter, DiagramPosition } from './converters';
export { QuantumCircuitConverter } from './converters/QuantumCircuitConverter';
export { GUIDiagramConverter } from './converters/GUIDiagramConverter';

export { ModifierFactory, ModifierHelpers } from './modifiers';
export type {
  DiagramModifier,
  ModificationTarget,
  ModificationChanges,
} from './modifiers';
export { QuantumCircuitModifier } from './modifiers/QuantumCircuitModifier';
export { GUIDiagramModifier } from './modifiers/GUIDiagramModifier';
