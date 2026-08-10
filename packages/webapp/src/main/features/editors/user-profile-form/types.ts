/**
 * Form-state types for the forms-based User Profile editor.
 *
 * A user profile is modelled graphically as a `UserDiagram` (boxes + attribute
 * criteria + links). The form is a second view over that exact model. These
 * types describe the in-memory shape the form manipulates before it is
 * serialised back into an Apollon `UMLModel`.
 */

/** Comparison operators available for an attribute criterion (mirror the editor). */
export const OPERATORS = ['<', '<=', '==', '>=', '>'] as const;
export type Operator = (typeof OPERATORS)[number];

/**
 * One attribute row of an instance. It becomes a `UserModelAttribute`
 * criterion (e.g. `age >= 18`) only when `value` is non-empty.
 */
export interface AttrValue {
  /** Back-reference to the metamodel class attribute id (when known). */
  attributeId?: string;
  /** Attribute name, e.g. `age`. */
  name: string;
  /** Metamodel attribute type (`int`, `str`, or an enumeration name), used to pick the input. */
  type?: string;
  /** When the type is an enumeration, its allowed literal values (drives a dropdown). */
  enumValues?: string[];
  operator: Operator;
  value: string;
}

/** Primitive numeric types whose criteria support comparison operators. */
export const NUMERIC_TYPES = new Set(['int', 'integer', 'float', 'double', 'number', 'decimal', 'long']);

/** Whether an attribute of the given type should expose comparison operators. */
export const isNumericType = (type?: string): boolean => (type ? NUMERIC_TYPES.has(type.toLowerCase()) : false);

/**
 * A single instance of a metamodel class (a `UserModelName` box). The root
 * instance is always `User`. `children` maps a child class name to the list of
 * that child's instances currently present under this instance (length 0 or 1
 * for single-multiplicity parts, 0..n for multiple).
 */
export interface Instance {
  /** Stable, deterministic local id used as a React key. */
  key: string;
  className: string;
  classId?: string;
  icon?: string;
  attributes: AttrValue[];
  children: Record<string, Instance[]>;
}
