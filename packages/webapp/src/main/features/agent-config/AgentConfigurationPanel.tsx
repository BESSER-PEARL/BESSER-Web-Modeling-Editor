import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType, canonicalizeAgentLLMProvider, diagramBridge } from '@besser/wme';
import type { AgentLLMProviderType } from '@besser/wme';
import { useProject } from '../../app/hooks/useProject';
import { getActiveDiagram, isUMLModel } from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { DEFAULT_AGENT_RUNTIME_CONFIG, type AgentRuntimeConfig } from '../../shared/services/storage/local-storage-repository';
import { normalizeStoredPlatform } from './runtimeConfigKeys';
import { AgentRuntimePanel } from './AgentRuntimePanel';

/** Provider on a diagram AgentLLM element. Canonical keys only — see canonicalizeAgentLLMProvider. */
export type AgentLLMElementProvider = AgentLLMProviderType;

export type AgentLLMElement = {
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

// Display order is deliberately different from AGENT_LLM_PROVIDERS (hosted families
// first, local/self-hosted last). The Record type below is the completeness guard:
// adding a provider to the canonical list without a label here fails the build.
const AGENT_LLM_PROVIDER_LABELS: Record<AgentLLMProviderType, string> = {
  openai: 'OpenAI',
  mistral: 'Mistral AI',
  deepseek: 'DeepSeek',
  google: 'Google (Gemini)',
  meta: 'Meta (Llama)',
  anthropic: 'Anthropic (Claude)',
  qwen: 'Alibaba Qwen',
  xai: 'xAI (Grok)',
  groq: 'Groq',
  together: 'Together AI',
  openrouter: 'OpenRouter',
  huggingface: 'Hugging Face (local)',
  huggingface_api: 'Hugging Face API',
  replicate: 'Replicate',
  ollama: 'Ollama (local)',
};

const AGENT_LLM_PROVIDER_DISPLAY_ORDER: readonly AgentLLMProviderType[] = [
  'openai', 'mistral', 'deepseek', 'google', 'meta', 'anthropic', 'qwen',
  'xai', 'groq', 'together', 'openrouter', 'huggingface', 'huggingface_api',
  'replicate', 'ollama',
];

export const AGENT_LLM_PROVIDER_OPTIONS: Array<{ value: AgentLLMElementProvider; label: string }> =
  AGENT_LLM_PROVIDER_DISPLAY_ORDER.map((value) => ({ value, label: AGENT_LLM_PROVIDER_LABELS[value] }));

const isAgentLLMElement = (value: unknown): value is AgentLLMElement => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return candidate.type === 'AgentLLM';
};

export const normalizeAgentLLMElement = (raw: any, fallbackId: string): AgentLLMElement => {
  // Accepts legacy spellings and maps them onto the canonical key, so a config
  // saved before 'huggingface_api' existed is migrated rather than reset.
  const provider = canonicalizeAgentLLMProvider(raw?.provider);
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


export const AgentConfigurationPanel: React.FC = () => {
  const { t } = useTranslation();
  const { currentProject } = useProject();
  const currentAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;
  const currentAgentModel = isUMLModel(currentAgentDiagram?.model) && currentAgentDiagram.model.type === UMLDiagramType.AgentDiagram
    ? currentAgentDiagram.model : null;

  const runtimeConfigInitial = useMemo<AgentRuntimeConfig>(() => {
    const cfg = (currentAgentDiagram?.config ?? {}) as Partial<AgentRuntimeConfig> & { llm?: { name?: string } };
    const llmName = typeof cfg.agentLlmName === 'string'
      ? cfg.agentLlmName
      : (cfg.llm && typeof cfg.llm.name === 'string' ? cfg.llm.name : '');
    return {
      ...normalizeStoredPlatform(cfg.agentPlatform, cfg.agentPlatformUseStreamlit, DEFAULT_AGENT_RUNTIME_CONFIG),
      intentRecognitionTechnology: cfg.intentRecognitionTechnology || DEFAULT_AGENT_RUNTIME_CONFIG.intentRecognitionTechnology,
      agentLlmProvider: cfg.agentLlmProvider ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentLlmProvider,
      agentLlmModel: cfg.agentLlmModel ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentLlmModel,
      agentCustomLlmModel: cfg.agentCustomLlmModel ?? DEFAULT_AGENT_RUNTIME_CONFIG.agentCustomLlmModel,
      agentLlmName: llmName,
    };
  }, [currentAgentDiagram]);
  const [agentRuntimeConfig, setAgentRuntimeConfig] = useState(runtimeConfigInitial);
  useEffect(() => setAgentRuntimeConfig(runtimeConfigInitial), [runtimeConfigInitial]);
  useEffect(() => { diagramBridge.setAgentPlatform(agentRuntimeConfig.agentPlatform); }, [agentRuntimeConfig.agentPlatform]);

  const agentLLMElements = useMemo(() => {
    if (!currentAgentModel) return [];
    return Object.entries(currentAgentModel.elements || {})
      .filter(([, element]) => isAgentLLMElement(element))
      .map(([id, element]) => normalizeAgentLLMElement(element, id));
  }, [currentAgentModel]);

  const updateAgentRuntimeConfig = useCallback((patch: Partial<AgentRuntimeConfig>) => {
    setAgentRuntimeConfig((previous) => {
      const next = { ...previous, ...patch };
      if (currentProject) {
        const latestProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
        const latestDiagram = getActiveDiagram(latestProject, 'AgentDiagram');
        if (latestDiagram) {
          const agentIndex = latestProject.currentDiagramIndices?.AgentDiagram ?? 0;
          ProjectStorageRepository.updateDiagram(currentProject.id, 'AgentDiagram', {
            ...latestDiagram,
            config: {
              ...((latestDiagram.config ?? {}) as Record<string, unknown>),
              ...next,
              llm: next.agentLlmName ? { name: next.agentLlmName } : {},
            },
          }, agentIndex);
        }
      }
      return next;
    });
  }, [currentProject]);

  return (
    <div className="relative flex h-full flex-col overflow-clip">
      <div className="shrink-0 border-b border-border/50 px-4 pt-6 pb-4 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('agentConfig.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('agentConfig.subtitle')}</p>
        </div>
      </div>
      {!currentAgentModel ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('agentConfig.noActiveDiagram')}
        </div>
      ) : (
        <AgentRuntimePanel
          currentProject={currentProject}
          agentRuntimeConfig={agentRuntimeConfig}
          updateAgentRuntimeConfig={updateAgentRuntimeConfig}
          agentLLMElements={agentLLMElements}
        />
      )}
    </div>
  );
};
