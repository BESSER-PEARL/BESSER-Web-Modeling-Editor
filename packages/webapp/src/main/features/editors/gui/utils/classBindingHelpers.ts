/**
 * Type definitions and helper functions for class and attribute metadata
 * Used for data binding in charts and other data-driven components
 */

/**
 * Metadata for a class attribute
 */
export interface AttributeMetadata {
  id: string;
  name: string;
  type: string;
  isNumeric: boolean;
  isString: boolean;
}

/**
 * Metadata for a class including its attributes
 */
export interface ClassMetadata {
  id: string;
  name: string;
  attributes: AttributeMetadata[];
}

/**
 * Check if a type is numeric (int, float, etc.)
 */
export function isNumericType(type: string): boolean {
  const numericTypes = ['int', 'float', 'double', 'decimal', 'number', 'long', 'short'];
  return numericTypes.includes(type.toLowerCase());
}

/**
 * Check if a type is string-based
 */
export function isStringType(type: string): boolean {
  const stringTypes = ['str', 'string', 'text', 'char', 'varchar'];
  return stringTypes.includes(type.toLowerCase());
}
