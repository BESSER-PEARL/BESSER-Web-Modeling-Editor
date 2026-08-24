import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UMLDiagramType, UMLModel, diagramBridge } from '@besser/wme';
import { toast } from 'react-toastify';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAppDispatch } from '../../app/store/hooks';
import { bumpEditorRevision, updateDiagramModelThunk } from '../../app/store/workspaceSlice';
import {
  LocalStorageRepository,
  AgentRuntimeConfig,
  DEFAULT_AGENT_RUNTIME_CONFIG,
} from '../../shared/services/storage/local-storage-repository';
import type {
  IntentRecognitionTechnology,
} from '../../shared/types/agent-config';
import { isUMLModel, getActiveDiagram } from '../../shared/types/project';
import { useProject } from '../../app/hooks/useProject';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { AgentConfigYamlEditor } from './AgentConfigYamlEditor';

const cloneModel = (model: UMLModel): UMLModel => JSON.parse(JSON.stringify(model)) as UMLModel;

type AgentLLMElementProvider = 'openai' | 'huggingface' | 'huggingface_api' | 'replicate' | 'ollama';

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
  { value: 'ollama', label: 'Ollama (local)' },
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
  const provider = (['openai', 'huggingface', 'huggingface_api', 'replicate', 'ollama'].includes(raw?.provider)
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
  const { t } = useTranslation();
  const [parametersText, setParametersText] = useState<string>(formatAgentLLMParameters(element.parameters));
  const [parametersError, setParametersError] = useState<string>('');

  useEffect(() => {
    setParametersText(formatAgentLLMParameters(element.parameters));
    setParametersError('');
  }, [element.id]);

  const updateOllamaParam = (key: string, value: string) => {
    const updated = { ...element.parameters, [key]: value };
    onChange(element.id, { parameters: updated });
    setParametersText(formatAgentLLMParameters(updated));
    setParametersError('');
  };

  const commitParameters = (raw: string) => {
    if (!raw.trim()) {
      setParametersError('');
      onChange(element.id, { parameters: {} });
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setParametersError(t('agentConfig.row.errors.notObject'));
        return;
      }
      setParametersError('');
      onChange(element.id, { parameters: parsed as Record<string, unknown> });
    } catch {
      setParametersError(t('agentConfig.row.errors.invalidJson'));
    }
  };

  const displayName = element.name?.trim() || t('agentConfig.row.unnamedLlm');

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
              {t('agentConfig.row.default')}
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{expanded ? t('agentConfig.section.hide') : t('agentConfig.section.show')}</span>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-border px-4 py-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-name-${element.id}`}>{t('agentConfig.row.name')}</Label>
              <Input
                id={`agent-llm-name-${element.id}`}
                value={element.name}
                placeholder={t('agentConfig.row.namePlaceholder')}
                onChange={(event) => onChange(element.id, { name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-provider-${element.id}`}>{t('agentConfig.row.provider')}</Label>
              <select
                id={`agent-llm-provider-${element.id}`}
                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                value={element.provider}
                onChange={(event) => {
                  const newProvider = event.target.value as AgentLLMElementProvider;
                  const updates: Partial<AgentLLMElement> = { provider: newProvider };
                  if (newProvider === 'ollama') {
                    const seeded = {
                      ...element.parameters,
                      base_url: (element.parameters.base_url as string) || 'http://localhost:11434',
                      model: (element.parameters.model as string) || '',
                    };
                    updates.parameters = seeded;
                    setParametersText(formatAgentLLMParameters(seeded));
                    setParametersError('');
                  }
                  onChange(element.id, updates);
                }}
              >
                {AGENT_LLM_PROVIDER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`agent-llm-num-prev-${element.id}`}>{t('agentConfig.row.numPrevMessages')}</Label>
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
          {element.provider === 'ollama' && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`agent-llm-ollama-url-${element.id}`}>Base URL</Label>
                <Input
                  id={`agent-llm-ollama-url-${element.id}`}
                  value={(element.parameters.base_url as string) ?? 'http://localhost:11434'}
                  placeholder="http://localhost:11434"
                  onChange={(event) => updateOllamaParam('base_url', event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`agent-llm-ollama-model-${element.id}`}>Model</Label>
                <Input
                  id={`agent-llm-ollama-model-${element.id}`}
                  value={(element.parameters.model as string) ?? ''}
                  placeholder="e.g. llama3, mistral, qwen2.5"
                  onChange={(event) => updateOllamaParam('model', event.target.value)}
                />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor={`agent-llm-parameters-${element.id}`}>{t('agentConfig.row.parameters')}</Label>
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
            <Label htmlFor={`agent-llm-global-context-${element.id}`}>{t('agentConfig.row.globalContext')}</Label>
            <textarea
              id={`agent-llm-global-context-${element.id}`}
              className="min-h-[64px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
              placeholder={t('agentConfig.row.globalContextPlaceholder')}
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
              {t('agentConfig.row.setDefault')}
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(element.id)}
              className="text-destructive hover:text-destructive"
            >
              {t('agentConfig.row.remove')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AgentConfigurationPanel: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { currentProject } = useProject();

  const [activeTab] = useState<'runtime'>('runtime');

  const currentAgentDiagram = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : undefined;

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
        toast.error(t('agentConfig.toasts.persistFailed'));
      }
    },
    [dispatch, t],
  );

  const handleAddAgentLLM = useCallback(() => {
    if (!currentAgentModel) {
      toast.error(t('agentConfig.toasts.noActiveDiagram'));
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
  }, [currentAgentModel, persistAgentModel, defaultLlmName, resolveDefaultLlm, updateDefaultLlmName, t]);

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
        toast.error(t('agentConfig.toasts.nameBeforeDefault'));
        return;
      }
      updateDefaultLlmName(name);
    },
    [currentAgentModel, updateDefaultLlmName, t],
  );

  return (
    <div className="relative h-full overflow-auto px-4 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('agentConfig.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('agentConfig.subtitle')}
          </p>
        </div>

        <div
          role="tablist"
          aria-label={t('agentConfig.tabsAriaLabel')}
          className="inline-flex w-fit gap-1 rounded-lg border border-border bg-muted/30 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'runtime'}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === 'runtime'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('agentConfig.tab.runtime')}
          </button>
        </div>

        <form
          onSubmit={(event) => event.preventDefault()}
          className="flex flex-col gap-6"
        >
          {activeTab === 'runtime' && currentAgentModel && (
          <>
          <Card>
            <CardHeader>
              <CardTitle>{t('agentConfig.runtime.title')}</CardTitle>
              <CardDescription>
                {t('agentConfig.runtime.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="agent-runtime-platform">{t('agentConfig.runtime.platform')}</Label>
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
                  <Label htmlFor="agent-runtime-intent">{t('agentConfig.runtime.intent')}</Label>
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
                    <option value="classical">{t('agentConfig.runtime.intentClassical')}</option>
                    <option value="llm-based">{t('agentConfig.runtime.intentLlmBased')}</option>
                  </select>
                </div>

                {agentRuntimeConfig.intentRecognitionTechnology === 'llm-based' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-runtime-llm-name">{t('agentConfig.runtime.llm')}</Label>
                    <select
                      id="agent-runtime-llm-name"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={agentRuntimeConfig.agentLlmName}
                      onChange={(event) =>
                        updateAgentRuntimeConfig({ agentLlmName: event.target.value })
                      }
                    >
                      <option value="">{t('agentConfig.runtime.useDefault')}</option>
                      {agentLLMElements.map((entry) => (
                        <option key={entry.id} value={entry.name}>
                          {entry.name || t('agentConfig.row.unnamedLlm')}
                        </option>
                      ))}
                    </select>
                    {agentLLMElements.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t('agentConfig.runtime.defineLlmHint')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('agentConfig.llms.title')}</CardTitle>
              <CardDescription>
                {t('agentConfig.llms.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentLLMElements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('agentConfig.llms.empty')}
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
                  {t('agentConfig.llms.add')}
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
        </form>
      </div>
    </div>
  );
};
