import React from 'react';
import { cn } from '@/lib/utils';

/** The frame of the lineage's detail pane. */
export const DetailPane: React.FC<{ children: React.ReactNode; className?: string; label?: string }> = ({ children, className, label }) => (
  <aside aria-label={label} className={cn('min-w-0 space-y-3 rounded-lg border border-border bg-card p-3 text-sm', className)}>
    {children}
  </aside>
);

/** A titled section of the detail pane. */
export const DetailSection: React.FC<{ title: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <section className={cn('space-y-1', className)}>
    <h4 className="text-xs font-semibold">{title}</h4>
    {children}
  </section>
);
