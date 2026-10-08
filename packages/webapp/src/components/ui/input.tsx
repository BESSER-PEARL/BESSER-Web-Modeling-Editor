import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Shared surface for every text-like control (Input, Textarea, SelectTrigger, and native
 * `<select>`s elsewhere). Height is left to the caller. Invalid state keys off `aria-invalid`.
 */
const inputBaseClass =
  'flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background transition-[color,background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground hover:border-muted-foreground/30 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, type, ...props }, ref) => {
  return <input type={type} className={cn(inputBaseClass, 'h-10', className)} ref={ref} {...props} />;
});
Input.displayName = 'Input';

export { Input, inputBaseClass };
