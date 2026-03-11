import React, { useEffect, useMemo, useState } from 'react';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BACKEND_URL } from '../../constant';
import { useAppDispatch } from '../../store/hooks';
import { updateDiagramModelThunk } from '../../services/workspace/workspaceSlice';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import {
  StoredAgentConfiguration,
  StoredAgentProfileConfigurationMapping,
  StoredUserProfile,
} from '../../services/local-storage/local-storage-types';
import {
  AgentConfigurationPayload,
  AgentLLMProvider,
  AgentLanguageComplexity,
  AgentSentenceLength,
  IntentRecognitionTechnology,
} from '../../types/agent-config';
import { isUMLModel, getActiveDiagram } from '../../types/project';
import { useProject } from '../../hooks/useProject';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { SHOW_FULL_AGENT_CONFIGURATION } from '../../constant';

const DEFAULT_CONFIG_NAME = 'Default Agent Configuration';
const LEGACY_AGENT_CONFIG_KEY = 'agentConfig';

const defaultAgentConfig = (): AgentConfigurationPayload => ({
  agentLanguage: 'original',
  inputModalities: ['text'],
  outputModalities: ['text'],
  agentPlatform: 'streamlit',
  responseTiming: 'instant',
  agentStyle: 'original',
  llm: {},
  languageComplexity: 'original',
  sentenceLength: 'original',
  interfaceStyle: {
    size: 16,
    font: 'sans',
    lineSpacing: 1.5,
    alignment: 'left',
    color: 'var(--apollon-primary-contrast)',
    contrast: 'medium',
  },
  voiceStyle: {
    gender: 'male',
    speed: 1,
  },
  avatar: null,
  useAbbreviations: false,
  adaptContentToUserProfile: false,
  userProfileName: null,
  intentRecognitionTechnology: 'classical',
});

const knownLLMModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'mistral-7b', 'falcon-40b', 'llama-3-8b', 'bloom-176b'];

const baseTextModality = ['text'];
const speechEnabledModality = ['text', 'speech'];

const normalizeConfig = (raw: Partial<AgentConfigurationPayload> | null | undefined): AgentConfigurationPayload => {
  const base = defaultAgentConfig();
  if (!raw) {
    return base;
  }

  const llmProvider = (raw.llm as any)?.provider as AgentLLMProvider | undefined;
  const llmModel = (raw.llm as any)?.model as string | undefined;
  const llm = llmProvider ? { provider: llmProvider, model: llmModel || '' } : {};

  return {
    ...base,
    ...raw,
    inputModalities: Array.isArray(raw.inputModalities) && raw.inputModalities.includes('speech')
      ? [...speechEnabledModality]
      : [...baseTextModality],
    outputModalities: Array.isArray(raw.outputModalities) && raw.outputModalities.includes('speech')
      ? [...speechEnabledModality]
      : [...baseTextModality],
    interfaceStyle: {
      ...base.interfaceStyle,
      ...(raw.interfaceStyle || {}),
    },
    voiceStyle: {
      ...base.voiceStyle,
      ...(raw.voiceStyle || {}),
    },
    llm,
    userProfileName: raw.userProfileName ?? null,
  };
};

const cloneModel = (model: UMLModel): UMLModel => JSON.parse(JSON.stringify(model)) as UMLModel;

const deepEqual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

const buildSparseConfig = (config: AgentConfigurationPayload): Partial<AgentConfigurationPayload> => {
  const defaults = defaultAgentConfig();
  const sparse: Record<string, unknown> = {};
  for (const key of Object.keys(config) as (keyof AgentConfigurationPayload)[]) {
    if (!deepEqual(config[key], defaults[key])) {
      sparse[key] = config[key];
    }
  }
  return sparse as Partial<AgentConfigurationPayload>;
};

