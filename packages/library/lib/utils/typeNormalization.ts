/**
 * Pure type-normalization helpers extracted from
 * `v3 source: common/uml-classifier/uml-classifier-member.ts`.
 *
 * No React, no Redux. Used by:
 * - the new lib's properties panel and inline class-row editor on commit,
 * - JSON round-trip migrators (TS + Python parity expected here).
 */

/**
 * Type alias mapping for normalizing types from various sources
 * (agent responses, imports, etc.)
 */
export const TYPE_ALIASES: Record<string, string> = {
  // String variants
  string: "str",
  String: "str",
  STRING: "str",
  // Integer variants
  integer: "int",
  Integer: "int",
  INTEGER: "int",
  long: "int",
  Long: "int",
  // Float/Double variants
  double: "float",
  Double: "float",
  DOUBLE: "float",
  Float: "float",
  FLOAT: "float",
  number: "float",
  Number: "float",
  decimal: "float",
  Decimal: "float",
  // Boolean variants
  boolean: "bool",
  Boolean: "bool",
  BOOLEAN: "bool",
  // Date variants
  Date: "date",
  DATE: "date",
  // DateTime variants
  DateTime: "datetime",
  DATETIME: "datetime",
  Timestamp: "datetime",
  timestamp: "datetime",
  // Time variants
  Time: "time",
  TIME: "time",
  // Any variants
  object: "any",
  Object: "any",
  void: "any",
  Void: "any",
}

/**
 * Normalize a type string to the canonical Python-style type.
 * Returns 'str' for empty input. Preserves unknown custom types verbatim.
 */
export const normalizeType = (type: string): string => {
  if (!type) return "str"
  const trimmed = type.trim()
  return TYPE_ALIASES[trimmed] || trimmed
}

/** Visibility values supported by UML classifier members. */
export type Visibility = "public" | "private" | "protected" | "package"

/** Visibility symbol mapping (the canonical UML form). */
export const VISIBILITY_SYMBOLS: Record<Visibility, string> = {
  public: "+",
  private: "-",
  protected: "#",
  package: "~",
}

/** Inverse of VISIBILITY_SYMBOLS, for legacy-format parsing. */
export const SYMBOL_TO_VISIBILITY: Record<string, Visibility> = {
  "+": "public",
  "-": "private",
  "#": "protected",
  "~": "package",
}
