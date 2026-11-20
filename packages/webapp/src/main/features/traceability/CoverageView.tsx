import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { CoverageCell, CoverageRow, TraceIndex } from '../../shared/traceability/traceQueries';
import { coverageMatrix, topLevelOf } from '../../shared/traceability/traceQueries';
import { elementTypeLabel, formatTime, operationLabel } from './traceLabels';
import { toggledIn } from './components/toggleSet';
import { TypeTag } from './components/TypeTag';

/** Columns shown: the newest generation runs; older ones stay in the timeline. */
const MAX_GENERATION_COLUMNS = 8;

const CELL_STYLES: Record<CoverageCell, string> = {
  generated: 'bg-success/15 text-success',
  outOfDate: 'bg-warning/15 text-warning ring-1 ring-inset ring-warning/30',
  none: 'text-muted-foreground/50',
};
const CELL_ICONS: Record<CoverageCell, React.ReactNode> = {
  generated: <Check className="size-3.5" strokeWidth={2.5} />,
  outOfDate: <AlertTriangle className="size-3.5" />,
  none: <Minus className="size-3.5" />,
};

interface CoverageViewProps {
  index: TraceIndex;
  onOpenElement: (artifactId: string) => void;
  /** An artifact to point out (a link from the assistant's answer): the row of its top-level element is
   *  highlighted, its diagram unfolded and the row scrolled into view. */
  highlightId?: string | null;
}

/**
 * Diagrams and their elements × generation runs: generated, generated but out of date since,
 * or not generated. A diagram's own row covers the whole files read from it.
 */
export const CoverageView: React.FC<CoverageViewProps> = ({ index, onOpenElement, highlightId = null }) => {
  const { t, i18n } = useTranslation();
  const matrix = useMemo(() => coverageMatrix(index, MAX_GENERATION_COLUMNS), [index]);
  // The row of the highlighted artifact: its own, or its top-level element's (a member has no row).
  const highlighted = useMemo(() => {
    const artifact = highlightId ? index.artifacts.get(highlightId) : undefined;
    return artifact ? topLevelOf(index, artifact).id : null;
  }, [index, highlightId]);
  const highlightRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    highlightRef.current?.scrollIntoView?.({ block: 'center' });
  }, [highlighted]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setCollapsed((previous) => toggledIn(previous, id));
  const [query, setQuery] = useState('');
  const needle = useDeferredValue(query.trim().toLowerCase());
  // A diagram whose name matches keeps all its elements; otherwise only the matching elements show.
  const groups = useMemo(() => {
    if (!needle) return matrix.groups;
    const hit = (row: CoverageRow) =>
      row.element.name.toLowerCase().includes(needle) || elementTypeLabel(t, row.element.elementType).toLowerCase().includes(needle);
    return matrix.groups.flatMap((group) => {
      if (hit(group.diagram)) return [group];
      const elements = group.elements.filter(hit);
      return elements.length > 0 ? [{ ...group, elements }] : [];
    });
  }, [matrix, needle, t]);

  if (matrix.generations.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.coverage.noGenerations')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {(['generated', 'outOfDate', 'none'] as const).map((cell) => (
          <span key={cell} className="flex items-center gap-1">
            <span aria-hidden className={`inline-flex size-5 items-center justify-center rounded-md ${CELL_STYLES[cell]}`}>{CELL_ICONS[cell]}</span>
            {t(`traceability.coverage.legend.${cell}`)}
          </span>
        ))}
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('traceability.coverage.search')}
          aria-label={t('traceability.coverage.search')}
          className="h-8 w-full sm:ml-auto sm:w-64"
        />
      </div>
      {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('traceability.coverage.noMatch')}</p>}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-xs">
              <th scope="col" className="min-w-[18rem] px-3 py-2.5 font-medium text-muted-foreground">{t('traceability.coverage.element')}</th>
              {matrix.generations.map((generation) => (
                <th key={generation.id} scope="col" className="min-w-[6.5rem] px-2 py-2.5 text-center font-medium">
                  <div>{operationLabel(t, generation, index)}</div>
                  <div className="font-normal tabular-nums text-muted-foreground">{formatTime(generation.startedAt, i18n.language)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(({ diagram, elements }) => {
              const open = needle !== '' || !collapsed.has(diagram.element.id)
                || (highlighted !== null && elements.some((row) => row.element.id === highlighted));
              return (
                <React.Fragment key={diagram.element.id}>
                  <CoverageTableRow
                    row={diagram}
                    onOpen={onOpenElement}
                    highlighted={diagram.element.id === highlighted}
                    rowRef={diagram.element.id === highlighted ? highlightRef : undefined}
                    lead={
                      <button
                        type="button"
                        onClick={() => toggle(diagram.element.id)}
                        aria-label={t(open ? 'traceability.elements.collapse' : 'traceability.elements.expand', {
                          name: diagram.element.name,
                        })}
                        aria-expanded={open}
                        className="mr-1 inline-flex size-5 items-center justify-center rounded align-middle text-muted-foreground hover:text-foreground"
                      >
                        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    }
                    className="bg-muted/30 [&>th]:font-semibold"
                  />
                  {open &&
                    elements.map((row) => (
                      <CoverageTableRow
                        key={row.element.id}
                        row={row}
                        onOpen={onOpenElement}
                        highlighted={row.element.id === highlighted}
                        rowRef={row.element.id === highlighted ? highlightRef : undefined}
                        className="[&>th:first-child]:pl-10"
                      />
                    ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface CoverageTableRowProps {
  row: CoverageRow;
  onOpen: (artifactId: string) => void;
  /** Shown before the name (the diagram rows' fold button). */
  lead?: React.ReactNode;
  /** The row pointed out by a link (see `CoverageViewProps.highlightId`). */
  highlighted?: boolean;
  rowRef?: React.Ref<HTMLTableRowElement>;
  className?: string;
}

const CoverageTableRow: React.FC<CoverageTableRowProps> = ({ row, onOpen, lead, highlighted = false, rowRef, className = '' }) => {
  const { t } = useTranslation();
  const { element, deleted, cells } = row;
  return (
    <tr
      ref={rowRef}
      aria-current={highlighted ? 'true' : undefined}
      className={`border-t border-border/70 transition-colors hover:bg-muted/30 ${highlighted ? 'bg-brand/10 ring-1 ring-inset ring-brand/40' : ''} ${className}`}
    >
      <th scope="row" className="px-3 py-1.5 text-left font-normal">
        {lead}
        <button
          type="button"
          onClick={() => onOpen(element.id)}
          className={`rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${deleted ? 'text-muted-foreground line-through' : ''}`}
        >
          {element.name}
        </button>
        <TypeTag className="ml-2">{elementTypeLabel(t, element.elementType)}</TypeTag>
      </th>
      {cells.map((cell, i) => (
        <td key={i} className="px-2 py-1.5 text-center">
          <span
            title={t(`traceability.coverage.legend.${cell}`)}
            className={`inline-flex size-6 items-center justify-center rounded-md ${CELL_STYLES[cell]}`}
          >
            <span aria-hidden>{CELL_ICONS[cell]}</span>
            <span className="sr-only">{t(`traceability.coverage.legend.${cell}`)}</span>
          </span>
        </td>
      ))}
    </tr>
  );
};
