/**
 * Attributes hidden from the user-profile MODELING ENVIRONMENT.
 *
 * The user metamodel can represent any kind of user information. Some of it is
 * design-level (a modelable segment or trait: gender, religion, language level,
 * disability aspects, ...) while some is runtime / individual-specific (first
 * name, address, a specific institution name, ...). The latter only confuses
 * users when it shows up in the editor, so we omit it here.
 *
 * IMPORTANT: this is an EDITOR-ONLY concrete-syntax filter. The B-UML metamodel,
 * object instances, JSON schema, and downstream generators are UNCHANGED — these
 * attributes still exist in the metamodel and the backend; they are simply not
 * offered in the palette or the User Profile form. Removing an entry here makes
 * the attribute reappear with no other code change.
 *
 * Keyed by `${DeclaringClassName}.${attributeName}`.
 */
export const HIDDEN_USER_MODEL_ATTRIBUTES: ReadonlySet<string> = new Set<string>([
  // Personal_Information — runtime PII that identifies an individual.
  // (nationality_iso3166 kept: it can drive design-level behaviour, not just PII.)
  'Personal_Information.firstName',
  'Personal_Information.lastName',
  'Personal_Information.address',
  // Education — names a specific institution / degree, not a design-level category.
  'Education.providedBy',
  'Education.degreeName',
  // Disability — free-text runtime detail (the design-level part is `affects`).
  'Disability.description',
]);

/** True when an attribute should be hidden from the modeling environment. */
export const isHiddenUserModelAttribute = (
  className: string | undefined,
  attributeName: string | undefined,
): boolean => {
  if (!className || !attributeName) return false;
  return HIDDEN_USER_MODEL_ATTRIBUTES.has(`${className}.${attributeName}`);
};
