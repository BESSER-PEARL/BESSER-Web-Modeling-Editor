/**
 * The GitHub panel: the current project's repository and everything you do
 * with it. Link or create the repo, see what changed on GitHub since your last
 * sync, save the model, pull, update the app code, and browse the model's
 * history by who changed what.
 */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import {
  AlertTriangle,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FileText,
  GitPullRequest,
  Github,
  History,
  Loader2,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Settings,
  Share2,
  Sparkles,
  Unlink2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useGitHubAuth } from '../hooks/useGitHubAuth';
import { useAutoCommit } from '../hooks/useAutoCommit';
import { useRepoSync, type RepoSyncState } from '../hooks/useRepoSync';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { buildProjectExportEnvelope } from '../../../shared/utils/projectExportUtils';
import { ApollonEditorContext } from '../../editors/uml/apollon-editor-context';
import { globalConfirm } from '../../../shared/services/confirm/globalConfirm';
import { CreateGistDialog, CreateRepositoryDialog, RestoreVersionDialog } from '../dialogs';
import {
  createGist,
  createPullRequest,
  createRepoForProject,
  getModelHistory,
  type ModelHistoryEntry,
  type SaveModelResult,
} from '../services/githubApi';
import { CommitAuthor } from './CommitAuthor';
import { RepoBrowser, type RepoChoice } from './RepoBrowser';

interface GitHubSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/** The prompt "Update code" sends to the assistant; it routes to a Spec-Driven modify run. */
const UPDATE_CODE_PROMPT = 'Update the app code to match my latest model changes.';

// History entries show their first change lines; the rest is one "and N more".
const HISTORY_CHANGE_LINES = 4;

const sanitizeRepoName = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const sectionTitle = 'flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground';

