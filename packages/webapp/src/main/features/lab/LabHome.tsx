import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CircleAlert, Loader2, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { inputBaseClass } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  createLabChange,
  listLabIssues,
  type LabIssueOption,
  labRefusal,
  listLabChanges,
  type LabChangeSummary,
  type LabHomeResponse,
  type LabIssueRef,
  type LabRepoKey,
} from '../../shared/api/lab';
import type { LabStartState } from '../../shared/services/labSession';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';
import { useLabShell } from './LabAuthGate';
import { formatUsd, LabChangeList, LabClosedChangeList, LabListSkeleton } from './LabChangeList';

/** How often the home re-reads the changes and the meters while the page is visible. */
export const HOME_REFRESH_MS = 15_000;

const REPO_KEYS: LabRepoKey[] = ['besser', 'frontend', 'modeling_agent'];

/** The first day of the month after `month` (`YYYY-MM`), as "1 December" in `locale`. */
function nextMonthStart(month: string, locale?: string): string {
  const [year, index] = month.split('-').map(Number);
  // `index` is 1-based, so it is already next month's 0-based index.
  const date = new Date(Date.UTC(year, index, 1));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date);
}

/** Why a change cannot start now (a cap is spent or every run slot is taken), or null. */
function useStartBlock(home: LabHomeResponse, changes: LabChangeSummary[] | null): React.ReactNode | null {
  const { t, i18n } = useTranslation();
  const { meters, runs } = home;
  const usd = (value: number) => formatUsd(value, i18n.language);
  // The monthly caps hold back only what the lab's own key pays.
  if (home.labKey && meters.user.spentUsd + meters.user.reservedUsd >= meters.user.capUsd) {
    return t('lab.app.home.userCap', {
      defaultValue: 'You have used {{spent}} of your {{cap}} this month. Runs start again on {{date}}.',
      spent: usd(meters.user.spentUsd),
      cap: usd(meters.user.capUsd),
      date: nextMonthStart(meters.month, i18n.language),
    });
  }
  if (home.labKey && meters.instance.spentUsd + meters.instance.reservedUsd >= meters.instance.capUsd) {
    return t('lab.app.home.instanceCap', {
      defaultValue: 'The lab has used its {{cap}} for this month.',
      cap: usd(meters.instance.capUsd),
    });
  }
  if (runs.inProgress.length >= runs.cap) {
    const titleOf = (changeId: string) => changes?.find((c) => c.changeId === changeId)?.title || changeId;
    return (
      <>
        {t('lab.app.home.runsFull', {
          defaultValue: '{{count}} of {{cap}} runs are in progress. Start your change when one finishes.',
          count: runs.inProgress.length,
          cap: runs.cap,
        })}
        <ul className="mt-1 space-y-0.5">
          {runs.inProgress.map((run) => (
            <li key={run.runId}>
              {t('lab.app.home.runsFullItem', {
                defaultValue: '@{{login}}: {{title}}',
                login: run.login,
                title: titleOf(run.changeId),
              })}
            </li>
          ))}
        </ul>
      </>
    );
  }
  return null;
}

/** How long typing pauses before the issues are searched. */
const ISSUE_SEARCH_DELAY_MS = 300;

