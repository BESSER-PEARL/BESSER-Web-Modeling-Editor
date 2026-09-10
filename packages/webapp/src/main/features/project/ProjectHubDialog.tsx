import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileSpreadsheet,
  FolderOpen,
  Github,
  Layers3,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FormField } from '@/components/ui/form-field';
import { BesserProject, InterfaceMode, PerspectiveSettings } from '../../shared/types/project';
import { FirstRunLanding } from './FirstRunLanding';
import { PERSPECTIVES, perspectivesFromDiagramList } from '../../shared/perspectives';
import { useProject } from '../../app/hooks/useProject';
import { LanguageSelector } from '../../app/shell/LanguageSelector';
import { useConfirmDialog } from '../../shared/hooks/useConfirmDialog';
import { useFieldValidation } from '../../shared/hooks/useFieldValidation';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { importProject, importProjectFromJson } from '../../shared/services/project-import/projectImport';
import { normalizeProjectName } from '../../shared/utils/projectName';
import { validateProjectName } from '../../shared/utils/validation';
import {
  BACKEND_URL,
  localStoragePreferredInterface,
  sessionStorageContinueFromGithubIntent,
  sessionStorageOpenAssistantOnLoad,
  sessionStoragePendingAssistantPrompt,
} from '../../shared/constants/constant';
import { useImportDiagramToProject } from '../import/useImportDiagram';
import { apiClient, ApiError } from '../../shared/api/api-client';
import { LocalStorageRepository } from '../../shared/services/storage/local-storage-repository';
import { emitDeliveryEvent } from '../../shared/services/telemetry/pilotTelemetry';
import { useAppDispatch } from '../../app/store/hooks';
import { useGitHubAuth } from '../github/hooks/useGitHubAuth';
import { useGitHubStorage, type GitHubRepository } from '../github/hooks/useGitHubStorage';
import { writeProjectLastRun } from '../spec-driven/storage';
import { setLastRunForProject } from '../spec-driven/state/specDrivenSlice';

/** Steps the File menu can open the hub directly at (New / Open / Import Project). */
export type ProjectHubOpenStep = 'create' | 'open' | 'import' | 'spreadsheet' | 'github';

interface ProjectHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When the hub is opened from a specific File-menu action, jump straight to
   * that step instead of the default first-run / start logic. Undefined for the
   * auto-open first-run path (which shows the 'welcome' chooser).
   */
  initialStep?: ProjectHubOpenStep;
}

type ProjectHubStep = 'welcome' | 'start' | 'describe' | 'create' | 'import' | 'spreadsheet' | 'open' | 'github';

/** Read the per-user default interface saved via "Remember my choice". */
const readPreferredInterface = (): InterfaceMode | null => {
  try {
    const v = localStorage.getItem(localStoragePreferredInterface);
    return v === 'model' || v === 'agent' ? v : null;
  } catch {
    return null;
  }
};

/**
 * Per-link interface override read from the URL for this load only (never
 * persisted). `?agentic` / `?agentic=true` / `?mode=agent` open straight into
 * the agentic flow; `?mode=model` forces the modelling flow. Wins over the
 * stored "Remember my choice" default.
 */
const readUrlInterfaceOverride = (): InterfaceMode | null => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('agentic')) {
      const v = params.get('agentic');
      if (v === null || v === '' || v === 'true' || v === '1') {
        return 'agent';
      }
    }
    const mode = params.get('mode');
    if (mode === 'agent') return 'agent';
    if (mode === 'model') return 'model';
    return null;
  } catch {
    return null;
  }
};

/** Deploy-link target token for the GitHub push (shared with the Vibe push flow). */
const GITHUB_TARGET = 'github';
const GITHUB_DEFAULT_BRANCH = 'main';

/**
 * Response of ``POST /spec-driven/import-github-run``. ``project`` is a re-importable V2
 * project export envelope (same shape as ``buml/diagrams.json``); ``has_model``
 * is false when the repo carries no BESSER model.
 */
interface ImportGitHubRunResponse {
  run_id: string;
  project: unknown;
  has_model: boolean;
  owner: string;
  repo: string;
  branch: string;
}

// Plain, non-technical example prompts for the "Describe your app" hero flow.
// Kept LOCAL to this file on purpose: feature isolation forbids importing the
// assistant feature's own starter-prompt list, and these are deliberately
// simpler/friendlier than the in-assistant examples.
const DESCRIBE_EXAMPLES = [
  'Build a library app to track books and loans',
  'Make a restaurant ordering app with menus and tables',
  'Create a bike-route app for Luxembourg with a map and reviews',
  'Build an online shop for products, customers, and orders',
];

// Default name for a project bootstrapped from the "Describe your app" flow —
// the user shouldn't be forced through the naming form for the vibe path.
const DESCRIBE_DEFAULT_PROJECT_NAME = 'My App';

const defaultForm = {
  name: 'New_Project',
  description: 'Modern workspace project for UML, GUI and quantum modeling.',
  owner: 'BESSER User',
};

// Default to "Show All" so the create-project flow preserves the prior default
// of all-diagrams-visible when the user doesn't pick a perspective explicitly.
const DEFAULT_PERSPECTIVE_KEY = 'all';

// Apply a perspective preset at project-creation time. We can't reuse
// `applyPerspectivePresetThunk` here because the project doesn't exist yet —
// that thunk mutates `currentProject`, but in this flow there is no current
// project to mutate. Instead we compute the preset and pass it through
// `createProjectThunk` so the very first persisted state already has the
// chosen perspective. Keep this in lockstep with `applyPerspectivePresetThunk`
// (workspaceSlice.ts) so the two paths don't drift in how they map a preset
// key to a `PerspectiveSettings` map.
const resolvePerspectives = (key: string): PerspectiveSettings | undefined => {
  const preset = PERSPECTIVES.find((p) => p.key === key);
  return preset ? perspectivesFromDiagramList(preset.diagrams) : undefined;
};

