import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TraceIndex } from '../../../shared/traceability/traceQueries';
import { isDeleted } from '../../../shared/traceability/traceQueries';
import type { LineageRow } from '../../../shared/traceability/lineage';
import { describeRow, partsLabel } from './lineageLabels';

/** Indentation per depth of a row inside its card (Tailwind needs the class names spelled out). */
const ROW_INDENT = ['pl-1', 'pl-5', 'pl-9', 'pl-12', 'pl-16'];

interface LineageRowViewProps {
  index: TraceIndex;
  row: LineageRow;
  root: boolean;
  selected: boolean;
  anchor: (element: HTMLElement | null) => void;
  onSelect: () => void;
  onToggle: () => void;
}

/** One row of a lineage card: its fold button, its name (which selects it) and its out-of-date mark. */
export const LineageRowView: React.FC<LineageRowViewProps> = ({ index, row, root, selected, anchor, onSelect, onToggle }) => {
  const { t, i18n } = useTranslation();
  const { subject, depth } = row;
  const header = depth === 0;
  const { label, subtitle } = describeRow(t, index, row, i18n.language);
  const deleted = subject.kind === 'artifact' && isDeleted(index, subject.id);
  return (
    <div
      ref={anchor}
      className={cn(
        'flex items-center gap-1 pr-2',
        ROW_INDENT[Math.min(depth, ROW_INDENT.length - 1)],
        header ? 'border-b border-border py-1.5 last:border-b-0' : 'py-0.5',
        selected && 'bg-brand/10',
        root && 'ring-2 ring-inset ring-brand',
      )}
    >
      {row.parts > 0 ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={row.expanded}
          aria-label={t(row.expanded ? 'traceability.lineage.collapse' : 'traceability.lineage.expand', { name: label })}
          className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </button>
      ) : (
        <span className="w-[18px] shrink-0" aria-hidden />
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          'min-w-0 flex-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          header ? 'text-sm font-semibold' : 'text-xs',
          selected && 'text-brand-dark dark:text-brand-light',
        )}
      >
        <span
          className={cn('block truncate', deleted ? 'text-muted-foreground line-through' : !row.traced && 'italic text-muted-foreground')}
          title={row.traced ? undefined : t('traceability.lineage.untraced')}
        >
          {label}
        </span>
        {subtitle && <span className="block truncate text-[10px] font-normal uppercase text-muted-foreground">{subtitle}</span>}
      </button>
      {row.parts > 0 && !row.expanded && (
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">{partsLabel(t, subject, row.parts)}</span>
      )}
      {row.outOfDate && (
        <AlertTriangle className="size-3.5 shrink-0 text-warning" role="img" aria-label={t('traceability.status.outOfDate')} />
      )}
    </div>
  );
};
