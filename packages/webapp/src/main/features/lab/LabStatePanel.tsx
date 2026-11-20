import React from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, GitBranch, GitPullRequest, PauseCircle, PlayCircle, RotateCcw, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { labChangeBranch, LabPullRequestFailure } from '@/components/chatbot-kit/ui/lab-run-result';
import { cn } from '@/lib/utils';
import type { LabPullRequest, LabRepoChange, LabState } from '../../shared/api/lab';

const REPO_LABELS: Record<string, string> = {
  besser: 'BESSER',
  frontend: 'Web editor',
  modeling_agent: 'Modeling agent',
};

const STATUS_CLASSES: Record<string, string> = {
  added: 'text-success',
  modified: 'text-warning',
  deleted: 'text-destructive',
  renamed: 'text-info',
};

export interface LabStatePanelProps {
  state: LabState;
  /** An action or a run is in progress: every button waits. */
  busy: boolean;
  /** The pull requests opened from this page, shown as links. */
  pullRequests: LabPullRequest[];
  /** The server's note on which checks the change passed before the push, shown under the links. */
  checksNote: string;
  /** Why the last "Open pull request" failed, shown until the next attempt. */
  pullRequestFailure: { error: unknown } | null;
  onOpenPullRequest: () => void;
  /** Stops the lab run in progress (`state.run`), which may be another tab's or device's. */
  onStopRun: (runId: string) => void;
  /** The run a stop was accepted for: it is still ending on the server. */
  stoppingRunId: string | null;
  onPark: () => void;
  onDrop: () => void;
  onResume: (changeId: string) => void;
  onResetPreview: () => void;
}