export const AgentConfigurationPanel: React.FC = () => {
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();
  const [configurationName, setConfigurationName] = useState(DEFAULT_CONFIG_NAME);
  const [isApplying, setIsApplying] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedMappingConfigId, setSelectedMappingConfigId] = useState('');
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [customModel, setCustomModel] = useState('');

  const [config, setConfig] = useState<AgentConfigurationPayload>(() => {
    const stored = localStorage.getItem(LEGACY_AGENT_CONFIG_KEY);
    if (!stored) {
      return defaultAgentConfig();
    }
    try {
      return normalizeConfig(JSON.parse(stored));
    } catch {
      return defaultAgentConfig();
    }
  });

  const [storedConfigurations, setStoredConfigurations] = useState<StoredAgentConfiguration[]>([]);
  const [storedProfiles, setStoredProfiles] = useState<StoredUserProfile[]>([]);
  const [storedMappings, setStoredMappings] = useState<StoredAgentProfileConfigurationMapping[]>([]);

  const currentAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
  const currentUserDiagram = undefined; // UserDiagram not yet supported in project structure

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

  const refreshData = () => {
    const configs = LocalStorageRepository.getAgentConfigurations();
    const profiles = LocalStorageRepository.getUserProfiles().filter(
      (profile) => profile.model?.type === UMLDiagramType.UserDiagram
    );
    const mappings = LocalStorageRepository.getAgentProfileConfigurationMappings();
    const active = LocalStorageRepository.getActiveAgentConfigurationId();

    setStoredConfigurations(configs);
    setStoredProfiles(profiles);
    setStoredMappings(mappings);
    setActiveConfigId(active);

    if (!selectedConfigId && configs.length > 0) {
      setSelectedConfigId(configs[0].id);
    }
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0].id);
    }
    if (!selectedMappingConfigId && configs.length > 0) {
      setSelectedMappingConfigId(configs[0].id);
    }
  };

  // Reload stored configurations whenever the component mounts or project changes
  useEffect(() => {
    refreshData();
  }, [currentProject?.id]);

  // Reload the config form from the project's agent diagram when the project changes
  useEffect(() => {
    if (!currentProject) return;
    const agentDiagram = getActiveDiagram(currentProject, 'AgentDiagram');
    const diagramConfig = agentDiagram?.config as Partial<AgentConfigurationPayload> | undefined;
    if (diagramConfig && Object.keys(diagramConfig).length > 0) {
      const normalized = normalizeConfig(diagramConfig);
      setConfig(normalized);
      // Restore custom model if the saved model is not in the known list
      const loadedModel = (normalized.llm as any)?.model as string | undefined;
      const loadedProvider = (normalized.llm as any)?.provider as AgentLLMProvider | undefined;
      if (loadedProvider && loadedModel && !knownLLMModels.includes(loadedModel)) {
        setCustomModel(loadedModel);
        setConfig((prev) => ({ ...prev, llm: { provider: loadedProvider, model: 'other' } }));
      } else {
        setCustomModel('');
      }
    }
  }, [currentProject?.id]);

  const updateConfig = <K extends keyof AgentConfigurationPayload>(key: K, value: AgentConfigurationPayload[K]) => {
    setConfig((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const setLlmProvider = (provider: AgentLLMProvider) => {
    setConfig((previous) => {
      const currentModel = (previous.llm as any)?.model || '';
      if (!provider) {
        return { ...previous, llm: {} };
      }
      return { ...previous, llm: { provider, model: currentModel } };
    });
  };

  const setLlmModel = (model: string) => {
    if (model !== 'other') {
      setCustomModel('');
    }
    setConfig((previous) => {
      const provider = (previous.llm as any)?.provider as AgentLLMProvider | undefined;
      if (!provider) {
        return previous;
      }
      return { ...previous, llm: { provider, model } };
    });
  };

  const handleInputSpeechToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('inputModalities', e.target.checked ? [...speechEnabledModality] : [...baseTextModality]);
  };

  const handleOutputSpeechToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateConfig('outputModalities', e.target.checked ? [...speechEnabledModality] : [...baseTextModality]);
  };

  const handleSaveConfiguration = () => {
    const resolvedName = configurationName.trim() || DEFAULT_CONFIG_NAME;

    // Resolve "other" model to the custom model name
    const resolvedLlm = (() => {
      const provider = (config.llm as any)?.provider as AgentLLMProvider | undefined;
      const model = (config.llm as any)?.model as string | undefined;
      if (!provider) return {};
      const resolvedModel = model === 'other' ? customModel : (model || '');
      return { provider, model: resolvedModel };
    })();

    const payload: AgentConfigurationPayload = {
      ...config,
      llm: resolvedLlm,
      userProfileName: config.adaptContentToUserProfile ? config.userProfileName : null,
    };

    const snapshot = currentAgentModel ? cloneModel(currentAgentModel) : null;
    const saved = LocalStorageRepository.saveAgentConfiguration(resolvedName, payload, {
      personalizedAgentModel: snapshot,
      originalAgentModel: snapshot,
    });

    if (currentAgentDiagram?.id && snapshot) {
      LocalStorageRepository.saveAgentBaseModel(currentAgentDiagram.id, snapshot);
    }

    LocalStorageRepository.setActiveAgentConfigurationId(saved.id);
    localStorage.setItem(LEGACY_AGENT_CONFIG_KEY, JSON.stringify(payload));

    // Persist agent config into the diagram so it travels with the project
    if (currentProject) {
      const agentDiagram = getActiveDiagram(currentProject, 'AgentDiagram');
      ProjectStorageRepository.updateDiagram(currentProject.id, 'AgentDiagram', {
        ...agentDiagram,
        config: payload as unknown as Record<string, unknown>,
      });
      // Redux sync happens automatically via useStorageSync
    }

    setConfigurationName(saved.name);
    setSelectedConfigId(saved.id);
    setSelectedMappingConfigId(saved.id);
    setActiveConfigId(saved.id);
    refreshData();
    toast.success(`Agent configuration "${saved.name}" saved.`);
  };

  const handleSaveAndApply = async () => {
    if (!currentAgentModel) {
      toast.error('No Agent Diagram model found in the project.');
      return;
    }

    // First save locally
    handleSaveConfiguration();

    // Build sparse config (only values differing from defaults)
    const resolvedLlm = (() => {
      const provider = (config.llm as any)?.provider as AgentLLMProvider | undefined;
      const model = (config.llm as any)?.model as string | undefined;
      if (!provider) return {};
      const resolvedModel = model === 'other' ? customModel : (model || '');
      return { provider, model: resolvedModel };
    })();

    const fullConfig: AgentConfigurationPayload = {
      ...config,
      llm: resolvedLlm,
      userProfileName: config.adaptContentToUserProfile ? config.userProfileName : null,
    };

    const sparseConfig = buildSparseConfig(fullConfig);

    // Optionally include user profile model
    const requestConfig: Record<string, unknown> = { ...sparseConfig };
    if (fullConfig.adaptContentToUserProfile && fullConfig.userProfileName && currentUserModel) {
      requestConfig.userProfileModel = cloneModel(currentUserModel);
    }

    const payload = {
      id: currentAgentDiagram?.id,
      title: currentAgentDiagram?.title || configurationName,
      model: currentAgentModel,
      lastUpdate: currentAgentDiagram?.lastUpdate,
      generator: 'agent',
      config: requestConfig,
    };

    setIsApplying(true);
    try {
      const res = await fetch(`${BACKEND_URL}/transform_agent_model_json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        toast.error(`Backend error: ${errorText}`);
        return;
      }

      const data = await res.json();
      const personalizedModel = data.model;

      if (personalizedModel) {
        const snapshotModel = cloneModel(personalizedModel);
        dispatch(updateDiagramModelThunk({ model: snapshotModel }));
        toast.success('Configuration transformed, saved, and applied successfully.');
      }
    } catch (err) {
      console.error('Save & Apply failed:', err);
      toast.error('Failed to apply configuration.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleLoadConfiguration = () => {
    if (!selectedConfigId) {
      toast.error('Select a configuration first.');
      return;
    }

    const selected = LocalStorageRepository.loadAgentConfiguration(selectedConfigId);
    if (!selected) {
      toast.error('Selected configuration was not found.');
      refreshData();
      return;
    }

    const normalized = normalizeConfig(selected.config);
    setConfigurationName(selected.name);
    setConfig(normalized);
    LocalStorageRepository.setActiveAgentConfigurationId(selected.id);
    localStorage.setItem(LEGACY_AGENT_CONFIG_KEY, JSON.stringify(selected.config));
    setActiveConfigId(selected.id);

    // Restore custom model if the saved model is not in the known list
    const loadedModel = (normalized.llm as any)?.model as string | undefined;
    const loadedProvider = (normalized.llm as any)?.provider as AgentLLMProvider | undefined;
    if (loadedProvider && loadedModel && !knownLLMModels.includes(loadedModel)) {
      setCustomModel(loadedModel);
      setConfig((prev) => ({ ...prev, llm: { provider: loadedProvider, model: 'other' } }));
    } else {
      setCustomModel('');
    }

    toast.success(`Loaded "${selected.name}".`);
  };

  const handleDeleteConfiguration = () => {
    if (!selectedConfigId) {
      toast.error('Select a configuration first.');
      return;
    }

    const selected = LocalStorageRepository.loadAgentConfiguration(selectedConfigId);
    if (!selected) {
      toast.error('Selected configuration was not found.');
      refreshData();
      return;
    }

    LocalStorageRepository.deleteAgentConfiguration(selected.id);

    if (activeConfigId === selected.id) {
      LocalStorageRepository.clearActiveAgentConfigurationId();
      setActiveConfigId(null);
    }

    setSelectedConfigId('');
    refreshData();
    toast.success(`Deleted "${selected.name}".`);
  };

  const handleSetActive = () => {
    if (!selectedConfigId) {
      toast.error('Select a configuration first.');
      return;
    }

    const selected = LocalStorageRepository.loadAgentConfiguration(selectedConfigId);
    if (!selected) {
      toast.error('Selected configuration was not found.');
      refreshData();
      return;
    }

    LocalStorageRepository.setActiveAgentConfigurationId(selected.id);
    localStorage.setItem(LEGACY_AGENT_CONFIG_KEY, JSON.stringify(selected.config));
    setActiveConfigId(selected.id);
    toast.success(`"${selected.name}" is now active.`);
  };

  const handleSaveUserProfile = () => {
    const resolvedName = profileName.trim();
    if (!resolvedName) {
      toast.error('Profile name is required.');
      return;
    }
    if (!currentUserModel) {
      toast.error('No User Diagram model found in the project.');
      return;
    }

    const saved = LocalStorageRepository.saveUserProfile(resolvedName, cloneModel(currentUserModel));
    setProfileName(saved.name);
    setSelectedProfileId(saved.id);
    refreshData();
    toast.success(`User profile "${saved.name}" saved.`);
  };

  const handleCreateMapping = () => {
    if (!selectedProfileId || !selectedMappingConfigId) {
      toast.error('Select both a user profile and an agent configuration.');
      return;
    }

    const profile = LocalStorageRepository.loadUserProfile(selectedProfileId);
    const configuration = LocalStorageRepository.loadAgentConfiguration(selectedMappingConfigId);

    if (!profile || !configuration) {
      toast.error('Could not load selected profile or configuration.');
      refreshData();
      return;
    }

    LocalStorageRepository.saveAgentProfileConfigurationMapping(profile, configuration);
    refreshData();
    toast.success(`Mapping "${profile.name} -> ${configuration.name}" saved.`);
  };

  const handleDeleteMapping = (mappingId: string) => {
    LocalStorageRepository.deleteAgentProfileConfigurationMapping(mappingId);
    refreshData();
    toast.success('Mapping removed.');
  };

  const mappedProfileNames = useMemo(() => new Set(storedProfiles.map((profile) => profile.name)), [storedProfiles]);
  const llmProvider = ((config.llm as any)?.provider as AgentLLMProvider) || '';
  const llmModel = ((config.llm as any)?.model as string) || '';

  return (
    <div className="h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Agent Configuration</CardTitle>
            <CardDescription>
              {SHOW_FULL_AGENT_CONFIGURATION
                ? 'Configure generation settings for Agent Diagram and manage profile-based personalization mappings.'
                : 'Configure system-level agent runtime settings.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {SHOW_FULL_AGENT_CONFIGURATION && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="saved-config">Saved Configurations</Label>
                    <select
                      id="saved-config"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={selectedConfigId}
                      onChange={(event) => setSelectedConfigId(event.target.value)}
                    >
                      <option value="">Select configuration</option>
                      {storedConfigurations.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name}
                          {activeConfigId === entry.id ? ' (active)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button variant="outline" onClick={handleLoadConfiguration} className="w-full">
                      Load
                    </Button>
                    <Button variant="outline" onClick={handleSetActive} className="w-full">
                      Set Active
                    </Button>
                    <Button variant="outline" onClick={handleDeleteConfiguration} className="w-full">
                      Delete
                    </Button>
                  </div>
                </div>

                <Separator />
              </>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {SHOW_FULL_AGENT_CONFIGURATION && (
                <div className="space-y-1.5">
                  <Label htmlFor="config-name">Configuration Name</Label>
                  <Input
                    id="config-name"
                    value={configurationName}
                    onChange={(event) => setConfigurationName(event.target.value)}
                    placeholder={DEFAULT_CONFIG_NAME}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="agent-platform">Platform</Label>
                <select
                  id="agent-platform"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.agentPlatform}
                  onChange={(event) => updateConfig('agentPlatform', event.target.value)}
                >
                  <option value="websocket">WebSocket</option>
                  <option value="streamlit">WebSocket with Streamlit interface</option>
                  <option value="telegram">Telegram</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="intent-tech">Intent Recognition</Label>
                <select
                  id="intent-tech"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.intentRecognitionTechnology}
                  onChange={(event) =>
                    updateConfig('intentRecognitionTechnology', event.target.value as IntentRecognitionTechnology)
                  }
                >
                  <option value="classical">Classical</option>
                  <option value="llm-based">LLM-based</option>
                </select>
              </div>
              {SHOW_FULL_AGENT_CONFIGURATION && (
                <div className="space-y-1.5">
                  <Label htmlFor="response-timing">Response Timing</Label>
                  <select
                    id="response-timing"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={config.responseTiming}
                    onChange={(event) => updateConfig('responseTiming', event.target.value)}
                  >
                    <option value="instant">Instant</option>
                    <option value="delayed">Simulated Thinking</option>
                  </select>
                </div>
              )}
              {SHOW_FULL_AGENT_CONFIGURATION && (
                <div className="space-y-1.5">
                  <Label htmlFor="language-complexity">Language Complexity</Label>
                  <select
                    id="language-complexity"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={config.languageComplexity}
                    onChange={(event) => updateConfig('languageComplexity', event.target.value as AgentLanguageComplexity)}
                  >
                    <option value="original">Original</option>
                    <option value="simple">Simple</option>
                    <option value="medium">Medium</option>
                    <option value="complex">Complex</option>
                  </select>
                </div>
              )}
              {SHOW_FULL_AGENT_CONFIGURATION && (
                <div className="space-y-1.5">
                  <Label htmlFor="sentence-length">Sentence Length</Label>
                  <select
                    id="sentence-length"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={config.sentenceLength}
                    onChange={(event) => updateConfig('sentenceLength', event.target.value as AgentSentenceLength)}
                  >
                    <option value="original">Original</option>
                    <option value="concise">Concise</option>
                    <option value="verbose">Verbose</option>
                  </select>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Input Modalities</Label>
                <p className="text-xs text-muted-foreground">Text input is always enabled.</p>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={config.inputModalities.includes('speech')}
                    onChange={handleInputSpeechToggle}
                  />
                  Enable speech input
                </label>
              </div>
              <div className="space-y-2">
                <Label>Output Modalities</Label>
                <p className="text-xs text-muted-foreground">Text output is always enabled.</p>
                <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={config.outputModalities.includes('speech')}
                    onChange={handleOutputSpeechToggle}
                  />
                  Enable speech output
                </label>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="llm-provider">LLM Provider</Label>
                <select
                  id="llm-provider"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={llmProvider}
                  onChange={(event) => setLlmProvider(event.target.value as AgentLLMProvider)}
                >
                  <option value="">None</option>
                  <option value="openai">OpenAI</option>
                  <option value="huggingface">Hugging Face</option>
                  <option value="huggingfaceapi">Hugging Face API</option>
                  <option value="replicate">Replicate</option>
                </select>
              </div>
              {llmProvider === 'openai' && (
                <div className="space-y-1.5">
                  <Label htmlFor="llm-model">OpenAI Model</Label>
                  <select
                    id="llm-model"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={knownLLMModels.includes(llmModel) || llmModel === '' ? llmModel : 'other'}
                    onChange={(event) => setLlmModel(event.target.value)}
                    disabled={!llmProvider}
                  >
                    <option value="">None</option>
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5-mini">GPT-5 Mini</option>
                    <option value="gpt-5-nano">GPT-5 Nano</option>
                    <option value="other">Other</option>
                  </select>
                  {llmModel === 'other' && (
                    <div className="mt-2 space-y-1.5">
                      <Label htmlFor="custom-model">Custom Model Name</Label>
                      <Input
                        id="custom-model"
                        value={customModel}
                        onChange={(event) => setCustomModel(event.target.value)}
                        placeholder="Enter model name"
                      />
                    </div>
                  )}
                </div>
              )}
              {(llmProvider === 'huggingface' || llmProvider === 'huggingfaceapi' || llmProvider === 'replicate') && (
                <div className="space-y-1.5">
                  <Label htmlFor="llm-model">
                    {llmProvider === 'huggingface' ? 'HuggingFace Model' : llmProvider === 'huggingfaceapi' ? 'HuggingFace API Model' : 'Replicate Model'}
                  </Label>
                  <select
                    id="llm-model"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={knownLLMModels.includes(llmModel) || llmModel === '' ? llmModel : 'other'}
                    onChange={(event) => setLlmModel(event.target.value)}
                    disabled={!llmProvider}
                  >
                    <option value="">None</option>
                    <option value="mistral-7b">Mistral-7B</option>
                    <option value="falcon-40b">Falcon-40B</option>
                    <option value="llama-3-8b">Llama-3 8B</option>
                    <option value="bloom-176b">Bloom-176B</option>
                    <option value="other">Other</option>
                  </select>
                  {llmModel === 'other' && (
                    <div className="mt-2 space-y-1.5">
                      <Label htmlFor="custom-model">Custom Model Name</Label>
                      <Input
                        id="custom-model"
                        value={customModel}
                        onChange={(event) => setCustomModel(event.target.value)}
                        placeholder="Enter model name"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            {SHOW_FULL_AGENT_CONFIGURATION && (
              <div className="space-y-2">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={config.adaptContentToUserProfile}
                    onChange={(event) => updateConfig('adaptContentToUserProfile', event.target.checked)}
                  />
                  Adapt content to user profile
                </label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={config.userProfileName ?? ''}
                  onChange={(event) => updateConfig('userProfileName', event.target.value || null)}
                  disabled={!config.adaptContentToUserProfile}
                >
                  <option value="">Select profile</option>
                  {storedProfiles.map((profile) => (
                    <option key={profile.id} value={profile.name}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                {config.userProfileName && !mappedProfileNames.has(config.userProfileName) && (
                  <p className="text-xs text-amber-700">Selected profile name is not stored locally yet.</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSaveConfiguration}>Save Configuration</Button>
              <Button onClick={handleSaveAndApply} disabled={isApplying || !currentAgentModel}>
                {isApplying ? 'Applying...' : 'Save & Apply Configuration'}
              </Button>
              {SHOW_FULL_AGENT_CONFIGURATION && (
                <Button
                  variant="outline"
                  onClick={() => {
                    localStorage.setItem(LEGACY_AGENT_CONFIG_KEY, JSON.stringify(config));
                    toast.success('Current editor values stored as default agentConfig.');
                  }}
                >
                  Save as Local Default
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {SHOW_FULL_AGENT_CONFIGURATION && (
          <Card>
            <CardHeader>
              <CardTitle>User Profiles</CardTitle>
              <CardDescription>
                Save the project User Diagram as named profiles and map them to agent configurations.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label htmlFor="profile-name">Profile Name</Label>
                  <Input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    placeholder="e.g. Senior User"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={handleSaveUserProfile} className="w-full">
                    Save User Profile
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Current project User Diagram status: {currentUserModel ? 'available' : 'missing'}.
              </p>

              <Separator />

              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="map-profile">User Profile</Label>
                  <select
                    id="map-profile"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedProfileId}
                    onChange={(event) => setSelectedProfileId(event.target.value)}
                  >
                    <option value="">Select profile</option>
                    {storedProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="map-config">Agent Configuration</Label>
                  <select
                    id="map-config"
                    className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedMappingConfigId}
                    onChange={(event) => setSelectedMappingConfigId(event.target.value)}
                  >
                    <option value="">Select configuration</option>
                    {storedConfigurations.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <Button variant="outline" onClick={handleCreateMapping} className="w-full">
                    Save Mapping
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {storedMappings.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No personalization mappings yet.</p>
                ) : (
                  storedMappings.map((mapping) => (
                    <div
                      key={mapping.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{mapping.userProfileName}</span>
                        <span className="mx-1 text-muted-foreground">-&gt;</span>
                        <span>{mapping.agentConfigurationName}</span>
                        <div className="text-xs text-muted-foreground">
                          Saved {new Date(mapping.savedAt).toLocaleString()}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => handleDeleteMapping(mapping.id)}>
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
