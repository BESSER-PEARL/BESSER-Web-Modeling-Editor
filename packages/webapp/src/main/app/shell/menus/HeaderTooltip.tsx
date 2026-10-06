import React from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface HeaderTooltipProps {
  label: string;
  /** Breakpoint from which the trigger shows its own text label, so the tooltip is redundant. */
  hideFrom?: 'xl' | '2xl';
  children: React.ReactElement;
}

const HIDE_FROM_CLASS = { xl: 'xl:hidden', '2xl': '2xl:hidden' } as const;

/** Tooltip for icon-only top-bar triggers. Needs the TooltipProvider rendered by WorkspaceShell. */
export const HeaderTooltip: React.FC<HeaderTooltipProps> = ({ label, hideFrom, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent side="bottom" className={hideFrom ? HIDE_FROM_CLASS[hideFrom] : undefined}>
      {label}
    </TooltipContent>
  </Tooltip>
);
