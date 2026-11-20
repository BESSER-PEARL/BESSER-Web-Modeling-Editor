import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypeTag } from './TypeTag';

/** A row of the list: a choice, or a heading that groups the choices after it. */
export type ComboItem =
  | { kind: 'heading'; key: string; label: string; /** 1: a section, 2: a group inside one. */ level: 1 | 2 }
  | {
      kind: 'option';
      value: string;
      label: string;
      /** Muted, at the right (a kind, a time). */
      detail?: string;
      /** Extra text the search matches (a path, a type). */
      keywords?: string;
      indent?: boolean;
      emphasis?: boolean;
    };

type Option = Extract<ComboItem, { kind: 'option' }>;

interface SearchableComboboxProps {
  items: ComboItem[];
  value: string;
  onChange: (value: string) => void;
  /** What the closed box shows. */
  valueLabel: string;
  label: string;
  searchPlaceholder: string;
  emptyText: string;
  /** "{{count}} more: refine the search" when the list is cut short. */
  moreText: (count: number) => string;
  className?: string;
}

/** At most this many choices are rendered at once: the search narrows a long list. */
const MAX_SHOWN = 250;

const matches = (option: Option, needle: string) =>
  !needle || `${option.label} ${option.detail ?? ''} ${option.keywords ?? ''}`.toLowerCase().includes(needle);

/** The items to show for a search: matching choices, under the headings that hold one. */
export function filterComboItems(items: ComboItem[], query: string): ComboItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return items;
  const result: ComboItem[] = [];
  let section: ComboItem | null = null;
  let group: ComboItem | null = null;
  for (const item of items) {
    if (item.kind === 'heading') {
      if (item.level === 1) {
        section = item;
        group = null;
      } else group = item;
      continue;
    }
    if (!matches(item, needle)) continue;
    if (section) result.push(section);
    if (group) result.push(group);
    section = null;
    group = null;
    result.push(item);
  }
  return result;
}

/**
 * A button that opens a searchable list (the ARIA combobox pattern): type to narrow the list, arrow keys
 * to move, Enter to choose, Escape to close. Made for long lists, where a plain select is unusable.
 */
export const SearchableCombobox: React.FC<SearchableComboboxProps> = ({
  items, value, onChange, valueLabel, label, searchPlaceholder, emptyText, moreText, className,
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => filterComboItems(items, query), [items, query]);
  const shownItems = useMemo(() => {
    let options = 0;
    return filtered.filter((item) => item.kind === 'heading' || (options += 1) <= MAX_SHOWN);
  }, [filtered]);
  const options = useMemo(() => shownItems.filter((item): item is Option => item.kind === 'option'), [shownItems]);
  const hidden = filtered.filter((item) => item.kind === 'option').length - options.length;

  // Opening starts on the current choice; a new search on the first match.
  useEffect(() => {
    if (open) setActive(value);
  }, [open, value]);
  useEffect(() => {
    if (query) setActive(options[0]?.value ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new search moves the active row
  }, [query]);
  useEffect(() => {
    if (!open || !active) return;
    const node = [...(list.current?.querySelectorAll<HTMLElement>('[data-value]') ?? [])].find((n) => n.dataset.value === active);
    node?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const close = () => {
    setOpen(false);
    setQuery('');
    trigger.current?.focus();
  };
  const choose = (next: string) => {
    onChange(next);
    close();
  };
  const move = (step: number) => {
    if (options.length === 0) return;
    const at = options.findIndex((option) => option.value === active);
    const next = at < 0 ? (step > 0 ? 0 : options.length - 1) : Math.min(options.length - 1, Math.max(0, at + step));
    setActive(options[next].value);
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    else if (event.key === 'PageDown') move(10);
    else if (event.key === 'PageUp') move(-10);
    else if (event.key === 'Enter' && active) choose(active);
    else if (event.key === 'Escape') close();
    else return;
    event.preventDefault();
    event.stopPropagation(); // Escape closes the list, not the full-screen view around it
  };
  const optionId = (optionValue: string) => `${id}-option-${options.findIndex((o) => o.value === optionValue)}`;

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${valueLabel}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-sm transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{valueLabel}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-60" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[min(26rem,90vw)] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={active && options.some((o) => o.value === active) ? optionId(active) : undefined}
              aria-label={label}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full border-0 bg-transparent text-sm shadow-none outline-none ring-0 placeholder:text-muted-foreground focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
            />
          </div>
          <ul ref={list} id={`${id}-list`} role="listbox" aria-label={label} className="max-h-[min(60vh,26rem)] overflow-y-auto p-1">
            {options.length === 0 && <li role="presentation" className="px-2 py-6 text-center text-sm text-muted-foreground">{emptyText}</li>}
            {shownItems.map((item) =>
              item.kind === 'heading' ? (
                <li
                  key={`h-${item.key}`}
                  role="presentation"
                  className={
                    item.level === 1
                      ? 'px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1'
                      : 'pb-0.5 pl-4 pr-2 pt-1.5 text-xs font-medium text-muted-foreground'
                  }
                >
                  {item.label}
                </li>
              ) : (
                <li
                  key={item.value}
                  id={optionId(item.value)}
                  role="option"
                  aria-selected={item.value === value}
                  data-value={item.value}
                  data-active={item.value === active || undefined}
                  onPointerMove={() => setActive(item.value)}
                  onClick={() => choose(item.value)}
                  className={cn(
                    'flex cursor-pointer items-baseline gap-2 rounded-sm py-1.5 pr-2 text-sm',
                    item.indent ? 'pl-9' : 'pl-2',
                    item.emphasis && 'font-medium',
                    item.value === active && 'bg-accent text-accent-foreground',
                  )}
                >
                  <Check className={cn('size-3.5 shrink-0 self-center', item.value === value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.detail && <TypeTag>{item.detail}</TypeTag>}
                </li>
              ),
            )}
            {hidden > 0 && <li role="presentation" className="px-2 py-2 text-xs text-muted-foreground">{moreText(hidden)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
};
