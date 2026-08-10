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
import { ApollonEditor, UMLDiagramType, UMLModel, normalizeAgentModel } from '@besser/wme';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

import { useAppDispatch } from '../../app/store/hooks';
import { notifyError } from '../../shared/utils/notifyError';
import { useProject } from '../../app/hooks/useProject';
import { getPostHog } from '../../shared/services/analytics/lazy-analytics';
import { BACKEND_URL, SHOW_FULL_AGENT_CONFIGURATION } from '../../shared/constants/constant';
import {
  useGenerateCode,
  DjangoConfig,
  SQLConfig,
  SupabaseConfig,
  SQLAlchemyConfig,
  JSONSchemaConfig,
  AgentConfig,
  QiskitConfig,
} from './hooks/useGenerateCode';
import type { GenerationResult, QualityCheckResult } from './types';
import { useDeployLocally } from './hooks/useDeployLocally';
import { GrapesJSProjectData, isUMLModel, getActiveDiagram, getReferencedDiagram } from '../../shared/types/project';
import type { BesserProject, ProjectDiagram } from '../../shared/types/project';
import {
  LocalStorageRepository,
  DEFAULT_AGENT_RUNTIME_CONFIG,
  normalizeAgentRuntimeConfig,
} from '../../shared/services/storage/local-storage-repository';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { switchDiagramTypeThunk } from '../../app/store/workspaceSlice';
import { validateDiagram } from '../../shared/services/validation/validateDiagram';
import {
  ConfigDialog,
  getConfigDialogForGenerator,
} from './generator-dialog-config';
import { getWorkspaceContext } from '../../shared/utils/workspaceContext';
import type { GeneratorType } from '../../app/shell/workspace-types';
import i18n from '../../shared/i18n';
import {
  buildAllWebAppVersions,
  collectVariantProfiles,
  type VersionProfile,
  type WebAppVersion,
  type WebAppVersionMode,
} from '../../shared/utils/buildWebAppVersions';
import { useKgToUmlConversion, type KgConversionTarget } from '../import/useKgToUmlConversion';
import { useKgPreflight } from '../import/useKgPreflight';
import type { KgIssue } from '../import/useKgPreflight';
import * as kgFocus from '../editors/kg/kgFocus';
import { useExportKgRdf } from '../export/useExportKgRdf';

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

