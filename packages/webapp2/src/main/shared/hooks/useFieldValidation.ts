import { useCallback, useMemo, useState } from 'react';

/**
 * Tracks which fields have been "touched" (blurred at least once) so that
 * validation errors are only displayed after the user interacts with a field.
 *
 * Usage:
 * ```ts
 * const { touched, markTouched, getError, touchAll, resetTouched } = useFieldValidation({
 *   name:  () => validateProjectName(name),
 *   email: () => validateEmail(email),
 * });
 *
 * // In JSX:
 * <FormField label="Name" error={getError('name')}>
 *   <Input onBlur={() => markTouched('name')} ... />
 * </FormField>
 *
 * // Before submit:
 * const errors = touchAll();  // returns map of all current errors
 * if (Object.keys(errors).length > 0) return; // abort
 * ```
 */
export function useFieldValidation<K extends string>(
  validators: Record<K, () => string | undefined>,
) {
  const [touched, setTouched] = useState<Partial<Record<K, boolean>>>({});

  const markTouched = useCallback((field: K) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  /** Returns the error for a field only if it has been touched. */
  const getError = useCallback(
    (field: K): string | undefined => {
      if (!touched[field]) return undefined;
      return validators[field]();
    },
    [touched, validators],
  );

  /** Marks every field as touched and returns the full error map (only fields with errors). */
  const touchAll = useCallback((): Partial<Record<K, string>> => {
    const allTouched = Object.keys(validators).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Record<K, boolean>,
    );
    setTouched(allTouched);

    const errors: Partial<Record<K, string>> = {};
    for (const key of Object.keys(validators) as K[]) {
      const err = validators[key]();
      if (err) errors[key] = err;
    }
    return errors;
  }, [validators]);

  /** Reset all touched flags (useful when dialog re-opens). */
  const resetTouched = useCallback(() => {
    setTouched({});
  }, []);

  /** True when no validator returns an error — regardless of touched state. */
  const isValid = useMemo(() => {
    for (const key of Object.keys(validators) as K[]) {
      if (validators[key]()) return false;
    }
    return true;
  }, [validators]);

  return { touched, markTouched, getError, touchAll, resetTouched, isValid };
}
