import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Atom,
  Bot,
  Command,
  FileCode2,
  FileJson2,
  Layers3,
  Network,
  PackageOpen,
  Repeat2,
  Search,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { Z_INDEX } from '../../constants/z-index';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CommandAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  category: 'Editors' | 'Navigation' | 'Actions';
  onSelect: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actions: CommandAction[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const modKey = isMac ? '\u2318' : 'Ctrl';

/** Simple case-insensitive substring match. */
function fuzzyMatch(query: string, label: string): boolean {
  if (!query) return true;
  return label.toLowerCase().includes(query.toLowerCase());
}

const CATEGORY_ORDER: CommandAction['category'][] = ['Editors', 'Navigation', 'Actions'];

/* ------------------------------------------------------------------ */
/*  Keyboard shortcut hook                                             */
/* ------------------------------------------------------------------ */

/**
 * Registers Ctrl+K / Cmd+K globally to open the command palette.
 * Should be called once in the component that owns the open state.
 */
export function useCommandPaletteShortcut(onOpen: () => void) {
  const handler = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    },
    [onOpen],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange, actions }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter actions by query
  const filtered = useMemo(
    () => actions.filter((a) => fuzzyMatch(query, a.label)),
    [query, actions],
  );

  // Group by category, preserving category order
  const grouped = useMemo(() => {
    const map = new Map<string, CommandAction[]>();
    for (const cat of CATEGORY_ORDER) {
      const items = filtered.filter((a) => a.category === cat);
      if (items.length > 0) map.set(cat, items);
    }
    return map;
  }, [filtered]);

  // Flat list of visible items (for keyboard navigation indexing)
  const flatItems = useMemo(() => {
    const items: CommandAction[] = [];
    for (const group of grouped.values()) {
      items.push(...group);
    }
    return items;
  }, [grouped]);

  // Reset state when opening / closing
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      // Small delay so the DOM is painted before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Keep selectedIndex in bounds when filtered list changes
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(flatItems.length - 1, 0)));
  }, [flatItems.length]);

  // Scroll the active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector('[data-active="true"]') as HTMLElement | null;
    active?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  const handleSelect = useCallback(
    (action: CommandAction) => {
      close();
      // Run callback after closing so dialogs opened by the action don't collide
      requestAnimationFrame(() => action.onSelect());
    },
    [close],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % flatItems.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [flatItems, selectedIndex, handleSelect, close],
  );

  if (!open) return null;

  let runningIndex = 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 flex items-start justify-center pt-[15vh]"
      style={{ zIndex: Z_INDEX.MODAL }}
      onClick={close}
      onKeyDown={handleKeyDown}
    >
      {/* Blur overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[6px] dark:bg-black/60" />

      {/* Palette card */}
      <div
        className="relative z-10 flex w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25)] dark:border-slate-700/70 dark:bg-slate-900 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/60">
          <Search className="size-5 shrink-0 text-slate-400 dark:text-slate-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            aria-label="Search commands"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden rounded-md border border-slate-200/80 bg-slate-100/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 sm:inline-flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto overscroll-contain p-2">
          {flatItems.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
              No matching commands
            </div>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => {
              const categoryNode = (
                <div key={category}>
                  <div className="mb-1 mt-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 first:mt-0 dark:text-slate-500">
                    {category}
                  </div>
                  {items.map((action) => {
                    const itemIndex = runningIndex++;
                    const isActive = itemIndex === selectedIndex;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        data-active={isActive}
                        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                          isActive
                            ? 'bg-brand/10 text-brand-dark dark:bg-brand/20 dark:text-brand'
                            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                        }`}
                        onClick={() => handleSelect(action)}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                      >
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-brand/15 text-brand dark:bg-brand/25'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {action.icon}
                        </span>
                        <span className="flex-1 truncate">{action.label}</span>
                        {action.shortcut && (
                          <kbd className="ml-auto shrink-0 rounded-md border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500">
                            {action.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
              return categoryNode;
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t border-slate-200/80 px-4 py-2 dark:border-slate-700/60">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <kbd className="inline-flex h-4 items-center rounded border border-slate-200/80 bg-slate-100/80 px-1 font-mono text-[9px] dark:border-slate-700 dark:bg-slate-800">
              &uarr;
            </kbd>
            <kbd className="inline-flex h-4 items-center rounded border border-slate-200/80 bg-slate-100/80 px-1 font-mono text-[9px] dark:border-slate-700 dark:bg-slate-800">
              &darr;
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <kbd className="inline-flex h-4 items-center rounded border border-slate-200/80 bg-slate-100/80 px-1 font-mono text-[9px] dark:border-slate-700 dark:bg-slate-800">
              &crarr;
            </kbd>
            Select
          </span>
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Command className="size-3" />
            {modKey}+K
          </span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Default action builder                                             */
/* ------------------------------------------------------------------ */

const ICON_SIZE = 'size-4';

interface BuildActionsOptions {
  onSwitchToClassDiagram: () => void;
  onSwitchToStateMachine: () => void;
  onSwitchToObjectDiagram: () => void;
  onSwitchToGUIEditor: () => void;
  onSwitchToAgentDiagram: () => void;
  onSwitchToQuantumCircuit: () => void;
  onGoToSettings: () => void;
  onExportJSON: () => void;
  onExportBUML: () => void;
  onQualityCheck: () => void;
}

/**
 * Builds the default set of command-palette actions.
 * Kept as a factory so the host component can supply its own callbacks.
 */
export function buildDefaultActions(opts: BuildActionsOptions): CommandAction[] {
  return [
    // ── Editors ─────────────────────────────────────────────────────
    {
      id: 'switch-class',
      label: 'Switch to Class Diagram',
      icon: <Network className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToClassDiagram,
    },
    {
      id: 'switch-state',
      label: 'Switch to State Machine',
      icon: <Repeat2 className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToStateMachine,
    },
    {
      id: 'switch-object',
      label: 'Switch to Object Diagram',
      icon: <Layers3 className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToObjectDiagram,
    },
    {
      id: 'switch-gui',
      label: 'Switch to GUI Editor',
      icon: <PackageOpen className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToGUIEditor,
    },
    {
      id: 'switch-agent',
      label: 'Switch to Agent Diagram',
      icon: <Bot className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToAgentDiagram,
    },
    {
      id: 'switch-quantum',
      label: 'Switch to Quantum Circuit',
      icon: <Atom className={ICON_SIZE} />,
      category: 'Editors',
      onSelect: opts.onSwitchToQuantumCircuit,
    },
    // ── Navigation ──────────────────────────────────────────────────
    {
      id: 'go-settings',
      label: 'Go to Settings',
      icon: <Settings className={ICON_SIZE} />,
      category: 'Navigation',
      onSelect: opts.onGoToSettings,
    },
    {
      id: 'go-quality-check',
      label: 'Go to Quality Check',
      icon: <ShieldCheck className={ICON_SIZE} />,
      category: 'Navigation',
      onSelect: opts.onQualityCheck,
    },
    // ── Actions ─────────────────────────────────────────────────────
    {
      id: 'export-json',
      label: 'Export as JSON',
      icon: <FileJson2 className={ICON_SIZE} />,
      category: 'Actions',
      onSelect: opts.onExportJSON,
    },
    {
      id: 'export-buml',
      label: 'Export as B-UML',
      icon: <FileCode2 className={ICON_SIZE} />,
      shortcut: `${modKey}+E`,
      category: 'Actions',
      onSelect: opts.onExportBUML,
    },
  ];
}
