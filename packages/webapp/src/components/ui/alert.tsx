import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// An optional leading <svg> icon is pinned top-left and the rest is indented past it.
const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground [&>svg]:text-foreground',
        info: 'border-info/30 bg-info/10 text-foreground [&>svg]:text-info',
        warning: 'border-warning/30 bg-warning/10 text-foreground [&>svg]:text-warning',
        success: 'border-success/30 bg-success/10 text-foreground [&>svg]:text-success',
        destructive: 'border-destructive/30 bg-destructive/10 text-foreground [&>svg]:text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

type AlertProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>;

/** Only `destructive` interrupts (role="alert"); the other variants are polite (role="status"). */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role={variant === 'destructive' ? 'alert' : 'status'}
    data-variant={variant ?? 'default'}
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mb-1 font-medium leading-5 tracking-tight', className)} {...props} />
));
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm leading-5 [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };
export type { AlertProps };
