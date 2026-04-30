import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import { Menu, X } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import { getActiveDiagram, isUMLModel, toUMLDiagramType, type SupportedDiagramType, type ProjectDiagram } from '../../shared/types/project';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { bumpEditorRevision, refreshProjectStateThunk, updateDiagramModelThunk, switchDiagramTypeThunk, selectActiveDiagram } from '../store/workspaceSlice';
import { useGitHubAuth } from '../../features/github/hooks/useGitHubAuth';
import { isDarkThemeEnabled, toggleTheme } from '../../shared/utils/theme-switcher';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { LocalStorageRepository } from '../../shared/services/storage/local-storage-repository';
import { readAgentVariants } from '../../shared/services/agent-variants/agent-variants-service';
import { useImportDiagramToProjectWorkflow } from '../../features/import/useImportDiagram';
import { buildProjectExportEnvelope, PROJECT_EXPORT_VERSION } from '../../shared/utils/projectExportUtils';
import {
  besserLibraryRepositoryLink,
  besserMainRepositoryLink,
  besserWMERepositoryLink,
} from '../../shared/constants/application-constants';
import { normalizeProjectName } from '../../shared/utils/projectName';
import { getWorkspaceContext } from '../../shared/utils/workspaceContext';
import { downloadFile, downloadJson } from '../../shared/utils/download';
import type { GenerationResult } from '../../features/generation/types';
import { JsonViewerModal } from '../../shared/components/json-viewer-modal/json-viewer-modal';
import { WorkspaceTopBar } from './WorkspaceTopBar';
import { DiagramTabs } from '../../features/editors/diagram-tabs/DiagramTabs';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import { AboutDialog } from '../../shared/dialogs/AboutDialog';
import { AssistantImportDialog } from '../../features/assistant/components/AssistantImportDialog';
import { DeployDialog } from '../../features/deploy/dialogs/DeployDialog';
import { DeployResultDialog } from '../../features/deploy/dialogs/DeployResultDialog';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';
import { useDeployment } from './hooks/useDeployment';
import { useAssistantImport } from './hooks/useAssistantImport';
import { useProjectPreview } from './hooks/useProjectPreview';
import { useGitHubStar } from './hooks/useGitHubStar';
import { useDialogStates } from './hooks/useDialogStates';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import type { QualityCheckResult, QualityCheckState } from '../../features/generation/types';
import type { AgentVariantOption } from './topbar-types';

// Lazy-loaded heavy panels and dialogs (only fetched when opened)
const GitHubSidebar = React.lazy(() =>
  import('../../features/github/components/GitHubSidebar').then((m) => ({ default: m.GitHubSidebar })),
);
const AssistantWorkspaceDrawer = React.lazy(() =>
  import('../../features/assistant/components/AssistantWorkspaceDrawer').then((m) => ({ default: m.AssistantWorkspaceDrawer })),
);
const FeedbackDialog = React.lazy(() =>
  import('../../shared/dialogs/FeedbackDialog').then((m) => ({ default: m.FeedbackDialog })),
);
const HelpGuideDialog = React.lazy(() =>
  import('../../shared/dialogs/HelpGuideDialog').then((m) => ({ default: m.HelpGuideDialog })),
);
// The keyboard toggle hook must be imported eagerly (it registers a global listener).
// KeyboardShortcutsDialog is imported statically alongside the hook to avoid Vite's
// mixed static/dynamic import warning (the module is already in this chunk).
import { KeyboardShortcutsDialog, useKeyboardShortcutsToggle } from '../../shared/dialogs/KeyboardShortcutsDialog';
import { CommandPalette, useCommandPaletteShortcut, buildDefaultActions } from '../../shared/components/command-palette/CommandPalette';
import { useEnabledPerspectives } from '../../shared/hooks/useEnabledPerspectives';
import { isDiagramVisible } from '../../shared/perspectives';

export type { GeneratorType, GeneratorMenuMode } from './workspace-types';

