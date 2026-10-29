/**
 * The repository the agentic chat is working on: repo, branch and sync state,
 * one line above the conversation. Clicking it opens the GitHub menu.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRepoSync, type RepoSyncState } from '../hooks/useRepoSync';
import { OPEN_GITHUB_PANEL_EVENT } from '../../../shared/api/github';

const DOT: Record<RepoSyncState, string> = {
  'in-sync': 'bg-success',
  'local-changes': 'bg-warning',
  behind: 'bg-warning',
  diverged: 'bg-warning',
  reconnect: 'bg-destructive',
  missing: 'bg-destructive',
  checking: 'bg-muted-foreground/50',
  unknown: 'bg-muted-foreground/50',
  unlinked: 'bg-muted-foreground/50',
  'signed-out': 'bg-muted-foreground/50',
};

export const RepoChatHeader: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const { link, state, status } = useRepoSync();
  if (!link) return null;

  const behind = status?.commits_since.length ?? 0;
  const stateText: Record<RepoSyncState, string> = {
    'in-sync': t('github.status.inSync', { defaultValue: 'In sync with GitHub' }),
    'local-changes': t('github.status.localChanges', { defaultValue: 'Model changes not saved to GitHub' }),
    behind: t('github.status.behind', { defaultValue: '{{count}} new commits on GitHub', count: behind }),
    diverged: t('github.chatHeader.diverged', { defaultValue: 'Changed here and on GitHub' }),
    reconnect: t('github.status.reconnect', { defaultValue: 'GitHub session expired: reconnect' }),
    missing: t('github.status.missing', { defaultValue: 'Branch or repository not found on GitHub' }),
    checking: t('github.linked.checking'),
    unknown: t('github.status.unknown', { defaultValue: 'Could not reach the repository' }),
    unlinked: '',
    'signed-out': t('github.chatHeader.signedOut', { defaultValue: 'Connect GitHub to see its status' }),
  };

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_GITHUB_PANEL_EVENT))}
      className={cn(
        'mx-auto flex w-full max-w-4xl items-center gap-2 rounded-lg border border-border/60 bg-card/70 px-3 py-1.5 text-left text-xs backdrop-blur-sm transition-colors hover:bg-muted/60',
        className,
      )}
      aria-label={t('github.chatHeader.openMenu', {
        defaultValue: 'Working on {{repo}}: {{state}}. Open the GitHub menu.',
        repo: `${link.owner}/${link.repo}`,
        state: stateText[state],
      })}
    >
      <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">{t('github.chatHeader.workingOn', { defaultValue: 'Working on' })}</span>
      <span className="truncate font-medium text-foreground">
        {link.owner}/{link.repo}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground">{link.branch}</span>
      <span className="ml-auto flex shrink-0 items-center gap-1.5 text-muted-foreground">
        <span aria-hidden className={cn('size-1.5 rounded-full', DOT[state])} />
        <span className="hidden sm:inline">{stateText[state]}</span>
        <ChevronRight className="size-3.5" aria-hidden />
      </span>
    </button>
  );
};