function didValidationPass(result: any): boolean {
  if (!result || !result.isValid) {
    return false;
  }

  const hasErrors = Array.isArray(result.errors) && result.errors.length > 0;
  const hasInvalidConstraints = Array.isArray(result.invalid_constraints) && result.invalid_constraints.length > 0;
  return !hasErrors && !hasInvalidConstraints;
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
    label: i18n.t('generation.webApp.classDiagramLabel'),
    title: truncate(classDiagram?.title),
    exists: classDiagramExists,
    hasContent: classDiagramHasContent,
    required: true,
  };

  const guiDiagramInfo: WebAppChecklistDiagramInfo = {
    label: i18n.t('generation.webApp.guiDiagramLabel'),
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
    label: i18n.t('generation.webApp.agentDiagramsLabel'),
    title: agentDiagramCount > 0
      ? i18n.t('generation.webApp.agentDiagramsAvailable', { count: agentDiagramCount })
      : i18n.t('generation.webApp.noneAvailable'),
    exists: agentDiagramCount > 0,
    hasContent: agentDiagramCount > 0,
    required: false,
  };

  // canGenerate does NOT depend on agent diagrams -- they are optional and per-component
  const canGenerate = classDiagramExists && guiDiagramExists;

  // Distinct user profiles that have at least one page variant. Drives the
  // "which version(s) to generate" choice in the dialog. Empty ⇒ no variants
  // anywhere ⇒ unchanged single-app generation.
  const variantProfiles = collectVariantProfiles(guiModel);

  return {
    classDiagram: classDiagramInfo,
    guiDiagram: guiDiagramInfo,
    agentDiagram: agentDiagramInfo,
    canGenerate,
    variantProfiles,
    hasAnyVariant: variantProfiles.length > 0,
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

/**
 * Ask the live GUI editor to capture the active page's canvas into its snapshot
 * and persist the full model (incl. variant fields) to storage, then resolve.
 * Best-effort: if the editor never answers within the timeout, we resolve ok
 * anyway and proceed with whatever is already stored.
 */
function flushGuiForGeneration(timeoutMs = 8000): Promise<{ ok: boolean; error?: string }> {
  if (typeof window === 'undefined') return Promise.resolve({ ok: false });

  return new Promise((resolve) => {
    let done = false;
    const finish = (result: { ok: boolean; error?: string }) => {
      if (done) return;
      done = true;
      window.removeEventListener('wme:flush-gui-for-generation-done', onDone as EventListener);
      clearTimeout(timeoutId);
      resolve(result);
    };

    const onDone = (event: Event) => {
      const detail = (event as CustomEvent<{ ok?: boolean; error?: string }>).detail || {};
      finish({ ok: Boolean(detail.ok), error: detail.ok ? undefined : detail.error });
    };

    const timeoutId = window.setTimeout(
      () => {
        console.warn('[GUI flush] timed out before generation; proceeding with the last-saved GUI model');
        finish({ ok: true, error: 'flush timed out' });
      },
      timeoutMs,
    );
    window.addEventListener('wme:flush-gui-for-generation-done', onDone as EventListener);
    window.dispatchEvent(new CustomEvent('wme:flush-gui-for-generation'));
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
  /** Distinct profiles that have at least one page variant (empty ⇒ none). */
  variantProfiles: VersionProfile[];
  /** Convenience flag: variantProfiles.length > 0. */
  hasAnyVariant: boolean;
}

interface AgentModelVariantSnapshot {
  id: string;
  profileName: string;
  configurationId: string;
  configurationName: string;
  createdAt: string;
  model: unknown;
}

export interface AgentGenerationVariantOption {
  id: string;
  label: string;
  description: string;
  configurationId: string;
  model: Record<string, any>;
}

export type AgentGenerationMode = 'none' | 'personalization';

const readAgentGenerationVariants = (diagram: ProjectDiagram | undefined): AgentGenerationVariantOption[] => {
  const raw = (diagram?.config as Record<string, unknown> | undefined)?.personalizedVariants;
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is AgentModelVariantSnapshot => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }
      const variant = entry as Partial<AgentModelVariantSnapshot>;
      return (
        typeof variant.id === 'string' &&
        typeof variant.profileName === 'string' &&
        typeof variant.configurationId === 'string' &&
        typeof variant.configurationName === 'string' &&
        typeof variant.createdAt === 'string' &&
        isUMLModel(variant.model) &&
        variant.model.type === UMLDiagramType.AgentDiagram
      );
    })
    .map((variant) => ({
      id: variant.id,
      label: `${variant.profileName} (${variant.configurationName})`,
      description: `Created ${new Date(variant.createdAt).toLocaleString()}`,
      configurationId: variant.configurationId,
      model: variant.model as Record<string, any>,
    }));
};

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

  // ── Supabase ─────────────────────────────────────────────────────────────
  /** Class name that maps to auth.users (default: "User"). Empty = no auth. */
  supabaseUserRoot: string;

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
  /** Personalized variants available in the active Agent tab. */
  agentVariantOptions: AgentGenerationVariantOption[];
  /** Selected personalized variant to generate. Empty means base/original model. */
  selectedAgentVariantId: string;
  /** Generation strategy for agent variants. */
  agentGenerationMode: AgentGenerationMode;

  // ── Qiskit ───────────────────────────────────────────────────────────────
  qiskitBackend: QiskitConfig['backend'];
  qiskitShots: number;

  // ── Field change handlers ────────────────────────────────────────────────
  onDjangoProjectNameChange: (v: string) => void;
  onDjangoAppNameChange: (v: string) => void;
  onUseDockerChange: (v: boolean) => void;
  onSqlDialectChange: (v: SQLConfig['dialect']) => void;
  onSupabaseUserRootChange: (v: string) => void;
  onSqlAlchemyDbmsChange: (v: SQLAlchemyConfig['dbms']) => void;
  onJsonSchemaModeChange: (v: JSONSchemaConfig['mode']) => void;
  onSourceLanguageChange: (v: string) => void;
  onPendingAgentLanguageChange: (v: string) => void;
  onSelectedAgentLanguagesChange: (v: string[]) => void;
  onQiskitBackendChange: (v: QiskitConfig['backend']) => void;
  onQiskitShotsChange: (v: number) => void;
  onAgentModeChange: (v: 'original' | 'configuration' | 'personalization') => void;
  onStoredAgentConfigToggle: (id: string) => void;
  onSelectedAgentVariantIdChange: (v: string) => void;
  onAgentGenerationModeChange: (v: AgentGenerationMode) => void;

  // ── Web App checklist ──────────────────────────────────────────────────
  /** Pre-generation checklist info for the web_app generator. */
  webAppChecklist: WebAppChecklistInfo | null;
  /** Which version(s) to generate when the GUI has page variants. */
  webAppVersionMode: WebAppVersionMode;
  /** Selected profile id when webAppVersionMode === 'profile'. */
  webAppSelectedProfileId: string;
  onWebAppVersionModeChange: (v: WebAppVersionMode) => void;
  onWebAppSelectedProfileIdChange: (v: string) => void;

  // ── Execution callbacks (one per generator) ──────────────────────────────
  /** Validate inputs, call the backend, and close the dialog on success. */
  onDjangoGenerate: () => void;
  onDjangoDeploy: () => void;
  onSqlGenerate: () => void;
  onSupabaseGenerate: () => void;
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
  handleQualityCheck: () => Promise<QualityCheckResult>;
  /** Props bag to spread onto <GeneratorConfigDialogs /> */
  configState: GeneratorConfigState;
  /** Whether the app is running against localhost */
  isLocalEnvironment: boolean;
  /** Props bag to spread onto <KgRefineModal /> */
  kgRefineModalProps: {
    open: boolean;
    onClose: () => void;
    onFixInKg: (issue: KgIssue) => void;
    onFocusNodes: (nodeIds: string[]) => void;
    convertTarget?: KgConversionTarget;
    onConvert?: (kgSignature: string) => void;
    initialTab?: 'static' | 'consistency' | 'llm';
  };
  /** Props bag to spread onto <KgExportOptionsDialog />. Opens when the user
   *  picks "Export with options…" in the Generate menu on a KG diagram. */
  kgExportOptionsModalProps: {
    open: boolean;
    onClose: () => void;
    onConfirm: (fmt: 'owl' | 'ttl', vocab: 'owl' | 'shacl' | 'both') => void;
  };
  /** Props bag for <KgConsistencyConfirmModal />. Opens before a KG →
   *  ClassDiagram / ObjectDiagram conversion if the consistency check
   *  returned at least one issue. */
  kgConsistencyConfirmModalProps: {
    open: boolean;
    report: import('../../shared/types/project').ConsistencyReport | null;
    onOpenRefine: () => void;
    onProceed: () => void;
    onCancel: () => void;
  };
}

