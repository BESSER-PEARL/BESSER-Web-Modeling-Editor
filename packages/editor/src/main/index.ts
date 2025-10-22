/**
 * Main entry point for the BESSER Web Modeling Editor package.
 * 
 * This file serves as a "barrel export" that creates a clean, well-organized public API
 * by selectively re-exporting functionality from various internal modules. The goal is to:
 * 
 * - Provide a single, convenient entry point for package consumers
 * - Expose only the necessary public API while keeping internal implementation details private
 * - Maintain type safety through TypeScript type exports
 * - Support backward compatibility through compatibility exports
 * - Allow internal refactoring without breaking the public interface
 */

// Export all type definitions and interfaces used throughout the package
// Provides TypeScript users with access to all data structures and type contracts
export * from './typings';

// Export the main editor component and its related functionality
// This is the primary entry point for users who want to embed the UML editor
export * from './apollon-editor';

// Export compatibility helper functions
// These utilities help with backward compatibility and cross-version support
export * from './compat/helpers';

// Export the diagram bridge service
// Handles communication between different parts of the editor and external integrations
export * from './services/diagram-bridge';

// Export the settings service
// Provides configuration management for standalone applications
export * from './services/settings/settings-service';

// Export only the Patch type (not the implementation) for type safety
// Used when working with patching operations in TypeScript
export type { Patch } from './services/patcher';

// Export only the UMLModelCompat type for compatibility purposes
// Provides type definitions for compatibility with different UML model versions
export type { UMLModelCompat } from './compat';
