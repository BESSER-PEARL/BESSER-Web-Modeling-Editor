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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApollonEditor, UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';

import { useAppDispatch } from '../../store/hooks';
import { notifyError } from '../../utils/notifyError';
import { useProject } from '../../hooks/useProject';
import { getPostHog } from '../../services/analytics/lazy-analytics';
import { BACKEND_URL, SHOW_FULL_AGENT_CONFIGURATION } from '../../constants/constant';
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
import { GrapesJSProjectData, isUMLModel, getActiveDiagram, getReferencedDiagram } from '../../types/project';
import type { BesserProject, ProjectDiagram } from '../../types/project';
import { LocalStorageRepository } from '../../services/storage/local-storage-repository';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { switchDiagramTypeThunk } from '../../store/workspaceSlice';
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

function isUMLModelEmpty(diagram: ProjectDiagram | undefined): boolean {
  if (!diagram || !diagram.model) return true;
  if (!isUMLModel(diagram.model)) return true;
  const model = diagram.model;
  const elementCount = model.elements ? Object.keys(model.elements).length : 0;
  const relationshipCount = model.relationships ? Object.keys(model.relationships).length : 0;
  return elementCount === 0 && relationshipCount === 0;
}

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

// ─── Model metrics for analytics ────────────────────────────────────────────

function getModelMetrics(project: BesserProject | undefined): Record<string, number> {
  const empty = { elements_count: 0, classes_count: 0, abstract_classes_count: 0, attributes_count: 0, methods_count: 0, enumerations_count: 0, relationships_count: 0, total_size: 0 };
  if (!project) return empty;
  const diagram = getActiveDiagram(project, project.currentDiagramType);
  const model = diagram?.model as any;
  if (!model || !model.elements) return empty;

  const elements = model.elements ? Object.values(model.elements) as any[] : [];
  const countByType = (types: string[]) => elements.filter((el) => types.includes(el.type)).length;

  const classesCount = countByType(['Class']);
  const abstractClassesCount = countByType(['AbstractClass']);
  const attributesCount = countByType(['ClassAttribute']);
  const methodsCount = countByType(['ClassMethod']);
  const enumerationsCount = countByType(['Enumeration']);
  const relationshipsCount = model.relationships ? Object.keys(model.relationships).length : 0;

  return {
    elements_count: elements.length,
    classes_count: classesCount,
    abstract_classes_count: abstractClassesCount,
    attributes_count: attributesCount,
    methods_count: methodsCount,
    enumerations_count: enumerationsCount,
    relationships_count: relationshipsCount,
    total_size: elements.length + relationshipsCount,
  };
}

// ─── Web App checklist builder ──────────────────────────────────────────────

