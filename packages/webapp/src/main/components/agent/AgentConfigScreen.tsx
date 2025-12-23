import React, { useCallback, useState } from 'react';
import { Card, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import styled from 'styled-components';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import { StoredAgentConfiguration } from '../../services/local-storage/local-storage-types';
import {
    AgentConfigurationPayload,
    AgentLLMConfiguration,
    AgentLLMProvider,
    AgentLanguageComplexity,
    AgentSentenceLength,
    IntentRecognitionTechnology,
    InterfaceStyleSetting,
    VoiceStyleSetting
} from '../../types/agent-config';

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

const defaultIntentRecognitionTechnology: IntentRecognitionTechnology = 'classical';

const PageContainer = styled.div`
  padding: 32px 40px;
  min-height: calc(100vh - 60px);
  background-color: var(--apollon-background);
  display: flex;
  flex-direction: column;
  width: 100%;
  overflow-y: auto;
`;

const PageHeader = styled.div`
  margin-bottom: 32px;
  h1 {
    margin: 0 0 8px 0;
    font-weight: 700;
    font-size: 2rem;
    color: var(--apollon-primary-contrast);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  p {
    margin: 0;
    color: var(--apollon-secondary);
    font-size: 1rem;
  }
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 24px;
  width: 100%;
`;

const Section = styled.div`
  background: var(--apollon-background);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 12px;
  padding: 24px;
  transition: box-shadow 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }
`;

const SectionTitle = styled.h5`
  color: var(--apollon-primary-contrast);
  margin: 0 0 20px 0;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  gap: 8px;
  
  &::before {
    content: '';
    width: 4px;
    height: 20px;
    background: var(--apollon-primary);
    border-radius: 2px;
  }
`;

const AgentCard = styled.div`
  width: 100%;
  background-color: var(--apollon-background);
`;

const CardHeader = styled.div`
  display: none;
`;

const CardBody = styled.div`
  padding: 0;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const ActionBar = styled.div`
  display: flex;
  gap: 12px;
  margin-top: 32px;
  padding-top: 24px;
  border-top: 1px solid var(--apollon-switch-box-border-color);
  flex-wrap: wrap;
`;

const StyledButton = styled(Button)`
  padding: 10px 24px;
  font-weight: 500;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const configKey = 'agentConfig';

const createDefaultConfig = (): AgentConfigurationPayload => ({
    agentLanguage: 'original',
    inputModalities: ['text'],
    outputModalities: ['text'],
    agentPlatform: 'streamlit',
    responseTiming: 'instant',
    agentStyle: 'original',
    llm: {},
    languageComplexity: 'original',
    sentenceLength: 'concise',
    interfaceStyle: { ...defaultInterfaceStyle },
    voiceStyle: { ...defaultVoiceStyle },
    avatar: null,
    useAbbreviations: false,
    intentRecognitionTechnology: defaultIntentRecognitionTechnology,
});

const normalizeModalityList = (value?: string[]): string[] =>
    Array.isArray(value) && value.length > 0 ? value : ['text'];

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
        : defaultIntentRecognitionTechnology;

    return {
        agentLanguage: raw.agentLanguage || 'original',
        inputModalities: normalizeModalityList(raw.inputModalities),
        outputModalities: normalizeModalityList(raw.outputModalities),
        agentPlatform: raw.agentPlatform || 'streamlit',
        responseTiming: raw.responseTiming || 'instant',
        agentStyle: raw.agentStyle || 'original',
        llm,
        languageComplexity: (raw.languageComplexity as AgentLanguageComplexity) || 'original',
        sentenceLength: (raw.sentenceLength as AgentSentenceLength) || 'concise',
        interfaceStyle: normalizeInterfaceStyle(raw.interfaceStyle),
        voiceStyle: normalizeVoiceStyle(raw.voiceStyle),
        avatar: raw.avatar || null,
        useAbbreviations: raw.useAbbreviations ?? false,
        intentRecognitionTechnology,
    };
};

