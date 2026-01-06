export type InterfaceStyleSetting = {
  size: number;
  font: 'sans' | 'serif' | 'monospace' | 'neutral' | 'grotesque';
  lineSpacing: number;
  alignment: 'left' | 'center' | 'justify';
  color: string;
  contrast: 'low' | 'medium' | 'high';
};

export type VoiceStyleSetting = {
  gender: 'male' | 'female' | 'ambiguous';
  speed: number;
};

export type IntentRecognitionTechnology = 'classical' | 'llm-based';

export type AgentLLMProvider = 'openai' | 'huggingface' | 'huggingfaceapi' | 'replicate' | '';

export type AgentLanguageComplexity = 'original' | 'simple' | 'medium' | 'complex';

export type AgentSentenceLength = 'original' | 'concise' | 'verbose';

export interface AgentLLMConfiguration {
  provider: AgentLLMProvider;
  model: string;
}

export interface AgentConfigurationPayload {
  agentLanguage: string;
  inputModalities: string[];
  outputModalities: string[];
  agentPlatform: string;
  responseTiming: string;
  agentStyle: string;
  llm: AgentLLMConfiguration | Record<string, never>;
  languageComplexity: AgentLanguageComplexity;
  sentenceLength: AgentSentenceLength;
  interfaceStyle: InterfaceStyleSetting;
  voiceStyle: VoiceStyleSetting;
  avatar: string | null;
  useAbbreviations: boolean;
  adaptContentToUserProfile: boolean;
  intentRecognitionTechnology: IntentRecognitionTechnology;
}
