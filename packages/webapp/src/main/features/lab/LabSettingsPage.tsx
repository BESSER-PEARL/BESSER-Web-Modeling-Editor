import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { CircleAlert, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { inputBaseClass } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  getLabAudit,
  getLabSettings,
  refreshLabBases,
  type LabAuditEntry,
  type LabAuditResponse,
  type LabMeter,
  type LabSettingsResponse,
} from '../../shared/api/lab';
import { reportError } from '../../shared/services/errors/reportError';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';
import { useLabShell } from './LabAuthGate';
import { formatAgo, formatUsd, LabListSkeleton } from './LabChangeList';
import { meterLevel } from './LabHeader';
import { LabMemoryPanel } from './LabMemoryPanel';

/** Audit entries per page of the Activity card (D4 "Settings and usage"). */
export const AUDIT_PAGE_SIZE = 50;
/** Months the Activity selector offers, counting the current one: a year of history is what a review looks back on. */
const ACTIVITY_MONTHS = 12;
/** Shown commit id length, as git's short form. */
const SHORT_SHA = 7;

const METER_BAR: Record<ReturnType<typeof meterLevel>, string> = {
  ok: 'bg-brand',
  warn: 'bg-warning',
  full: 'bg-destructive',
};

/** `YYYY-MM` of `count` months back from `month` (`YYYY-MM`), newest first. */
function monthsBack(month: string, count: number): string[] {
  const [year, index] = month.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(year, index - 1 - i, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** "November 2026" for `2026-11`. */
function monthLabel(month: string, locale?: string): string {
  const [year, index] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, index - 1, 1)),
  );
}

