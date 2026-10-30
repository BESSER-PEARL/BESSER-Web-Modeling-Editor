import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useProject } from '../hooks/useProject';
import { ALL_DIAGRAM_TYPES, getActiveDiagram, hasCustomEditor, isUMLModel, toUMLDiagramType, type SupportedDiagramType, type ProjectDiagram } from '../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { bumpEditorRevision, refreshProjectStateThunk, updateDiagramModelThunk, switchDiagramTypeThunk, selectActiveDiagram, selectPerspectives } from '../store/workspaceSlice';
import { isPerspectiveVisible } from '../../shared/types/project';
import { useGitHubAuth } from '../../shared/hooks/useGitHubAuth';
import { useRepoSync } from '../../features/github/hooks/useRepoSync';
import { isGoLiveAvailable } from '../../shared/api/github';
import { ModelProposalBanner } from '../../features/github/components/ModelProposalBanner';
import { RepoChatHeader } from '../../features/github/components/RepoChatHeader';
import {
  OPEN_HELP_GUIDE_EVENT,
  type HelpGuideSectionId,
  type OpenHelpGuideDetail,
} from '../../shared/dialogs/helpGuide';
import { isDarkThemeEnabled, toggleTheme } from '../../shared/utils/theme-switcher';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import {
  LocalStorageRepository,
  DEFAULT_AGENT_RUNTIME_CONFIG,
  normalizeAgentRuntimeConfig,
  type AgentRuntimeConfig,
} from '../../shared/services/storage/local-storage-repository';
import {
  reportDerivationWarnings,
  useGenerateComponentDiagram,
  useGenerateDeploymentDiagram,
} from '../../features/inter-diagram';
import { useGenerateDockerCompose } from '../../features/generation/hooks/useGenerateDockerCompose';
import { readAgentVariants, getActiveAgentVariantId } from '../../shared/services/agent-variants/agent-variants-service';
import { useImportDiagramToProjectWorkflow, useImportBpmnDiagramToProjectWorkflow } from '../../features/import/useImportDiagram';
import { buildProjectExportEnvelope, PROJECT_EXPORT_VERSION, prepareAgentModelForBackend } from '../../shared/utils/projectExportUtils';
import {
  besserLibraryRepositoryLink,
  besserMainRepositoryLink,
  besserWMERepositoryLink,
} from '../../shared/constants/application-constants';
import { sessionStorageOpenAssistantOnLoad, sessionStorageAssistantDrawerOpen } from '../../shared/constants/constant';
import { normalizeProjectName } from '../../shared/utils/projectName';
import { getWorkspaceContext } from '../../shared/utils/workspaceContext';
import { downloadFile, downloadJson } from '../../shared/utils/download';
import type { GenerationResult } from '../../features/generation/types';
import { JsonViewerModal } from '../../shared/components/json-viewer-modal/json-viewer-modal';
// Direct imports: the feature barrel re-exports BafChatWrapper and its heavy deps.
import { CredentialsDialog } from '../../features/agent-simulation/CredentialsDialog';
import {
  selectIsSimulationRunning,
  selectSessionId,
  stopAgentSimulationThunk,
  validateAgentThunk,
} from '../../features/agent-simulation/agentSimulationSlice';
import { agentSimulationApi } from '../../shared/api/agentSimulation';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { DiagramTabs } from '../../features/editors/diagram-tabs/DiagramTabs';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { AboutDialog } from '../../shared/dialogs/AboutDialog';
import { AssistantImportDialog } from '../../features/assistant/components/AssistantImportDialog';
import { OnboardingChecklist } from '../../features/onboarding/OnboardingChecklist';
import { DeployDialog } from '../../features/deploy/dialogs/DeployDialog';
import { DeployResultDialog } from '../../features/deploy/dialogs/DeployResultDialog';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';
import { useDeployment } from './hooks/useDeployment';
import { useAssistantImport } from './hooks/useAssistantImport';
import { useImportOwlToKg } from '../../features/import/useImportOwlToKg';
import { useProjectPreview } from './hooks/useProjectPreview';
import { useGitHubStar } from './hooks/useGitHubStar';
import { useDialogStates } from './hooks/useDialogStates';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import type { QualityCheckResult, QualityCheckState } from '../../features/generation/types';
import {
  loadUserModelValidationRecords,
  saveUserModelValidationRecords,
  semanticModelFingerprint,
  shouldPromptBeforeLeaving,
  userModelValidationStatus,
  type UserModelValidationRecords,
} from './userModelValidation';
import type { AgentVariantOption } from './topbar-types';
import { useHasOpened } from '../hooks/useHasOpened';
import { useStableCallback } from '../hooks/useStableCallback';
import { sanitizeRepoName } from '../../shared/utils/validation';

// Lazy-loaded heavy panels and dialogs (only fetched when opened)
const AssistantWorkspaceDrawer = React.lazy(() =>
  import('../../features/assistant/components/AssistantWorkspaceDrawer').then((m) => ({
    default: m.AssistantWorkspaceDrawer,
  })),
);
const FeedbackDialog = React.lazy(() =>
  import('../../shared/dialogs/FeedbackDialog').then((m) => ({ default: m.FeedbackDialog })),
);
const HelpGuideDialog = React.lazy(() =>
  import('../../shared/dialogs/HelpGuideDialog').then((m) => ({ default: m.HelpGuideDialog })),
);
const GoLiveDialog = React.lazy(() =>
  import('../../features/github/dialogs/GoLiveDialog').then((m) => ({ default: m.GoLiveDialog })),
);
const ShareGistDialog = React.lazy(() =>
  import('../../features/github/dialogs/ShareGistDialog').then((m) => ({ default: m.ShareGistDialog })),
);
const KgImportTargetModal = React.lazy(() =>
  import('../../features/import/KgImportTargetModal').then((m) => ({ default: m.KgImportTargetModal })),
);
// The keyboard toggle hook must be imported eagerly (it registers a global listener).
// KeyboardShortcutsDialog is imported statically alongside the hook to avoid Vite's
// mixed static/dynamic import warning (the module is already in this chunk).
import { KeyboardShortcutsDialog, useKeyboardShortcutsToggle } from '../../shared/dialogs/KeyboardShortcutsDialog';
import { CommandPalette, useCommandPaletteShortcut, buildDefaultActions } from '../../shared/components/command-palette/CommandPalette';
import { HiddenPerspectivesBanner } from '../../features/editors/HiddenPerspectivesBanner';

export type { GeneratorType, GeneratorMenuMode } from './workspace-types';

// addDiagramThunk's message when a project already holds the maximum number
// of diagrams of a type.
const DIAGRAM_LIMIT_REACHED = /limit of \d+ reached/i;

/** Message of a rejected thunk: `.unwrap()` rethrows a SerializedError (a plain object), not an Error. */
const thunkErrorMessage = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return String(err);
};

interface OnboardingHook {
  checklist: {
    createdClass: boolean;
    addedAttribute: boolean;
    createdRelationship: boolean;
    generatedCode: boolean;
    exploredTemplates: boolean;
    triedQualityCheck: boolean;
  };
  checklistDismissed: boolean;
  checklistCompleted: number;
  checklistTotal: number;
  allChecklistDone: boolean;
  dismissChecklist: () => void;
  startTutorial: () => void;
  updateChecklist: (key: keyof OnboardingHook['checklist']) => void;
  [key: string]: unknown;
}

