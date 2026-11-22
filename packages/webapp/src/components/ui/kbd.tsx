import * as React from 'react';
import { cn } from '@/lib/utils';

/** One key cap, used by the command palette, the shortcuts dialog and in-app hints. */
const Kbd = ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => (
  <kbd
    className={cn(
      'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border border-b-2 bg-muted/60 px-1.5 font-mono text-[10px] font-medium leading-none text-muted-foreground',
      className,
    )}
    {...props}
  />
);

export { Kbd };
