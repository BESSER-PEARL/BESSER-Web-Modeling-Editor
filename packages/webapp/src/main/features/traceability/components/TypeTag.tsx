import React from 'react';
import { cn } from '@/lib/utils';

/** The small caps label naming an element's type next to its name ("Class", "Attribute"). */
export const TypeTag: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span className={cn('shrink-0 whitespace-nowrap text-[10px] font-medium uppercase tracking-wider text-muted-foreground', className)}>{children}</span>
);
