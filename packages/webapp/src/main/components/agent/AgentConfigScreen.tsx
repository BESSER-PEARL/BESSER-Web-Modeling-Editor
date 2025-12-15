import React, { useState, useEffect } from 'react';
import { Card, Form, Button, Row, Col, Badge } from 'react-bootstrap';
import styled from 'styled-components';

type InterfaceStyleSetting = {
    size: number;
    font: 'sans' | 'serif' | 'monospace' | 'neutral' | 'grotesque';
    lineSpacing: number;
    alignment: 'left' | 'center' | 'justify';
    color: string;
    contrast: 'low' | 'medium' | 'high';
};

const defaultInterfaceStyle: InterfaceStyleSetting = {
    size: 16,
    font: 'sans',
    lineSpacing: 1.5,
    alignment: 'left',
    color: 'var(--apollon-primary-contrast)',
    contrast: 'medium',
};

type VoiceStyleSetting = {
    gender: 'male' | 'female' | 'ambiguous';
    speed: number;
};

const defaultVoiceStyle: VoiceStyleSetting = {
    gender: 'male',
    speed: 1,
};

type IntentRecognitionTechnology = 'classical' | 'llm-based';

const defaultIntentRecognitionTechnology: IntentRecognitionTechnology = 'classical';

const AgentCard = styled(Card)`
  width: 100%;
  max-width: 700px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--apollon-switch-box-border-color);
  border-radius: 16px;
  overflow: hidden;
  background-color: var(--apollon-background);
`;

const CardHeader = styled(Card.Header)`
  background: var(--apollon-primary);
  color: var(--apollon-primary-contrast);
  border: none;
  padding: 24px 32px;
  h3 {
    margin: 0;
    font-weight: 600;
    font-size: 1.5rem;
    color: var(--apollon-primary-contrast);
  }
`;

const CardBody = styled(Card.Body)`
  padding: 32px;
  background-color: var(--apollon-background);
  color: var(--apollon-primary-contrast);
`;

const SectionTitle = styled.h5`
    color: var(--apollon-primary-contrast);
    margin-bottom: 20px;
    font-weight: 600;
    border-bottom: 2px solid var(--apollon-switch-box-border-color);
    padding-bottom: 8px;
`;

const PageContainer = styled.div`
    padding: 40px 20px;
    min-height: calc(100vh - 60px);
    background-color: var(--apollon-background);
    display: flex;
    justify-content: center;
    align-items: flex-start;
`;



