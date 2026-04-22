import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { KG_NODE_TYPES } from './types';
import { KgShapeIcon } from './KgShapeIcon';
import type { KGNodeData, KGNodeType, KnowledgeGraphData } from './types';

interface Props {
  model: KnowledgeGraphData;
  visibleIds: string[];
  onToggle: (id: string, shouldBeVisible: boolean) => void;
  onBulkToggle: (ids: string[], shouldBeVisible: boolean) => void;
}

type TypeFilter = 'all' | KGNodeType;

/** Scrollable list of every node in the KG with a checkbox per row.
 *  Filters by node type and by label substring. Checking a box asks the
 *  parent to enable the node on the canvas; unchecking hides it. */
export const KnowledgeGraphNodeList: React.FC<Props> = ({ model, visibleIds, onToggle, onBulkToggle }) => {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');

  const visibleSet = useMemo(() => new Set(visibleIds), [visibleIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return model.nodes.filter((n) => {
      if (typeFilter !== 'all' && n.nodeType !== typeFilter) return false;
      if (!q) return true;
      const label = (n.label ?? '').toLowerCase();
      const iri = (n.iri ?? '').toLowerCase();
      const id = (n.id ?? '').toLowerCase();
      return label.includes(q) || iri.includes(q) || id.includes(q);
    });
  }, [model.nodes, typeFilter, query]);

  // Select-all state reflects the CURRENTLY FILTERED rows only.
  const selectedInFiltered = useMemo(
    () => filtered.reduce((acc, n) => (visibleSet.has(n.id) ? acc + 1 : acc), 0),
    [filtered, visibleSet],
  );
  const allSelected = filtered.length > 0 && selectedInFiltered === filtered.length;
  const someSelected = selectedInFiltered > 0 && selectedInFiltered < filtered.length;

  const headerCheckboxRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const toggleAll = () => {
    if (filtered.length === 0) return;
    // If everything visible in the list is already selected, unselect all
    // filtered rows; otherwise select all filtered rows.
    if (allSelected) {
      onBulkToggle(filtered.map((n) => n.id), false);
    } else {
      onBulkToggle(filtered.map((n) => n.id), true);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 border-t border-border/60 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nodes ({model.nodes.length})
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by label / IRI"
            className="h-7 pl-7 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          <TypeChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')} label="All" />
          {KG_NODE_TYPES.map((t) => (
            <TypeChip
              key={t.type}
              active={typeFilter === t.type}
              onClick={() => setTypeFilter(t.type)}
              label={t.label}
              icon={<KgShapeIcon type={t.type} size={12} />}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-2 py-1">
        <input
          ref={headerCheckboxRef}
          type="checkbox"
          className="size-3.5"
          checked={allSelected}
          disabled={filtered.length === 0}
          onChange={toggleAll}
          aria-label={allSelected ? 'Unselect all shown nodes' : 'Select all shown nodes'}
          title={allSelected ? 'Unselect all shown' : 'Select all shown'}
        />
        <span className="flex-1 truncate text-[11px] text-muted-foreground">
          {filtered.length === 0
            ? 'No nodes to show'
            : `${selectedInFiltered} of ${filtered.length} shown ${filtered.length === 1 ? 'node' : 'nodes'} selected`}
        </span>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] text-brand-dark underline-offset-2 hover:underline dark:text-brand"
          >
            {allSelected ? 'Unselect all' : 'Select all'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto rounded-md border border-border/50 bg-background">
        {filtered.length === 0 && (
          <div className="p-2 text-[11px] text-muted-foreground">No nodes match.</div>
        )}
        {filtered.map((n) => {
          const checked = visibleSet.has(n.id);
          return (
            <label
              key={n.id}
              className="flex cursor-pointer items-center gap-2 border-b border-border/40 px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/50"
              title={n.iri ?? n.id}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(n.id, e.target.checked)}
                className="size-3.5"
              />
              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                <KgShapeIcon type={n.nodeType} size={14} />
              </span>
              <span className="truncate">{rowLabel(n)}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

function rowLabel(n: KGNodeData): string {
  const raw = (n.label ?? '').trim();
  if (raw) return raw;
  if (n.nodeType === 'literal') return n.value?.toString() || '""';
  return n.id;
}

const TypeChip: React.FC<{
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}> = ({ active, onClick, label, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors ${
      active
        ? 'border-brand bg-brand/15 text-brand-dark dark:text-brand'
        : 'border-border/50 text-muted-foreground hover:bg-muted'
    }`}
  >
    {icon && <span className="inline-flex size-3 items-center justify-center">{icon}</span>}
    {label}
  </button>
);
