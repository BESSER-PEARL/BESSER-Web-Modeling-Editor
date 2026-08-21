import type { AgentLLMProviderType, LegacyAgentLLMProviderType } from '@besser/wme';

export type InterfaceStyleSetting = {
  size: number;
  font: 'sans' | 'serif' | 'monospace' | 'neutral' | 'grotesque' | 'condensed';
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

/**
 * Provider stored in the runtime config. Derived from the canonical editor list
 * so this never drifts; the legacy alias and '' (unset) are the only extras.
 */
export type AgentLLMProvider = AgentLLMProviderType | LegacyAgentLLMProviderType | '';

export type AgentLanguageComplexity = 'original' | 'simple' | 'medium' | 'complex';

export type AgentSentenceLength = 'original' | 'concise' | 'verbose';

export interface AgentLLMConfiguration {
  provider: AgentLLMProvider;
  model: string;
}

export interface AgentLLMNameConfiguration {
  name: string;
}

export interface AgentConfigurationPayload {
  agentLanguage: string;
  inputModalities: string[];
  outputModalities: string[];
  agentPlatform: string;
  responseTiming: string;
  agentStyle: string;
  llm: AgentLLMNameConfiguration | AgentLLMConfiguration | Record<string, never>;
  languageComplexity: AgentLanguageComplexity;
  sentenceLength: AgentSentenceLength;
  interfaceStyle: InterfaceStyleSetting;
  voiceStyle: VoiceStyleSetting;
  avatar: string | null;
  useAbbreviations: boolean;
  adaptContentToUserProfile: boolean;
  userProfileName: string | null;
  intentRecognitionTechnology: IntentRecognitionTechnology;
}