const readableFileSize = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const ProjectHubDialog: React.FC<ProjectHubDialogProps> = ({ open, onOpenChange, initialStep }) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<BesserProject[]>([]);
  const [step, setStep] = useState<ProjectHubStep>('start');
  // Interface the user picked on the 'welcome' landing (null when the hub was
  // opened for an existing project or via the manual "start" path). Stored on
  // the project at creation time.
  const [pendingPreferredInterface, setPendingPreferredInterface] = useState<InterfaceMode | null>(null);
  // The step the hub was opened at (from the File menu, first run, or the start
  // hub). Drives where "Back" goes: a directly-opened step closes on Back; a
  // step navigated into from a hub returns to that hub. See handleBack.
  const [entryStep, setEntryStep] = useState<ProjectHubStep>('start');
  const [describePrompt, setDescribePrompt] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [createPerspectiveKey, setCreatePerspectiveKey] = useState<string>(DEFAULT_PERSPECTIVE_KEY);
  const [spreadsheetForm, setSpreadsheetForm] = useState(defaultForm);
  const [spreadsheetPerspectiveKey, setSpreadsheetPerspectiveKey] = useState<string>(DEFAULT_PERSPECTIVE_KEY);
  const [spreadsheetFiles, setSpreadsheetFiles] = useState<File[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const spreadsheetFileInputRef = useRef<HTMLInputElement | null>(null);

  // ── "Continue from GitHub" picker state ──────────────────────────────
  const [githubRepoFullName, setGithubRepoFullName] = useState('');
  const [githubBranches, setGithubBranches] = useState<string[]>([]);
  const [githubBranch, setGithubBranch] = useState('');
  const [githubLoadingBranches, setGithubLoadingBranches] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const { isAuthenticated: isGithubAuthenticated, githubSession, login: githubLogin } = useGitHubAuth();
  const {
    repositories: githubRepositories,
    isLoading: githubReposLoading,
    fetchRepositories: fetchGithubRepositories,
    fetchBranches: fetchGithubBranches,
  } = useGitHubStorage();

  const { currentProject, createProject, loadProject, deleteProject } = useProject();
  const importDiagramToProject = useImportDiagramToProject();
  const { confirm, dialogState, handleConfirm, handleCancel } = useConfirmDialog();
  const canClose = Boolean(currentProject);

  // ── Inline validation for the "Create" form ──────────────────────────
  const createValidators = useMemo(() => ({
    name: () => validateProjectName(form.name),
  }), [form.name]);
  const createValidation = useFieldValidation(createValidators);

  // ── Inline validation for the "Spreadsheet" form ─────────────────────
  const spreadsheetValidators = useMemo(() => ({
    name: () => validateProjectName(spreadsheetForm.name),
  }), [spreadsheetForm.name]);
  const spreadsheetValidation = useFieldValidation(spreadsheetValidators);

  const refreshProjects = useCallback(() => {
    const all = ProjectStorageRepository.getAllProjects();
    setProjects(all as BesserProject[]);
  }, []);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [projects],
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    refreshProjects();
    // A File-menu action opens the hub directly at a specific step (New →
    // create, Open → open, Import → import), overriding the first-run logic.
    // Otherwise: first run (no project yet) opens the mode chooser — unless a
    // `?agentic`/`?mode=` URL override or a saved "Remember my choice" default
    // skips straight to that workspace's flow (URL wins over the stored
    // default). Opening the hub for an existing project keeps the start screen.
    if (initialStep) {
      setPendingPreferredInterface(null);
      setStep(initialStep);
      setEntryStep(initialStep);
    } else if (!currentProject) {
      const chosen = readUrlInterfaceOverride() ?? readPreferredInterface();
      if (chosen === 'model' || chosen === 'agent') {
        // Both interfaces go through the same project-creation form; the mode is
        // recorded on the project and, for 'agent', the assistant drawer is
        // opened once the editor loads (see handleCreateProject).
        setPendingPreferredInterface(chosen);
        setStep('create');
        setEntryStep('welcome');
      } else {
        setPendingPreferredInterface(null);
        setStep('welcome');
        setEntryStep('welcome');
      }
    } else {
      setPendingPreferredInterface(null);
      setStep('start');
      setEntryStep('start');
    }
    setDescribePrompt('');
    setForm(defaultForm);
    setCreatePerspectiveKey(DEFAULT_PERSPECTIVE_KEY);
    setSpreadsheetForm(defaultForm);
    setSpreadsheetPerspectiveKey(DEFAULT_PERSPECTIVE_KEY);
    setSpreadsheetFiles([]);
    setGithubRepoFullName('');
    setGithubBranches([]);
    setGithubBranch('');
    setGithubLoadingBranches(false);
    setGithubError(null);
    createValidation.resetTouched();
    spreadsheetValidation.resetTouched();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, refreshProjects]);

  // Resume "Continue from GitHub" after the OAuth redirect: once the hub is
  // open AND we're authenticated, consume-and-clear the stashed intent and jump
  // straight to the repo picker. Declared AFTER the open-reset effect above so
  // it wins the ``step`` write when both fire on the same ``open`` transition;
  // when auth resolves asynchronously it re-runs on ``isGithubAuthenticated``.
  useEffect(() => {
    if (!open || !isGithubAuthenticated) {
      return;
    }
    let hasIntent = false;
    try {
      hasIntent = sessionStorage.getItem(sessionStorageContinueFromGithubIntent) !== null;
    } catch {
      hasIntent = false;
    }
    if (!hasIntent) {
      return;
    }
    try {
      sessionStorage.removeItem(sessionStorageContinueFromGithubIntent);
    } catch {
      /* ignore */
    }
    setStep('github');
  }, [open, isGithubAuthenticated]);

  // Lazy-load the user's repositories when the GitHub step opens.
  useEffect(() => {
    if (step !== 'github' || !isGithubAuthenticated || !githubSession) {
      return;
    }
    if (githubRepositories.length > 0 || githubReposLoading) {
      return;
    }
    void fetchGithubRepositories(githubSession);
  }, [step, isGithubAuthenticated, githubSession, githubRepositories.length, githubReposLoading, fetchGithubRepositories]);

  const currentStepInfo = useMemo(() => {
    if (step === 'describe') {
      return {
        title: 'Describe Your App',
        description: "Tell me your idea in plain words — I'll build the data, the screens, and the code.",
        badge: 'Step 2 of 2',
      };
    }
    if (step === 'create') {
      return {
        title: t('project.hub.create.title'),
        description: t('project.hub.create.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'import') {
      return {
        title: t('project.hub.import.title'),
        description: t('project.hub.import.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'spreadsheet') {
      return {
        title: t('project.hub.spreadsheet.title'),
        description: t('project.hub.spreadsheet.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'open') {
      return {
        title: t('project.hub.open.title'),
        description: t('project.hub.open.description'),
        badge: t('project.hub.stepBadge', { current: 2, total: 2 }),
      };
    }
    if (step === 'github') {
      return {
        title: 'Continue From GitHub',
        description: 'Pick a repository BESSER created — its model loads and the next Vibe run edits its code.',
        badge: 'Step 2 of 2',
      };
    }
    return {
      title: t('project.hub.start.title'),
      description: t('project.hub.start.description'),
      badge: t('project.hub.stepBadge', { current: 1, total: 2 }),
    };
  }, [step, t]);

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !canClose) {
      return;
    }
    onOpenChange(nextOpen);
  };

  // First-run landing: a portal was chosen. Persist the per-user default when
  // "Remember my choice" is ticked, then advance into the shared project-
  // creation form. BOTH modes create a project the same way; the only
  // difference is post-create — 'agent' opens the assistant drawer once the
  // editor loads (handleCreateProject sets the flag), 'model' stays on canvas.
  const handleChooseInterface = (mode: InterfaceMode, remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem(localStoragePreferredInterface, mode);
      } else {
        localStorage.removeItem(localStoragePreferredInterface);
      }
    } catch {
      /* storage may be unavailable (private mode / quota) — non-fatal */
    }
    setPendingPreferredInterface(mode);
    setStep('create');
  };

  // "Back" on a hub sub-step. A step opened directly (from the File menu via
  // initialStep, so entryStep === step) has no parent to return to — Back closes
  // the dialog. A step navigated into from the welcome/start hub returns there,
  // rather than surfacing the start hub when the user never came from it.
  const handleBack = () => {
    if (step === entryStep) {
      handleDialogOpenChange(false);
      return;
    }
    setStep(entryStep === 'welcome' ? 'welcome' : 'start');
  };

  const handleCreateProject = async () => {
    const errors = createValidation.touchAll();
    if (Object.keys(errors).length > 0) {
      return;
    }

    const name = normalizeProjectName(form.name);
    const description = form.description.trim();
    const owner = form.owner.trim();

    try {
      setIsBusy(true);
      // Arm the drawer-open flag BEFORE creating the project. createProject
      // updates currentProject, which fires WorkspaceShell's consume-and-open
      // effect — if we set the flag AFTER the await, that effect has already run
      // and missed it (the race that left the agentic drawer closed on create).
      if (pendingPreferredInterface === 'agent') {
        try {
          sessionStorage.setItem(sessionStorageOpenAssistantOnLoad, '1');
        } catch {
          /* storage unavailable — the drawer just won't auto-open, non-fatal */
        }
      }
      await createProject(
        name,
        description || defaultForm.description,
        owner || defaultForm.owner,
        resolvePerspectives(createPerspectiveKey),
        pendingPreferredInterface ?? undefined,
      );
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toasts.created', { name }));
    } catch (error) {
      // Creation failed — disarm the flag so it can't spuriously open the drawer
      // on some later, unrelated project load.
      try {
        sessionStorage.removeItem(sessionStorageOpenAssistantOnLoad);
      } catch {
        /* non-fatal */
      }
      toast.error(t('project.hub.toasts.createFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartBuilding = async () => {
    const prompt = describePrompt.trim();
    if (!prompt) {
      return;
    }

    try {
      setIsBusy(true);
      // (a) Bootstrap a blank project via the SAME path handleCreateProject
      // uses — createProject() with the default perspective. We don't force the
      // user through the naming form; a sensible default name is applied.
      await createProject(
        normalizeProjectName(DESCRIBE_DEFAULT_PROJECT_NAME),
        defaultForm.description,
        defaultForm.owner,
        resolvePerspectives(DEFAULT_PERSPECTIVE_KEY),
        pendingPreferredInterface ?? 'agent',
      );
      refreshProjects();

      // (c) Hand the typed prompt to the AI assistant. Stash it FIRST so the
      // assistant can consume-and-clear it once it has mounted and its
      // WebSocket is connected; the CustomEvent then nudges an already-mounted
      // assistant to react immediately. The stash is the fallback path for the
      // (rare) case where the event fires before the listener is registered.
      try {
        sessionStorage.setItem(sessionStoragePendingAssistantPrompt, prompt);
      } catch {
        // sessionStorage can throw (private mode / quota). The CustomEvent path
        // still delivers the prompt to an already-mounted assistant.
      }

      // (b) Close the dialog, then (c cont.) fire the hand-off event.
      handleDialogOpenChange(false);
      window.dispatchEvent(new CustomEvent('wme:assistant-run-prompt', { detail: { prompt } }));
    } catch (error) {
      toast.error(`Could not start building: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleOpenProject = async (projectId: string) => {
    try {
      setIsBusy(true);
      await loadProject(projectId);
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toasts.loaded'));
    } catch (error) {
      toast.error(t('project.hub.toasts.loadFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string) => {
    const confirmed = await confirm({
      title: t('project.hub.deleteConfirm.title'),
      description: t('project.hub.deleteConfirm.description', { name: projectName }),
      confirmLabel: t('common.delete'),
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    try {
      setIsBusy(true);
      await deleteProject(projectId);
      refreshProjects();
      toast.success(t('project.hub.toasts.deleted', { name: projectName }));
    } catch (error) {
      toast.error(t('project.hub.toasts.deleteFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleImportProjectFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsBusy(true);
      const importedProject = await importProject(file);
      await loadProject(importedProject.id);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toasts.imported', { name: importedProject.name }));
    } catch (error) {
      toast.error(t('project.hub.toasts.importFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
      event.target.value = '';
    }
  };

  const handleImportDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'json' && ext !== 'py') {
      toast.error(t('project.hub.toasts.unsupportedFileType'));
      return;
    }
    try {
      setIsBusy(true);
      const importedProject = await importProject(file);
      await loadProject(importedProject.id);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toasts.imported', { name: importedProject.name }));
    } catch (error) {
      toast.error(t('project.hub.toasts.importFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  const handleSpreadsheetFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    setSpreadsheetFiles(files);
  };

  const handleStartFromSpreadsheet = async () => {
    const errors = spreadsheetValidation.touchAll();
    if (Object.keys(errors).length > 0) {
      return;
    }

    const name = normalizeProjectName(spreadsheetForm.name);
    const description = spreadsheetForm.description.trim();
    const owner = spreadsheetForm.owner.trim();

    if (spreadsheetFiles.length === 0) {
      toast.error(t('project.hub.toasts.noSpreadsheetFile'));
      return;
    }

    try {
      setIsBusy(true);
      await createProject(
        name,
        description || defaultForm.description,
        owner || defaultForm.owner,
        resolvePerspectives(spreadsheetPerspectiveKey),
      );

      const requestData = new FormData();
      spreadsheetFiles.forEach((file) => requestData.append('files', file));

      const response = await fetch(`${BACKEND_URL}/csv-to-domain-model`, {
        method: 'POST',
        body: requestData,
      });

      if (!response.ok) {
        let message = t('project.hub.toasts.spreadsheetGenerateFailed');
        try {
          const errorData = await response.json();
          if (typeof errorData?.detail === 'string') {
            message = errorData.detail;
          }
        } catch {
          // Keep fallback message.
        }
        throw new Error(message);
      }

      const diagramJson = await response.json();
      const generatedDiagramFile = new File(
        [JSON.stringify(diagramJson)],
        `${name}_class_diagram.json`,
        { type: 'application/json' },
      );

      await importDiagramToProject(generatedDiagramFile);
      refreshProjects();
      handleDialogOpenChange(false);
      toast.success(t('project.hub.toasts.spreadsheetCreated', { name }));
    } catch (error) {
      toast.error(t('project.hub.toasts.spreadsheetImportFailed', { error: error instanceof Error ? error.message : t('project.hub.unknownError') }));
    } finally {
      setIsBusy(false);
    }
  };

  // Enter the "Continue from GitHub" step, connecting first when needed. Mirrors
  // the connect-first pattern in useSpecDrivenGithubPush: stash the intent, kick
  // off OAuth, and let the hub reopen on the repo picker once we're back.
  const handleOpenGithubStep = () => {
    setGithubError(null);
    if (!isGithubAuthenticated) {
      try {
        sessionStorage.setItem(sessionStorageContinueFromGithubIntent, '1');
      } catch {
        /* sessionStorage may be unavailable — login still proceeds. */
      }
      toast.info('Connect GitHub to continue from one of your repositories.');
      githubLogin();
      return;
    }
    setStep('github');
  };

  const handleSelectGithubRepo = async (fullName: string) => {
    setGithubRepoFullName(fullName);
    setGithubBranches([]);
    setGithubBranch('');
    setGithubError(null);
    const repo = githubRepositories.find((r) => r.full_name === fullName);
    if (!repo || !githubSession) {
      return;
    }
    const [owner] = repo.full_name.split('/');
    setGithubLoadingBranches(true);
    const list = await fetchGithubBranches(githubSession, owner, repo.name);
    setGithubLoadingBranches(false);
    const resolved = list.length > 0 ? list : [repo.default_branch].filter(Boolean);
    setGithubBranches(resolved);
    setGithubBranch(repo.default_branch || resolved[0] || GITHUB_DEFAULT_BRANCH);
  };

  // Load a BESSER-created repo's model into a fresh project AND prime the next
  // Vibe run to modify that repo's code and push back to the same repo.
  const handleContinueGithubRepo = async () => {
    setGithubError(null);
    const repo: GitHubRepository | undefined = githubRepositories.find(
      (r) => r.full_name === githubRepoFullName,
    );
    if (!repo) {
      setGithubError('Select a repository to continue from.');
      return;
    }
    if (!githubSession) {
      setGithubError('GitHub session not found. Please reconnect.');
      return;
    }

    const [owner] = repo.full_name.split('/');
    const branch = githubBranch || repo.default_branch || GITHUB_DEFAULT_BRANCH;

    try {
      setIsBusy(true);
      const response = await apiClient.post<ImportGitHubRunResponse>(
        '/spec-driven/import-github-run',
        { owner, repo: repo.name, branch },
        { headers: { 'X-GitHub-Session': githubSession } },
      );

      if (!response.has_model) {
        setGithubError(
          "This repo has no BESSER model — it wasn't created by BESSER, so there's nothing to continue from yet.",
        );
        return;
      }

      // The returned ``project`` is a V2 export envelope — route it through the
      // V2-aware importer (validateV2ExportData + extractPersonalization) by
      // wrapping it in a File, exactly like a ``diagrams.json`` import.
      const file = new File([JSON.stringify(response.project)], 'diagrams.json', {
        type: 'application/json',
      });
      const imported = await importProjectFromJson(file);
      await loadProject(imported.id);

      // Link the push target so a later Vibe push updates the same repo.
      LocalStorageRepository.setDeployLinkedRepo(imported.id, GITHUB_TARGET, {
        owner: response.owner,
        repo: response.repo,
        branch: response.branch,
      });

      // Prime the modify base: record this run as the project's last successful
      // run so the NEXT Vibe request auto-selects mode=modify + base_run_id
      // (via decideRunMode). Mirror to localStorage AND the in-memory store.
      const at = Date.now();
      writeProjectLastRun(imported.id, response.run_id, at);
      dispatch(setLastRunForProject({ projectId: imported.id, runId: response.run_id, at }));

      refreshProjects();
      handleDialogOpenChange(false);
      // Pilot telemetry: a completed continue-from-repo import is a delivery
      // action. Fire-and-forget, no-op outside pilot sessions.
      emitDeliveryEvent('continue_from_repo', response.run_id);
      toast.success(`Continuing from ${response.owner}/${response.repo}.`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setGithubError('Your GitHub session expired. Reconnect and try again.');
        toast.error('GitHub session expired — please reconnect.');
      } else {
        const message =
          error instanceof ApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Could not continue from this repository.';
        setGithubError(message);
        toast.error(`Continue from GitHub failed: ${message}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  // Low-code vs agentic picker shown inside the create form. Seeded from the
  // landing choice (pendingPreferredInterface) so clicking "Describe it" on the
  // landing preselects Agentic here, and vice versa; the user can still flip it.
  // When Agentic is chosen the modelling-perspective picker is hidden (below),
  // since the agentic path drops the user straight into the assistant drawer.
  const renderInterfaceModePicker = () => {
    const mode: InterfaceMode = pendingPreferredInterface ?? 'model';
    const options: { key: InterfaceMode; label: string; description: string }[] = [
      { key: 'model', label: 'Low-code', description: 'Build visually with UML diagrams on the modelling canvas.' },
      { key: 'agent', label: 'Agentic', description: 'Describe your app in natural language; the assistant builds it.' },
    ];
    return (
      <FormField
        label="View"
        htmlFor="create-interface-mode"
        helperText="Choose how you'll build. You can switch anytime from the assistant drawer."
      >
        <div id="create-interface-mode" role="radiogroup" aria-label="View" className="flex flex-wrap gap-2">
          {options.map((opt) => {
            const active = opt.key === mode;
            return (
              <Button
                key={opt.key}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                role="radio"
                aria-checked={active}
                title={opt.description}
                onClick={() => setPendingPreferredInterface(opt.key)}
                data-testid={`create-interface-${opt.key}`}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
      </FormField>
    );
  };

  const renderPerspectivePicker = (
    selected: string,
    onSelect: (key: string) => void,
    idPrefix: string,
  ) => (
    <FormField
      label={t('project.hub.perspective.label')}
      htmlFor={`${idPrefix}-perspective`}
      helperText={t('project.hub.perspective.helper')}
    >
      <div
        id={`${idPrefix}-perspective`}
        role="radiogroup"
        aria-label={t('project.hub.perspective.label')}
        className="flex flex-wrap gap-2"
      >
        {PERSPECTIVES.map((preset) => {
          const active = preset.key === selected;
          return (
            <Button
              key={preset.key}
              type="button"
              variant={active ? 'default' : 'outline'}
              size="sm"
              role="radio"
              aria-checked={active}
              title={preset.description}
              onClick={() => onSelect(preset.key)}
              data-testid={`${idPrefix}-perspective-${preset.key}`}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </FormField>
  );

  // Project cards: the whole card opens the project (the primary action);
  // delete is a hover/focus-revealed corner control so it can't be hit by
  // accident but is always one hover away.
  const renderProjectList = () => (
    <div className="grid gap-2.5 md:grid-cols-2">
      {sortedProjects.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-10 text-center text-sm text-muted-foreground md:col-span-2">
          {t('project.hub.list.emptyHint')}
        </div>
      )}

      {sortedProjects.map((project) => {
        const isCurrent = currentProject?.id === project.id;
        return (
          <div
            key={project.id}
            role="button"
            tabIndex={isBusy ? -1 : 0}
            aria-disabled={isBusy}
            onClick={() => { if (!isBusy) void handleOpenProject(project.id); }}
            onKeyDown={(e) => {
              if (isBusy) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void handleOpenProject(project.id);
              }
            }}
            className={cn(
              'group relative flex cursor-pointer flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevation-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
              isCurrent
                ? 'border-brand/40 bg-brand/[0.04] hover:border-brand/50'
                : 'border-border/60 hover:border-brand/30',
              isBusy && 'pointer-events-none opacity-60',
            )}
          >
            <div className="flex items-start gap-3 pr-7">
              <div
                className={cn(
                  'mt-0.5 inline-flex shrink-0 rounded-lg p-2 ring-1 transition-colors',
                  isCurrent
                    ? 'bg-brand/10 text-brand ring-brand/15'
                    : 'bg-brand/[0.06] text-brand/70 ring-brand/10 group-hover:bg-brand/10 group-hover:text-brand',
                )}
              >
                <FolderOpen className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold tracking-tight">{project.name}</p>
                  {isCurrent && (
                    <Badge className="shrink-0 rounded-full border-brand/20 bg-brand/10 px-2 py-0 text-[10px] font-medium text-brand">
                      {t('project.hub.list.active')}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                  {project.description || t('project.hub.list.noDescription')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wide text-muted-foreground/70">
                <CalendarDays className="size-3" />
                {new Date(project.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                {t('project.hub.list.open')}
                <ArrowRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </span>
            </div>

            <Button
              size="icon"
              variant="ghost"
              className="absolute right-2 top-2 size-7 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                void handleDeleteProject(project.id, project.name);
              }}
              disabled={isBusy}
              aria-label={t('project.hub.list.deleteAria', { name: project.name })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={cn('max-h-[92vh] overflow-hidden p-0', !canClose && '[&>button]:hidden')}>
        {step === 'welcome' && (
          <FirstRunLanding
            onChoose={handleChooseInterface}
            onMoreOptions={() => setStep('start')}
            defaultRemember={readPreferredInterface() !== null}
          />
        )}
        {step !== 'welcome' && (
        <>
        {/* Ambient brand glow, echoing the first-run landing's surface. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-40 blur-2xl"
          style={{ background: 'radial-gradient(circle at center, hsl(var(--brand)/0.18), transparent 62%)' }}
        />
        <DialogHeader className="border-b border-border/60 px-6 pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3.5">
              {step === 'start' ? (
                <img src="/images/logo.png" alt="BESSER" className="mt-1 h-7 w-auto shrink-0 brightness-0 opacity-80 dark:invert" />
              ) : (
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label={t('project.hub.back')}
                  className="mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 text-muted-foreground transition-colors hover:border-brand/30 hover:bg-brand/[0.04] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <ArrowLeft className="size-4" />
                </button>
              )}
              <div className="min-w-0">
                <DialogTitle className="font-display text-2xl tracking-tight">
                  {currentStepInfo.title}
                </DialogTitle>
                <DialogDescription className="mt-1">{currentStepInfo.description}</DialogDescription>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {step === 'start' && <LanguageSelector outlineButtonClass="h-9" />}
              <Badge variant="secondary" className="shrink-0 rounded-full border-brand/15 bg-brand/[0.06] font-mono text-[10px] tracking-wider text-brand">
                {currentStepInfo.badge}
              </Badge>
            </div>
          </div>
        </DialogHeader>
        </>
        )}

        <input
          ref={importFileInputRef}
          type="file"
          accept=".json,.py"
          className="hidden"
          onChange={handleImportProjectFile}
        />
        <input
          ref={spreadsheetFileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          multiple
          className="hidden"
          onChange={handleSpreadsheetFileSelect}
        />

        {step !== 'welcome' && (
        <div className="max-h-[75vh] overflow-y-auto px-6 py-4">
          {step === 'start' && (
            <div className="flex flex-col gap-5">
              {/* Manual start paths. The old "describe your app" vibe hero was
                  removed — agentic entry is the landing chooser / assistant now. */}
              <div className="flex flex-col gap-2.5">
                <div className="grid gap-2.5 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setStep('create')}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-elevation-1"
                  >
                    <div className="mb-2 inline-flex rounded-lg bg-brand/[0.08] p-2 text-brand ring-1 ring-brand/10">
                      <Plus className="size-3.5" />
                    </div>
                    <p className="text-xs font-semibold tracking-tight">Create Blank</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Start from scratch with all editors.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('spreadsheet')}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-elevation-1"
                  >
                    <div className="mb-2 inline-flex rounded-lg bg-emerald-500/[0.08] p-2 text-emerald-700 ring-1 ring-emerald-500/10 dark:text-emerald-400">
                      <FileSpreadsheet className="size-3.5" />
                    </div>
                    <p className="text-xs font-semibold tracking-tight">From Spreadsheet</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Class diagram from CSV/XLSX files.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStep('import')}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-elevation-1"
                  >
                    <div className="mb-2 inline-flex rounded-lg bg-violet-500/[0.08] p-2 text-violet-700 ring-1 ring-violet-500/10 dark:text-violet-400">
                      <Upload className="size-3.5" />
                    </div>
                    <p className="text-xs font-semibold tracking-tight">Import Project</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Load an exported `.json` or `.py`.</p>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenGithubStep}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-3.5 text-left shadow-none transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-elevation-1"
                  >
                    <div className="mb-2 inline-flex rounded-lg bg-foreground/[0.06] p-2 text-foreground/80 ring-1 ring-foreground/10">
                      <Github className="size-3.5" />
                    </div>
                    <p className="text-xs font-semibold tracking-tight">Continue from GitHub</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">Reopen a repo BESSER created and keep building.</p>
                  </button>
                </div>
              </div>

              {/* Existing projects */}
              <div className="rounded-xl border border-border/50 bg-muted/15 p-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <p className="text-sm font-semibold tracking-tight">{t('project.hub.start.existingProjects')}</p>
                  <Badge variant="secondary" className="rounded-full border-brand/15 bg-brand/[0.06] font-mono text-[10px] text-brand">{sortedProjects.length}</Badge>
                </div>
                {sortedProjects.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {sortedProjects.slice(0, 3).map((project) => (
                      <div
                        key={project.id}
                        className="group flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 px-3 py-2 transition-all duration-200 hover:border-brand/20 hover:bg-brand/[0.04] hover:shadow-elevation-1"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center justify-between text-left"
                          onClick={() => void handleOpenProject(project.id)}
                          disabled={isBusy}
                        >
                          <span className="truncate text-sm font-medium">{project.name}</span>
                          <FolderOpen className="size-3.5 text-muted-foreground transition-colors group-hover:text-brand" />
                        </button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          onClick={() => void handleDeleteProject(project.id, project.name)}
                          disabled={isBusy}
                          aria-label={t('project.hub.list.deleteAria', { name: project.name })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1.5 h-8 px-2 text-xs font-medium text-brand hover:bg-brand/[0.04] hover:text-brand"
                      onClick={() => setStep('open')}
                    >
                      {t('project.hub.start.viewAll')}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">{t('project.hub.start.noProjects')}</p>
                )}
              </div>

              {!canClose && (
                <div className="rounded-xl border border-amber-300/50 bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-2.5 text-xs font-medium text-amber-800 dark:border-amber-800/50 dark:from-amber-950/30 dark:to-orange-950/20 dark:text-amber-200">
                  {t('project.hub.start.warningBanner')}
                </div>
              )}
            </div>
          )}

          {step === 'describe' && (
            <div className="flex flex-col gap-5">
              <Card className="border-brand/30 bg-gradient-to-br from-brand/[0.05] via-background to-background shadow-elevation-1">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base tracking-tight">
                    <Sparkles className="size-4 text-brand" />
                    What do you want to build?
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Describe your app in plain words. The AI assistant will create the data model, screens, and code for you.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <Textarea
                    id="describe-prompt"
                    value={describePrompt}
                    onChange={(event) => setDescribePrompt(event.target.value)}
                    placeholder="e.g. Build a library app to track books and loans, with a page to browse the catalogue and see who borrowed what."
                    className="min-h-36 resize-none text-sm leading-relaxed"
                    autoFocus
                  />

                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">Need inspiration? Try one</p>
                    <div className="flex flex-wrap gap-2">
                      {DESCRIBE_EXAMPLES.map((example) => (
                        <button
                          key={example}
                          type="button"
                          onClick={() => setDescribePrompt(example)}
                          className="rounded-full border border-brand/15 bg-brand/[0.04] px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:border-brand/30 hover:bg-brand/[0.08] hover:text-foreground"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={() => void handleStartBuilding()}
                    disabled={isBusy || !describePrompt.trim()}
                    className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2"
                  >
                    <Sparkles className="size-4" />
                    Start building
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'create' && (
            <div className="flex flex-col gap-2.5">
              <Card className="border-border/50 shadow-elevation-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base tracking-tight">{t('project.hub.create.detailsTitle')}</CardTitle>
                  <CardDescription className="text-xs">{t('project.hub.create.detailsDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2.5">
                  <FormField label={t('project.field.name')} htmlFor="project-name" required error={createValidation.getError('name')}>
                    <Input
                      id="project-name"
                      value={form.name}
                      onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                      onBlur={() => createValidation.markTouched('name')}
                      placeholder="My_Modeling_Project"
                      className={createValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                    />
                  </FormField>
                  <FormField label={t('project.field.owner')} htmlFor="project-owner">
                    <Input
                      id="project-owner"
                      value={form.owner}
                      onChange={(event) => setForm((previous) => ({ ...previous, owner: event.target.value }))}
                      placeholder="BESSER User"
                    />
                  </FormField>
                  <FormField label={t('project.field.description')} htmlFor="project-description">
                    <Textarea
                      id="project-description"
                      value={form.description}
                      onChange={(event) => setForm((previous) => ({ ...previous, description: event.target.value }))}
                      className="min-h-16"
                    />
                  </FormField>
                  {renderInterfaceModePicker()}
                  {(pendingPreferredInterface ?? 'model') === 'model' &&
                    renderPerspectivePicker(createPerspectiveKey, setCreatePerspectiveKey, 'create')}
                  <Button onClick={() => void handleCreateProject()} disabled={isBusy || !createValidation.isValid} className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2">
                    <Sparkles className="size-4" />
                    {t('project.hub.create.submit')}
                  </Button>
                </CardContent>
              </Card>

              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers3 className="size-3" />
                {t('project.hub.create.tip')}
              </p>
            </div>
          )}

          {step === 'import' && (
            <div className="flex flex-col gap-5">
              <Card className="border-border/50 shadow-elevation-1">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">{t('project.hub.import.cardTitle')}</CardTitle>
                  <CardDescription>{t('project.hub.import.cardDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div
                    role="button"
                    tabIndex={isBusy ? -1 : 0}
                    aria-disabled={isBusy}
                    aria-label={t('project.hub.import.dropAria')}
                    className={cn(
                      'grain-overlay relative overflow-hidden rounded-xl border-2 border-dashed bg-gradient-to-b from-brand/[0.03] to-muted/8 p-8 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40',
                      isBusy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-brand/40 hover:bg-brand/[0.04]',
                      isDragging ? 'border-brand/50 bg-brand/[0.06]' : 'border-brand/20',
                    )}
                    onClick={() => { if (!isBusy) importFileInputRef.current?.click(); }}
                    onKeyDown={(e) => {
                      if (isBusy) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        importFileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                    onDrop={(e) => void handleImportDrop(e)}
                  >
                    <div className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-2xl" />
                    <Upload className={cn('relative z-[2] mx-auto mb-3 size-8', isDragging ? 'text-brand/60' : 'text-brand/30')} />
                    <p className="relative z-[2] text-sm font-medium text-muted-foreground">{t('project.hub.import.dropPrompt')}</p>
                    <p className="relative z-[2] mt-1 text-xs text-muted-foreground/60">{t('project.hub.import.dropHint')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'spreadsheet' && (
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <Card className="border-border/50 shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-lg tracking-tight">{t('project.hub.spreadsheet.cardTitle')}</CardTitle>
                    <CardDescription>{t('project.hub.spreadsheet.cardDescription')}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FormField label={t('project.field.name')} htmlFor="spreadsheet-project-name" required error={spreadsheetValidation.getError('name')}>
                      <Input
                        id="spreadsheet-project-name"
                        value={spreadsheetForm.name}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, name: event.target.value }))
                        }
                        onBlur={() => spreadsheetValidation.markTouched('name')}
                        placeholder="My_Spreadsheet_Project"
                        className={spreadsheetValidation.getError('name') ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20' : ''}
                      />
                    </FormField>
                    <FormField label={t('project.field.owner')} htmlFor="spreadsheet-project-owner">
                      <Input
                        id="spreadsheet-project-owner"
                        value={spreadsheetForm.owner}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, owner: event.target.value }))
                        }
                        placeholder="BESSER User"
                      />
                    </FormField>
                    <FormField label={t('project.field.description')} htmlFor="spreadsheet-project-description">
                      <Textarea
                        id="spreadsheet-project-description"
                        value={spreadsheetForm.description}
                        onChange={(event) =>
                          setSpreadsheetForm((previous) => ({ ...previous, description: event.target.value }))
                        }
                        className="min-h-24"
                      />
                    </FormField>
                    {renderPerspectivePicker(spreadsheetPerspectiveKey, setSpreadsheetPerspectiveKey, 'spreadsheet')}

                    <div className="rounded-xl border-2 border-dashed border-border/50 bg-muted/10 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold tracking-tight">{t('project.hub.spreadsheet.sourceFiles')}</p>
                        <Badge variant="secondary" className="rounded-full font-mono text-[10px]">{spreadsheetFiles.length}</Badge>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full gap-2 border-brand/20 text-brand shadow-elevation-1 transition-all hover:border-brand/30 hover:bg-brand/[0.04]"
                        onClick={() => spreadsheetFileInputRef.current?.click()}
                        disabled={isBusy}
                      >
                        <FileSpreadsheet className="size-4" />
                        {t('project.hub.spreadsheet.selectFiles')}
                      </Button>
                      {spreadsheetFiles.length > 0 && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          {spreadsheetFiles.map((file) => (
                            <div
                              key={`${file.name}-${file.size}`}
                              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/80 px-3 py-2 text-xs"
                            >
                              <span className="truncate font-medium">{file.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{readableFileSize(file.size)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Button onClick={() => void handleStartFromSpreadsheet()} disabled={isBusy || !spreadsheetValidation.isValid} className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2">
                      <Sparkles className="size-4" />
                      {t('project.hub.spreadsheet.submit')}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-elevation-1">
                  <CardHeader>
                    <CardTitle className="text-base tracking-tight">{t('project.hub.spreadsheet.howTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">1</span>
                      <p>{t('project.hub.spreadsheet.step1')}</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">2</span>
                      <p>{t('project.hub.spreadsheet.step2')}</p>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">3</span>
                      <p>{t('project.hub.spreadsheet.step3')}</p>
                    </div>
                    <p className="mt-1 rounded-lg bg-muted/30 px-3 py-2 font-mono text-[10px] tracking-wide">
                      {t('project.hub.spreadsheet.accepted')}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {step === 'open' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold tracking-tight">{t('project.hub.open.allProjects')}</p>
                <Badge variant="secondary" className="rounded-full border-brand/15 bg-brand/[0.06] font-mono text-[10px] text-brand">
                  {sortedProjects.length}
                </Badge>
              </div>
              {renderProjectList()}
            </div>
          )}

          {step === 'github' && (
            <div className="flex flex-col gap-5">
              <Card className="border-border/50 shadow-elevation-1">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base tracking-tight">
                    <Github className="size-4" />
                    Continue from a GitHub repository
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Pick a repository BESSER created (one that contains a saved model). Its model loads into
                    the editor, and the next Vibe run edits that repo&apos;s code and pushes back to it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <FormField label="Repository" htmlFor="github-continue-repo">
                    <select
                      id="github-continue-repo"
                      value={githubRepoFullName}
                      onChange={(event) => void handleSelectGithubRepo(event.target.value)}
                      disabled={githubReposLoading || isBusy}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="" disabled>
                        {githubReposLoading ? 'Loading repositories…' : 'Select a repository'}
                      </option>
                      {githubRepositories.map((repo) => (
                        <option key={repo.id} value={repo.full_name}>
                          {repo.full_name}
                          {repo.private ? ' (private)' : ''}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  {githubRepoFullName && (
                    <FormField label="Branch" htmlFor="github-continue-branch">
                      <select
                        id="github-continue-branch"
                        value={githubBranch}
                        onChange={(event) => setGithubBranch(event.target.value)}
                        disabled={githubLoadingBranches || isBusy}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {githubLoadingBranches ? (
                          <option value="">Loading branches…</option>
                        ) : (
                          githubBranches.map((branch) => (
                            <option key={branch} value={branch}>
                              {branch}
                            </option>
                          ))
                        )}
                      </select>
                    </FormField>
                  )}

                  {githubError && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                      {githubError}
                    </p>
                  )}

                  <Button
                    onClick={() => void handleContinueGithubRepo()}
                    disabled={isBusy || !githubRepoFullName}
                    className="w-full gap-2 bg-brand text-brand-foreground shadow-elevation-1 transition-all hover:bg-brand-dark hover:shadow-elevation-2"
                  >
                    {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
                    {isBusy ? 'Loading…' : 'Continue'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
        )}
      </DialogContent>

      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.confirmLabel}
        cancelLabel={dialogState.cancelLabel}
        variant={dialogState.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </Dialog>
  );
};
