import React, { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, CircleDashed, GitFork, Shapes } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { TraceIndex } from '../../shared/traceability/traceQueries';
import { qualifiedName } from '../../shared/traceability/traceQueries';
import type { RequirementRow, RequirementStatus } from '../../shared/traceability/requirementCoverage';
import { requirementCoverage } from '../../shared/traceability/requirementCoverage';
import { elementTypeLabel, formatTime, requirementKindLabel } from './traceLabels';
import { FilterPills } from './components/FilterPills';
import { describeEvidence } from './lineage/lineageLabels';
import { formatConfidence } from './lineage/lineageLook';

type StatusFilter = 'all' | RequirementStatus;
const FILTERS: StatusFilter[] = ['all', 'uncovered', 'modeled', 'generated'];

const STATUS_ICONS: Record<RequirementStatus, React.ReactNode> = {
  generated: <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />,
  modeled: <Shapes className="size-3.5 text-sky-600 dark:text-sky-400" aria-hidden />,
  uncovered: <CircleDashed className="size-3.5 text-amber-600 dark:text-amber-400" aria-hidden />,
};

interface RequirementsViewProps {
  index: TraceIndex;
  onOpenElement: (artifactId: string) => void;
  onShowLineage: (artifactId: string) => void;
}

/**
 * Requirements × the model elements that realize them × the code generated from those elements, with the
 * confidence of any direct requirement -> code verdict. Requirements nothing realizes stand out.
 */