export function useGeneratorExecution(editor: ApollonEditor | undefined): UseGeneratorExecutionReturn {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { currentProject } = useProject();
  const generateCode = useGenerateCode();
  const deployLocally = useDeployLocally();
  const runKgConversion = useKgToUmlConversion();
  const { runPreflight: runKgPreflight } = useKgPreflight();
  // Open/close state for the unified Refine KG modal. The modal owns its
  // own per-tab state (description / api-key / decisions) and reports
  // completion via ``onClose``; the parent only needs to know when to
  // render it.
  const [kgRefineOpen, setKgRefineOpen] = useState(false);
  // When set, the refine modal is opened in "convert mode" so the user
  // can clean the KG before producing a Class/Object Diagram. The modal
  // calls ``onConvert`` with the kgSignature once the analyzer reports
  // zero remaining issues.
  const [kgConvertTarget, setKgConvertTarget] = useState<KgConversionTarget | null>(null);
  // KG → RDF export-options modal: opened by the ``kg_export_with_options``
  // generator entry; lets the user pick syntax + constraint vocabulary.
  const [kgExportOptionsOpen, setKgExportOptionsOpen] = useState(false);
  // Pre-conversion consistency gate: when /check-kg-consistency returns
  // non-zero issues, this state opens KgConsistencyConfirmModal and stores
  // a resolver that the modal's buttons call back through.
  const [kgConsistencyGate, setKgConsistencyGate] = useState<{
    open: boolean;
    report: import('../../shared/types/project').ConsistencyReport | null;
    resolve: ((d: 'proceed' | 'cancel') => void) | null;
  }>({ open: false, report: null, resolve: null });
  // When the user picks "Open Refine to fix" from the gate, we also open
  // the Refine modal on the Consistency tab. This flag carries that intent
  // through to kgRefineModalProps.initialTab.
  const [kgRefineInitialTab, setKgRefineInitialTab] = useState<
    'static' | 'consistency' | 'llm' | undefined
  >(undefined);

  const onConsistencyIssues = useCallback(
    (report: import('../../shared/types/project').ConsistencyReport): Promise<'proceed' | 'cancel'> => {
      return new Promise((resolve) => {
        setKgConsistencyGate({ open: true, report, resolve });
      });
    },
    [],
  );

  const runKgWithPreflight = useCallback(
    async (target: KgConversionTarget): Promise<void> => {
      const report = await runKgPreflight(target);
      if (!report) return;
      // Zero-friction path: no preflight issues → still run the
      // OWL/SHACL consistency gate, then convert.
      if (report.issueCount === 0) {
        await runKgConversion(target, {
          kgSignature: report.kgSignature,
          onConsistencyIssues,
        });
        return;
      }
      // Issues present → open the Refine KG modal in convert mode so the
      // user can clean the KG and then click Convert. The modal handles
      // its own analyzer calls and decisions; we only need to track the
      // target so we can dispatch the conversion when the user confirms.
      setKgConvertTarget(target);
    },
    [runKgPreflight, runKgConversion, onConsistencyIssues],
  );
  const exportKgRdf = useExportKgRdf();

  const { isQuantumContext, isGuiContext, isObjectContext, isUserContext, isNNContext, isKgContext } =
    getWorkspaceContext(location.pathname, currentProject?.currentDiagramType);

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
  const activeDiagramTitle = activeDiagram?.title || currentProject?.name || t('generation.defaultDiagramTitle');

  // ── Generator config state ─────────────────────────────────────────────────

  const [isGenerating, setIsGenerating] = useState(false);
  const [configDialog, setConfigDialog] = useState<ConfigDialog>('none');

  const [djangoProjectName, setDjangoProjectName] = useState('');
  const [djangoAppName, setDjangoAppName] = useState('');
  const [useDocker, setUseDocker] = useState(false);
  const [sqlDialect, setSqlDialect] = useState<SQLConfig['dialect']>('sqlite');
  const [supabaseUserRoot, setSupabaseUserRoot] = useState<string>('User');
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
  const [agentVariantOptions, setAgentVariantOptions] = useState<AgentGenerationVariantOption[]>([]);
  const [selectedAgentVariantId, setSelectedAgentVariantId] = useState('');
  const [agentGenerationMode, setAgentGenerationMode] = useState<AgentGenerationMode>('none');
  // Web App version selection (only meaningful when the GUI has page variants).
  const [webAppVersionMode, setWebAppVersionMode] = useState<WebAppVersionMode>('all');
  const [webAppSelectedProfileId, setWebAppSelectedProfileId] = useState('');

  // ── Web App checklist (computed from current project) ─────────────────────
  const webAppChecklist = useMemo(
    () => buildWebAppChecklist(currentProject ?? undefined),
    [currentProject],
  );

  // Keep the selected profile valid: default to the first variant profile
  // whenever the current selection isn't among the available profiles.
  useEffect(() => {
    const profiles = webAppChecklist?.variantProfiles ?? [];
    if (profiles.length > 0 && !profiles.some((p) => p.profileId === webAppSelectedProfileId)) {
      setWebAppSelectedProfileId(profiles[0].profileId);
    }
  }, [webAppChecklist, webAppSelectedProfileId]);

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

      const activeAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
      const variants = readAgentGenerationVariants(activeAgentDiagram);
      setAgentVariantOptions(variants);

      const activeVariantId = (activeAgentDiagram?.config as Record<string, unknown> | undefined)?.activePersonalizedVariantId;
      if (typeof activeVariantId === 'string' && variants.some((variant) => variant.id === activeVariantId)) {
        setSelectedAgentVariantId(activeVariantId);
      } else {
        setSelectedAgentVariantId('');
      }
      setAgentGenerationMode('none');
    } catch (error) {
      console.error('Failed to load agent configurations:', error);
      setStoredAgentConfigurations([]);
      setStoredAgentMappings([]);
      setSelectedStoredAgentConfigIds([]);
      setAgentVariantOptions([]);
      setSelectedAgentVariantId('');
      setAgentGenerationMode('none');
    }
  }, [configDialog, currentProject]);

  // ── Core execution ─────────────────────────────────────────────────────────

  const ensureGuiForAssistantWebAppGeneration = useCallback(
    async (): Promise<GenerationResult | null> => {
      if (!currentProject) {
        return { ok: false, error: t('generation.toasts.createOrLoadProject') };
      }

      try {
        await dispatch(switchDiagramTypeThunk({ diagramType: 'GUINoCodeDiagram' })).unwrap();
      } catch {
        return { ok: false, error: t('generation.toasts.couldNotSwitchToGui') };
      }

      if (location.pathname !== '/') {
        navigate('/');
      }

      const ready = await waitForGuiEditorReady(12000);
      if (!ready) {
        return { ok: false, error: t('generation.toasts.guiEditorNotReady') };
      }

      const autoGenerateResult = await triggerAssistantGuiAutoGenerate(30000);
      if (!autoGenerateResult.ok) {
        return { ok: false, error: autoGenerateResult.error || t('generation.toasts.couldNotAutoGenerateGui') };
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
      return null;
    },
    [currentProject, dispatch, location.pathname, navigate, t],
  );

  const executeGenerator = useCallback(
    async (
      generatorType: GeneratorType,
      config?: unknown,
      options?: { autoGenerateGuiIfEmpty?: boolean; agentModelOverride?: UMLModel },
    ): Promise<GenerationResult> => {
      if (!currentProject) {
        toast.error(t('generation.toasts.createOrLoadProject'));
        return { ok: false, error: 'Create or load a project before generating code.' };
      }

      try {
        setIsGenerating(true);

        if (generatorType === 'kg_to_class' || generatorType === 'kg_to_object') {
          if (!isKgContext) {
            toast.error('Open a Knowledge Graph diagram before converting to UML.');
            return { ok: false, error: 'Open a Knowledge Graph diagram before converting to UML.' };
          }
          await runKgWithPreflight(generatorType);
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          getPostHog()?.capture('generator_used', {
            generator_type: generatorType,
            diagram_type: currentProject.currentDiagramType,
            ...getModelMetrics(currentProject),
          });
          return { ok: true };
        }

        if (generatorType === 'kg_refine') {
          if (!isKgContext) {
            toast.error('Open a Knowledge Graph diagram before refining.');
            return { ok: false, error: 'Open a Knowledge Graph diagram before refining.' };
          }
          setKgRefineOpen(true);
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          getPostHog()?.capture('generator_used', {
            generator_type: generatorType,
            diagram_type: currentProject.currentDiagramType,
            ...getModelMetrics(currentProject),
          });
          return { ok: true };
        }

        if (generatorType === 'kg_export_owl' || generatorType === 'kg_export_ttl') {
          if (!isKgContext) {
            toast.error('Open a Knowledge Graph diagram before exporting.');
            return { ok: false, error: 'Open a Knowledge Graph diagram before exporting.' };
          }
          const fmt = generatorType === 'kg_export_owl' ? 'owl' : 'ttl';
          await exportKgRdf(fmt);
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          getPostHog()?.capture('generator_used', {
            generator_type: generatorType,
            diagram_type: currentProject.currentDiagramType,
            ...getModelMetrics(currentProject),
          });
          return { ok: true };
        }

        if (generatorType === 'kg_export_with_options') {
          if (!isKgContext) {
            toast.error('Open a Knowledge Graph diagram before exporting.');
            return { ok: false, error: 'Open a Knowledge Graph diagram before exporting.' };
          }
          setKgExportOptionsOpen(true);
          return { ok: true };
        }

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
              toast.error(t('generation.toasts.guiDiagramEmpty'));
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
            toast.error(t('generation.toasts.openQuantumEditor'));
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

        if (generatorType === 'pytorch' || generatorType === 'tensorflow') {
          if (!isNNContext) {
            toast.error(t('generation.toasts.openNnEditor'));
            return { ok: false, error: 'Open the NN Diagram editor before generating neural network code.' };
          }
          const nnResult = await generateCode(editor, generatorType, activeDiagramTitle, config as any);
          if (!mountedRef.current) return { ok: false, error: 'Component unmounted' };
          if (nnResult.ok) {
            getPostHog()?.capture('generator_used', {
              generator_type: generatorType,
              diagram_type: currentProject.currentDiagramType,
              ...getModelMetrics(currentProject),
            });
          }
          return nnResult;
        }

        if (isQuantumContext || isGuiContext) {
          toast.error(t('generation.toasts.switchToUmlDiagram'));
          return { ok: false, error: 'Switch to a UML diagram to use this generator.' };
        }

        if (!editor) {
          toast.error(t('generation.toasts.noUmlEditor'));
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
          case 'supabase':
            result = await generateCode(editor, 'supabase', activeDiagramTitle, config as SupabaseConfig);
            break;
          case 'sqlalchemy':
            result = await generateCode(editor, 'sqlalchemy', activeDiagramTitle, config as SQLAlchemyConfig);
            break;
          case 'jsonschema':
            result = await generateCode(editor, 'jsonschema', activeDiagramTitle, config as JSONSchemaConfig);
            break;
          case 'agent':
            result = await generateCode(
              editor,
              'agent',
              activeDiagramTitle,
              config as AgentConfig,
              undefined,
              options?.agentModelOverride,
            );
            break;
          case 'test_case':
            result = await generateCode(editor, 'test_case', activeDiagramTitle);
            break;
          case 'jsonobject': {
            if (!isObjectContext && !isUserContext) {
              toast.error(t('generation.toasts.switchToObjectOrUserDiagram'));
              return { ok: false, error: 'Switch to an Object Diagram or User Diagram to use the JSON Object generator.' };
            }
            // Object diagrams need their referenced ClassDiagram so the backend can build
            // the domain model. User diagrams use a preset reference domain server-side
            // (`user_reference_domain_model`) and don't need one passed from the client.
            let referenceDiagramData: Record<string, any> | undefined;
            if (isObjectContext && currentProject && activeDiagram) {
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
        const errorMessage = t('generation.toasts.generationFailed', {
          error: error instanceof Error ? error.message : t('generation.toasts.unknownError'),
        });
        toast.error(errorMessage);
        return { ok: false, error: errorMessage };
      } finally {
        setIsGenerating(false);
      }
    },
    [
      currentProject, editor, generateCode, activeDiagram, activeDiagramTitle,
      isQuantumContext, isGuiContext, isObjectContext, isUserContext, isNNContext, isKgContext,
      runKgConversion, runKgWithPreflight, exportKgRdf,
      ensureGuiForAssistantWebAppGeneration, t,
    ],
  );

  // ── Public handlers ────────────────────────────────────────────────────────

  const handleGenerateRequest = useCallback(
    async (generatorType: GeneratorType, menuConfig?: Record<string, any>) => {
      if (!currentProject) {
        toast.error(t('generation.toasts.createOrLoadProject'));
        return;
      }
      const requiredDialog = getConfigDialogForGenerator(generatorType);
      if (requiredDialog !== 'none') {
        setConfigDialog(requiredDialog);
        return;
      }
      await executeGenerator(generatorType, menuConfig);
    },
    [currentProject, executeGenerator, t],
  );

  const handleAssistantGenerate = useCallback(
    async (generatorType: GeneratorType, config?: unknown): Promise<GenerationResult> =>
      executeGenerator(generatorType, config, { autoGenerateGuiIfEmpty: generatorType === 'web_app' }),
    [executeGenerator],
  );

  const handleQualityCheck = useCallback(async (): Promise<QualityCheckResult> => {
    if (!currentProject) {
      toast.error(t('generation.toasts.createOrLoadProjectValidate'));
      return { executed: false, passed: false };
    }

    if (isQuantumContext || isGuiContext || currentProject.currentDiagramType === 'QuantumCircuitDiagram') {
      toast.error(t('generation.toasts.comingSoon'));
      return { executed: false, passed: false };
    }

    if (isKgContext) {
      // Quality Check on a Knowledge Graph diagram opens the unified Refine
      // KG modal (static analysis / consistency / LLM-assisted tabs) rather
      // than the generic diagram validator. The modal reports its own results,
      // so no verdict is available synchronously here.
      await executeGenerator('kg_refine');
      return { executed: false, passed: false };
    }

    try {
      if (activeDiagram?.model && !isUMLModel(activeDiagram.model)) {
        const result = await validateDiagram(null, activeDiagramTitle, activeDiagram.model);
        return { executed: true, passed: didValidationPass(result) };
      }

      if (editor) {
        const result = await validateDiagram(editor, activeDiagramTitle);
        return { executed: true, passed: didValidationPass(result) };
      }

      toast.error(t('generation.toasts.noDiagramToValidate'));
      return { executed: false, passed: false };
    } catch (error) {
      toast.error(t('generation.toasts.qualityCheckFailed', {
        error: error instanceof Error ? error.message : t('generation.toasts.unknownError'),
      }));
      return { executed: true, passed: false };
    }
  }, [currentProject, editor, isQuantumContext, isGuiContext, isKgContext, executeGenerator, activeDiagram, activeDiagramTitle, t]);

  // ── Config-dialog handlers ─────────────────────────────────────────────────

  const handleDjangoGenerate = useCallback(async () => {
    if (!djangoProjectName || !djangoAppName) {
      toast.error(t('generation.toasts.namesRequired'));
      return;
    }
    if (djangoProjectName === djangoAppName) {
      toast.error(t('generation.toasts.namesMustDiffer'));
      return;
    }
    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error(t('generation.toasts.namesInvalid'));
      return;
    }
    await executeGenerator('django', {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);
    setConfigDialog('none');
  }, [djangoProjectName, djangoAppName, useDocker, executeGenerator, t]);

  const handleDjangoDeploy = useCallback(async () => {
    if (!editor || !currentProject) {
      toast.error(t('generation.toasts.openUmlBeforeDeploy'));
      return;
    }
    if (!djangoProjectName || !djangoAppName) {
      toast.error(t('generation.toasts.namesRequired'));
      return;
    }
    if (djangoProjectName === djangoAppName) {
      toast.error(t('generation.toasts.namesMustDiffer'));
      return;
    }
    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error(t('generation.toasts.namesInvalid'));
      return;
    }
    await deployLocally(editor, 'django', activeDiagramTitle, {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);
  }, [editor, currentProject, djangoProjectName, djangoAppName, useDocker, deployLocally, activeDiagramTitle, t]);

  const handleSqlGenerate = useCallback(async () => {
    await executeGenerator('sql', { dialect: sqlDialect } as SQLConfig);
    setConfigDialog('none');
  }, [sqlDialect, executeGenerator]);

  const handleSupabaseGenerate = useCallback(async () => {
    await executeGenerator('supabase', { user_root: supabaseUserRoot.trim() } as SupabaseConfig);
    setConfigDialog('none');
  }, [supabaseUserRoot, executeGenerator]);

  const handleSqlAlchemyGenerate = useCallback(async () => {
    await executeGenerator('sqlalchemy', { dbms: sqlAlchemyDbms } as SQLAlchemyConfig);
    setConfigDialog('none');
  }, [sqlAlchemyDbms, executeGenerator]);

  const handleJsonSchemaGenerate = useCallback(async () => {
    await executeGenerator('jsonschema', { mode: jsonSchemaMode } as JSONSchemaConfig);
    setConfigDialog('none');
  }, [jsonSchemaMode, executeGenerator]);

  const handleAgentGenerate = useCallback(async () => {
    // Read agent runtime config from the active AgentDiagram's `config` block —
    // single source of truth. Falls back to hardcoded defaults when no agent
    // diagram exists in the project (edge case: generator triggered without an
    // agent diagram present).
    const activeAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
    const diagramConfig = (activeAgentDiagram?.config ?? null) as Record<string, any> | null;
    const llmBlock = diagramConfig && typeof diagramConfig.llm === 'object' && diagramConfig.llm !== null
      ? (diagramConfig.llm as Record<string, any>)
      : null;
    const agentConfig = diagramConfig
      ? normalizeAgentRuntimeConfig({
        agentPlatform: typeof diagramConfig.agentPlatform === 'string' ? diagramConfig.agentPlatform : undefined,
        agentPlatformUseStreamlit: typeof diagramConfig.agentPlatformUseStreamlit === 'boolean' ? diagramConfig.agentPlatformUseStreamlit : undefined,
        intentRecognitionTechnology: diagramConfig.intentRecognitionTechnology,
        agentLlmProvider: llmBlock?.provider,
        agentLlmModel: typeof llmBlock?.model === 'string' ? llmBlock.model : undefined,
        agentCustomLlmModel: undefined,
        agentLlmName:
          typeof diagramConfig.agentLlmName === 'string'
            ? diagramConfig.agentLlmName
            : (typeof llmBlock?.name === 'string' ? llmBlock.name : undefined),
      })
      : { ...DEFAULT_AGENT_RUNTIME_CONFIG };
    const resolvedOpenAiModel =
      agentConfig.agentLlmModel === 'other' ? agentConfig.agentCustomLlmModel.trim() : agentConfig.agentLlmModel;
    const defaultLlmNameFromDiagram =
      diagramConfig && typeof diagramConfig.default_llm_name === 'string' && diagramConfig.default_llm_name
        ? diagramConfig.default_llm_name
        : undefined;
    const resolvedAgentPlatform =
      agentConfig.agentPlatform === 'websocket' && agentConfig.agentPlatformUseStreamlit
        ? 'streamlit'
        : agentConfig.agentPlatform;
    const systemConfig: AgentConfig = {
      agentPlatform: resolvedAgentPlatform,
      intentRecognitionTechnology: agentConfig.intentRecognitionTechnology,
      ...(defaultLlmNameFromDiagram ? { default_llm_name: defaultLlmNameFromDiagram } : {}),
      ...(agentConfig.agentLlmName
        ? { llm: { name: agentConfig.agentLlmName } }
        : agentConfig.agentLlmProvider
          ? {
              llm: {
                provider: agentConfig.agentLlmProvider,
                ...(resolvedOpenAiModel ? { model: resolvedOpenAiModel } : {}),
              },
            }
          : {}),
    };

    let baseConfig: AgentConfig = {
      ...systemConfig,
    };

    if (selectedAgentLanguages.length > 0) {
      baseConfig = {
        ...baseConfig,
        languages: { source: sourceLanguage, target: selectedAgentLanguages },
      };
    }

    let finalConfig: AgentConfig = baseConfig;
    let agentModelOverride: UMLModel | undefined;

    if (agentGenerationMode === 'personalization') {
      const localProfiles = LocalStorageRepository.getUserProfiles();
      const projectProfiles = (currentProject?.diagrams?.UserDiagram ?? [])
        .filter((diagram) => isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram)
        .map((diagram) => ({ id: diagram.id, name: diagram.title, model: diagram.model as Record<string, any> }));

      const profileByName = new Map<string, { id: string; name: string; model: Record<string, any> }>();
      for (const profile of localProfiles) {
        if (profile.model && isUMLModel(profile.model) && profile.model.type === UMLDiagramType.UserDiagram) {
          profileByName.set(profile.name, { id: profile.id, name: profile.name, model: profile.model });
        }
      }
      for (const profile of projectProfiles) {
        profileByName.set(profile.name, profile);
      }

      const configs = LocalStorageRepository.getAgentConfigurations();
      const configById = new Map(configs.map((entry) => [entry.id, entry]));
      const variantByConfigurationId = new Map(agentVariantOptions.map((variant) => [variant.configurationId, variant]));

      const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
      const personalizationMapping = mappings
        .map((entry) => {
          const profile = profileByName.get(entry.userProfileName) || null;
          const config = configById.get(entry.agentConfigurationId) || null;
          const variantModel = variantByConfigurationId.get(entry.agentConfigurationId)?.model;
          const fallbackAgentModel = config?.personalizedAgentModel || config?.baseAgentModel || null;
          const agentModel = variantModel || fallbackAgentModel;

          if (!profile || !agentModel || !config) {
            return null;
          }

          return {
            name: profile.name,
            configuration: structuredClone(config.config),
            user_profile: structuredClone(profile.model),
            // Normalize to the canonical nested transition shape before sending.
            // Variant/config snapshots can bypass the editor (e.g. imported
            // projects) and still carry the legacy flat shape, which the backend
            // collapses to when_no_intent_matched. normalizeAgentModel is pure
            // and idempotent and returns a fresh clone.
            agent_model: normalizeAgentModel(agentModel as UMLModel) as Record<string, any>,
          };
        })
        .filter((entry): entry is {
          name: string;
          configuration: Record<string, any>;
          user_profile: Record<string, any>;
          agent_model: Record<string, any>;
        } => Boolean(entry));

      if (personalizationMapping.length === 0) {
        toast.error(t('generation.toasts.noValidPersonalizationMappings'));
        return;
      }

      finalConfig = {
        ...baseConfig,
        personalizationMapping,
      };

      // Personalization codegen rebuilds every variant on top of the model the
      // backend receives. Send the un-personalized base from localStorage so
      // generation is deterministic — without this, whichever variant is
      // active in the editor would silently become the new "base" each variant
      // is layered onto.
      const baseAgentDiagramId = activeAgentDiagram?.id;
      const storedBase = baseAgentDiagramId
        ? LocalStorageRepository.getAgentBaseModel(baseAgentDiagramId)
        : null;
      if (storedBase && isUMLModel(storedBase) && storedBase.type === UMLDiagramType.AgentDiagram) {
        agentModelOverride = storedBase;
      } else {
        // No stored base resolved — generation falls back to the active editor
        // model, which may be a personalized variant rather than the
        // un-personalized base. Surface it instead of silently shipping the
        // wrong base.
        console.warn(
          '[generation] Personalization mode could not resolve a stored agent base model; ' +
            'falling back to the active diagram. Save & Apply at least once to capture the base.',
        );
      }
    }

    const shouldSendConfig = Object.keys(finalConfig).length > 0;
    await executeGenerator(
      'agent',
      shouldSendConfig ? finalConfig : undefined,
      agentModelOverride ? { agentModelOverride } : undefined,
    );
    setConfigDialog('none');
  }, [
    currentProject,
    selectedAgentLanguages,
    sourceLanguage,
    executeGenerator,
    agentGenerationMode,
    agentVariantOptions,
    t,
  ]);

  const handleQiskitGenerate = useCallback(async () => {
    await executeGenerator('qiskit', {
      backend: qiskitBackend,
      shots: Math.max(1, qiskitShots || 1024),
    } as QiskitConfig);
    setConfigDialog('none');
  }, [qiskitBackend, qiskitShots, executeGenerator]);

  const handleWebAppGenerate = useCallback(async () => {
    // Flush the live GUI canvas (active page) into its snapshot and persist to
    // storage first, so the version builder below reads the freshest content.
    if (typeof window !== 'undefined' && (window as any).__WME_GUI_EDITOR_READY__) {
      await flushGuiForGeneration();
    }

    // Re-read the freshest project post-flush and decide whether to branch into
    // per-version generation. When the GUI has no page variants, versions is []
    // and we fall through to the unchanged single-app path (config undefined).
    const freshProject = currentProject?.id
      ? (ProjectStorageRepository.loadProject(currentProject.id) ?? currentProject)
      : currentProject;
    const guiModel = freshProject
      ? (getActiveDiagram(freshProject, 'GUINoCodeDiagram')?.model as GrapesJSProjectData | undefined)
      : undefined;

    let config: { webAppVersions?: WebAppVersion[] } | undefined;
    if (guiModel) {
      const versions = buildAllWebAppVersions(
        guiModel,
        webAppVersionMode,
        webAppSelectedProfileId || null,
      );
      if (versions.length > 0) config = { webAppVersions: versions };
    }

    await executeGenerator('web_app', config);
    setConfigDialog('none');
  }, [executeGenerator, currentProject, webAppVersionMode, webAppSelectedProfileId]);

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
    supabaseUserRoot,
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
    agentVariantOptions,
    selectedAgentVariantId,
    agentGenerationMode,
    webAppChecklist,
    webAppVersionMode,
    webAppSelectedProfileId,
    onWebAppVersionModeChange: setWebAppVersionMode,
    onWebAppSelectedProfileIdChange: setWebAppSelectedProfileId,
    onDjangoProjectNameChange: setDjangoProjectName,
    onDjangoAppNameChange: setDjangoAppName,
    onUseDockerChange: setUseDocker,
    onSqlDialectChange: setSqlDialect,
    onSupabaseUserRootChange: setSupabaseUserRoot,
    onSqlAlchemyDbmsChange: setSqlAlchemyDbms,
    onJsonSchemaModeChange: setJsonSchemaMode,
    onSourceLanguageChange: setSourceLanguage,
    onPendingAgentLanguageChange: setPendingAgentLanguage,
    onSelectedAgentLanguagesChange: setSelectedAgentLanguages,
    onQiskitBackendChange: setQiskitBackend,
    onQiskitShotsChange: setQiskitShots,
    onAgentModeChange: setAgentMode,
    onStoredAgentConfigToggle: handleStoredAgentConfigToggle,
    onSelectedAgentVariantIdChange: setSelectedAgentVariantId,
    onAgentGenerationModeChange: setAgentGenerationMode,
    onDjangoGenerate: () => { handleDjangoGenerate().catch(notifyError(t('generation.context.djangoGeneration'))); },
    onDjangoDeploy: () => { handleDjangoDeploy().catch(notifyError(t('generation.context.djangoDeployment'))); },
    onSqlGenerate: () => { handleSqlGenerate().catch(notifyError(t('generation.context.sqlGeneration'))); },
    onSupabaseGenerate: () => { handleSupabaseGenerate().catch(notifyError(t('generation.context.supabaseGeneration'))); },
    onSqlAlchemyGenerate: () => { handleSqlAlchemyGenerate().catch(notifyError(t('generation.context.sqlAlchemyGeneration'))); },
    onJsonSchemaGenerate: () => { handleJsonSchemaGenerate().catch(notifyError(t('generation.context.jsonSchemaGeneration'))); },
    onAgentGenerate: () => { handleAgentGenerate().catch(notifyError(t('generation.context.agentGeneration'))); },
    onQiskitGenerate: () => { handleQiskitGenerate().catch(notifyError(t('generation.context.qiskitGeneration'))); },
    onWebAppGenerate: () => { handleWebAppGenerate().catch(notifyError(t('generation.context.webAppGeneration'))); },
  };

  // Props for the unified Refine KG modal. The modal handles the full
  // tabbed (Automatic / AI) flow internally; it only needs to know when
  // it's open, how to close itself, a "Fix in KG" handler that focuses
  // affected nodes in the canvas, and — when opened from the Convert
  // flow — a ``convertTarget``/``onConvert`` callback so it can trigger
  // the conversion once the KG is clean.
  const kgRefineModalProps = {
    open: kgRefineOpen || kgConvertTarget !== null,
    onClose: () => {
      setKgRefineOpen(false);
      setKgConvertTarget(null);
      setKgRefineInitialTab(undefined);
    },
    onFixInKg: (issue: KgIssue) => {
      const ids = issue?.affectedNodeIds ?? [];
      if (ids.length > 0) {
        kgFocus.focus(ids, { maxNeighbors: 15 });
      }
    },
    onFocusNodes: (nodeIds: string[]) => {
      if (nodeIds.length > 0) {
        kgFocus.focus(nodeIds, { maxNeighbors: 15 });
      }
    },
    convertTarget: kgConvertTarget ?? undefined,
    onConvert: (kgSignature: string) => {
      const target = kgConvertTarget;
      if (!target) return;
      void runKgConversion(target, { kgSignature, onConsistencyIssues });
    },
    initialTab: kgRefineInitialTab,
  };

  // Pre-conversion consistency confirmation modal. Wired so that "Proceed
  // anyway" re-runs the conversion with the gate suppressed (we don't ask
  // a second time).
  const kgConsistencyConfirmModalProps = {
    open: kgConsistencyGate.open,
    report: kgConsistencyGate.report,
    onOpenRefine: () => {
      // Close the gate (resolve as cancel — we're routing the user to the
      // Refine modal instead of running the conversion). Open the Refine
      // modal on the Consistency tab.
      kgConsistencyGate.resolve?.('cancel');
      setKgConsistencyGate({ open: false, report: null, resolve: null });
      setKgRefineInitialTab('consistency');
      setKgRefineOpen(true);
    },
    onProceed: () => {
      kgConsistencyGate.resolve?.('proceed');
      setKgConsistencyGate({ open: false, report: null, resolve: null });
    },
    onCancel: () => {
      kgConsistencyGate.resolve?.('cancel');
      setKgConsistencyGate({ open: false, report: null, resolve: null });
    },
  };

  // Props for the KG export-options modal.
  const kgExportOptionsModalProps = {
    open: kgExportOptionsOpen,
    onClose: () => setKgExportOptionsOpen(false),
    onConfirm: (fmt: 'owl' | 'ttl', vocab: 'owl' | 'shacl' | 'both') => {
      exportKgRdf(fmt, vocab).catch((err) =>
        toast.error(err instanceof Error ? err.message : 'KG export failed.'),
      );
    },
  };

  return {
    isGenerating,
    handleGenerateRequest,
    handleAssistantGenerate,
    handleQualityCheck,
    configState,
    isLocalEnvironment,
    kgRefineModalProps,
    kgExportOptionsModalProps,
    kgConsistencyConfirmModalProps,
  };
}
