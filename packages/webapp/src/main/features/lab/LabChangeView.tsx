import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { ApollonEditor } from '@besser/wme';
import {
  CircleAlert,
  Copy,
  GitBranch,
  GitPullRequest,
  Loader2,
  MoreHorizontal,
  Play,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type { LabDiffFileRef } from '@/components/chatbot-kit/ui/lab-changes-dialog';
import { labChangeBranch, labRepoName } from '@/components/chatbot-kit/ui/lab-run-result';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAppSelector } from '../../app/store/hooks';
import {
  dropLabChange,
  labRefusal,
  updateLabChangeFromBase,
  type LabRepoKey,
} from '../../shared/api/lab';
import { cancelSpecDrivenRun } from '../../shared/api/specDriven';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { reportError } from '../../shared/services/errors/reportError';
import {
  getOpenLabChange,
  subscribeLabViewRequests,
  type LabStartState,
  type LabViewRequest,
} from '../../shared/services/labSession';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';
import { useAssistantLogic } from '../assistant';
import { ApollonEditorProvider, EditorView } from '../editors';
import { useLabShell } from './LabAuthGate';
import { LabAvatar, PHASE_TONE, Pill, usePhaseLabel } from './LabChangeList';
import { LabChangesTab } from './LabChangesTab';
import { LabChatPane } from './LabChatPane';
import { hasLabChangeModel, openLabChangeProject } from './labDone';
import { LabModelProposalBanner } from './LabModelProposalBanner';
import { deleteLabProject, labProjectId, latestThreadModel } from './labProject';
import { LabPreviewTab } from './LabPreviewTab';
import { LabPullRequestDialog } from './LabPullRequestDialog';
import { useLabChange } from './useLabChange';

export type LabChangeTab = 'model' | 'changes' | 'try';
const TABS: readonly LabChangeTab[] = ['model', 'changes', 'try'];
const REPO_KEYS: readonly string[] = ['besser', 'frontend', 'modeling_agent'];
/** Width from which chat and tabs sit side by side (Tailwind `lg`); below it one segmented control switches. */
const WIDE_QUERY = '(min-width: 1024px)';

const isTab = (value: string | null): value is LabChangeTab => TABS.includes(value as LabChangeTab);

/** Whether the page is shown (not a background tab). */
function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return visible;
}

/** Whether the window is at least {@link WIDE_QUERY} wide; wide where `matchMedia` is missing. */
function useWide(): boolean {
  const query = typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null;
  const [wide, setWide] = useState(query?.matches ?? true);
  useEffect(() => {
    if (!query) return undefined;
    const update = () => setWide(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
    // The query string is constant; one listener for the view's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return wide;
}

/** The Model tab: the class-diagram canvas of the change's project, with the proposal banner above it. */
const LabModelTab: React.FC<{ changeId: string }> = ({ changeId }) => {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<ApollonEditor>();
  const project = useAppSelector((state) => state.workspace.project);
  if (project?.id !== labProjectId(changeId)) {
    return (
      <p className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {t('lab.change.modelLoading', { defaultValue: 'Opening the model...' })}
      </p>
    );
  }
  if (!hasLabChangeModel(project, changeId)) {
    return (
      <p data-testid="lab-model-empty" className="m-6 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t('lab.change.noModel', {
          defaultValue:
            'This change has no class diagram. The lab agent proposes one when the change adds or changes a metamodel or a diagram type.',
        })}
      </p>
    );
  }
  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <div data-testid="lab-model-tab" className="flex min-h-0 flex-1 flex-col">
        {/* Above the canvas, not over it: the proposed classes it asks about stay visible. */}
        <LabModelProposalBanner className="mx-3 mt-2 max-w-none shadow-none" />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <EditorView />
        </div>
      </div>
    </ApollonEditorProvider>
  );
};

