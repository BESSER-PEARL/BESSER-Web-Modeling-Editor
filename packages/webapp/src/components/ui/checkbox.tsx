import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Native checkbox (no @radix-ui/react-checkbox dependency) with a shadcn-style API.
// `className` sizes/positions the wrapper; the box fills it.
type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> & {
  onCheckedChange?: (checked: boolean) => void;
};

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(({ className, onCheckedChange, ...props }, ref) => (
  <span className={cn('relative inline-flex size-4 shrink-0 items-center justify-center', className)}>
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        'peer size-full shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background ring-offset-background transition-colors',
        'hover:border-brand/50 checked:border-brand checked:bg-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
    <Check
      aria-hidden
      strokeWidth={3}
      className="pointer-events-none absolute size-3/4 text-brand-foreground opacity-0 peer-checked:opacity-100"
    />
  </span>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
