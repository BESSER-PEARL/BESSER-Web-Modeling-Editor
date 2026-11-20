import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { LabChangeSummary, LabPhase, LabPullRequest } from '../../shared/api/lab';
import { formatWhen } from '../../shared/components/github/CommitAuthor';

/** Money as the lab shows it: `$1.82`, and `$75` for a whole amount. */
export function formatUsd(usd: number, locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(usd) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(usd);
}

/** "2 hours ago" for a time in seconds since the epoch, and its absolute form for a tooltip. */
export function formatAgo(epochSeconds: number, locale?: string): { ago: string; exact: string } {
  const date = new Date(epochSeconds * 1000);
  return { ago: formatWhen(date.toISOString(), locale), exact: date.toLocaleString(locale) };
}

/** A GitHub avatar, 20 px. */
export const LabAvatar: React.FC<{ login: string; className?: string }> = ({ login, className }) => (
  <img
    src={`https://github.com/${encodeURIComponent(login)}.png?size=40`}
    alt=""
    width={20}
    height={20}
    loading="lazy"
    className={cn('size-5 shrink-0 rounded-full bg-muted', className)}
  />
);

/** One label per phase; `running` names its minutes when `runStartedAt` is given. */
export function usePhaseLabel() {
  const { t } = useTranslation();
  return (phase: LabPhase, runStartedAt?: number | null): string => {
    switch (phase) {
      case 'draft':
        return t('lab.app.phase.draft', { defaultValue: 'Draft' });
      case 'planned':
        return t('lab.app.phase.planned', { defaultValue: 'Plan ready' });
      case 'running': {
        if (!runStartedAt) return t('lab.app.phase.running', { defaultValue: 'Running' });
        const minutes = Math.max(0, Math.floor((Date.now() / 1000 - runStartedAt) / 60));
        return t('lab.app.phase.runningFor', { defaultValue: 'Running {{minutes}} min', minutes });
      }
      case 'built':
        return t('lab.app.phase.built', { defaultValue: 'Built' });
      case 'checks_failing':
        return t('lab.app.phase.checksFailing', { defaultValue: 'Checks failing' });
      case 'stopped':
        return t('lab.app.phase.stopped', { defaultValue: 'Stopped early' });
      case 'in_review':
        return t('lab.app.phase.inReview', { defaultValue: 'In review' });
      case 'merged':
        return t('lab.app.phase.merged', { defaultValue: 'Merged' });
      case 'closed':
        return t('lab.app.phase.closed', { defaultValue: 'Closed' });
    }
  };
}

/** The pill colours of each phase. */
export const PHASE_TONE: Record<LabPhase, string> = {
  draft: 'border-border bg-muted text-muted-foreground',
  planned: 'border-brand/30 bg-brand/10 text-primary',
  running: 'border-brand/40 bg-brand/15 text-primary',
  built: 'border-success/30 bg-success/10 text-success',
  checks_failing: 'border-destructive/30 bg-destructive/10 text-destructive',
  stopped: 'border-warning/40 bg-warning/10 text-warning',
  in_review: 'border-info/30 bg-info/10 text-info',
  merged: 'border-success/30 bg-success/10 text-success',
  closed: 'border-border bg-muted text-muted-foreground',
};

/** A small rounded label (a phase, a kind). */
export const Pill: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => (
  <span className={cn('inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', className)}>
    {children}
  </span>
);

