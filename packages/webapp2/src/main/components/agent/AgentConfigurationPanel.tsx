import React, { useEffect, useMemo, useState } from 'react';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
import { isUMLModel } from '../../types/project';
import { useProject } from '../../hooks/useProject';
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
    color: '#111827',
    contrast: 'medium',
  },
  voiceStyle: {
    gender: 'ambiguous',
    speed: 1,
  },
  avatar: null,
  useAbbreviations: false,
  adaptContentToUserProfile: false,
  userProfileName: null,
  intentRecognitionTechnology: 'classical',
});

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
    inputModalities: Array.isArray(raw.inputModalities) && raw.inputModalities.length > 0
      ? raw.inputModalities
      : base.inputModalities,
    outputModalities: Array.isArray(raw.outputModalities) && raw.outputModalities.length > 0
      ? raw.outputModalities
      : base.outputModalities,
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

const modalityOptions = ['text', 'voice', 'image', 'video'];

export const AgentConfigurationPanel: React.FC = () => {
  const { currentProject } = useProject();
  const [configurationName, setConfigurationName] = useState(DEFAULT_CONFIG_NAME);
  const [profileName, setProfileName] = useState('');
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [selectedMappingConfigId, setSelectedMappingConfigId] = useState('');
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);

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

  const currentAgentDiagram = currentProject?.diagrams?.AgentDiagram;
  const currentUserDiagram = currentProject?.diagrams?.UserDiagram;

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

  useEffect(() => {
    refreshData();
  }, []);

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
    setConfig((previous) => {
      const provider = (previous.llm as any)?.provider as AgentLLMProvider | undefined;
      if (!provider) {
        return previous;
      }
      return { ...previous, llm: { provider, model } };
    });
  };

  const toggleModality = (kind: 'input' | 'output', value: string) => {
    if (kind === 'input') {
      const next = config.inputModalities.includes(value)
        ? config.inputModalities.filter((entry) => entry !== value)
        : [...config.inputModalities, value];
      updateConfig('inputModalities', next.length > 0 ? next : ['text']);
      return;
    }

    const next = config.outputModalities.includes(value)
      ? config.outputModalities.filter((entry) => entry !== value)
      : [...config.outputModalities, value];
    updateConfig('outputModalities', next.length > 0 ? next : ['text']);
  };

  const handleSaveConfiguration = () => {
    const resolvedName = configurationName.trim() || DEFAULT_CONFIG_NAME;

    const payload: AgentConfigurationPayload = {
      ...config,
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

    setConfigurationName(saved.name);
    setSelectedConfigId(saved.id);
    setSelectedMappingConfigId(saved.id);
    setActiveConfigId(saved.id);
    refreshData();
    toast.success(`Agent configuration "${saved.name}" saved.`);
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

    setConfigurationName(selected.name);
    setConfig(normalizeConfig(selected.config));
    LocalStorageRepository.setActiveAgentConfigurationId(selected.id);
    localStorage.setItem(LEGACY_AGENT_CONFIG_KEY, JSON.stringify(selected.config));
    setActiveConfigId(selected.id);
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
                  <option value="streamlit">Streamlit</option>
                  <option value="gradio">Gradio</option>
                  <option value="web">Web</option>
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
                    <option value="normal">Normal</option>
                    <option value="deliberate">Deliberate</option>
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

            {SHOW_FULL_AGENT_CONFIGURATION && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Input Modalities</Label>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {modalityOptions.map((option) => (
                      <label key={`in-${option}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={config.inputModalities.includes(option)}
                          onChange={() => toggleModality('input', option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Output Modalities</Label>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {modalityOptions.map((option) => (
                      <label key={`out-${option}`} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={config.outputModalities.includes(option)}
                          onChange={() => toggleModality('output', option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
              <div className="space-y-1.5">
                <Label htmlFor="llm-model">LLM Model</Label>
                <Input
                  id="llm-model"
                  value={llmModel}
                  onChange={(event) => setLlmModel(event.target.value)}
                  placeholder="e.g. gpt-5-mini"
                />
              </div>
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
