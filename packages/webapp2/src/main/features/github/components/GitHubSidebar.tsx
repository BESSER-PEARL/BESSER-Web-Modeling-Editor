import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudDownload,
  CloudUpload,
  ExternalLink,
  FileText,
  FolderOpen,
  Github,
  History,
  Link2,
  Loader2,
  PlusCircle,
  RefreshCw,
  Settings,
  Share2,
  Unlink2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useGitHubAuth } from '../hooks/useGitHubAuth';
import {
  GitHubCommit,
  GitHubContentItem,
  GitHubRepository,
  useGitHubStorage,
} from '../hooks/useGitHubStorage';
import { useAutoCommit } from '../hooks/useAutoCommit';
import { useProject } from '../../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { toast } from 'react-toastify';
import { FileBrowserModal } from './FileBrowserModal';
import { CommitDialog, CreateGistDialog, CreateRepositoryDialog, RestoreVersionDialog } from '../dialogs';
import { ApollonEditorContext } from '../../editors/uml/apollon-editor-context';
import { notifyError } from '../../../shared/utils/notifyError';
import { BesserProject } from '../../../shared/types/project';

interface GitHubSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type LinkStep = 'select' | 'configure';
type SidebarState = 'synced' | 'pending' | 'error';

const statusClass: Record<SidebarState, string> = {
  synced: 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  pending: 'border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  error: 'border border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const spinner = <Loader2 className="size-4 animate-spin" />;

const sanitizeRepoName = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const GitHubSidebar: React.FC<GitHubSidebarProps> = ({ isOpen, onClose }) => {
  const { isAuthenticated, githubSession, login } = useGitHubAuth();
  const { currentProject, updateCurrentDiagram, loadProject } = useProject();
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;

  const {
    isLoading,
    repositories,
    commits,
    linkedRepo,
    fetchRepositories,
    fetchBranches,
    fetchCommits,
    fetchRepoContents,
    saveProjectToGitHub,
    loadProjectFromGitHub,
    loadProjectFromCommit,
    createRepositoryForProject,
    unlinkRepo,
    initLinkedRepo,
    checkForChanges,
    checkFileExists,
    linkRepoOnly,
    createGist,
  } = useGitHubStorage();

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCommitModal, setShowCommitModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showGistModal, setShowGistModal] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);

  const [commitMessage, setCommitMessage] = useState('');
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [isRepoPrivate, setIsRepoPrivate] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<GitHubCommit | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isCheckingChanges, setIsCheckingChanges] = useState(false);

  const [linkStep, setLinkStep] = useState<LinkStep>('select');
  const [availableBranches, setAvailableBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [linkFileName, setLinkFileName] = useState('');
  const [linkFolderPath, setLinkFolderPath] = useState('');
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [isCheckingFile, setIsCheckingFile] = useState(false);

  const [createFileName, setCreateFileName] = useState('');
  const [createFolderPath, setCreateFolderPath] = useState('');

  const [gistDescription, setGistDescription] = useState('');
  const [isGistPublic, setIsGistPublic] = useState(false);

  const toProjectJsonFileName = useCallback((value: string): string => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/^_+|_+$/g, '');

    return `${normalized || 'project'}.json`;
  }, []);

  const resetLinkModalState = useCallback(() => {
    setShowLinkModal(false);
    setLinkStep('select');
    setSelectedRepo(null);
    setAvailableBranches([]);
    setSelectedBranch('');
    setLinkFileName('');
    setLinkFolderPath('');
    setFileExists(null);
    setShowFileBrowser(false);
  }, []);

  const persistAndActivateProject = useCallback(
    async (
      project: BesserProject,
      link?: { owner: string; repo: string; branch: string; filePath: string },
      successMessage?: string,
    ): Promise<boolean> => {
      try {
        ProjectStorageRepository.saveProject(project);

        if (link) {
          linkRepoOnly(project.id, link.owner, link.repo, link.branch, link.filePath);
        }

        await loadProject(project.id);

        if (successMessage) {
          toast.success(successMessage);
        }

        return true;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load project';
        toast.error(message);
        return false;
      }
    },
    [linkRepoOnly, loadProject],
  );

  const saveCurrentEditorState = useCallback(() => {
    if (!editor || !currentProject) {
      return true;
    }

    try {
      const currentModel = editor.model;
      updateCurrentDiagram(currentModel);

      const project = ProjectStorageRepository.loadProject(currentProject.id);
      if (project) {
        ProjectStorageRepository.saveProject(project);
      }
      return true;
    } catch (error) {
      console.error('Failed to save editor state:', error);
      return false;
    }
  }, [editor, currentProject, updateCurrentDiagram]);

  const { settings: autoCommitSettings, updateSettings: updateAutoCommitSettings, isAutoCommitting } = useAutoCommit({
    githubSession,
    projectId: currentProject?.id || null,
    linkedRepo,
    saveCurrentEditorState,
  });

  const computedFilePath = linkFolderPath
    ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
    : linkFileName;

  const sidebarSyncState: SidebarState = useMemo(() => {
    if (isCheckingChanges) {
      return 'pending';
    }
    return hasChanges ? 'pending' : 'synced';
  }, [hasChanges, isCheckingChanges]);

  const sortedRepositories = useMemo(() => {
    return [...repositories].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [repositories]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  useEffect(() => {
    if (currentProject?.id) {
      initLinkedRepo(currentProject.id);
    }
  }, [currentProject?.id, initLinkedRepo]);

  useEffect(() => {
    if (showLinkModal && isAuthenticated && githubSession) {
      fetchRepositories(githubSession).catch(notifyError('Fetching repositories'));
    }
  }, [showLinkModal, isAuthenticated, githubSession, fetchRepositories]);

  useEffect(() => {
    if (isOpen && linkedRepo && isAuthenticated && githubSession) {
      fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath).catch(notifyError('Fetching commits'));
    }
  }, [isOpen, linkedRepo, isAuthenticated, githubSession, fetchCommits]);

  useEffect(() => {
    const checkChanges = async () => {
      if (!isOpen || !linkedRepo || !isAuthenticated || !githubSession || !currentProject) {
        return;
      }

      setIsCheckingChanges(true);

      try {
        const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
        if (latestProject) {
          const hasDiff = await checkForChanges(githubSession, latestProject, linkedRepo);
          setHasChanges(hasDiff);
        }
      } catch (error) {
        console.error('Failed to check for changes:', error);
      } finally {
        setIsCheckingChanges(false);
      }
    };

    checkChanges().catch(notifyError('Checking for changes'));
  }, [isOpen, linkedRepo, isAuthenticated, githubSession, currentProject, checkForChanges]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSave = useCallback(async () => {
    if (!linkedRepo || !currentProject || !githubSession) {
      return;
    }

    saveCurrentEditorState();
    await new Promise((resolve) => setTimeout(resolve, 100));
    setShowCommitModal(true);
  }, [linkedRepo, currentProject, githubSession, saveCurrentEditorState]);

  const handleConfirmSave = useCallback(async () => {
    if (!linkedRepo || !currentProject || !githubSession || !commitMessage.trim()) {
      return;
    }

    setIsSaving(true);

    saveCurrentEditorState();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      setIsSaving(false);
      return;
    }

    const result = await saveProjectToGitHub(
      githubSession,
      latestProject,
      linkedRepo.owner,
      linkedRepo.repo,
      commitMessage,
      linkedRepo.branch,
      linkedRepo.filePath,
    );

    if (result.success) {
      setShowCommitModal(false);
      setCommitMessage('');
      await fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath);
      setHasChanges(false);
    }

    setIsSaving(false);
  }, [
    linkedRepo,
    currentProject,
    githubSession,
    commitMessage,
    saveProjectToGitHub,
    fetchCommits,
    saveCurrentEditorState,
  ]);

  const handleLoad = useCallback(async () => {
    if (!linkedRepo || !githubSession) {
      return;
    }

    const project = await loadProjectFromGitHub(
      githubSession,
      linkedRepo.owner,
      linkedRepo.repo,
      linkedRepo.branch,
      linkedRepo.filePath,
    );

    if (!project) {
      return;
    }

    const activated = await persistAndActivateProject(
      project,
      {
        owner: linkedRepo.owner,
        repo: linkedRepo.repo,
        branch: linkedRepo.branch,
        filePath: linkedRepo.filePath,
      },
      'Project pulled from GitHub',
    );

    if (activated) {
      onClose();
    }
  }, [linkedRepo, githubSession, loadProjectFromGitHub, onClose, persistAndActivateProject]);

  const handleSelectRepo = useCallback(
    async (repo: GitHubRepository) => {
      if (!githubSession || !currentProject) {
        return;
      }

      setSelectedRepo(repo);
      setSelectedBranch(repo.default_branch);
      setLinkFileName(toProjectJsonFileName(currentProject.name));
      setLinkFolderPath('');
      setFileExists(null);

      const branches = await fetchBranches(githubSession, repo.full_name.split('/')[0], repo.name);
      setAvailableBranches(branches.length > 0 ? branches : [repo.default_branch]);
      setLinkStep('configure');
    },
    [githubSession, currentProject, fetchBranches, toProjectJsonFileName],
  );

  const handleCheckFileExists = useCallback(async () => {
    if (!githubSession || !selectedRepo || !linkFileName) {
      return;
    }

    setIsCheckingFile(true);

    const fullPath = linkFolderPath
      ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
      : linkFileName;

    const exists = await checkFileExists(
      githubSession,
      selectedRepo.full_name.split('/')[0],
      selectedRepo.name,
      selectedBranch,
      fullPath,
    );

    setFileExists(exists);
    setIsCheckingFile(false);
  }, [githubSession, selectedRepo, linkFileName, linkFolderPath, selectedBranch, checkFileExists]);

  const handleLoadFromRepo = useCallback(async (): Promise<boolean> => {
    if (!githubSession || !selectedRepo) {
      return false;
    }

    const [owner, repo] = selectedRepo.full_name.split('/');
    const fullPath = linkFolderPath
      ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
      : linkFileName;

    const project = await loadProjectFromGitHub(githubSession, owner, repo, selectedBranch, fullPath);

    if (!project) {
      return false;
    }

    return persistAndActivateProject(
      project,
      { owner, repo, branch: selectedBranch, filePath: fullPath },
      'Project loaded from GitHub repository',
    );
  }, [githubSession, selectedRepo, linkFolderPath, linkFileName, loadProjectFromGitHub, selectedBranch, persistAndActivateProject]);

  const handleConfirmLink = useCallback(
    async (linkOnly: boolean = false) => {
      if (!currentProject || !selectedRepo) {
        return;
      }

      const [owner, repo] = selectedRepo.full_name.split('/');
      const fullPath = linkFolderPath
        ? `${linkFolderPath.replace(/^\/+|\/+$/g, '')}/${linkFileName}`
        : linkFileName;
      let targetFileExists = fileExists;

      if (!linkOnly) {
        if (targetFileExists === null) {
          try {
            targetFileExists = await checkFileExists(
              githubSession ?? '',
              owner,
              repo,
              selectedBranch,
              fullPath,
            );
            setFileExists(targetFileExists);
          } catch (error) {
            console.error('Failed to verify file existence before linking:', error);
          }
        }

        if (targetFileExists) {
          const loaded = await handleLoadFromRepo();
          if (loaded) {
            resetLinkModalState();
            onClose();
            return;
          }
          toast.warn('Could not load from repo; linking without loading.');
        }
      }

      if (!linkOnly && targetFileExists === false) {
        if (!githubSession) {
          linkRepoOnly(currentProject.id, owner, repo, selectedBranch, fullPath);
          toast.warn('Repository linked. Reconnect GitHub to push the initial project file.');
          resetLinkModalState();
          return;
        }

        saveCurrentEditorState();
        await new Promise((resolve) => setTimeout(resolve, 100));

        const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
        if (!latestProject) {
          linkRepoOnly(currentProject.id, owner, repo, selectedBranch, fullPath);
          toast.warn('Repository linked, but initial push failed because the local project could not be read.');
          resetLinkModalState();
          return;
        }

        const initialPushResult = await saveProjectToGitHub(
          githubSession,
          latestProject,
          owner,
          repo,
          'Initial sync from BESSER Web Modeling Editor',
          selectedBranch,
          fullPath,
        );

        if (initialPushResult.success) {
          await fetchCommits(githubSession, owner, repo, fullPath);
          setHasChanges(false);
          resetLinkModalState();
          return;
        } else {
          linkRepoOnly(currentProject.id, owner, repo, selectedBranch, fullPath);
          toast.warn('Repository linked, but initial push failed. You can push manually from GitHub Sync.');
          resetLinkModalState();
          return;
        }
      }

      linkRepoOnly(
        currentProject.id,
        owner,
        repo,
        selectedBranch,
        fullPath,
      );

      resetLinkModalState();
    },
    [
      currentProject,
      selectedRepo,
      linkFolderPath,
      linkFileName,
      fileExists,
      checkFileExists,
      githubSession,
      selectedBranch,
      handleLoadFromRepo,
      linkRepoOnly,
      saveCurrentEditorState,
      saveProjectToGitHub,
      fetchCommits,
      onClose,
      resetLinkModalState,
    ],
  );

  const fetchSelectedRepoContents = useCallback(
    async (path: string = ''): Promise<GitHubContentItem[]> => {
      if (!githubSession || !selectedRepo) {
        return [];
      }

      try {
        const [owner, repo] = selectedRepo.full_name.split('/');
        return await fetchRepoContents(githubSession, owner, repo, path, selectedBranch || selectedRepo.default_branch);
      } catch (error) {
        console.error('Failed to load repository contents:', error);
        toast.error('Could not load repository contents');
        return [];
      }
    },
    [githubSession, selectedRepo, fetchRepoContents, selectedBranch],
  );

  const handleFileSelectedFromBrowser = useCallback((path: string) => {
    const sanitized = path.replace(/^\/+/, '');
    const segments = sanitized.split('/');
    const file = segments.pop() || '';
    const folder = segments.join('/');

    setLinkFileName(file);
    setLinkFolderPath(folder);
    setFileExists(null);
  }, []);

  const handleCreateRepo = useCallback(async () => {
    if (!currentProject || !githubSession || !newRepoName.trim() || !createFileName.trim()) {
      return;
    }

    saveCurrentEditorState();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }

    const fullPath = createFolderPath
      ? `${createFolderPath.replace(/^\/+|\/+$/g, '')}/${createFileName}`
      : createFileName;

    const result = await createRepositoryForProject(
      githubSession,
      latestProject,
      newRepoName,
      newRepoDescription || `BESSER project: ${latestProject.name}`,
      isRepoPrivate,
      fullPath,
    );

    if (result.success) {
      setShowCreateModal(false);
      setNewRepoName('');
      setNewRepoDescription('');
      setIsRepoPrivate(false);
      setCreateFileName('');
      setCreateFolderPath('');
    }
  }, [
    currentProject,
    githubSession,
    newRepoName,
    createFileName,
    createFolderPath,
    newRepoDescription,
    isRepoPrivate,
    createRepositoryForProject,
    saveCurrentEditorState,
  ]);

  const handleUnlink = useCallback(() => {
    if (!currentProject?.id) {
      return;
    }

    unlinkRepo(currentProject.id);
    toast.info('Repository unlinked');
  }, [currentProject?.id, unlinkRepo]);

  const handleCommitClick = useCallback(
    (commit: GitHubCommit) => {
      const isLatest = commits.length > 0 && commits[0].sha === commit.sha;
      if (isLatest) {
        toast.info('This is already the latest version');
        return;
      }

      setSelectedCommit(commit);
      setShowRestoreModal(true);
    },
    [commits],
  );

  const handleRestoreCommit = useCallback(async () => {
    if (!linkedRepo || !githubSession || !selectedCommit) {
      return;
    }

    setIsSaving(true);

    const project = await loadProjectFromCommit(
      githubSession,
      linkedRepo.owner,
      linkedRepo.repo,
      selectedCommit.sha,
      linkedRepo.filePath,
    );

    if (project) {
      const activated = await persistAndActivateProject(
        project,
        {
          owner: linkedRepo.owner,
          repo: linkedRepo.repo,
          branch: linkedRepo.branch,
          filePath: linkedRepo.filePath,
        },
        'Project restored from selected commit',
      );

      if (activated) {
        setShowRestoreModal(false);
        setSelectedCommit(null);
        onClose();
      }
    }

    setIsSaving(false);
  }, [linkedRepo, githubSession, selectedCommit, loadProjectFromCommit, persistAndActivateProject, onClose]);

  const handleCreateGist = useCallback(async () => {
    if (!currentProject || !githubSession) {
      return;
    }

    saveCurrentEditorState();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const latestProject = ProjectStorageRepository.loadProject(currentProject.id);
    if (!latestProject) {
      toast.error('Could not load project data');
      return;
    }

    const result = await createGist(
      githubSession,
      latestProject,
      gistDescription || `BESSER Project: ${latestProject.name}`,
      isGistPublic,
    );

    if (result.success && result.gistUrl) {
      setShowGistModal(false);
      setGistDescription('');
      setIsGistPublic(false);
      window.open(result.gistUrl, '_blank');
    }
  }, [currentProject, githubSession, createGist, gistDescription, isGistPublic, saveCurrentEditorState]);

  const renderUnauthenticated = () => (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/70 bg-muted/30 px-5 py-10 text-center">
      <Github className="mx-auto size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Connect to GitHub</p>
        <p className="text-xs text-muted-foreground">Sign in to sync your projects with GitHub.</p>
      </div>
      <Button onClick={login} className="gap-2">
        <Github className="size-4" />
        Connect GitHub
      </Button>
    </div>
  );

  const renderNoProject = () => (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border/70 bg-muted/30 px-5 py-10 text-center">
      <AlertTriangle className="mx-auto size-8 text-amber-600" />
      <p className="text-sm font-semibold">No Project Selected</p>
      <p className="text-xs text-muted-foreground">Open or create a project to use GitHub sync.</p>
    </div>
  );

  const renderNotLinked = () => (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-border/70 bg-muted/30 px-5 py-8 text-center">
      <Link2 className="mx-auto size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">Link a Repository</p>
        <p className="text-xs text-muted-foreground">Connect this project to a GitHub repo for version control.</p>
      </div>
      <div className="grid gap-2">
        <Button variant="outline" className="gap-2" onClick={() => setShowLinkModal(true)}>
          <Link2 className="size-4" />
          Link Existing
        </Button>
        <Button
          className="gap-2"
          onClick={() => {
            if (currentProject) {
              const sanitizedName = sanitizeRepoName(currentProject.name);
              setNewRepoName(sanitizedName || 'project');
              setNewRepoDescription(currentProject.description);
              setCreateFileName(toProjectJsonFileName(currentProject.name));
              setCreateFolderPath('');
            }
            setShowCreateModal(true);
          }}
        >
          <PlusCircle className="size-4" />
          Create New
        </Button>
      </div>
    </div>
  );

  const renderLinked = () => (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Link2 className="size-3.5" />
          Repository
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-md bg-slate-900 p-2 text-white">
              <Github className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {linkedRepo?.owner}/{linkedRepo?.repo}
              </p>
              <Badge variant="secondary" className="mt-1 text-[11px]">
                {linkedRepo?.branch}
              </Badge>
            </div>
          </div>

          <div className={cn('flex items-center gap-2 rounded-md px-2.5 py-2 text-xs', statusClass[sidebarSyncState])}>
            {isCheckingChanges ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Checking...
              </>
            ) : hasChanges ? (
              <>
                <AlertTriangle className="size-3.5" />
                You have unsaved changes
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                Up to date
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1" onClick={() => { handleSave().catch(notifyError('GitHub push')); }} disabled={isLoading}>
              <CloudUpload className="size-3.5" />
              Push
            </Button>
            <Button size="sm" variant="outline" className="gap-1" onClick={() => { handleLoad().catch(notifyError('GitHub pull')); }} disabled={isLoading}>
              <CloudDownload className="size-3.5" />
              Pull
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={`https://github.com/${linkedRepo?.owner}/${linkedRepo?.repo}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={handleUnlink} className="text-destructive hover:text-destructive">
              <Unlink2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <History className="size-3.5" />
          History
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto size-7"
            onClick={() => linkedRepo && githubSession && fetchCommits(githubSession, linkedRepo.owner, linkedRepo.repo, linkedRepo.filePath)}
            disabled={isLoading}
            aria-label="Refresh commit history"
          >
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-border/70 bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">{spinner}</div>
          ) : commits.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {commits.slice(0, 10).map((commit, index) => {
                const canRestore = index > 0;
                return (
                  <li key={commit.sha}>
                    <button
                      type="button"
                      disabled={!canRestore}
                      onClick={() => canRestore && handleCommitClick(commit)}
                      className={cn(
                        'w-full px-3 py-2.5 text-left transition-colors',
                        canRestore ? 'hover:bg-muted/40' : 'cursor-default',
                      )}
                    >
                      <div className="flex flex-col gap-1">
                        <p className="line-clamp-2 text-sm font-medium">
                          {index === 0 && (
                            <Badge className="mr-2 bg-emerald-600 text-[10px] text-white hover:bg-emerald-600">Latest</Badge>
                          )}
                          {commit.message}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{commit.author}</span>
                          <span>-</span>
                          <span>{formatDate(commit.date)}</span>
                          <a
                            href={commit.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded bg-muted px-1.5 py-0.5 font-mono hover:bg-muted/80"
                          >
                            {commit.sha.substring(0, 7)}
                          </a>
                          {canRestore && <span className="text-amber-700">Click to restore</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">No commits yet</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Share2 className="size-3.5" />
          Share
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2"
          onClick={() => {
            setGistDescription(currentProject ? `BESSER Project: ${currentProject.name}` : '');
            setShowGistModal(true);
          }}
        >
          <FileText className="size-4" />
          Create Secret Gist
        </Button>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Settings className="size-3.5" />
          Settings
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3">
          <label className="flex items-center justify-between gap-2 text-sm">
            <div>
              <p className="font-medium">Auto-commit</p>
              <p className="text-xs text-muted-foreground">
                {autoCommitSettings.enabled ? `Enabled (${autoCommitSettings.intervalMinutes}m)` : 'Disabled'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={autoCommitSettings.enabled}
              onChange={(event) => updateAutoCommitSettings({ enabled: event.target.checked })}
              disabled={!linkedRepo}
              className="size-4 rounded border-border"
            />
          </label>

          {autoCommitSettings.enabled && (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Interval (minutes)</Label>
              <select
                value={autoCommitSettings.intervalMinutes}
                onChange={(event) => updateAutoCommitSettings({ intervalMinutes: parseInt(event.target.value, 10) })}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </div>
          )}

          {isAutoCommitting && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Auto-saving...
            </div>
          )}
        </div>
      </section>
    </div>
  );

  return (
    <>
      <div
        onClick={onClose}
        className={cn(
          'absolute inset-0 z-40 bg-black/30 transition-all duration-200',
          isOpen ? 'visible opacity-100 pointer-events-auto' : 'invisible opacity-0 pointer-events-none',
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="GitHub Sync"
        className={cn(
          'absolute bottom-0 right-0 top-0 z-50 w-[380px] max-w-[96vw] border-l border-border/70 bg-background shadow-xl transition-all duration-200',
          isOpen
            ? 'visible translate-x-0 opacity-100 pointer-events-auto'
            : 'invisible translate-x-full opacity-0 pointer-events-none',
        )}
      >
        <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Github className="size-4" />
            GitHub Sync
          </h3>
          <Button variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close GitHub sidebar">
            <X className="size-4" />
          </Button>
        </header>

        <div className="h-[calc(100%-53px)] overflow-y-auto p-4">
          {!isAuthenticated && renderUnauthenticated()}
          {isAuthenticated && !currentProject && renderNoProject()}
          {isAuthenticated && currentProject && !linkedRepo && renderNotLinked()}
          {isAuthenticated && currentProject && linkedRepo && renderLinked()}
        </div>
      </aside>

      <Dialog open={showLinkModal} onOpenChange={(open) => !open && resetLinkModalState()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {linkStep === 'configure' && (
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setLinkStep('select')} aria-label="Go back to repository selection">
                  <ArrowLeft className="size-4" />
                </Button>
              )}
              {linkStep === 'select' ? 'Link to Repository' : 'Configure Link'}
            </DialogTitle>
            <DialogDescription>
              {linkStep === 'select'
                ? 'Select a repository to sync your project with.'
                : 'Set branch and file path for this project sync.'}
            </DialogDescription>
          </DialogHeader>

          {linkStep === 'select' ? (
            <div className="max-h-[46vh] overflow-y-auto rounded-md border border-border/70">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">{spinner}</div>
              ) : sortedRepositories.length > 0 ? (
                <ul className="divide-y divide-border/60">
                  {sortedRepositories.map((repo) => (
                    <li key={repo.id}>
                      <button
                        type="button"
                        onClick={() => { handleSelectRepo(repo).catch(notifyError('Selecting repository')); }}
                        className="w-full px-3 py-2.5 text-left hover:bg-muted/40"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Github className="size-4" />
                          <span className="truncate">{repo.full_name}</span>
                          {repo.private && <Badge variant="secondary" className="text-[10px]">Private</Badge>}
                        </div>
                        {repo.description && <p className="mt-1 text-xs text-muted-foreground">{repo.description}</p>}
                        <p className="mt-1 text-[11px] text-muted-foreground">Updated: {formatDate(repo.updated_at)}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">No repositories found</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm font-medium">
                {selectedRepo?.full_name}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Branch</Label>
                <select
                  value={selectedBranch}
                  onChange={(event) => {
                    setSelectedBranch(event.target.value);
                    setFileExists(null);
                  }}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {availableBranches.map((branch) => (
                    <option key={branch} value={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Folder Path (optional)</Label>
                <Input
                  placeholder="e.g., projects/my-models"
                  value={linkFolderPath}
                  onChange={(event) => {
                    setLinkFolderPath(event.target.value);
                    setFileExists(null);
                  }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>File Name</Label>
                <Input
                  placeholder="my_project.json"
                  value={linkFileName}
                  onChange={(event) => {
                    setLinkFileName(event.target.value.replace(/\s+/g, '_'));
                    setFileExists(null);
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFileBrowser(true)}
                  disabled={!selectedRepo || !githubSession}
                  className="gap-1"
                >
                  <FolderOpen className="size-4" />
                  Browse repository files
                </Button>
                <span className="text-xs text-muted-foreground">Pick an existing project file without typing the path.</span>
              </div>

              <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
                <span className="font-semibold">Full path:</span> <code>/{computedFilePath}</code>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { handleCheckFileExists().catch(notifyError('Checking file existence')); }}
                  disabled={isCheckingFile || !linkFileName}
                >
                  {isCheckingFile ? spinner : 'Check if file exists'}
                </Button>

                {fileExists === true && (
                  <div className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    <p>File already exists in repository. Choose how to proceed:</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => { handleConfirmLink().catch(notifyError('Linking repository')); }} className="gap-1">
                        <CloudDownload className="size-4" />
                        Load & link (recommended)
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { handleConfirmLink(true).catch(notifyError('Linking repository')); }}>
                        Link without loading (may overwrite)
                      </Button>
                    </div>
                  </div>
                )}

                {fileExists === false && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                    File path is available. Click "Link Repository" to continue.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={resetLinkModalState}>
              Cancel
            </Button>
            {linkStep === 'configure' && (
              <Button onClick={() => { handleConfirmLink().catch(notifyError('Linking repository')); }} disabled={!linkFileName}>
                {fileExists ? 'Load & Link' : 'Link Repository'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FileBrowserModal
        show={showFileBrowser}
        onHide={() => setShowFileBrowser(false)}
        onSelect={handleFileSelectedFromBrowser}
        fetchContents={fetchSelectedRepoContents}
        title="Select project file"
        selectMode="file"
        initialPath={linkFolderPath}
      />

      <CreateRepositoryDialog
        open={showCreateModal}
        isLoading={isLoading}
        repoName={newRepoName}
        repoDescription={newRepoDescription}
        isRepoPrivate={isRepoPrivate}
        fileName={createFileName}
        folderPath={createFolderPath}
        onOpenChange={setShowCreateModal}
        onRepoNameChange={(value) => setNewRepoName(sanitizeRepoName(value))}
        onRepoDescriptionChange={setNewRepoDescription}
        onRepoPrivateChange={setIsRepoPrivate}
        onFileNameChange={(value) => setCreateFileName(value.replace(/\s+/g, '_'))}
        onFolderPathChange={setCreateFolderPath}
        onCreate={() => { handleCreateRepo().catch(notifyError('Creating repository')); }}
      />

      <CommitDialog
        open={showCommitModal}
        isSaving={isSaving}
        message={commitMessage}
        onOpenChange={setShowCommitModal}
        onMessageChange={setCommitMessage}
        onCommit={() => { handleConfirmSave().catch(notifyError('Committing to GitHub')); }}
      />

      <RestoreVersionDialog
        open={showRestoreModal}
        isSaving={isSaving}
        selectedCommit={selectedCommit}
        formatDate={formatDate}
        onOpenChange={(open) => {
          setShowRestoreModal(open);
          if (!open) {
            setSelectedCommit(null);
          }
        }}
        onRestore={() => { handleRestoreCommit().catch(notifyError('Restoring commit')); }}
      />

      <CreateGistDialog
        open={showGistModal}
        isLoading={isLoading}
        description={gistDescription}
        isPublic={isGistPublic}
        onOpenChange={setShowGistModal}
        onDescriptionChange={setGistDescription}
        onPublicChange={setIsGistPublic}
        onCreate={() => { handleCreateGist().catch(notifyError('Creating gist')); }}
      />
    </>
  );
};

export default GitHubSidebar;
