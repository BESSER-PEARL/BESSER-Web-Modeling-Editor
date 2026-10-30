/**
 * The one GitHub control in the top bar. Signed out it connects GitHub; signed
 * in it shows the project's repository and its sync state, and opens a menu
 * with everything you do with that repository.
 */
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  ChevronDown,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FolderGit2,
  GitPullRequest,
  Github,
  HelpCircle,
  History,
  Link2,
  Loader2,
  LogOut,
  PlusCircle,
  RefreshCw,
  Unlink2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useProject } from '../../../app/hooks/useProject';
import { useHasOpened } from '../../../app/hooks/useHasOpened';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { useRepoSync, type RepoSyncState } from '../hooks/useRepoSync';
import { useGitHubAuth } from '../../../shared/hooks/useGitHubAuth';
import { sanitizeRepoName } from '../../../shared/utils/validation';
import { openHelpGuide } from '../../../shared/dialogs/helpGuide';
import { useFlushEditorModel } from '../hooks/useFlushEditorModel';
import { createRepoForProject, OPEN_GITHUB_PANEL_EVENT } from '../../../shared/api/github';

// The menu is in the top bar from the start; its dialogs load on first open.
const CreateRepositoryDialog = React.lazy(() =>
  import('../dialogs/CreateRepositoryDialog').then((m) => ({ default: m.CreateRepositoryDialog })),
);
const SaveToGitHubDialog = React.lazy(() =>
  import('../dialogs/SaveToGitHubDialog').then((m) => ({ default: m.SaveToGitHubDialog })),
);
const ModelHistoryDialog = React.lazy(() =>
  import('../dialogs/ModelHistoryDialog').then((m) => ({ default: m.ModelHistoryDialog })),
);
const LinkRepositoryDialog = React.lazy(() =>
  import('../dialogs/LinkRepositoryDialog').then((m) => ({ default: m.LinkRepositoryDialog })),
);
const StartFromRepoDialog = React.lazy(() =>
  import('../dialogs/StartFromRepoDialog').then((m) => ({ default: m.StartFromRepoDialog })),
);

interface GitHubMenuProps {
  outlineButtonClass: string;
  isAuthenticated: boolean;
  username?: string;
  githubLoading: boolean;
  onLogin: () => void;
  onLogout: () => void;
  /** Called with a summary of a repository opened through "Start from a GitHub repository". */
  onRepoOpened?: (summary: string) => void;
}

/** Status dot colour per sync state. */
const REPO_STATE_DOT: Record<RepoSyncState, string> = {
  'in-sync': 'bg-success',
  'local-changes': 'bg-warning',
  behind: 'bg-warning',
  diverged: 'bg-warning',
  reconnect: 'bg-destructive',
  missing: 'bg-destructive',
  checking: 'bg-muted-foreground/50',
  unknown: 'bg-muted-foreground/50',
  unlinked: 'bg-muted-foreground/50',
  'not-in-tab': 'bg-muted-foreground/50',
  'signed-out': 'bg-muted-foreground/50',
};