/**
 * The change at `/c/:changeId`: its header (title, kind, phase, owner, branch, the pull-request action and the
 * overflow menu), the "development moved" strip, the chat of its thread, and the tabs Model, Changes and Try it
 * (`?tab=model|changes|try`). It is the tab's open change while mounted; cards in the chat open its views through
 * `requestLabView`, and the home's first message (`labStart`) is sent once.
 */
export const LabChangeView: React.FC = () => {
  const { t } = useTranslation();
  const phaseLabel = usePhaseLabel();
  const { changeId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session, user, setBreadcrumb, reloadHome } = useLabShell();
  const { state, reload } = useLabChange(changeId, session);
  const logic = useAssistantLogic({ isActive: true, switchDiagram: async () => false, surface: 'workspace' });
  const documentVisible = useDocumentVisible();
  const wide = useWide();
  const projectHasModel = useAppSelector((root) => hasLabChangeModel(root.workspace.project, changeId));

  const change = state.status === 'ready' ? state.change : null;
  const requestedTab = searchParams.get('tab');
  const [narrowShowsChat, setNarrowShowsChat] = useState(!isTab(requestedTab));
  const [pullRequestOpen, setPullRequestOpen] = useState(false);
  const [diff, setDiff] = useState<{ open: boolean; file?: LabDiffFileRef }>({ open: false });
  const [busy, setBusy] = useState<string | null>(null);

  const hasModel = projectHasModel || (change ? latestThreadModel(change.thread) !== null : false);
  const defaultTab: LabChangeTab =
    change && (change.status === 'draft' || change.phase === 'planned') && hasModel ? 'model' : 'changes';
  const tab: LabChangeTab = isTab(requestedTab) ? requestedTab : defaultTab;

  const selectTab = useCallback(
    (next: LabChangeTab) => {
      setNarrowShowsChat(false);
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.set('tab', next);
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  // The header's breadcrumb names the change.
  const title = change?.title || (change ? t('lab.change.newChange', { defaultValue: 'New change' }) : null);
  useEffect(() => {
    setBreadcrumb(title);
  }, [title, setBreadcrumb]);
  useEffect(() => () => setBreadcrumb(null), [setBreadcrumb]);

  // The change's project opens once its thread is known (rebuilt from the thread in a browser without it).
  const openedProjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (!change || openedProjectRef.current === change.changeId) return;
    openedProjectRef.current = change.changeId;
    openLabChangeProject(change, change.thread).catch((error: unknown) => {
      console.error(`[lab] the project of change ${change.changeId} could not be opened`, error);
      reportError(t('lab.change.projectFailed', { defaultValue: "The change's model could not be opened." }), { error });
    });
  }, [change, t]);

  // The home's first message: sent once, when the change is known, then cleared from the history entry.
  const startSentRef = useRef<string | null>(null);
  useEffect(() => {
    const start = (location.state as { labStart?: LabStartState } | null)?.labStart;
    if (!change || !start || startSentRef.current === change.changeId) return;
    startSentRef.current = change.changeId;
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    void logic.handleSubmit(undefined, { overrideText: start.message, labIssue: start.issue });
  }, [change, location, navigate, logic]);

  // What the re-read thread holds that this tab has not shown yet (a teammate's message, a run that ended), and a
  // run a teammate started, which the chat then follows.
  const syncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!change || getOpenLabChange() !== change.changeId) return;
    const key = `${change.changeId}:${change.updatedAt}:${change.thread.length}`;
    // The first read of a change is shown by the chat itself when it opens the change.
    const first = syncedRef.current === null || !syncedRef.current.startsWith(`${change.changeId}:`);
    if (syncedRef.current === key) return;
    syncedRef.current = key;
    if (first) return;
    void logic.syncLabThread(change);
  }, [change, logic]);

  // Cards in the chat ask for this change's views.
  useEffect(
    () =>
      subscribeLabViewRequests((request: LabViewRequest) => {
        if (request.changeId !== changeId) return;
        switch (request.kind) {
          case 'changes':
            selectTab('changes');
            setDiff({ open: true, file: request.file });
            return;
          case 'pullRequest':
            setPullRequestOpen(true);
            return;
          case 'tryIt':
            selectTab('try');
            return;
          case 'model':
            selectTab('model');
            return;
        }
      }),
    [changeId, selectTab],
  );

  if (state.status === 'loading') {
    return (
      <div data-testid="lab-change-loading" aria-busy className="mx-auto w-full max-w-[72rem] space-y-4 px-6 py-6">
        <span className="block h-7 w-1/3 animate-pulse rounded bg-muted" />
        <span className="block h-4 w-1/2 animate-pulse rounded bg-muted" />
        <span className="block h-64 w-full animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }
  if (state.status === 'notFound') {
    return (
      <div data-testid="lab-change-not-found" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">
          {t('lab.change.notFound', { defaultValue: 'This change does not exist any more. It may have been dropped.' })}
        </p>
        <Button asChild variant="outline">
          <Link to="/">{t('lab.change.backToChanges', { defaultValue: 'Back to changes' })}</Link>
        </Button>
      </div>
    );
  }
  if (state.status === 'failed') {
    return (
      <div className="mx-auto w-full max-w-xl px-6 py-10">
        <Alert variant="destructive" data-testid="lab-change-error">
          <CircleAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            {t('lab.change.readFailed', {
              defaultValue: 'The change could not be read: {{error}}',
              error: describeNetworkError(state.error),
            })}
            <Button variant="outline" size="xs" onClick={() => void reload()}>
              {t('lab.change.tryAgain', { defaultValue: 'Try again' })}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const ready = state.change;
  const canDrop = ready.owner === user.login || user.isAdmin;
  const branch = labChangeBranch(Object.values(ready.branches).map((name) => ({ branch: name })));
  const behind = ready.bases.filter((base) => base.behind > 0);
  const changedFiles = (ready.view?.repoChanges ?? []).reduce((sum, repo) => sum + repo.files.length, 0);
  const pushed = ready.pullRequests.length > 0;
  const prBlocked = ready.status !== 'open' || ready.run !== null || changedFiles === 0 || busy !== null;

  const runAction = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  };

  const updateFromBase = (repo: string) =>
    runAction(`update:${repo}`, async () => {
      if (!REPO_KEYS.includes(repo)) {
        console.warn(`[lab] change ${ready.changeId} has a base of unknown repository ${repo}; not updated`);
        return;
      }
      try {
        const result = await updateLabChangeFromBase(session, ready.changeId, repo as LabRepoKey);
        if (result.outcome === 'refused') reportError(result.message);
        else toast.info(result.message || t('lab.change.updated', { defaultValue: 'The change is up to date with its base.' }));
      } catch (error) {
        reportError(labRefusal(error).message, { error });
      }
      await reload();
    });

  const pushPullRequests = () =>
    runAction('push', async () => {
      try {
        await logic.openPullRequest(ready.changeId);
      } catch (error) {
        reportError(
          t('lab.change.pushFailed', { defaultValue: 'The pull requests were not updated: {{reason}}', reason: labRefusal(error).message }),
          { error },
        );
      }
      await reload();
    });

  const drop = () =>
    runAction('drop', async () => {
      const confirmed = await globalConfirm({
        title: t('lab.change.dropTitle', { defaultValue: 'Drop ‘{{title}}’?', title: ready.title || t('lab.change.newChange', { defaultValue: 'New change' }) }),
        description: t('lab.change.dropDescription', {
          defaultValue: 'Its branches, working trees, thread and notes are deleted. Pull requests already opened stay on GitHub.',
        }),
        confirmLabel: t('lab.change.dropConfirm', { defaultValue: 'Drop change' }),
        variant: 'danger',
      });
      if (!confirmed) return;
      try {
        await dropLabChange(session, ready.changeId);
      } catch (error) {
        reportError(labRefusal(error).message, { error });
        return;
      }
      deleteLabProject(ready.changeId);
      toast.success(t('lab.change.dropped', { defaultValue: 'The change was dropped.' }));
      navigate('/');
      reloadHome().catch((error: unknown) => console.warn('[lab] the home could not be read after a drop', error));
    });

  const stopRun = async () => {
    if (!ready.run) return;
    const stopped = await cancelSpecDrivenRun(ready.run.runId, { githubSession: session });
    if (!stopped) reportError(t('lab.change.stopFailed', { defaultValue: 'The run could not be stopped. Try again.' }));
    await reload();
  };

  const copyBranch = () => {
    navigator.clipboard.writeText(branch).then(
      () => toast.success(t('lab.change.branchCopied', { defaultValue: 'Branch name copied.' })),
      (error: unknown) => reportError(t('lab.change.copyFailed', { defaultValue: 'The branch name could not be copied.' }), { error }),
    );
  };

  const tabLabel = (name: LabChangeTab) =>
    name === 'model'
      ? t('lab.change.tab.model', { defaultValue: 'Model' })
      : name === 'changes'
        ? t('lab.change.tab.changes', { defaultValue: 'Changes' })
        : t('lab.change.tab.try', { defaultValue: 'Try it' });
  const rightPaneShown = wide || !narrowShowsChat;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="max-w-[40ch] truncate font-display text-2xl leading-tight text-foreground" title={ready.title}>
              {ready.title || t('lab.change.newChange', { defaultValue: 'New change' })}
            </h1>
            <Pill className="border-border bg-background font-mono text-muted-foreground">
              {t(`lab.kinds.${ready.kind}`, { defaultValue: ready.kind.replace('_', ' ') })}
            </Pill>
            <Pill className={PHASE_TONE[ready.phase]}>{phaseLabel(ready.phase)}</Pill>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <LabAvatar login={ready.owner} />
              {t('lab.change.startedBy', { defaultValue: 'Started by @{{login}}', login: ready.owner })}
            </span>
            {branch && (
              <span className="inline-flex min-w-0 items-center gap-1 font-mono text-xs text-muted-foreground">
                <GitBranch className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{branch}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={t('lab.change.copyBranch', { defaultValue: 'Copy the branch name' })}
                  onClick={copyBranch}
                >
                  <Copy className="size-3.5" aria-hidden />
                </Button>
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {pushed ? (
              <Button size="sm" disabled={prBlocked} onClick={() => void pushPullRequests()}>
                {busy === 'push' ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {t('lab.change.pushPullRequests', { defaultValue: 'Push to the pull requests' })}
              </Button>
            ) : (
              <Button size="sm" disabled={prBlocked} onClick={() => setPullRequestOpen(true)}>
                <GitPullRequest aria-hidden />
                {t('lab.change.openPullRequest', { defaultValue: 'Open pull request' })}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="size-8" aria-label={t('lab.change.more', { defaultValue: 'More actions' })}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => selectTab('try')}>
                  <Play aria-hidden />
                  {t('lab.change.tryThisChange', { defaultValue: 'Try this change' })}
                </DropdownMenuItem>
                {behind.map((base) => (
                  <DropdownMenuItem key={base.repo} disabled={busy !== null} onSelect={() => void updateFromBase(base.repo)}>
                    <RefreshCw aria-hidden />
                    {t('lab.change.updateFrom', {
                      defaultValue: 'Update {{repo}} from {{branch}}',
                      repo: labRepoName(t, base.repo),
                      branch: base.branch,
                    })}
                  </DropdownMenuItem>
                ))}
                {canDrop && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => void drop()}>
                      <Trash2 aria-hidden />
                      {t('lab.change.drop', { defaultValue: 'Drop change...' })}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {behind.length > 0 && (
          <div data-testid="lab-change-behind" className="mt-3 space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
            {behind.map((base) => (
              <p key={base.repo} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t('lab.change.behind', {
                    defaultValue: '{{branch}} of {{repo}} moved {{count}} commits since this change started.',
                    defaultValue_one: '{{branch}} of {{repo}} moved 1 commit since this change started.',
                    branch: base.branch,
                    repo: labRepoName(t, base.repo),
                    count: base.behind,
                  })}
                </span>
                <Button variant="outline" size="xs" disabled={busy !== null} onClick={() => void updateFromBase(base.repo)}>
                  {busy === `update:${base.repo}` ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                  {t('lab.change.updateFromBranch', { defaultValue: 'Update from {{branch}}', branch: base.branch })}
                </Button>
              </p>
            ))}
          </div>
        )}
        {state.error !== null && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {t('lab.change.refreshFailed', {
              defaultValue: 'The change could not be read again: {{error}}. It is shown as last read.',
              error: describeNetworkError(state.error),
            })}
          </p>
        )}
      </div>

      {/* Below 1024 px one segmented control switches between the chat and the tabs. */}
      {!wide && (
        <div role="tablist" aria-label={t('lab.change.panes', { defaultValue: 'Views of the change' })} className="flex shrink-0 gap-0.5 border-b border-border bg-muted/40 p-1 text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={narrowShowsChat}
            onClick={() => setNarrowShowsChat(true)}
            className={cn('flex-1 rounded-md px-2 py-1.5 font-medium', narrowShowsChat ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            {t('lab.change.tab.chat', { defaultValue: 'Chat' })}
          </button>
          {TABS.map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={!narrowShowsChat && tab === name}
              onClick={() => selectTab(name)}
              className={cn('flex-1 rounded-md px-2 py-1.5 font-medium', !narrowShowsChat && tab === name ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
            >
              {tabLabel(name)}
            </button>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <LabChatPane
          change={ready}
          viewer={user.login}
          logic={logic}
          onNewChange={() => navigate('/')}
          onStopRun={stopRun}
          className={cn(wide ? 'w-[440px] shrink-0 border-r border-border' : 'w-full', !wide && !narrowShowsChat && 'hidden')}
        />
        <section
          aria-label={t('lab.change.tabsLabel', { defaultValue: 'Model, changes and preview' })}
          className={cn('flex min-h-0 min-w-0 flex-1 flex-col', !rightPaneShown && 'hidden')}
        >
          {wide && (
            <div role="tablist" aria-label={t('lab.change.tabsLabel', { defaultValue: 'Model, changes and preview' })} className="flex shrink-0 gap-1 border-b border-border px-4">
              {TABS.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => selectTab(name)}
                  className={cn(
                    '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                    tab === name ? 'border-brand text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tabLabel(name)}
                </button>
              ))}
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {tab === 'model' && <LabModelTab changeId={ready.changeId} />}
            {tab === 'changes' && (
              <LabChangesTab
                change={ready}
                githubSession={session}
                visible={documentVisible && rightPaneShown}
                diff={diff}
                onDiffChange={setDiff}
                onSendComments={(text) => void logic.handleSubmit(undefined, { overrideText: text })}
                onOpenPullRequest={logic.openPullRequest}
                onReviewAction={logic.handleLabReviewAction}
              />
            )}
            <div className={cn('min-h-0 flex-1 flex-col p-4', tab === 'try' ? 'flex' : 'hidden')}>
              <LabPreviewTab
                change={{ changeId: ready.changeId, title: ready.title, owner: ready.owner }}
                githubSession={session}
                visible={tab === 'try' && documentVisible && rightPaneShown}
              />
            </div>
          </div>
        </section>
      </div>

      <LabPullRequestDialog
        open={pullRequestOpen}
        onOpenChange={setPullRequestOpen}
        githubSession={session}
        changeId={ready.changeId}
        title={ready.title}
        issues={ready.view?.issues ?? []}
        onOpened={() => void reload()}
      />
    </div>
  );
};

export default LabChangeView;
