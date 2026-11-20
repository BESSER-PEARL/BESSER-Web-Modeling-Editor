import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

interface PageTabsProps<T extends string> {
  /** Prefix of the tab and panel element ids (`<id>-tab-<value>`, `<id>-panel-<value>`). */
  id: string;
  tabs: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: (value: T) => React.ReactNode;
  ariaLabel: string;
  className?: string;
}

export const tabId = (id: string, value: string) => `${id}-tab-${value}`;
export const panelId = (id: string, value: string) => `${id}-panel-${value}`;

/**
 * A WAI-ARIA tab list: only the selected tab is in the Tab order; arrow keys, Home and End move between
 * tabs and select them. Pair it with a `TabPanel` per tab (or one for the selected tab).
 */
export function PageTabs<T extends string>({ id, tabs, value, onChange, label, ariaLabel, className }: PageTabsProps<T>) {
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const select = (next: T) => {
    onChange(next);
    refs.current.get(next)?.focus();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    const at = tabs.indexOf(value);
    const target =
      event.key === 'ArrowRight' ? tabs[(at + 1) % tabs.length]
      : event.key === 'ArrowLeft' ? tabs[(at - 1 + tabs.length) % tabs.length]
      : event.key === 'Home' ? tabs[0]
      : event.key === 'End' ? tabs[tabs.length - 1]
      : undefined;
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };
  return (
    <div role="tablist" aria-label={ariaLabel} onKeyDown={onKeyDown} className={cn('flex gap-1 overflow-x-auto border-b border-border', className)}>
      {tabs.map((tab) => {
        const selected = tab === value;
        return (
          <button
            key={tab}
            ref={(node) => {
              if (node) refs.current.set(tab, node);
              else refs.current.delete(tab);
            }}
            id={tabId(id, tab)}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId(id, tab)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab)}
            className={cn(
              '-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors',
              'focus-visible:rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
              selected ? 'border-brand font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label(tab)}
          </button>
        );
      })}
    </div>
  );
}

/** The panel of a tab, labelled by it. */
export const TabPanel: React.FC<{ id: string; value: string; children: React.ReactNode; className?: string }> = ({
  id, value, children, className,
}) => (
  <div role="tabpanel" id={panelId(id, value)} aria-labelledby={tabId(id, value)} tabIndex={0} className={cn('focus-visible:outline-none', className)}>
    {children}
  </div>
);
