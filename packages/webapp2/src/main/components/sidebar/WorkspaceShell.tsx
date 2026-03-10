import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import { BACKEND_URL } from '../../constant';
import { useProject } from '../../hooks/useProject';
import { toUMLDiagramType, type SupportedDiagramType } from '../../types/project';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { switchDiagramTypeThunk } from '../../services/project/projectSlice';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';
import { isDarkThemeEnabled, toggleTheme } from '../../utils/theme-switcher';
import { useDeployToGitHub } from '../../services/deploy/useGitHubDeploy';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { useImportDiagramToProjectWorkflow } from '../../services/import/useImportDiagram';
import { useImportDiagramPictureFromImage } from '../../services/import/useImportDiagramPicture';
import { useImportDiagramFromKG } from '../../services/import/useImportDiagramKG';
import { buildExportableProjectPayload, flattenProjectForBackend } from '../../services/export/projectExportUtils';
import { useProjectBumlPreview } from '../../services/export/useProjectBumlPreview';
import {
  appVersion,
  besserLibraryRepositoryLink,
  besserLibraryVersion,
  besserWMERepositoryLink,
} from '../../application-constants';
import { normalizeProjectName } from '../../utils/projectName';
import { getWorkspaceContext } from '../../utils/workspaceContext';
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
  type AssistantImportMode,
  DeployDialog,
  DeployResultDialog,
} from './dialogs';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';

export type { GeneratorType, GeneratorMenuMode } from './workspace-types';

// localStorage helpers for tracking previously deployed repos per project
const DEPLOY_LINKED_REPO_PREFIX = 'besser_deploy_linked_';

function getDeployLinkedRepo(projectId: string): { owner: string; repo: string } | null {
  try {
    const raw = localStorage.getItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.owner && parsed.repo) return parsed;
    return null;
  } catch {
    return null;
  }
}