const REPO_STATE_LABEL: Record<RepoSyncState, string> = {
  'in-sync': '{{repo}}: in sync with GitHub',
  'local-changes': '{{repo}}: model changes not saved to GitHub',
  behind: '{{repo}}: {{count}} new commits on GitHub',
  diverged: '{{repo}}: changed here and on GitHub',
  reconnect: '{{repo}}: GitHub session expired',
  missing: '{{repo}}: branch or repository not found on GitHub',
  checking: '{{repo}}: checking GitHub',
  unknown: '{{repo}}: could not reach GitHub',
  unlinked: 'Link this project to a GitHub repository',
  'not-in-tab': '{{repo}}: GitHub is not connected in this tab',
  'signed-out': 'GitHub',
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

type OpenDialog = 'save' | 'history' | 'link' | 'create' | 'startFromRepo' | null;

export const GitHubMenu: React.FC<GitHubMenuProps> = ({
  outlineButtonClass,
  isAuthenticated,
  username,
  githubLoading,
  onLogin,
  onLogout,
  onRepoOpened,
}) => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const { isExpired, isNotInTab, isChecking: isCheckingSession } = useGitHubAuth();
  const sync = useRepoSync();
  const { link, state, status, hasLocalChanges, githubSession } = sync;
  const flushEditor = useFlushEditorModel();

  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [busy, setBusy] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isRepoPrivate, setIsRepoPrivate] = useState(true);
  const saveMounted = useHasOpened(dialog === 'save');
  const historyMounted = useHasOpened(dialog === 'history');
  const linkMounted = useHasOpened(dialog === 'link');
  const createMounted = useHasOpened(dialog === 'create');
  const startFromRepoMounted = useHasOpened(dialog === 'startFromRepo');

  // The chat's repo header (and anything else) opens this menu through the event.
  const openFromEventRef = useRef<() => void>(() => undefined);
  openFromEventRef.current = () => (isAuthenticated || (isExpired && link) ? setMenuOpen(true) : onLogin());
  useEffect(() => {
    const onOpen = () => openFromEventRef.current();
    window.addEventListener(OPEN_GITHUB_PANEL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_GITHUB_PANEL_EVENT, onOpen);
  }, []);

  // Re-check the repo on every open, including opens from the event (Radix calls no onOpenChange for those).
  useEffect(() => {
    if (menuOpen && link) void sync.refresh();
  }, [menuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const behind = status?.commits_since.length ?? 0;
  const repoFullName = link ? `${link.owner}/${link.repo}` : '';

  // An expired session keeps the repo menu (with Reconnect) when the project is linked.
  if (!isAuthenticated && !(isExpired && link)) {
    const label = isExpired
      ? t('github.menu.reconnect', { defaultValue: 'Reconnect GitHub' })
      : t('topbar.connectGithub', { defaultValue: 'Connect GitHub' });
    const busyConnecting = githubLoading || isCheckingSession;
    // Signed in in another tab: a plain Connect, saying why, never an error.
    const hint = isNotInTab
      ? t('github.menu.notInTabHint', { defaultValue: 'GitHub is not connected in this tab. Connect it to use it here.' })
      : label;
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-2 ${outlineButtonClass}`}
            onClick={onLogin}
            disabled={busyConnecting}
            aria-label={label}
            aria-description={isNotInTab ? hint : undefined}
          >
            {busyConnecting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Github className="size-4" aria-hidden="true" />}
            <span className="hidden xl:inline">{busyConnecting ? t('common.connecting') : label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className={isNotInTab ? undefined : 'xl:hidden'}>
          {hint}
        </TooltipContent>
      </Tooltip>
    );
  }

  const triggerLabel = link
    ? t(`topbar.repoState.${state}`, { defaultValue: REPO_STATE_LABEL[state], repo: repoFullName, count: behind })
    : t('topbar.repoState.unlinked', { defaultValue: REPO_STATE_LABEL.unlinked });

  const stateText: Partial<Record<RepoSyncState, string>> = {
    'in-sync': t('github.status.inSync', { defaultValue: 'In sync with GitHub' }),
    'local-changes': t('github.status.localChanges', { defaultValue: 'Model changes not saved to GitHub' }),
    behind: t('github.status.behind', { defaultValue: '{{count}} new commits on GitHub', count: behind }),
    diverged: t('github.chatHeader.diverged', { defaultValue: 'Changed here and on GitHub' }),
    reconnect: t('github.status.reconnect', { defaultValue: 'GitHub session expired: reconnect' }),
    missing: t('github.status.missing', { defaultValue: 'Branch or repository not found on GitHub' }),
    checking: t('github.linked.checking', { defaultValue: 'Checking…' }),
    unknown: t('github.status.unknown', { defaultValue: 'Could not reach the repository' }),
  };
  const stateHint =
    state === 'local-changes'
      ? t('github.menu.localChangesHint', { defaultValue: 'Save to GitHub to keep them in the repository.' })
      : state === 'diverged'
        ? t('github.menu.divergedHint', { defaultValue: 'Saving merges both versions. Get latest takes the GitHub version instead.' })
        : state === 'reconnect'
          ? t('github.menu.reconnectHint', { defaultValue: 'Reconnect GitHub to save and check for new commits. Your project is kept.' })
          : state === 'missing'
            ? t('github.menu.missingHint', {
                defaultValue: 'The branch {{branch}} or the repository was deleted or renamed, or your account lost access. Link another repository to keep saving.',
                branch: link?.branch,
              })
            : null;
  // Saving cannot work until the session or the link is fixed.
  const canSave = state !== 'reconnect' && state !== 'missing';
  const pending = link?.pendingChange;

  const handleOpenPullRequest = async () => {
    setBusy(true);
    try {
      const url = await sync.openPullRequest(
        t('github.panel.prTitle', { defaultValue: 'Model changes from the BESSER editor' }),
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const pendingText = !pending
    ? null
    : pending.pullRequestUrl
      ? t('github.menu.pendingPullRequest', {
          defaultValue: 'Pull request #{{number}} waits for review. Once it is merged, Get latest brings it in.',
          number: pending.pullRequestNumber,
        })
      : t('github.menu.pendingConflict', {
          defaultValue: 'A save could not be merged with newer changes and is on the branch {{branch}}. Open a pull request to resolve it on GitHub.',
          branch: pending.branch,
        });

  const handlePull = async () => {
    if (hasLocalChanges) {
      const confirmed = await globalConfirm({
        title: t('github.linked.pullConfirmTitle'),
        description: t('github.linked.pullConfirmDescription'),
        confirmLabel: t('github.linked.pullConfirmAction'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    setBusy(true);
    try {
      await sync.pull();
      toast.success(t('github.toasts.projectPulled'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    const confirmed = await globalConfirm({
      title: t('github.linked.unlinkConfirmTitle'),
      description: t('github.menu.unlinkConfirmDescription', {
        defaultValue: 'The project stays in your browser and the repository stays on GitHub. Saving to GitHub stops until you link a repository again.',
      }),
      confirmLabel: t('github.linked.unlinkConfirmAction'),
      variant: 'danger',
    });
    if (!confirmed) return;
    sync.unlink();
    toast.info(t('github.toasts.repoUnlinked'));
  };

  const openCreateRepo = () => {
    if (currentProject) {
      setNewRepoName(sanitizeRepoName(currentProject.name) || 'project');
      setNewRepoDescription(currentProject.description);
    }
    setDialog('create');
  };

  const handleCreateRepo = async () => {
    if (!currentProject || !githubSession || !newRepoName.trim()) return;
    flushEditor();
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) {
      toast.error(t('github.toasts.couldNotLoadProjectData'));
      return;
    }
    setBusy(true);
    try {
      const result = await createRepoForProject(githubSession, {
        repo_name: newRepoName.trim(),
        description: newRepoDescription || t('github.defaultRepoDescription', { name: project.name }),
        is_private: isRepoPrivate,
        project_data: project,
        project_export: buildProjectExportEnvelope(project, undefined, { includePersonalization: false }),
      });
      const repo = result.repo_url.split('/').pop() || sanitizeRepoName(newRepoName);
      sync.markSynced({ owner: result.owner, repo, branch: result.branch }, project, result.commit_sha);
      setDialog(null);
      toast.success(t('github.panel.created', { defaultValue: 'Created {{repo}} with your model.', repo: `${result.owner}/${repo}` }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const itemClass = 'gap-2.5 py-2';
  const iconClass = 'size-4 shrink-0 text-muted-foreground';

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className={`gap-1.5 ${outlineButtonClass}`} aria-label={triggerLabel}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Github className="size-4" aria-hidden="true" />}
                {link ? (
                  <>
                    <span className="hidden max-w-[10rem] truncate xl:inline">{link.repo}</span>
                    <span aria-hidden="true" data-testid="repo-state-dot" className={cn('size-2 shrink-0 rounded-full', REPO_STATE_DOT[state])} />
                  </>
                ) : (
                  <span className="hidden xl:inline">{t('topbar.linkToGithub', { defaultValue: 'Link to GitHub' })}</span>
                )}
                <ChevronDown className="hidden size-3 opacity-50 xl:block" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className={link ? undefined : 'xl:hidden'}>
            {triggerLabel}
          </TooltipContent>
        </Tooltip>

        <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
          {link ? (
            <>
              <div className="px-2.5 pb-2.5 pt-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Github className="size-4 shrink-0" aria-hidden="true" />
                  <p className="min-w-0 truncate text-sm font-semibold" title={repoFullName}>
                    {repoFullName}
                  </p>
                  <span className="ml-auto max-w-[7rem] shrink-0 truncate rounded bg-muted px-1.5 py-px font-mono text-[11px] text-muted-foreground" title={link.branch}>
                    {link.branch}
                  </span>
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', REPO_STATE_DOT[state])} />
                  {stateText[state]}
                </p>
                {stateHint && <p className="mt-1 text-xs text-muted-foreground/90">{stateHint}</p>}
              </div>
              {pending && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2.5 py-2" role="status">
                    <p className="flex items-start gap-1.5 text-xs text-foreground">
                      <GitPullRequest className="mt-px size-3.5 shrink-0 text-warning" aria-hidden="true" />
                      {pendingText}
                    </p>
                  </div>
                  {pending.pullRequestUrl ? (
                    <DropdownMenuItem className={cn(itemClass, 'font-medium')} asChild>
                      <a href={pending.pullRequestUrl} target="_blank" rel="noopener noreferrer">
                        <GitPullRequest className="size-4 shrink-0 text-brand" aria-hidden="true" />
                        {t('github.push.viewPullRequest', { defaultValue: 'View the pull request' })}
                      </a>
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      className={cn(itemClass, 'font-medium')}
                      disabled={!canSave}
                      onSelect={() => void handleOpenPullRequest()}
                    >
                      <GitPullRequest className="size-4 shrink-0 text-brand" aria-hidden="true" />
                      {t('github.panel.openPr', { defaultValue: 'Open a pull request to merge it' })}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className={itemClass} onSelect={() => sync.dismissPending()}>
                    <Unlink2 className={iconClass} aria-hidden="true" />
                    {t('github.menu.dismissPending', { defaultValue: 'Stop tracking it' })}
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              {state === 'reconnect' && (
                <DropdownMenuItem className={cn(itemClass, 'font-medium')} onSelect={() => onLogin()}>
                  <RefreshCw className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  {t('github.menu.reconnect', { defaultValue: 'Reconnect GitHub' })}
                </DropdownMenuItem>
              )}
              {state === 'missing' && (
                <DropdownMenuItem className={cn(itemClass, 'font-medium')} onSelect={() => setDialog('link')}>
                  <Link2 className="size-4 shrink-0 text-brand" aria-hidden="true" />
                  {t('github.menu.linkExisting', { defaultValue: 'Link an existing repository…' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className={cn(itemClass, canSave && 'font-medium')} disabled={!canSave} onSelect={() => setDialog('save')}>
                <CloudUpload className={cn('size-4 shrink-0', canSave ? 'text-brand' : 'text-muted-foreground')} aria-hidden="true" />
                {t('github.menu.saveToGitHub', { defaultValue: 'Save to GitHub…' })}
              </DropdownMenuItem>
              {(state === 'behind' || state === 'diverged') && (
                <DropdownMenuItem className={itemClass} onSelect={() => void handlePull()}>
                  <CloudDownload className={iconClass} aria-hidden="true" />
                  {t('github.menu.getLatest', { defaultValue: 'Get latest' })}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className={itemClass} onSelect={() => setDialog('history')}>
                <History className={iconClass} aria-hidden="true" />
                {t('github.menu.history', { defaultValue: 'History…' })}
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClass} asChild>
                <a href={`https://github.com/${link.owner}/${link.repo}/tree/${encodeURIComponent(link.branch)}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className={iconClass} aria-hidden="true" />
                  {t('github.linked.openOnGitHub', { defaultValue: 'Open on GitHub' })}
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={itemClass} onSelect={() => setDialog('link')}>
                <FolderGit2 className={iconClass} aria-hidden="true" />
                {t('github.menu.changeRepository', { defaultValue: 'Change repository…' })}
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClass} onSelect={() => void handleUnlink()}>
                <Unlink2 className={iconClass} aria-hidden="true" />
                {t('github.linked.unlinkConfirmAction', { defaultValue: 'Unlink' })}
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <div className="px-2.5 pb-2.5 pt-2">
                <p className="text-sm font-semibold">
                  {currentProject
                    ? t('github.status.unlinked', { defaultValue: 'Not linked to a repository' })
                    : t('github.noProject.title')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {currentProject
                    ? t('github.panel.notLinkedHint', {
                        defaultValue: 'A linked repository keeps your model, its history and your app code in one place, for you and your team.',
                      })
                    : t('github.noProject.subtitle')}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className={cn(itemClass, 'font-medium')} disabled={!currentProject} onSelect={openCreateRepo}>
                <PlusCircle className="size-4 shrink-0 text-brand" aria-hidden="true" />
                {t('github.menu.createRepository', { defaultValue: 'Create a repository for this project' })}
              </DropdownMenuItem>
              <DropdownMenuItem className={itemClass} disabled={!currentProject} onSelect={() => setDialog('link')}>
                <Link2 className={iconClass} aria-hidden="true" />
                {t('github.menu.linkExisting', { defaultValue: 'Link an existing repository…' })}
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className={itemClass} onSelect={() => setDialog('startFromRepo')}>
            <FolderGit2 className={iconClass} aria-hidden="true" />
            {t('github.menu.startFromRepo', { defaultValue: 'Start from a GitHub repository…' })}
          </DropdownMenuItem>
          <DropdownMenuItem className={itemClass} onSelect={() => openHelpGuide('github')}>
            <HelpCircle className={iconClass} aria-hidden="true" />
            {t('github.menu.howItWorks', { defaultValue: 'How GitHub works in BESSER' })}
          </DropdownMenuItem>
          <DropdownMenuLabel className="truncate px-2.5 py-1.5 text-xs font-normal text-muted-foreground">
            {t('github.menu.signedInAs', { defaultValue: 'Signed in as {{name}}', name: username || 'GitHub' })}
          </DropdownMenuLabel>
          <DropdownMenuItem className={itemClass} onSelect={() => onLogout()}>
            <LogOut className={iconClass} aria-hidden="true" />
            {t('topbar.signOut', { defaultValue: 'Sign out' })}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Suspense fallback={null}>
        {saveMounted && (
          <SaveToGitHubDialog open={dialog === 'save'} onOpenChange={(open) => setDialog(open ? 'save' : null)} sync={sync} flushEditor={flushEditor} />
        )}
        {historyMounted && (
          <ModelHistoryDialog open={dialog === 'history'} onOpenChange={(open) => setDialog(open ? 'history' : null)} sync={sync} />
        )}
        {linkMounted && (
          <LinkRepositoryDialog open={dialog === 'link'} onOpenChange={(open) => setDialog(open ? 'link' : null)} sync={sync} />
        )}
        {createMounted && (
          <CreateRepositoryDialog
            open={dialog === 'create'}
            isLoading={busy}
            repoName={newRepoName}
            repoDescription={newRepoDescription}
            isRepoPrivate={isRepoPrivate}
            onOpenChange={(open) => setDialog(open ? 'create' : null)}
            onRepoNameChange={setNewRepoName}
            onRepoDescriptionChange={setNewRepoDescription}
            onRepoPrivateChange={setIsRepoPrivate}
            onCreate={() => void handleCreateRepo()}
          />
        )}
        {startFromRepoMounted && (
          <StartFromRepoDialog
            open={dialog === 'startFromRepo'}
            onOpenChange={(open) => setDialog(open ? 'startFromRepo' : null)}
            onRepoOpened={onRepoOpened}
          />
        )}
      </Suspense>
    </>
  );
};
