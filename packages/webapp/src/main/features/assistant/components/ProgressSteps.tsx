import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressStepsProps {
  /**
   * Recent progress steps (most-recent last). The last entry is the live
   * step (spinner); earlier entries are rendered as completed (check).
   */
  steps: string[];
  className?: string;
}

/**
 * ProgressSteps — surfaces the agent's streamed progress as a short, evolving
 * step list so long operations (diagram + codegen) visibly show motion
 * instead of one easily-missed line. Shared by the widget and the workspace
 * drawer so both surfaces behave identically.
 *
 * Renders nothing when there are no steps, so callers can mount it
 * unconditionally and rely on the empty list (cleared on completion) to hide
 * it — no stuck "Generating…".
 */
export const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps, className }) => {
  if (!steps || steps.length === 0) return null;

  const lastIndex = steps.length - 1;

  return (
    <div
      className={cn(
        'mt-3 flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 animate-in fade-in-0 duration-300',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {steps.map((step, i) => {
        const isCurrent = i === lastIndex;
        return (
          <div
            key={`${i}-${step}`}
            className={cn(
              'flex items-center gap-2 text-xs',
              isCurrent ? 'text-foreground' : 'text-muted-foreground/60',
            )}
          >
            {isCurrent ? (
              <Loader2 className="size-3 shrink-0 animate-spin text-brand" />
            ) : (
              <Check className="size-3 shrink-0 text-brand/60" />
            )}
            <span className={cn('truncate', isCurrent && 'font-medium')}>{step}</span>
          </div>
        );
      })}
    </div>
  );
};
