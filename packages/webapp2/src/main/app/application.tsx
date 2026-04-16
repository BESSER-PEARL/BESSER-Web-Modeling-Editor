import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LazyPostHogProvider } from '../shared/services/analytics/LazyPostHogProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ApollonEditor } from '@besser/wme';
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
} from '../shared/constants/constant';
import { getActiveDiagram, isUMLModel } from '../shared/types/project';
import { ApollonEditorProvider } from '../features/editors/uml/apollon-editor-context';
import { EditorView } from '../features/editors/EditorView';
import { ErrorPanel } from '../shared/components/error-handling/error-panel';
import { CookieConsentBanner, hasUserConsented } from '../shared/components/cookie-consent/CookieConsentBanner';
import { ApplicationStore } from './store/application-store';
import { useProject } from './hooks/useProject';
import { WorkspaceShell } from './shell/WorkspaceShell';
import { useProjectBootstrap } from './hooks/useProjectBootstrap';
import { useStorageSync } from './hooks/useStorageSync';
import { getWorkspaceContext } from '../shared/utils/workspaceContext';
import { useGeneratorExecution } from '../features/generation/useGeneratorExecution';
import { SuspenseFallback } from '../shared/components/loading/SuspenseFallback';
import { GeneratingOverlay } from '../shared/components/loading/GeneratingOverlay';
import { GlobalConfirmProvider } from '../shared/services/confirm/GlobalConfirmProvider';
import { ErrorBoundary } from '../shared/components/error-handling/AppErrorBoundary';
import { NotFound } from '../shared/components/NotFound';
import { useOnboarding } from '../features/onboarding/useOnboarding';
import { useAppSelector } from './store/hooks';
import { selectActiveDiagram } from './store/workspaceSlice';

// Lazy-loaded route-level components (only fetched when their route is visited)
const AgentConfigurationPanel = React.lazy(() =>
  import('../features/agent-config/AgentConfigurationPanel').then((m) => ({ default: m.AgentConfigurationPanel })),
);
const AgentPersonalizationRulesPanel = React.lazy(() =>
  import('../features/agent-config/AgentPersonalizationRulesPanel').then((m) => ({ default: m.AgentPersonalizationRulesPanel })),
);
const AgentPersonalizationMappingPanel = React.lazy(() =>
  import('../features/agent-config/AgentPersonalizationMappingPanel').then((m) => ({ default: m.AgentPersonalizationMappingPanel })),
);
const ProjectSettingsPanel = React.lazy(() =>
  import('../features/project/ProjectSettingsPanel').then((m) => ({ default: m.ProjectSettingsPanel })),
);

// Lazy-loaded dialogs (only fetched when opened)
const ProjectHubDialog = React.lazy(() =>
  import('../features/project/ProjectHubDialog').then((m) => ({ default: m.ProjectHubDialog })),
);
const TemplateLibraryDialog = React.lazy(() =>
  import('../features/project/TemplateLibraryDialog').then((m) => ({ default: m.TemplateLibraryDialog })),
);
const ExportDialog = React.lazy(() =>
  import('../features/export/ExportDialog').then((m) => ({ default: m.ExportDialog })),
);
const GeneratorConfigDialogs = React.lazy(() =>
  import('../features/generation/dialogs/GeneratorConfigDialogs').then((m) => ({ default: m.GeneratorConfigDialogs })),
);
const AssistantWidget = React.lazy(() =>
  import('../features/assistant/components/AssistantWidget').then((m) => ({ default: m.AssistantWidget })),
);
const SmartGenByokDialog = React.lazy(() =>
  import('../features/smart-generation/components/SmartGenByokDialog').then((m) => ({ default: m.SmartGenByokDialog })),
);

const postHogOptions = {
  api_host: POSTHOG_HOST,
  autocapture: false,
  disable_session_recording: true,
  respect_dnt: true,
  opt_out_capturing_by_default: !hasUserConsented(),
  persistence: (hasUserConsented() ? 'localStorage+cookie' : 'memory') as 'localStorage+cookie' | 'memory',
  ip: false,
};

