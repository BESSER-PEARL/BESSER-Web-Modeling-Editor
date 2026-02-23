/**
 * useGeneratorExecution
 *
 * Encapsulates **all** generator-related state, config-dialog management,
 * execution logic, and the GUI-auto-generation flow that were previously
 * inlined in `AppContentInner`.
 *
 * The hook returns only the slices that `application.tsx` needs to wire up
 * the UI:
 *  - generator execution callbacks for WorkspaceShell & UMLAgentModeling
 *  - config-dialog state + props passthrough for GeneratorConfigDialogs
 *  - quality-check handler
 *  - `isGenerating` flag
 */

import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApollonEditor } from '@besser/wme';
import { toast } from 'react-toastify';

import { useAppDispatch } from '../../store/hooks';
import { useProject } from '../../hooks/useProject';
import { BACKEND_URL } from '../../constant';
import {
  useGenerateCode,
  DjangoConfig,
  SQLConfig,
  SQLAlchemyConfig,
  JSONSchemaConfig,
  AgentConfig,
  QiskitConfig,
} from '../../services/generate-code/useGenerateCode';
import type { GenerationResult } from '../../services/generate-code/types';
import { useDeployLocally } from '../../services/generate-code/useDeployLocally';
import { GrapesJSProjectData, isUMLModel } from '../../types/project';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { switchDiagramTypeThunk } from '../../services/project/projectSlice';
import { validateDiagram } from '../../services/validation/validateDiagram';
import {
  ConfigDialog,
  getConfigDialogForGenerator,
} from '../../services/generate-code/generator-dialog-config';
import { getWorkspaceContext } from '../../utils/workspaceContext';
import type { GeneratorType } from '../sidebar/workspace-types';

// ─── Pure helpers ──────────────────────────────────────────────────────────────

const toIdentifier = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return fallback;
  if (/^[0-9]/.test(normalized)) return `p_${normalized}`;
  return normalized;
};

const validateDjangoName = (name: string): boolean =>
  /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);

function isGuiModelEmpty(guiModel: GrapesJSProjectData | undefined): boolean {
  if (!guiModel || !guiModel.pages || guiModel.pages.length === 0) return true;

  return guiModel.pages.every((page: any) => {
    if (Array.isArray(page.frames)) {
      return page.frames.every((frame: any) => {
        const components = frame?.component?.components;
        return !Array.isArray(components) || components.length === 0;
      });
    }
    const components = page?.component?.components;
    return !Array.isArray(components) || components.length === 0;
  });
}

// ─── GUI auto-generation event helpers ─────────────────────────────────────────

function waitForGuiEditorReady(timeoutMs = 12000): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).__WME_GUI_EDITOR_READY__) return Promise.resolve(true);

  return new Promise((resolve) => {
    let done = false;
    const finish = (value: boolean) => {
      if (done) return;
      done = true;
      window.removeEventListener('wme:gui-editor-ready', onReady as EventListener);
      clearTimeout(timeoutId);
      resolve(value);
    };
    const onReady = () => finish(true);
    const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
    window.addEventListener('wme:gui-editor-ready', onReady as EventListener);
  });
}

