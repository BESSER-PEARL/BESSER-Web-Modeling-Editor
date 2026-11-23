import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import type { ApollonEditor } from '@besser/wme';
import {
  CircleAlert,
  Copy,
  GitBranch,
  GitPullRequest,
  LayoutList,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Play,
  RefreshCw,
  Settings,
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
import { useStorageSync } from '../../app/hooks/useStorageSync';
import { WorkspaceShell } from '../../app/shell/WorkspaceShell';
import { useAppSelector } from '../../app/store/hooks';
import {
  dropLabChange,
  labRefusal,
  updateLabChangeFromBase,
  type LabRepoKey,
} from '../../shared/api/lab';
import { cancelSpecDrivenRun } from '../../shared/api/specDriven';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { NotFound } from '../../shared/components/NotFound';
import { SuspenseFallback } from '../../shared/components/loading/SuspenseFallback';
import { reportError } from '../../shared/services/errors/reportError';
import {
  getOpenLabChange,
  subscribeLabViewRequests,
  type LabStartState,
  type LabViewRequest,
} from '../../shared/services/labSession';
import { describeNetworkError } from '../../shared/utils/describeNetworkError';
import { getWorkspaceContext } from '../../shared/utils/workspaceContext';
import { useAssistantLogic } from '../assistant';
import { ApollonEditorProvider, EditorView } from '../editors';
import { useLabShell } from './LabAuthGate';
import { LabKeyChip, MonthMeter } from './LabHeader';
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
/** Where each view of a change is, under the change's own address (`/c/<id>` is the editor's `/`). */
const TAB_PATH: Record<LabChangeTab, string> = { model: '/', changes: '/changes', try: '/try' };
/** Width from which chat and tabs sit side by side (Tailwind `lg`); below it one segmented control switches. */
const WIDE_QUERY = '(min-width: 1024px)';


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

/**
 * The change at `/c/<id>`, in the editor itself: the change is the editor's project. The editor's shell shows its
 * model on the canvas (`/`), with every diagram type and tool, and has two more pages in its sidebar, Changes
 * (`/changes`) and Try it (`/try`). The top bar holds the change's actions where a project has File, Generate and
 * Deploy, and the conversation with the lab agent is docked beside the editor. It is the tab's open change while mounted; cards in the chat open its views through
 * `requestLabView`, and the home's first message (`labStart`) is sent once.
 */
export interface LabChangeViewProps {
  changeId: string;
  /** Leaves the change for a lab screen (`/` the changes, `/settings`). */
  onLeave: (path: string) => void;
}

export const LabChangeView: React.FC<LabChangeViewProps> = ({ changeId, onLeave }) => {
  const { t } = useTranslation();
  const phaseLabel = usePhaseLabel();
  const navigate = useNavigate();
  const location = useLocation();
  const { session, user, home, setBreadcrumb, reloadHome } = useLabShell();
  // Redux follows what the editors write to storage directly, as in the editor.
  useStorageSync();
  const [editor, setEditor] = useState<ApollonEditor>();
  const projectOpen = useAppSelector((root) => root.workspace.project?.id === labProjectId(changeId));
  const { generatorMenuMode } = getWorkspaceContext(useAppSelector((root) => root.workspace.project?.currentDiagramType));
  const { state, reload } = useLabChange(changeId, session);
  const logic = useAssistantLogic({ isActive: true, switchDiagram: async () => false, surface: 'workspace' });
  const documentVisible = useDocumentVisible();
  const wide = useWide();
  const projectHasModel = useAppSelector((root) => hasLabChangeModel(root.workspace.project, changeId));

  const change = state.status === 'ready' ? state.change : null;
  const [pullRequestOpen, setPullRequestOpen] = useState(false);
  const [diff, setDiff] = useState<{ open: boolean; file?: LabDiffFileRef }>({ open: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(wide);

  const hasModel = projectHasModel || (change ? latestThreadModel(change.thread) !== null : false);

  const selectTab = useCallback((next: LabChangeTab) => navigate(TAB_PATH[next]), [navigate]);

  // A change opened on its canvas with nothing to show there goes to what was built instead, once.
  const landedRef = useRef(false);
  useEffect(() => {
    if (!change || landedRef.current) return;
    landedRef.current = true;
    const built = (change.view?.repoChanges ?? []).some((repo) => repo.files.length > 0);
    if (location.pathname === '/' && !hasModel && built) navigate(TAB_PATH.changes, { replace: true });
  }, [change, hasModel, location.pathname, navigate]);

  const notInTheLab = useCallback(() => {
    reportError(
      t('lab.change.notInTheLab', {
        defaultValue: 'This belongs to the public editor. In BESSER Lab, describe the change in the conversation.',
      }),
    );
  }, [t]);

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
        <Button variant="outline" onClick={() => onLeave('/')}>
          {t('lab.change.backToChanges', { defaultValue: 'Back to changes' })}
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

  const updateFromBase = (repo: LabRepoKey) =>
    runAction(`update:${repo}`, async () => {
      try {
        const result = await updateLabChangeFromBase(session, ready.changeId, repo);
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
      onLeave('/');
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

  // What the change is, above its Changes page: the editor's top bar has the title and the actions.
  const facts = (
    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-4 pt-3">
      <Pill className="border-border bg-background font-mono text-muted-foreground">
        {t(`lab.kinds.${ready.kind}`, { defaultValue: ready.kind.replace('_', ' ') })}
      </Pill>
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
  );

  // Notices that concern every page of the change, above it.
  const notices = (behind.length > 0 || state.error !== null) && (
    <div className="shrink-0 space-y-1.5 px-3 pt-2">
      {behind.length > 0 && (
        <div data-testid="lab-change-behind" className="space-y-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
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
        <p role="alert" className="text-xs text-destructive">
          {t('lab.change.refreshFailed', {
            defaultValue: 'The change could not be read again: {{error}}. It is shown as last read.',
            error: describeNetworkError(state.error),
          })}
        </p>
      )}
    </div>
  );

  // In the editor's top bar, where a project has File, Generate and Deploy.
  const actions = (
    <div data-testid="lab-change-actions" className="flex shrink-0 items-center gap-1.5">
      <Pill className={cn('hidden sm:inline-flex', PHASE_TONE[ready.phase])}>{phaseLabel(ready.phase)}</Pill>
      <span className="hidden items-center gap-3 xl:flex">
        <LabKeyChip labKey={home.labKey} />
        <MonthMeter meter={home.meters.user} />
      </span>
      {pushed ? (
        <Button size="sm" disabled={prBlocked} onClick={() => void pushPullRequests()}>
          {busy === 'push' ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
          <span className="hidden md:inline">{t('lab.change.pushPullRequests', { defaultValue: 'Push to the pull requests' })}</span>
        </Button>
      ) : (
        <Button size="sm" disabled={prBlocked} onClick={() => setPullRequestOpen(true)}>
          <GitPullRequest aria-hidden />
          <span className="hidden md:inline">{t('lab.change.openPullRequest', { defaultValue: 'Open pull request' })}</span>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-8', chatOpen && 'bg-foreground/[0.06] text-foreground')}
        aria-pressed={chatOpen}
        aria-label={
          chatOpen
            ? t('lab.change.hideChat', { defaultValue: 'Hide the conversation' })
            : t('lab.change.showChat', { defaultValue: 'Show the conversation' })
        }
        onClick={() => setChatOpen((open) => !open)}
      >
        <MessageSquare aria-hidden />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8" aria-label={t('lab.change.more', { defaultValue: 'More actions' })}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onLeave('/')}>
            <LayoutList aria-hidden />
            {t('lab.change.allChanges', { defaultValue: 'All changes' })}
          </DropdownMenuItem>
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
          <DropdownMenuItem onSelect={() => onLeave('/settings')}>
            <Settings aria-hidden />
            {t('lab.app.header.settings', { defaultValue: 'Settings and usage' })}
          </DropdownMenuItem>
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
  );

  // Docked beside the editor from 1024 px; below it, over the page while open.
  const conversation = (
    <LabChatPane
      change={ready}
      viewer={user.login}
      logic={logic}
      onNewChange={() => onLeave('/')}
      onStopRun={stopRun}
      className={cn(
        // Clipped: its message list scrolls inside it, and must not make the editor's row scrollable.
        'overflow-hidden border-border/50 bg-card dark:border-border/70',
        wide ? 'w-[420px] shrink-0 border-l' : 'absolute inset-0 z-30',
        !chatOpen && 'hidden',
      )}
    />
  );

  const page = (content: React.ReactNode) => (
    <div className="flex h-full min-h-0 flex-col">
      {notices}
      {content}
    </div>
  );

  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <WorkspaceShell
        onOpenProjectHub={() => onLeave('/')}
        onOpenTemplateDialog={notInTheLab}
        onExportProject={notInTheLab}
        onGenerate={notInTheLab}
        onQualityCheck={() => Promise.reject(new Error('The quality check is not part of BESSER Lab.'))}
        showQualityCheck={false}
        generatorMode={generatorMenuMode}
        lab={{ actions, conversation }}
      >
        <Suspense fallback={<SuspenseFallback showSkeleton />}>
          <Routes>
            <Route
              path="/"
              element={page(
                <>
                  {/* Above the canvas, not over it: the proposed classes it asks about stay visible. */}
                  <LabModelProposalBanner className="mx-3 mt-2 max-w-none shadow-none" />
                  <div data-testid="lab-model-tab" className="relative min-h-0 flex-1 overflow-hidden">
                    {projectOpen ? (
                      <EditorView />
                    ) : (
                      <p className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t('lab.change.modelLoading', { defaultValue: 'Opening the model...' })}
                      </p>
                    )}
                  </div>
                </>,
              )}
            />
            <Route
              path="/changes"
              element={page(
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {facts}
                  <LabChangesTab
                    change={ready}
                    githubSession={session}
                    visible={documentVisible}
                    diff={diff}
                    onDiffChange={setDiff}
                    onSendComments={(text) => void logic.handleSubmit(undefined, { overrideText: text })}
                    onOpenPullRequest={logic.openPullRequest}
                    onReviewAction={logic.handleLabReviewAction}
                  />
                </div>,
              )}
            />
            <Route
              path="/try"
              element={page(
                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <LabPreviewTab
                    change={{ changeId: ready.changeId, title: ready.title, owner: ready.owner }}
                    githubSession={session}
                    visible={documentVisible}
                  />
                </div>,
              )}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </WorkspaceShell>

      <LabPullRequestDialog
        open={pullRequestOpen}
        onOpenChange={setPullRequestOpen}
        githubSession={session}
        changeId={ready.changeId}
        title={ready.title}
        issues={ready.view?.issues ?? []}
        onOpened={() => void reload()}
      />
    </ApollonEditorProvider>
  );
};

export default LabChangeView;