function buildWebAppChecklist(project: BesserProject | undefined): WebAppChecklistInfo | null {
  if (!project) return null;

  // Resolve the active GUI diagram
  const guiDiagram = getActiveDiagram(project, 'GUINoCodeDiagram');

  // Resolve the ClassDiagram that the GUI diagram references
  const classDiagram = getReferencedDiagram(project, guiDiagram, 'ClassDiagram');

  const classDiagramExists = Boolean(classDiagram);
  const classDiagramHasContent = classDiagramExists && !isUMLModelEmpty(classDiagram);

  const guiDiagramExists = Boolean(guiDiagram);
  const guiModel = guiDiagram?.model as GrapesJSProjectData | undefined;
  const guiDiagramHasContent = guiDiagramExists && !isGuiModelEmpty(guiModel);

  // Agent diagrams are referenced per-component inside the GUI editor (drag & drop).
  // Count how many agent diagrams exist in the project for informational display.
  const agentDiagrams = project.diagrams?.AgentDiagram ?? [];
  const agentDiagramCount = agentDiagrams.length;

  // Truncate long titles for display
  const truncate = (title: string | undefined, max: number = 40): string | null => {
    if (!title) return null;
    return title.length > max ? `${title.slice(0, max)}...` : title;
  };

  const classDiagramInfo: WebAppChecklistDiagramInfo = {
    label: 'Class Diagram',
    title: truncate(classDiagram?.title),
    exists: classDiagramExists,
    hasContent: classDiagramHasContent,
    required: true,
  };

  const guiDiagramInfo: WebAppChecklistDiagramInfo = {
    label: 'GUI Diagram',
    title: truncate(guiDiagram?.title),
    exists: guiDiagramExists,
    hasContent: guiDiagramHasContent,
    required: true,
    referencedFrom: classDiagramExists
      ? truncate(classDiagram?.title)
      : null,
  };

  // Agent info is now informational -- agents are configured per-component in the GUI
  const agentDiagramInfo: WebAppChecklistDiagramInfo = {
    label: 'Agent Diagrams',
    title: agentDiagramCount > 0
      ? `${agentDiagramCount} available (configured per-component in GUI)`
      : 'None available',
    exists: agentDiagramCount > 0,
    hasContent: agentDiagramCount > 0,
    required: false,
  };

  // canGenerate does NOT depend on agent diagrams -- they are optional and per-component
  const canGenerate = classDiagramExists && guiDiagramExists;

  return {
    classDiagram: classDiagramInfo,
    guiDiagram: guiDiagramInfo,
    agentDiagram: agentDiagramInfo,
    canGenerate,
  };
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

/**
 * Props bag passed from useGeneratorExecution → <GeneratorConfigDialogs />.
 *
 * Grouped by generator:
 *  - Dialog control          – which modal is open
 *  - Django                  – project/app names, Docker flag
 *  - SQL / SQLAlchemy        – dialect / DBMS selection
 *  - JSON Schema             – regular vs smart-data mode
 *  - Agent                   – spoken languages, advanced config & personalization
 *  - Qiskit                  – backend type and shot count
 *  - Execution callbacks     – one per generator to trigger code generation
 */
/** Describes one diagram row in the Web App pre-generation checklist. */
export interface WebAppChecklistDiagramInfo {
  /** Human-readable label such as "Class Diagram" or "Agent Diagram". */
  label: string;
  /** Title of the resolved diagram, if it exists. */
  title: string | null;
  /** Whether the diagram exists in the project at all. */
  exists: boolean;
  /** Whether the diagram model has meaningful content. */
  hasContent: boolean;
  /** Whether this diagram is required for generation. */
  required: boolean;
  /** Name of the referenced parent diagram, if any (e.g. ClassDiagram referenced by a GUI diagram). */
  referencedFrom?: string | null;
}

/** Complete checklist information for the Web App generator dialog. */
export interface WebAppChecklistInfo {
  classDiagram: WebAppChecklistDiagramInfo;
  guiDiagram: WebAppChecklistDiagramInfo;
  agentDiagram: WebAppChecklistDiagramInfo;
  /** True when all required diagrams exist (generation can proceed). */
  canGenerate: boolean;
}

export interface GeneratorConfigState {
  // ── Dialog control ───────────────────────────────────────────────────────
  /** Which config dialog is currently visible ('none' when closed). */
  configDialog: ConfigDialog;
  /** Open or close a config dialog by key. */
  setConfigDialog: (d: ConfigDialog) => void;

  // ── Django ───────────────────────────────────────────────────────────────
  djangoProjectName: string;
  djangoAppName: string;
  useDocker: boolean;

  // ── SQL ──────────────────────────────────────────────────────────────────
  sqlDialect: SQLConfig['dialect'];

  // ── SQLAlchemy ───────────────────────────────────────────────────────────
  sqlAlchemyDbms: SQLAlchemyConfig['dbms'];

  // ── JSON Schema ──────────────────────────────────────────────────────────
  jsonSchemaMode: JSONSchemaConfig['mode'];

  // ── Agent ────────────────────────────────────────────────────────────────
  /** Source language for the agent (e.g. 'english'). 'none' = not set. */
  sourceLanguage: string;
  /** Language currently picked in the dropdown but not yet added. */
  pendingAgentLanguage: string;
  /** Languages the agent will be translated to. */
  selectedAgentLanguages: string[];
  /** Whether at least one saved agent configuration preset exists. */
  hasSavedAgentConfiguration: boolean;
  /** Advanced mode selector (visible only when SHOW_FULL_AGENT_CONFIGURATION). */
  agentMode: 'original' | 'configuration' | 'personalization';
  /** Stored agent configuration presets. */
  storedAgentConfigurations: any[];
  /** Profile → configuration mappings for personalization mode. */
  storedAgentMappings: any[];
  /** IDs of the currently selected stored configurations / mappings. */
  selectedStoredAgentConfigIds: string[];

  // ── Qiskit ───────────────────────────────────────────────────────────────
  qiskitBackend: QiskitConfig['backend'];
  qiskitShots: number;

  // ── Field change handlers ────────────────────────────────────────────────
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
  onAgentModeChange: (v: 'original' | 'configuration' | 'personalization') => void;
  onStoredAgentConfigToggle: (id: string) => void;

  // ── Web App checklist ──────────────────────────────────────────────────
  /** Pre-generation checklist info for the web_app generator. */
  webAppChecklist: WebAppChecklistInfo | null;

  // ── Execution callbacks (one per generator) ──────────────────────────────
  /** Validate inputs, call the backend, and close the dialog on success. */
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSqlAlchemyGenerate: () => void;
  onJsonSchemaGenerate: () => void;
  onAgentGenerate: () => void;
  onQiskitGenerate: () => void;
  onWebAppGenerate: () => void;
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

  const { isQuantumContext, isGuiContext, isObjectContext } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );

  const isLocalEnvironment =
    !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');

  // Track whether the component is still mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const activeDiagram = currentProject
    ? getActiveDiagram(currentProject, currentProject.currentDiagramType)
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
  const [hasSavedAgentConfiguration, setHasSavedAgentConfiguration] = useState(true);
  const [agentMode, setAgentMode] = useState<'original' | 'configuration' | 'personalization'>('original');
  const [storedAgentConfigurations, setStoredAgentConfigurations] = useState<any[]>([]);
  const [storedAgentMappings, setStoredAgentMappings] = useState<any[]>([]);
  const [selectedStoredAgentConfigIds, setSelectedStoredAgentConfigIds] = useState<string[]>([]);

  // ── Web App checklist (computed from current project) ─────────────────────
  const webAppChecklist = useMemo(
    () => buildWebAppChecklist(currentProject ?? undefined),
    [currentProject],
  );

  // Auto-derive Django project/app names from current project
  useEffect(() => {
    if (!currentProject) return;
    const projectName = toIdentifier(currentProject.name || 'besser_project', 'besser_project');
    const appName = toIdentifier(activeDiagram?.title || 'core_app', 'core_app');
    setDjangoProjectName(projectName);
    setDjangoAppName(appName === projectName ? `${appName}_app` : appName);
  }, [currentProject?.id, currentProject?.name, activeDiagram?.title]);

  // Load agent configurations when dialog opens
  useEffect(() => {
    if (configDialog !== 'agent') return;

    try {
      const allSavedConfigurations = LocalStorageRepository.getAgentConfigurations();
      setHasSavedAgentConfiguration(allSavedConfigurations.length > 0);

      if (SHOW_FULL_AGENT_CONFIGURATION) {
        const usableConfigs = allSavedConfigurations.filter((entry) =>
          Boolean(entry.personalizedAgentModel || entry.baseAgentModel)
        );
        setStoredAgentConfigurations(usableConfigs);

        const profiles = LocalStorageRepository.getUserProfiles();
        const profileNameById = profiles.reduce<Record<string, string>>((acc, profile) => {
          acc[profile.id] = profile.name;
          return acc;
        }, {});

        const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
        const enrichedMappings = mappings
          .filter((mapping) => usableConfigs.some((cfg) => cfg.id === mapping.agentConfigurationId))
          .map((mapping) => {
            const config = usableConfigs.find((cfg) => cfg.id === mapping.agentConfigurationId);
            return {
              ...mapping,
              userProfileLabel: profileNameById[mapping.userProfileId] || mapping.userProfileName || 'Unknown profile',
              agentConfigurationLabel: config?.name || mapping.agentConfigurationName || 'Unknown configuration',
            };
          });

        setStoredAgentMappings(enrichedMappings);

        // Auto-select first config or mapping
        if (usableConfigs.length > 0) {
          setSelectedStoredAgentConfigIds([usableConfigs[0].id]);
        }
      }
    } catch (error) {
      console.error('Failed to load agent configurations:', error);
      setStoredAgentConfigurations([]);
      setStoredAgentMappings([]);
      setSelectedStoredAgentConfigIds([]);
    }
  }, [configDialog]);

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

      if (location.pathname !== '/') {
        navigate('/');
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
          // Redux state is kept in sync with localStorage via useStorageSync,
          // so currentProject already has the latest GUI model data.
          let guiModel = getActiveDiagram(currentProject, 'GUINoCodeDiagram')?.model as GrapesJSProjectData | undefined;

          if (isGuiModelEmpty(guiModel)) {
            if (options?.autoGenerateGuiIfEmpty) {
              const autoGenerateError = await ensureGuiForAssistantWebAppGeneration();
              if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
              if (autoGenerateError) {
                toast.error(autoGenerateError.error);
                return autoGenerateError;
              }
              // After auto-generation, read from storage as a safety net
              // (the async Redux sync may not have propagated yet)
              const refreshedProject =
                ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
              guiModel = getActiveDiagram(refreshedProject, 'GUINoCodeDiagram')?.model as GrapesJSProjectData | undefined;
            }

            if (isGuiModelEmpty(guiModel)) {
              toast.error('Cannot generate web application: GUI diagram is empty.');
              return { ok: false, error: 'Cannot generate web application: GUI diagram is empty.' };
            }
          }

          const webAppResult = await generateCode(null, 'web_app', activeDiagramTitle, config as any);
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          if (webAppResult.ok) {
            getPostHog()?.capture('generator_used', {
              generator_type: 'web_app',
              diagram_type: currentProject.currentDiagramType,
              ...getModelMetrics(currentProject),
            });
          }
          return webAppResult;
        }

        if (generatorType === 'qiskit') {
          if (!isQuantumContext) {
            toast.error('Open the Quantum editor before generating Qiskit code.');
            return { ok: false, error: 'Open the Quantum editor before generating Qiskit code.' };
          }

          const qiskitResult = await generateCode(
            null,
            'qiskit',
            activeDiagramTitle,
            (config as QiskitConfig) ?? { backend: 'aer_simulator', shots: 1024 },
          );
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          if (qiskitResult.ok) {
            getPostHog()?.capture('generator_used', {
              generator_type: 'qiskit',
              diagram_type: currentProject.currentDiagramType,
              ...getModelMetrics(currentProject),
            });
          }
          return qiskitResult;
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
          case 'jsonobject': {
            // Object diagram generation requires the referenced ClassDiagram data
            if (!isObjectContext) {
              toast.error('Switch to an Object Diagram to use the JSON Object generator.');
              return { ok: false, error: 'Switch to an Object Diagram to use the JSON Object generator.' };
            }
            // Resolve the referenced ClassDiagram from the project so the backend
            // can build the domain model that object instances are based on.
            let referenceDiagramData: Record<string, any> | undefined;
            if (currentProject && activeDiagram) {
              const classDiagram = getReferencedDiagram(currentProject, activeDiagram, 'ClassDiagram');
              if (classDiagram?.model && isUMLModel(classDiagram.model)) {
                referenceDiagramData = classDiagram.model;
              }
            }
            result = await generateCode(editor, 'jsonobject', activeDiagramTitle, undefined, referenceDiagramData);
            break;
          }
          default:
            result = await generateCode(editor, generatorType, activeDiagramTitle, config as any);
        }

        if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };

        if (result.ok) {
          getPostHog()?.capture('generator_used', {
            generator_type: generatorType,
            diagram_type: currentProject.currentDiagramType,
            ...getModelMetrics(currentProject),
          });
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
      currentProject, editor, generateCode, activeDiagram, activeDiagramTitle,
      isQuantumContext, isGuiContext, isObjectContext, ensureGuiForAssistantWebAppGeneration,
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
    let baseConfig: AgentConfig = {};

    if (selectedAgentLanguages.length > 0) {
      baseConfig = { languages: { source: sourceLanguage, target: selectedAgentLanguages } };
    } else {
      // Read agent config from the project diagram (single source of truth)
      const activeAgentDiagramForConfig = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
      const diagramConfig = activeAgentDiagramForConfig?.config;
      if (diagramConfig && Object.keys(diagramConfig).length > 0) {
        baseConfig = { ...diagramConfig } as AgentConfig;
      }
    }

    let finalConfig: AgentConfig = baseConfig;

    if (SHOW_FULL_AGENT_CONFIGURATION) {
      const storedAgentConfigurations = LocalStorageRepository.getAgentConfigurations().filter((entry) =>
        Boolean(entry.personalizedAgentModel || entry.baseAgentModel || entry.originalAgentModel)
      );

      const activeConfigId = LocalStorageRepository.getActiveAgentConfigurationId();
      const selectedEntries = activeConfigId
        ? storedAgentConfigurations.filter((entry) => entry.id === activeConfigId)
        : storedAgentConfigurations.slice(0, 1);

      if (selectedEntries.length > 0) {
        const activeAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
        const agentDiagramId = activeAgentDiagram?.id;
        const baseModelSource = agentDiagramId ? LocalStorageRepository.getAgentBaseModel(agentDiagramId) : null;
        const fallbackOriginal = selectedEntries.find((entry) => entry.originalAgentModel)?.originalAgentModel;
        const agentDiagramModel = activeAgentDiagram?.model;
        const currentAgentModel =
          isUMLModel(agentDiagramModel) && agentDiagramModel.type === UMLDiagramType.AgentDiagram
            ? agentDiagramModel
            : null;
        const baseModel = baseModelSource || fallbackOriginal || currentAgentModel;

        const variations = selectedEntries
          .map((entry) => {
            const variantModel = entry.personalizedAgentModel || entry.baseAgentModel;
            if (!variantModel) {
              return null;
            }
            return {
              name: entry.name,
              model: structuredClone(variantModel),
              config: structuredClone(entry.config),
            };
          })
          .filter((entry): entry is { name: string; model: any; config: any } => Boolean(entry));

        if (baseModel && variations.length > 0) {
          finalConfig = {
            ...baseConfig,
            baseModel: structuredClone(baseModel),
            variations,
          };
        }
      }

      const hasVariationPayload = Boolean(finalConfig.baseModel && finalConfig.variations?.length);

      if (!hasVariationPayload) {
        const profiles = LocalStorageRepository.getUserProfiles();
        const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
        const personalizationMapping = mappings
          .map((entry) => {
            const profile = profiles.find((profileEntry) => profileEntry.id === entry.userProfileId);
            const config = storedAgentConfigurations.find((configEntry) => configEntry.id === entry.agentConfigurationId);
            const agentModel = config?.personalizedAgentModel || config?.baseAgentModel;

            if (!profile || !profile.model || !config || !agentModel) {
              return null;
            }

            return {
              name: profile.name,
              configuration: structuredClone(config.config),
              user_profile: structuredClone(profile.model),
              agent_model: structuredClone(agentModel),
            };
          })
          .filter((entry): entry is {
            name: string;
            configuration: any;
            user_profile: any;
            agent_model: any;
          } => Boolean(entry));

        if (personalizationMapping.length > 0) {
          finalConfig = {
            ...baseConfig,
            personalizationMapping,
          };
        }
      }
    }

    await executeGenerator('agent', finalConfig);
    setConfigDialog('none');
  }, [currentProject, selectedAgentLanguages, sourceLanguage, executeGenerator]);

  const handleQiskitGenerate = useCallback(async () => {
    await executeGenerator('qiskit', {
      backend: qiskitBackend,
      shots: Math.max(1, qiskitShots || 1024),
    } as QiskitConfig);
    setConfigDialog('none');
  }, [qiskitBackend, qiskitShots, executeGenerator]);

  const handleWebAppGenerate = useCallback(async () => {
    await executeGenerator('web_app');
    setConfigDialog('none');
  }, [executeGenerator]);

  // ── Return ─────────────────────────────────────────────────────────────────

  const handleStoredAgentConfigToggle = useCallback((id: string) => {
    setSelectedStoredAgentConfigIds((prev) =>
      prev.includes(id) ? prev.filter((entryId) => entryId !== id) : [...prev, id]
    );
  }, []);

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
    hasSavedAgentConfiguration,
    agentMode,
    storedAgentConfigurations,
    storedAgentMappings,
    selectedStoredAgentConfigIds,
    webAppChecklist,
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
    onAgentModeChange: setAgentMode,
    onStoredAgentConfigToggle: handleStoredAgentConfigToggle,
    onDjangoGenerate: () => { handleDjangoGenerate().catch(notifyError('Django generation')); },
    onDjangoDeploy: () => { handleDjangoDeploy().catch(notifyError('Django deployment')); },
    onSqlGenerate: () => { handleSqlGenerate().catch(notifyError('SQL generation')); },
    onSqlAlchemyGenerate: () => { handleSqlAlchemyGenerate().catch(notifyError('SQLAlchemy generation')); },
    onJsonSchemaGenerate: () => { handleJsonSchemaGenerate().catch(notifyError('JSON Schema generation')); },
    onAgentGenerate: () => { handleAgentGenerate().catch(notifyError('Agent generation')); },
    onQiskitGenerate: () => { handleQiskitGenerate().catch(notifyError('Qiskit generation')); },
    onWebAppGenerate: () => { handleWebAppGenerate().catch(notifyError('Web App generation')); },
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