function AppContentInner() {
  const [editor, setEditor] = useState<ApollonEditor>();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const location = useLocation();

  // Keep Redux in sync with direct localStorage writes from editors
  useStorageSync();

  const { currentProject, loadProject } = useProject();
  const loadProjectForBootstrap = useCallback(
    async (projectId: string): Promise<void> => {
      await loadProject(projectId);
    },
    [loadProject],
  );
  const { showProjectHub, setShowProjectHub } = useProjectBootstrap({
    currentProject,
    loadProject: loadProjectForBootstrap,
    pathname: location.pathname,
  });
  const { generatorMenuMode } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );

  const activeDiagram = currentProject ? getActiveDiagram(currentProject, currentProject.currentDiagramType) : undefined;
  const activeDiagramTitle = activeDiagram?.title || currentProject?.name || 'Diagram';

  // All generator config state, execution handlers, and quality-check logic
  const {
    isGenerating,
    handleGenerateRequest,
    handleAssistantGenerate,
    handleQualityCheck,
    configState,
    isLocalEnvironment,
  } = useGeneratorExecution(editor);

  const handleExport = () => {
    setShowExportDialog(true);
  };

  // Onboarding system — disabled for now
  // const onboarding = useOnboarding();
  const onboarding = null as any;

  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <WorkspaceShell
        onOpenProjectHub={() => setShowProjectHub(true)}
        onOpenTemplateDialog={() => setShowTemplateDialog(true)}
        onExportProject={handleExport}
        onGenerate={(type) => handleGenerateRequest(type)}
        onQualityCheck={() => handleQualityCheck()}
        showQualityCheck={true}
        generatorMode={generatorMenuMode}
        isGenerating={isGenerating}
        onAssistantGenerate={handleAssistantGenerate}
        onboarding={onboarding}
      >
        <Suspense fallback={<SuspenseFallback showSkeleton />}>
          <Routes>
            <Route path="/" element={<EditorView />} />
            <Route path="/agent-config" element={<AgentConfigurationPanel />} />
            <Route path="/agent-personalization" element={<AgentPersonalizationRulesPanel />} />
            <Route path="/agent-personalization-2" element={<AgentPersonalizationMappingPanel />} />
            <Route path="/project-settings" element={<ProjectSettingsPanel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </WorkspaceShell>

      <Suspense fallback={null}>
        <ProjectHubDialog open={showProjectHub} onOpenChange={setShowProjectHub} />
      </Suspense>
      <Suspense fallback={null}>
        <TemplateLibraryDialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog} />
      </Suspense>
      <Suspense fallback={null}>
        <ExportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          editor={editor}
          currentDiagramTitle={activeDiagramTitle}
        />
      </Suspense>

      {/*
       * Generator configuration dialogs (Django, SQL, SQLAlchemy, JSON Schema,
       * Agent, Qiskit). All state lives in the useGeneratorExecution hook;
       * configState is the props bag that wires every field, change handler,
       * and execution callback into the presentational dialog component.
       */}
      <Suspense fallback={null}>
      <GeneratorConfigDialogs
        // ── Dialog control ───────────────────────────────────────────
        configDialog={configState.configDialog}
        setConfigDialog={configState.setConfigDialog}
        isLocalEnvironment={isLocalEnvironment}
        // ── Django config ────────────────────────────────────────────
        djangoProjectName={configState.djangoProjectName}
        djangoAppName={configState.djangoAppName}
        useDocker={configState.useDocker}
        // ── SQL / SQLAlchemy / JSON Schema config ────────────────────
        sqlDialect={configState.sqlDialect}
        sqlAlchemyDbms={configState.sqlAlchemyDbms}
        jsonSchemaMode={configState.jsonSchemaMode}
        // ── Agent config (languages + advanced/personalization) ──────
        sourceLanguage={configState.sourceLanguage}
        pendingAgentLanguage={configState.pendingAgentLanguage}
        selectedAgentLanguages={configState.selectedAgentLanguages}
        hasSavedAgentConfiguration={configState.hasSavedAgentConfiguration}
        agentMode={configState.agentMode}
        storedAgentConfigurations={configState.storedAgentConfigurations}
        storedAgentMappings={configState.storedAgentMappings}
        selectedStoredAgentConfigIds={configState.selectedStoredAgentConfigIds}
        // ── Qiskit config ────────────────────────────────────────────
        qiskitBackend={configState.qiskitBackend}
        qiskitShots={configState.qiskitShots}
        // ── Web App checklist ────────────────────────────────────────
        webAppChecklist={configState.webAppChecklist}
        // ── Field change handlers ────────────────────────────────────
        onDjangoProjectNameChange={configState.onDjangoProjectNameChange}
        onDjangoAppNameChange={configState.onDjangoAppNameChange}
        onUseDockerChange={configState.onUseDockerChange}
        onSqlDialectChange={configState.onSqlDialectChange}
        onSqlAlchemyDbmsChange={configState.onSqlAlchemyDbmsChange}
        onJsonSchemaModeChange={configState.onJsonSchemaModeChange}
        onSourceLanguageChange={configState.onSourceLanguageChange}
        onPendingAgentLanguageChange={configState.onPendingAgentLanguageChange}
        onSelectedAgentLanguagesChange={configState.onSelectedAgentLanguagesChange}
        onQiskitBackendChange={configState.onQiskitBackendChange}
        onQiskitShotsChange={configState.onQiskitShotsChange}
        onAgentModeChange={configState.onAgentModeChange}
        onStoredAgentConfigToggle={configState.onStoredAgentConfigToggle}
        // ── Execution callbacks (validate → generate → close dialog) ─
        onDjangoGenerate={configState.onDjangoGenerate}
        onDjangoDeploy={configState.onDjangoDeploy}
        onSqlGenerate={configState.onSqlGenerate}
        onSqlAlchemyGenerate={configState.onSqlAlchemyGenerate}
        onJsonSchemaGenerate={configState.onJsonSchemaGenerate}
        onAgentGenerate={configState.onAgentGenerate}
        onQiskitGenerate={configState.onQiskitGenerate}
        onWebAppGenerate={configState.onWebAppGenerate}
      />
      </Suspense>

      {/* Onboarding tutorial — disabled for now
      <Suspense fallback={null}>
        <InteractiveTutorial
          visible={onboarding.isTutorialActive}
          currentStep={onboarding.tutorialStep}
          onNext={onboarding.advanceTutorial}
          onBack={onboarding.goBackTutorial}
          onSkip={onboarding.skipTutorial}
          onFinish={onboarding.finishTutorial}
        />
      </Suspense>
      */}

      <ErrorPanel />
      <Suspense fallback={null}>
        <AssistantWidget onAssistantGenerate={handleAssistantGenerate} />
      </Suspense>
      <Suspense fallback={null}>
        <SmartGenByokDialog />
      </Suspense>
      <GeneratingOverlay visible={isGenerating} />
      <ToastContainer />
      <GlobalConfirmProvider />
    </ApollonEditorProvider>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppContentInner />
    </BrowserRouter>
  );
}

export function RoutedApplication() {
  return (
    <ErrorBoundary>
      <LazyPostHogProvider apiKey={POSTHOG_KEY} options={postHogOptions}>
        <ApplicationStore>
          <AppContent />
          <CookieConsentBanner />
        </ApplicationStore>
      </LazyPostHogProvider>
    </ErrorBoundary>
  );
}

