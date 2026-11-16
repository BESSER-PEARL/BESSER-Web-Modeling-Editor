import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { TraceIndex } from '../../../shared/traceability/traceQueries';
import type { LineageBundle, LineageLayout, LineageRow } from '../../../shared/traceability/lineage';
import { pathTo } from '../../../shared/traceability/lineage';
import { EVIDENCE_STROKES, OUT_OF_DATE_STROKE, bundleLook, formatConfidence, hasPill, isAiEdge, lookOf } from './lineageLook';
import { LineageRowView } from './LineageRowView';
import type { LineageSelection } from './types';
import { useConnectorLayout } from './useConnectorLayout';

interface LineageGraphProps {
  index: TraceIndex;
  layout: LineageLayout;
  root: string | null;
  selected: LineageSelection | null;
  zoom: number;
  onSelectNode: (row: LineageRow) => void;
  onSelectEdge: (linkId: string) => void;
  onToggle: (artifactId: string) => void;
  onExpand: (subjectIds: string[]) => void;
}

/** The lineage canvas: cards in columns, connectors between their rows, and pills on the connectors. */
export const LineageGraph: React.FC<LineageGraphProps> = ({
  index, layout, root, selected, zoom, onSelectNode, onSelectEdge, onToggle, onExpand,
}) => {
  const { t } = useTranslation();
  const { content, register, connectors, size } = useConnectorLayout(layout, zoom);
  const rowsById = useMemo(
    () => new Map(layout.columns.flat().flatMap((card) => card.rows.map((row) => [row.subject.id, row] as const))),
    [layout],
  );

  const selectedNode = selected?.kind === 'node' ? selected.id : null;
  const isSelectedEdge = (bundle: LineageBundle) => selected?.kind === 'edge' && bundle.edges.some((e) => e.link.id === selected.id);
  const selectedLink =
    selected?.kind === 'edge' ? layout.bundles.flatMap((b) => b.edges).find((e) => e.link.id === selected.id)?.link : undefined;
  // With a row selected, its links stand out and the others fade.
  const touches = (bundle: LineageBundle) => selectedNode !== null && (bundle.sourceId === selectedNode || bundle.targetId === selectedNode);
  const faded = (bundle: LineageBundle) =>
    selected?.kind === 'edge' ? !isSelectedEdge(bundle) : selectedNode !== null && rowsById.has(selectedNode) && !touches(bundle);

  return (
    <div className="relative h-full min-h-0 overflow-auto rounded-lg border border-border bg-muted/20">
      <div style={{ width: size.width * zoom, height: size.height * zoom }}>
        {/* Zoom scales the drawing; its size and the connector positions are measured, hence inline styles. */}
        <div ref={content} className="relative w-max p-6" style={{ transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
          <svg className="pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible" aria-hidden>
            {connectors.map(({ bundle, path }) => {
              const look = bundleLook(bundle.edges);
              const confidence = look.link.confidence?.value ?? 1;
              const emphasis = isSelectedEdge(bundle) || touches(bundle) ? 1.6 : 1;
              return (
                <g key={bundle.key}>
                  <path
                    d={path}
                    fill="none"
                    strokeWidth={(1 + 2.5 * confidence) * emphasis * (bundle.edges.length > 1 ? 1.3 : 1)}
                    strokeOpacity={faded(bundle) ? 0.15 : 0.35 + 0.65 * confidence}
                    strokeDasharray={lookOf(look) === 'upstreamChanged' ? '6 4' : undefined}
                    className={lookOf(look) === 'upToDate' ? EVIDENCE_STROKES[look.link.evidence[0]?.type ?? 'RuleEvidence'] : OUT_OF_DATE_STROKE}
                  />
                  {/* A wide invisible hit area. Keyboard users reach the same link from the overview's list of
                      links or from either end's list of links. */}
                  <path
                    d={path}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={10}
                    className="pointer-events-auto cursor-pointer"
                    onClick={() => onSelectEdge(look.link.id)}
                  >
                    <title>{t('traceability.lineage.linkTitle')}</title>
                  </path>
                </g>
              );
            })}
          </svg>
          <div className="relative flex items-start gap-32">
            {layout.columns.map((cards, column) => (
              <div key={column} className="flex w-64 flex-col gap-4">
                {cards.map((card) => (
                  <div key={card.subject.id} className="rounded-md border border-border bg-card shadow-sm">
                    {card.rows.map((row) => (
                      <LineageRowView
                        key={row.subject.id}
                        index={index}
                        row={row}
                        root={row.subject.id === root}
                        selected={row.subject.id === selectedNode}
                        anchor={register(row.subject.id)}
                        onSelect={() => onSelectNode(row)}
                        onToggle={() => onToggle(row.subject.id)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Pills sit on the connectors that have something to say: how many links a bundle holds, an AI
              decision, a confidence below certain, or a link that may not hold. A plain rule link needs none. */}
          {connectors.filter(({ bundle }) => hasPill(bundle) || isSelectedEdge(bundle)).map(({ bundle, mid }) => {
            const look = bundleLook(bundle.edges);
            const bundled = bundle.edges.length > 1;
            const stale = lookOf(look) !== 'upToDate';
            // A bundle opens everything that holds its links' ends, so each link gets its own connector.
            const openable = [
              ...new Set(bundle.edges.flatMap((e) => [...pathTo(index, e.link.sourceId), ...pathTo(index, e.link.targetId)])),
            ].filter((id) => !rowsById.get(id)?.expanded);
            return (
              <button
                key={bundle.key}
                type="button"
                onClick={() => (bundled && openable.length > 0 ? onExpand(openable) : onSelectEdge(look.link.id))}
                title={bundled ? t('traceability.lineage.expandBundle', { count: bundle.edges.length }) : t('traceability.lineage.linkTitle')}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-1.5 text-[10px] font-medium tabular-nums shadow-sm',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  faded(bundle) && 'opacity-40',
                  isSelectedEdge(bundle)
                    ? 'border-brand bg-brand text-white'
                    : stale
                      ? 'border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                      : 'border-border bg-background',
                )}
                style={{ left: mid.x, top: mid.y }}
              >
                {/* Not by colour alone: a mark for a link that may not hold, a word for an AI decision. */}
                {stale && <span aria-hidden>⚠ </span>}
                {!bundled && isAiEdge(look) && `${t('traceability.lineage.legend.ai')} `}
                {bundled ? `×${bundle.edges.length}` : formatConfidence(look.link.confidence?.value)}
                {/* The selected link's own value, when it sits in a bundle. */}
                {bundled && selectedLink && bundle.edges.some((e) => e.link.id === selectedLink.id) &&
                  ` · ${formatConfidence(selectedLink.confidence?.value)}`}
                {stale && <span className="sr-only">{t('traceability.status.outOfDate')}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