/** The lab's working copy as the server reports it, with the actions that change it. */
export const LabStatePanel: React.FC<LabStatePanelProps> = ({
  state,
  busy,
  pullRequests,
  checksNote,
  pullRequestFailure,
  onOpenPullRequest,
  onStopRun,
  stoppingRunId,
  onPark,
  onDrop,
  onResume,
  onResetPreview,
}) => {
  const { t } = useTranslation();
  const { change, parked, preview, run } = state;
  const repoLabel = (repo: string) => t(`lab.repos.${repo}`, { defaultValue: REPO_LABELS[repo] ?? repo });
  const kindLabel = (kind: string) => t(`lab.kinds.${kind}`, { defaultValue: kind.replace('_', ' ') });
  const hasChanges = Boolean(change?.repoChanges.some((repo) => repo.files.length > 0));
  const branch = change ? labChangeBranch(change.repoChanges) : '';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {t('lab.state.signedInAs', { defaultValue: 'Signed in as {{user}}', user: state.user })}
      </p>

      {run && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 p-3 text-sm">
          {run.runId === stoppingRunId ? (
            <span className="text-foreground">
              {t('lab.state.runStopping', {
                defaultValue: 'Stopping the lab run (started {{time}})…',
                time: new Date(run.startedAt * 1000).toLocaleTimeString(),
              })}
            </span>
          ) : (
            <>
              <span className="text-foreground">
                {t('lab.state.runInProgress', {
                  defaultValue: 'A lab run is in progress (started {{time}}).',
                  time: new Date(run.startedAt * 1000).toLocaleTimeString(),
                })}
              </span>
              <Button size="sm" variant="outline" onClick={() => onStopRun(run.runId)} disabled={busy}>
                <Square className="size-4" />
                {t('lab.actions.stopRun', { defaultValue: 'Stop the run' })}
              </Button>
            </>
          )}
        </div>
      )}

      <Section title={t('lab.state.activeChange', { defaultValue: 'Active change' })}>
        {change ? (
          <div className="space-y-3">
            <div>
              <p className="font-medium text-foreground">{change.title}</p>
              <p className="text-xs text-muted-foreground">{kindLabel(change.kind)}</p>
              {branch && (
                <p className="mt-0.5 inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  {t('lab.state.onBranch', { defaultValue: 'On branch' })}
                  <GitBranch className="size-3 shrink-0" aria-hidden />
                  <span className="break-all font-mono">{branch}</span>
                </p>
              )}
            </div>
            {hasChanges ? (
              change.repoChanges
                .filter((repo) => repo.files.length > 0)
                .map((repo) => <RepoFiles key={repo.repo} repo={repo} label={repoLabel(repo.repo)} />)
            ) : (
              <p className="text-sm text-muted-foreground">{t('lab.state.noFiles', { defaultValue: 'No files changed yet.' })}</p>
            )}
            <div className="flex flex-wrap gap-2">
              {hasChanges && (
                <Button size="sm" onClick={onOpenPullRequest} disabled={busy}>
                  <GitPullRequest className="size-4" />
                  {t('lab.actions.openPullRequest', { defaultValue: 'Open pull request' })}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onPark} disabled={busy}>
                <PauseCircle className="size-4" />
                {t('lab.actions.park', { defaultValue: 'Park' })}
              </Button>
              <Button size="sm" variant="outline" onClick={onDrop} disabled={busy} className="text-destructive">
                <Trash2 className="size-4" />
                {t('lab.actions.drop', { defaultValue: 'Drop' })}
              </Button>
            </div>
            {pullRequestFailure && <LabPullRequestFailure error={pullRequestFailure.error} className="text-sm" />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('lab.state.noChange', { defaultValue: 'No active change. Describe one in the chat to start.' })}
          </p>
        )}
        {pullRequests.length > 0 && (
          <ul className="mt-3 space-y-1" aria-label={t('lab.state.pullRequests', { defaultValue: 'Pull requests' })}>
            {pullRequests.map((pr) => (
              <li key={pr.url}>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand underline-offset-2 hover:underline"
                >
                  {repoLabel(pr.repo)} #{pr.number}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        )}
        {pullRequests.length > 0 && checksNote && <p className="mt-2 text-xs text-muted-foreground">{checksNote}</p>}
      </Section>

      <Section title={t('lab.state.parked', { defaultValue: 'Parked changes' })}>
        {parked.length > 0 ? (
          <ul className="space-y-2">
            {parked.map((item) => (
              <li key={item.changeId} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{kindLabel(item.kind)}</p>
                </div>
                {/* The server keeps one active change: park or drop it first. */}
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => onResume(item.changeId)}
                  disabled={busy || change !== null}
                  aria-label={t('lab.actions.resumeChange', { defaultValue: 'Resume {{title}}', title: item.title })}
                >
                  <PlayCircle />
                  {t('lab.actions.resume', { defaultValue: 'Resume' })}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('lab.state.noParked', { defaultValue: 'No parked changes.' })}</p>
        )}
      </Section>

      <Section title={t('lab.state.preview', { defaultValue: 'Preview' })}>
        {preview.enabled ? (
          <ul className="space-y-1.5">
            {preview.services.map((service) => (
              <li key={service.name} className="flex items-center gap-2 text-sm">
                <span
                  className={cn('size-2 shrink-0 rounded-full', service.running ? 'bg-success' : 'bg-destructive')}
                  aria-hidden
                />
                <span className="font-medium text-foreground">{service.name}</span>
                <span className="text-muted-foreground">
                  {service.running
                    ? t('lab.state.running', { defaultValue: 'running' })
                    : t('lab.state.stopped', { defaultValue: 'stopped' })}
                </span>
                {service.detail && <span className="truncate text-xs text-muted-foreground">{service.detail}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('lab.state.previewOff', { defaultValue: 'The preview is off on this instance.' })}</p>
        )}
        <Button size="sm" variant="outline" className="mt-3" onClick={onResetPreview} disabled={busy || change !== null}>
          <RotateCcw className="size-4" />
          {t('lab.actions.resetPreview', { defaultValue: 'Reset the editor to development' })}
        </Button>
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section aria-label={title}>
    <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
    {children}
  </section>
);

const RepoFiles: React.FC<{ repo: LabRepoChange; label: string }> = ({ repo, label }) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border/60 p-3" role="group" aria-label={label}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
          <GitBranch className="size-3" aria-hidden />
          {repo.branch}
        </span>
      </div>
      <ul className="space-y-0.5">
        {repo.files.map((file) => (
          <li key={file.path} className="flex gap-2 font-mono text-xs">
            <span className={cn('w-16 shrink-0', STATUS_CLASSES[file.status] ?? 'text-muted-foreground')}>
              {t(`lab.fileStatus.${file.status}`, { defaultValue: file.status })}
            </span>
            <span className="min-w-0 break-all text-foreground">{file.path}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
