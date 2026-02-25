import React, { useCallback, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PostHogProvider } from 'posthog-js/react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ApollonEditor } from '@besser/wme';
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
} from './constant';
import { ApollonEditorProvider } from './components/apollon-editor-component/apollon-editor-context';
import { ApollonEditorComponent } from './components/apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from './components/grapesjs-editor';
import { QuantumEditorComponent } from './components/quantum-editor-component/QuantumEditorComponent';
import { ErrorPanel } from './components/error-handling/error-panel';
import { AssistantWidget } from './components/assistant-workspace/AssistantWidget';
import { CookieConsentBanner, hasUserConsented } from './components/cookie-consent/CookieConsentBanner';
import { ApplicationStore } from './store/application-store';
import { useProject } from './hooks/useProject';
import { WorkspaceShell } from './components/sidebar/WorkspaceShell';
import { ProjectHubDialog } from './components/home/ProjectHubDialog';
import { ProjectSettingsPanel } from './components/project/ProjectSettingsPanel';
import { AgentConfigurationPanel } from './components/agent/AgentConfigurationPanel';
import { AgentPersonalizationRulesPanel } from './components/agent/AgentPersonalizationRulesPanel';
import { AgentPersonalizationMappingPanel } from './components/agent/AgentPersonalizationMappingPanel';
import { TemplateLibraryDialog } from './components/modals/TemplateLibraryDialog';
import { ExportDialog } from './components/modals/ExportDialog';
import { GeneratorConfigDialogs } from './components/modals/generator-config/GeneratorConfigDialogs';
import { useProjectBootstrap } from './hooks/useProjectBootstrap';
import { getWorkspaceContext } from './utils/workspaceContext';
import { useGeneratorExecution } from './components/generator-execution/useGeneratorExecution';

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

  const activeDiagram = currentProject ? currentProject.diagrams[currentProject.currentDiagramType] : undefined;
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

  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <WorkspaceShell
        onOpenProjectHub={() => setShowProjectHub(true)}
        onOpenTemplateDialog={() => setShowTemplateDialog(true)}
        onExportProject={handleExport}
        onGenerate={handleGenerateRequest}
        onQualityCheck={handleQualityCheck}
        showQualityCheck={true}
        generatorMode={generatorMenuMode}
        isGenerating={isGenerating}
        onAssistantGenerate={handleAssistantGenerate}
      >
        <Routes>
          <Route path="/" element={<ApollonEditorComponent />} />
          <Route path="/graphical-ui-editor" element={<GraphicalUIEditor />} />
          <Route path="/quantum-editor" element={<QuantumEditorComponent />} />
          <Route path="/agent-config" element={<AgentConfigurationPanel />} />
          <Route path="/agent-personalization" element={<AgentPersonalizationRulesPanel />} />
          <Route path="/agent-personalization-2" element={<AgentPersonalizationMappingPanel />} />
          <Route path="/project-settings" element={<ProjectSettingsPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceShell>

      <ProjectHubDialog open={showProjectHub} onOpenChange={setShowProjectHub} />
      <TemplateLibraryDialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog} />
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        editor={editor}
        currentDiagramTitle={activeDiagramTitle}
      />

      {/*
       * Generator configuration dialogs (Django, SQL, SQLAlchemy, JSON Schema,
       * Agent, Qiskit). All state lives in the useGeneratorExecution hook;
       * configState is the props bag that wires every field, change handler,
       * and execution callback into the presentational dialog component.
       */}
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
      />

      <ErrorPanel />
      <AssistantWidget onAssistantGenerate={handleAssistantGenerate} />
      <ToastContainer />
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
    <PostHogProvider apiKey={POSTHOG_KEY} options={postHogOptions}>
      <ApplicationStore>
        <AppContent />
        <CookieConsentBanner />
      </ApplicationStore>
    </PostHogProvider>
  );
}

