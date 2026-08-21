/**
 * Canonical type aliases shared between modifiers and converters.
 * Single source of truth -- do not duplicate these definitions elsewhere.
 */

/** Map of common type names/aliases to canonical BESSER primitive names. */
export const TYPE_ALIASES: Record<string, string> = {
  'string': 'str', 'String': 'str', 'STRING': 'str',
  'integer': 'int', 'Integer': 'int', 'INTEGER': 'int', 'long': 'int', 'Long': 'int',
  'double': 'float', 'Double': 'float', 'DOUBLE': 'float', 'Float': 'float', 'FLOAT': 'float',
  'number': 'float', 'Number': 'float', 'decimal': 'float', 'Decimal': 'float',
  'BigDecimal': 'float', 'bigdecimal': 'float',
  'boolean': 'bool', 'Boolean': 'bool', 'BOOLEAN': 'bool',
  'Date': 'date', 'DATE': 'date', 'LocalDate': 'date', 'localDate': 'date',
  'DateTime': 'datetime', 'DATETIME': 'datetime', 'Timestamp': 'datetime', 'timestamp': 'datetime',
  'LocalDateTime': 'datetime', 'localDateTime': 'datetime',
  'Time': 'time', 'TIME': 'time', 'LocalTime': 'time',
  'object': 'any', 'Object': 'any', 'void': 'any', 'Void': 'any',
  'UUID': 'str', 'Uuid': 'str', 'uuid': 'str', 'GUID': 'str',
  'byte': 'int', 'Byte': 'int', 'short': 'int', 'Short': 'int',
  'char': 'str', 'Char': 'str', 'Character': 'str',
};

/** Valid BESSER primitive types. */
export const VALID_PRIMITIVES = new Set(['str', 'int', 'bool', 'float', 'date', 'datetime', 'time', 'any']);

/** Normalize a raw type string to a canonical form. */
export const normalizeType = (type: string | null | undefined, classNames?: Set<string>, fallback: string = ''): string => {
  if (!type) return fallback;
  const trimmed = type.trim();
  if (!trimmed) return fallback;
  const aliased = TYPE_ALIASES[trimmed];
  if (aliased) return aliased;
  // If the type matches a class name in the model, keep it (custom type / enum reference)
  if (classNames && classNames.has(trimmed)) return trimmed;
  // If it's already a valid primitive, keep it
  if (VALID_PRIMITIVES.has(trimmed)) return trimmed;
  // Unknown type — keep as-is (could be an enum or custom class name)
  return trimmed;
};
