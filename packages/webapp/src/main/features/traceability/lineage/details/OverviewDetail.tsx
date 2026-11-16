import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import type { TraceIndex } from '../../../../shared/traceability/traceQueries';
import type { Lineage, LineageBundle, LineageLayout } from '../../../../shared/traceability/lineage';
import { runOfSubjectId } from '../../../../shared/traceability/lineage';
import { formatTime, operationLabel } from '../../traceLabels';
import { bundleLook, lookOf } from '../lineageLook';
import { nodeLabel } from '../lineageLabels';
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
  const subjectLabel = (id: string) => {
    const run = runOfSubjectId(index, id);
    if (run) return `${operationLabel(t, run, index)} · ${formatTime(run.startedAt, i18n.language)}`;
    const artifact = index.artifacts.get(id);
    return artifact ? nodeLabel(t, index, artifact) : id;
  };
  const describe = (bundle: LineageBundle) => `${subjectLabel(bundle.sourceId)} → ${subjectLabel(bundle.targetId)}`;
  return (
    <DetailPane>
      <h3 className="font-semibold">{t('traceability.lineage.overviewTitle')}</h3>
      <p className="text-xs text-muted-foreground">
        {t('traceability.lineage.overviewCounts', { cards: layout.columns.flat().length, links: lineage.edges.length })}
      </p>
      {outdated > 0 && (
        <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-300">
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
                      <span className="w-[45%] shrink-0 truncate text-muted-foreground">{subjectLabel(bundle.sourceId)}</span>
                      <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{subjectLabel(bundle.targetId)}</span>
                    </span>
                    {bundle.edges.length > 1 && <span className="shrink-0 tabular-nums text-muted-foreground">×{bundle.edges.length}</span>}
                    {stale && (
                      <AlertTriangle className="size-3 shrink-0 text-amber-500" role="img" aria-label={t('traceability.status.outOfDate')} />
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
