import React from 'react';
import { cn } from '@/lib/utils';

interface FilterPillsProps<T extends string> {
  values: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => string;
  /** Names the group for assistive technology. */
  groupLabel: string;
}

/** One-of-several toggle buttons: the pressed one is the active filter (`aria-pressed`, not colour alone). */
export function FilterPills<T extends string>({ values, value, onChange, label, groupLabel }: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={groupLabel} className="flex flex-wrap items-center gap-1.5">
      {values.map((option) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-brand bg-brand/10 font-medium text-brand-dark dark:text-brand-light'
                : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}