export const GitHubSidebar: React.FC<GitHubSidebarProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const { isAuthenticated, githubSession, login } = useGitHubAuth();
  const { currentProject, updateCurrentDiagram } = useProject();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const sync = useRepoSync();
  const { link, status, state, hasLocalChanges } = sync;

  const [commitMessage, setCommitMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [conflict, setConflict] = useState<SaveModelResult | null>(null);
  const [pullRequestUrl, setPullRequestUrl] = useState<string | null>(null);

  const [history, setHistory] = useState<ModelHistoryEntry[] | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ModelHistoryEntry | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isRepoPrivate, setIsRepoPrivate] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const [showGistModal, setShowGistModal] = useState(false);
  const [gistDescription, setGistDescription] = useState('');
  const [isGistPublic, setIsGistPublic] = useState(false);
  const [isCreatingGist, setIsCreatingGist] = useState(false);

  /** Write the open diagram into the stored project before reading it. */
  const saveCurrentEditorState = useCallback(() => {
    if (editor && currentProject) {
      try {
        updateCurrentDiagram(editor.model);
      } catch (error) {
        console.error('Failed to save editor state:', error);
      }
    }
  }, [editor, currentProject, updateCurrentDiagram]);

  const { settings: autoCommitSettings, updateSettings: updateAutoCommitSettings, isAutoCommitting } = useAutoCommit({
    projectId: currentProject?.id ?? null,
    canCommit: !!link && isAuthenticated,
    hasLocalChanges,
    saveCurrentEditorState,
    save: sync.save,
  });

  const loadHistory = useCallback(async () => {
    if (!link || !githubSession) return;
    setHistory(null);
    setHistoryFailed(false);
    try {
      setHistory(await getModelHistory(githubSession, link.owner, link.repo, link.branch));
    } catch {
      setHistoryFailed(true);
      setHistory([]);
    }
  }, [link, githubSession]);

  useEffect(() => {
    if (isOpen && link && githubSession) void loadHistory();
    // Reload when the branch head moves (a save, a pull, someone else's push).
  }, [isOpen, link?.owner, link?.repo, link?.branch, status?.head_sha, githubSession, loadHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOpen) void sync.refresh();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

  const handleSave = useCallback(async () => {
    if (!commitMessage.trim()) return;
    saveCurrentEditorState();
    setIsSaving(true);
    setConflict(null);
    setPullRequestUrl(null);
    try {
      const result = await sync.save(commitMessage.trim());
      if (result.status === 'conflict') {
        setConflict(result);
        toast.warn(t('github.panel.conflictToast', { defaultValue: 'GitHub could not merge your save automatically.' }));
      } else {
        setCommitMessage('');
        toast.success(
          result.status === 'merged'
            ? t('github.panel.savedMerged', { defaultValue: 'Saved, and merged with the newer changes on GitHub.' })
            : t('github.panel.saved', { defaultValue: 'Model saved to GitHub.' }),
        );
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [commitMessage, saveCurrentEditorState, sync, t]);

  const handlePull = useCallback(async () => {
    if (hasLocalChanges) {
      const confirmed = await globalConfirm({
        title: t('github.linked.pullConfirmTitle'),
        description: t('github.linked.pullConfirmDescription'),
        confirmLabel: t('github.linked.pullConfirmAction'),
        variant: 'danger',
      });
      if (!confirmed) return;
    }
    setIsPulling(true);
    try {
      await sync.pull();
      toast.success(t('github.toasts.projectPulled'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsPulling(false);
    }
  }, [hasLocalChanges, sync, t]);

  const handleOpenPullRequest = useCallback(async () => {
    if (!conflict?.conflict_branch || !link || !githubSession) return;
    try {
      const pr = await createPullRequest(githubSession, {
        owner: link.owner,
        repo: link.repo,
        head: conflict.conflict_branch,
        base: link.branch,
        title: commitMessage.trim() || t('github.panel.prTitle', { defaultValue: 'Model changes from the BESSER editor' }),
      });
      setPullRequestUrl(pr.html_url);
      window.open(pr.html_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [conflict, link, githubSession, commitMessage, t]);

  const handleLink = useCallback(
    async ({ owner, repo, branch, summary }: RepoChoice) => {
      if (!currentProject) return;
      setIsLinking(true);
      try {
        if (summary.has_model) {
          const loadRepoModel = await globalConfirm({
            title: t('github.panel.repoHasModelTitle', { defaultValue: 'This repository already holds a model' }),
            description: t('github.panel.repoHasModelDescription', {
              defaultValue:
                '{{repo}} holds "{{name}}". Load it into this project, replacing the model you have open? Choose Cancel to keep your model; it replaces the repository\'s on your next save.',
              repo: `${owner}/${repo}`,
              name: summary.project_name || repo,
            }),
            confirmLabel: t('github.panel.loadRepoModel', { defaultValue: 'Load the repository model' }),
          });
          if (loadRepoModel) {
            await sync.pullInto({ owner, repo, branch }, currentProject.id);
            toast.success(t('github.toasts.projectLoadedFromRepo'));
            return;
          }
        }
        // Keep the local model; the next save commits it on top of the repo's head.
        sync.linkTo(owner, repo, branch, summary.head_sha || undefined);
        toast.success(t('github.panel.linked', { defaultValue: 'Linked to {{repo}}. Save to put your model in it.', repo: `${owner}/${repo}` }));
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        setIsLinking(false);
      }
    },
    [currentProject, sync, t],
  );

  const handleCreateRepo = useCallback(async () => {
    if (!currentProject || !githubSession || !newRepoName.trim()) return;
    saveCurrentEditorState();
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) {
      toast.error(t('github.toasts.couldNotLoadProjectData'));
      return;
    }
    setIsCreating(true);
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
      setShowCreateModal(false);
      toast.success(t('github.panel.created', { defaultValue: 'Created {{repo}} with your model.', repo: `${result.owner}/${repo}` }));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsCreating(false);
    }
  }, [currentProject, githubSession, newRepoName, newRepoDescription, isRepoPrivate, saveCurrentEditorState, sync, t]);

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    setIsPulling(true);
    try {
      await sync.restore(restoreTarget.sha);
      setRestoreTarget(null);
      toast.success(t('github.toasts.projectRestored'));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsPulling(false);
    }
  }, [restoreTarget, sync, t]);

  const handleUnlink = useCallback(async () => {
    const confirmed = await globalConfirm({
      title: t('github.linked.unlinkConfirmTitle'),
      description: t('github.linked.unlinkConfirmDescription'),
      confirmLabel: t('github.linked.unlinkConfirmAction'),
      variant: 'danger',
    });
    if (!confirmed) return;
    sync.unlink();
    toast.info(t('github.toasts.repoUnlinked'));
  }, [sync, t]);

  const handleUpdateCode = useCallback(() => {
    saveCurrentEditorState();
    onClose();
    window.dispatchEvent(new CustomEvent('wme:assistant-run-prompt', { detail: { prompt: UPDATE_CODE_PROMPT } }));
  }, [saveCurrentEditorState, onClose]);

  const handleCreateGist = useCallback(async () => {
    if (!currentProject || !githubSession) return;
    saveCurrentEditorState();
    const project = ProjectStorageRepository.loadProject(currentProject.id);
    if (!project) {
      toast.error(t('github.toasts.couldNotLoadProjectData'));
      return;
    }
    setIsCreatingGist(true);
    try {
      const result = await createGist(
        githubSession,
        project,
        gistDescription || t('github.defaultGistDescription', { name: project.name }),
        isGistPublic,
      );
      setShowGistModal(false);
      toast.success(t('github.toasts.gistCreated'));
      window.open(result.gist_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setIsCreatingGist(false);
    }
  }, [currentProject, githubSession, gistDescription, isGistPublic, saveCurrentEditorState, t]);

  const renderUnauthenticated = () => (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/70 bg-muted/30 px-5 py-10 text-center">
      <Github className="mx-auto size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{t('github.connect.title')}</p>
        <p className="text-xs text-muted-foreground">{t('github.connect.subtitle')}</p>
      </div>
      <Button onClick={login} className="gap-2">
        <Github className="size-4" />
        {t('github.connect.button')}
      </Button>
    </div>
  );

  const renderNoProject = () => (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/70 bg-muted/30 px-5 py-10 text-center">
      <AlertTriangle className="mx-auto size-8 text-warning" />
      <p className="text-sm font-semibold">{t('github.noProject.title')}</p>
      <p className="text-xs text-muted-foreground">{t('github.noProject.subtitle')}</p>
    </div>
  );

  const renderNotLinked = () => (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold">{t('github.notLinked.title')}</p>
          <p className="text-xs text-muted-foreground">
            {t('github.panel.notLinkedHint', {
              defaultValue: 'A linked repository keeps your model, its history and your app code in one place, for you and your team.',
            })}
          </p>
        </div>
        <Button
          className="gap-2"
          onClick={() => {
            if (currentProject) {
              setNewRepoName(sanitizeRepoName(currentProject.name) || 'project');
              setNewRepoDescription(currentProject.description);
            }
            setShowCreateModal(true);
          }}
        >
          <PlusCircle className="size-4" />
          {t('github.notLinked.createNew')}
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <div className={sectionTitle}>{t('github.notLinked.linkExisting')}</div>
        {githubSession && (
          <RepoBrowser
            githubSession={githubSession}
            actionLabel={t('github.panel.linkAction', { defaultValue: 'Link to this project' })}
            onAction={handleLink}
            busy={isLinking}
            allowWithoutModel
          />
        )}
      </section>
    </div>
  );

  const renderLinked = () => {
    if (!link) return null;
    const commitsSince = status?.commits_since ?? [];
    return (
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-slate-900 p-2 text-white">
              <Github className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" title={`${link.owner}/${link.repo}`}>
                {link.owner}/{link.repo}
              </p>
              <Badge variant="secondary" className="mt-1 text-[11px]">
                {link.branch}
              </Badge>
            </div>
            <Button size="icon" variant="ghost" className="size-8" asChild>
              <a
                href={`https://github.com/${link.owner}/${link.repo}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('github.linked.openOnGitHub')}
                title={t('github.linked.openOnGitHub')}
              >
                <ExternalLink className="size-4" />
              </a>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-destructive hover:text-destructive"
              onClick={() => void handleUnlink()}
              aria-label={t('github.linked.unlink')}
              title={t('github.linked.unlink')}
            >
              <Unlink2 className="size-4" />
            </Button>
          </div>
          <SyncStateLine state={state} commitsBehind={commitsSince.length} />
        </section>

        {commitsSince.length > 0 && (
          <section className="flex flex-col gap-2">
            <div className={sectionTitle}>
              <CloudDownload className="size-3.5" />
              {t('github.panel.newOnGitHub', { defaultValue: 'New on GitHub since your last sync' })}
            </div>
            <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
              {commitsSince.slice(0, 5).map((commit) => (
                <li key={commit.sha} className="flex flex-col gap-1 px-3 py-2">
                  <p className="line-clamp-1 text-sm font-medium">{commit.message.split('\n')[0]}</p>
                  <CommitAuthor commit={commit} />
                </li>
              ))}
            </ul>
            <Button variant="outline" className="gap-2" onClick={() => void handlePull()} disabled={isPulling}>
              {isPulling ? <Loader2 className="size-4 animate-spin" /> : <CloudDownload className="size-4" />}
              {t('github.panel.pullLatest', { defaultValue: 'Pull the latest version' })}
            </Button>
          </section>
        )}

        <section className="flex flex-col gap-2">
          <div className={sectionTitle}>
            <CloudUpload className="size-3.5" />
            {t('github.panel.saveTitle', { defaultValue: 'Save the model' })}
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3">
            <Textarea
              rows={2}
              value={commitMessage}
              onChange={(event) => setCommitMessage(event.target.value)}
              placeholder={t('github.panel.commitPlaceholder', { defaultValue: 'What changed? e.g. Add the Loan class' })}
              aria-label={t('github.commit.messageLabel', { defaultValue: 'Commit message' })}
            />
            <Button className="gap-2" onClick={() => void handleSave()} disabled={isSaving || !commitMessage.trim()}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
              {t('github.panel.saveAction', { defaultValue: 'Save to GitHub' })}
            </Button>
            {!hasLocalChanges && (
              <p className="text-[11px] text-muted-foreground">
                {t('github.panel.nothingToSave', { defaultValue: 'Your model matches the repository.' })}
              </p>
            )}
            {conflict && (
              <div role="alert" className="flex flex-col gap-2 rounded-md border border-warning/40 bg-warning/10 p-2.5 text-xs">
                <p>
                  {t('github.panel.conflict', {
                    defaultValue:
                      'Your save and a newer change on GitHub touch the same part of the model, so GitHub could not merge them. Your save is on the branch {{branch}}; nothing was overwritten.',
                    branch: conflict.conflict_branch,
                  })}
                </p>
                {pullRequestUrl ? (
                  <a href={pullRequestUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                    {t('github.panel.prOpened', { defaultValue: 'Pull request opened' })}
                  </a>
                ) : (
                  <Button size="sm" variant="outline" className="gap-1.5 self-start" onClick={() => void handleOpenPullRequest()}>
                    <GitPullRequest className="size-3.5" />
                    {t('github.panel.openPr', { defaultValue: 'Open a pull request to merge it' })}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className={sectionTitle}>
            <Sparkles className="size-3.5" />
            {t('github.panel.codeTitle', { defaultValue: 'App code' })}
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card p-3">
            <p className="text-xs text-muted-foreground">
              {t('github.panel.codeHint', {
                defaultValue: "The Spec-Driven Agent updates this repository's app to match your model. You review the run, then push it here.",
              })}
            </p>
            <Button variant="outline" className="gap-2" onClick={handleUpdateCode}>
              <Sparkles className="size-4" />
              {t('github.panel.updateCode', { defaultValue: 'Update the app code' })}
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className={sectionTitle}>
            <History className="size-3.5" />
            {t('github.panel.historyTitle', { defaultValue: 'Model history' })}
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto size-7"
              onClick={() => void loadHistory()}
              disabled={history === null}
              aria-label={t('github.linked.refreshHistory')}
            >
              {history === null ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-card">
            {history === null ? (
              <div role="status" className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span className="sr-only">{t('common.loading')}</span>
              </div>
            ) : historyFailed ? (
              <p className="px-4 py-6 text-center text-xs text-destructive">
                {t('github.panel.historyFailed', { defaultValue: 'Could not load the history.' })}
              </p>
            ) : history.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted-foreground">{t('github.linked.noCommits')}</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {history.map((entry, index) => (
                  <li key={entry.sha} className="flex flex-col gap-1.5 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <p className="line-clamp-2 flex-1 text-sm font-medium">
                        {index === 0 && (
                          <Badge variant="soft" size="sm" className="mr-2">
                            {t('github.linked.latest')}
                          </Badge>
                        )}
                        {entry.message.split('\n')[0]}
                      </p>
                      {index > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0"
                          onClick={() => setRestoreTarget(entry)}
                          aria-label={t('github.panel.restoreVersion', { defaultValue: 'Restore this version' })}
                          title={t('github.panel.restoreVersion', { defaultValue: 'Restore this version' })}
                        >
                          <RotateCcw className="size-3.5" />
                        </Button>
                      )}
                    </div>
                    <CommitAuthor commit={entry} />
                    {entry.changes.length > 0 && (
                      <ul className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
                        {entry.changes.slice(0, HISTORY_CHANGE_LINES).map((change) => (
                          <li key={change} className="truncate font-mono" title={change}>
                            {change}
                          </li>
                        ))}
                        {entry.changes.length > HISTORY_CHANGE_LINES && (
                          <li>
                            {t('github.panel.moreChanges', {
                              defaultValue: 'and {{count}} more',
                              count: entry.changes.length - HISTORY_CHANGE_LINES,
                            })}
                          </li>
                        )}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className={sectionTitle}>
            <Share2 className="size-3.5" />
            {t('github.linked.share')}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => {
              setGistDescription(currentProject ? t('github.defaultGistDescription', { name: currentProject.name }) : '');
              setShowGistModal(true);
            }}
          >
            <FileText className="size-4" />
            {t('github.linked.createSecretGist')}
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <div className={sectionTitle}>
            <Settings className="size-3.5" />
            {t('github.settings.title')}
          </div>
          <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="github-autocommit-enabled"
                className="mt-0.5"
                checked={autoCommitSettings.enabled}
                onCheckedChange={(checked) => updateAutoCommitSettings({ enabled: checked === true })}
              />
              <div className="flex flex-col gap-1">
                <Label htmlFor="github-autocommit-enabled">{t('github.settings.autoCommit')}</Label>
                <p className="text-xs text-muted-foreground">
                  {autoCommitSettings.enabled
                    ? t('github.settings.enabledWithInterval', { minutes: autoCommitSettings.intervalMinutes })
                    : t('github.settings.disabled')}
                </p>
              </div>
            </div>
            {autoCommitSettings.enabled && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="github-autocommit-interval" className="text-xs">
                  {t('github.settings.intervalLabel')}
                </Label>
                <Select
                  value={String(autoCommitSettings.intervalMinutes)}
                  onValueChange={(value) => updateAutoCommitSettings({ intervalMinutes: parseInt(value, 10) })}
                >
                  <SelectTrigger id="github-autocommit-interval" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">{t('github.settings.interval5')}</SelectItem>
                    <SelectItem value="10">{t('github.settings.interval10')}</SelectItem>
                    <SelectItem value="15">{t('github.settings.interval15')}</SelectItem>
                    <SelectItem value="30">{t('github.settings.interval30')}</SelectItem>
                    <SelectItem value="60">{t('github.settings.interval60')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {isAutoCommitting && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {t('github.settings.autoSaving')}
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-40 bg-black/30 transition-[opacity,visibility] duration-200 motion-reduce:transition-none',
          isOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t('github.sync')}
        className={cn(
          'absolute bottom-0 right-0 top-0 z-50 w-[400px] max-w-[96vw] border-l border-border/70 bg-background shadow-elevation-3 transition-[transform,opacity,visibility] duration-200 motion-reduce:transition-none',
          isOpen
            ? 'visible translate-x-0 opacity-100 pointer-events-auto'
            : 'invisible translate-x-full opacity-0 pointer-events-none',
        )}
      >
        <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Github className="size-4" />
            {t('github.sync')}
          </h3>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label={t('github.closeSidebar')}>
            <X className="size-4" />
          </Button>
        </header>

        <div className="h-[calc(100%-53px)] overflow-y-auto overscroll-contain p-4">
          {!isAuthenticated ? renderUnauthenticated() : !currentProject ? renderNoProject() : link ? renderLinked() : renderNotLinked()}
        </div>
      </aside>

      <CreateRepositoryDialog
        open={showCreateModal}
        isLoading={isCreating}
        repoName={newRepoName}
        repoDescription={newRepoDescription}
        isRepoPrivate={isRepoPrivate}
        onOpenChange={setShowCreateModal}
        onRepoNameChange={setNewRepoName}
        onRepoDescriptionChange={setNewRepoDescription}
        onRepoPrivateChange={setIsRepoPrivate}
        onCreate={() => void handleCreateRepo()}
      />

      <RestoreVersionDialog
        open={restoreTarget !== null}
        isSaving={isPulling}
        selectedCommit={restoreTarget}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        onRestore={() => void handleRestore()}
      />

      <CreateGistDialog
        open={showGistModal}
        isLoading={isCreatingGist}
        description={gistDescription}
        isPublic={isGistPublic}
        onOpenChange={setShowGistModal}
        onDescriptionChange={setGistDescription}
        onPublicChange={setIsGistPublic}
        onCreate={() => void handleCreateGist()}
      />
    </>
  );
};

/** One line saying how the project relates to its repository. */
export const SyncStateLine: React.FC<{ state: RepoSyncState; commitsBehind: number; className?: string }> = ({
  state,
  commitsBehind,
  className,
}) => {
  const { t } = useTranslation();
  const look: Record<RepoSyncState, { tone: string; icon: React.ReactNode; text: string }> = {
    'signed-out': { tone: 'muted', icon: <Github className="size-3.5" />, text: t('github.status.signedOut', { defaultValue: 'Connect GitHub to see the repository status' }) },
    unlinked: { tone: 'muted', icon: <Github className="size-3.5" />, text: t('github.status.unlinked', { defaultValue: 'Not linked to a repository' }) },
    checking: { tone: 'muted', icon: <Loader2 className="size-3.5 animate-spin" />, text: t('github.linked.checking') },
    unknown: { tone: 'muted', icon: <AlertTriangle className="size-3.5" />, text: t('github.status.unknown', { defaultValue: 'Could not reach the repository' }) },
    'in-sync': { tone: 'good', icon: <CheckCircle2 className="size-3.5" />, text: t('github.status.inSync', { defaultValue: 'In sync with GitHub' }) },
    'local-changes': { tone: 'warn', icon: <CloudUpload className="size-3.5" />, text: t('github.status.localChanges', { defaultValue: 'Model changes not saved to GitHub' }) },
    behind: {
      tone: 'warn',
      icon: <CloudDownload className="size-3.5" />,
      text: t('github.status.behind', { defaultValue: '{{count}} new commits on GitHub', count: commitsBehind }),
    },
    diverged: {
      tone: 'warn',
      icon: <AlertTriangle className="size-3.5" />,
      text: t('github.status.diverged', {
        defaultValue: 'Changed here and on GitHub ({{count}} new commits). Save to merge both, or pull to take the GitHub version.',
        count: commitsBehind,
      }),
    },
  };
  const { tone, icon, text } = look[state];
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2.5 py-2 text-xs',
        tone === 'good' && 'border border-success/30 bg-success/10 text-success',
        tone === 'warn' && 'border border-warning/30 bg-warning/10 text-warning',
        tone === 'muted' && 'border border-border/70 bg-muted/40 text-muted-foreground',
        className,
      )}
    >
      {icon}
      {text}
    </div>
  );
};

export default GitHubSidebar;
