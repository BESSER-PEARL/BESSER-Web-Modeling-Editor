import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FormFieldProps {
  /** The label text displayed above the input. */
  label: string;
  /** Optional HTML `for` attribute linking the label to an input. */
  htmlFor?: string;
  /** Validation error message. When set, the field shows an error state. */
  error?: string;
  /** Helper text shown below the input (hidden when an error is displayed). */
  helperText?: string;
  /** Whether to show a red asterisk indicating the field is required. */
  required?: boolean;
  /** Additional class names for the outermost wrapper. */
  className?: string;
  /** The input element(s) to render inside the field. */
  children: React.ReactNode;
}

/**
 * A reusable form field wrapper that displays a label, an input (via children),
 * and optional validation error or helper text with smooth transitions.
 *
 * Error text appears in red below the input and the wrapper applies an
 * `aria-invalid` data attribute so child inputs can style their borders
 * accordingly via the `group-data-[invalid]:` Tailwind modifier.
 */
const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, htmlFor, error, helperText, required, className, children }, ref) => {
    const hasError = Boolean(error);

    return (
      <div
        ref={ref}
        className={cn('group/field space-y-1.5', className)}
        data-invalid={hasError || undefined}
      >
        <Label
          htmlFor={htmlFor}
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>

        {children}

        <div
          className={cn(
            'grid transition-all duration-200 ease-in-out',
            hasError || helperText ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          aria-live="polite"
        >
          <div className="overflow-hidden">
            {hasError ? (
              <p className="pt-0.5 text-[12px] leading-snug text-destructive" role="alert">
                {error}
              </p>
            ) : helperText ? (
              <p className="pt-0.5 text-[11px] leading-snug text-muted-foreground/70">
                {helperText}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
);

FormField.displayName = 'FormField';

export { FormField };
export type { FormFieldProps };
