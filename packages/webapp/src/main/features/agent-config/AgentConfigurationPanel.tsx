import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UMLDiagramType, UMLModel, diagramBridge } from '@besser/wme';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { apiClient, ApiError } from '../../shared/api/api-client';
import { useAppDispatch } from '../../app/store/hooks';
import { bumpEditorRevision, refreshProjectStateThunk, updateDiagramModelThunk } from '../../app/store/workspaceSlice';
import {
  LocalStorageRepository,
  AgentRuntimeConfig,
  DEFAULT_AGENT_RUNTIME_CONFIG,
} from '../../shared/services/storage/local-storage-repository';
import type {
  StoredAgentConfiguration,
  StoredUserProfile,
} from '../../shared/services/storage/local-storage-types';
import type {
  AgentConfigurationPayload,
  AgentLLMConfiguration,
  AgentLLMNameConfiguration,
  AgentLLMProvider,
  AgentLanguageComplexity,
  AgentSentenceLength,
  IntentRecognitionTechnology,
  InterfaceStyleSetting,
  VoiceStyleSetting,
} from '../../shared/types/agent-config';
import { isUMLModel, getActiveDiagram } from '../../shared/types/project';
import type { ProjectDiagram } from '../../shared/types/project';
import { useProject } from '../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';
import { useGitHubAuth } from '../github/hooks/useGitHubAuth';
import {
  type AgentModelVariantSnapshot,
  getActiveAgentVariantId,
  readAgentVariants,
  removeConfigurationVariantsFromProject,
  upsertVariantForProfile,
} from '../../shared/services/agent-variants/agent-variants-service';
import { AgentConfigYamlEditor } from './AgentConfigYamlEditor';

type AgentTransformationConfig = Partial<AgentConfigurationPayload> & { userProfileModel?: UMLModel };

type MappingMatchedRule = {
  id?: string;
  label?: string;
  summary?: string;
  priority?: number;
  evidence?: string[];
};

type MappingRecommendationSignals = {
  age: number | null;
  detectedLanguages: string[];
  isMultilingual: boolean;
};

const DEFAULT_CONFIG_NAME = 'Default Agent Configuration';

// Feature flag — hides agent configuration fields whose runtime support
// isn't fully wired up yet (voice gender/speed, avatar upload, response
// timing). Flip to ``true`` to re-expose them in the UI; the underlying
// state + serialization are intentionally kept so turning this back on is
// a one-line change.
const SHOW_WIP_AGENT_CONFIG_FIELDS = false;

const baseTextModality = ['text'];
const speechEnabledModality = ['text', 'speech'];

const defaultInterfaceStyle: InterfaceStyleSetting = {
  size: 16,
  font: 'sans',
  lineSpacing: 1.5,
  alignment: 'left',
  color: 'var(--apollon-primary-contrast)',
  contrast: 'medium',
};

const defaultVoiceStyle: VoiceStyleSetting = {
  gender: 'male',
  speed: 1,
};

const knownLLMModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'mistral-7b', 'falcon-40b', 'llama-3-8b', 'bloom-176b'];

const INTERFACE_SIZE_MIN = 10;
const INTERFACE_SIZE_MAX = 32;
const INTERFACE_LINE_SPACING_MIN = 1;
const INTERFACE_LINE_SPACING_MAX = 3;

type InterfaceColorOption = {
  value: string;
  label: string;
  swatch: string;
  description: string;
};

const interfaceColorOptions: InterfaceColorOption[] = [
  {
    value: 'var(--apollon-primary-contrast)',
    label: 'Default (theme)',
    swatch: 'var(--apollon-primary-contrast)',
    description: 'Follows the active theme — adapts to light or dark mode.',
  },
  {
    value: '#000000',
    label: 'Black — high contrast',
    swatch: '#000000',
    description: 'Maximum readability on light backgrounds (WCAG AAA).',
  },
  {
    value: '#1f2937',
    label: 'Dark slate — soft high contrast',
    swatch: '#1f2937',
    description: 'High contrast with reduced visual fatigue for long reading.',
  },
  {
    value: '#475569',
    label: 'Slate — medium contrast',
    swatch: '#475569',
    description: 'Lower contrast, gentler for low-vision users on bright screens.',
  },
  {
    value: '#1d4ed8',
    label: 'Blue — color-blind safe',
    swatch: '#1d4ed8',
    description: 'Distinguishable across protan and deutan color vision.',
  },
  {
    value: '#0f766e',
    label: 'Teal — color-blind safe',
    swatch: '#0f766e',
    description: 'Reads as a clear hue across all common color-vision types.',
  },
  {
    value: '#ffffff',
    label: 'White — for dark backgrounds',
    swatch: '#ffffff',
    description: 'Maximum contrast when the agent renders on a dark surface.',
  },
];

const createDefaultConfig = (): AgentConfigurationPayload => ({
  agentLanguage: 'original',
  inputModalities: [...baseTextModality],
  outputModalities: [...baseTextModality],
  agentPlatform: 'streamlit',
  responseTiming: 'instant',
  agentStyle: 'original',
  llm: {'provider': 'openai', 'model': 'gpt-5'},
  languageComplexity: 'original',
  sentenceLength: 'original',
  interfaceStyle: { ...defaultInterfaceStyle },
  voiceStyle: { ...defaultVoiceStyle },
  avatar: null,
  useAbbreviations: false,
  adaptContentToUserProfile: false,
  userProfileName: null,
  intentRecognitionTechnology: 'llm-based',
});

const normalizeAgentLanguage = (value?: string): string => {
  if (!value || value === 'none') {
    return 'original';
  }
  return value;
};

const normalizeModalityList = (value?: string[]): string[] =>
  Array.isArray(value) && value.includes('speech') ? [...speechEnabledModality] : [...baseTextModality];

const normalizeInterfaceStyle = (value?: InterfaceStyleSetting): InterfaceStyleSetting => ({
  ...defaultInterfaceStyle,
  ...(value || {}),
});

const normalizeVoiceStyle = (value?: VoiceStyleSetting): VoiceStyleSetting => ({
  ...defaultVoiceStyle,
  ...(value || {}),
});

const normalizeAgentConfiguration = (raw?: Partial<AgentConfigurationPayload> & Record<string, any>): AgentConfigurationPayload => {
  if (!raw) {
    return createDefaultConfig();
  }

  let llm: AgentLLMNameConfiguration | AgentLLMConfiguration | Record<string, never> = {};
  if (raw.llm && typeof raw.llm === 'object') {
    const llmRaw = raw.llm as Partial<AgentLLMNameConfiguration & AgentLLMConfiguration>;
    const name = typeof llmRaw.name === 'string' ? llmRaw.name : '';
    if (name) {
      llm = { name };
    } else {
      const provider = (llmRaw.provider ?? '') as AgentLLMProvider;
      const model = (llmRaw.model ?? '') as string;
      if (provider) {
        llm = { provider, model };
      }
    }
  }

  const intentRecognitionTechnology: IntentRecognitionTechnology = raw.intentRecognitionTechnology === 'llm-based'
    ? 'llm-based'
    : 'classical';

  const normalizedProfileName = typeof raw.userProfileName === 'string' ? raw.userProfileName.trim() : '';

  return {
    agentLanguage: normalizeAgentLanguage(raw.agentLanguage),
    inputModalities: normalizeModalityList(raw.inputModalities),
    outputModalities: normalizeModalityList(raw.outputModalities),
    agentPlatform: raw.agentPlatform || 'streamlit',
    responseTiming: raw.responseTiming || 'instant',
    agentStyle: raw.agentStyle || 'original',
    llm,
    languageComplexity: (raw.languageComplexity as AgentLanguageComplexity) || 'original',
    sentenceLength: (raw.sentenceLength as AgentSentenceLength) || 'original',
    interfaceStyle: normalizeInterfaceStyle(raw.interfaceStyle),
    voiceStyle: normalizeVoiceStyle(raw.voiceStyle),
    avatar: raw.avatar || null,
    useAbbreviations: raw.useAbbreviations ?? false,
    adaptContentToUserProfile: Boolean(raw.adaptContentToUserProfile),
    userProfileName: normalizedProfileName || null,
    intentRecognitionTechnology,
  };
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const areArraysEqual = (left: unknown[], right: unknown[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => deepEqual(value, right[index]));
};

const deepEqual = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true;
  }

  if (Array.isArray(left) && Array.isArray(right)) {
    return areArraysEqual(left, right);
  }

  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);

    if (leftKeys.length !== rightKeys.length) {
      return false;
    }

    return leftKeys.every((key) => deepEqual(left[key], right[key]));
  }

  return false;
};

const hasLLMConfiguration = (
  value: AgentConfigurationPayload['llm'],
): value is AgentLLMNameConfiguration | AgentLLMConfiguration =>
  ('name' in value && Boolean((value as AgentLLMNameConfiguration).name)) ||
  ('provider' in value && Boolean((value as AgentLLMConfiguration).provider));

const buildSparseGenerationConfig = (config: AgentConfigurationPayload): Partial<AgentConfigurationPayload> => {
  const defaults = createDefaultConfig();
  const normalizedConfig: AgentConfigurationPayload = {
    ...config,
    agentLanguage: normalizeAgentLanguage(config.agentLanguage),
    inputModalities: normalizeModalityList(config.inputModalities),
    outputModalities: normalizeModalityList(config.outputModalities),
    llm: hasLLMConfiguration(config.llm) ? config.llm : {},
  };

  const sparseConfig: Partial<AgentConfigurationPayload> = {};
  const configKeys = Object.keys(normalizedConfig) as Array<keyof AgentConfigurationPayload>;

  configKeys.forEach(<K extends keyof AgentConfigurationPayload>(key: K) => {
    if (!deepEqual(normalizedConfig[key], defaults[key])) {
      sparseConfig[key] = normalizedConfig[key];
    }
  });

  return sparseConfig;
};

const buildStructuredExport = (config: AgentConfigurationPayload) => ({
  presentation: {
    agentLanguage: config.agentLanguage,
    agentStyle: config.agentStyle,
    languageComplexity: config.languageComplexity,
    sentenceLength: config.sentenceLength,
    interfaceStyle: config.interfaceStyle,
    voiceStyle: config.voiceStyle,
    avatar: config.avatar,
    useAbbreviations: config.useAbbreviations,
  },
  modality: {
    inputModalities: config.inputModalities,
    outputModalities: config.outputModalities,
  },
  behavior: {
    responseTiming: config.responseTiming,
  },
  content: {
    adaptContentToUserProfile: config.adaptContentToUserProfile,
    userProfileName: config.userProfileName,
  },
  system: {
    agentPlatform: config.agentPlatform,
    intentRecognitionTechnology: config.intentRecognitionTechnology,
    llm: config.llm,
  },
});

