import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import { useProject } from '../../hooks/useProject';
import { toUMLDiagramType, type SupportedDiagramType } from '../../types/project';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateDiagramModelThunk, switchDiagramTypeThunk } from '../../services/workspace/workspaceSlice';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';
import { isDarkThemeEnabled, toggleTheme } from '../../utils/theme-switcher';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { useImportDiagramToProjectWorkflow } from '../../services/import/useImportDiagram';
import { buildExportableProjectPayload } from '../../services/export/projectExportUtils';
import {
  appVersion,
  besserLibraryRepositoryLink,
  besserLibraryVersion,
  besserWMERepositoryLink,
} from '../../application-constants';
import { normalizeProjectName } from '../../utils/projectName';
import { getWorkspaceContext } from '../../utils/workspaceContext';
import { downloadFile, downloadJson } from '../../utils/download';
import type { GenerationResult } from '../../services/generate-code/types';
import { JsonViewerModal } from '../modals/json-viewer-modal/json-viewer-modal';
import { FeedbackDialog } from '../modals/FeedbackDialog';
import { HelpGuideDialog } from '../modals/HelpGuideDialog';
import { WorkspaceTopBar } from '../application-bar/WorkspaceTopBar';
import { AssistantWorkspaceDrawer } from '../assistant-workspace/AssistantWorkspaceDrawer';
import { DiagramTabs } from '../diagram-tabs/DiagramTabs';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import {
  AboutDialog,
  AssistantImportDialog,
  DeployDialog,
  DeployResultDialog,
} from './dialogs';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';
import { useDeployment } from './hooks/useDeployment';
import { useAssistantImport } from './hooks/useAssistantImport';
import { useProjectPreview } from './hooks/useProjectPreview';
import { useGitHubStar } from './hooks/useGitHubStar';
import { useDialogStates } from './hooks/useDialogStates';

export type { GeneratorType, GeneratorMenuMode } from './workspace-types';

const sanitizeRepoName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

