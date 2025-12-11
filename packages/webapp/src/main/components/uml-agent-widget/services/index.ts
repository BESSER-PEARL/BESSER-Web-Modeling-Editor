/**
 * Index file for UML Agent Widget services
 * Provides easy imports for all service classes
 */

export { UMLModelingService } from './UMLModelingService';
export type { 
  ClassSpec, 
  SystemSpec, 
  ModelUpdate, 
  BESSERModel 
} from './UMLModelingService';

export { WebSocketService } from './WebSocketService';
export type { 
  ChatMessage, 
  AgentResponse, 
  InjectionCommand, 
  MessageHandler, 
  ConnectionHandler, 
  TypingHandler, 
  InjectionHandler 
} from './WebSocketService';

export { UIService } from './UIService';
export type { MessageDisplayConfig } from './UIService';

export { RateLimiterService } from './RateLimiterService';
export type { RateLimitConfig, RateLimitResult, RateLimitStatus, RateLimiterOptions } from './RateLimiterService';

export { ConverterFactory } from './converters';
export type { DiagramType, DiagramConverter } from './converters';

export { ModifierFactory } from './modifiers';
export type { DiagramModifier, ModelModification } from './modifiers';

// Re-export commonly used types for convenience
export type { AppDispatch } from '../../../store/store';