const flattenStructuredConfig = (raw: any): Partial<AgentConfigurationPayload> => {
  if (!raw || typeof raw !== 'object') {
    return raw || {};
  }

  const structuredKeys = ['presentation', 'modality', 'behavior', 'content', 'system'];
  const isStructured = structuredKeys.some((key) => key in raw);
  if (!isStructured) {
    return raw;
  }

  const presentation = raw.presentation || {};
  const modality = raw.modality || {};
  const behavior = raw.behavior || {};
  const content = raw.content || {};
  const system = raw.system || {};

  return {
    agentLanguage: presentation.agentLanguage,
    agentStyle: presentation.agentStyle,
    languageComplexity: presentation.languageComplexity,
    sentenceLength: presentation.sentenceLength,
    interfaceStyle: presentation.interfaceStyle,
    voiceStyle: presentation.voiceStyle,
    avatar: presentation.avatar,
    useAbbreviations: presentation.useAbbreviations,
    inputModalities: modality.inputModalities,
    outputModalities: modality.outputModalities,
    responseTiming: behavior.responseTiming,
    adaptContentToUserProfile: content.adaptContentToUserProfile,
    userProfileName: content.userProfileName,
    agentPlatform: system.agentPlatform,
    intentRecognitionTechnology: system.intentRecognitionTechnology,
    llm: system.llm,
  };
};

const cloneModel = (model: UMLModel): UMLModel => JSON.parse(JSON.stringify(model)) as UMLModel;

type AgentLLMElementProvider = 'openai' | 'huggingface' | 'huggingface_api' | 'replicate';

type AgentLLMElement = {
  id: string;
  type: 'AgentLLM';
  name: string;
  owner: string | null;
  bounds: { x: number; y: number; width: number; height: number };
  provider: AgentLLMElementProvider;
  parameters: Record<string, unknown>;
  num_previous_messages: number;
  global_context: string | null;
};

const AGENT_LLM_PROVIDER_OPTIONS: Array<{ value: AgentLLMElementProvider; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'huggingface', label: 'Hugging Face' },
  { value: 'huggingface_api', label: 'Hugging Face API' },
  { value: 'replicate', label: 'Replicate' },
];

const generateAgentLLMId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isAgentLLMElement = (value: unknown): value is AgentLLMElement => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return candidate.type === 'AgentLLM';
};

const normalizeAgentLLMElement = (raw: any, fallbackId: string): AgentLLMElement => {
  const provider = (['openai', 'huggingface', 'huggingface_api', 'replicate'].includes(raw?.provider)
    ? raw.provider
    : 'openai') as AgentLLMElementProvider;
  const parameters =
    raw?.parameters && typeof raw.parameters === 'object' && !Array.isArray(raw.parameters)
      ? (raw.parameters as Record<string, unknown>)
      : {};
  const numPrev = typeof raw?.num_previous_messages === 'number' ? raw.num_previous_messages : 1;
  const globalContext =
    raw?.global_context == null ? '' : typeof raw.global_context === 'string' ? raw.global_context : String(raw.global_context);
  const bounds =
    raw?.bounds && typeof raw.bounds === 'object'
      ? {
          x: typeof raw.bounds.x === 'number' ? raw.bounds.x : 0,
          y: typeof raw.bounds.y === 'number' ? raw.bounds.y : 0,
          width: typeof raw.bounds.width === 'number' ? raw.bounds.width : 200,
          height: typeof raw.bounds.height === 'number' ? raw.bounds.height : 90,
        }
      : { x: 0, y: 0, width: 200, height: 90 };
  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : fallbackId,
    type: 'AgentLLM',
    name: typeof raw?.name === 'string' ? raw.name : '',
    owner: raw?.owner ?? null,
    bounds,
    provider,
    parameters,
    num_previous_messages: numPrev,
    global_context: globalContext,
  };
};

const formatAgentLLMParameters = (parameters: Record<string, unknown>): string => {
  try {
    return JSON.stringify(parameters ?? {}, null, 2);
  } catch {
    return '{}';
  }
};

// Element types that carry an `llm_name` reference to a registered AgentLLM.
const LLM_REFERENCING_TYPES = new Set<string>([
  'AgentRagElement',
  'AgentReasoningState',
  'AgentStateBody',
  'AgentStateFallbackBody',
]);

// Rewrite every llm_name === fromName to toName across all elements (and any
// nested children), so renaming or removing an AgentLLM propagates fully and
// never leaves a dangling reference behind.
const remapLlmReferences = (
  elements: Record<string, unknown> | undefined,
  fromName: string,
  toName: string,
): void => {
  const visit = (entry: any): void => {
    if (!entry || typeof entry !== 'object') return;
    if (LLM_REFERENCING_TYPES.has(entry.type) && entry.llm_name === fromName) {
      entry.llm_name = toName;
    }
    if (Array.isArray(entry.children)) {
      for (const child of entry.children) visit(child);
    }
  };
  for (const entry of Object.values(elements || {})) {
    visit(entry);
  }
};

const toMappingMatchedRules = (raw: unknown): MappingMatchedRule[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : undefined,
      label: typeof entry.label === 'string' ? entry.label : undefined,
      summary: typeof entry.summary === 'string' ? entry.summary : undefined,
      priority: typeof entry.priority === 'number' ? entry.priority : undefined,
      evidence: Array.isArray(entry.evidence)
        ? entry.evidence.filter((value): value is string => typeof value === 'string')
        : undefined,
    }));
};

const toMappingRecommendationSignals = (raw: unknown): MappingRecommendationSignals | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Record<string, unknown>;

  return {
    age: typeof value.age === 'number' ? value.age : null,
    detectedLanguages: Array.isArray(value.detectedLanguages)
      ? value.detectedLanguages.filter((language): language is string => typeof language === 'string')
      : [],
    isMultilingual: Boolean(value.isMultilingual),
  };
};

const buildUserProfilesFromProjectTabs = (project: ReturnType<typeof useProject>['currentProject']): StoredUserProfile[] => {
  if (!project) {
    return [];
  }

  return project.diagrams.UserDiagram
    .filter((diagram) => isUMLModel(diagram.model) && diagram.model.type === UMLDiagramType.UserDiagram)
    .map((diagram) => ({
      id: diagram.id,
      name: diagram.title,
      savedAt: diagram.lastUpdate,
      model: cloneModel(diagram.model as UMLModel),
    }));
};

const updateActiveAgentDiagramConfig = (
  project: NonNullable<ReturnType<typeof useProject>['currentProject']>,
  nextConfig: Record<string, unknown>,
): void => {
  const latestProject = ProjectStorageRepository.loadProject(project.id) || project;
  const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
  if (!latestAgentDiagram) {
    return;
  }

  const previousConfig = (latestAgentDiagram.config ?? {}) as Record<string, unknown>;
  const mergedConfig: Record<string, unknown> = { ...nextConfig };
  if (!('personalizedVariants' in nextConfig) && 'personalizedVariants' in previousConfig) {
    mergedConfig.personalizedVariants = previousConfig.personalizedVariants;
  }
  if (!('activePersonalizedVariantId' in nextConfig) && 'activePersonalizedVariantId' in previousConfig) {
    mergedConfig.activePersonalizedVariantId = previousConfig.activePersonalizedVariantId;
  }

  ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
    ...latestAgentDiagram,
    config: mergedConfig,
  });
};

const resolveProfileNameFromVariant = (
  agentDiagram: ProjectDiagram | null | undefined,
  availableProfiles: StoredUserProfile[],
): string => {
  const activeVariantId = getActiveAgentVariantId(agentDiagram);
  if (!activeVariantId) {
    return '';
  }

  const activeVariant = readAgentVariants(agentDiagram).find((entry) => entry.id === activeVariantId);
  if (!activeVariant) {
    return '';
  }

  return availableProfiles.some((profile) => profile.name === activeVariant.profileName)
    ? activeVariant.profileName
    : '';
};

const resolveProfileNameFromMapping = (
  configurationId: string,
  availableProfiles: StoredUserProfile[],
): string => {
  if (!configurationId) {
    return '';
  }

  const mapping = LocalStorageRepository.getAgentProfileConfigurationMappings()
    .find((entry) => entry.agentConfigurationId === configurationId);

  if (!mapping) {
    return '';
  }

  return availableProfiles.some((profile) => profile.name === mapping.userProfileName)
    ? mapping.userProfileName
    : '';
};


const loadInitialState = () => {
  const savedConfigurations = LocalStorageRepository.getAgentConfigurations();

  if (savedConfigurations.length > 0) {
    const activeId = LocalStorageRepository.getActiveAgentConfigurationId();
    const active = activeId ? savedConfigurations.find((entry) => entry.id === activeId) : null;

    if (active) {
      return {
        config: normalizeAgentConfiguration(active.config),
        activeId: active.id,
        activeName: active.name,
        savedConfigs: savedConfigurations,
      };
    }

    return {
      config: createDefaultConfig(),
      activeId: null,
      activeName: '',
      savedConfigs: savedConfigurations,
    };
  }

  try {
    const stored = LocalStorageRepository.getLegacyAgentConfig();
    if (stored) {
      const legacyConfig = JSON.parse(stored) as Partial<AgentConfigurationPayload>;
      return {
        config: normalizeAgentConfiguration(legacyConfig),
        activeId: null,
        activeName: '',
        savedConfigs: [],
      };
    }
  } catch {
    // Ignore corrupted legacy data
  }

  return {
    config: createDefaultConfig(),
    activeId: null,
    activeName: '',
    savedConfigs: [],
  };
};

type AgentLLMRowProps = {
  element: AgentLLMElement;
  expanded: boolean;
  isDefault: boolean;
  onToggleExpanded: (id: string) => void;
  onChange: (id: string, patch: Partial<AgentLLMElement>) => void;
  onRemove: (id: string) => void;
  onSetDefault: (id: string) => void;
};