/** `#812 ↗` links to a change's pull requests; they sit above the row's own link. */
const PullRequestLinks: React.FC<{ pullRequests: LabPullRequest[] }> = ({ pullRequests }) => (
  <>
    {pullRequests.map((pr) => (
      <a
        key={`${pr.repo}#${pr.number}`}
        href={pr.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative z-[2] whitespace-nowrap font-mono text-xs text-primary underline-offset-2 hover:underline"
      >
        #{pr.number} ↗
      </a>
    ))}
  </>
);

/** Arrow keys move between the rows' links (each row is one tab stop). */
function onRowKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a[data-row-link]'));
  const index = links.indexOf(document.activeElement as HTMLAnchorElement);
  if (index < 0) return;
  event.preventDefault();
  links[Math.min(links.length - 1, Math.max(0, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
}

/** Three placeholder rows while the list loads. */
export const LabListSkeleton: React.FC<{ testId?: string }> = ({ testId }) => (
  <ul data-testid={testId} aria-hidden className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
    {[0, 1, 2].map((i) => (
      <li key={i} className="flex h-16 items-center gap-4 px-4">
        <span className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        <span className="h-3 w-16 animate-pulse rounded bg-muted" />
        <span className="ml-auto h-3 w-20 animate-pulse rounded bg-muted" />
      </li>
    ))}
  </ul>
);

const ChangeRow: React.FC<{ change: LabChangeSummary }> = ({ change }) => {
  const { t, i18n } = useTranslation();
  const phaseLabel = usePhaseLabel();
  const updated = formatAgo(change.updatedAt, i18n.language);
  const behind = Object.values(change.behind).reduce((sum, n) => sum + n, 0);
  const running = change.run !== null;
  return (
    <li
      data-testid="lab-change-row"
      data-running={running || undefined}
      className="group relative flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3 transition-colors duration-150 hover:bg-muted/40 focus-within:bg-muted/40"
    >
      {running && <span aria-hidden className="lab-shimmer absolute inset-y-0 left-0 w-1" />}
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
        <Link
          to={`/c/${change.changeId}`}
          data-row-link
          className="truncate font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
        >
          {change.title || t('lab.app.changes.untitled', { defaultValue: 'New change' })}
        </Link>
        <Pill className="border-border bg-background font-mono text-muted-foreground">
          {t(`lab.kinds.${change.kind}`, { defaultValue: change.kind.replace('_', ' ') })}
        </Pill>
        {behind > 0 && (
          <span
            className="size-2 shrink-0 rounded-full bg-warning"
            title={t('lab.app.changes.behind', {
              defaultValue: 'Its base branch moved {{count}} commits',
              defaultValue_one: 'Its base branch moved 1 commit',
              count: behind,
            })}
            aria-label={t('lab.app.changes.behind', {
              defaultValue: 'Its base branch moved {{count}} commits',
              defaultValue_one: 'Its base branch moved 1 commit',
              count: behind,
            })}
            role="img"
          />
        )}
      </div>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LabAvatar login={change.owner} />@{change.owner}
      </span>
      <Pill className={PHASE_TONE[change.phase]}>{phaseLabel(change.phase, change.run?.startedAt)}</Pill>
      <span className="flex flex-wrap gap-1">
        {change.repos.map((repo) => (
          <Pill key={repo} className="border-border bg-background text-muted-foreground">
            {t(`lab.repos.${repo}`, { defaultValue: repo })}
          </Pill>
        ))}
      </span>
      <PullRequestLinks pullRequests={change.pullRequests} />
      <span className="ml-auto flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
        <span>{formatUsd(change.cost.usd, i18n.language)}</span>
        <time dateTime={new Date(change.updatedAt * 1000).toISOString()} title={updated.exact}>
          {updated.ago}
        </time>
      </span>
    </li>
  );
};

/** The open changes and drafts, everyone's or the user's own. */
export const LabChangeList: React.FC<{ changes: LabChangeSummary[]; login: string }> = ({ changes, login }) => {
  const { t } = useTranslation();
  const [mine, setMine] = useState(false);
  const shown = mine ? changes.filter((change) => change.owner === login) : changes;
  return (
    <section aria-labelledby="lab-open-changes" data-testid="lab-open-changes">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id="lab-open-changes" className="text-sm font-semibold text-foreground">
          {t('lab.app.changes.open', { defaultValue: 'Open changes' })}{' '}
          <span className="font-normal tabular-nums text-muted-foreground">{changes.length}</span>
        </h2>
        <div role="group" aria-label={t('lab.app.changes.filter', { defaultValue: 'Whose changes' })} className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          {[false, true].map((value) => (
            <button
              key={String(value)}
              type="button"
              aria-pressed={mine === value}
              onClick={() => setMine(value)}
              className={cn(
                'rounded-md px-2.5 py-1 font-medium transition-colors duration-150',
                mine === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {value
                ? t('lab.app.changes.mine', { defaultValue: 'Mine' })
                : t('lab.app.changes.everyone', { defaultValue: 'Everyone' })}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {mine && changes.length > 0
            ? t('lab.app.changes.noneMine', { defaultValue: 'You have no open changes.' })
            : t('lab.app.changes.none', { defaultValue: 'No open changes. Describe the first one above.' })}
        </p>
      ) : (
        <ul onKeyDown={onRowKeyDown} className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {shown.map((change) => (
            <ChangeRow key={change.changeId} change={change} />
          ))}
        </ul>
      )}
    </section>
  );
};

/** Closed changes, newest first: merged ones with when, closed unmerged ones marked. Hidden when there are none. */
export const LabClosedChangeList: React.FC<{ changes: LabChangeSummary[] }> = ({ changes }) => {
  const { t, i18n } = useTranslation();
  if (changes.length === 0) return null;
  return (
    <section aria-labelledby="lab-closed-changes" data-testid="lab-closed-changes">
      <h2 id="lab-closed-changes" className="mb-3 text-sm font-semibold text-foreground">
        {t('lab.app.changes.merged', { defaultValue: 'Recently merged' })}
      </h2>
      <ul onKeyDown={onRowKeyDown} className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {changes.map((change) => {
          const closed = change.closedAt ? formatAgo(change.closedAt, i18n.language) : null;
          const others = change.requestedBy.filter((login) => login !== change.owner);
          return (
            <li
              key={change.changeId}
              data-testid="lab-closed-row"
              className="relative flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/40 focus-within:bg-muted/40"
            >
              <Link
                to={`/c/${change.changeId}`}
                data-row-link
                className="min-w-0 flex-1 basis-56 truncate text-sm font-medium text-foreground after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-primary"
              >
                {change.title}
              </Link>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LabAvatar login={change.owner} />@{change.owner}
                {others.length > 0 && (
                  <span>
                    {t('lab.app.changes.with', { defaultValue: 'with {{logins}}', logins: others.map((l) => `@${l}`).join(', ') })}
                  </span>
                )}
              </span>
              <PullRequestLinks pullRequests={change.pullRequests} />
              <span className="ml-auto flex items-center gap-4 text-xs tabular-nums text-muted-foreground">
                {change.outcome === 'merged' ? (
                  closed && (
                    <time dateTime={new Date(change.closedAt! * 1000).toISOString()} title={closed.exact}>
                      {t('lab.app.changes.mergedAgo', { defaultValue: 'merged {{ago}}', ago: closed.ago })}
                    </time>
                  )
                ) : (
                  <Pill className={PHASE_TONE.closed}>{t('lab.app.phase.closed', { defaultValue: 'Closed' })}</Pill>
                )}
                <span>{formatUsd(change.cost.usd, i18n.language)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