export const RequirementsView: React.FC<RequirementsViewProps> = ({ index, onOpenElement, onShowLineage }) => {
  const { t, i18n } = useTranslation();
  const coverage = useMemo(() => requirementCoverage(index), [index]);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const needle = useDeferredValue(query.trim().toLowerCase());

  const groups = useMemo(() => {
    const keep = (row: RequirementRow) =>
      (filter === 'all' || row.status === filter) &&
      (!needle ||
        `${row.requirement.name}\n${row.requirement.quote}\n${row.realizations.map((r) => r.element.name).join('\n')}\n${row.code.map((c) => c.file.path).join('\n')}`
          .toLowerCase()
          .includes(needle));
    return coverage.groups.map((group) => ({ ...group, rows: group.rows.filter(keep) })).filter((group) => group.rows.length > 0);
  }, [coverage, filter, needle]);

  if (coverage.groups.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t('traceability.requirements.empty')}</p>;
  }
  const total = coverage.counts.generated + coverage.counts.modeled + coverage.counts.uncovered;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <FilterPills
          values={FILTERS}
          value={filter}
          onChange={setFilter}
          label={(value) =>
            value === 'all'
              ? t('traceability.requirements.filters.all', { count: total })
              : t(`traceability.requirements.filters.${value}`, { count: coverage.counts[value] })
          }
          groupLabel={t('traceability.requirements.statusFilter')}
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('traceability.requirements.search')}
          aria-label={t('traceability.requirements.search')}
          className="h-8 w-full sm:ml-auto sm:w-72"
        />
      </div>

      {groups.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{t('traceability.requirements.noMatch')}</p>}

      {groups.map((group) => (
        <section key={group.extraction.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <header className="space-y-1 border-b border-border bg-muted/40 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">
                {t('traceability.requirements.extractedAt', { time: formatTime(group.extraction.startedAt, i18n.language) })}
              </h3>
              <Badge variant={group.current ? 'soft' : 'outline'} size="sm">
                {t(group.current ? 'traceability.requirements.current' : 'traceability.requirements.earlier')}
              </Badge>
            </div>
            {group.prompt && (
              <p className="line-clamp-2 text-xs text-muted-foreground" title={group.prompt.content}>
                “{group.prompt.content}”
              </p>
            )}
          </header>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-[34%] px-4 py-2 font-medium">{t('traceability.requirements.columns.requirement')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('traceability.requirements.columns.elements')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('traceability.requirements.columns.code')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('traceability.requirements.columns.verdict')}</th>
                  <th scope="col" className="w-10 px-3 py-2"><span className="sr-only">{t('traceability.lineage.show')}</span></th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <RequirementTableRow
                    key={row.requirement.id}
                    index={index}
                    row={row}
                    onOpenElement={onOpenElement}
                    onShowLineage={onShowLineage}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
};

const RequirementTableRow: React.FC<{
  index: TraceIndex;
  row: RequirementRow;
  onOpenElement: (artifactId: string) => void;
  onShowLineage: (artifactId: string) => void;
}> = ({ index, row, onOpenElement, onShowLineage }) => {
  const { t } = useTranslation();
  const { requirement, realizations, code, verdicts, status } = row;
  const uncovered = status === 'uncovered';
  return (
    <tr
      data-status={status}
      className={cn('border-t border-border align-top', uncovered && 'bg-amber-500/[0.07] shadow-[inset_3px_0_0_theme(colors.amber.500)]')}
    >
      <th scope="row" className="px-4 py-2.5 text-left font-normal">
        <div className="font-medium leading-snug">{requirement.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            {STATUS_ICONS[status]}
            {t(`traceability.requirements.status.${status}`)}
          </span>
          <span aria-hidden>·</span>
          <span>{requirementKindLabel(t, requirement.kind)}</span>
          {row.outOfDate && (
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-3" aria-hidden />
              {t('traceability.status.outOfDate')}
            </span>
          )}
        </div>
      </th>
      <td className="px-3 py-2.5">
        {realizations.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('traceability.requirements.noElements')}</span>
        ) : (
          <ul className="flex flex-wrap gap-1">
            {realizations.map(({ element, deleted }) => (
              <li key={element.id}>
                <button
                  type="button"
                  onClick={() => onOpenElement(element.id)}
                  title={elementTypeLabel(t, element.elementType)}
                  className={cn(
                    'rounded border border-border px-1.5 py-0.5 text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    deleted && 'text-muted-foreground line-through',
                  )}
                >
                  {qualifiedName(index, element)}
                  {deleted && <span className="sr-only"> ({t('traceability.elements.deleted')})</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2.5">
        {code.length === 0 ? (
          <span className="text-xs text-muted-foreground">{t('traceability.requirements.noCode')}</span>
        ) : (
          <ul className="space-y-0.5 text-xs">
            {code.slice(0, 4).map((entry) => (
              <li key={entry.code.id} className="flex items-center gap-1">
                <code className="truncate" title={entry.file.path}>
                  {entry.file.path}
                  {entry.code.startLine !== undefined && `:${entry.code.startLine}–${entry.code.endLine}`}
                </code>
                {entry.outOfDate.length > 0 && (
                  <AlertTriangle className="size-3 shrink-0 text-amber-500" role="img" aria-label={t('traceability.status.outOfDate')} />
                )}
              </li>
            ))}
            {code.length > 4 && <li className="text-muted-foreground">{t('traceability.lineage.moreLinks', { count: code.length - 4 })}</li>}
          </ul>
        )}
      </td>
      <td className="px-3 py-2.5 text-xs">
        {verdicts.length === 0 ? (
          <span className="text-muted-foreground">{t('traceability.requirements.noVerdict')}</span>
        ) : (
          <ul className="space-y-1">
            {verdicts.slice(0, 3).map((verdict) => (
              <li key={verdict.link.id}>
                <span className="font-medium tabular-nums">{formatConfidence(verdict.confidence?.value)}</span>
                <span className="text-muted-foreground"> · {verdict.evidence.map((e) => describeEvidence(t, e)).join('; ') || t('traceability.lineage.noEvidence')}</span>
                {verdict.confidence?.explanation && <p className="text-muted-foreground">{verdict.confidence.explanation}</p>}
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={() => onShowLineage(requirement.id)}
          aria-label={t('traceability.requirements.showLineage', { name: requirement.name })}
          title={t('traceability.lineage.show')}
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GitFork className="size-4" />
        </button>
      </td>
    </tr>
  );
};