const AgentLLMRow: React.FC<AgentLLMRowProps> = ({
  element,
  expanded,
  isDefault,
  onToggleExpanded,
  onChange,
  onRemove,
  onSetDefault,
}) => {
  const [parametersText, setParametersText] = useState<string>(formatAgentLLMParameters(element.parameters));
  const [parametersError, setParametersError] = useState<string>('');

  useEffect(() => {
    setParametersText(formatAgentLLMParameters(element.parameters));
    setParametersError('');
  }, [element.id]);

  const commitParameters = (raw: string) => {
    if (!raw.trim()) {
      setParametersError('');
      onChange(element.id, { parameters: {} });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParametersError('Parameters must be a JSON object');
        return;
      }
      setParametersError('');
      onChange(element.id, { parameters: parsed as Record<string, unknown> });
    } catch {
      setParametersError('Invalid JSON');
    }
  };

  const displayName = element.name?.trim() || '(unnamed LLM)';

  return (
    <div className="rounded-lg border border-border bg-background">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
        onClick={() => onToggleExpanded(element.id)}
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium">{displayName}</span>
          {isDefault && (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              Default
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{expanded ? 'Hide' : 'Show'}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-name-${element.id}`}>Name</Label>
              <Input
                id={`agent-llm-name-${element.id}`}
                value={element.name}
                placeholder="e.g. gpt-4o-mini"
                onChange={(event) => onChange(element.id, { name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-provider-${element.id}`}>Provider</Label>
              <select
                id={`agent-llm-provider-${element.id}`}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={element.provider}
                onChange={(event) =>
                  onChange(element.id, { provider: event.target.value as AgentLLMElementProvider })
                }
              >
                {AGENT_LLM_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-num-prev-${element.id}`}>Number of previous messages</Label>
              <Input
                id={`agent-llm-num-prev-${element.id}`}
                type="number"
                min={0}
                step={1}
                value={element.num_previous_messages}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  onChange(element.id, {
                    num_previous_messages: Number.isFinite(parsed) ? parsed : 0,
                  });
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`agent-llm-parameters-${element.id}`}>Parameters (JSON)</Label>
            <textarea
              id={`agent-llm-parameters-${element.id}`}
              className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              spellCheck={false}
              placeholder={'{\n  "temperature": 0.7\n}'}
              value={parametersText}
              onChange={(event) => setParametersText(event.target.value)}
              onBlur={(event) => commitParameters(event.target.value)}
            />
            {parametersError ? <p className="text-xs text-destructive">{parametersError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`agent-llm-global-context-${element.id}`}>Global context (optional)</Label>
            <textarea
              id={`agent-llm-global-context-${element.id}`}
              className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              placeholder="System-level context appended to every prompt"
              value={element.global_context ?? ''}
              onChange={(event) => onChange(element.id, { global_context: event.target.value })}
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm" htmlFor={`agent-llm-default-${element.id}`}>
              <input
                id={`agent-llm-default-${element.id}`}
                type="radio"
                name="agent-llm-default-radio"
                className="h-4 w-4"
                checked={isDefault}
                onChange={() => onSetDefault(element.id)}
              />
              Set as default
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(element.id)}
              className="text-destructive hover:text-destructive"
            >
              Remove
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AgentConfigurationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const { githubSession } = useGitHubAuth();

  const [initialLoad] = useState(loadInitialState);
  const initialConfig = initialLoad.config;
  const initialSavedConfigs = initialLoad.savedConfigs;
  const initialLLMProvider: AgentLLMProvider = 'provider' in initialConfig.llm ? initialConfig.llm.provider : '';
  const initialLLMModelValue = 'provider' in initialConfig.llm ? initialConfig.llm.model : '';
  const useCustomModelInitially = Boolean(
    initialLLMProvider &&
    initialLLMModelValue &&
    !knownLLMModels.includes(initialLLMModelValue),
  );

  const [savedConfigs, setSavedConfigs] = useState<StoredAgentConfiguration[]>(initialSavedConfigs);
  const [selectedConfigId, setSelectedConfigId] = useState<string>(initialLoad.activeId || '');
  const [activeConfigId, setActiveConfigId] = useState<string | null>(initialLoad.activeId);
  const [activeConfigName, setActiveConfigName] = useState<string>(initialLoad.activeName || '');
  const [configurationName, setConfigurationName] = useState<string>(initialLoad.activeName || DEFAULT_CONFIG_NAME);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Preparing your configuration...');
  const [mappingMatchedRules, setMappingMatchedRules] = useState<MappingMatchedRule[]>([]);
  const [mappingSignals, setMappingSignals] = useState<MappingRecommendationSignals | null>(null);

  const [userProfiles, setUserProfiles] = useState<StoredUserProfile[]>([]);
  const [selectedUserProfileName, setSelectedUserProfileName] = useState<string>(initialConfig.userProfileName || '');

  const [agentLanguage, setAgentLanguage] = useState(initialConfig.agentLanguage);
  const [inputModalities, setInputModalities] = useState<string[]>([...initialConfig.inputModalities]);
  const [outputModalities, setOutputModalities] = useState<string[]>([...initialConfig.outputModalities]);
  const [agentPlatform, setAgentPlatform] = useState(initialConfig.agentPlatform);
  const [responseTiming, setResponseTiming] = useState(initialConfig.responseTiming);
  const [agentStyle, setAgentStyle] = useState(initialConfig.agentStyle);
  const [llmProvider, setLlmProvider] = useState<AgentLLMProvider>(initialLLMProvider);
  const [llmModel, setLlmModel] = useState(useCustomModelInitially ? 'other' : initialLLMModelValue);
  const [customModel, setCustomModel] = useState(useCustomModelInitially ? initialLLMModelValue : '');
  const [languageComplexity, setLanguageComplexity] = useState<AgentLanguageComplexity>(initialConfig.languageComplexity);
  const [sentenceLength, setSentenceLength] = useState<AgentSentenceLength>(initialConfig.sentenceLength);
  const [interfaceStyle, setInterfaceStyle] = useState<InterfaceStyleSetting>({ ...initialConfig.interfaceStyle });
  const [sizeText, setSizeText] = useState<string>(() => String(initialConfig.interfaceStyle.size));
  const [lineSpacingText, setLineSpacingText] = useState<string>(() => String(initialConfig.interfaceStyle.lineSpacing));
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyleSetting>({ ...initialConfig.voiceStyle });
  const [avatarData, setAvatarData] = useState<string | null>(initialConfig.avatar || null);
  const [useAbbreviations, setUseAbbreviations] = useState<boolean>(initialConfig.useAbbreviations);
  const [adaptContentToUserProfile, setAdaptContentToUserProfile] = useState<boolean>(initialConfig.adaptContentToUserProfile);
  const [intentRecognitionTechnology, setIntentRecognitionTechnology] = useState<IntentRecognitionTechnology>(
    initialConfig.intentRecognitionTechnology,
  );
  const [activeCustomizationSection, setActiveCustomizationSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'runtime' | 'personalization'>('runtime');

  // Keep the size text mirror in sync when interfaceStyle.size is changed by something
  // other than user typing (config load, reset, propose). Only overwrite the user's in-progress
  // text when the canonical numeric value diverges from what they typed — otherwise typing
  // "0" or clearing the field would snap back and prevent further editing.
  useEffect(() => {
    const parsed = Number(sizeText);
    if (sizeText !== '' && !Number.isNaN(parsed) && parsed === interfaceStyle.size) return;
    setSizeText(String(interfaceStyle.size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interfaceStyle.size]);

  useEffect(() => {
    const parsed = Number(lineSpacingText);
    if (lineSpacingText !== '' && !Number.isNaN(parsed) && parsed === interfaceStyle.lineSpacing) return;
    setLineSpacingText(String(interfaceStyle.lineSpacing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interfaceStyle.lineSpacing]);

  const selectedConfig = savedConfigs.find((entry) => entry.id === selectedConfigId) || null;

  const currentAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
  const currentUserDiagram = currentProject ? getActiveDiagram(currentProject, 'UserDiagram') : undefined;

  // Agent Runtime config — bound to the active agent diagram's `config` block
  // (`AgentDiagram.config`), NOT to a global localStorage key. Single source of
  // truth: the diagram. We re-derive from the project whenever it changes.
  const runtimeConfigInitial = useMemo<AgentRuntimeConfig>(() => {
    const activeAgent = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    const cfg = (activeAgent?.config ?? {}) as Partial<AgentRuntimeConfig> & { llm?: { name?: string } };
    const llmName = typeof cfg.agentLlmName === 'string'
      ? cfg.agentLlmName
      : (cfg.llm && typeof cfg.llm === 'object' && typeof cfg.llm.name === 'string' ? cfg.llm.name : '');
    return {
      agentPlatform: cfg.agentPlatform || DEFAULT_AGENT_RUNTIME_CONFIG.agentPlatform,
      agentPlatformUseStreamlit: cfg.agentPlatformUseStreamlit ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentPlatformUseStreamlit,
      intentRecognitionTechnology:
        cfg.intentRecognitionTechnology || DEFAULT_AGENT_RUNTIME_CONFIG.intentRecognitionTechnology,
      agentLlmProvider: cfg.agentLlmProvider ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentLlmProvider,
      agentLlmModel: cfg.agentLlmModel ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentLlmModel,
      agentCustomLlmModel: cfg.agentCustomLlmModel ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentCustomLlmModel,
      agentLlmName: llmName,
    };
  }, [currentProject]);

  const [agentRuntimeConfig, setAgentRuntimeConfig] = useState<AgentRuntimeConfig>(runtimeConfigInitial);

  // Re-sync local runtime state when the active agent diagram changes.
  useEffect(() => {
    setAgentRuntimeConfig(runtimeConfigInitial);
  }, [runtimeConfigInitial]);

  // Keep the diagramBridge in sync so the editor popups can read the current platform.
  useEffect(() => {
    diagramBridge.setAgentPlatform(agentRuntimeConfig.agentPlatform);
  }, [agentRuntimeConfig.agentPlatform]);

  // Default LLM name — persisted on the active agent diagram's `config` block
  // under the snake_case key `default_llm_name` so the BAF backend can read it
  // directly. Mirrors `agentLlmName` in lifecycle but is a separate field with
  // its own snake_case wire shape.
  const defaultLlmNameInitial = useMemo<string | undefined>(() => {
    const activeAgent = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    const cfg = (activeAgent?.config ?? {}) as Record<string, unknown>;
    const raw = cfg.default_llm_name;
    return typeof raw === 'string' && raw ? raw : undefined;
  }, [currentProject]);

  const [defaultLlmName, setDefaultLlmName] = useState<string | undefined>(defaultLlmNameInitial);

  useEffect(() => {
    setDefaultLlmName(defaultLlmNameInitial);
  }, [defaultLlmNameInitial]);

  const persistDefaultLlmName = useCallback(
    (next: string | undefined) => {
      if (!currentProject) return;
      const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
      const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
      const latestConfig = (latestAgentDiagram?.config ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = { ...latestConfig };
      if (next) {
        merged.default_llm_name = next;
      } else {
        delete merged.default_llm_name;
      }
      updateActiveAgentDiagramConfig(currentProject, merged);
    },
    [currentProject],
  );

  // Must write BEFORE the model so updateDiagramModelThunk's snapshot picks up the new agentLlmName.
  const persistAgentLlmName = useCallback(
    (next: string) => {
      if (!currentProject) return;
      const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
      const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
      const latestConfig = (latestAgentDiagram?.config ?? {}) as Record<string, unknown>;
      const llmBlock = next ? { name: next } : {};
      updateActiveAgentDiagramConfig(currentProject, {
        ...latestConfig,
        agentLlmName: next,
        llm: llmBlock,
      });
      setAgentRuntimeConfig((prev) => ({ ...prev, agentLlmName: next }));
    },
    [currentProject],
  );

  const updateDefaultLlmName = useCallback(
    (next: string | undefined) => {
      setDefaultLlmName(next);
      persistDefaultLlmName(next);
    },
    [persistDefaultLlmName],
  );


  // Resolve the default LLM that satisfies the invariant
  // "if the list has any LLMs, the default points to one of them; if there
  // is exactly one LLM it must be that one." Pass the model that already
  // reflects the latest CRUD operation.
  const resolveDefaultLlm = useCallback(
    (model: any, currentDefault: string | undefined): string | undefined => {
      const llms = Object.values((model && model.elements) || {})
        .filter((entry) => isAgentLLMElement(entry))
        .map((entry) => normalizeAgentLLMElement(entry as any, ''));
      if (llms.length === 0) return undefined;
      if (llms.length === 1) return llms[0].name || undefined;
      if (currentDefault && llms.some((l) => l.name === currentDefault)) {
        return currentDefault;
      }
      return llms[0].name || undefined;
    },
    [],
  );

  const [expandedLlmId, setExpandedLlmId] = useState<string | null>(null);

  const handleToggleExpandedLlm = useCallback((id: string) => {
    setExpandedLlmId((prev) => (prev === id ? null : id));
  }, []);

  const updateAgentRuntimeConfig = useCallback(
    (patch: Partial<AgentRuntimeConfig>) => {
      setAgentRuntimeConfig((prev) => {
        const next: AgentRuntimeConfig = { ...prev, ...patch };
        if (currentProject) {
          // Read latest config off the diagram so we don't overwrite
          // personalization fields (personalizedVariants /
          // activePersonalizedVariantId, plus any AgentConfigurationPayload
          // fields the personalization flow writes here). The existing
          // updateActiveAgentDiagramConfig helper only auto-merges the two
          // personalization keys, so we explicitly merge the rest ourselves.
          const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
          const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
          const latestConfig = (latestAgentDiagram?.config ?? {}) as Record<string, unknown>;
          // Mirror the runtime LLM choice into the `llm` block consumed by the
          // BAF generator template (`config['llm']['name']`).
          const llmBlock = next.agentLlmName ? { name: next.agentLlmName } : {};
          updateActiveAgentDiagramConfig(currentProject, {
            ...latestConfig,
            ...next,
            llm: llmBlock,
          });
        }
        return next;
      });
    },
    [currentProject],
  );

  const currentAgentModel = useMemo(() => {
    const model = currentAgentDiagram?.model;
    if (isUMLModel(model) && model.type === UMLDiagramType.AgentDiagram) {
      return model;
    }
    return null;
  }, [currentAgentDiagram?.model]);

  const currentUserModel = useMemo(() => {
    const model = currentUserDiagram?.model;
    if (isUMLModel(model) && model.type === UMLDiagramType.UserDiagram) {
      return model;
    }
    return null;
  }, [currentUserDiagram?.model]);

  const agentLLMElements = useMemo<AgentLLMElement[]>(() => {
    if (!currentAgentModel) return [];
    const elements = currentAgentModel.elements || {};
    return Object.entries(elements)
      .filter(([, element]) => isAgentLLMElement(element))
      .map(([id, element]) => normalizeAgentLLMElement(element, id));
  }, [currentAgentModel]);

  const persistAgentModel = useCallback(
    async (nextModel: UMLModel) => {
      try {
        await dispatch(updateDiagramModelThunk({ model: nextModel })).unwrap();
        dispatch(bumpEditorRevision());
      } catch (err) {
        console.error('Failed to persist agent diagram update', err);
        toast.error('Failed to update agent diagram.');
      }
    },
    [dispatch],
  );

  const handleAddAgentLLM = useCallback(() => {
    if (!currentAgentModel) {
      toast.error('No active agent diagram.');
      return;
    }
    const nextModel = cloneModel(currentAgentModel);
    const id = generateAgentLLMId();
    const existingEntries = Object.values(nextModel.elements || {}).filter((entry) => isAgentLLMElement(entry));
    const existingCount = existingEntries.length;
    const offsetY = 40 + existingCount * 110;
    const newName = 'gpt-4o-mini';
    const newLLM: AgentLLMElement = {
      id,
      type: 'AgentLLM',
      name: newName,
      owner: null,
      bounds: { x: 40, y: offsetY, width: 200, height: 90 },
      provider: 'openai',
      parameters: {},
      num_previous_messages: 1,
      global_context: '',
    };
    nextModel.elements = { ...(nextModel.elements || {}), [id]: newLLM as any };
    setExpandedLlmId(id);
    // Write `default_llm_name` to the diagram config BEFORE persisting the
    // model. updateDiagramModelThunk's body snapshots state.project at call
    // time and its fulfilled action replaces the diagram with that snapshot,
    // which would otherwise wipe a default written afterwards. Doing the
    // config write first lets the thunk's snapshot include the new default.
    const resolved = resolveDefaultLlm(nextModel, defaultLlmName);
    if (resolved !== defaultLlmName) {
      updateDefaultLlmName(resolved);
    }
    persistAgentModel(nextModel);
  }, [currentAgentModel, persistAgentModel, defaultLlmName, resolveDefaultLlm, updateDefaultLlmName]);

  const handleUpdateAgentLLM = useCallback(
    (id: string, patch: Partial<AgentLLMElement>) => {
      if (!currentAgentModel) return;
      const existing = currentAgentModel.elements?.[id];
      if (!existing || !isAgentLLMElement(existing)) return;
      const previousName = (existing as AgentLLMElement).name;
      const nextModel = cloneModel(currentAgentModel);
      const merged = { ...(nextModel.elements[id] as any), ...patch, id, type: 'AgentLLM' };
      nextModel.elements = { ...nextModel.elements, [id]: merged };
      const isRename = typeof patch.name === 'string' && patch.name !== previousName;
      const newName = isRename ? (patch.name as string) : previousName;
      if (isRename && previousName) {
        remapLlmReferences(nextModel.elements, previousName, newName);
      }
      const renamedDefault =
        isRename && defaultLlmName === previousName ? newName || undefined : defaultLlmName;
      const resolved = resolveDefaultLlm(nextModel, renamedDefault);
      if (resolved !== defaultLlmName) {
        updateDefaultLlmName(resolved);
      }
      if (isRename && previousName && agentRuntimeConfig.agentLlmName === previousName) {
        persistAgentLlmName(newName);
      }
      persistAgentModel(nextModel);
    },
    [
      currentAgentModel,
      persistAgentModel,
      defaultLlmName,
      resolveDefaultLlm,
      updateDefaultLlmName,
      agentRuntimeConfig.agentLlmName,
      persistAgentLlmName,
    ],
  );

  const handleRemoveAgentLLM = useCallback(
    (id: string) => {
      if (!currentAgentModel) return;
      const removedEntry = currentAgentModel.elements?.[id] as AgentLLMElement | undefined;
      const removedName = removedEntry && isAgentLLMElement(removedEntry) ? removedEntry.name : '';
      const nextModel = cloneModel(currentAgentModel);
      const nextElements = { ...(nextModel.elements || {}) };
      delete nextElements[id];
      nextModel.elements = nextElements;
      if (removedName) {
        // Empty llm_name means "use default".
        remapLlmReferences(nextModel.elements, removedName, '');
      }
      setExpandedLlmId((prev) => (prev === id ? null : prev));
      const resolved = resolveDefaultLlm(nextModel, defaultLlmName);
      if (resolved !== defaultLlmName) {
        updateDefaultLlmName(resolved);
      }
      if (removedName && agentRuntimeConfig.agentLlmName === removedName) {
        persistAgentLlmName('');
      }
      persistAgentModel(nextModel);
    },
    [
      currentAgentModel,
      persistAgentModel,
      defaultLlmName,
      resolveDefaultLlm,
      updateDefaultLlmName,
      agentRuntimeConfig.agentLlmName,
      persistAgentLlmName,
    ],
  );

  const handleSetDefaultLlm = useCallback(
    (id: string) => {
      if (!currentAgentModel) return;
      const target = currentAgentModel.elements?.[id];
      if (!target || !isAgentLLMElement(target)) return;
      const name = (target as AgentLLMElement).name;
      if (!name) {
        toast.error('Give the LLM a name before marking it as default.');
        return;
      }
      updateDefaultLlmName(name);
    },
    [currentAgentModel, updateDefaultLlmName],
  );

  const tabUserProfiles = useMemo(
    () => buildUserProfilesFromProjectTabs(currentProject),
    [currentProject],
  );

  const refreshUserProfiles = useCallback(() => {
    setUserProfiles(tabUserProfiles);
    setSelectedUserProfileName((currentName) => {
      if (!currentName) {
        return '';
      }
      return tabUserProfiles.some((profile) => profile.name === currentName) ? currentName : '';
    });
  }, [tabUserProfiles]);

  const refreshSavedConfigurations = useCallback((preferredId?: string) => {
    const configs = LocalStorageRepository.getAgentConfigurations();
    setSavedConfigs(configs);

    if (configs.length === 0) {
      setSelectedConfigId('');
      setActiveConfigId(null);
      setActiveConfigName('');
      return configs;
    }

    const hasPreferred = Boolean(preferredId && configs.some((entry) => entry.id === preferredId));
    const activeId = LocalStorageRepository.getActiveAgentConfigurationId();
    const hasActive = Boolean(activeId && configs.some((entry) => entry.id === activeId));

    if (hasPreferred) {
      const next = configs.find((entry) => entry.id === preferredId) || configs[0];
      setSelectedConfigId(next.id);
      setActiveConfigId(next.id);
      setActiveConfigName(next.name);
      return configs;
    }

    if (hasActive) {
      const next = configs.find((entry) => entry.id === activeId) || configs[0];
      setSelectedConfigId(next.id);
      setActiveConfigId(next.id);
      setActiveConfigName(next.name);
      return configs;
    }

    setSelectedConfigId('');
    setActiveConfigId(null);
    setActiveConfigName('');
    return configs;
  }, []);

  const applyConfiguration = useCallback((
    incomingConfig: AgentConfigurationPayload,
    source?: { id?: string | null; name?: string },
    options?: { preferredUserProfileName?: string },
  ) => {
    const normalized = normalizeAgentConfiguration(incomingConfig);
    setAgentLanguage(normalized.agentLanguage);
    setInputModalities([...normalized.inputModalities]);
    setOutputModalities([...normalized.outputModalities]);
    setAgentPlatform(normalized.agentPlatform);
    setResponseTiming(normalized.responseTiming);
    setAgentStyle(normalized.agentStyle);

    const llmConfig = normalized.llm as Partial<AgentLLMConfiguration & AgentLLMNameConfiguration>;
    const providerValue = (llmConfig.provider ?? '') as AgentLLMProvider;
    const modelValue = llmConfig.model ?? '';

    setLlmProvider(providerValue);
    if (!providerValue || !modelValue) {
      setLlmModel('');
      setCustomModel('');
    } else if (knownLLMModels.includes(modelValue)) {
      setLlmModel(modelValue);
      setCustomModel('');
    } else {
      setLlmModel('other');
      setCustomModel(modelValue);
    }

    setLanguageComplexity(normalized.languageComplexity);
    setSentenceLength(normalized.sentenceLength);
    setInterfaceStyle({ ...normalized.interfaceStyle });
    setVoiceStyle({ ...normalized.voiceStyle });
    setAvatarData(normalized.avatar || null);
    setUseAbbreviations(normalized.useAbbreviations);
    setAdaptContentToUserProfile(normalized.adaptContentToUserProfile);
    setSelectedUserProfileName(normalized.userProfileName || options?.preferredUserProfileName || '');
    setIntentRecognitionTechnology(normalized.intentRecognitionTechnology);

    if (source) {
      const nextId = source.id ?? null;
      const nextName = source.name ?? '';
      setActiveConfigId(nextId);
      setSelectedConfigId(nextId ?? '');
      setActiveConfigName(nextName);
      setConfigurationName(nextName || DEFAULT_CONFIG_NAME);
    }
  }, []);

  useEffect(() => {
    refreshSavedConfigurations();
    refreshUserProfiles();
  }, [currentProject, refreshSavedConfigurations, refreshUserProfiles]);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    const agentDiagram = getActiveDiagram(currentProject, 'AgentDiagram');
    const diagramConfig = agentDiagram?.config as Partial<AgentConfigurationPayload> | undefined;

    if (diagramConfig && Object.keys(diagramConfig).length > 0) {
      // Only auto-populate the form from the diagram's stored config when
      // a saved configuration is currently active. After Save and Apply or
      // Reset the active id is cleared, and the form intentionally starts
      // at defaults — the diagram still holds its applied config (and the
      // personalization variant), but the form is for editing/loading and
      // should stay blank until the user explicitly loads something.
      const activeId = LocalStorageRepository.getActiveAgentConfigurationId();
      if (!activeId) {
        return;
      }

      const preferredProfileName = resolveProfileNameFromVariant(agentDiagram, tabUserProfiles)
        || resolveProfileNameFromMapping(activeId, tabUserProfiles);

      applyConfiguration(normalizeAgentConfiguration(diagramConfig), undefined, {
        preferredUserProfileName: preferredProfileName,
      });
      return;
    }

    try {
      const stored = LocalStorageRepository.getLegacyAgentConfig();
      if (stored) {
        const legacyConfig = normalizeAgentConfiguration(JSON.parse(stored) as Partial<AgentConfigurationPayload>);
        applyConfiguration(legacyConfig);

        if (agentDiagram) {
          ProjectStorageRepository.updateDiagram(currentProject.id, 'AgentDiagram', {
            ...agentDiagram,
            config: legacyConfig as unknown as Record<string, unknown>,
          });
        }

        LocalStorageRepository.clearLegacyAgentConfig();
      }
    } catch (err) {
      // Swallow only legacy-payload parse errors; let real failures
      // (e.g. updateDiagram) propagate.
      if (!(err instanceof SyntaxError)) {
        throw err;
      }
    }
  }, [currentProject?.id, applyConfiguration, tabUserProfiles]);

  const getConfigObject = useCallback((): AgentConfigurationPayload => {
    // The runtime tab now drives the LLM choice via `agentLlmName` (a
    // reference to a defined AgentLLM element). The legacy provider/model
    // state from the personalization tab is no longer surfaced in the UI but
    // we keep it around so old loaded configs round-trip until their next
    // save. Prefer the new `{name}` shape.
    const resolvedModel = llmModel === 'other' ? customModel.trim() : llmModel;
    let llm: AgentLLMNameConfiguration | AgentLLMConfiguration | Record<string, never> = {};
    if (agentRuntimeConfig.agentLlmName) {
      llm = { name: agentRuntimeConfig.agentLlmName };
    } else if (llmProvider && resolvedModel) {
      llm = { provider: llmProvider, model: resolvedModel };
    }

    return {
      agentLanguage: normalizeAgentLanguage(agentLanguage),
      inputModalities: normalizeModalityList(inputModalities),
      outputModalities: normalizeModalityList(outputModalities),
      agentPlatform,
      responseTiming,
      agentStyle,
      llm,
      languageComplexity,
      sentenceLength,
      interfaceStyle: { ...interfaceStyle },
      voiceStyle: { ...voiceStyle },
      avatar: avatarData,
      useAbbreviations,
      adaptContentToUserProfile,
      userProfileName: adaptContentToUserProfile ? (selectedUserProfileName.trim() || null) : null,
      intentRecognitionTechnology,
    };
  }, [
    adaptContentToUserProfile,
    agentLanguage,
    agentPlatform,
    agentRuntimeConfig.agentLlmName,
    agentStyle,
    avatarData,
    customModel,
    inputModalities,
    interfaceStyle,
    intentRecognitionTechnology,
    languageComplexity,
    llmModel,
    llmProvider,
    outputModalities,
    responseTiming,
    selectedUserProfileName,
    sentenceLength,
    useAbbreviations,
    voiceStyle,
  ]);

  const captureBaseAgentModel = useCallback(() => {
    if (!currentAgentModel) {
      return null;
    }
    return cloneModel(currentAgentModel);
  }, [currentAgentModel]);

  const saveConfiguration = useCallback((
    options?: {
      captureSnapshot?: boolean;
      markActive?: boolean;
      snapshotOverride?: UMLModel | null;
      originalAgentModel?: UMLModel | null;
    },
  ) => {
    const trimmedName = configurationName.trim();
    if (!trimmedName) {
      toast.error('Please provide a configuration name before saving.');
      return { ok: false, snapshotCaptured: false } as const;
    }

    const config = getConfigObject();

    let snapshot: UMLModel | null = null;
    if (options && 'snapshotOverride' in options && options.snapshotOverride !== undefined) {
      snapshot = options.snapshotOverride ?? null;
    } else if (options?.captureSnapshot) {
      snapshot = captureBaseAgentModel();
    }

    const personalizedClone = snapshot ? cloneModel(snapshot) : null;
    const originalClone = options?.originalAgentModel ? cloneModel(options.originalAgentModel) : null;

    try {
      const savedEntry = LocalStorageRepository.saveAgentConfiguration(trimmedName, config, {
        personalizedAgentModel: personalizedClone,
        originalAgentModel: originalClone,
      });

      if (currentProject) {
        const diagramConfig: Record<string, unknown> = {
          ...(config as unknown as Record<string, unknown>),
        };
        if (defaultLlmName) {
          diagramConfig.default_llm_name = defaultLlmName;
        }
        updateActiveAgentDiagramConfig(currentProject, diagramConfig);
      }

      if (options?.markActive) {
        LocalStorageRepository.setActiveAgentConfigurationId(savedEntry.id);
      }

      refreshSavedConfigurations(savedEntry.id);
      setActiveConfigId(savedEntry.id);
      setActiveConfigName(savedEntry.name);
      setConfigurationName(savedEntry.name);

      return { ok: true, savedEntry, snapshotCaptured: Boolean(personalizedClone) } as const;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save configuration.';
      toast.error(message);
      return { ok: false, snapshotCaptured: Boolean(personalizedClone) } as const;
    }
  }, [
    captureBaseAgentModel,
    configurationName,
    currentAgentDiagram,
    currentProject,
    defaultLlmName,
    getConfigObject,
    refreshSavedConfigurations,
  ]);

  // Warn before overwriting an existing configuration that shares this name
  // with a *different* entry. Editing the currently active config is allowed
  // silently since the user is updating their own record. Returns false when
  // the user cancels — callers must abort the save in that case.
  const confirmOverwriteIfNameCollides = useCallback(async (name: string): Promise<boolean> => {
    const trimmed = name.trim();
    if (!trimmed) return true;
    const lowered = trimmed.toLowerCase();
    const existing = LocalStorageRepository.getAgentConfigurations()
      .find((entry) => entry.name.toLowerCase() === lowered);
    if (!existing || existing.id === activeConfigId) {
      return true;
    }
    return globalConfirm({
      title: 'Replace existing configuration?',
      description: `A configuration named "${existing.name}" already exists. Saving will replace it.`,
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
  }, [activeConfigId]);

  // Warn before silently replacing an existing user-profile -> agent-config
  // mapping. A user profile may only be mapped to a single agent configuration
  // at a time, so saving a *different*-named config against an already-mapped
  // profile will discard the prior mapping. Returns false when the user
  // cancels — callers must abort the save in that case.
  const confirmOverwriteIfProfileCollides = useCallback(async (
    profile: { id: string; name: string },
    newConfigName: string,
  ): Promise<boolean> => {
    const trimmed = newConfigName.trim();
    if (!profile.id || !trimmed) return true;
    const existingMapping = LocalStorageRepository.getAgentProfileConfigurationMappings()
      .find((entry) => entry.userProfileId === profile.id);
    if (!existingMapping) {
      return true;
    }
    if (existingMapping.agentConfigurationName.toLowerCase() === trimmed.toLowerCase()) {
      return true;
    }
    return globalConfirm({
      title: 'Replace existing user profile mapping?',
      description: `User profile "${profile.name}" is already mapped to configuration "${existingMapping.agentConfigurationName}". Saving will replace that mapping with "${trimmed}".`,
      confirmLabel: 'Replace',
      cancelLabel: 'Cancel',
      variant: 'danger',
    });
  }, []);


  const handleLoadSavedConfiguration = useCallback((configId?: string) => {
    const targetId = configId ?? selectedConfigId;
    if (!targetId) {
      toast.error('Please select a configuration to load.');
      return;
    }

    const stored = LocalStorageRepository.loadAgentConfiguration(targetId);
    if (!stored) {
      toast.error('The selected configuration could not be found.');
      refreshSavedConfigurations();
      return;
    }

    const preferredProfileName = resolveProfileNameFromMapping(stored.id, tabUserProfiles);
    applyConfiguration(stored.config, { id: stored.id, name: stored.name }, {
      preferredUserProfileName: preferredProfileName,
    });

    if (currentProject) {
      const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
      const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
      const previousConfig = (latestAgentDiagram?.config ?? {}) as Record<string, unknown>;
      const merged: Record<string, unknown> = {
        ...(stored.config as unknown as Record<string, unknown>),
      };
      if (typeof previousConfig.default_llm_name === 'string' && previousConfig.default_llm_name) {
        merged.default_llm_name = previousConfig.default_llm_name;
      }
      updateActiveAgentDiagramConfig(currentProject, merged);
    }

    LocalStorageRepository.setActiveAgentConfigurationId(stored.id);
    toast.success(`Configuration "${stored.name}" loaded.`);
  }, [
    applyConfiguration,
    currentAgentDiagram,
    currentProject,
    refreshSavedConfigurations,
    selectedConfigId,
    tabUserProfiles,
  ]);

  const handleDeleteSavedConfiguration = useCallback(async (configId?: string) => {
    const targetId = configId ?? selectedConfigId;
    if (!targetId) {
      toast.error('Please select a configuration to delete.');
      return;
    }

    const stored = LocalStorageRepository.loadAgentConfiguration(targetId);
    if (!stored) {
      toast.error('The selected configuration could not be found.');
      refreshSavedConfigurations();
      return;
    }

    const confirmed = window.confirm(`Delete configuration "${stored.name}"?`);
    if (!confirmed) {
      return;
    }

    LocalStorageRepository.deleteAgentConfiguration(targetId);
    if (activeConfigId === targetId) {
      LocalStorageRepository.clearActiveAgentConfigurationId();
      setActiveConfigId(null);
      setActiveConfigName('');
    }

    const variantsChanged = currentProject
      ? removeConfigurationVariantsFromProject(currentProject.id, targetId)
      : false;

    refreshSavedConfigurations();

    if (variantsChanged) {
      try {
        await dispatch(refreshProjectStateThunk()).unwrap();
        dispatch(bumpEditorRevision());
      } catch (error) {
        console.error('Failed to refresh project after variant cleanup:', error);
      }
    }

    toast.success('Configuration deleted.');
  }, [activeConfigId, currentProject, dispatch, refreshSavedConfigurations, selectedConfigId]);

  const handleInputSpeechToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputModalities(event.target.checked ? [...speechEnabledModality] : [...baseTextModality]);
  };

  const handleOutputSpeechToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOutputModalities(event.target.checked ? [...speechEnabledModality] : [...baseTextModality]);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setAvatarData(result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleAvatarRemove = () => setAvatarData(null);

  const updateInterfaceStyle = <K extends keyof InterfaceStyleSetting>(field: K, value: InterfaceStyleSetting[K]) => {
    setInterfaceStyle((previous) => ({ ...previous, [field]: value }));
  };

  const resolveSelectedUserProfile = useCallback((): StoredUserProfile | null => {
    const availableProfiles = userProfiles.length > 0
      ? userProfiles
      : buildUserProfilesFromProjectTabs(currentProject);

    const selectedProfile = availableProfiles.find((profile) => profile.name === selectedUserProfileName);
    if (!selectedProfile || selectedProfile.model.type !== UMLDiagramType.UserDiagram) {
      return null;
    }

    return selectedProfile;
  }, [currentProject, selectedUserProfileName, userProfiles]);

  const handleAutoProposeConfigurationRules = async () => {
    if (!selectedUserProfileName.trim()) {
      toast.error('Please select a user profile mapping first.');
      return;
    }

    const selectedProfile = resolveSelectedUserProfile();
    if (!selectedProfile) {
      toast.error('The selected user profile is not available. Please select a valid saved user profile.');
      return;
    }

    if (!githubSession) {
      toast.error('Sign in to GitHub to use recommendations.');
      return;
    }

    try {
      setLoadingMessage('Applying predefined literature-based mapping to recommend a fitting configuration.');
      setIsLoading(true);

      const payload = {
        userProfileName: selectedProfile.name,
        userProfileModel: cloneModel(selectedProfile.model),
        currentConfig: buildStructuredExport(getConfigObject()),
      };

      try {
        const recommendation = await apiClient.post<{
          config?: unknown;
          matchedRules?: unknown;
          signals?: unknown;
        }>('/recommend-agent-config-mapping', payload, {
          headers: { 'X-GitHub-Session': githubSession },
        });

        if (!recommendation || typeof recommendation !== 'object' || !('config' in recommendation) || !recommendation.config) {
          toast.error('Invalid mapping recommendation response received from backend.');
          return;
        }

        const prepared = flattenStructuredConfig(recommendation.config);
        const normalized = normalizeAgentConfiguration({
          ...prepared,
          adaptContentToUserProfile: prepared.adaptContentToUserProfile ?? true,
          userProfileName: selectedProfile.name,
        });

        const matchedRules = toMappingMatchedRules((recommendation as Record<string, unknown>).matchedRules);
        const detectedSignals = toMappingRecommendationSignals((recommendation as Record<string, unknown>).signals);

        applyConfiguration(normalized);
        setMappingMatchedRules(matchedRules);
        setMappingSignals(detectedSignals);

        if (matchedRules.length > 0) {
          toast.success(`Predefined-rule recommendation applied (${matchedRules.length} rule${matchedRules.length > 1 ? 's' : ''} matched).`);
        } else {
          toast.success('Predefined-rule recommendation applied. No specific rule matched, so defaults were preserved.');
        }
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(`Failed to get mapping-based recommendation: ${err.message}`);
          return;
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to fetch mapping-based recommendation:', error);
      toast.error('An unexpected error occurred while requesting a predefined-rule recommendation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoProposeConfigurationRAG = () => {
    if (!selectedUserProfileName.trim()) {
      toast.error('Please select a user profile mapping first.');
      return;
    }

    toast.info('RAG-based automatic configuration proposal will be available soon.');
  };

  const handleAutoProposeConfigurationLLM = async () => {
    if (!selectedUserProfileName.trim()) {
      toast.error('Please select a user profile mapping first.');
      return;
    }

    const selectedProfile = resolveSelectedUserProfile();
    if (!selectedProfile) {
      toast.error('The selected user profile is not available. Please select a valid saved user profile.');
      return;
    }

    if (!githubSession) {
      toast.error('Sign in to GitHub to use recommendations.');
      return;
    }

    try {
      setLoadingMessage('This might take a while to cook up the best LLM-based configuration for your selected user profile.');
      setIsLoading(true);

      const payload = {
        userProfileName: selectedProfile.name,
        userProfileModel: cloneModel(selectedProfile.model),
        currentConfig: buildStructuredExport(getConfigObject()),
        model: 'gpt-5',
      };

      try {
        const recommendation = await apiClient.post<{ config?: unknown }>(
          '/recommend-agent-config-llm',
          payload,
          { headers: { 'X-GitHub-Session': githubSession } },
        );

        if (!recommendation || typeof recommendation !== 'object' || !recommendation.config) {
          toast.error('Invalid recommendation response received from backend.');
          return;
        }

        const prepared = flattenStructuredConfig(recommendation.config);
        const normalized = normalizeAgentConfiguration({
          ...prepared,
          adaptContentToUserProfile: prepared.adaptContentToUserProfile ?? true,
          userProfileName: selectedProfile.name,
        });

        applyConfiguration(normalized);
        setMappingMatchedRules([]);
        setMappingSignals(null);
        toast.success('LLM-based recommendation applied to the current configuration.');
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(`Failed to get LLM recommendation: ${err.message}`);
          return;
        }
        throw err;
      }
    } catch (error) {
      console.error('Failed to fetch LLM recommendation:', error);
      toast.error('An unexpected error occurred while requesting an LLM-based recommendation.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetFormToDefaults = useCallback(() => {
    applyConfiguration(createDefaultConfig());
    setActiveCustomizationSection(null);
    setConfigurationName(DEFAULT_CONFIG_NAME);
    setActiveConfigId(null);
    setActiveConfigName('');
    setSelectedConfigId('');
    LocalStorageRepository.clearActiveAgentConfigurationId();
  }, [applyConfiguration]);

  const handleResetToDefaults = () => {
    resetFormToDefaults();
    toast.info('Configuration reset to default values.');
  };

  const handleSaveAndApply = async () => {
    const trimmedName = configurationName.trim();
    if (!trimmedName) {
      toast.error('Please provide a configuration name before saving.');
      return;
    }

    const proceed = await confirmOverwriteIfNameCollides(trimmedName);
    if (!proceed) return;

    const storedBaseModel = currentAgentDiagram?.id
      ? LocalStorageRepository.getAgentBaseModel(currentAgentDiagram.id)
      : null;

    // Re-personalize from the stored un-personalized base when one exists,
    // otherwise the live diagram is itself the base. The stored snapshot is
    // guaranteed to be in the canonical nested transition shape (normalized at
    // the storage boundary), so it round-trips through the backend cleanly.
    const agentModel = storedBaseModel
      ? cloneModel(storedBaseModel)
      : currentAgentModel
        ? cloneModel(currentAgentModel)
        : null;

    if (!agentModel) {
      toast.error('Please open an Agent diagram before saving and applying.');
      return;
    }

    if (!storedBaseModel && currentAgentDiagram?.id) {
      LocalStorageRepository.saveAgentBaseModel(currentAgentDiagram.id, agentModel);
    }

    if (!selectedUserProfileName.trim()) {
      toast.error('Please select a user profile to map before saving and applying.');
      return;
    }

    const selectedProfile = (userProfiles.length > 0 ? userProfiles : buildUserProfilesFromProjectTabs(currentProject))
      .find((profile) => profile.name === selectedUserProfileName);

    if (!selectedProfile || selectedProfile.model.type !== UMLDiagramType.UserDiagram) {
      toast.error('The selected user profile is not available. Please select a valid saved user profile.');
      return;
    }

    const proceedProfileMapping = await confirmOverwriteIfProfileCollides(
      { id: selectedProfile.id, name: selectedProfile.name },
      trimmedName,
    );
    if (!proceedProfileMapping) return;

    const config = getConfigObject();
    const requestConfig: AgentTransformationConfig = buildSparseGenerationConfig(config);

    if (config.adaptContentToUserProfile && config.userProfileName) {
      requestConfig.userProfileModel = cloneModel(selectedProfile.model);
    }

    try {
      setLoadingMessage('This might take a while to cook up the best transformed agent setup and apply it to your diagram.');
      setIsLoading(true);

      const payload = {
        id: currentAgentDiagram?.id,
        title: currentAgentDiagram?.title || trimmedName,
        model: agentModel,
        lastUpdate: currentAgentDiagram?.lastUpdate,
        generator: 'agent',
        config: requestConfig,
      };

      let transformedModel: unknown;
      try {
        // 10-minute timeout: personalization runs sequential OpenAI calls
        // (translation + style + complexity + length) over every training
        // sentence and reply, so the default 30s cap aborts the request while
        // the backend is still working. Large agents with many intents have
        // been observed to need several minutes; we keep generous headroom
        // rather than risk another silent regression.
        transformedModel = await apiClient.post<unknown>(
          '/transform-agent-model-json',
          payload,
          { timeout: 600_000 },
        );
      } catch (err) {
        if (err instanceof ApiError) {
          toast.error(`Failed to transform agent model: ${err.message}`);
          return;
        }
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          toast.error(
            'Personalization is taking longer than expected. Try again with a shorter agent or fewer transformations.',
          );
          return;
        }
        throw err;
      }

      const snapshotModel: UMLModel | undefined =
        transformedModel && typeof transformedModel === 'object' && 'model' in transformedModel
          ? ((transformedModel as { model: UMLModel }).model)
          : (transformedModel as UMLModel | undefined);

      if (snapshotModel) {
        await dispatch(updateDiagramModelThunk({ model: snapshotModel })).unwrap();
        dispatch(bumpEditorRevision());
      }

      const result = saveConfiguration({
        snapshotOverride: snapshotModel,
        markActive: true,
        originalAgentModel: agentModel,
      });

      if (result.ok && result.savedEntry) {
        if (
          currentProject &&
          currentAgentDiagram &&
          snapshotModel &&
          isUMLModel(snapshotModel) &&
          snapshotModel.type === UMLDiagramType.AgentDiagram
        ) {
          const variantId = `${selectedProfile.id}:${result.savedEntry.id}`;
          const nextVariant: AgentModelVariantSnapshot = {
            id: variantId,
            profileId: selectedProfile.id,
            profileName: selectedProfile.name,
            configurationId: result.savedEntry.id,
            configurationName: result.savedEntry.name,
            createdAt: new Date().toISOString(),
            model: cloneModel(snapshotModel),
          };

          const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
          const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram') || currentAgentDiagram;
          const latestConfigRecord = (latestAgentDiagram.config ?? {}) as Record<string, unknown>;

          updateActiveAgentDiagramConfig(currentProject, {
            ...latestConfigRecord,
            ...(config as unknown as Record<string, unknown>),
            personalizedVariants: upsertVariantForProfile(readAgentVariants(latestAgentDiagram), nextVariant),
            activePersonalizedVariantId: variantId,
          });

          await dispatch(refreshProjectStateThunk()).unwrap();
        }

        LocalStorageRepository.saveAgentProfileConfigurationMapping(selectedProfile, result.savedEntry);
        toast.success('Configuration transformed, saved, and applied successfully.');
        resetFormToDefaults();
        navigate('/');
      } else {
        toast.error('Failed to save configuration locally.');
      }
    } catch (error) {
      console.error('Error transforming agent model:', error);
      toast.error('An unexpected error occurred while transforming the agent model.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = () => {
    const config = getConfigObject();
    const structuredExport = buildStructuredExport(config);
    const slug = configurationName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
    const filename = slug ? `${slug}.json` : 'agent_config.json';
    const blob = new Blob([JSON.stringify(structuredExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target?.result as string);
        const flattened = flattenStructuredConfig(parsed);
        const normalized = normalizeAgentConfiguration(flattened);
        applyConfiguration(normalized);
        toast.success('Configuration loaded from file. Remember to save it if you want it in your library.');
      } catch {
        toast.error('Invalid configuration file.');
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const toggleCustomizationSection = (section: string) => {
    setActiveCustomizationSection((previous) => (previous === section ? null : section));
  };

  // When a customization section opens, scroll it into view. Otherwise the
  // previously open (taller) section collapsing above this one can push the
  // newly opened section off the top of the viewport.
  const customizationSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!activeCustomizationSection) return;
    const el = customizationSectionRefs.current[activeCustomizationSection];
    if (!el) return;
    // Defer one frame so the expanded panel is in the DOM before we scroll.
    const handle = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(handle);
  }, [activeCustomizationSection]);

  const showVoiceControls = outputModalities.includes('speech');

  return (
    <div className="relative h-full overflow-auto px-4 py-6 sm:px-8">
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 text-center shadow-2xl">
            <div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-border border-t-brand" />
            <h3 className="text-lg font-semibold">Working on it...</h3>
            <p className="mt-2 text-sm text-muted-foreground">{loadingMessage}</p>
          </div>
        </div>
      )}

      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Customization</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tailor your agent to a specific user profile from the User Diagram. Adjust how it talks, looks, and behaves to match that audience, then save the result as a named configuration you can switch between later.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Agent configuration sections"
          className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'runtime'}
            onClick={() => setActiveTab('runtime')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'runtime'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Agent Runtime
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'personalization'}
            onClick={() => setActiveTab('personalization')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'personalization'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Personalization
          </button>
        </div>

        {activeTab === 'personalization' && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 p-2">
            <span className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Load a saved customization
            </span>
            {activeConfigId && (
              <Badge variant="secondary" title={activeConfigName || 'Unnamed customization'}>
                <span className="block max-w-[180px] truncate">
                  Active: {activeConfigName || 'Unnamed'}
                </span>
              </Badge>
            )}
            <select
              aria-label="Load a saved customization"
              className="h-9 rounded-md border border-input bg-background px-2 py-1 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              value={selectedConfigId}
              onChange={(event) => setSelectedConfigId(event.target.value)}
              disabled={savedConfigs.length === 0}
            >
              <option value="">
                {savedConfigs.length === 0 ? 'No saved customizations yet' : 'Select a saved customization'}
              </option>
              {savedConfigs.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleLoadSavedConfiguration()}
              disabled={!selectedConfigId}
            >
              Load
            </Button>
          </div>
        )}

        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-6"
        >
          {activeTab === 'personalization' && (
          <Card>
            <CardHeader>
              <CardTitle>User Profile Mapping</CardTitle>
              <CardDescription>
                Select the user profile that should guide personalization and automatic configuration proposals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-profile-mapping">User Profile Mapping</Label>
                <select
                  id="user-profile-mapping"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                  value={selectedUserProfileName}
                  onChange={(event) => setSelectedUserProfileName(event.target.value)}
                  disabled={userProfiles.length === 0}
                >
                  <option value="">
                    {userProfiles.length === 0 ? 'No User Diagram tabs with models available yet' : 'Select a user profile'}
                  </option>
                  {userProfiles.map((profile) => (
                    <option key={profile.id} value={profile.name}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {userProfiles.length === 0 && (
                  <p className="text-xs text-muted-foreground">Create or load a User Diagram tab first.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Current project User Diagram status: {currentUserModel ? 'available' : 'missing'}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={handleAutoProposeConfigurationRules} disabled={isLoading || !selectedUserProfileName.trim()}>
                  Automatically propose configuration using predefined rules
                </Button>
                <Button type="button" variant="outline" onClick={handleAutoProposeConfigurationLLM} disabled={isLoading || !selectedUserProfileName.trim()}>
                  Automatically propose configuration using LLMs
                </Button>
                <Button type="button" variant="outline" onClick={handleAutoProposeConfigurationRAG} disabled={isLoading || !selectedUserProfileName.trim()}>
                  Automatically propose configuration using RAG based
                </Button>
              </div>

              {(mappingMatchedRules.length > 0 || mappingSignals) && (
                <div className="rounded-lg border border-brand/20 bg-brand/5 p-3">
                  <p className="text-sm font-medium">Latest predefined-rule recommendation</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {mappingMatchedRules.length > 0
                      ? `${mappingMatchedRules.length} literature-based rule${mappingMatchedRules.length > 1 ? 's' : ''} matched.`
                      : 'No specific literature rule matched. Baseline defaults were preserved.'}
                  </p>

                  {mappingSignals && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Detected signals: age {mappingSignals.age ?? 'n/a'}, languages{' '}
                      {mappingSignals.detectedLanguages.length > 0
                        ? mappingSignals.detectedLanguages.join(', ')
                        : 'n/a'}, multilingual {mappingSignals.isMultilingual ? 'yes' : 'no'}.
                    </p>
                  )}

                  {mappingMatchedRules.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {mappingMatchedRules.map((rule, index) => (
                        <div
                          key={`${rule.id || rule.label || 'rule'}-${index}`}
                          className="rounded-md border border-border bg-background px-3 py-2"
                        >
                          <p className="text-xs font-medium">{rule.label || rule.id || 'Matched rule'}</p>
                          {rule.summary && <p className="text-xs text-muted-foreground">{rule.summary}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          )}

          {activeTab === 'runtime' && currentAgentModel && (
          <>
          <Card>
            <CardHeader>
              <CardTitle>Agent Runtime</CardTitle>
              <CardDescription>
                Runtime settings for the active agent diagram (platform, intent recognition, LLM provider/model).
                These values live on the agent diagram itself, not in global storage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-runtime-platform">Platform</Label>
                  <select
                    id="agent-runtime-platform"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    value={agentRuntimeConfig.agentPlatform}
                    onChange={(event) => updateAgentRuntimeConfig({
                      agentPlatform: event.target.value,
                      agentPlatformUseStreamlit: event.target.value !== 'websocket' ? false : agentRuntimeConfig.agentPlatformUseStreamlit,
                    })}
                  >
                    <option value="websocket">WebSocket</option>
                    <option value="telegram">Telegram</option>
                  </select>
                  {agentRuntimeConfig.agentPlatform === 'websocket' && (
                    <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={agentRuntimeConfig.agentPlatformUseStreamlit ?? false}
                        onChange={(e) => updateAgentRuntimeConfig({ agentPlatformUseStreamlit: e.target.checked })}
                      />
                      Use Streamlit UI
                    </label>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-runtime-intent">Intent Recognition</Label>
                  <select
                    id="agent-runtime-intent"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                    value={agentRuntimeConfig.intentRecognitionTechnology}
                    onChange={(event) =>
                      updateAgentRuntimeConfig({
                        intentRecognitionTechnology: event.target.value as IntentRecognitionTechnology,
                      })
                    }
                  >
                    <option value="classical">Classical</option>
                    <option value="llm-based">LLM-based</option>
                  </select>
                </div>

                {agentRuntimeConfig.intentRecognitionTechnology === 'llm-based' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-runtime-llm-name">LLM</Label>
                    <select
                      id="agent-runtime-llm-name"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={agentRuntimeConfig.agentLlmName}
                      onChange={(event) =>
                        updateAgentRuntimeConfig({ agentLlmName: event.target.value })
                      }
                    >
                      <option value="">(use default)</option>
                      {agentLLMElements.map((entry) => (
                        <option key={entry.id} value={entry.name}>
                          {entry.name || '(unnamed LLM)'}
                        </option>
                      ))}
                    </select>
                    {agentLLMElements.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Define an LLM in the LLMs section below to use it here.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>LLMs</CardTitle>
              <CardDescription>
                LLMs available to the agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentLLMElements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No LLMs defined yet. Click "Add LLM" to create one.
                </p>
              ) : (
                <div className="space-y-2">
                  {agentLLMElements.map((llm) => (
                    <AgentLLMRow
                      key={llm.id}
                      element={llm}
                      expanded={expandedLlmId === llm.id}
                      isDefault={Boolean(defaultLlmName) && llm.name === defaultLlmName}
                      onToggleExpanded={handleToggleExpandedLlm}
                      onChange={handleUpdateAgentLLM}
                      onRemove={handleRemoveAgentLLM}
                      onSetDefault={handleSetDefaultLlm}
                    />
                  ))}
                </div>
              )}
              <div>
                <Button type="button" onClick={handleAddAgentLLM}>
                  Add LLM
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agent Configuration File (<code>config.yaml</code>)</CardTitle>
              <CardDescription>
                Edit the <code>config.yaml</code> file that will be included when generating the agent.
                {' '}
                <a
                  href="https://besser-agentic-framework.readthedocs.io/latest/wiki/configuration_properties.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline underline-offset-2 hover:text-brand/80"
                >
                  Configuration properties reference ↗
                </a>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AgentConfigYamlEditor currentProject={currentProject} />
            </CardContent>
          </Card>
          </>
          )}

          {activeTab === 'personalization' && (
          <>
          <Card>
            <CardHeader>
              <CardTitle>Personalization Overview</CardTitle>
              <CardDescription>
                Open one section at a time to keep the same focused editing flow as in the previous version.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                ref={(el) => { customizationSectionRefs.current.presentation = el; }}
                className="rounded-xl border border-border"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => toggleCustomizationSection('presentation')}
                >
                  <div>
                    <p className="font-medium">Presentation</p>
                    <p className="text-xs text-muted-foreground">
                      Language, style, readability, voice, and avatar.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activeCustomizationSection === 'presentation' ? 'Hide' : 'Show'}</span>
                </button>
                {activeCustomizationSection === 'presentation' && (
                  <div className="space-y-4 border-t border-border px-4 py-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="agent-language">Language</Label>
                        <select
                          id="agent-language"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={agentLanguage}
                          onChange={(event) => setAgentLanguage(event.target.value)}
                        >
                          <option value="original">Original</option>
                          <option value="english">English</option>
                          <option value="spanish">Spanish</option>
                          <option value="french">French</option>
                          <option value="german">German</option>
                          <option value="portuguese">Portuguese</option>
                          <option value="luxembourgish">Luxembourgish</option>
                          <option value="italian">Italian</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="agent-style">Style</Label>
                        <select
                          id="agent-style"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={agentStyle}
                          onChange={(event) => setAgentStyle(event.target.value)}
                        >
                          <option value="original">Original</option>
                          <option value="formal">Formal</option>
                          <option value="informal">Informal</option>
                          <option value="friendly">Friendly</option>
                          <option value="technical">Technical</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="language-complexity">Language Complexity</Label>
                        <select
                          id="language-complexity"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={languageComplexity}
                          onChange={(event) => setLanguageComplexity(event.target.value as AgentLanguageComplexity)}
                        >
                          <option value="original">Original</option>
                          <option value="simple">Simple</option>
                          <option value="medium">Medium</option>
                          <option value="complex">Complex</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="sentence-length">Sentence Length</Label>
                        <select
                          id="sentence-length"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={sentenceLength}
                          onChange={(event) => setSentenceLength(event.target.value as AgentSentenceLength)}
                        >
                          <option value="original">Original</option>
                          <option value="concise">Concise</option>
                          <option value="verbose">Verbose</option>
                        </select>
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={useAbbreviations}
                        onChange={(event) => setUseAbbreviations(event.target.checked)}
                      />
                      Use abbreviations
                    </label>

                    <Separator />

                    <p className="text-sm font-medium">Style of text in interface</p>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="interface-size">Size</Label>
                        <Input
                          id="interface-size"
                          type="number"
                          min={INTERFACE_SIZE_MIN}
                          max={INTERFACE_SIZE_MAX}
                          value={sizeText}
                          onChange={(event) => {
                            const next = event.target.value;
                            setSizeText(next);
                            if (next === '') return;
                            const parsed = Number(next);
                            if (!Number.isNaN(parsed)) {
                              updateInterfaceStyle('size', parsed);
                            }
                          }}
                          onBlur={() => {
                            const parsed = Number(sizeText);
                            const fallback = Number.isFinite(interfaceStyle.size)
                              ? interfaceStyle.size
                              : defaultInterfaceStyle.size;
                            const base = sizeText === '' || Number.isNaN(parsed) ? fallback : parsed;
                            const clamped = Math.max(
                              INTERFACE_SIZE_MIN,
                              Math.min(INTERFACE_SIZE_MAX, Math.round(base)),
                            );
                            setSizeText(String(clamped));
                            if (clamped !== interfaceStyle.size) {
                              updateInterfaceStyle('size', clamped);
                            }
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="interface-font">Font</Label>
                        <select
                          id="interface-font"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={interfaceStyle.font}
                          onChange={(event) => updateInterfaceStyle('font', event.target.value as InterfaceStyleSetting['font'])}
                        >
                          <option value="sans">Sans</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                          <option value="neutral">Neutral</option>
                          <option value="grotesque">Grotesque</option>
                          <option value="condensed">Condensed</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="interface-line-spacing">Line Spacing</Label>
                        <Input
                          id="interface-line-spacing"
                          type="number"
                          min={INTERFACE_LINE_SPACING_MIN}
                          max={INTERFACE_LINE_SPACING_MAX}
                          step={0.1}
                          value={lineSpacingText}
                          onChange={(event) => {
                            const next = event.target.value;
                            setLineSpacingText(next);
                            if (next === '') return;
                            const parsed = Number(next);
                            if (!Number.isNaN(parsed)) {
                              updateInterfaceStyle('lineSpacing', parsed);
                            }
                          }}
                          onBlur={() => {
                            const parsed = Number(lineSpacingText);
                            const fallback = Number.isFinite(interfaceStyle.lineSpacing)
                              ? interfaceStyle.lineSpacing
                              : defaultInterfaceStyle.lineSpacing;
                            const base = lineSpacingText === '' || Number.isNaN(parsed) ? fallback : parsed;
                            const clamped = Math.max(
                              INTERFACE_LINE_SPACING_MIN,
                              Math.min(INTERFACE_LINE_SPACING_MAX, Math.round(base * 10) / 10),
                            );
                            setLineSpacingText(String(clamped));
                            if (clamped !== interfaceStyle.lineSpacing) {
                              updateInterfaceStyle('lineSpacing', clamped);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="interface-alignment">Alignment</Label>
                        <select
                          id="interface-alignment"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={interfaceStyle.alignment}
                          onChange={(event) => updateInterfaceStyle('alignment', event.target.value as InterfaceStyleSetting['alignment'])}
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="justify">Justify</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="interface-contrast">Contrast</Label>
                        <select
                          id="interface-contrast"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={interfaceStyle.contrast}
                          onChange={(event) => updateInterfaceStyle('contrast', event.target.value as InterfaceStyleSetting['contrast'])}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Color</Label>
                      <p className="text-xs text-muted-foreground">
                        Pick a preset suited to different accessibility needs. The swatch shows the actual rendered color.
                      </p>
                      <div role="radiogroup" aria-label="Text color preset" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {interfaceColorOptions.map((option) => {
                          const isSelected = interfaceStyle.color === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => updateInterfaceStyle('color', option.value)}
                              title={option.description}
                              className={`flex items-start gap-3 rounded-md border p-2.5 text-left transition-colors ${
                                isSelected
                                  ? 'border-brand bg-brand/5 ring-2 ring-brand/30'
                                  : 'border-input hover:border-brand/30'
                              }`}
                            >
                              <span
                                aria-hidden
                                className="mt-0.5 size-6 shrink-0 rounded-full border border-border shadow-inner"
                                style={{ background: option.swatch }}
                              />
                              <span className="flex-1 leading-tight">
                                <span className="block text-sm font-medium text-foreground">{option.label}</span>
                                <span className="block text-xs text-muted-foreground">{option.description}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {interfaceStyle.color &&
                        !interfaceColorOptions.some((option) => option.value === interfaceStyle.color) && (
                          <p className="text-xs text-muted-foreground">
                            Current value:{' '}
                            <code className="rounded bg-muted px-1 py-0.5 font-mono">{interfaceStyle.color}</code>{' '}
                            (custom — pick a preset above to replace it).
                          </p>
                        )}
                    </div>

                    {SHOW_WIP_AGENT_CONFIG_FIELDS && showVoiceControls && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor="voice-gender">Voice Gender</Label>
                          <select
                            id="voice-gender"
                            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={voiceStyle.gender}
                            onChange={(event) => setVoiceStyle((previous) => ({
                              ...previous,
                              gender: event.target.value as VoiceStyleSetting['gender'],
                            }))}
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="ambiguous">Ambiguous</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="voice-speed">Voice Speed</Label>
                          <Input
                            id="voice-speed"
                            type="number"
                            min={0.5}
                            max={2}
                            step={0.1}
                            value={voiceStyle.speed}
                            onChange={(event) => setVoiceStyle((previous) => ({ ...previous, speed: Number(event.target.value) }))}
                          />
                        </div>
                      </div>
                    )}

                    {SHOW_WIP_AGENT_CONFIG_FIELDS && (
                      <div className="space-y-1.5">
                        <Label htmlFor="avatar-upload">Avatar</Label>
                        <div className="flex flex-wrap items-center gap-2">
                          <Input id="avatar-upload" type="file" accept="image/*" onChange={handleAvatarUpload} />
                          {avatarData && (
                            <Button type="button" variant="outline" onClick={handleAvatarRemove}>
                              Remove avatar
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div
                ref={(el) => { customizationSectionRefs.current.modality = el; }}
                className="rounded-xl border border-border"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => toggleCustomizationSection('modality')}
                >
                  <div>
                    <p className="font-medium">Modality</p>
                    <p className="text-xs text-muted-foreground">
                      Configure text plus optional speech input/output.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activeCustomizationSection === 'modality' ? 'Hide' : 'Show'}</span>
                </button>
                {activeCustomizationSection === 'modality' && (
                  <div className="grid gap-4 border-t border-border px-4 py-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Input Modalities</p>
                      <p className="text-xs text-muted-foreground">Text input is always enabled.</p>
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={inputModalities.includes('speech')}
                          onChange={handleInputSpeechToggle}
                        />
                        Enable speech input
                      </label>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Output Modalities</p>
                      <p className="text-xs text-muted-foreground">Text output is always enabled.</p>
                      <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={outputModalities.includes('speech')}
                          onChange={handleOutputSpeechToggle}
                        />
                        Enable speech output
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div
                ref={(el) => { customizationSectionRefs.current.content = el; }}
                className="rounded-xl border border-border"
              >
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                  onClick={() => toggleCustomizationSection('content')}
                >
                  <div>
                    <p className="font-medium">Content</p>
                    <p className="text-xs text-muted-foreground">
                      Adapt responses using the selected user profile mapping.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{activeCustomizationSection === 'content' ? 'Hide' : 'Show'}</span>
                </button>
                {activeCustomizationSection === 'content' && (
                  <div className="space-y-3 border-t border-border px-4 py-4">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={adaptContentToUserProfile}
                        onChange={(event) => setAdaptContentToUserProfile(event.target.checked)}
                      />
                      Adapt content to user profile
                    </label>
                    <p className="text-xs text-muted-foreground">
                      The profile used for adaptation is selected in User Profile Mapping.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Enable this option to tailor generated responses to the selected profile and its attributes.
                    </p>
                  </div>
                )}
              </div>

              {SHOW_WIP_AGENT_CONFIG_FIELDS && (
                <div
                  ref={(el) => { customizationSectionRefs.current.behavior = el; }}
                  className="rounded-xl border border-border"
                >
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                    onClick={() => toggleCustomizationSection('behavior')}
                  >
                    <div>
                      <p className="font-medium">Behavior</p>
                      <p className="text-xs text-muted-foreground">
                        Define response timing and delivery style.
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activeCustomizationSection === 'behavior' ? 'Hide' : 'Show'}</span>
                  </button>
                  {activeCustomizationSection === 'behavior' && (
                    <div className="space-y-1.5 border-t border-border px-4 py-4 md:max-w-sm">
                      <Label htmlFor="response-timing">Response Timing</Label>
                      <select
                        id="response-timing"
                        className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={responseTiming}
                        onChange={(event) => setResponseTiming(event.target.value)}
                      >
                        <option value="instant">Instant</option>
                        <option value="delayed">Simulated Thinking</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Save this customization</CardTitle>
                <CardDescription>
                  When you're done filling in the form above, name your customization and save it here. Saved customizations show up in the "Load a saved customization" picker at the top of the page so you can switch between them later.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="configuration-name">Customization Name</Label>
                  <Input
                    id="configuration-name"
                    value={configurationName}
                    placeholder="Give this setup a name"
                    onChange={(event) => setConfigurationName(event.target.value)}
                  />
                  {activeConfigId ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">Active</Badge>
                      <span>{activeConfigName || 'Unnamed customization'}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not linked to a saved customization yet.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="saved-configurations">Saved Customizations</Label>
                  <select
                    id="saved-configurations"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedConfigId}
                    onChange={(event) => setSelectedConfigId(event.target.value)}
                    disabled={savedConfigs.length === 0}
                  >
                    <option value="">
                      {savedConfigs.length === 0 ? 'No saved customizations yet' : 'Select a customization'}
                    </option>
                    {savedConfigs.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                  {selectedConfig && (
                    <p className="text-xs text-muted-foreground">
                      Last updated {new Date(selectedConfig.savedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => handleLoadSavedConfiguration()} disabled={!selectedConfigId}>
                    Load Selected
                  </Button>
                  <Button type="button" variant="outline" onClick={() => handleDeleteSavedConfiguration()} disabled={!selectedConfigId}>
                    Delete
                  </Button>
                </div>

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={handleSaveAndApply} disabled={isLoading}>
                    {isLoading ? 'Applying...' : 'Save & Apply Configuration'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleResetToDefaults} disabled={isLoading}>
                    Reset to Defaults
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Import / Export</CardTitle>
                <CardDescription>
                  Download or upload configuration files.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={handleDownload}>
                    Download JSON
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:border-brand/30">
                    Upload JSON
                    <input type="file" accept="application/json" className="hidden" onChange={handleUpload} />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Uploading replaces the current form values but does not auto-save.
                </p>
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </form>
      </div>
    </div>
  );
};
