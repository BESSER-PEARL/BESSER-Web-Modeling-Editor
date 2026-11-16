import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FileWarning, Link2, ListTree, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { TraceSummary } from '../../shared/traceability/traceSummary';
import { formatTime } from './traceLabels';

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'success';
  hint?: string;
}

const Stat: React.FC<StatProps> = ({ icon, label, value, tone = 'default', hint }) => (
  <div
    className={cn(
      'flex min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 shadow-sm',
      tone === 'warning' ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-border',
    )}
    title={hint}
  >
    <div
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md',
        tone === 'warning'
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          : tone === 'success'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
            : 'bg-brand/10 text-brand-dark dark:text-brand-light',
      )}
      aria-hidden
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-lg font-semibold leading-tight tabular-nums">{value.toLocaleString()}</div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
    </div>
  </div>
);

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
    <section aria-label={t('traceability.summary.label')} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Workflow className="size-4" />} label={t('traceability.summary.operations', { count: summary.operations })} value={summary.operations} />
        <Stat icon={<ListTree className="size-4" />} label={t('traceability.summary.artifacts', { count: summary.artifacts })} value={summary.artifacts} />
        <Stat
          icon={<Link2 className="size-4" />}
          label={t('traceability.summary.links', { count: summary.links })}
          value={summary.links}
          hint={t('traceability.summary.linksHint')}
        />
        <Stat
          icon={stale ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
          label={t('traceability.summary.outOfDate', { count: summary.outOfDateLinks })}
          value={summary.outOfDateLinks}
          tone={stale ? 'warning' : 'success'}
        />
      </div>
      {summary.staleGenerators.length > 0 && (
        <ul className="divide-y divide-amber-500/20 overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/[0.06]">
          {summary.staleGenerators.map((entry) => (
            <li key={entry.operation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
              <FileWarning className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium">
                  {t('traceability.summary.staleFiles', {
                    generator: entry.tool?.name ?? t('traceability.summary.unknownGenerator'),
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
              <Button size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={onShowOutOfDate}>
                {t('traceability.summary.showCoverage')}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