function saveDeployLinkedRepo(projectId: string, owner: string, repo: string): void {
  localStorage.setItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`, JSON.stringify({ owner, repo }));
}

function clearDeployLinkedRepo(projectId: string): void {
  localStorage.removeItem(`${DEPLOY_LINKED_REPO_PREFIX}${projectId}`);
}

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

const sanitizeRepoName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
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
  const { deployToGitHub, isDeploying: isDeployingToRender, deploymentResult } = useDeployToGitHub();
  const importDiagramToProject = useImportDiagramToProjectWorkflow();
  const importDiagramPictureFromImage = useImportDiagramPictureFromImage();
  const importDiagramFromKG = useImportDiagramFromKG();
  const generateProjectBumlPreview = useProjectBumlPreview();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(currentProject?.name ?? '');
  const [diagramTitleDraft, setDiagramTitleDraft] = useState(diagram?.title ?? '');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => isDarkThemeEnabled());
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const [isAssistantWorkspaceOpen, setIsAssistantWorkspaceOpen] = useState(false);
  const [hasStarred, setHasStarred] = useState(false);
  const [starLoading, setStarLoading] = useState(false);

  const [assistantImportMode, setAssistantImportMode] = useState<AssistantImportMode>(null);
  const [assistantApiKey, setAssistantApiKey] = useState('');
  const [assistantSelectedFile, setAssistantSelectedFile] = useState<File | null>(null);
  const [assistantImportError, setAssistantImportError] = useState('');
  const [isAssistantImporting, setIsAssistantImporting] = useState(false);

  const [isProjectPreviewOpen, setIsProjectPreviewOpen] = useState(false);
  const [projectPreviewJson, setProjectPreviewJson] = useState('');
  const [projectBumlPreview, setProjectBumlPreview] = useState('');
  const [projectBumlPreviewError, setProjectBumlPreviewError] = useState('');
  const [isProjectBumlPreviewLoading, setIsProjectBumlPreviewLoading] = useState(false);

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [isDeployResultOpen, setIsDeployResultOpen] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubRepoDescription, setGithubRepoDescription] = useState('');
  const [githubRepoPrivate, setGithubRepoPrivate] = useState(false);
  const [useExistingRepo, setUseExistingRepo] = useState(false);
  const [linkedRepo, setLinkedRepo] = useState<{ owner: string; repo: string } | null>(null);
  const [commitMessage, setCommitMessage] = useState('');

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  useEffect(() => {
    setProjectNameDraft(currentProject?.name ?? '');
  }, [currentProject?.id, currentProject?.name]);

  useEffect(() => {
    setDiagramTitleDraft(diagram?.title ?? '');
  }, [diagram?.id, diagram?.title]);

  useEffect(() => {
    if (!isAuthenticated || !githubSession) return;
    fetch(`${BACKEND_URL}/github/star/status?session_id=${githubSession}`)
      .then((res) => res.json())
      .then((data) => { if (data.starred) setHasStarred(true); })
      .catch(() => {});
  }, [isAuthenticated, githubSession]);

  const handleToggleStar = async () => {
    if (!githubSession || starLoading) return;
    setStarLoading(true);
    try {
      const method = hasStarred ? 'DELETE' : 'PUT';
      const res = await fetch(`${BACKEND_URL}/github/star?session_id=${githubSession}`, { method });
      if (res.ok) {
        setHasStarred(!hasStarred);
        if (!hasStarred) toast.success('Thanks for starring BESSER!');
      }
    } catch {
      toast.error('Failed to update star');
    } finally {
      setStarLoading(false);
    }
  };

  /* ---- Assistant-driven export (JSON / BUML) ---- */
  useEffect(() => {
    const handleAssistantExport = async (e: Event) => {
      const format = (e as CustomEvent<{ format: string }>).detail?.format ?? 'json';

      if (!currentProject) {
        toast.error('Create or load a project first.');
        return;
      }

      const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;

      if (format === 'buml') {
        try {
          const buml = await generateProjectBumlPreview(freshProject);
          const normalizedName =
            normalizeProjectName(currentProject.name || 'project')
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_') || 'project';
          const blob = new Blob([buml], { type: 'text/x-python' });
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `${normalizedName}_buml.py`;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          URL.revokeObjectURL(url);
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
        const projectName = sanitizeRepoName(currentProject.name || 'project') || 'project';
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `${projectName}_export.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        toast.success('Project exported as JSON.');
      }
    };

    window.addEventListener('wme:assistant-export-project', handleAssistantExport);
    return () => window.removeEventListener('wme:assistant-export-project', handleAssistantExport);
  }, [currentProject, generateProjectBumlPreview]);

  const activeUmlType = useMemo(
    () => toUMLDiagramType(currentDiagramType) ?? UMLDiagramType.ClassDiagram,
    [currentDiagramType],
  );
  const { isDeploymentAvailable } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );
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

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleSwitchDiagramType = (type: SupportedDiagramType) => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    dispatch(switchDiagramTypeThunk({ diagramType: type }));
  };

  const handleSwitchUml = (type: UMLDiagramType) => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    // Don't skip the switch when the active UML type already matches AND we're on /
    if (location.pathname === '/' && activeUmlType === type && currentDiagramType !== 'GUINoCodeDiagram' && currentDiagramType !== 'QuantumCircuitDiagram') {
      return;
    }
    switchDiagramType(type);
  };

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

  const handleProjectRename = () => {
    const normalized = normalizeProjectName(projectNameDraft);
    if (!normalized || !currentProject || normalized === currentProject.name) {
      setProjectNameDraft(currentProject?.name ?? '');
      return;
    }
    updateProject({ name: normalized });
  };

  const handleDiagramRename = () => {
    const normalized = diagramTitleDraft.trim();
    const currentTitle = diagram?.title ?? '';
    if (!normalized || normalized === currentTitle) {
      setDiagramTitleDraft(currentTitle);
      return;
    }
    dispatch(updateDiagramThunk({ title: normalized }));
  };

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

  const resetAssistantImportDialog = () => {
    setAssistantImportMode(null);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
    setIsAssistantImporting(false);
  };

  const openAssistantImportDialog = (mode: Exclude<AssistantImportMode, null>) => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }
    setAssistantImportMode(mode);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
  };

  const handleAssistantFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !assistantImportMode) {
      setAssistantSelectedFile(null);
      setAssistantImportError('');
      return;
    }

    if (assistantImportMode === 'image') {
      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        setAssistantSelectedFile(null);
        setAssistantImportError('Only PNG or JPEG files are allowed.');
        return;
      }
    } else {
      const allowedTypes = ['application/json', 'text/turtle', 'application/x-turtle'];
      const allowedExtensions = ['.json', '.ttl', '.rdf'];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
        setAssistantSelectedFile(null);
        setAssistantImportError('Only TTL, RDF, or JSON files are allowed.');
        return;
      }
    }

    setAssistantSelectedFile(file);
    setAssistantImportError('');
  };

  const handleAssistantImport = async () => {
    if (!assistantImportMode || !assistantSelectedFile || !assistantApiKey || assistantImportError) {
      return;
    }

    setIsAssistantImporting(true);
    try {
      const result =
        assistantImportMode === 'image'
          ? await importDiagramPictureFromImage(assistantSelectedFile, assistantApiKey)
          : await importDiagramFromKG(assistantSelectedFile, assistantApiKey);
      toast.success(result.message);
      resetAssistantImportDialog();
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssistantImporting(false);
    }
  };

  const handleOpenProjectPreview = () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const exportData = {
      project: buildExportableProjectPayload(freshProject),
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
    };
    setProjectPreviewJson(JSON.stringify(exportData, null, 2));
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
    setIsProjectPreviewOpen(true);
  };

  const handleCopyProjectPreview = async () => {
    try {
      await navigator.clipboard.writeText(projectPreviewJson);
      toast.success('Project JSON copied.');
    } catch {
      toast.error('Failed to copy project JSON.');
    }
  };

  const handleDownloadProjectPreview = () => {
    const blob = new Blob([projectPreviewJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const projectName = sanitizeRepoName(currentProject?.name || 'project') || 'project';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName}_preview.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleRequestProjectBumlPreview = async () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    setIsProjectBumlPreviewLoading(true);
    setProjectBumlPreviewError('');

    try {
      const bumlPreview = await generateProjectBumlPreview(freshProject);
      setProjectBumlPreview(bumlPreview);
      toast.success('Project B-UML preview generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate B-UML preview.';
      setProjectBumlPreview('');
      setProjectBumlPreviewError(message);
      toast.error(`Failed to generate B-UML preview: ${message}`);
    } finally {
      setIsProjectBumlPreviewLoading(false);
    }
  };

  const handleCloseProjectPreview = () => {
    setIsProjectPreviewOpen(false);
    setProjectPreviewJson('');
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
  };

  const handleCopyProjectBumlPreview = async () => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(projectBumlPreview);
      toast.success('Project B-UML copied.');
    } catch {
      toast.error('Failed to copy B-UML preview.');
    }
  };

  const handleDownloadProjectBumlPreview = () => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to download.');
      return;
    }

    const normalizedName =
      normalizeProjectName(currentProject?.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') || 'project';

    const blob = new Blob([projectBumlPreview], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${normalizedName}_preview.py`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleOpenDeployDialog = () => {
    if (!isDeploymentAvailable) {
      toast.info('Deploy is available for Class and GUI diagrams.');
      return;
    }
    if (!isAuthenticated) {
      toast.info('Connect to GitHub first.');
      return;
    }
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    setCommitMessage('');
    const linked = getDeployLinkedRepo(currentProject.id);
    if (linked) {
      setLinkedRepo(linked);
      setGithubRepoName(linked.repo);
      setUseExistingRepo(true);
    } else {
      setLinkedRepo(null);
      setUseExistingRepo(false);
      setGithubRepoName(sanitizeRepoName(currentProject.name) || 'besser-webapp');
    }
    setGithubRepoDescription('Web application generated by BESSER');
    setGithubRepoPrivate(false);
    setIsDeployDialogOpen(true);
  };

  /* ---- Assistant-driven deploy ---- */
  useEffect(() => {
    const handleAssistantDeploy = (_e: Event) => {
      handleOpenDeployDialog();
    };

    window.addEventListener('wme:assistant-deploy-app', handleAssistantDeploy);
    return () => window.removeEventListener('wme:assistant-deploy-app', handleAssistantDeploy);
  }, [isDeploymentAvailable, isAuthenticated, currentProject]);

  const handlePublishToRender = async () => {
    if (!currentProject) {
      toast.error('No project available for deployment.');
      return;
    }
    if (!githubSession) {
      toast.error('GitHub session not found. Please reconnect.');
      return;
    }
    if (!githubRepoName.trim()) {
      toast.error('Repository name is required.');
      return;
    }

    const projectForDeploy = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const result = await deployToGitHub(
      flattenProjectForBackend(projectForDeploy),
      sanitizeRepoName(githubRepoName),
      githubRepoDescription.trim() || 'Web application generated by BESSER',
      githubRepoPrivate,
      githubSession,
      useExistingRepo,
      commitMessage,
    );

    if (result?.success) {
      saveDeployLinkedRepo(currentProject.id, result.owner, result.repo_name);
      setIsDeployDialogOpen(false);
      setIsDeployResultOpen(true);
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
        onImport={() => void handleAssistantImport()}
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
        onRequestBuml={() => void handleRequestProjectBumlPreview()}
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
        onCreateNewInstead={() => {
          if (currentProject?.id) {
            clearDeployLinkedRepo(currentProject.id);
          }
          setLinkedRepo(null);
          setUseExistingRepo(false);
          setGithubRepoName(sanitizeRepoName(currentProject?.name || '') || 'besser-webapp');
        }}
        onPublish={() => void handlePublishToRender()}
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
