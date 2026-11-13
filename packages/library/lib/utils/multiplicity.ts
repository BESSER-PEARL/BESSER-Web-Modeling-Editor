/**
 * Parse a UML multiplicity string into an explicit {min, max} pair.
 * Accepts the range form ("1..1", "0..*", "2..5") and the UML shorthands:
 * "1" == "1..1", "*" == "0..*". The "*" token is preserved in `max`; the
 * caller maps it to the target notation (UML `*` or ER `N`). Returns `null`
 * for unparseable input so the caller can fall back to the original text.
 */
export const parseMultiplicity = (value: string): { min: string; max: string } | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes('..')) {
    const parts = trimmed.split('..');
    if (parts.length !== 2) return null;
    const min = parts[0].trim();
    const max = parts[1].trim();
    if (!min || !max) return null;
    return { min, max };
  }
  if (trimmed === '*') return { min: '0', max: '*' };
  return { min: trimmed, max: trimmed };
};

/**
 * Transform a UML multiplicity into an ER/Chen-style "(min,max)" cardinality.
 * Both UML range form and shorthands map to the same ER pair, so that "1"
 * and "1..1" both become "(1,1)", and "*" and "0..*" both become "(0,N)".
 * Unparseable input is returned unchanged to preserve user intent.
 */
export const toERCardinality = (multiplicity: string | undefined): string => {
  if (!multiplicity) return '';
  const parsed = parseMultiplicity(multiplicity);
  if (!parsed) return multiplicity;
  const max = parsed.max === '*' ? 'N' : parsed.max;
  return `(${parsed.min},${max})`;
};

/**
 * Inverse of toERCardinality: normalize an ER-style "(min,max)" input to
 * the UML storage form. "(0,N)" -> "0..*", "(1,1)" -> "1..1", "(2,5)" ->
 * "2..5". "N"/"n" in the max position map to "*". Input that is not wrapped
 * in parentheses is assumed to already be UML form and returned unchanged —
 * the function is safe to call on every multiplicity value regardless of
 * which syntax the user typed.
 */
export const erCardinalityToUML = (value: string | undefined): string => {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return value;
  }
  const inner = trimmed.slice(1, -1);
  const parts = inner.split(',');
  if (parts.length !== 2) return value;
  const min = parts[0].trim();
  const rawMax = parts[1].trim();
  if (!min || !rawMax) return value;
  const max = /^n$/i.test(rawMax) ? '*' : rawMax;
  return `${min}..${max}`;
};
