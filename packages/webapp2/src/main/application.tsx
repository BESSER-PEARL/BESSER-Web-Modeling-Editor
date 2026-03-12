import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { LazyPostHogProvider } from './services/analytics/LazyPostHogProvider';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ApollonEditor } from '@besser/wme';
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
} from './constant';
import { getActiveDiagram, isUMLModel } from './types/project';
import { ApollonEditorProvider } from './components/apollon-editor-component/apollon-editor-context';
import { EditorView } from './components/editor-view/EditorView';
import { ErrorPanel } from './components/error-handling/error-panel';
import { CookieConsentBanner, hasUserConsented } from './components/cookie-consent/CookieConsentBanner';
import { ApplicationStore } from './store/application-store';
import { useProject } from './hooks/useProject';
import { WorkspaceShell } from './components/sidebar/WorkspaceShell';
import { useProjectBootstrap } from './hooks/useProjectBootstrap';
import { useStorageSync } from './hooks/useStorageSync';
import { getWorkspaceContext } from './utils/workspaceContext';
import { useGeneratorExecution } from './components/generator-execution/useGeneratorExecution';
import { SuspenseFallback } from './components/loading/SuspenseFallback';
import { GeneratingOverlay } from './components/loading/GeneratingOverlay';
import { GlobalConfirmProvider } from './services/confirm/GlobalConfirmProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotFound } from './components/NotFound';
import { useOnboarding } from './components/onboarding/useOnboarding';
import { useAppSelector } from './store/hooks';
import { selectActiveDiagram } from './services/workspace/workspaceSlice';

// Lazy-loaded route-level components (only fetched when their route is visited)
const AgentConfigurationPanel = React.lazy(() =>
  import('./components/agent/AgentConfigurationPanel').then((m) => ({ default: m.AgentConfigurationPanel })),
);
const AgentPersonalizationRulesPanel = React.lazy(() =>
  import('./components/agent/AgentPersonalizationRulesPanel').then((m) => ({ default: m.AgentPersonalizationRulesPanel })),
);
const AgentPersonalizationMappingPanel = React.lazy(() =>
  import('./components/agent/AgentPersonalizationMappingPanel').then((m) => ({ default: m.AgentPersonalizationMappingPanel })),
);
const ProjectSettingsPanel = React.lazy(() =>
  import('./components/project/ProjectSettingsPanel').then((m) => ({ default: m.ProjectSettingsPanel })),
);

// Lazy-loaded dialogs (only fetched when opened)
const ProjectHubDialog = React.lazy(() =>
  import('./components/home/ProjectHubDialog').then((m) => ({ default: m.ProjectHubDialog })),
);
const TemplateLibraryDialog = React.lazy(() =>
  import('./components/modals/TemplateLibraryDialog').then((m) => ({ default: m.TemplateLibraryDialog })),
);
const ExportDialog = React.lazy(() =>
  import('./components/modals/ExportDialog').then((m) => ({ default: m.ExportDialog })),
);
const GeneratorConfigDialogs = React.lazy(() =>
  import('./components/modals/generator-config/GeneratorConfigDialogs').then((m) => ({ default: m.GeneratorConfigDialogs })),
);
const AssistantWidget = React.lazy(() =>
  import('./components/assistant-workspace/AssistantWidget').then((m) => ({ default: m.AssistantWidget })),
);
const InteractiveTutorial = React.lazy(() =>
  import('./components/onboarding/InteractiveTutorial').then((m) => ({ default: m.InteractiveTutorial })),
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

  // Onboarding system
  const onboarding = useOnboarding();

  // Detect model changes for onboarding checklist (class, attribute, relationship)
  const reduxDiagram = useAppSelector(selectActiveDiagram);
  const { checklist, updateChecklist } = onboarding;

  useEffect(() => {
    const model = reduxDiagram?.model;
    if (!model || !isUMLModel(model)) return;

    if (!checklist.createdClass) {
      const hasClass = Object.values(model.elements).some(
        (el) => el.type === 'Class' || el.type === 'AbstractClass' || el.type === 'Interface',
      );
      if (hasClass) updateChecklist('createdClass');
    }

    if (!checklist.addedAttribute) {
      const hasAttribute = Object.values(model.elements).some(
        (el) => el.type === 'ClassAttribute',
      );
      if (hasAttribute) updateChecklist('addedAttribute');
    }

    if (!checklist.createdRelationship) {
      if (Object.keys(model.relationships).length > 0) {
        updateChecklist('createdRelationship');
      }
    }
  }, [reduxDiagram, checklist.createdClass, checklist.addedAttribute, checklist.createdRelationship, updateChecklist]);

  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <WorkspaceShell
        onOpenProjectHub={() => setShowProjectHub(true)}
        onOpenTemplateDialog={() => {
          setShowTemplateDialog(true);
          onboarding.updateChecklist('exploredTemplates');
        }}
        onExportProject={handleExport}
        onGenerate={(type) => {
          onboarding.updateChecklist('generatedCode');
          handleGenerateRequest(type);
        }}
        onQualityCheck={() => {
          onboarding.updateChecklist('triedQualityCheck');
          handleQualityCheck();
        }}
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

      <ErrorPanel />
      <Suspense fallback={null}>
        <AssistantWidget onAssistantGenerate={handleAssistantGenerate} />
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

