/**
 * Reusable inline validation helpers.
 *
 * Each validator returns `undefined` when the value is valid, or a string
 * error message describing what is wrong. This convention lets callers do:
 *
 *   const error = validateRequired(value, 'Project name');
 *   //  => undefined  |  "Project name is required."
 */

// ── Generic validators ──────────────────────────────────────────────────

/** Fails when the trimmed value is empty. */
export const validateRequired = (value: string, fieldLabel: string): string | undefined => {
  if (!value.trim()) {
    return `${fieldLabel} is required.`;
  }
  return undefined;
};

/** Fails when the trimmed value is shorter than `min` characters. */
export const validateMinLength = (
  value: string,
  min: number,
  fieldLabel: string,
): string | undefined => {
  if (value.trim().length > 0 && value.trim().length < min) {
    return `${fieldLabel} must be at least ${min} characters.`;
  }
  return undefined;
};

/** Fails when the trimmed value is longer than `max` characters. */
export const validateMaxLength = (
  value: string,
  max: number,
  fieldLabel: string,
): string | undefined => {
  if (value.trim().length > max) {
    return `${fieldLabel} must be at most ${max} characters.`;
  }
  return undefined;
};

// ── Pattern-based validators ────────────────────────────────────────────

/**
 * Validates a project / app name:
 *  - must not be empty
 *  - only letters, digits, underscores, hyphens allowed
 *  - must start with a letter or underscore
 */
export const validateProjectName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Project name is required.';
  }
  if (!/^[A-Za-z_]/.test(trimmed)) {
    return 'Must start with a letter or underscore.';
  }
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed.replace(/\s+/g, '_'))) {
    return 'Only letters, digits, underscores, and hyphens are allowed.';
  }
  if (trimmed.length > 64) {
    return 'Must be at most 64 characters.';
  }
  return undefined;
};

/**
 * Validates a GitHub repository name:
 *  - must not be empty
 *  - cannot start with a dot, dash, or underscore
 *  - can contain alphanumeric, dashes, dots, and underscores
 *  - cannot end with .git or a dot
 *  - max 100 chars
 */
export const validateRepoName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'Repository name is required.';
  }
  if (trimmed.length > 100) {
    return 'Must be at most 100 characters.';
  }
  if (/^[.\-_]/.test(trimmed)) {
    return 'Cannot start with a dot, dash, or underscore.';
  }
  if (/\.git$/i.test(trimmed) || /\.$/.test(trimmed)) {
    return 'Cannot end with .git or a dot.';
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return 'Only letters, numbers, dashes, dots, and underscores.';
  }
  return undefined;
};

/**
 * Validates a file name:
 *  - must not be empty
 *  - must contain a file extension
 *  - no path separators or invalid file-system chars
 */
export const validateFileName = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 'File name is required.';
  }
  if (!/\.[a-zA-Z0-9]+$/.test(trimmed)) {
    return 'Must include a file extension (e.g., .json).';
  }
  if (/[/\\<>:"|?*]/.test(trimmed)) {
    return 'Contains invalid characters.';
  }
  return undefined;
};

/**
 * Validates an email address (loose check — only used for optional fields).
 * Returns undefined for empty strings (email is optional).
 */
export const validateEmail = (value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined; // empty is OK for optional fields
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter a valid email address.';
  }
  return undefined;
};

/**
 * Validates that a number falls within an inclusive range.
 */
export const validateNumberRange = (
  value: number,
  min: number,
  max: number,
  fieldLabel: string,
): string | undefined => {
  if (isNaN(value)) {
    return `${fieldLabel} must be a number.`;
  }
  if (value < min || value > max) {
    return `${fieldLabel} must be between ${min.toLocaleString()} and ${max.toLocaleString()}.`;
  }
  return undefined;
};

// ── Combinator ──────────────────────────────────────────────────────────

/**
 * Runs multiple validators in order and returns the first error, or undefined.
 *
 * Usage:
 *   const error = composeValidators(value,
 *     v => validateRequired(v, 'Name'),
 *     v => validateMaxLength(v, 64, 'Name'),
 *   );
 */
export const composeValidators = (
  value: string,
  ...validators: Array<(v: string) => string | undefined>
): string | undefined => {
  for (const validate of validators) {
    const error = validate(value);
    if (error) return error;
  }
  return undefined;
};