/** The composer: the first message of a new change, optionally from a GitHub issue. */
const Composer: React.FC<{ block: React.ReactNode | null }> = ({ block }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useLabShell();
  const [message, setMessage] = useState('');
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueRepo, setIssueRepo] = useState<LabRepoKey>('besser');
  // What is typed to find an issue: words of its title, or its number.
  const [issueQuery, setIssueQuery] = useState('');
  const [picked, setPicked] = useState<LabIssueOption | null>(null);
  const [options, setOptions] = useState<{ status: 'loading' | 'ready' | 'failed'; issues: LabIssueOption[]; error?: string }>({
    status: 'loading',
    issues: [],
  });
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The repository's open issues: the most recently updated, or those matching what is typed.
  useEffect(() => {
    if (!issueOpen || picked) return undefined;
    let cancelled = false;
    setOptions((previous) => ({ ...previous, status: 'loading' }));
    const timer = window.setTimeout(() => {
      listLabIssues(session, issueRepo, issueQuery.trim()).then(
        (issues) => !cancelled && setOptions({ status: 'ready', issues }),
        (error: unknown) => !cancelled && setOptions({ status: 'failed', issues: [], error: labRefusal(error).message }),
      );
    }, ISSUE_SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [issueOpen, issueRepo, issueQuery, picked, session]);

  // A number typed and not picked from the list is taken as the issue's number, as before the list existed.
  const typedNumber = /^#?\d+$/.test(issueQuery.trim()) ? Number(issueQuery.trim().replace('#', '')) : null;
  const issue: LabIssueRef | undefined = !issueOpen
    ? undefined
    : picked
      ? { repo: picked.repo, number: picked.number }
      : typedNumber
        ? { repo: issueRepo, number: typedNumber }
        : undefined;
  const canStart = message.trim() !== '' && !block && !starting;

  const pick = (option: LabIssueOption) => {
    setPicked(option);
    // An issue is a request of its own: with nothing written yet, the message asks for it.
    if (message.trim() === '') {
      setMessage(
        t('lab.app.home.issueMessage', {
          defaultValue: 'Fix issue #{{number}}: {{title}}',
          number: option.number,
          title: option.title,
        }),
      );
    }
  };

  const start = async () => {
    if (!canStart) return;
    setStarting(true);
    setFailure(null);
    try {
      const change = await createLabChange(session);
      const labStart: LabStartState = issue ? { message: message.trim(), issue } : { message: message.trim() };
      navigate(`/c/${change.changeId}`, { state: { labStart } });
    } catch (error) {
      setFailure(labRefusal(error).message);
      setStarting(false);
    }
  };

  return (
    <form
      className="lab-rise lab-d4 mt-8 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void start();
      }}
    >
      <label htmlFor="lab-composer" className="sr-only">
        {t('lab.app.home.composerLabel', { defaultValue: 'Describe the change' })}
      </label>
      <Textarea
        id="lab-composer"
        autoFocus
        rows={4}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            void start();
          }
        }}
        placeholder={t('lab.app.home.placeholder', {
          defaultValue: 'For example: add a Note element to class diagrams, with a text body and a link to any class',
        })}
        className="min-h-[7.5rem] resize-y border-0 bg-transparent px-1 text-base shadow-none focus-visible:ring-0"
      />
      {issueOpen ? (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-muted/30 p-3" data-testid="lab-issue-field">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('lab.app.home.issueRepo', { defaultValue: 'Repository' })}
            <select
              value={issueRepo}
              onChange={(event) => {
                setIssueRepo(event.target.value as LabRepoKey);
                setPicked(null);
              }}
              className={cn(inputBaseClass, 'h-9 w-44 py-1')}
            >
              {REPO_KEYS.map((repo) => (
                <option key={repo} value={repo}>
                  {t(`lab.repos.${repo}`, { defaultValue: repo })}
                </option>
              ))}
            </select>
          </label>
          {picked ? (
            <p data-testid="lab-issue-picked" className="flex min-w-0 flex-1 items-center gap-2 self-center text-sm text-foreground">
              <span className="shrink-0 font-mono text-muted-foreground">#{picked.number}</span>
              <span className="min-w-0 truncate">{picked.title}</span>
              <Button type="button" variant="ghost" size="xs" onClick={() => setPicked(null)}>
                {t('lab.app.home.issueChange', { defaultValue: 'Choose another' })}
              </Button>
            </p>
          ) : (
            <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
              {t('lab.app.home.issueSearch', { defaultValue: 'Issue' })}
              <input
                value={issueQuery}
                onChange={(event) => setIssueQuery(event.target.value)}
                placeholder={t('lab.app.home.issueSearchPlaceholder', { defaultValue: 'Search open issues, or type a number' })}
                className={cn(inputBaseClass, 'h-9 py-1')}
              />
            </label>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setIssueOpen(false);
              setIssueQuery('');
              setPicked(null);
            }}
          >
            <X className="size-4" aria-hidden />
            {t('lab.app.home.issueRemove', { defaultValue: 'No issue' })}
          </Button>
          {!picked && (
            <div className="basis-full" data-testid="lab-issue-options">
              {options.status === 'failed' ? (
                <p role="alert" className="text-xs text-destructive">
                  {t('lab.app.home.issuesFailed', {
                    defaultValue: 'The issues could not be read: {{error}} You can still type the issue number.',
                    error: options.error,
                  })}
                </p>
              ) : options.issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {options.status === 'loading'
                    ? t('lab.app.home.issuesLoading', { defaultValue: 'Reading the open issues...' })
                    : t('lab.app.home.issuesNone', { defaultValue: 'No open issue matches.' })}
                </p>
              ) : (
                <ul
                  aria-label={t('lab.app.home.issuesLabel', { defaultValue: 'Open issues' })}
                  className={cn('max-h-56 overflow-y-auto rounded-lg border border-border bg-background', options.status === 'loading' && 'opacity-60')}
                >
                  {options.issues.map((option) => (
                    <li key={`${option.repo}-${option.number}`} className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => pick(option)}
                        className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-foreground/[0.04] focus-visible:bg-foreground/[0.06] focus-visible:outline-none"
                      >
                        <span className="shrink-0 font-mono text-xs text-muted-foreground">#{option.number}</span>
                        <span className="min-w-0 flex-1 truncate text-foreground">{option.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {option.author ? `@${option.author}` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIssueOpen(true)}
          className="mt-2 px-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {t('lab.app.home.issueOpen', { defaultValue: 'Start from a GitHub issue' })}
        </button>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-foreground">
          {t('lab.app.home.shortcut', { defaultValue: 'Ctrl+Enter to start' })}
        </span>
        <Button type="submit" disabled={!canStart}>
          {starting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {t('lab.app.home.start', { defaultValue: 'Start change' })}
          {!starting && <ArrowRight className="size-4" aria-hidden />}
        </Button>
      </div>
      {block && (
        <div data-testid="lab-start-blocked" className="mt-3 text-right text-sm text-muted-foreground">
          {block}
        </div>
      )}
      {failure && (
        <Alert variant="destructive" className="mt-3">
          <CircleAlert aria-hidden />
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
    </form>
  );
};

/**
 * The lab's home: what the user wants to change, the open changes and the recently closed ones.
 * Re-reads the changes and the meters every {@link HOME_REFRESH_MS} while the page is visible.
 */
export const LabHome: React.FC = () => {
  const { t } = useTranslation();
  const { session, user, home, reloadHome } = useLabShell();
  const [changes, setChanges] = useState<LabChangeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (withHome: boolean) => {
      try {
        const [list] = await Promise.all([listLabChanges(session), withHome ? reloadHome() : undefined]);
        setChanges(list.changes);
        setError(null);
      } catch (failure) {
        setError(describeNetworkError(failure));
      }
    },
    [session, reloadHome],
  );

  useEffect(() => {
    void load(false);
    const tick = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    const timer = window.setInterval(tick, HOME_REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [load]);

  const block = useStartBlock(home, changes);
  const open = useMemo(() => changes?.filter((change) => change.status !== 'closed') ?? [], [changes]);
  const closed = useMemo(() => changes?.filter((change) => change.status === 'closed') ?? [], [changes]);

  return (
    <div className="mx-auto w-full max-w-[72rem] px-6 py-8">
      <section className="relative overflow-hidden rounded-2xl px-1 pb-2 pt-4 sm:px-2">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 size-96 rounded-full opacity-50 blur-2xl"
          style={{ background: 'radial-gradient(circle at center, hsl(var(--brand)/0.22), transparent 62%)' }}
        />
        <div aria-hidden className="grain-overlay pointer-events-none absolute inset-0 opacity-40" />
        <div className="relative z-[1] max-w-3xl">
          <p className="lab-rise lab-d1 ui-kicker text-brand">{t('lab.app.signIn.kicker', { defaultValue: 'BESSER BOOTSTRAPPED' })}</p>
          <h1
            className="lab-rise lab-d2 mt-3 font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl"
            style={{ textWrap: 'balance' }}
          >
            <Trans
              i18nKey="lab.app.home.heading"
              defaults="What do you want to change in <em>BESSER</em>?"
              components={{ em: <em className="text-primary" /> }}
            />
          </h1>
          <p className="lab-rise lab-d3 mt-3 max-w-[62ch] text-muted-foreground">
            {t('lab.app.home.subtitle', {
              defaultValue:
                'Describe a change to BESSER, the web editor or the modeling agent. The lab agent plans it, you correct the plan, it builds it on lab branches, and you open the pull requests.',
            })}
          </p>
        </div>
        <div className="relative z-[1] max-w-3xl">
          <Composer block={block} />
        </div>
      </section>

      <div className="mt-10 space-y-10">
        {error && (
          <Alert variant="destructive" data-testid="lab-changes-error">
            <CircleAlert aria-hidden />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              {t('lab.app.changes.error', { defaultValue: 'The changes could not be read: {{error}}', error })}
              <Button variant="outline" size="xs" onClick={() => void load(true)}>
                {t('lab.app.gate.retry', { defaultValue: 'Try again' })}
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {changes === null ? (
          !error && (
            <>
              <LabListSkeleton testId="lab-open-skeleton" />
              <LabListSkeleton testId="lab-closed-skeleton" />
            </>
          )
        ) : (
          <>
            <LabChangeList changes={open} login={user.login} />
            <LabClosedChangeList changes={closed} />
          </>
        )}
      </div>
    </div>
  );
};
