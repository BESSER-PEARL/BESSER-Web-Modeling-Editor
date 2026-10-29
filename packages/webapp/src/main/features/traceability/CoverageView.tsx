import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { CoverageCell, CoverageRow, TraceIndex } from '../../shared/traceability/traceQueries';
import { coverageMatrix } from '../../shared/traceability/traceQueries';
import { elementTypeLabel, formatTime, operationLabel } from './traceLabels';

/** Columns shown: the newest generation runs; older ones stay in the timeline. */
const MAX_GENERATION_COLUMNS = 8;

const CELL_STYLES: Record<CoverageCell, string> = {
  generated: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  suspect: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  none: 'text-muted-foreground',
};
const CELL_SYMBOLS: Record<CoverageCell, string> = { generated: '✓', suspect: '⚠', none: '–' };

interface CoverageViewProps {
  index: TraceIndex;
  onOpenElement: (artifactId: string) => void;
}

/**
 * Diagrams and their elements × generation runs: generated, generated but changed since (suspect),
 * or not generated. A diagram's own row covers the whole files read from it.
 */
export const CoverageView: React.FC<CoverageViewProps> = ({ index, onOpenElement }) => {
  const { t, i18n } = useTranslation();
  const matrix = useMemo(() => coverageMatrix(index, MAX_GENERATION_COLUMNS), [index]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (matrix.generations.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.coverage.noGenerations')}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(['generated', 'suspect', 'none'] as const).map((cell) => (
          <span key={cell} className="flex items-center gap-1">
            <span className={`inline-flex size-5 items-center justify-center rounded ${CELL_STYLES[cell]}`}>{CELL_SYMBOLS[cell]}</span>
            {t(`traceability.coverage.legend.${cell}`)}
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/60 text-left text-xs">
              <th className="px-3 py-2 font-medium">{t('traceability.coverage.element')}</th>
              {matrix.generations.map((generation) => (
                <th key={generation.id} className="px-2 py-2 text-center font-medium">
                  <div>{operationLabel(t, generation, index)}</div>
                  <div className="font-normal text-muted-foreground">{formatTime(generation.startedAt, i18n.language)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.groups.map(({ diagram, elements }) => {
              const open = !collapsed.has(diagram.element.id);
              return (
                <React.Fragment key={diagram.element.id}>
                  <CoverageTableRow
                    row={diagram}
                    onOpen={onOpenElement}
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
                    className="bg-muted/30 font-semibold"
                  />
                  {open &&
                    elements.map((row) => (
                      <CoverageTableRow key={row.element.id} row={row} onOpen={onOpenElement} className="[&>td:first-child]:pl-10" />
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
  className?: string;
}

const CoverageTableRow: React.FC<CoverageTableRowProps> = ({ row, onOpen, lead, className = '' }) => {
  const { t } = useTranslation();
  const { element, deleted, cells } = row;
  return (
    <tr className={`border-t border-border ${className}`}>
      <td className="px-3 py-1.5">
        {lead}
        <button
          type="button"
          onClick={() => onOpen(element.id)}
          className={`hover:underline ${deleted ? 'text-muted-foreground line-through' : ''}`}
        >
          {element.name}
        </button>
        <span className="ml-2 text-[10px] font-normal uppercase text-muted-foreground">{elementTypeLabel(t, element.elementType)}</span>
      </td>
      {cells.map((cell, i) => (
        <td key={i} className="px-2 py-1.5 text-center">
          <span
            title={t(`traceability.coverage.legend.${cell}`)}
            className={`inline-flex size-6 items-center justify-center rounded ${CELL_STYLES[cell]}`}
          >
            {CELL_SYMBOLS[cell]}
          </span>
        </td>
      ))}
    </tr>
  );
};