interface WorkspaceShellProps {
  children: React.ReactNode;
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onGenerate: (type: GeneratorType) => void;
  onQualityCheck: () => void;
  showQualityCheck?: boolean;
  generatorMode: GeneratorMenuMode;
  isGenerating?: boolean;
  onAssistantGenerate?: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
}

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
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const diagram = useAppSelector((state) => state.workspace.activeDiagram);
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
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(currentProject?.name ?? '');
  const [diagramTitleDraft, setDiagramTitleDraft] = useState(diagram?.title ?? '');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => isDarkThemeEnabled());
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const [isAssistantWorkspaceOpen, setIsAssistantWorkspaceOpen] = useState(false);

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
    isDeployingToRender,
    deploymentResult,
    setIsDeployDialogOpen,
    setIsDeployResultOpen,
    setGithubRepoName,
    setGithubRepoDescription,
    setGithubRepoPrivate,
    setCommitMessage,
    handleOpenDeployDialog,
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
  } = useDialogStates();

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
        const exportData = {
          project: buildExportableProjectPayload(freshProject),
          exportedAt: new Date().toISOString(),
          version: '2.0.0',
        };
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
    ? 'bg-[radial-gradient(120%_120%_at_0%_0%,#0f172a_0%,#111827_45%,#0b1220_100%)] text-slate-100'
    : 'bg-[radial-gradient(120%_120%_at_0%_0%,#d2e7df_0%,#f8f7f2_45%,#f7fafc_100%)] text-foreground';
  const headerBackgroundClass = isDarkTheme
    ? 'border-b border-slate-700/70 bg-[linear-gradient(105deg,rgba(15,23,42,0.95)_0%,rgba(17,24,39,0.92)_45%,rgba(30,41,59,0.96)_100%)]'
    : 'border-b border-slate-300/60 bg-[linear-gradient(105deg,rgba(240,249,255,0.95)_0%,rgba(252,255,245,0.92)_45%,rgba(237,246,255,0.96)_100%)]';
  const topPanelClass = isDarkTheme ? 'border-slate-700/80 bg-slate-900/70' : 'border-slate-300/60 bg-white/70';
  const topPanelIconClass = isDarkTheme ? 'text-slate-300' : 'text-slate-600';
  const diagramBadgeClass = isDarkTheme
    ? 'hidden bg-slate-800 text-slate-200 xl:inline-flex'
    : 'hidden bg-slate-100 text-slate-600 xl:inline-flex';
  const outlineButtonClass = isDarkTheme
    ? 'border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800'
    : 'border-slate-300 bg-white/75';
  const primaryGenerateClass = isDarkTheme
    ? 'gap-2 bg-sky-700 text-white hover:bg-sky-600'
    : 'gap-2 bg-slate-900 text-white hover:bg-slate-800';
  const sidebarBaseClass = isDarkTheme
    ? 'hidden shrink-0 border-r border-slate-700/70 bg-slate-950/65 p-2.5 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col md:gap-2'
    : 'hidden shrink-0 border-r border-slate-300/60 bg-white/60 p-2.5 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col md:gap-2';
  const sidebarTitleClass = isDarkTheme
    ? 'px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'
    : 'px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';
  const sidebarDividerClass = isDarkTheme ? 'my-2 border-t border-slate-700/80' : 'my-2 border-t border-slate-300/70';
  const sidebarToggleClass = isDarkTheme
    ? 'mt-auto flex items-center rounded-lg border border-slate-700/80 bg-slate-900/80 p-2 transition hover:border-slate-600 hover:bg-slate-800'
    : 'mt-auto flex items-center rounded-lg border border-slate-300/70 bg-white/80 p-2 transition hover:border-slate-400 hover:bg-white';
  const sidebarToggleTextClass = isDarkTheme
    ? 'text-xs font-semibold text-slate-200'
    : 'text-xs font-semibold text-slate-700';

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const handleSwitchDiagramType = useCallback((type: SupportedDiagramType) => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    dispatch(switchDiagramTypeThunk({ diagramType: type }));
  }, [location.pathname, navigate, dispatch]);

  const handleSwitchUml = useCallback((type: UMLDiagramType) => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    // Don't skip the switch when the active UML type already matches AND we're on /
    if (location.pathname === '/' && activeUmlType === type && currentDiagramType !== 'GUINoCodeDiagram' && currentDiagramType !== 'QuantumCircuitDiagram') {
      return;
    }
    switchDiagramType(type);
  }, [location.pathname, navigate, activeUmlType, currentDiagramType, switchDiagramType]);

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

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${shellBackgroundClass}`}>
      <WorkspaceTopBar
        isDarkTheme={isDarkTheme}
        headerBackgroundClass={headerBackgroundClass}
        topPanelClass={topPanelClass}
        topPanelIconClass={topPanelIconClass}
        diagramBadgeClass={diagramBadgeClass}
        outlineButtonClass={outlineButtonClass}
        primaryGenerateClass={primaryGenerateClass}
        showQualityCheck={showQualityCheck}
        generatorMode={generatorMode}
        isGenerating={isGenerating}
        projectNameDraft={projectNameDraft}
        diagramTitleDraft={diagramTitleDraft}
        currentDiagramType={currentProject?.currentDiagramType}
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
        onQualityCheck={onQualityCheck}
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
        activeDiagramType={currentProject?.currentDiagramType ?? 'ClassDiagram'}
        onSwitchUml={handleSwitchUml}
        onSwitchDiagramType={handleSwitchDiagramType}
        onNavigate={handleNavigate}
        onProjectNameDraftChange={setProjectNameDraft}
        onProjectRename={handleProjectRename}
        onDiagramTitleDraftChange={setDiagramTitleDraft}
        onDiagramRename={handleDiagramRename}
      />

      <div className="relative flex min-h-0 flex-1">
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
          onSwitchUml={handleSwitchUml}
          onSwitchDiagramType={handleSwitchDiagramType}
          onNavigate={handleNavigate}
          onToggleExpanded={() => setIsSidebarExpanded((previous) => !previous)}
        />

        <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DiagramTabs />
          <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        </main>

        <GitHubSidebar isOpen={isGitHubSidebarOpen} onClose={() => setIsGitHubSidebarOpen(false)} />

        <AssistantWorkspaceDrawer
          open={isAssistantWorkspaceOpen}
          onOpenChange={setIsAssistantWorkspaceOpen}
          onTriggerGenerator={onAssistantGenerate}
          onSwitchDiagram={handleAssistantSwitchDiagram}
        />
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
        diagramType="Project (V2.0.0)"
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

      <FeedbackDialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen} />

      <HelpGuideDialog open={isHelpDialogOpen} onOpenChange={setIsHelpDialogOpen} />

      <DeployDialog
        open={isDeployDialogOpen}
        isDeploying={isDeployingToRender}
        repoName={githubRepoName}
        repoDescription={githubRepoDescription}
        repoPrivate={githubRepoPrivate}
        useExistingRepo={useExistingRepo}
        linkedRepo={linkedRepo}
        commitMessage={commitMessage}
        onOpenChange={setIsDeployDialogOpen}
        onRepoNameChange={setGithubRepoName}
        onRepoDescriptionChange={setGithubRepoDescription}
        onRepoPrivateChange={setGithubRepoPrivate}
        onCommitMessageChange={setCommitMessage}
        onCreateNewInstead={handleCreateNewInstead}
        onPublish={() => { handlePublishToRender().catch(console.error); }}
      />

      <DeployResultDialog
        open={isDeployResultOpen}
        deploymentResult={deploymentResult}
        onOpenChange={setIsDeployResultOpen}
        onOpenRender={() => deploymentResult && openExternalUrl(deploymentResult.deployment_urls.render)}
        onOpenRepository={() => deploymentResult && openExternalUrl(deploymentResult.repo_url)}
      />

      <AboutDialog
        open={isAboutDialogOpen}
        appVersion={appVersion}
        libraryVersion={besserLibraryVersion}
        onOpenChange={setIsAboutDialogOpen}
        onOpenWmeRepository={() => openExternalUrl(besserWMERepositoryLink)}
        onOpenLibraryRepository={() => openExternalUrl(besserLibraryRepositoryLink)}
      />
    </div>
  );
};
