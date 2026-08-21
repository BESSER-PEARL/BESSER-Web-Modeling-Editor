/**
 * Grouping classes hidden from the user-profile CANVAS.
 *
 * The user metamodel nests some children under pure "container" classes that
 * carry no attributes of their own (Competence -> Skill/Language/Education,
 * Accessibility -> Disability). On the graphical editor these render as empty
 * icon tiles that add visual noise without conveying anything, so we hide them
 * from the canvas and attach their children directly under `User`.
 *
 * IMPORTANT: this is a concrete-syntax decision only. The container instances
 * (and the User -> container -> child containment) are still emitted into the
 * transmitted model so the B-UML metamodel, JSON schema and downstream
 * generators are UNCHANGED — the container is simply not drawn. Removing an
 * entry here makes the container reappear on the canvas with no other change.
 */
export const HIDDEN_USER_MODEL_CONTAINERS: ReadonlySet<string> = new Set<string>([
  'Competence',
  'Accessibility',
]);

/** True when a grouping class should be hidden from the canvas. */
export const isHiddenUserModelContainer = (className: string | undefined): boolean => {
  if (!className) return false;
  return HIDDEN_USER_MODEL_CONTAINERS.has(className);
};
