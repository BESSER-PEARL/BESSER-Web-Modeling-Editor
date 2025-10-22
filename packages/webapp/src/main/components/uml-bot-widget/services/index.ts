/**
 * Index file for UML Bot Widget services
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
  BotResponse, 
  InjectionCommand, 
  MessageHandler, 
  ConnectionHandler, 
  TypingHandler, 
  InjectionHandler 
} from './WebSocketService';

export { UIService } from './UIService';
export type { MessageDisplayConfig } from './UIService';

export { ConverterFactory } from './converters';
export type { DiagramType, DiagramConverter } from './converters';

export { ModifierFactory } from './modifiers';
export type { DiagramModifier, ModelModification } from './modifiers';

// Re-export commonly used types for convenience
export type { AppDispatch } from '../../../store/store';
