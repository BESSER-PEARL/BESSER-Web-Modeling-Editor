import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BACKEND_URL } from '../../shared/constants/constant';
import { useAppDispatch } from '../../app/store/hooks';
import { bumpEditorRevision, refreshProjectStateThunk, updateDiagramModelThunk } from '../../app/store/workspaceSlice';
import { LocalStorageRepository, type SystemConfiguration } from '../../shared/services/storage/local-storage-repository';
import type {
  StoredAgentConfiguration,
  StoredUserProfile,
} from '../../shared/services/storage/local-storage-types';
import type {
  AgentConfigurationPayload,
  AgentLLMConfiguration,
  AgentLLMProvider,
  AgentLanguageComplexity,
  AgentSentenceLength,
  IntentRecognitionTechnology,
  InterfaceStyleSetting,
  VoiceStyleSetting,
} from '../../shared/types/agent-config';
import { isUMLModel, getActiveDiagram } from '../../shared/types/project';
import { useProject } from '../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { globalConfirm } from '../../shared/services/confirm/globalConfirm';

type AgentTransformationConfig = Partial<AgentConfigurationPayload> & { userProfileModel?: UMLModel };

type AgentModelVariantSnapshot = {
  id: string;
  profileId: string;
  profileName: string;
  configurationId: string;
  configurationName: string;
  createdAt: string;
  model: UMLModel;
};

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

  let llm: AgentLLMConfiguration | Record<string, never> = {};
  if (raw.llm && typeof raw.llm === 'object') {
    const provider = ((raw.llm as Partial<AgentLLMConfiguration>).provider ?? '') as AgentLLMProvider;
    const model = ((raw.llm as Partial<AgentLLMConfiguration>).model ?? '') as string;
    if (provider) {
      llm = { provider, model };
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

const hasLLMConfiguration = (value: AgentConfigurationPayload['llm']): value is AgentLLMConfiguration =>
  'provider' in value && Boolean(value.provider);

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

const toVariantList = (raw: unknown): AgentModelVariantSnapshot[] => {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter((entry): entry is AgentModelVariantSnapshot => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<AgentModelVariantSnapshot>;
    return (
      typeof candidate.id === 'string' &&
      typeof candidate.profileId === 'string' &&
      typeof candidate.profileName === 'string' &&
      typeof candidate.configurationId === 'string' &&
      typeof candidate.configurationName === 'string' &&
      typeof candidate.createdAt === 'string' &&
      Boolean(candidate.model)
    );
  });
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
  configRecord: Record<string, unknown> | undefined,
  availableProfiles: StoredUserProfile[],
): string => {
  if (!configRecord) {
    return '';
  }

  const activeVariantId = typeof configRecord.activePersonalizedVariantId === 'string'
    ? configRecord.activePersonalizedVariantId
    : '';
  if (!activeVariantId) {
    return '';
  }

  const activeVariant = toVariantList(configRecord.personalizedVariants)
    .find((entry) => entry.id === activeVariantId);
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

const buildApiUrl = (path: string): string => {
  const normalizedBaseRaw = BACKEND_URL?.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;
  const normalizedBase = normalizedBaseRaw || '';
  const apiBase = normalizedBase.endsWith('/besser_api') ? normalizedBase : `${normalizedBase}/besser_api`;
  return `${apiBase}/${path}`;
};

const loadInitialState = () => {
  const savedConfigurations = LocalStorageRepository.getAgentConfigurations();

  if (savedConfigurations.length > 0) {
    const activeId = LocalStorageRepository.getActiveAgentConfigurationId();
    const active = activeId ? savedConfigurations.find((entry) => entry.id === activeId) : savedConfigurations[0];
    const selected = active || savedConfigurations[0];

    return {
      config: normalizeAgentConfiguration(selected.config),
      activeId: selected.id,
      activeName: selected.name,
      savedConfigs: savedConfigurations,
    };
  }

  try {
    const stored = LocalStorageRepository.getLegacyAgentConfig();
    if (stored) {
      const legacyConfig = JSON.parse(stored);
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

export const AgentConfigurationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();

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
  const [selectedConfigId, setSelectedConfigId] = useState<string>(initialSavedConfigs[0]?.id || '');
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
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyleSetting>({ ...initialConfig.voiceStyle });
  const [avatarData, setAvatarData] = useState<string | null>(initialConfig.avatar || null);
  const [useAbbreviations, setUseAbbreviations] = useState<boolean>(initialConfig.useAbbreviations);
  const [adaptContentToUserProfile, setAdaptContentToUserProfile] = useState<boolean>(initialConfig.adaptContentToUserProfile);
  const [intentRecognitionTechnology, setIntentRecognitionTechnology] = useState<IntentRecognitionTechnology>(
    initialConfig.intentRecognitionTechnology,
  );
  const [activeCustomizationSection, setActiveCustomizationSection] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'system' | 'personalization'>('system');
  const [systemConfig, setSystemConfig] = useState<SystemConfiguration>(() =>
    LocalStorageRepository.getSystemConfiguration(),
  );
  const updateSystemConfig = useCallback((patch: Partial<SystemConfiguration>) => {
    setSystemConfig((prev) => {
      const next = { ...prev, ...patch };
      LocalStorageRepository.saveSystemConfiguration(next);
      return next;
    });
  }, []);

  const selectedConfig = savedConfigs.find((entry) => entry.id === selectedConfigId) || null;

  const currentAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
  const currentUserDiagram = currentProject ? getActiveDiagram(currentProject, 'UserDiagram') : undefined;

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

    const nextId = hasPreferred
      ? (preferredId as string)
      : hasActive
        ? (activeId as string)
        : configs[0].id;

    const next = configs.find((entry) => entry.id === nextId) || configs[0];
    setSelectedConfigId(next.id);
    setActiveConfigId(hasActive ? (activeId as string) : next.id);
    setActiveConfigName(hasActive ? (configs.find((entry) => entry.id === activeId)?.name || '') : next.name);

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

    const llmConfig = normalized.llm as Partial<AgentLLMConfiguration>;
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
    const diagramConfigRecord = (agentDiagram?.config ?? {}) as Record<string, unknown>;

    if (diagramConfig && Object.keys(diagramConfig).length > 0) {
      const preferredProfileName = resolveProfileNameFromVariant(diagramConfigRecord, tabUserProfiles)
        || resolveProfileNameFromMapping(LocalStorageRepository.getActiveAgentConfigurationId() || '', tabUserProfiles);

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
    } catch {
      // Ignore broken legacy payloads
    }
  }, [currentProject?.id, applyConfiguration, tabUserProfiles]);

  const getConfigObject = useCallback((): AgentConfigurationPayload => {
    const resolvedModel = llmModel === 'other' ? customModel.trim() : llmModel;
    const llm: AgentLLMConfiguration | Record<string, never> =
      llmProvider && resolvedModel
        ? { provider: llmProvider, model: resolvedModel }
        : {};

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
        updateActiveAgentDiagramConfig(currentProject, config as unknown as Record<string, unknown>);
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const proceed = await confirmOverwriteIfNameCollides(configurationName);
    if (!proceed) return;
    const result = saveConfiguration();
    if (!result.ok || !result.savedEntry) {
      return;
    }
    toast.success(`Configuration "${result.savedEntry.name}" saved.`);
  };

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
      updateActiveAgentDiagramConfig(currentProject, stored.config as unknown as Record<string, unknown>);
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

  const handleDeleteSavedConfiguration = useCallback((configId?: string) => {
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

    refreshSavedConfigurations();
    toast.success('Configuration deleted.');
  }, [activeConfigId, refreshSavedConfigurations, selectedConfigId]);

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

    try {
      setLoadingMessage('Applying predefined literature-based mapping to recommend a fitting configuration.');
      setIsLoading(true);

      const payload = {
        userProfileName: selectedProfile.name,
        userProfileModel: cloneModel(selectedProfile.model),
        currentConfig: buildStructuredExport(getConfigObject()),
      };

      const response = await fetch(buildApiUrl('recommend-agent-config-mapping'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(`Failed to get mapping-based recommendation: ${errorText || response.statusText}`);
        return;
      }

      const recommendation = await response.json();
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

    try {
      setLoadingMessage('This might take a while to cook up the best LLM-based configuration for your selected user profile.');
      setIsLoading(true);

      const payload = {
        userProfileName: selectedProfile.name,
        userProfileModel: cloneModel(selectedProfile.model),
        currentConfig: buildStructuredExport(getConfigObject()),
        model: 'gpt-5',
      };

      const response = await fetch(buildApiUrl('recommend-agent-config-llm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        toast.error(`Failed to get LLM recommendation: ${errorText || response.statusText}`);
        return;
      }

      const recommendation = await response.json();
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
    } catch (error) {
      console.error('Failed to fetch LLM recommendation:', error);
      toast.error('An unexpected error occurred while requesting an LLM-based recommendation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    applyConfiguration(createDefaultConfig());
    setActiveCustomizationSection(null);
    setConfigurationName(DEFAULT_CONFIG_NAME);
    setActiveConfigId(null);
    setActiveConfigName('');
    setSelectedConfigId('');
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

      const response = await fetch(buildApiUrl('transform-agent-model-json'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        toast.error(`Failed to transform agent model: ${message || response.statusText}`);
        return;
      }

      const transformedModel: unknown = await response.json();
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
          const currentConfigRecord = (currentAgentDiagram.config ?? {}) as Record<string, unknown>;
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

          const existingVariants = toVariantList(currentConfigRecord.personalizedVariants)
            .filter((entry) => entry.id !== variantId);

          const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
          const latestAgentDiagram = getActiveDiagram(latestProject, 'AgentDiagram') || currentAgentDiagram;
          const latestConfigRecord = (latestAgentDiagram.config ?? {}) as Record<string, unknown>;
          const latestVariants = toVariantList(latestConfigRecord.personalizedVariants)
            .filter((entry) => entry.id !== variantId);

          updateActiveAgentDiagramConfig(currentProject, {
            ...latestConfigRecord,
            ...(config as unknown as Record<string, unknown>),
            personalizedVariants: [...latestVariants, nextVariant],
            activePersonalizedVariantId: variantId,
          });

          await dispatch(refreshProjectStateThunk()).unwrap();
        }

        LocalStorageRepository.saveAgentProfileConfigurationMapping(selectedProfile, result.savedEntry);
        toast.success('Configuration transformed, saved, and applied successfully.');
        setSelectedConfigId(result.savedEntry.id);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Configuration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your agent behavior and personalization settings using the same workflow as the previous panel.
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
            aria-selected={activeTab === 'system'}
            onClick={() => setActiveTab('system')}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'system'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            System Configuration
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

        {activeTab === 'system' && (
          <Card>
            <CardHeader>
              <CardTitle>System Configuration</CardTitle>
              <CardDescription>
                These runtime settings are used every time an agent is generated. Changes are saved automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="system-agent-platform">Platform</Label>
                  <select
                    id="system-agent-platform"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={systemConfig.agentPlatform}
                    onChange={(event) => updateSystemConfig({ agentPlatform: event.target.value })}
                  >
                    <option value="websocket">WebSocket</option>
                    <option value="streamlit">WebSocket with Streamlit interface</option>
                    <option value="telegram">Telegram</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="system-intent-recognition">Intent Recognition</Label>
                  <select
                    id="system-intent-recognition"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={systemConfig.intentRecognitionTechnology}
                    onChange={(event) =>
                      updateSystemConfig({
                        intentRecognitionTechnology: event.target.value as IntentRecognitionTechnology,
                      })
                    }
                  >
                    <option value="classical">Classical</option>
                    <option value="llm-based">LLM-based</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="system-llm-provider">LLM Provider (optional)</Label>
                  <select
                    id="system-llm-provider"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={systemConfig.agentLlmProvider}
                    onChange={(event) => {
                      const provider = event.target.value as AgentLLMProvider;
                      updateSystemConfig({
                        agentLlmProvider: provider,
                        agentLlmModel: '',
                        agentCustomLlmModel: '',
                      });
                    }}
                  >
                    <option value="">None</option>
                    <option value="openai">OpenAI</option>
                    <option value="huggingface">HuggingFace</option>
                    <option value="huggingfaceapi">HuggingFace API</option>
                    <option value="replicate">Replicate</option>
                  </select>
                </div>

                {systemConfig.agentLlmProvider === 'openai' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="system-openai-model">OpenAI Model</Label>
                    <select
                      id="system-openai-model"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={systemConfig.agentLlmModel}
                      onChange={(event) => {
                        const value = event.target.value;
                        updateSystemConfig({
                          agentLlmModel: value,
                          ...(value !== 'other' ? { agentCustomLlmModel: '' } : {}),
                        });
                      }}
                    >
                      <option value="">None</option>
                      <option value="gpt-5">GPT-5</option>
                      <option value="gpt-5-mini">GPT-5 Mini</option>
                      <option value="gpt-5-nano">GPT-5 Nano</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                )}

                {systemConfig.agentLlmProvider === 'openai' && systemConfig.agentLlmModel === 'other' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="system-openai-custom-model">Custom Model Name</Label>
                    <Input
                      id="system-openai-custom-model"
                      value={systemConfig.agentCustomLlmModel}
                      onChange={(event) => updateSystemConfig({ agentCustomLlmModel: event.target.value })}
                      placeholder="Enter model name"
                    />
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                These values are saved to browser storage as you type and are used whenever you generate an agent.
              </p>
            </CardContent>
          </Card>
        )}

        <form
          onSubmit={handleSubmit}
          className={`flex flex-col gap-6 ${activeTab === 'personalization' ? '' : 'hidden'}`}
          aria-hidden={activeTab !== 'personalization'}
        >
          <Card>
            <CardHeader>
              <CardTitle>User Profile Mapping</CardTitle>
              <CardDescription>
                Select the user profile that should guide personalization and automatic configuration proposals.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user-profile-mapping">User Profile Mapping (for Save &amp; Apply)</Label>
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
                          min={10}
                          max={32}
                          value={interfaceStyle.size}
                          onChange={(event) => updateInterfaceStyle('size', Number(event.target.value))}
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
                          min={1}
                          max={3}
                          step={0.1}
                          value={interfaceStyle.lineSpacing}
                          onChange={(event) => updateInterfaceStyle('lineSpacing', Number(event.target.value))}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
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
                        <Label htmlFor="interface-color">Color</Label>
                        <Input
                          id="interface-color"
                          type="text"
                          value={interfaceStyle.color}
                          onChange={(event) => updateInterfaceStyle('color', event.target.value)}
                        />
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
                      The profile used for adaptation is selected in User Profile Mapping (for Save &amp; Apply).
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
                <CardTitle>Configuration Actions</CardTitle>
                <CardDescription>
                  Save, load, delete, and apply configuration variants.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="configuration-name">Configuration Name</Label>
                  <Input
                    id="configuration-name"
                    value={configurationName}
                    placeholder="Give this setup a name"
                    onChange={(event) => setConfigurationName(event.target.value)}
                  />
                  {activeConfigId ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">Active</Badge>
                      <span>{activeConfigName || 'Unnamed configuration'}</span>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not linked to a saved configuration yet.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="saved-configurations">Saved Configurations</Label>
                  <select
                    id="saved-configurations"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedConfigId}
                    onChange={(event) => setSelectedConfigId(event.target.value)}
                    disabled={savedConfigs.length === 0}
                  >
                    <option value="">
                      {savedConfigs.length === 0 ? 'No saved configurations yet' : 'Select a configuration'}
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
                  <Button type="submit" variant="secondary" disabled={isLoading}>
                    Save Configuration
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
        </form>
      </div>
    </div>
  );
};
