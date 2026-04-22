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