interface WorkspaceShellProps {
  children: React.ReactNode;
  /** Opens the Project Hub; an optional step targets New / Open / Import directly. */
  onOpenProjectHub: (step?: 'create' | 'open' | 'import' | 'spreadsheet' | 'github') => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onGenerate: (type: GeneratorType, config?: Record<string, any>) => void;
  onQualityCheck: () => Promise<QualityCheckResult>;
  showQualityCheck?: boolean;
  generatorMode: GeneratorMenuMode;
  isGenerating?: boolean;
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  onboarding?: OnboardingHook;
}

const isModelEmpty = (model: unknown): boolean => {
  if (!model || typeof model !== 'object') {
    return true;
  }
  // v4 models carry `nodes` / `edges` arrays; legacy v3 models `elements` / `relationships` records.
  const { nodes, edges, elements, relationships } = model as {
    nodes?: unknown[];
    edges?: unknown[];
    elements?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
  const hasNodes = Array.isArray(nodes) && nodes.length > 0;
  const hasEdges = Array.isArray(edges) && edges.length > 0;
  const hasElements = !!elements && Object.keys(elements).length > 0;
  const hasRelationships = !!relationships && Object.keys(relationships).length > 0;
  return !hasNodes && !hasEdges && !hasElements && !hasRelationships;
};

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  children,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onGenerate,
  onQualityCheck,
  showQualityCheck = false,
  generatorMode,
  isGenerating = false,
  onAssistantGenerate,
  onboarding,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const diagram = useAppSelector(selectActiveDiagram);
  const { currentProject, currentDiagramType, switchDiagramType, updateProject } = useProject();
  const {
    isAuthenticated,
    username,
    githubSession,
    login: githubLogin,
    logout: githubLogout,
    isLoading: githubLoading,
  } = useGitHubAuth();
  const importDiagramToProject = useImportDiagramToProjectWorkflow();
  const importBpmnDiagramToProject = useImportBpmnDiagramToProjectWorkflow();

  const isSimulationActive = useAppSelector(selectIsSimulationRunning);
  const simulationSessionId = useAppSelector(selectSessionId);
  const showSimulateAgent = currentProject?.currentDiagramType === UMLDiagramType.AgentDiagram;
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false);
  const [isValidatingBeforeTest, setIsValidatingBeforeTest] = useState(false);
  const [simulationConfig, setSimulationConfig] = useState<Record<string, unknown>>({});

  // Local UI state
  // Sidebar starts expanded so diagram-type labels are visible; users can
  // collapse it with the bottom toggle to reclaim canvas space.
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(currentProject?.name ?? '');
  const [diagramTitleDraft, setDiagramTitleDraft] = useState(diagram?.title ?? '');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => isDarkThemeEnabled());
  const [isGistDialogOpen, setIsGistDialogOpen] = useState(false);
  // Restore the drawer to wherever the user left it this tab (sessionStorage).
  // Defaults to closed when nothing is stored or storage is unavailable.
  const [isAssistantWorkspaceOpen, setIsAssistantWorkspaceOpen] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(sessionStorageAssistantDrawerOpen) === '1';
    } catch {
      return false;
    }
  });
  const [userModelValidationByDiagramId, setUserModelValidationByDiagramId] = useState<UserModelValidationRecords>(
    loadUserModelValidationRecords,
  );

  // Derived values
  const activeUmlType = useMemo(
    () => toUMLDiagramType(currentDiagramType) ?? UMLDiagramType.ClassDiagram,
    [currentDiagramType],
  );
  const { isDeploymentAvailable } = getWorkspaceContext(currentProject?.currentDiagramType);

  const simulationDiagramModel = useMemo(
    (): object =>
      diagram && isUMLModel(diagram.model) ? prepareAgentModelForBackend(diagram.model, diagram) : (diagram?.model ?? {}),
    [diagram],
  );

  // Extracted hooks
  const { hasStarred, starLoading, handleToggleStar } = useGitHubStar({ isAuthenticated, githubSession });

  const {
    isDeployDialogOpen,
    isDeployResultOpen,
    githubRepoName,
    githubRepoDescription,
    githubRepoPrivate,
    useExistingRepo,
    linkedRepo,
    commitMessage,
    deploymentTarget,
    availableDeployTargets,
    isDeployingToRender,
    deploymentResult,
    includePersonalization,
    showPersonalizationOption,
    setIsDeployDialogOpen,
    setIsDeployResultOpen,
    setGithubRepoName,
    setGithubRepoDescription,
    setGithubRepoPrivate,
    setCommitMessage,
    setIncludePersonalization,
    handleOpenDeployDialog,
    handleDeploymentTargetChange,
    handlePublishToRender,
    handleCreateNewInstead,
  } = useDeployment({ currentProject, isDeploymentAvailable });

  const {
    assistantImportMode,
    assistantApiKey,
    assistantSelectedFile,
    assistantImportError,
    isAssistantImporting,
    setAssistantApiKey,
    openAssistantImportDialog,
    resetAssistantImportDialog,
    handleAssistantFileChange,
    handleAssistantImport,
  } = useAssistantImport({ currentProject });

  const {
    openPickerAndImport: openImportOwlPicker,
    importTargetModalProps: kgImportTargetModalProps,
  } = useImportOwlToKg();

  const {
    isProjectPreviewOpen,
    projectPreviewJson,
    projectBumlPreview,
    projectBumlPreviewError,
    isProjectBumlPreviewLoading,
    handleOpenProjectPreview,
    handleCopyProjectPreview,
    handleDownloadProjectPreview,
    handleRequestProjectBumlPreview,
    handleCloseProjectPreview,
    handleCopyProjectBumlPreview,
    handleDownloadProjectBumlPreview,
    generateProjectBumlPreview,
  } = useProjectPreview({ currentProject });

  const {
    isHelpDialogOpen,
    setIsHelpDialogOpen,
    isAboutDialogOpen,
    setIsAboutDialogOpen,
    isFeedbackDialogOpen,
    setIsFeedbackDialogOpen,
    isKeyboardShortcutsOpen,
    setIsKeyboardShortcutsOpen,
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
  } = useDialogStates();

  // Global keyboard shortcut listener: ? or Ctrl+/ opens the shortcuts overlay
  const openKeyboardShortcuts = useCallback(() => setIsKeyboardShortcutsOpen(true), [setIsKeyboardShortcutsOpen]);
  useKeyboardShortcutsToggle(openKeyboardShortcuts);

  // Global keyboard shortcut listener: Ctrl+K / Cmd+K opens the command palette
  const openCommandPalette = useCallback(() => setIsCommandPaletteOpen(true), [setIsCommandPaletteOpen]);
  useCommandPaletteShortcut(openCommandPalette);

  // Refs to avoid stale closures in event listeners
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  useEffect(() => {
    setProjectNameDraft(currentProject?.name ?? '');
  }, [currentProject?.id, currentProject?.name]);

  useEffect(() => {
    setDiagramTitleDraft(diagram?.title ?? '');
  }, [diagram?.id, diagram?.title]);

  // Navigate to /agent-simulation only when the simulation transitions from idle to active.
  // Using a ref avoids re-redirecting the user if they manually navigate away while
  // the simulation is still running.
  const prevIsSimulationActiveRef = useRef(isSimulationActive);
  useEffect(() => {
    const wasActive = prevIsSimulationActiveRef.current;
    prevIsSimulationActiveRef.current = isSimulationActive;
    if (!wasActive && isSimulationActive) {
      navigate('/agent-simulation');
    }
  }, [isSimulationActive, navigate]);

  // Stop any running simulation session when the user switches to a different project
  const prevProjectIdRef = useRef<string | undefined>(currentProject?.id);
  useEffect(() => {
    const currentId = currentProject?.id;
    const prevId = prevProjectIdRef.current;
    prevProjectIdRef.current = currentId;
    if (prevId !== undefined && prevId !== currentId) {
      void dispatch(stopAgentSimulationThunk());
    }
  }, [currentProject?.id, dispatch]);

  // Best-effort session cleanup when the browser tab is closed or reloaded.
  // Uses keepalive so the request can outlive the page.
  useEffect(() => {
    const sessionId = simulationSessionId;
    if (!sessionId) return;
    const handleBeforeUnload = () => {
      agentSimulationApi.stopSession(sessionId, { keepalive: true }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [simulationSessionId]);

  /* ---- Assistant-driven export (JSON / BUML) ---- */
  useEffect(() => {
    const handleAssistantExport = async (e: Event) => {
      const format = (e as CustomEvent<{ format: string }>).detail?.format ?? 'json';
      const project = currentProjectRef.current;

      if (!project) {
        toast.error(t('shell.errors.noProject'));
        return;
      }

      const freshProject = ProjectStorageRepository.loadProject(project.id) || project;

      if (format === 'buml') {
        try {
          const buml = await generateProjectBumlPreview(freshProject);
          const normalizedName =
            normalizeProjectName(project.name || 'project')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_') || 'project';
          downloadFile(buml, `${normalizedName}_buml.py`, 'text/x-python');
          toast.success(t('shell.export.bumlSuccess'));
        } catch (err) {
          toast.error(t('shell.export.bumlFailed', { message: err instanceof Error ? err.message : t('shell.errors.unknown') }));
        }
      } else {
        const exportData = buildProjectExportEnvelope(freshProject);
        const projectName = sanitizeRepoName(project.name || 'project') || 'project';
        downloadJson(exportData, `${projectName}_export.json`);
        toast.success(t('shell.export.jsonSuccess'));
      }
    };

    window.addEventListener('wme:assistant-export-project', handleAssistantExport);
    return () => window.removeEventListener('wme:assistant-export-project', handleAssistantExport);
  }, [generateProjectBumlPreview, t]);

  // Agentic entry: when a project was created with the "agent" interface (or the
  // app was opened with ?agentic), open the assistant drawer once the project is
  // loaded so the user lands on the agentic welcome. The flag is set by
  // ProjectHubDialog / useProjectBootstrap; consume-and-clear it here so the
  // drawer opens exactly once and no prompt is auto-sent.
  useEffect(() => {
    if (!currentProject) {
      return;
    }
    let shouldOpen = false;
    try {
      shouldOpen = sessionStorage.getItem(sessionStorageOpenAssistantOnLoad) === '1';
      if (shouldOpen) {
        sessionStorage.removeItem(sessionStorageOpenAssistantOnLoad);
      }
    } catch {
      shouldOpen = false;
    }
    if (shouldOpen) {
      setIsAssistantWorkspaceOpen(true);
    }
  }, [currentProject?.id]);

  // Persist the drawer's open/closed state for the tab so it stays where the
  // user left it across in-tab reloads (session-scoped, mirrors the read above),
  // and keep the floating FAB (AssistantWidget) in sync via the shared event so
  // only one assistant surface shows — this also covers a restore-open on mount,
  // when no user toggle fired the event.
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionStorageAssistantDrawerOpen, isAssistantWorkspaceOpen ? '1' : '0');
    } catch {
      // Ignore storage failures — persistence is a convenience, not a requirement.
    }
    window.dispatchEvent(
      new CustomEvent('besser:assistant-drawer', { detail: { open: isAssistantWorkspaceOpen } }),
    );
  }, [isAssistantWorkspaceOpen]);

  // Theme classes. The shell stays transparent so the body wash in styles.css shows through.
  const shellBackgroundClass = 'text-foreground';
  const headerBackgroundClass = 'border-b border-brand/10 bg-background/60 dark:border-border/70';
  // Header triggers use variant="ghost"; this keeps their quiet tint and shows the open state.
  const outlineButtonClass =
    'text-foreground/80 hover:bg-foreground/[0.05] hover:text-foreground data-[state=open]:bg-foreground/[0.06] data-[state=open]:text-foreground dark:hover:bg-white/[0.06] dark:data-[state=open]:bg-white/[0.08] max-md:h-8 max-md:px-2';
  const primaryGenerateClass = `gap-2 ${outlineButtonClass}`;
  const sidebarBaseClass =
    'hidden shrink-0 border-r border-border/50 bg-card p-2.5 md:flex md:flex-col md:gap-0.5 dark:border-border/70';
  const sidebarTitleClass = 'px-2.5 pb-1.5 pt-1 text-xs font-medium text-muted-foreground';
  const sidebarDividerClass = 'my-2 border-t border-border/60';
  const sidebarToggleClass =
    'mt-auto flex items-center rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 dark:hover:bg-white/[0.06]';
  const sidebarToggleTextClass = 'truncate';

  // Mobile drawer sidebar: same item styles, always visible, fills the drawer panel.
  const mobileSidebarBaseClass = 'flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2.5 !w-full';

  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null);
  const openMobileDrawer = useCallback(() => setIsMobileDrawerOpen(true), []);

  // The drawer only exists below md; close it if the viewport grows past that.
  useEffect(() => {
    if (!isMobileDrawerOpen || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(min-width: 768px)');
    const handleChange = () => {
      if (query.matches) setIsMobileDrawerOpen(false);
    };
    handleChange();
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, [isMobileDrawerOpen]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  const getUserModelValidationStatus = useCallback((targetDiagram: ProjectDiagram | null | undefined): QualityCheckState => {
    if (!targetDiagram?.id) {
      return 'not_validated';
    }
    return userModelValidationStatus(userModelValidationByDiagramId[targetDiagram.id], targetDiagram.model);
  }, [userModelValidationByDiagramId]);

  useEffect(() => {
    saveUserModelValidationRecords(userModelValidationByDiagramId);
  }, [userModelValidationByDiagramId]);

  // Baseline a User Model the first time it is opened, so leaving it without
  // edits never asks for validation.
  const activeUserDiagramId = currentProject?.currentDiagramType === 'UserDiagram' ? diagram?.id : undefined;
  useEffect(() => {
    if (!activeUserDiagramId || userModelValidationByDiagramId[activeUserDiagramId]) return;
    setUserModelValidationByDiagramId((previous) => previous[activeUserDiagramId] ? previous : {
      ...previous,
      [activeUserDiagramId]: { validatedAt: null, outcome: 'unvalidated', fingerprint: semanticModelFingerprint(diagram?.model) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- baseline once per diagram, not on every autosave
  }, [activeUserDiagramId]);

  // Handlers below that the memoized top bar / sidebar receive read the active diagram,
  // which changes on every autosave, so they use stable identities (useStableCallback).
  const handleTrackedQualityCheck = useStableCallback(async (): Promise<QualityCheckResult> => {
    const result = await onQualityCheck();
    if (result.executed && currentProject?.currentDiagramType === 'UserDiagram' && diagram?.id) {
      const fingerprint = semanticModelFingerprint(diagram.model);
      setUserModelValidationByDiagramId((previous) => ({
        ...previous,
        [diagram.id]: {
          validatedAt: new Date().toISOString(),
          outcome: result.passed ? 'valid' : 'errors',
          fingerprint,
        },
      }));
    }
    return result;
  });

  const ensureUserModelValidationBeforeNavigation = useCallback(async (): Promise<boolean> => {
    // Only the User Model editor itself asks (never Settings or other pages,
    // where there is no editor to validate).
    if (currentProject?.currentDiagramType !== 'UserDiagram' || !diagram || location.pathname !== '/') {
      return true;
    }

    if (isModelEmpty(diagram.model)) {
      return true;
    }

    const record = userModelValidationByDiagramId[diagram.id];
    if (!shouldPromptBeforeLeaving(record, diagram.model)) {
      return true;
    }

    const shouldValidate = await globalConfirm({
      title: t('shell.validateBeforeNav.title'),
      description: t('shell.validateBeforeNav.description'),
      confirmLabel: t('shell.validateBeforeNav.confirmLabel'),
      cancelLabel: t('shell.validateBeforeNav.cancelLabel'),
    });

    if (!shouldValidate) {
      const dismissedFingerprint = semanticModelFingerprint(diagram.model);
      setUserModelValidationByDiagramId((previous) => previous[diagram.id]
        ? { ...previous, [diagram.id]: { ...previous[diagram.id], dismissedFingerprint } }
        : previous);
      return true;
    }

    const result = await handleTrackedQualityCheck();
    // Validation could not run (it already said why): never trap the user here.
    if (!result.executed || result.passed) {
      return true;
    }

    const confirmLeaveWithIssues = await globalConfirm({
      title: t('shell.leaveWithIssues.title'),
      description: t('shell.leaveWithIssues.description'),
      confirmLabel: t('shell.leaveWithIssues.confirmLabel'),
      cancelLabel: t('shell.leaveWithIssues.cancelLabel'),
      variant: 'danger',
    });

    return confirmLeaveWithIssues;
  }, [currentProject?.currentDiagramType, diagram, handleTrackedQualityCheck, location.pathname, t, userModelValidationByDiagramId]);

  const handleSwitchDiagramType = useStableCallback(async (type: SupportedDiagramType) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }

    if (location.pathname !== '/') {
      navigate('/');
    }
    dispatch(switchDiagramTypeThunk({ diagramType: type }));
  });

  const handleSwitchUml = useStableCallback(async (type: UMLDiagramType) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }

    if (location.pathname !== '/') {
      navigate('/');
    }
    // Don't skip the switch when the active UML type already matches AND we're on /
    // (with a GUI / quantum / KG editor open, the UML type is not what is shown)
    if (location.pathname === '/' && activeUmlType === type && !hasCustomEditor(currentDiagramType)) {
      return;
    }
    switchDiagramType(type);
  });

  const deriveComponentDiagram = useGenerateComponentDiagram();
  const handleDeriveComponentDiagram = useCallback(async () => {
    try {
      const r = await deriveComponentDiagram();
      if (!r.ok) {
        const reasonKey =
          r.reason === 'no-pools'
            ? 'interDiagram.derive.component.noPools'
            : r.reason === 'no-lanes-in-any-pool'
              ? 'interDiagram.derive.component.noLanes'
              : 'interDiagram.derive.component.notBpmn';
        toast.error(t('interDiagram.derive.component.failed', { reason: t(reasonKey) }));
        return;
      }
      if (r.warnings.length > 0) {
        reportDerivationWarnings(
          '[inter-diagram]',
          t('interDiagram.derive.component.doneWithWarnings', { count: r.warnings.length }),
          r.warnings,
          t,
        );
      } else {
        toast.success(t('interDiagram.derive.component.done'));
      }
    } catch (err) {
      // addDiagramThunk rejects at the per-type diagram limit; any other
      // rejection is reported with its own message.
      console.error('[inter-diagram] derivation failed:', err);
      const message = thunkErrorMessage(err);
      const reason = DIAGRAM_LIMIT_REACHED.test(message) ? t('interDiagram.derive.component.limitReached') : message;
      toast.error(t('interDiagram.derive.component.failed', { reason }));
    }
  }, [deriveComponentDiagram, t]);

  const deriveDeploymentDiagram = useGenerateDeploymentDiagram();
  const handleDeriveDeploymentDiagram = useCallback(async () => {
    try {
      const r = await deriveDeploymentDiagram();
      if (!r.ok) {
        const reasonKey =
          r.reason === 'no-components'
            ? 'interDiagram.derive.deployment.noComponents'
            : 'interDiagram.derive.deployment.notComponentDiagram';
        toast.error(t('interDiagram.derive.deployment.failed', { reason: t(reasonKey) }));
        return;
      }
      if (r.warnings.length > 0) {
        reportDerivationWarnings(
          '[inter-diagram]',
          t('interDiagram.derive.deployment.doneWithWarnings', { count: r.warnings.length }),
          r.warnings,
          t,
        );
      } else {
        toast.success(t('interDiagram.derive.deployment.done'));
      }
    } catch (err) {
      console.error('[inter-diagram] deployment derivation failed:', err);
      const message = thunkErrorMessage(err);
      const reason = DIAGRAM_LIMIT_REACHED.test(message) ? t('interDiagram.derive.deployment.limitReached') : message;
      toast.error(t('interDiagram.derive.deployment.failed', { reason }));
    }
  }, [deriveDeploymentDiagram, t]);

  const { generate: generateDockerCompose, isLoading: isDockerComposing } = useGenerateDockerCompose();
  const handleGenerateDockerCompose = useCallback(async () => {
    await generateDockerCompose();
  }, [generateDockerCompose]);

  // Wrappers that close mobile drawer after navigating
  const handleMobileSwitchUml = useCallback((type: UMLDiagramType) => {
    void handleSwitchUml(type);
    setIsMobileDrawerOpen(false);
  }, [handleSwitchUml]);

  const handleMobileSwitchDiagramType = useCallback((type: SupportedDiagramType) => {
    void handleSwitchDiagramType(type);
    setIsMobileDrawerOpen(false);
  }, [handleSwitchDiagramType]);

  const handleSafeNavigate = useStableCallback(async (path: string) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }
    handleNavigate(path);
  });

  const handleMobileNavigate = useCallback((path: string) => {
    void handleSafeNavigate(path);
    setIsMobileDrawerOpen(false);
  }, [handleSafeNavigate]);

  const userModelValidationStatusById = useMemo(() => {
    const statuses: Record<string, QualityCheckState> = {};
    const userDiagrams = currentProject?.diagrams?.UserDiagram ?? [];
    for (const userDiagram of userDiagrams) {
      statuses[userDiagram.id] = getUserModelValidationStatus(userDiagram);
    }
    return statuses;
  }, [currentProject?.diagrams?.UserDiagram, getUserModelValidationStatus]);

  const activeQualityCheckState = currentProject?.currentDiagramType === 'UserDiagram' && diagram
    ? getUserModelValidationStatus(diagram)
    : undefined;

  const activeAgentVariantId = useMemo(() => {
    if (currentProject?.currentDiagramType !== 'AgentDiagram') {
      return '';
    }

    const rawValue = (diagram?.config as Record<string, unknown> | undefined)?.activePersonalizedVariantId;
    return typeof rawValue === 'string' ? rawValue : '';
  }, [currentProject?.currentDiagramType, diagram?.config]);

  const agentVariantOptions = useMemo<AgentVariantOption[]>(() => {
    if (currentProject?.currentDiagramType !== 'AgentDiagram') {
      return [];
    }

    return readAgentVariants(diagram).map((variant) => ({
      id: variant.id,
      label: `${variant.profileName} (${variant.configurationName})`,
      description: t('shell.agentVariant.createdAt', { date: new Date(variant.createdAt).toLocaleString() }),
    }));
  }, [currentProject?.currentDiagramType, diagram, t]);

  const handleAgentVariantChange = useStableCallback(async (variantId: string) => {
    if (currentProject?.currentDiagramType !== 'AgentDiagram' || !currentProject || !diagram?.id) {
      return;
    }

    const latestProjectSnapshot = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const agentIndex = latestProjectSnapshot.currentDiagramIndices.AgentDiagram ?? 0;
    const activeAgentDiagram = latestProjectSnapshot.diagrams.AgentDiagram[agentIndex] || getActiveDiagram(latestProjectSnapshot, 'AgentDiagram') || diagram;
    let currentConfigRecord = (activeAgentDiagram.config ?? {}) as Record<string, unknown>;

    try {
      // Persist the current live model back into its source before switching,
      // so in-canvas edits to the active base/variant aren't discarded. When a
      // variant is active, fold the edits into its inline snapshot; on the base,
      // update the stored base model.
      const currentActiveVariantId = getActiveAgentVariantId(activeAgentDiagram);
      const liveModel = activeAgentDiagram.model;
      if (isUMLModel(liveModel) && liveModel.type === UMLDiagramType.AgentDiagram) {
        if (currentActiveVariantId) {
          const currentVariants = readAgentVariants(activeAgentDiagram);
          if (currentVariants.some((variant) => variant.id === currentActiveVariantId)) {
            currentConfigRecord = {
              ...currentConfigRecord,
              personalizedVariants: currentVariants.map((variant) =>
                variant.id === currentActiveVariantId
                  ? { ...variant, model: structuredClone(liveModel) }
                  : variant,
              ),
            };
          }
        } else {
          LocalStorageRepository.saveAgentBaseModel(activeAgentDiagram.id, liveModel);
        }
      }

      if (!variantId) {
        const baseModel = LocalStorageRepository.getAgentBaseModel(activeAgentDiagram.id);
        if (!baseModel) {
          toast.error(t('shell.agentVariant.noBaseModel'));
          return;
        }

        const success = ProjectStorageRepository.updateDiagram(currentProject.id, 'AgentDiagram', {
          ...activeAgentDiagram,
          model: structuredClone(baseModel),
          config: {
            ...currentConfigRecord,
            activePersonalizedVariantId: null,
          },
        }, agentIndex);

        if (!success) {
          throw new Error('Could not persist base variant switch.');
        }

        await dispatch(refreshProjectStateThunk()).unwrap();
        dispatch(bumpEditorRevision());
        toast.success(t('shell.agentVariant.switchedToBase'));
        return;
      }

      const selectedVariant = readAgentVariants(activeAgentDiagram).find((variant) => variant.id === variantId);
      if (!selectedVariant || !isUMLModel(selectedVariant.model) || selectedVariant.model.type !== UMLDiagramType.AgentDiagram) {
        toast.error(t('shell.agentVariant.notAvailable'));
        return;
      }

      const variantModel = structuredClone(selectedVariant.model);

      const success = ProjectStorageRepository.updateDiagram(currentProject.id, 'AgentDiagram', {
        ...activeAgentDiagram,
        model: variantModel,
        config: {
          ...currentConfigRecord,
          activePersonalizedVariantId: variantId,
        },
      }, agentIndex);

      if (!success) {
        throw new Error('Could not persist personalized variant switch.');
      }

      await dispatch(refreshProjectStateThunk()).unwrap();
      dispatch(bumpEditorRevision());
      toast.success(t('shell.agentVariant.switchedToVariant', { name: selectedVariant.profileName }));
    } catch (error) {
      console.error('Failed to switch agent variant:', error);
      const message = error instanceof Error ? error.message : t('shell.agentVariant.switchFailed');
      toast.error(message);
    }
  });

  const handleRequestTabSwitch = useCallback(async (): Promise<boolean> => {
    return ensureUserModelValidationBeforeNavigation();
  }, [ensureUserModelValidationBeforeNavigation]);

  const handleAssistantSwitchDiagram = async (diagramType: string): Promise<boolean> => {
    // Navigate to editor view if on a different page
    if (location.pathname !== '/') {
      navigate('/');
    }

    try {
      const supported = diagramType as SupportedDiagramType;
      await dispatch(switchDiagramTypeThunk({ diagramType: supported })).unwrap();
    } catch {
      toast.error(t('shell.errors.couldNotSwitchDiagram', { type: diagramType }));
      return false;
    }

    await new Promise<void>((resolve) => {
      if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
        setTimeout(resolve, 0);
        return;
      }
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });

    return true;
  };

  const handleProjectRename = useCallback(() => {
    const normalized = normalizeProjectName(projectNameDraft);
    if (!normalized || !currentProject || normalized === currentProject.name) {
      setProjectNameDraft(currentProject?.name ?? '');
      return;
    }
    updateProject({ name: normalized });
  }, [projectNameDraft, currentProject, updateProject]);

  const handleDiagramRename = useCallback(() => {
    const normalized = diagramTitleDraft.trim();
    const currentTitle = diagram?.title ?? '';
    if (!normalized || normalized === currentTitle) {
      setDiagramTitleDraft(currentTitle);
      return;
    }
    dispatch(updateDiagramModelThunk({ title: normalized }));
  }, [diagramTitleDraft, diagram?.title, dispatch]);

  const handleSimulateAgent = useStableCallback(async () => {
    if (isModelEmpty(diagram?.model)) {
      toast.info(t('agentSimulation.launch.emptyDiagram'));
      return;
    }

    setIsValidatingBeforeTest(true);

    // Read diagram config from fresh storage so that fields written directly to
    // localStorage (e.g. default_llm_name via writeConfig) are not missed by the
    // Redux state, which may not yet reflect those writes.
    const freshProject = currentProject?.id
      ? (ProjectStorageRepository.loadProject(currentProject.id) ?? currentProject)
      : currentProject;
    const freshAgentDiagram = freshProject ? getActiveDiagram(freshProject, UMLDiagramType.AgentDiagram) : undefined;
    const freshDiagramConfig = freshAgentDiagram?.config ?? null;
    const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
    const freshLlmBlock =
      freshDiagramConfig && typeof freshDiagramConfig.llm === 'object' && freshDiagramConfig.llm !== null
        ? (freshDiagramConfig.llm as Record<string, unknown>)
        : null;
    const freshAgentConfig = freshDiagramConfig
      ? normalizeAgentRuntimeConfig({
          agentPlatform: asString(freshDiagramConfig.agentPlatform),
          agentPlatformUseStreamlit:
            typeof freshDiagramConfig.agentPlatformUseStreamlit === 'boolean'
              ? freshDiagramConfig.agentPlatformUseStreamlit
              : undefined,
          intentRecognitionTechnology: asString(freshDiagramConfig.intentRecognitionTechnology) as
            | AgentRuntimeConfig['intentRecognitionTechnology']
            | undefined,
          agentLlmProvider: asString(freshLlmBlock?.provider) as AgentRuntimeConfig['agentLlmProvider'] | undefined,
          agentLlmModel: asString(freshLlmBlock?.model),
          agentCustomLlmModel: undefined,
          agentLlmName: asString(freshDiagramConfig.agentLlmName) ?? asString(freshLlmBlock?.name),
        })
      : { ...DEFAULT_AGENT_RUNTIME_CONFIG };
    const freshResolvedOpenAiModel =
      freshAgentConfig.agentLlmModel === 'other'
        ? freshAgentConfig.agentCustomLlmModel.trim()
        : freshAgentConfig.agentLlmModel;
    const freshResolvedAgentPlatform =
      freshAgentConfig.agentPlatform === 'websocket' && freshAgentConfig.agentPlatformUseStreamlit
        ? 'streamlit'
        : freshAgentConfig.agentPlatform;
    const freshDefaultLlmName = asString(freshDiagramConfig?.default_llm_name) || undefined;
    const freshConfig: Record<string, unknown> = {
      agentPlatform: freshResolvedAgentPlatform,
      intentRecognitionTechnology: freshAgentConfig.intentRecognitionTechnology,
      ...(freshDefaultLlmName ? { default_llm_name: freshDefaultLlmName } : {}),
      ...(freshAgentConfig.agentLlmName
        ? { llm: { name: freshAgentConfig.agentLlmName } }
        : freshAgentConfig.agentLlmProvider
        ? {
            llm: {
              provider: freshAgentConfig.agentLlmProvider,
              ...(freshResolvedOpenAiModel ? { model: freshResolvedOpenAiModel } : {}),
            },
          }
        : {}),
    };
    setSimulationConfig(freshConfig);

    const result = await dispatch(
      validateAgentThunk({
        title: diagram?.title ?? t('agentSimulation.defaultDiagramTitle'),
        // The same prepared model CredentialsDialog starts the session with.
        model: simulationDiagramModel,
        config: freshConfig,
        configYaml: diagram?.configYaml,
      }),
    );

    setIsValidatingBeforeTest(false);

    if (validateAgentThunk.rejected.match(result)) {
      const msg = result.payload ?? t('agentSimulation.launch.validationFailedGeneric');
      toast.error(t('agentSimulation.launch.validationFailed', { message: msg }));
      return;
    }

    if (validateAgentThunk.fulfilled.match(result) && !result.payload.valid) {
      const errors = result.payload.errors;
      const msg = errors.length > 0 ? `\n${errors.join('\n')}` : t('agentSimulation.launch.validationFailedGeneric');
      toast.error(t('agentSimulation.launch.validationFailed', { message: msg }));
      return;
    }

    setIsCredentialsDialogOpen(true);
  });

  const handleToggleTheme = useCallback(() => {
    toggleTheme();
    setIsDarkTheme(isDarkThemeEnabled());
  }, []);

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImportSingleDiagram = useStableCallback(async () => {
    if (!currentProject) {
      toast.error(t('shell.errors.noProject'));
      return;
    }

    try {
      const result = await importDiagramToProject();
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('shell.errors.unknown');
      if (message.toLowerCase().includes('cancel')) {
        return;
      }
      toast.error(t('shell.import.failed', { message }));
    }
  });

  const handleImportBpmnDiagram = useStableCallback(async () => {
    if (!currentProject) {
      toast.error(t('shell.errors.noProject'));
      return;
    }

    try {
      const result = await importBpmnDiagramToProject();
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('shell.errors.unknown');
      if (message.toLowerCase().includes('cancel')) {
        return;
      }
      toast.error(t('shell.import.failed', { message }));
    }
  });

  // Command palette actions (filter by enabled per-project perspectives)
  const perspectives = useAppSelector(selectPerspectives);
  const commandPaletteActions = useMemo(
    () =>
      buildDefaultActions({
        onSwitchToClassDiagram: () => handleSwitchUml(UMLDiagramType.ClassDiagram),
        onSwitchToStateMachine: () => handleSwitchUml(UMLDiagramType.StateMachineDiagram),
        onSwitchToObjectDiagram: () => handleSwitchUml(UMLDiagramType.ObjectDiagram),
        onSwitchToGUIEditor: () => handleSwitchDiagramType('GUINoCodeDiagram'),
        onSwitchToAgentDiagram: () => handleSwitchUml(UMLDiagramType.AgentDiagram),
        onSwitchToQuantumCircuit: () => handleSwitchDiagramType('QuantumCircuitDiagram'),
        onGoToSettings: () => {
          void handleSafeNavigate('/project-settings');
        },
        onExportJSON: () => onExportProject(),
        onExportBUML: () => onExportProject(),
        onQualityCheck: () => {
          void handleTrackedQualityCheck();
        },
        isDiagramVisible: (type) => isPerspectiveVisible(perspectives, type),
      }),
    [handleSwitchUml, handleSwitchDiagramType, handleSafeNavigate, onExportProject, handleTrackedQualityCheck, perspectives],
  );

  // Primitive key so the memoized sidebar only re-renders when a count changes.
  const diagramCountsKey = ALL_DIAGRAM_TYPES.map((type) => currentProject?.diagrams?.[type]?.length ?? 0).join(',');
  const diagramCounts = useMemo(() => {
    const counts = diagramCountsKey.split(',').map(Number);
    return Object.fromEntries(ALL_DIAGRAM_TYPES.map((type, index) => [type, counts[index]])) as Record<SupportedDiagramType, number>;
  }, [diagramCountsKey]);
  const activeDiagramType = currentProject?.currentDiagramType ?? 'ClassDiagram';

  const openAssistantImportImage = useCallback(() => openAssistantImportDialog('image'), [openAssistantImportDialog]);
  const openAssistantImportKg = useCallback(() => openAssistantImportDialog('kg'), [openAssistantImportDialog]);
  const openClassicDeployDialog = useStableCallback(handleOpenDeployDialog);
  const [isGoLiveOpen, setIsGoLiveOpen] = useState(false);
  const [goLiveAvailable, setGoLiveAvailable] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isGoLiveAvailable().then((available) => !cancelled && setGoLiveAvailable(available));
    return () => {
      cancelled = true;
    };
  }, []);
  const openProjectPreview = useStableCallback(handleOpenProjectPreview);
  // The top bar's GitHub menu checks the repo's sync status; the shell needs only the link.
  const repoSync = useRepoSync({ checkRemote: false });
  const canGoLive = goLiveAvailable && !!repoSync.link && !!repoSync.githubSession && !!currentProject;
  // A project linked to a repo deploys that repo (the agent's app); others keep the classic deploy.
  const openDeployDialog = useStableCallback(() => (canGoLive ? setIsGoLiveOpen(true) : openClassicDeployDialog()));
  const openGistDialog = useCallback(
    () => (isAuthenticated ? setIsGistDialogOpen(true) : githubLogin()),
    [isAuthenticated, githubLogin],
  );
  const [helpSection, setHelpSection] = useState<HelpGuideSectionId | undefined>();
  // A repository opened from the GitHub menu: its summary goes to the chat, and the chat opens.
  const showOpenedRepoInAssistant = useCallback((summary: string) => {
    void import('../../features/assistant/hooks/assistantConversationStore').then((m) => m.postAssistantMessage(summary));
    setIsAssistantWorkspaceOpen(true);
  }, []);
  const openHelpDialog = useCallback(() => {
    setHelpSection(undefined);
    setIsHelpDialogOpen(true);
  }, [setIsHelpDialogOpen]);
  // Other parts of the app open the guide at a section (e.g. the GitHub menu's "How GitHub works").
  useEffect(() => {
    const onOpen = (event: Event) => {
      setHelpSection((event as CustomEvent<OpenHelpGuideDetail>).detail?.section);
      setIsHelpDialogOpen(true);
    };
    window.addEventListener(OPEN_HELP_GUIDE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_HELP_GUIDE_EVENT, onOpen);
  }, [setIsHelpDialogOpen]);
  const openAboutDialog = useCallback(() => setIsAboutDialogOpen(true), [setIsAboutDialogOpen]);
  const openFeedback = useCallback(() => setIsFeedbackDialogOpen(true), [setIsFeedbackDialogOpen]);
  const toggleSidebarExpanded = useCallback(() => setIsSidebarExpanded((previous) => !previous), []);
  const testAgent = showSimulateAgent ? handleSimulateAgent : undefined;

  // Lazy panels mount on first open so their chunks are not fetched at startup.
  const feedbackDialogMounted = useHasOpened(isFeedbackDialogOpen);
  const helpDialogMounted = useHasOpened(isHelpDialogOpen);
  const gistDialogMounted = useHasOpened(isGistDialogOpen);
  const goLiveDialogMounted = useHasOpened(isGoLiveOpen);

  return (
    <TooltipProvider delayDuration={400}>
    <div className={`flex h-screen flex-col overflow-hidden ${shellBackgroundClass}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('shell.skipToEditor', { defaultValue: 'Skip to Editor' })}
      </a>
      <WorkspaceTopBar
        isDarkTheme={isDarkTheme}
        headerBackgroundClass={headerBackgroundClass}
        outlineButtonClass={outlineButtonClass}
        primaryGenerateClass={primaryGenerateClass}
        showQualityCheck={
          showQualityCheck && currentDiagramType !== 'GUINoCodeDiagram' && currentDiagramType !== 'QuantumCircuitDiagram'
        }
        generatorMode={generatorMode}
        isGenerating={isGenerating || isDockerComposing}
        isAuthenticated={isAuthenticated}
        username={username || undefined}
        githubLoading={githubLoading}
        hasProject={Boolean(currentProject)}
        isDeploymentAvailable={isDeploymentAvailable}
        deployGoesLive={canGoLive}
        onOpenProjectHub={onOpenProjectHub}
        onOpenTemplateDialog={onOpenTemplateDialog}
        onExportProject={onExportProject}
        onImportSingleDiagram={handleImportSingleDiagram}
        onImportBpmnDiagram={handleImportBpmnDiagram}
        onOpenAssistantImportImage={openAssistantImportImage}
        onOpenAssistantImportKg={openAssistantImportKg}
        onImportOwl={openImportOwlPicker}
        onOpenProjectPreview={openProjectPreview}
        onShareAsGist={openGistDialog}
        onGenerate={onGenerate}
        onQualityCheck={handleTrackedQualityCheck}
        qualityCheckState={activeQualityCheckState}
        showAgentVariantSelector={currentProject?.currentDiagramType === 'AgentDiagram'}
        agentVariantOptions={agentVariantOptions}
        activeAgentVariantId={activeAgentVariantId}
        onAgentVariantChange={handleAgentVariantChange}
        onToggleTheme={handleToggleTheme}
        onGitHubLogin={githubLogin}
        onGitHubLogout={githubLogout}
        onRepoOpened={showOpenedRepoInAssistant}
        hasStarred={hasStarred}
        starLoading={starLoading}
        onToggleStar={handleToggleStar}
        onOpenDeployDialog={openDeployDialog}
        onOpenHelpDialog={openHelpDialog}
        onOpenAboutDialog={openAboutDialog}
        onOpenFeedback={openFeedback}
        onOpenKeyboardShortcuts={openKeyboardShortcuts}
        onShowWelcomeGuide={onboarding?.startTutorial}
        activeDiagramType={activeDiagramType}
        onSwitchDiagramType={handleSwitchDiagramType}
        onDeriveComponentDiagram={
          isPerspectiveVisible(perspectives, 'ComponentDiagram') ? handleDeriveComponentDiagram : undefined
        }
        onDeriveDeploymentDiagram={
          isPerspectiveVisible(perspectives, 'DeploymentDiagram') ? handleDeriveDeploymentDiagram : undefined
        }
        onGenerateDockerCompose={
          isPerspectiveVisible(perspectives, 'DeploymentDiagram') ? handleGenerateDockerCompose : undefined
        }
        projectNameDraft={projectNameDraft}
        onProjectNameDraftChange={setProjectNameDraft}
        onProjectRename={handleProjectRename}
        isMobileNavOpen={isMobileDrawerOpen}
        onOpenMobileNav={openMobileDrawer}
        mobileNavTriggerRef={mobileNavTriggerRef}
      />

      {/* Mobile navigation drawer (below md): a left-side Radix dialog */}
      <Dialog open={isMobileDrawerOpen} onOpenChange={setIsMobileDrawerOpen}>
        <DialogPortal>
          <DialogOverlay className="duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=closed]:duration-[180ms] md:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              mobileNavTriggerRef.current?.focus();
            }}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border/60 bg-card shadow-xl duration-[240ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left data-[state=closed]:duration-[180ms] focus:outline-none md:hidden"
          >
            <DialogTitle className="sr-only">{t('shell.nav.title')}</DialogTitle>
            <DialogPrimitive.Close
              className="absolute right-2.5 top-2.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t('shell.nav.close')}
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
            <WorkspaceSidebar
              isDarkTheme={isDarkTheme}
              isSidebarExpanded={true}
              sidebarBaseClass={mobileSidebarBaseClass}
              sidebarTitleClass={sidebarTitleClass}
              sidebarDividerClass={sidebarDividerClass}
              sidebarToggleClass={sidebarToggleClass}
              sidebarToggleTextClass={sidebarToggleTextClass}
              locationPath={location.pathname}
              activeUmlType={activeUmlType}
              activeDiagramType={activeDiagramType}
              diagramCounts={diagramCounts}
              perspectives={perspectives}
              onSwitchUml={handleMobileSwitchUml}
              onSwitchDiagramType={handleMobileSwitchDiagramType}
              onNavigate={handleMobileNavigate}
              onTestAgent={testAgent}
            />
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <WorkspaceSidebar
          isDarkTheme={isDarkTheme}
          isSidebarExpanded={isSidebarExpanded}
          sidebarBaseClass={sidebarBaseClass}
          sidebarTitleClass={sidebarTitleClass}
          sidebarDividerClass={sidebarDividerClass}
          sidebarToggleClass={sidebarToggleClass}
          sidebarToggleTextClass={sidebarToggleTextClass}
          locationPath={location.pathname}
          activeUmlType={activeUmlType}
          activeDiagramType={activeDiagramType}
          diagramCounts={diagramCounts}
          perspectives={perspectives}
          onSwitchUml={handleSwitchUml}
          onSwitchDiagramType={handleSwitchDiagramType}
          onNavigate={handleSafeNavigate}
          onToggleExpanded={toggleSidebarExpanded}
          onTestAgent={testAgent}
        />

        <main id="main" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-hidden focus:outline-none">
          <HiddenPerspectivesBanner />
          {location.pathname === '/' && (
            <DiagramTabs
              onRequestTabSwitch={handleRequestTabSwitch}
              userModelValidationStatusById={userModelValidationStatusById}
            />
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {children}
            {/* The model BESSER read from a linked repo's code, until the user accepts it. */}
            <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-4">
              <ModelProposalBanner />
            </div>
          </div>

          {/* Onboarding checklist - fixed bottom-right */}
          {onboarding && !onboarding.checklistDismissed && (
            <div className="absolute bottom-4 right-4 z-30 w-56">
              <OnboardingChecklist
                checklist={onboarding.checklist}
                completed={onboarding.checklistCompleted}
                total={onboarding.checklistTotal}
                allDone={onboarding.allChecklistDone}
                isDarkTheme={isDarkTheme}
                onDismiss={onboarding.dismissChecklist}
              />
            </div>
          )}
        </main>

        {/*
          Bottom-sheet assistant drawer. Renders a 28-px drag handle at
          the bottom of the viewport in its closed state; the user drags
          up to expand into the full-page assistant surface. When the
          drawer is open, ``AssistantWidget`` (the floating FAB) hides
          itself automatically via the ``besser:assistant-drawer``
          custom event so only one assistant surface is visible at a
          time.

          The drawer internally calls ``useAssistantLogic`` (the same
          hook the FAB uses), so the ``trigger_smart_generator`` action
          from the modeling agent is handled there too — a spec-driven
          run started from the drawer streams its events into the same
          chat as the modeling-agent conversation.
        */}
        <Suspense fallback={null}>
          <AssistantWorkspaceDrawer
            open={isAssistantWorkspaceOpen}
            onOpenChange={setIsAssistantWorkspaceOpen}
            onTriggerGenerator={onAssistantGenerate}
            onSwitchDiagram={handleAssistantSwitchDiagram}
            showTrigger={location.pathname === '/'}
            // The repository this conversation works on, when the project is linked.
            chatHeader={<RepoChatHeader className="mb-4" />}
          />
        </Suspense>
      </div>

      <AssistantImportDialog
        open={assistantImportMode !== null}
        mode={assistantImportMode}
        apiKey={assistantApiKey}
        selectedFile={assistantSelectedFile}
        error={assistantImportError}
        isImporting={isAssistantImporting}
        onOpenChange={(open) => {
          if (!open) {
            resetAssistantImportDialog();
          }
        }}
        onApiKeyChange={setAssistantApiKey}
        onFileChange={handleAssistantFileChange}
        onImport={() => {
          handleAssistantImport().catch(console.error);
        }}
      />

      {/* Destination prompt for an OWL/RDF import when the active Knowledge
          Graph tab already has content: merge alongside, or a new tab. */}
      <Suspense fallback={null}>
        <KgImportTargetModal {...kgImportTargetModalProps} />
      </Suspense>

      <JsonViewerModal
        isVisible={isProjectPreviewOpen}
        jsonData={projectPreviewJson}
        diagramType={t('shell.preview.projectLabel', { version: PROJECT_EXPORT_VERSION })}
        onClose={handleCloseProjectPreview}
        onCopy={handleCopyProjectPreview}
        onDownload={handleDownloadProjectPreview}
        enableBumlView
        bumlData={projectBumlPreview}
        bumlLabel={currentProject?.name ? t('shell.preview.bumlLabelNamed', { name: currentProject.name }) : t('shell.preview.bumlLabel')}
        isBumlLoading={isProjectBumlPreviewLoading}
        bumlError={projectBumlPreviewError}
        onRequestBuml={() => {
          handleRequestProjectBumlPreview().catch(console.error);
        }}
        onCopyBuml={handleCopyProjectBumlPreview}
        onDownloadBuml={handleDownloadProjectBumlPreview}
      />

      {feedbackDialogMounted && (
        <Suspense fallback={null}>
          <FeedbackDialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen} />
        </Suspense>
      )}

      {helpDialogMounted && (
        <Suspense fallback={null}>
          <HelpGuideDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} initialSection={helpSection} />
        </Suspense>
      )}

      <KeyboardShortcutsDialog open={isKeyboardShortcutsOpen} onOpenChange={setIsKeyboardShortcutsOpen} />

      <Suspense fallback={null}>
        {gistDialogMounted && (
          <ShareGistDialog open={isGistDialogOpen} onOpenChange={setIsGistDialogOpen} githubSession={githubSession} />
        )}

        {goLiveDialogMounted && canGoLive && repoSync.link && repoSync.githubSession && currentProject && (
          <GoLiveDialog
            open={isGoLiveOpen}
            projectId={currentProject.id}
            link={repoSync.link}
            githubSession={repoSync.githubSession}
            onOpenChange={setIsGoLiveOpen}
            onUseClassicDeploy={() => {
              setIsGoLiveOpen(false);
              openClassicDeployDialog();
            }}
          />
        )}
      </Suspense>

      <DeployDialog
        open={isDeployDialogOpen}
        isDeploying={isDeployingToRender}
        repoName={githubRepoName}
        repoDescription={githubRepoDescription}
        repoPrivate={githubRepoPrivate}
        useExistingRepo={useExistingRepo}
        linkedRepo={linkedRepo}
        commitMessage={commitMessage}
        deploymentTarget={deploymentTarget}
        availableTargets={availableDeployTargets}
        includePersonalization={includePersonalization}
        showPersonalizationOption={showPersonalizationOption}
        onOpenChange={setIsDeployDialogOpen}
        onDeploymentTargetChange={handleDeploymentTargetChange}
        onRepoNameChange={setGithubRepoName}
        onRepoDescriptionChange={setGithubRepoDescription}
        onRepoPrivateChange={setGithubRepoPrivate}
        onCommitMessageChange={setCommitMessage}
        onIncludePersonalizationChange={setIncludePersonalization}
        onCreateNewInstead={handleCreateNewInstead}
        onPublish={() => {
          handlePublishToRender().catch(console.error);
        }}
      />

      <DeployResultDialog
        open={isDeployResultOpen}
        deploymentResult={deploymentResult}
        onOpenChange={setIsDeployResultOpen}
        onOpenExternal={(url) => openExternalUrl(url)}
      />

      <AboutDialog
        open={isAboutDialogOpen}
        onOpenChange={setIsAboutDialogOpen}
        onOpenMainRepository={() => openExternalUrl(besserMainRepositoryLink)}
        onOpenWmeRepository={() => openExternalUrl(besserWMERepositoryLink)}
        onOpenLibraryRepository={() => openExternalUrl(besserLibraryRepositoryLink)}
      />

      <CommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        actions={commandPaletteActions}
      />

      <CredentialsDialog
        open={isCredentialsDialogOpen}
        onOpenChange={setIsCredentialsDialogOpen}
        diagramTitle={diagram?.title ?? t('agentSimulation.defaultDiagramTitle')}
        diagramModel={simulationDiagramModel}
        diagramConfig={simulationConfig}
        diagramConfigYaml={diagram?.configYaml}
      />

    </div>
    </TooltipProvider>
  );
};
