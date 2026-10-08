import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { Label } from './label';

interface FormFieldProps {
  /** The label text displayed above the input. */
  label: string;
  /** Id of the control. Defaults to a generated id that `FormControl` applies. */
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

interface FormFieldContextValue {
  controlId: string;
  errorId: string;
  helperId: string;
  hasError: boolean;
  hasHelper: boolean;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

/** Ids and state of the enclosing FormField, or null outside one. */
const useFormField = () => React.useContext(FormFieldContext);

/**
 * Wraps the field's control and gives it `id`, `aria-invalid` and `aria-describedby`
 * (error or helper text). Props set on the child itself win.
 */
const FormControl = React.forwardRef<HTMLElement, React.ComponentPropsWithoutRef<typeof Slot>>((props, ref) => {
  const field = useFormField();
  if (!field) return <Slot ref={ref} {...props} />;
  const describedBy = field.hasError ? field.errorId : field.hasHelper ? field.helperId : undefined;
  return (
    <Slot
      ref={ref}
      id={field.controlId}
      aria-invalid={field.hasError || undefined}
      aria-describedby={describedBy}
      {...props}
    />
  );
});
FormControl.displayName = 'FormControl';

/**
 * Label + control + error/helper text, with the control linked to all three.
 *
 * Recommended: wrap the control in `FormControl` and omit ids:
 *   <FormField label="Name" error={err}><FormControl><Input /></FormControl></FormField>
 * Legacy `htmlFor` + a direct child with the same `id` is linked automatically.
 */
const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, htmlFor, error, helperText, required, className, children }, ref) => {
    const hasError = Boolean(error);
    const generatedId = React.useId();
    const controlId = htmlFor ?? `${generatedId}-control`;
    const context = React.useMemo<FormFieldContextValue>(
      () => ({
        controlId,
        errorId: `${controlId}-error`,
        helperId: `${controlId}-helper`,
        hasError,
        hasHelper: Boolean(helperText),
      }),
      [controlId, hasError, helperText],
    );

    const isLegacyControl =
      htmlFor !== undefined &&
      React.isValidElement<{ id?: string }>(children) &&
      children.type !== FormControl &&
      children.props.id === htmlFor;

    return (
      <FormFieldContext.Provider value={context}>
        <div
          ref={ref}
          className={cn('group/field space-y-1.5', className)}
          data-invalid={hasError || undefined}
        >
          <Label
            htmlFor={controlId}
            className="text-xs font-medium text-muted-foreground"
          >
            {label}
            {required && <span className="ml-0.5 text-destructive">*</span>}
          </Label>

          {isLegacyControl ? <FormControl>{children}</FormControl> : children}

          <div
            className={cn(
              'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
              hasError || helperText ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
            )}
          >
            <div className="overflow-hidden">
              {hasError ? (
                <p id={context.errorId} className="pt-0.5 text-[12px] leading-snug text-destructive" role="alert">
                  {error}
                </p>
              ) : helperText ? (
                <p id={context.helperId} className="pt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {helperText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </FormFieldContext.Provider>
    );
  },
);

FormField.displayName = 'FormField';

export { FormField, FormControl, useFormField };
export type { FormFieldProps };
