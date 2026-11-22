import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, Link2, ListTree, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { TraceSummary } from '../../shared/traceability/traceSummary';
import { formatTime, generatorLabel } from './traceLabels';

interface FigureProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone?: 'default' | 'warning' | 'success';
}

const Figure: React.FC<FigureProps> = ({ icon, label, value, hint, tone = 'default' }) => {
  const { i18n } = useTranslation();
  return (
    <div className="flex min-w-0 items-center gap-3 px-3 py-3 sm:px-4" title={hint}>
      <span
        className={cn(
          'shrink-0',
          tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-muted-foreground',
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className={cn('text-xl font-semibold leading-none tracking-tight tabular-nums', tone === 'warning' && 'text-warning')}>
          {value.toLocaleString(i18n.language)}
        </div>
        <div className="mt-1 text-xs leading-snug text-muted-foreground">{label}</div>
      </div>
    </div>
  );
};

interface TraceSummaryHeaderProps {
  summary: TraceSummary;
  /** Opens the view that shows what is out of date (the Coverage matrix). */
  onShowOutOfDate: () => void;
}

/** The trace at a glance: what it holds, how much of it may no longer hold, and which generators to run again. */
export const TraceSummaryHeader: React.FC<TraceSummaryHeaderProps> = ({ summary, onShowOutOfDate }) => {
  const { t, i18n } = useTranslation();
  const stale = summary.outOfDateLinks > 0;
  return (
    <section aria-label={t('traceability.summary.label')} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* 1px gaps over the border colour draw the dividers, in two rows or one. */}
      <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4 [&>*]:bg-card">
        <Figure icon={<Workflow className="size-4" />} label={t('traceability.summary.operations', { count: summary.operations })} value={summary.operations} />
        <Figure icon={<ListTree className="size-4" />} label={t('traceability.summary.artifacts', { count: summary.artifacts })} value={summary.artifacts} />
        <Figure
          icon={<Link2 className="size-4" />}
          label={t('traceability.summary.links', { count: summary.links })}
          value={summary.links}
          hint={t('traceability.summary.linksHint')}
        />
        <Figure
          icon={stale ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
          label={t('traceability.summary.outOfDate', { count: summary.outOfDateLinks })}
          value={summary.outOfDateLinks}
          tone={stale ? 'warning' : 'success'}
        />
      </div>
      {summary.staleGenerators.length > 0 && (
        <ul className="divide-y divide-warning/15 border-t border-warning/25 bg-warning/[0.06]">
          {summary.staleGenerators.map((entry) => (
            <li key={entry.operation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
              <FileWarning className="size-4 shrink-0 text-warning" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {t('traceability.summary.staleFiles', {
                    generator: entry.tool ? generatorLabel(t, entry.tool.name) : t('traceability.summary.unknownGenerator'),
                    count: entry.files.length,
                  })}
                </span>
                <span className="text-muted-foreground">
                  {' — '}
                  {t('traceability.summary.regenerate', { time: formatTime(entry.operation.startedAt, i18n.language) })}
                </span>
                <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground" title={entry.files.map((f) => f.path).join('\n')}>
                  {entry.files.slice(0, 3).map((f) => f.path).join(', ')}
                  {entry.files.length > 3 && ` ${t('traceability.lineage.moreLinks', { count: entry.files.length - 3 })}`}
                </span>
              </span>
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-warning hover:bg-warning/10 hover:text-warning" onClick={onShowOutOfDate}>
                {t('traceability.summary.showCoverage')}
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