export const AgentConfigScreen: React.FC = () => {
    // Only keep language, input/output modalities, platform, LLM, and avatar
    const configKey = 'agentConfig';
    // Load from localStorage if available
    const getInitialConfig = () => {
        try {
            const stored = localStorage.getItem(configKey);
            if (stored) {
                const config = JSON.parse(stored);
                let llmProvider = '';
                let llmModel = '';
                if (config.llm && typeof config.llm === 'object') {
                    llmProvider = config.llm.provider || '';
                    llmModel = config.llm.model || '';
                }
                const intentRecognitionTechnology = config.intentRecognitionTechnology === 'llm-based' ? 'llm-based' as IntentRecognitionTechnology : defaultIntentRecognitionTechnology;
                return {
                    agentLanguage: config.agentLanguage || 'original',
                    inputModalities: config.inputModalities || ['text'],
                    outputModalities: config.outputModalities || ['text'],
                    agentPlatform: config.agentPlatform || 'streamlit',
                    responseTiming: config.responseTiming || 'instant',
                    agentStyle: config.agentStyle || 'original',
                    llmProvider,
                    llmModel,
                    avatar: config.avatar || null,
                    sentenceLength: config.sentenceLength || 'concise', // Default value
                    interfaceStyle: config.interfaceStyle ? { ...defaultInterfaceStyle, ...config.interfaceStyle } : defaultInterfaceStyle,
                    voiceStyle: config.voiceStyle ? { ...defaultVoiceStyle, ...config.voiceStyle } : defaultVoiceStyle,
                    useAbbreviations: config.useAbbreviations ?? false,
                    intentRecognitionTechnology,
                };
            }
        } catch { }
        return {
            agentLanguage: 'original',
            inputModalities: ['text'],
            outputModalities: ['text'],
            agentPlatform: 'streamlit',
            responseTiming: 'instant',
            agentStyle: 'original',
            llmProvider: '',
            llmModel: '',
            avatar: null,
            sentenceLength: 'concise',
            interfaceStyle: defaultInterfaceStyle,
            voiceStyle: defaultVoiceStyle,
            useAbbreviations: false,
            intentRecognitionTechnology: defaultIntentRecognitionTechnology,
        };
    };

    const [agentLanguage, setAgentLanguage] = useState(getInitialConfig().agentLanguage);
    const [inputModalities, setInputModalities] = useState(getInitialConfig().inputModalities);
    const [outputModalities, setOutputModalities] = useState(getInitialConfig().outputModalities);
    const [agentPlatform, setAgentPlatform] = useState(getInitialConfig().agentPlatform);
    const [responseTiming, setResponseTiming] = useState(getInitialConfig().responseTiming);
    const [agentStyle, setAgentStyle] = useState(getInitialConfig().agentStyle);
    const [llmProvider, setLlmProvider] = useState(getInitialConfig().llmProvider);
    const [llmModel, setLlmModel] = useState(getInitialConfig().llmModel);
    const [customModel, setCustomModel] = useState('');
    const [languageComplexity, setLanguageComplexity] = useState<'original' | 'simple' | 'medium' | 'complex'>('original');
    const [sentenceLength, setSentenceLength] = useState<'concise' | 'verbose'>(getInitialConfig().sentenceLength || 'concise');
    const [interfaceStyle, setInterfaceStyle] = useState<InterfaceStyleSetting>(getInitialConfig().interfaceStyle || defaultInterfaceStyle);
    const [voiceStyle, setVoiceStyle] = useState<VoiceStyleSetting>(getInitialConfig().voiceStyle || defaultVoiceStyle);
    const [avatarData, setAvatarData] = useState<string | null>(getInitialConfig().avatar || null);
    const [useAbbreviations, setUseAbbreviations] = useState<boolean>(getInitialConfig().useAbbreviations ?? false);
    const [intentRecognitionTechnology, setIntentRecognitionTechnology] = useState<IntentRecognitionTechnology>(getInitialConfig().intentRecognitionTechnology || defaultIntentRecognitionTechnology);

    // Sync state with localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem(configKey);
        if (stored) {
            try {
                const config = JSON.parse(stored);
                setAgentLanguage(config.agentLanguage || 'original');
                setInputModalities(config.inputModalities || ['text']);
                setOutputModalities(config.outputModalities || ['text']);
                setAgentPlatform(config.agentPlatform || 'streamlit');
                setResponseTiming(config.responseTiming || 'instant');
                setAgentStyle(config.agentStyle || 'original');
                if (config.llm && typeof config.llm === 'object') {
                    setLlmProvider(config.llm.provider || '');
                    setLlmModel(config.llm.model || '');
                } else {
                    setLlmProvider('');
                    setLlmModel('');
                }
                setSentenceLength(config.sentenceLength || 'concise'); // Apply sentence length from config
                setInterfaceStyle(config.interfaceStyle ? { ...defaultInterfaceStyle, ...config.interfaceStyle } : defaultInterfaceStyle);
                setVoiceStyle(config.voiceStyle ? { ...defaultVoiceStyle, ...config.voiceStyle } : defaultVoiceStyle);
                setAvatarData(config.avatar || null);
                setUseAbbreviations(config.useAbbreviations ?? false);
                setIntentRecognitionTechnology(config.intentRecognitionTechnology === 'llm-based' ? 'llm-based' as IntentRecognitionTechnology : defaultIntentRecognitionTechnology);
            } catch { }
        }
    }, []);
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

    const getConfigObject = () => ({
        agentLanguage,
        inputModalities,
        outputModalities,
        agentPlatform,
        responseTiming,
        agentStyle,
        llm: llmProvider && (llmModel || customModel) ? { provider: llmProvider, model: llmModel === 'other' ? customModel : llmModel } : {},
        languageComplexity,
        sentenceLength,
        interfaceStyle,
        voiceStyle,
        avatar: avatarData,
        useAbbreviations,
        intentRecognitionTechnology,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const config = getConfigObject();
        localStorage.setItem(configKey, JSON.stringify(config));
        alert('Agent configuration saved to localStorage!');
    };

    const handleDownload = () => {
        const config = getConfigObject();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'agent_config.json';
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
                setAgentLanguage(config.agentLanguage || 'original');
                setInputModalities(config.inputModalities || ['text']);
                setOutputModalities(config.outputModalities || ['text']);
                setAgentPlatform(config.agentPlatform || 'streamlit');
                setResponseTiming(config.responseTiming || 'instant');
                setAgentStyle(config.agentStyle || 'original');
                if (config.llm && typeof config.llm === 'object') {
                    setLlmProvider(config.llm.provider || '');
                    if (['openai', 'huggingface', 'huggingfaceapi', 'replicate'].includes(config.llm.provider) &&
                        ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'mistral-7b', 'falcon-40b', 'llama-3-8b', 'bloom-176b'].includes(config.llm.model)) {
                        setLlmModel(config.llm.model);
                        setCustomModel('');
                    } else {
                        setLlmModel('other');
                        setCustomModel(config.llm.model || '');
                    }
                } else {
                    setLlmProvider('');
                    setLlmModel('');
                    setCustomModel('');
                }
                setSentenceLength(config.sentenceLength || 'concise');
                setInterfaceStyle(config.interfaceStyle ? { ...defaultInterfaceStyle, ...config.interfaceStyle } : defaultInterfaceStyle);
                setVoiceStyle(config.voiceStyle ? { ...defaultVoiceStyle, ...config.voiceStyle } : defaultVoiceStyle);
                setAvatarData(config.avatar || null);
                setUseAbbreviations(config.useAbbreviations ?? false);
                const intentRecognitionTechnology = config.intentRecognitionTechnology === 'llm-based'
                    ? 'llm-based' as IntentRecognitionTechnology
                    : defaultIntentRecognitionTechnology;
                setIntentRecognitionTechnology(intentRecognitionTechnology);
                config.intentRecognitionTechnology = intentRecognitionTechnology;
                localStorage.setItem(configKey, JSON.stringify(config));
                alert('Configuration loaded!');
            } catch {
                alert('Invalid configuration file.');
            }
        };
        reader.readAsText(file);
    };

    return (
        <PageContainer>
            <AgentCard>
                <CardHeader>
                    <h3>Agent Configuration</h3>
                </CardHeader>
                <CardBody>
                    <Form onSubmit={handleSubmit}>
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
                                    <Form.Select value={llmProvider} onChange={e => { setLlmProvider(e.target.value); setLlmModel(''); }}>
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
           
                        <div className="d-flex justify-content-end gap-3 mt-4">
                            <Button variant="primary" type="submit">
                                Save Configuration
                            </Button>
                            <Button variant="outline-secondary" type="button" onClick={handleDownload}>
                                Download Configuration
                            </Button>
                            <label className="btn btn-outline-secondary mb-0">
                                Upload Configuration
                                <input
                                    type="file"
                                    accept="application/json"
                                    style={{ display: 'none' }}
                                    onChange={handleUpload}
                                />
                            </label>
                        </div>
                    </Form>
                </CardBody>
            </AgentCard>
        </PageContainer>
    );
};