function triggerAssistantGuiAutoGenerate(timeoutMs = 25000): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ ok: false, error: 'Window is not available.' });
  }

  return new Promise((resolve) => {
    let done = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      window.removeEventListener('wme:assistant-auto-generate-gui-done', onDone as EventListener);
      clearTimeout(timeoutId);
      resolve(result);
    };

    const onDone = (event: Event) => {
      const detail = (event as CustomEvent<{ ok?: boolean; error?: string }>).detail || {};
      finish({
        ok: Boolean(detail.ok),
        error: detail.ok ? undefined : (detail.error || 'Auto-generation failed.'),
      });
    };

    const timeoutId = window.setTimeout(
      () => finish({ ok: false, error: 'Timed out while auto-generating GUI.' }),
      timeoutMs,
    );
    window.addEventListener('wme:assistant-auto-generate-gui-done', onDone as EventListener);
    window.dispatchEvent(new CustomEvent('wme:assistant-auto-generate-gui'));
  });
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export interface GeneratorConfigState {
  configDialog: ConfigDialog;
  setConfigDialog: (d: ConfigDialog) => void;
  djangoProjectName: string;
  djangoAppName: string;
  useDocker: boolean;
  sqlDialect: SQLConfig['dialect'];
  sqlAlchemyDbms: SQLAlchemyConfig['dbms'];
  jsonSchemaMode: JSONSchemaConfig['mode'];
  sourceLanguage: string;
  pendingAgentLanguage: string;
  selectedAgentLanguages: string[];
  qiskitBackend: QiskitConfig['backend'];
  qiskitShots: number;
  onDjangoProjectNameChange: (v: string) => void;
  onDjangoAppNameChange: (v: string) => void;
  onUseDockerChange: (v: boolean) => void;
  onSqlDialectChange: (v: SQLConfig['dialect']) => void;
  onSqlAlchemyDbmsChange: (v: SQLAlchemyConfig['dbms']) => void;
  onJsonSchemaModeChange: (v: JSONSchemaConfig['mode']) => void;
  onSourceLanguageChange: (v: string) => void;
  onPendingAgentLanguageChange: (v: string) => void;
  onSelectedAgentLanguagesChange: (v: string[]) => void;
  onQiskitBackendChange: (v: QiskitConfig['backend']) => void;
  onQiskitShotsChange: (v: number) => void;
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSqlAlchemyGenerate: () => void;
  onJsonSchemaGenerate: () => void;
  onAgentGenerate: () => void;
  onQiskitGenerate: () => void;
}

export interface UseGeneratorExecutionReturn {
  isGenerating: boolean;
  /** Passed to WorkspaceShell → onGenerate */
  handleGenerateRequest: (type: GeneratorType) => Promise<void>;
  /** Passed to WorkspaceShell → onAssistantGenerate  and UMLAgentModeling */
  handleAssistantGenerate: (type: GeneratorType, config?: unknown) => Promise<GenerationResult>;
  /** Passed to WorkspaceShell → onQualityCheck */
  handleQualityCheck: () => Promise<void>;
  /** Props bag to spread onto <GeneratorConfigDialogs /> */
  configState: GeneratorConfigState;
  /** Whether the app is running against localhost */
  isLocalEnvironment: boolean;
}

