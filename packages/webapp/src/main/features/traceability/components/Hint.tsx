import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HintProps {
  /** What the tooltip says. */
  hint: string;
  /** What the tooltip explains; without it, an info icon stands in. */
  children?: React.ReactNode;
  className?: string;
}

/**
 * A short explanation on hover and on keyboard focus. The trigger is focusable and described by the tooltip, so a
 * screen reader reads the explanation too.
 */
export const Hint: React.FC<HintProps> = ({ hint, children, className }) => (
  <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        {children ? (
          <span tabIndex={0} className={cn('cursor-help rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}>
            {children}
          </span>
        ) : (
          <span
            tabIndex={0}
            role="img"
            aria-label={hint}
            className={cn('inline-flex cursor-help rounded text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
          >
            <Info className="size-3.5" />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-72 whitespace-normal leading-snug">
        {hint}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);