/** One card of the page: a mono kicker, a heading, an optional action, and its content. */
const SettingsCard: React.FC<{
  testId: string;
  kicker: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ testId, kicker, title, action, children, className }) => (
  <section
    data-testid={testId}
    aria-label={title}
    className={cn('lab-rise rounded-2xl border border-border bg-card p-5 sm:p-6', className)}
  >
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="ui-kicker text-brand">{kicker}</p>
        <h2 className="mt-1 font-display text-2xl tracking-tight text-foreground">{title}</h2>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const RepositoriesCard: React.FC<{
  settings: LabSettingsResponse;
  onRefreshed: (settings: LabSettingsResponse) => void;
}> = ({ settings, onRefreshed }) => {
  const { t, i18n } = useTranslation();
  const { session, reloadHome } = useLabShell();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await refreshLabBases(session);
      onRefreshed(next);
      toast.success(t('lab.settings.refreshed', { defaultValue: 'The base branches are up to date.' }));
      // The header shows the base commits from the home's data.
      reloadHome().catch((error: unknown) => console.warn('[lab] reading the home after a base refresh failed', error));
    } catch (error) {
      reportError(
        t('lab.settings.refreshFailed', {
          defaultValue: 'The base branches could not be refreshed: {{error}}',
          error: describeNetworkError(error),
        }),
        { error },
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SettingsCard
      testId="lab-settings-repositories"
      kicker={t('lab.settings.repos.kicker', { defaultValue: 'REPOSITORIES' })}
      title={t('lab.settings.repos.title', { defaultValue: 'Where changes start from' })}
      className="lab-d2"
      action={
        <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          {t('lab.settings.repos.refresh', { defaultValue: 'Refresh now' })}
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-medium">{t('lab.settings.repos.repo', { defaultValue: 'Repository' })}</th>
              <th className="py-2 pr-4 font-medium">
                {t('lab.settings.repos.upstream', { defaultValue: 'Upstream' })}
              </th>
              <th className="py-2 pr-4 font-medium">
                {t('lab.settings.repos.branch', { defaultValue: 'Base branch' })}
              </th>
              <th className="py-2 pr-4 font-medium">
                {t('lab.settings.repos.commit', { defaultValue: 'Base commit' })}
              </th>
              <th className="py-2 font-medium">{t('lab.settings.repos.fetched', { defaultValue: 'Fetched' })}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {settings.bases.map((base) => {
              const fetched = base.fetchedAt > 0 ? formatAgo(base.fetchedAt, i18n.language) : null;
              return (
                <tr key={base.repo} data-testid="lab-settings-base">
                  <td className="py-2.5 pr-4 font-medium text-foreground">
                    {t(`lab.repos.${base.repo}`, { defaultValue: base.repo })}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="flex flex-wrap items-center gap-2">
                      <a
                        href={`https://github.com/${base.upstream}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-primary underline-offset-2 hover:underline"
                      >
                        {base.upstream}
                      </a>
                      {base.fork && (
                        <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 font-mono text-[11px] text-warning">
                          {t('lab.settings.repos.fork', { defaultValue: 'fork' })}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 font-mono text-xs">{base.branch}</td>
                  <td className="py-2.5 pr-4 font-mono text-xs" title={base.sha}>
                    {base.sha.slice(0, SHORT_SHA)}
                  </td>
                  <td className="py-2.5 text-xs text-muted-foreground">
                    {fetched ? (
                      <time dateTime={new Date(base.fetchedAt * 1000).toISOString()} title={fetched.exact}>
                        {fetched.ago}
                      </time>
                    ) : (
                      t('lab.settings.repos.never', { defaultValue: 'never' })
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {t('lab.settings.repos.footnote', {
          defaultValue: 'Set by BESSER_LAB_REPO_* on the server. Changes keep the base they started from.',
        })}
      </p>
    </SettingsCard>
  );
};

/** Spent, reserved and cap of one monthly meter, with a bar of spent and reserved. */
const MeterRow: React.FC<{ label: string; meter: LabMeter; testId: string }> = ({ label, meter, testId }) => {
  const { t, i18n } = useTranslation();
  const usd = (value: number) => formatUsd(value, i18n.language);
  const share = (value: number) => Math.min(100, meter.capUsd > 0 ? (value / meter.capUsd) * 100 : 100);
  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {t('lab.settings.usage.meter', {
            defaultValue: '{{spent}} spent · {{reserved}} reserved · of {{cap}}',
            spent: usd(meter.spentUsd),
            reserved: usd(meter.reservedUsd),
            cap: usd(meter.capUsd),
          })}
        </span>
      </div>
      <span aria-hidden className="flex h-2 overflow-hidden rounded-full bg-muted">
        <span className={cn('h-full', METER_BAR[meterLevel(meter)])} style={{ width: `${share(meter.spentUsd)}%` }} />
        <span
          className="h-full bg-brand/30"
          style={{ width: `${Math.max(0, share(meter.spentUsd + meter.reservedUsd) - share(meter.spentUsd))}%` }}
        />
      </span>
    </div>
  );
};

const UsageCard: React.FC<{ settings: LabSettingsResponse; audit: LabAuditResponse }> = ({ settings, audit }) => {
  const { t, i18n } = useTranslation();
  const usd = (value: number) => formatUsd(value, i18n.language);
  const { limits } = settings;
  const spenders = Object.entries(audit.totalsByLogin).sort(([, a], [, b]) => b - a);
  const limitRows: [string, string][] = [
    [t('lab.settings.limits.perRun', { defaultValue: 'Per run' }), usd(limits.perRunUsd)],
    [t('lab.settings.limits.perUser', { defaultValue: 'Per person a month' }), usd(limits.userMonthlyUsd)],
    [t('lab.settings.limits.instance', { defaultValue: 'The lab a month' }), usd(limits.instanceMonthlyUsd)],
    [t('lab.settings.limits.runs', { defaultValue: 'Runs at once' }), String(limits.maxConcurrentRuns)],
    [t('lab.settings.limits.slots', { defaultValue: 'Preview slots' }), String(limits.previewSlots)],
    [
      t('lab.settings.limits.refresh', { defaultValue: 'Base refresh' }),
      limits.baseRefreshMinutes > 0
        ? t('lab.settings.limits.refreshEvery', {
            defaultValue: 'Every {{minutes}} min',
            minutes: limits.baseRefreshMinutes,
          })
        : t('lab.settings.limits.refreshManual', { defaultValue: 'By hand and when a change starts' }),
    ],
    [
      t('lab.settings.limits.admins', { defaultValue: 'Administrators' }),
      settings.admins.length > 0
        ? settings.admins.map((login) => `@${login}`).join(', ')
        : t('lab.settings.limits.noAdmins', { defaultValue: 'none' }),
    ],
  ];

  return (
    <SettingsCard
      testId="lab-settings-usage"
      kicker={t('lab.settings.usage.kicker', { defaultValue: 'USAGE' })}
      title={t('lab.settings.usage.title', {
        defaultValue: 'This month, {{month}}',
        month: monthLabel(settings.meters.month, i18n.language),
      })}
      className="lab-d3"
    >
      <div className="flex flex-col gap-4">
        <MeterRow
          testId="lab-settings-meter-user"
          label={t('lab.settings.usage.you', { defaultValue: 'You' })}
          meter={settings.meters.user}
        />
        <MeterRow
          testId="lab-settings-meter-instance"
          label={t('lab.settings.usage.lab', { defaultValue: 'The lab' })}
          meter={settings.meters.instance}
        />
      </div>

      {settings.linkMode === 'hardlink' && (
        <Alert variant="warning" data-testid="lab-settings-hardlink" className="mt-5">
          <TriangleAlert aria-hidden />
          <AlertDescription>
            {t('lab.settings.usage.hardlink', {
              defaultValue:
                'This server has no copy-on-write file system, so changes share node_modules and Python environment files through hard links. In-place writes into node_modules or a venv can reach other changes.',
            })}
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {t('lab.settings.usage.byLogin', { defaultValue: 'Spent by each person' })}
          </h3>
          {spenders.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('lab.settings.usage.noSpending', { defaultValue: 'No runs this month.' })}
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {spenders.map(([login, spent]) => (
                  <tr key={login} data-testid="lab-settings-spent-row">
                    <td className="py-1.5 pr-4 text-foreground">@{login}</td>
                    <td className="py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                      {usd(spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            {t('lab.settings.limits.title', { defaultValue: 'Limits (set on the server)' })}
          </h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {limitRows.map(([label, value]) => (
              <React.Fragment key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-mono text-xs tabular-nums text-foreground">{value}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      </div>
    </SettingsCard>
  );
};

function useAuditLabels() {
  const { t } = useTranslation();
  const action = (entry: LabAuditEntry): string => {
    switch (entry.action) {
      case 'change_created':
        return t('lab.settings.action.changeCreated', { defaultValue: 'Change created' });
      case 'change_opened':
        return t('lab.settings.action.changeOpened', { defaultValue: 'Change opened' });
      case 'run':
        return t('lab.settings.action.run', { defaultValue: 'Run' });
      case 'run_refused':
        return t('lab.settings.action.runRefused', { defaultValue: 'Run refused' });
      case 'pull_requests_opened':
        return t('lab.settings.action.pullRequests', { defaultValue: 'Pull requests opened' });
      case 'change_closed':
        return t('lab.settings.action.changeClosed', { defaultValue: 'Change closed' });
      case 'change_dropped':
        return t('lab.settings.action.changeDropped', { defaultValue: 'Change dropped' });
      case 'base_updated':
        return t('lab.settings.action.baseUpdated', { defaultValue: 'Updated from base' });
      case 'bases_refreshed':
        return t('lab.settings.action.basesRefreshed', { defaultValue: 'Bases refreshed' });
      case 'preview_slot_taken':
        return t('lab.settings.action.previewSlot', { defaultValue: 'Preview slot taken' });
    }
  };
  const result = (entry: LabAuditEntry): string => {
    switch (entry.stopReason) {
      case 'completed':
        return t('lab.settings.result.completed', { defaultValue: 'Completed' });
      case 'cancelled':
        return t('lab.settings.result.cancelled', { defaultValue: 'Stopped' });
      case 'timeout':
        return t('lab.settings.result.timeout', { defaultValue: 'Stopped at the time limit' });
      case 'cost_cap':
        return t('lab.settings.result.costCap', { defaultValue: 'Stopped at the cost cap' });
      case 'max_turns':
        return t('lab.settings.result.maxTurns', { defaultValue: 'Stopped at the turn limit' });
      case 'api_error':
        return t('lab.settings.result.apiError', { defaultValue: 'Model provider failed' });
      case null:
        return entry.detail;
    }
  };
  const step = (entry: LabAuditEntry): string => {
    if (entry.step === 'plan') return t('lab.settings.step.plan', { defaultValue: 'Plan' });
    if (entry.step === 'build') return t('lab.settings.step.build', { defaultValue: 'Build' });
    return '';
  };
  return { action, result, step };
}

type AuditState =
  | { status: 'loading' }
  | { status: 'ready'; audit: LabAuditResponse }
  | { status: 'failed'; error: string };

const ActivityCard: React.FC<{ current: LabAuditResponse }> = ({ current }) => {
  const { t, i18n } = useTranslation();
  const { session } = useLabShell();
  const labels = useAuditLabels();
  const [month, setMonth] = useState(current.month);
  const [state, setState] = useState<AuditState>({ status: 'ready', audit: current });
  const [page, setPage] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setPage(0);
    if (month === current.month) {
      setState({ status: 'ready', audit: current });
      return;
    }
    let cancelled = false;
    setState({ status: 'loading' });
    getLabAudit(session, month).then(
      (audit) => !cancelled && setState({ status: 'ready', audit }),
      (error: unknown) => !cancelled && setState({ status: 'failed', error: describeNetworkError(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [month, current, session, attempt]);

  const entries = useMemo(
    () => (state.status === 'ready' ? [...state.audit.entries].sort((a, b) => b.at - a.at) : []),
    [state],
  );
  const pages = Math.max(1, Math.ceil(entries.length / AUDIT_PAGE_SIZE));
  const shown = entries.slice(page * AUDIT_PAGE_SIZE, (page + 1) * AUDIT_PAGE_SIZE);

  return (
    <SettingsCard
      testId="lab-settings-activity"
      kicker={t('lab.settings.activity.kicker', { defaultValue: 'ACTIVITY' })}
      title={t('lab.settings.activity.title', { defaultValue: 'What happened in the lab' })}
      className="lab-d4"
      action={
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          {t('lab.settings.activity.month', { defaultValue: 'Month' })}
          <select
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className={cn(inputBaseClass, 'h-9 w-44 py-1')}
          >
            {monthsBack(current.month, ACTIVITY_MONTHS).map((value) => (
              <option key={value} value={value}>
                {monthLabel(value, i18n.language)}
              </option>
            ))}
          </select>
        </label>
      }
    >
      {state.status === 'loading' && <LabListSkeleton testId="lab-settings-activity-loading" />}
      {state.status === 'failed' && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {t('lab.settings.activity.error', {
              defaultValue: 'The activity could not be read: {{error}}',
              error: state.error,
            })}
            <Button variant="outline" size="xs" onClick={() => setAttempt((n) => n + 1)}>
              {t('lab.settings.retry', { defaultValue: 'Try again' })}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {state.status === 'ready' &&
        (entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t('lab.settings.activity.empty', { defaultValue: 'Nothing happened in this month.' })}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-3 font-medium">
                      {t('lab.settings.activity.time', { defaultValue: 'Time' })}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t('lab.settings.activity.login', { defaultValue: 'Login' })}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t('lab.settings.activity.action', { defaultValue: 'Action' })}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t('lab.settings.activity.change', { defaultValue: 'Change' })}
                    </th>
                    <th className="py-2 pr-3 font-medium">
                      {t('lab.settings.activity.step', { defaultValue: 'Step' })}
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">
                      {t('lab.settings.activity.cost', { defaultValue: 'Cost' })}
                    </th>
                    <th className="py-2 font-medium">
                      {t('lab.settings.activity.result', { defaultValue: 'Result' })}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {shown.map((entry, index) => {
                    const when = formatAgo(entry.at, i18n.language);
                    return (
                      <tr key={`${entry.at}-${entry.runId ?? index}`} data-testid="lab-settings-audit-row">
                        <td className="whitespace-nowrap py-2 pr-3 text-xs text-muted-foreground">
                          <time dateTime={new Date(entry.at * 1000).toISOString()} title={when.exact}>
                            {when.ago}
                          </time>
                        </td>
                        <td className="py-2 pr-3">@{entry.login}</td>
                        <td className="py-2 pr-3">{labels.action(entry)}</td>
                        <td className="py-2 pr-3 font-mono text-xs">
                          {entry.changeId && (
                            <Link
                              to={`/c/${entry.changeId}`}
                              className="text-primary underline-offset-2 hover:underline"
                            >
                              {entry.changeId}
                            </Link>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-xs">{labels.step(entry)}</td>
                        <td className="py-2 pr-3 text-right font-mono text-xs tabular-nums">
                          {entry.costUsd !== null ? formatUsd(entry.costUsd, i18n.language) : ''}
                        </td>
                        <td
                          className="max-w-[16rem] truncate py-2 text-xs text-muted-foreground"
                          title={labels.result(entry)}
                        >
                          {labels.result(entry)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center justify-end gap-3 text-xs text-muted-foreground">
              <span className="tabular-nums">
                {t('lab.settings.activity.range', {
                  defaultValue: '{{from}}–{{to}} of {{total}}',
                  from: page * AUDIT_PAGE_SIZE + 1,
                  to: page * AUDIT_PAGE_SIZE + shown.length,
                  total: entries.length,
                })}
              </span>
              <Button variant="outline" size="xs" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                {t('lab.settings.activity.newer', { defaultValue: 'Newer' })}
              </Button>
              <Button variant="outline" size="xs" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                {t('lab.settings.activity.older', { defaultValue: 'Older' })}
              </Button>
            </div>
          </>
        ))}
    </SettingsCard>
  );
};

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; settings: LabSettingsResponse; audit: LabAuditResponse }
  | { status: 'failed'; error: string };

/**
 * Settings and usage at `/settings` (D4 "Settings and usage"): the repositories changes start from,
 * this month's spending and the lab's limits, the audit log by month, and the team notes.
 */
export const LabSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { session } = useLabShell();
  const [state, setState] = useState<PageState>({ status: 'loading' });

  const load = useCallback(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    Promise.all([getLabSettings(session), getLabAudit(session)]).then(
      ([settings, audit]) => !cancelled && setState({ status: 'ready', settings, audit }),
      (error: unknown) => !cancelled && setState({ status: 'failed', error: describeNetworkError(error) }),
    );
    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => load(), [load]);

  const setSettings = (settings: LabSettingsResponse) =>
    setState((s) => (s.status === 'ready' ? { ...s, settings } : s));

  return (
    <div className="mx-auto w-full max-w-[56rem] px-6 py-8">
      <header className="lab-rise lab-d1 mb-8">
        <p className="ui-kicker text-brand">{t('lab.app.signIn.kicker', { defaultValue: 'BESSER FORGE' })}</p>
        <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-foreground">
          <Trans
            i18nKey="lab.settings.heading"
            defaults="Settings and <em>usage</em>"
            components={{ em: <em className="text-primary" /> }}
          />
        </h1>
      </header>

      <div className="flex flex-col gap-6">
        {state.status === 'loading' && <LabListSkeleton testId="lab-settings-loading" />}
        {state.status === 'failed' && (
          <Alert variant="destructive" data-testid="lab-settings-error">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t('lab.settings.error', {
                defaultValue: 'The settings could not be read: {{error}}',
                error: state.error,
              })}
              <Button variant="outline" size="xs" onClick={load}>
                {t('lab.settings.retry', { defaultValue: 'Try again' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {state.status === 'ready' && (
          <>
            <RepositoriesCard settings={state.settings} onRefreshed={setSettings} />
            <UsageCard settings={state.settings} audit={state.audit} />
            <ActivityCard current={state.audit} />
          </>
        )}
        <SettingsCard
          testId="lab-settings-notes"
          kicker={t('lab.settings.notes.kicker', { defaultValue: 'TEAM NOTES' })}
          title={t('lab.settings.notes.title', { defaultValue: 'What the lab agent remembers' })}
          className="lab-d4"
        >
          <LabMemoryPanel githubSession={session} />
        </SettingsCard>
      </div>
    </div>
  );
};

export default LabSettingsPage;