export function useGeneratorExecution(editor: ApollonEditor | undefined): UseGeneratorExecutionReturn {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentProject } = useProject();
  const generateCode = useGenerateCode();
  const deployLocally = useDeployLocally();

  const { isQuantumContext, isGuiContext } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );

  const isLocalEnvironment =
    !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');

  const activeDiagram = currentProject
    ? currentProject.diagrams[currentProject.currentDiagramType]
    : undefined;
  const activeDiagramTitle = activeDiagram?.title || currentProject?.name || 'Diagram';

  // ── Generator config state ─────────────────────────────────────────────────

  const [isGenerating, setIsGenerating] = useState(false);
  const [configDialog, setConfigDialog] = useState<ConfigDialog>('none');

  const [djangoProjectName, setDjangoProjectName] = useState('');
  const [djangoAppName, setDjangoAppName] = useState('');
  const [useDocker, setUseDocker] = useState(false);
  const [sqlDialect, setSqlDialect] = useState<SQLConfig['dialect']>('sqlite');
  const [sqlAlchemyDbms, setSqlAlchemyDbms] = useState<SQLAlchemyConfig['dbms']>('sqlite');
  const [jsonSchemaMode, setJsonSchemaMode] = useState<JSONSchemaConfig['mode']>('regular');
  const [sourceLanguage, setSourceLanguage] = useState('none');
  const [selectedAgentLanguages, setSelectedAgentLanguages] = useState<string[]>([]);
  const [pendingAgentLanguage, setPendingAgentLanguage] = useState('none');
  const [qiskitBackend, setQiskitBackend] = useState<QiskitConfig['backend']>('aer_simulator');
  const [qiskitShots, setQiskitShots] = useState<number>(1024);

  // Auto-derive Django project/app names from current project
  useEffect(() => {
    if (!currentProject) return;
    const projectName = toIdentifier(currentProject.name || 'besser_project', 'besser_project');
    const appName = toIdentifier(activeDiagram?.title || 'core_app', 'core_app');
    setDjangoProjectName(projectName);
    setDjangoAppName(appName === projectName ? `${appName}_app` : appName);
  }, [currentProject?.id, currentProject?.name, activeDiagram?.title]);

  // ── Core execution ─────────────────────────────────────────────────────────

  const ensureGuiForAssistantWebAppGeneration = useCallback(
    async (): Promise<GenerationResult | null> => {
      if (!currentProject) {
        return { ok: false, error: 'Create or load a project before generating code.' };
      }

      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: 'GUINoCodeDiagram' })).unwrap();
      } catch {
        return { ok: false, error: 'Could not switch to GUI diagram for auto-generation.' };
      }

      if (location.pathname !== '/graphical-ui-editor') {
        navigate('/graphical-ui-editor');
      }

      const ready = await waitForGuiEditorReady(12000);
      if (!ready) {
        return { ok: false, error: 'GUI editor did not become ready in time.' };
      }

      const autoGenerateResult = await triggerAssistantGuiAutoGenerate(30000);
      if (!autoGenerateResult.ok) {
        return { ok: false, error: autoGenerateResult.error || 'Could not auto-generate GUI from Class Diagram.' };
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
      return null;
    },
    [currentProject, dispatch, location.pathname, navigate],
  );

  const executeGenerator = useCallback(
    async (
      generatorType: GeneratorType,
      config?: unknown,
      options?: { autoGenerateGuiIfEmpty?: boolean },
    ): Promise<GenerationResult> => {
      if (!currentProject) {
        toast.error('Create or load a project before generating code.');
        return { ok: false, error: 'Create or load a project before generating code.' };
      }

      try {
        setIsGenerating(true);

        if (generatorType === 'web_app') {
          // Always refresh from ProjectStorageRepository to pick up models
          // loaded via the GrapesJS event bridge (which writes to localStorage
          // but does NOT update the Redux store).
          const freshProject =
            ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
          let guiModel = freshProject.diagrams.GUINoCodeDiagram.model as GrapesJSProjectData | undefined;

          if (isGuiModelEmpty(guiModel)) {
            if (options?.autoGenerateGuiIfEmpty) {
              const autoGenerateError = await ensureGuiForAssistantWebAppGeneration();
              if (autoGenerateError) {
                toast.error(autoGenerateError.error);
                return autoGenerateError;
              }
              const refreshedProject =
                ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
              guiModel = refreshedProject.diagrams.GUINoCodeDiagram.model as GrapesJSProjectData | undefined;
            }

            if (isGuiModelEmpty(guiModel)) {
              toast.error('Cannot generate web application: GUI diagram is empty.');
              return { ok: false, error: 'Cannot generate web application: GUI diagram is empty.' };
            }
          }

          return await generateCode(null, 'web_app', activeDiagramTitle, config as any);
        }

        if (generatorType === 'qiskit') {
          if (!isQuantumContext) {
            toast.error('Open the Quantum editor before generating Qiskit code.');
            return { ok: false, error: 'Open the Quantum editor before generating Qiskit code.' };
          }

          return await generateCode(
            null,
            'qiskit',
            activeDiagramTitle,
            (config as QiskitConfig) ?? { backend: 'aer_simulator', shots: 1024 },
          );
        }

        if (isQuantumContext || isGuiContext) {
          toast.error('Switch to a UML diagram to use this generator.');
          return { ok: false, error: 'Switch to a UML diagram to use this generator.' };
        }

        if (!editor) {
          toast.error('No UML editor instance available. Open a UML diagram first.');
          return { ok: false, error: 'No UML editor instance available. Open a UML diagram first.' };
        }

        let result: GenerationResult = { ok: false, error: 'Generation was not executed.' };
        switch (generatorType) {
          case 'smartdata':
            result = await generateCode(editor, 'jsonschema', activeDiagramTitle, { mode: 'smart_data' });
            break;
          case 'django':
            result = await generateCode(editor, 'django', activeDiagramTitle, config as DjangoConfig);
            break;
          case 'sql':
            result = await generateCode(editor, 'sql', activeDiagramTitle, config as SQLConfig);
            break;
          case 'sqlalchemy':
            result = await generateCode(editor, 'sqlalchemy', activeDiagramTitle, config as SQLAlchemyConfig);
            break;
          case 'jsonschema':
            result = await generateCode(editor, 'jsonschema', activeDiagramTitle, config as JSONSchemaConfig);
            break;
          case 'agent':
            result = await generateCode(editor, 'agent', activeDiagramTitle, config as AgentConfig);
            break;
          default:
            result = await generateCode(editor, generatorType, activeDiagramTitle, config as any);
        }
        return result;
      } catch (error) {
        const errorMessage = `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        toast.error(errorMessage);
        return { ok: false, error: errorMessage };
      } finally {
        setIsGenerating(false);
      }
    },
    [
      currentProject, editor, generateCode, activeDiagramTitle,
      isQuantumContext, isGuiContext, ensureGuiForAssistantWebAppGeneration,
    ],
  );

  // ── Public handlers ────────────────────────────────────────────────────────

  const handleGenerateRequest = useCallback(
    async (generatorType: GeneratorType) => {
      if (!currentProject) {
        toast.error('Create or load a project before generating code.');
        return;
      }
      const requiredDialog = getConfigDialogForGenerator(generatorType);
      if (requiredDialog !== 'none') {
        setConfigDialog(requiredDialog);
        return;
      }
      await executeGenerator(generatorType);
    },
    [currentProject, executeGenerator],
  );

  const handleAssistantGenerate = useCallback(
    async (generatorType: GeneratorType, config?: unknown): Promise<GenerationResult> =>
      executeGenerator(generatorType, config, { autoGenerateGuiIfEmpty: generatorType === 'web_app' }),
    [executeGenerator],
  );

  const handleQualityCheck = useCallback(async () => {
    if (!currentProject) {
      toast.error('Create or load a project before validating.');
      return;
    }

    if (isQuantumContext || isGuiContext || currentProject.currentDiagramType === 'QuantumCircuitDiagram') {
      toast.error('coming soon');
      return;
    }

    try {
      if (activeDiagram?.model && !isUMLModel(activeDiagram.model)) {
        await validateDiagram(null, activeDiagramTitle, activeDiagram.model);
        return;
      }

      if (editor) {
        await validateDiagram(editor, activeDiagramTitle);
        return;
      }

      toast.error('No diagram available to validate');
    } catch (error) {
      toast.error(`Quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [currentProject, editor, isQuantumContext, isGuiContext, activeDiagram, activeDiagramTitle]);

  // ── Config-dialog handlers ─────────────────────────────────────────────────

  const handleDjangoGenerate = useCallback(async () => {
    if (!djangoProjectName || !djangoAppName) {
      toast.error('Project and app names are required.');
      return;
    }
    if (djangoProjectName === djangoAppName) {
      toast.error('Project and app names must be different.');
      return;
    }
    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores.');
      return;
    }
    await executeGenerator('django', {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);
    setConfigDialog('none');
  }, [djangoProjectName, djangoAppName, useDocker, executeGenerator]);

  const handleDjangoDeploy = useCallback(async () => {
    if (!editor || !currentProject) {
      toast.error('Open a UML diagram before deploying.');
      return;
    }
    if (!djangoProjectName || !djangoAppName) {
      toast.error('Project and app names are required.');
      return;
    }
    if (djangoProjectName === djangoAppName) {
      toast.error('Project and app names must be different.');
      return;
    }
    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores.');
      return;
    }
    await deployLocally(editor, 'django', activeDiagramTitle, {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);
  }, [editor, currentProject, djangoProjectName, djangoAppName, useDocker, deployLocally, activeDiagramTitle]);

  const handleSqlGenerate = useCallback(async () => {
    await executeGenerator('sql', { dialect: sqlDialect } as SQLConfig);
    setConfigDialog('none');
  }, [sqlDialect, executeGenerator]);

  const handleSqlAlchemyGenerate = useCallback(async () => {
    await executeGenerator('sqlalchemy', { dbms: sqlAlchemyDbms } as SQLAlchemyConfig);
    setConfigDialog('none');
  }, [sqlAlchemyDbms, executeGenerator]);

  const handleJsonSchemaGenerate = useCallback(async () => {
    await executeGenerator('jsonschema', { mode: jsonSchemaMode } as JSONSchemaConfig);
    setConfigDialog('none');
  }, [jsonSchemaMode, executeGenerator]);

  const handleAgentGenerate = useCallback(async () => {
    const config: AgentConfig = selectedAgentLanguages.length
      ? { languages: { source: sourceLanguage, target: selectedAgentLanguages } }
      : {};
    await executeGenerator('agent', config);
    setConfigDialog('none');
  }, [selectedAgentLanguages, sourceLanguage, executeGenerator]);

  const handleQiskitGenerate = useCallback(async () => {
    await executeGenerator('qiskit', {
      backend: qiskitBackend,
      shots: Math.max(1, qiskitShots || 1024),
    } as QiskitConfig);
    setConfigDialog('none');
  }, [qiskitBackend, qiskitShots, executeGenerator]);

  // ── Return ─────────────────────────────────────────────────────────────────

  const configState: GeneratorConfigState = {
    configDialog,
    setConfigDialog,
    djangoProjectName,
    djangoAppName,
    useDocker,
    sqlDialect,
    sqlAlchemyDbms,
    jsonSchemaMode,
    sourceLanguage,
    pendingAgentLanguage,
    selectedAgentLanguages,
    qiskitBackend,
    qiskitShots,
    onDjangoProjectNameChange: setDjangoProjectName,
    onDjangoAppNameChange: setDjangoAppName,
    onUseDockerChange: setUseDocker,
    onSqlDialectChange: setSqlDialect,
    onSqlAlchemyDbmsChange: setSqlAlchemyDbms,
    onJsonSchemaModeChange: setJsonSchemaMode,
    onSourceLanguageChange: setSourceLanguage,
    onPendingAgentLanguageChange: setPendingAgentLanguage,
    onSelectedAgentLanguagesChange: setSelectedAgentLanguages,
    onQiskitBackendChange: setQiskitBackend,
    onQiskitShotsChange: setQiskitShots,
    onDjangoGenerate: () => void handleDjangoGenerate(),
    onDjangoDeploy: () => void handleDjangoDeploy(),
    onSqlGenerate: () => void handleSqlGenerate(),
    onSqlAlchemyGenerate: () => void handleSqlAlchemyGenerate(),
    onJsonSchemaGenerate: () => void handleJsonSchemaGenerate(),
    onAgentGenerate: () => void handleAgentGenerate(),
    onQiskitGenerate: () => void handleQiskitGenerate(),
  };

  return {
    isGenerating,
    handleGenerateRequest,
    handleAssistantGenerate,
    handleQualityCheck,
    configState,
    isLocalEnvironment,
  };
}
