import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { TraceIndex } from '../../../../shared/traceability/traceQueries';
import type { Lineage, LineageBundle, LineageLayout } from '../../../../shared/traceability/lineage';
import { runOfSubjectId } from '../../../../shared/traceability/lineage';
import { formatTime, operationLabel } from '../../traceLabels';
import { bundleLook, lookOf } from '../lineageLook';
import { cn } from '@/lib/utils';
import { TypeTag } from '../../components/TypeTag';
import { artifactKindLabel, cardCounts, nodeLabel } from '../lineageLabels';
import { DetailPane, DetailSection } from './DetailPane';

/** How many of the drawn connectors the overview lists. */
const LISTED_CONNECTORS = 40;

/** Shown while nothing is selected: what the lineage holds, how to explore it, and its connectors as a list. */
export const OverviewDetail: React.FC<{
  index: TraceIndex;
  lineage: Lineage;
  layout: LineageLayout;
  onSelectEdge: (linkId: string) => void;
}> = ({ index, lineage, layout, onSelectEdge }) => {
  const { t, i18n } = useTranslation();
  const outdated = lineage.edges.filter((e) => e.outOfDate.length > 0).length;
  // An end's name and what tells it apart from a namesake: a run's time, an artifact's kind ("books", association).
  const subjectParts = (id: string): { label: string; kind?: string; time?: string } => {
    const run = runOfSubjectId(index, id);
    if (run) return { label: operationLabel(t, run, index), time: formatTime(run.startedAt, i18n.language) };
    const artifact = index.artifacts.get(id);
    return artifact ? { label: nodeLabel(t, index, artifact), kind: artifactKindLabel(t, artifact) } : { label: id };
  };
  const subjectText = (id: string) => {
    const { label, kind, time } = subjectParts(id);
    return time ? `${label} · ${time}` : kind ? `${label} (${kind})` : label;
  };
  const describe = (bundle: LineageBundle) => `${subjectText(bundle.sourceId)} → ${subjectText(bundle.targetId)}`;
  const end = (id: string, className: string) => {
    const { label, kind, time } = subjectParts(id);
    return (
      <span className={cn('min-w-0', className)}>
        <span className="block truncate">{label}</span>
        {(kind ?? time) && <TypeTag className="block truncate">{kind ?? time}</TypeTag>}
      </span>
    );
  };
  return (
    <DetailPane>
      <h3 className="font-semibold">{t('traceability.lineage.overviewTitle')}</h3>
      <p className="text-xs text-muted-foreground">
        {t('traceability.lineage.overviewSummary', {
          cards: cardCounts(t, layout.columns.flat().map((card) => card.subject), i18n.language),
          count: lineage.edges.length,
        })}
      </p>
      {outdated > 0 && (
        <p className="flex items-start gap-1 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {t('traceability.lineage.overviewOutOfDate', { count: outdated })}
        </p>
      )}
      <p className="text-xs">{t('traceability.lineage.hint')}</p>
      {layout.bundles.length > 0 && (
        // The connectors as a list: the same links, reachable from the keyboard and by screen readers.
        <DetailSection title={t('traceability.lineage.connectors', { count: layout.bundles.length })}>
          <ul className="space-y-0.5 text-xs">
            {layout.bundles.slice(0, LISTED_CONNECTORS).map((bundle) => {
              const look = bundleLook(bundle.edges);
              const stale = lookOf(look) !== 'upToDate';
              const outOfDate = bundle.edges.filter((e) => lookOf(e) !== 'upToDate').length;
              return (
                <li key={bundle.key}>
                  <button
                    type="button"
                    onClick={() => onSelectEdge(look.link.id)}
                    className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="sr-only">{describe(bundle)}</span>
                    {/* Both ends stay readable: each is cut short on its own, the whole text is the tooltip. */}
                    <span aria-hidden className="flex min-w-0 flex-1 items-center gap-1" title={describe(bundle)}>
                      {end(bundle.sourceId, 'w-[45%] shrink-0 text-muted-foreground')}
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      {end(bundle.targetId, 'flex-1')}
                    </span>
                    {bundle.edges.length > 1 && <span className="shrink-0 tabular-nums text-muted-foreground">×{bundle.edges.length}</span>}
                    {stale && bundle.edges.length > 1 && (
                      // With ×N beside it, the mark says how many of the N may be out of date.
                      <span className="flex shrink-0 items-center gap-0.5 tabular-nums text-warning">
                        (<AlertTriangle className="size-3" aria-hidden />
                        {t('traceability.lineage.pillOutOfDate', { count: outOfDate })})
                      </span>
                    )}
                    {stale && bundle.edges.length === 1 && (
                      <AlertTriangle className="size-3 shrink-0 text-warning" role="img" aria-label={t('traceability.status.outOfDate')} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {layout.bundles.length > LISTED_CONNECTORS && (
            <p className="text-xs text-muted-foreground">{t('traceability.lineage.moreLinks', { count: layout.bundles.length - LISTED_CONNECTORS })}</p>
          )}
        </DetailSection>
      )}
    </DetailPane>
  );
};