const loadInitialState = () => {
    const savedConfigurations = LocalStorageRepository.getAgentConfigurations();

    if (savedConfigurations.length > 0) {
        const primary = savedConfigurations[0];
        return {
            config: normalizeAgentConfiguration(primary.config),
            activeId: primary.id,
            activeName: primary.name,
            savedConfigs: savedConfigurations,
        };
    }

    try {
        const stored = localStorage.getItem(configKey);
        if (stored) {
            const legacyConfig = JSON.parse(stored);
            return {
                config: normalizeAgentConfiguration(legacyConfig),
                activeId: null,
                activeName: '',
                savedConfigs: savedConfigurations,
            };
        }
    } catch {
        /* ignore legacy parsing issues */
    }

    return {
        config: createDefaultConfig(),
        activeId: null,
        activeName: '',
        savedConfigs: savedConfigurations,
    };
};

const knownLLMModels = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'mistral-7b', 'falcon-40b', 'llama-3-8b', 'bloom-176b'];

export const AgentConfigScreen: React.FC = () => {
    const [initialLoad] = useState(loadInitialState);
    const initialConfig = initialLoad.config;
    const initialSavedConfigs = initialLoad.savedConfigs;
    const initialLLMProvider: AgentLLMProvider = 'provider' in initialConfig.llm ? initialConfig.llm.provider : '';
    const initialLLMModelValue = 'provider' in initialConfig.llm ? initialConfig.llm.model : '';
    const useCustomModelInitially = Boolean(initialLLMProvider && initialLLMModelValue && !knownLLMModels.includes(initialLLMModelValue));
    const derivedInitialModel = useCustomModelInitially ? 'other' : initialLLMModelValue;
    const derivedInitialCustomModel = useCustomModelInitially ? initialLLMModelValue : '';

    const [savedConfigs, setSavedConfigs] = useState<StoredAgentConfiguration[]>(initialSavedConfigs);
    const [selectedConfigId, setSelectedConfigId] = useState<string>(initialSavedConfigs[0]?.id || '');
    const [activeConfigId, setActiveConfigId] = useState<string | null>(initialLoad.activeId);
    const [activeConfigName, setActiveConfigName] = useState<string>(initialLoad.activeName || '');
    const [configurationName, setConfigurationName] = useState<string>(initialLoad.activeName || '');

    const [agentLanguage, setAgentLanguage] = useState(initialConfig.agentLanguage);
    const [inputModalities, setInputModalities] = useState<string[]>([...initialConfig.inputModalities]);
    const [outputModalities, setOutputModalities] = useState<string[]>([...initialConfig.outputModalities]);
    const [agentPlatform, setAgentPlatform] = useState(initialConfig.agentPlatform);
    const [responseTiming, setResponseTiming] = useState(initialConfig.responseTiming);
    const [agentStyle, setAgentStyle] = useState(initialConfig.agentStyle);
    const [llmProvider, setLlmProvider] = useState<AgentLLMProvider>(initialLLMProvider);
    const [llmModel, setLlmModel] = useState(derivedInitialModel);
    const [customModel, setCustomModel] = useState(derivedInitialCustomModel);
    const [languageComplexity, setLanguageComplexity] = useState<AgentLanguageComplexity>(initialConfig.languageComplexity);
    const [sentenceLength, setSentenceLength] = useState<AgentSentenceLength>(initialConfig.sentenceLength);
    const [interfaceStyle, setInterfaceStyle] = useState<InterfaceStyleSetting>({ ...initialConfig.interfaceStyle });
    const [voiceStyle, setVoiceStyle] = useState<VoiceStyleSetting>({ ...initialConfig.voiceStyle });
    const [avatarData, setAvatarData] = useState<string | null>(initialConfig.avatar || null);
    const [useAbbreviations, setUseAbbreviations] = useState<boolean>(initialConfig.useAbbreviations);
    const [intentRecognitionTechnology, setIntentRecognitionTechnology] = useState<IntentRecognitionTechnology>(initialConfig.intentRecognitionTechnology);

    const selectedConfig = savedConfigs.find((entry) => entry.id === selectedConfigId) || null;
    const handleInputModalityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputModalities((prev: string[]) =>
            prev.includes(value)
                ? prev.filter(m => m !== value)
                : [...prev, value]
        );
    };

    const handleOutputModalityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setOutputModalities((prev: string[]) =>
            prev.includes(value)
                ? prev.filter(m => m !== value)
                : [...prev, value]
        );
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
                setAvatarData(result);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    const handleAvatarRemove = () => setAvatarData(null);

    const updateInterfaceStyle = (field: keyof InterfaceStyleSetting, value: InterfaceStyleSetting[keyof InterfaceStyleSetting]) => {
        setInterfaceStyle(prev => ({ ...prev, [field]: value }));
    };

    const refreshSavedConfigurations = useCallback((preferredId?: string) => {
        const configs = LocalStorageRepository.getAgentConfigurations();
        setSavedConfigs(configs);
        if (configs.length === 0) {
            setSelectedConfigId('');
            return configs;
        }

        const hasPreferred = Boolean(preferredId && configs.some((entry) => entry.id === preferredId));
        const nextId = hasPreferred ? (preferredId as string) : configs[0].id;
        setSelectedConfigId(nextId);
        return configs;
    }, []);

    const applyConfiguration = useCallback((config: AgentConfigurationPayload, source?: { id?: string | null; name?: string }) => {
        const normalized = normalizeAgentConfiguration(config);
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
        setIntentRecognitionTechnology(normalized.intentRecognitionTechnology);

        if (source) {
            const nextId = source.id ?? null;
            setActiveConfigId(nextId);
            setSelectedConfigId(source.id ?? '');
            const nextName = source.name ?? '';
            setActiveConfigName(nextName);
            setConfigurationName(nextName);
        } else {
            setActiveConfigId(null);
            setActiveConfigName('');
            setConfigurationName('');
            setSelectedConfigId('');
        }
    }, []);

    const handleLoadSavedConfiguration = useCallback((configId?: string) => {
        const targetId = configId ?? selectedConfigId;
        if (!targetId) {
            alert('Please select a configuration to load.');
            return;
        }

        const stored = LocalStorageRepository.loadAgentConfiguration(targetId);
        if (!stored) {
            alert('The selected configuration could not be found.');
            refreshSavedConfigurations();
            return;
        }

        applyConfiguration(stored.config, { id: stored.id, name: stored.name });
        localStorage.setItem(configKey, JSON.stringify(stored.config));
        alert(`Configuration "${stored.name}" loaded.`);
    }, [selectedConfigId, refreshSavedConfigurations, applyConfiguration]);

    const handleDeleteSavedConfiguration = useCallback((configId?: string) => {
        const targetId = configId ?? selectedConfigId;
        if (!targetId) {
            alert('Please select a configuration to delete.');
            return;
        }

        const stored = LocalStorageRepository.loadAgentConfiguration(targetId);
        const confirmed = window.confirm(`Delete configuration "${stored?.name ?? 'this configuration'}"?`);
        if (!confirmed) {
            return;
        }

        LocalStorageRepository.deleteAgentConfiguration(targetId);
        const updated = refreshSavedConfigurations();
        if (activeConfigId === targetId) {
            const nextActive = updated[0] || null;
            setActiveConfigId(nextActive?.id ?? null);
            setActiveConfigName(nextActive?.name ?? '');
            setConfigurationName(nextActive?.name ?? '');
        }
        alert('Configuration deleted.');
    }, [selectedConfigId, refreshSavedConfigurations, activeConfigId]);

    const getConfigObject = (): AgentConfigurationPayload => ({
        agentLanguage,
        inputModalities: [...inputModalities],
        outputModalities: [...outputModalities],
        agentPlatform,
        responseTiming,
        agentStyle,
        llm: llmProvider && (llmModel || customModel)
            ? { provider: llmProvider, model: llmModel === 'other' ? customModel : llmModel }
            : {},
        languageComplexity,
        sentenceLength,
        interfaceStyle: { ...interfaceStyle },
        voiceStyle: { ...voiceStyle },
        avatar: avatarData,
        useAbbreviations,
        intentRecognitionTechnology,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = configurationName.trim();
        if (!trimmedName) {
            alert('Please provide a configuration name before saving.');
            return;
        }

        const config = getConfigObject();
        try {
            const savedEntry = LocalStorageRepository.saveAgentConfiguration(trimmedName, config);
            refreshSavedConfigurations(savedEntry.id);
            setActiveConfigId(savedEntry.id);
            setActiveConfigName(savedEntry.name);
            setConfigurationName(savedEntry.name);
            localStorage.setItem(configKey, JSON.stringify(config));
            alert(`Configuration "${savedEntry.name}" saved!`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save configuration.';
            alert(message);
        }
    };

    const handleDownload = () => {
        const config = getConfigObject();
        const slug = configurationName.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
        const filename = slug ? `${slug}.json` : 'agent_config.json';
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const config = JSON.parse(event.target?.result as string);
                const normalized = normalizeAgentConfiguration(config);
                applyConfiguration(normalized);
                localStorage.setItem(configKey, JSON.stringify(normalized));
                alert('Configuration loaded from file. Remember to save it if you want it in your library.');
            } catch {
                alert('Invalid configuration file.');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <PageContainer>
            <PageHeader>
                <h1>🤖 Agent Configuration</h1>
                <p>Configure your agent's behavior, language, and interaction settings</p>
            </PageHeader>
            
            <Form onSubmit={handleSubmit}>
                <ContentGrid>
                    <Section>
                        <SectionTitle>Saved Configurations</SectionTitle>
                        <Form.Group className="mb-3">
                            <Form.Label>Configuration Name</Form.Label>
                            <Form.Control
                                type="text"
                                value={configurationName}
                                placeholder="Give this setup a name"
                                onChange={e => setConfigurationName(e.target.value)}
                            />
                            {activeConfigId ? (
                                <div className="mt-2 d-flex align-items-center gap-2">
                                    <Badge bg="secondary">Active</Badge>
                                    <span className="text-muted small">{activeConfigName || 'Unnamed configuration'}</span>
                                </div>
                            ) : (
                                <Form.Text className="text-muted">Not linked to a saved configuration yet.</Form.Text>
                            )}
                        </Form.Group>
                        
                        <Form.Group className="mb-3">
                            <Form.Label>Saved Configurations</Form.Label>
                            <Form.Select
                                value={selectedConfigId}
                                onChange={e => setSelectedConfigId(e.target.value)}
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
                            </Form.Select>
                            {selectedConfig && (
                                <div className="mt-2 text-muted small">
                                    Last updated {new Date(selectedConfig.savedAt).toLocaleString()}
                                </div>
                            )}
                        </Form.Group>
                        
                        <div className="d-flex flex-wrap gap-2 mt-3">
                            <StyledButton
                                variant="outline-primary"
                                type="button"
                                onClick={() => handleLoadSavedConfiguration()}
                                disabled={!selectedConfigId}
                            >
                                Load Selected
                            </StyledButton>
                            <StyledButton
                                variant="outline-danger"
                                type="button"
                                onClick={() => handleDeleteSavedConfiguration()}
                                disabled={!selectedConfigId}
                            >
                                Delete
                            </StyledButton>
                        </div>
                    </Section>
                    
                    <Section>
                        <SectionTitle>Import / Export</SectionTitle>
                        <p className="text-muted mb-3">Download or upload configuration files</p>
                        <div className="d-flex flex-wrap gap-2">
                            <StyledButton variant="outline-secondary" type="button" onClick={handleDownload}>
                                Download JSON
                            </StyledButton>
                            <label className="btn btn-outline-secondary mb-0" style={{ borderRadius: '8px', padding: '10px 24px', fontWeight: 500 }}>
                                Upload JSON
                                <input
                                    type="file"
                                    accept="application/json"
                                    style={{ display: 'none' }}
                                    onChange={handleUpload}
                                />
                            </label>
                        </div>
                        <Form.Text className="text-muted d-block mt-2">
                            Uploading replaces the current form values but does not auto-save.
                        </Form.Text>
                    </Section>
                </ContentGrid>

                <ContentGrid style={{ marginTop: '24px' }}>
                    <Section>
                        <SectionTitle>Presentation</SectionTitle>
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Language</Form.Label>
                                    <Form.Select value={agentLanguage} onChange={e => setAgentLanguage(e.target.value)}>
                                        <option value="none">Original</option>
                                        <option value="english">English</option>
                                        <option value="french">French</option>
                                        <option value="german">German</option>
                                        <option value="spanish">Spanish</option>
                                        <option value="luxembourgish">Luxembourgish</option>
                                        <option value="portuguese">Portuguese</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Input Modalities</Form.Label>
                                    <div>
                                        <Form.Check
                                            type="checkbox"
                                            label="Text"
                                            value="text"
                                            checked={inputModalities.includes('text')}
                                            onChange={handleInputModalityChange}
                                        />
                                        <Form.Check
                                            type="checkbox"
                                            label="Speech"
                                            value="speech"
                                            checked={inputModalities.includes('speech')}
                                            onChange={handleInputModalityChange}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Output Modalities</Form.Label>
                                    <div>
                                        <Form.Check
                                            type="checkbox"
                                            label="Text"
                                            value="text"
                                            checked={outputModalities.includes('text')}
                                            onChange={handleOutputModalityChange}
                                        />
                                        <Form.Check
                                            type="checkbox"
                                            label="Speech"
                                            value="speech"
                                            checked={outputModalities.includes('speech')}
                                            onChange={handleOutputModalityChange}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Style</Form.Label>
                                    <div className="d-flex gap-3">
                                        <Form.Check
                                            type="radio"
                                            label="Original"
                                            name="agentStyle"
                                            id="agentStyleOriginal"
                                            value="original"
                                            checked={agentStyle === 'original'}
                                            onChange={e => setAgentStyle(e.target.value)}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Formal"
                                            name="agentStyle"
                                            id="agentStyleFormal"
                                            value="formal"
                                            checked={agentStyle === 'formal'}
                                            onChange={e => setAgentStyle(e.target.value)}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Informal"
                                            name="agentStyle"
                                            id="agentStyleInformal"
                                            value="informal"
                                            checked={agentStyle === 'informal'}
                                            onChange={e => setAgentStyle(e.target.value)}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                            <Row></Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Abbreviations</Form.Label>
                                    <Form.Check
                                        type="switch"
                                        label="Use abbreviations"
                                        checked={useAbbreviations}
                                        onChange={e => setUseAbbreviations(e.target.checked)}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Language Complexity</Form.Label>
                                    <div className="d-flex flex-column gap-2">
                                        <Form.Check
                                            type="radio"
                                            label="Original"
                                            name="languageComplexity"
                                            id="languageComplexityOriginal"
                                            value="original"
                                            checked={languageComplexity === 'original'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLanguageComplexity(e.target.value as 'original' | 'simple' | 'medium' | 'complex')}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Simple"
                                            name="languageComplexity"
                                            id="languageComplexitySimple"
                                            value="simple"
                                            checked={languageComplexity === 'simple'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLanguageComplexity(e.target.value as 'original' | 'simple' | 'medium' | 'complex')}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Medium"
                                            name="languageComplexity"
                                            id="languageComplexityMedium"
                                            value="medium"
                                            checked={languageComplexity === 'medium'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLanguageComplexity(e.target.value as 'original' | 'simple' | 'medium' | 'complex')}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Complex"
                                            name="languageComplexity"
                                            id="languageComplexityComplex"
                                            value="complex"
                                            checked={languageComplexity === 'complex'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLanguageComplexity(e.target.value as 'original' | 'simple' | 'medium' | 'complex')}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-2">
                            <Col>
                                <Form.Label className="fw-semibold">Style of text in interface</Form.Label>
                            </Col>
                        </Row>
                        <Row className="mb-3">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Size (px)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min={10}
                                        max={32}
                                        value={interfaceStyle.size}
                                        onChange={e => updateInterfaceStyle('size', Number(e.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Font</Form.Label>
                                    <Form.Select
                                        value={interfaceStyle.font}
                                        onChange={e => updateInterfaceStyle('font', e.target.value as InterfaceStyleSetting['font'])}
                                    >
                                        <option value="sans">Sans</option>
                                        <option value="serif">Serif</option>
                                        <option value="monospace">Monospace</option>
                                        <option value="neutral">Neutral</option>
                                        <option value="grotesque">Grotesque</option>
                                        <option value="condensed">Condensed</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Line Spacing</Form.Label>
                                    <Form.Control
                                        type="number"
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        value={interfaceStyle.lineSpacing}
                                        onChange={e => updateInterfaceStyle('lineSpacing', Number(e.target.value))}
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row className="mb-4">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Alignment</Form.Label>
                                    <Form.Select
                                        value={interfaceStyle.alignment}
                                        onChange={e => updateInterfaceStyle('alignment', e.target.value as InterfaceStyleSetting['alignment'])}
                                    >
                                        <option value="left">Left</option>
                                        <option value="center">Center</option>
                                        <option value="justify">Justify</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Color</Form.Label>
                                    <Form.Select
                                        value={interfaceStyle.color}
                                        onChange={e => updateInterfaceStyle('color', e.target.value)}
                                    >
                                        <option value="var(--apollon-primary-contrast)">Default Contrast</option>
                                        <option value="#000000">Black</option>
                                        <option value="#ffffff">White</option>
                                        <option value="#1a73e8">Blue</option>
                                        <option value="#34a853">Green</option>
                                        <option value="#fbbc05">Yellow</option>
                                        <option value="#db4437">Red</option>
                                        <option value="#6a1b9a">Purple</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label>Contrast</Form.Label>
                                    <Form.Select
                                        value={interfaceStyle.contrast}
                                        onChange={e => updateInterfaceStyle('contrast', e.target.value as InterfaceStyleSetting['contrast'])}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Sentence Length</Form.Label>
                                    <div className="d-flex gap-3">
                                        <Form.Check
                                            type="radio"
                                            label="Concise"
                                            name="sentenceLength"
                                            id="sentenceLengthConcise"
                                            value="concise"
                                            checked={sentenceLength === 'concise'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSentenceLength(e.target.value as 'concise' | 'verbose')}
                                        />
                                        <Form.Check
                                            type="radio"
                                            label="Verbose"
                                            name="sentenceLength"
                                            id="sentenceLengthVerbose"
                                            value="verbose"
                                            checked={sentenceLength === 'verbose'}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSentenceLength(e.target.value as 'concise' | 'verbose')}
                                        />
                                    </div>
                                </Form.Group>
                            </Col>
                        </Row>

                        {outputModalities.includes('speech') && (
                            <Row>
                                <Col md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Style of voice</Form.Label>
                                        <div className="d-flex flex-column gap-2">
                                            <Form.Select
                                                value={voiceStyle.gender}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                                    setVoiceStyle(prev => ({ ...prev, gender: e.target.value as VoiceStyleSetting['gender'] }))
                                                }
                                            >
                                                <option value="male">Male</option>
                                                <option value="female">Female</option>
                                                <option value="ambiguous">Ambiguous</option>
                                            </Form.Select>

                                            <Form.Group>
                                                <Form.Label>Voice speed ({voiceStyle.speed.toFixed(1)}x)</Form.Label>
                                                <Form.Range
                                                    min={0.5}
                                                    max={2}
                                                    step={0.05}
                                                    value={voiceStyle.speed}
                                                    onChange={e => setVoiceStyle(prev => ({ ...prev, speed: Number(e.target.value) }))}
                                                />
                                            </Form.Group>
                                        </div>
                                    </Form.Group>
                                </Col>
                            </Row>
                        )}

                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label className="d-flex align-items-center gap-2">
                                        2D Avatar
                                    </Form.Label>
                                    {avatarData && (
                                        <div className="d-flex flex-column gap-2">
                                            <img
                                                src={avatarData}
                                                alt="Agent avatar"
                                                style={{ width: 128, height: 128, objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--apollon-switch-box-border-color)' }}
                                            />
                                            <Button variant="outline-danger" size="sm" onClick={handleAvatarRemove}>
                                                Remove avatar
                                            </Button>
                                        </div>
                                    )}
                                    <Form.Control
                                        type="file"
                                        accept="image/*"
                                        onChange={handleAvatarUpload}
                                        className="mt-2"
                                    />
                                    <Form.Text className="text-muted">
                                        Upload an image for your agent avatar; it will be stored as base64 when saving the configuration.
                                    </Form.Text>
                                </Form.Group>
                            </Col>
                        </Row>

                        <SectionTitle>Behavior</SectionTitle>



                        <Row>
                            <Col md={4}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Response Timing</Form.Label>
                                    <Form.Select value={responseTiming} onChange={e => setResponseTiming(e.target.value)}>
                                        <option value="instant">Instant</option>
                                        <option value="delayed">Simulated Thinking</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                        <SectionTitle>System Configuration</SectionTitle>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label>Platform</Form.Label>
                                    <Form.Select value={agentPlatform} onChange={e => setAgentPlatform(e.target.value)}>
                                        <option value="websocket">WebSocket</option>
                                        <option value="streamlit">WebSocket with Streamlit interface</option>
                                        <option value="telegram">Telegram</option>
                                    </Form.Select>
                                </Form.Group>
   
                                    <Form.Group className="mb-3">
                                        <Form.Label>Intent recognition</Form.Label>
                                        <Form.Select value={intentRecognitionTechnology} onChange={e => setIntentRecognitionTechnology(e.target.value as IntentRecognitionTechnology)}>
                                            <option value="classical">Classical</option>
                                            <option value="llm-based">LLM-based</option>
                                        </Form.Select>
                                    </Form.Group>
                          
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3">
                                    <Form.Label style={{ cursor: 'help', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span
                                            title="Required if you want the agent to automatically generate responses using LLMs."
                                            style={{ cursor: 'help' }}
                                        >
                                            LLM Provider (optional)
                                        </span>
                                        <span
                                            title="Required if you want the agent to automatically generate responses using LLMs."
                                            style={{ cursor: 'help', fontSize: '1.1em', color: '#007bff', userSelect: 'none' }}
                                        >
                                            <b>i</b>
                                        </span>
                                    </Form.Label>
                                    <Form.Select value={llmProvider} onChange={e => { setLlmProvider(e.target.value as AgentLLMProvider); setLlmModel(''); }}>
                                        <option value="">None</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="huggingface">HuggingFace</option>
                                        <option value="huggingfaceapi">HuggingFace API</option>
                                        <option value="replicate">Replicate</option>
                                    </Form.Select>
                                </Form.Group>
                                {(llmProvider === 'openai') && (
                                    <Form.Group className="mb-3">
                                        <Form.Label>OpenAI Model</Form.Label>
                                        <Form.Select value={llmModel} onChange={e => { setLlmModel(e.target.value); if (e.target.value !== 'other') setCustomModel(''); }} disabled={!llmProvider}>
                                            <option value="">None</option>
                                            <option value="gpt-5">GPT-5</option>
                                            <option value="gpt-5-mini">GPT-5 Mini</option>
                                            <option value="gpt-5-nano">GPT-5 Nano</option>
                                            <option value="other">Other</option>
                                        </Form.Select>
                                        {llmModel === 'other' && (
                                            <Form.Group className="mt-2">
                                                <Form.Label>Custom Model Name</Form.Label>
                                                <Form.Control type="text" value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="Enter model name" />
                                            </Form.Group>
                                        )}
                                    </Form.Group>
                                )}
                                {(llmProvider === 'huggingface' || llmProvider === 'huggingfaceapi' || llmProvider === 'replicate') && (
                                    <Form.Group className="mb-3">
                                        <Form.Label>{llmProvider === 'huggingface' ? 'HuggingFace Model' : llmProvider === 'huggingfaceapi' ? 'HuggingFace API Model' : 'Replicate Model'}</Form.Label>
                                        <Form.Select value={llmModel} onChange={e => { setLlmModel(e.target.value); if (e.target.value !== 'other') setCustomModel(''); }} disabled={!llmProvider}>
                                            <option value="">None</option>
                                            <option value="mistral-7b">Mistral-7B</option>
                                            <option value="falcon-40b">Falcon-40B</option>
                                            <option value="llama-3-8b">Llama-3 8B</option>
                                            <option value="bloom-176b">Bloom-176B</option>
                                            <option value="other">Other</option>
                                        </Form.Select>
                                        {llmModel === 'other' && (
                                            <Form.Group className="mt-2">
                                                <Form.Label>Custom Model Name</Form.Label>
                                                <Form.Control type="text" value={customModel} onChange={e => setCustomModel(e.target.value)} placeholder="Enter model name" />
                                            </Form.Group>
                                        )}
                                    </Form.Group>
                                )}
                            </Col>
                        </Row>
           
                        <div className="d-flex justify-content-end mt-4">
                            <StyledButton variant="primary" type="submit">
                                Save Configuration
                            </StyledButton>
                        </div>
                    </Section>
                </ContentGrid>
                    </Form>
        </PageContainer>
    );
};