const sanitizeRepoName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

interface OnboardingHook {
  checklist: { createdClass: boolean; addedAttribute: boolean; createdRelationship: boolean; generatedCode: boolean; exploredTemplates: boolean; triedQualityCheck: boolean };
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
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onGenerate: (type: GeneratorType) => void;
  onQualityCheck: () => Promise<QualityCheckResult>;
  showQualityCheck?: boolean;
  generatorMode: GeneratorMenuMode;
  isGenerating?: boolean;
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  onboarding?: OnboardingHook;
}

interface UserModelValidationRecord {
  validatedAt: string;
  outcome: 'valid' | 'errors';
  modelFingerprint: string | null;
}

const createModelFingerprint = (model: unknown): string | null => {
  if (model === undefined || model === null) {
    return null;
  }

  try {
    return JSON.stringify(model);
  } catch {
    return null;
  }
};

const isModelEmpty = (model: unknown): boolean => {
  if (!model || typeof model !== 'object') {
    return true;
  }
  const { elements, relationships } = model as {
    elements?: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
  const hasElements = !!elements && Object.keys(elements).length > 0;
  const hasRelationships = !!relationships && Object.keys(relationships).length > 0;
  return !hasElements && !hasRelationships;
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

  // Local UI state
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(currentProject?.name ?? '');
  const [diagramTitleDraft, setDiagramTitleDraft] = useState(diagram?.title ?? '');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => isDarkThemeEnabled());
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const [isAssistantWorkspaceOpen, setIsAssistantWorkspaceOpen] = useState(false);
  const [userModelValidationByDiagramId, setUserModelValidationByDiagramId] = useState<Record<string, UserModelValidationRecord>>({});

  // Derived values
  const activeUmlType = useMemo(
    () => toUMLDiagramType(currentDiagramType) ?? UMLDiagramType.ClassDiagram,
    [currentDiagramType],
  );
  const { isDeploymentAvailable } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );

  // Extracted hooks
  const {
    hasStarred,
    starLoading,
    handleToggleStar,
  } = useGitHubStar({ isAuthenticated, githubSession });

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

  /* ---- Assistant-driven export (JSON / BUML) ---- */
  useEffect(() => {
    const handleAssistantExport = async (e: Event) => {
      const format = (e as CustomEvent<{ format: string }>).detail?.format ?? 'json';
      const project = currentProjectRef.current;

      if (!project) {
        toast.error('Create or load a project first.');
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
          toast.success('Project exported as B-UML.');
        } catch (err) {
          toast.error(`B-UML export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
      } else {
        const exportData = buildProjectExportEnvelope(freshProject);
        const projectName = sanitizeRepoName(project.name || 'project') || 'project';
        downloadJson(exportData, `${projectName}_export.json`);
        toast.success('Project exported as JSON.');
      }
    };

    window.addEventListener('wme:assistant-export-project', handleAssistantExport);
    return () => window.removeEventListener('wme:assistant-export-project', handleAssistantExport);
  }, [generateProjectBumlPreview]);

  // Theme classes
  const shellBackgroundClass = isDarkTheme
    ? 'bg-[radial-gradient(120%_120%_at_0%_0%,hsl(var(--background))_0%,hsl(222_30%_9%)_45%,hsl(var(--background))_100%)] text-foreground'
    : 'bg-[radial-gradient(120%_120%_at_0%_0%,#d2e7df_0%,hsl(var(--background))_45%,#f7fafc_100%)] text-foreground';
  const headerBackgroundClass = isDarkTheme
    ? 'border-b border-border/70 bg-[linear-gradient(105deg,hsl(var(--background))_0%,hsl(222_30%_9%)_45%,hsl(222_25%_14%)_100%)]'
    : 'border-b border-brand/10 bg-[linear-gradient(105deg,#f0f9ff_0%,#fcfff5_45%,#edf6ff_100%)]';
  const outlineButtonClass = isDarkTheme
    ? 'border-border bg-card text-foreground hover:bg-accent hover:border-border'
    : 'border-border/60 bg-card hover:border-brand/25 hover:bg-brand/[0.03]';
  const primaryGenerateClass = `gap-2 ${outlineButtonClass}`;
  const sidebarBaseClass = isDarkTheme
    ? 'hidden shrink-0 border-r border-border/70 bg-card p-2.5 transition-all duration-200 md:flex md:flex-col md:gap-1.5'
    : 'hidden shrink-0 border-r border-border/50 bg-card p-2.5 transition-all duration-200 md:flex md:flex-col md:gap-1.5';
  const sidebarTitleClass = 'px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground';
  const sidebarDividerClass = 'my-2 border-t border-border/60';
  const sidebarToggleClass = isDarkTheme
    ? 'mt-auto flex items-center rounded-lg border border-border/60 bg-card p-2 transition-all duration-150 hover:border-border hover:bg-accent'
    : 'mt-auto flex items-center rounded-lg border border-border/60 bg-card p-2 transition-all duration-150 hover:border-brand/20 hover:bg-brand/[0.03]';
  const sidebarToggleTextClass = 'text-xs font-semibold text-foreground';

  // Mobile drawer sidebar uses the same styles but is always flex (never hidden)
  const mobileSidebarBaseClass = isDarkTheme
    ? 'flex shrink-0 flex-col gap-1.5 border-r border-border/70 bg-card p-2.5'
    : 'flex shrink-0 flex-col gap-1.5 border-r border-border/50 bg-card/90 p-2.5 backdrop-blur-sm';

  const closeMobileDrawer = useCallback(() => setIsMobileDrawerOpen(false), []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileDrawerOpen]);

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const getUserModelValidationStatus = useCallback((targetDiagram: ProjectDiagram | null | undefined): QualityCheckState => {
    if (!targetDiagram?.id) {
      return 'not_validated';
    }

    const record = userModelValidationByDiagramId[targetDiagram.id];
    if (!record) {
      return 'not_validated';
    }

    const currentFingerprint = createModelFingerprint(targetDiagram.model);
    if (record.modelFingerprint !== currentFingerprint) {
      return 'stale';
    }

    // If we have a stable model fingerprint match, consider the validation current.
    if (record.modelFingerprint !== null || currentFingerprint !== null) {
      return record.outcome;
    }

    const diagramUpdatedAt = Date.parse(targetDiagram.lastUpdate || '');
    const validatedAt = Date.parse(record.validatedAt);
    if (!Number.isNaN(diagramUpdatedAt) && !Number.isNaN(validatedAt) && diagramUpdatedAt > validatedAt) {
      return 'stale';
    }

    return record.outcome;
  }, [userModelValidationByDiagramId]);

  const handleTrackedQualityCheck = useCallback(async (): Promise<QualityCheckResult> => {
    const result = await onQualityCheck();
    if (result.executed && currentProject?.currentDiagramType === 'UserDiagram' && diagram?.id) {
      const modelFingerprint = createModelFingerprint(diagram.model);
      setUserModelValidationByDiagramId((previous) => ({
        ...previous,
        [diagram.id]: {
          validatedAt: new Date().toISOString(),
          outcome: result.passed ? 'valid' : 'errors',
          modelFingerprint,
        },
      }));
    }
    return result;
  }, [onQualityCheck, currentProject?.currentDiagramType, diagram?.id, diagram?.model]);

  const ensureUserModelValidationBeforeNavigation = useCallback(async (): Promise<boolean> => {
    if (currentProject?.currentDiagramType !== 'UserDiagram' || !diagram) {
      return true;
    }

    if (isModelEmpty(diagram.model)) {
      return true;
    }

    const status = getUserModelValidationStatus(diagram);
    if (status === 'valid') {
      return true;
    }

    const shouldValidate = await globalConfirm({
      title: 'Validate your models before going to the next task',
      description: 'This User Model has not been validated after your latest changes.',
      confirmLabel: 'Validate models',
      cancelLabel: 'Ignore',
    });

    if (!shouldValidate) {
      return true;
    }

    const result = await handleTrackedQualityCheck();
    if (!result.executed) {
      return false;
    }

    if (result.passed) {
      return true;
    }

    const confirmLeaveWithIssues = await globalConfirm({
      title: 'There are issues with your diagram, you still want to leave this model?',
      description: 'Quality check found errors. You can stay to fix them or leave this model anyway.',
      confirmLabel: 'Leave model',
      cancelLabel: 'Stay',
      variant: 'danger',
    });

    return confirmLeaveWithIssues;
  }, [currentProject?.currentDiagramType, diagram, getUserModelValidationStatus, handleTrackedQualityCheck]);

  const handleSwitchDiagramType = useCallback(async (type: SupportedDiagramType) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }

    if (location.pathname !== '/') {
      navigate('/');
    }
    dispatch(switchDiagramTypeThunk({ diagramType: type }));
  }, [location.pathname, navigate, dispatch, ensureUserModelValidationBeforeNavigation]);

  const handleSwitchUml = useCallback(async (type: UMLDiagramType) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }

    if (location.pathname !== '/') {
      navigate('/');
    }
    // Don't skip the switch when the active UML type already matches AND we're on /
    if (location.pathname === '/' && activeUmlType === type && currentDiagramType !== 'GUINoCodeDiagram' && currentDiagramType !== 'QuantumCircuitDiagram') {
      return;
    }
    switchDiagramType(type);
  }, [location.pathname, navigate, activeUmlType, currentDiagramType, switchDiagramType, ensureUserModelValidationBeforeNavigation]);

  // Wrappers that close mobile drawer after navigating
  const handleMobileSwitchUml = useCallback((type: UMLDiagramType) => {
    void handleSwitchUml(type);
    setIsMobileDrawerOpen(false);
  }, [handleSwitchUml]);

  const handleMobileSwitchDiagramType = useCallback((type: SupportedDiagramType) => {
    void handleSwitchDiagramType(type);
    setIsMobileDrawerOpen(false);
  }, [handleSwitchDiagramType]);

  const handleSafeNavigate = useCallback(async (path: string) => {
    const canProceed = await ensureUserModelValidationBeforeNavigation();
    if (!canProceed) {
      return;
    }
    handleNavigate(path);
  }, [ensureUserModelValidationBeforeNavigation, handleNavigate]);

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
      description: `Created ${new Date(variant.createdAt).toLocaleString()}`,
    }));
  }, [currentProject?.currentDiagramType, diagram]);

  const handleAgentVariantChange = useCallback(async (variantId: string) => {
    if (currentProject?.currentDiagramType !== 'AgentDiagram' || !currentProject || !diagram?.id) {
      return;
    }

    const latestProjectSnapshot = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const agentIndex = latestProjectSnapshot.currentDiagramIndices.AgentDiagram ?? 0;
    const activeAgentDiagram = latestProjectSnapshot.diagrams.AgentDiagram[agentIndex] || getActiveDiagram(latestProjectSnapshot, 'AgentDiagram') || diagram;
    const currentConfigRecord = (activeAgentDiagram.config ?? {}) as Record<string, unknown>;

    try {
      if (!variantId) {
        const baseModel = LocalStorageRepository.getAgentBaseModel(activeAgentDiagram.id);
        if (!baseModel) {
          toast.error('No base model available for this agent tab yet.');
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
        toast.success('Switched to base agent model.');
        return;
      }

      const selectedVariant = readAgentVariants(activeAgentDiagram).find((variant) => variant.id === variantId);
      if (!selectedVariant || !isUMLModel(selectedVariant.model) || selectedVariant.model.type !== UMLDiagramType.AgentDiagram) {
        toast.error('Selected variant is no longer available.');
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
      toast.success(`Switched to ${selectedVariant.profileName} variant.`);
    } catch (error) {
      console.error('Failed to switch agent variant:', error);
      const message = error instanceof Error ? error.message : 'Failed to switch agent model variant.';
      toast.error(message);
    }
  }, [currentProject, diagram, dispatch]);

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
      toast.error(`Could not switch to ${diagramType}.`);
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

  const handleToggleTheme = () => {
    toggleTheme();
    setIsDarkTheme(isDarkThemeEnabled());
  };

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImportSingleDiagram = async () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    try {
      const result = await importDiagramToProject();
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.toLowerCase().includes('cancel')) {
        return;
      }
      toast.error(`Import failed: ${message}`);
    }
  };

  // Command palette actions (filter by enabled modeling perspectives)
  const enabledPerspectives = useEnabledPerspectives();
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
        isDiagramVisible: (type) => isDiagramVisible(type, enabledPerspectives),
      }),
    [handleSwitchUml, handleSwitchDiagramType, handleSafeNavigate, onExportProject, handleTrackedQualityCheck, enabledPerspectives],
  );

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${shellBackgroundClass}`}>
      <WorkspaceTopBar
        isDarkTheme={isDarkTheme}
        headerBackgroundClass={headerBackgroundClass}
        outlineButtonClass={outlineButtonClass}
        primaryGenerateClass={primaryGenerateClass}
        showQualityCheck={showQualityCheck}
        generatorMode={generatorMode}
        isGenerating={isGenerating}
        locationPath={location.pathname}
        activeUmlType={activeUmlType}
        isAuthenticated={isAuthenticated}
        username={username || undefined}
        githubLoading={githubLoading}
        hasProject={Boolean(currentProject)}
        isDeploymentAvailable={isDeploymentAvailable}
        onOpenProjectHub={onOpenProjectHub}
        onOpenTemplateDialog={onOpenTemplateDialog}
        onExportProject={onExportProject}
        onImportSingleDiagram={handleImportSingleDiagram}
        onOpenAssistantImportImage={() => openAssistantImportDialog('image')}
        onOpenAssistantImportKg={() => openAssistantImportDialog('kg')}
        onOpenProjectPreview={handleOpenProjectPreview}
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
        onOpenGitHubSidebar={() => setIsGitHubSidebarOpen((previous) => !previous)}
        hasStarred={hasStarred}
        starLoading={starLoading}
        onToggleStar={handleToggleStar}
        onOpenDeployDialog={handleOpenDeployDialog}
        onOpenHelpDialog={() => setIsHelpDialogOpen(true)}
        onOpenAboutDialog={() => setIsAboutDialogOpen(true)}
        onOpenFeedback={() => setIsFeedbackDialogOpen(true)}
        onOpenKeyboardShortcuts={openKeyboardShortcuts}
        onShowWelcomeGuide={onboarding?.startTutorial}
        activeDiagramType={currentProject?.currentDiagramType ?? 'ClassDiagram'}
        onSwitchUml={(type) => {
          void handleSwitchUml(type);
        }}
        onSwitchDiagramType={(type) => {
          void handleSwitchDiagramType(type);
        }}
        onNavigate={(path) => {
          void handleSafeNavigate(path);
        }}
        projectNameDraft={projectNameDraft}
        onProjectNameDraftChange={setProjectNameDraft}
        onProjectRename={handleProjectRename}
      />

      {/* Mobile hamburger button - visible only below md breakpoint */}
      <button
        type="button"
        className="md:hidden fixed top-2 left-2 z-50 p-2 rounded-lg bg-card shadow-lg border border-border"
        onClick={() => setIsMobileDrawerOpen((prev) => !prev)}
        aria-label={isMobileDrawerOpen ? 'Close navigation' : 'Open navigation'}
      >
        {isMobileDrawerOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile slide-in drawer overlay */}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-opacity duration-300 ${
          isMobileDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={closeMobileDrawer}
          aria-hidden="true"
        />
        {/* Drawer panel */}
        <div
          className={`relative h-full w-64 shadow-xl overflow-y-auto transition-transform duration-300 ${
            isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          } bg-background`}
        >
          {/* Close button inside drawer */}
          <div className={`flex items-center justify-between p-3 border-b ${isDarkTheme ? 'border-slate-700' : 'border-slate-200'}`}>
            <span className={`text-sm font-semibold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Navigation</span>
            <button
              type="button"
              className="p-1 rounded text-muted-foreground hover:bg-muted"
              onClick={closeMobileDrawer}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
          {/* Sidebar content rendered expanded for mobile */}
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
            activeDiagramType={currentProject?.currentDiagramType ?? 'ClassDiagram'}
            project={currentProject}
            onSwitchUml={handleMobileSwitchUml}
            onSwitchDiagramType={handleMobileSwitchDiagramType}
            onNavigate={handleMobileNavigate}
            onToggleExpanded={closeMobileDrawer}
          />
        </div>
      </div>

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
          activeDiagramType={currentProject?.currentDiagramType ?? 'ClassDiagram'}
          project={currentProject}
          onSwitchUml={(type) => {
            void handleSwitchUml(type);
          }}
          onSwitchDiagramType={(type) => {
            void handleSwitchDiagramType(type);
          }}
          onNavigate={(path) => {
            void handleSafeNavigate(path);
          }}
          onToggleExpanded={() => setIsSidebarExpanded((previous) => !previous)}
        />

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {location.pathname === '/' && (
            <DiagramTabs
              onRequestTabSwitch={handleRequestTabSwitch}
              userModelValidationStatusById={userModelValidationStatusById}
            />
          )}
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>

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

        <Suspense fallback={null}>
          <GitHubSidebar isOpen={isGitHubSidebarOpen} onClose={() => setIsGitHubSidebarOpen(false)} />
        </Suspense>

        {/* TODO: re-enable assistant drawer after release
        <Suspense fallback={null}>
          <AssistantWorkspaceDrawer
            open={isAssistantWorkspaceOpen}
            onOpenChange={(open) => {
              setIsAssistantWorkspaceOpen(open);
              window.dispatchEvent(new CustomEvent('besser:assistant-drawer', { detail: { open } }));
            }}
            onTriggerGenerator={onAssistantGenerate}
            onSwitchDiagram={handleAssistantSwitchDiagram}
          />
        </Suspense>
        */}
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
        onImport={() => { handleAssistantImport().catch(console.error); }}
      />

      <JsonViewerModal
        isVisible={isProjectPreviewOpen}
        jsonData={projectPreviewJson}
        diagramType={`Project (V${PROJECT_EXPORT_VERSION})`}
        onClose={handleCloseProjectPreview}
        onCopy={handleCopyProjectPreview}
        onDownload={handleDownloadProjectPreview}
        enableBumlView
        bumlData={projectBumlPreview}
        bumlLabel={currentProject?.name ? `Project B-UML Preview (${currentProject.name})` : 'Project B-UML Preview'}
        isBumlLoading={isProjectBumlPreviewLoading}
        bumlError={projectBumlPreviewError}
        onRequestBuml={() => { handleRequestProjectBumlPreview().catch(console.error); }}
        onCopyBuml={handleCopyProjectBumlPreview}
        onDownloadBuml={handleDownloadProjectBumlPreview}
      />

      <Suspense fallback={null}>
        <FeedbackDialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen} />
      </Suspense>

      <Suspense fallback={null}>
        <HelpGuideDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />
      </Suspense>

      <KeyboardShortcutsDialog open={isKeyboardShortcutsOpen} onOpenChange={setIsKeyboardShortcutsOpen} />

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
        onPublish={() => { handlePublishToRender().catch(console.error); }}
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
    </div>
  );
};
