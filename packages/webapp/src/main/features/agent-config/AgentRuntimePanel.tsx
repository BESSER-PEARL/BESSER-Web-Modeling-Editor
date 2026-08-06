import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject } from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import {
  AgentConfigFormData,
  DEFAULT_AGENT_CONFIG_FORM,
  buildConfigYaml,
  agentConfigFormToYaml,
} from './AgentConfigYamlEditor';
import type { AgentRuntimeConfig } from '../../shared/services/storage/local-storage-repository';
import type { IntentRecognitionTechnology } from '../../shared/types/agent-config';
// @ts-ignore
import CodeMirrorLib from 'codemirror';
import 'codemirror/lib/codemirror.css';
// @ts-ignore
import 'codemirror/mode/yaml/yaml';
// @ts-ignore
import * as jsyaml from 'js-yaml';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type RuntimeSection =
  | 'runtime'
  | 'config-agent'
  | 'config-nlp'
  | 'config-platform-websocket'
  | 'config-platform-telegram'
  | 'config-platform-github'
  | 'config-platform-gitlab'
  | 'config-platform-a2a'
  | 'config-database'
  | 'config-custom'
  | 'config-raw';

export interface AgentRuntimePanelProps {
  currentProject: BesserProject | null;
  agentRuntimeConfig: AgentRuntimeConfig;
  updateAgentRuntimeConfig: (updates: Partial<AgentRuntimeConfig>) => void;
  agentLLMElements: Array<{ id: string; name: string }>;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        value ? 'bg-brand' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200',
          value ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function Field({ id, label, description, children }: {
  id: string; label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">{label}</Label>
      {children}
      {description && <p className="text-[11px] leading-snug text-muted-foreground/70">{description}</p>}
    </div>
  );
}

function TextField({ id, label, description, value, onChange, placeholder }: {
  id: string; label: string; description?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <Field id={id} label={label} description={description}>
      <Input
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-7 text-sm font-mono"
      />
    </Field>
  );
}

function BoolField({ id, label, description, value, onChange }: {
  id: string; label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <Field id={id} label={label} description={description}>
      <div className="flex items-center gap-2">
        <Toggle value={value} onChange={onChange} />
        <span className="text-xs text-muted-foreground">{value ? 'True' : 'False'}</span>
      </div>
    </Field>
  );
}

function DbFields({
  prefix, value, onChange,
}: {
  prefix: string;
  value: AgentConfigFormData['db']['monitoring'];
  onChange: (v: Partial<AgentConfigFormData['db']['monitoring']>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField id={`${prefix}-dialect`} label="dialect" value={value.dialect} onChange={v => onChange({ dialect: v })} description="Database system identifier (e.g. postgresql)" />
      <TextField id={`${prefix}-host`} label="host" value={value.host} onChange={v => onChange({ host: v })} description="Database server address" />
      <TextField id={`${prefix}-port`} label="port" value={value.port} onChange={v => onChange({ port: v })} description="Database connection port" />
      <TextField id={`${prefix}-database`} label="database" value={value.database} onChange={v => onChange({ database: v })} description="Database name" />
      <TextField id={`${prefix}-username`} label="username" value={value.username} onChange={v => onChange({ username: v })} description="Database user credentials" />
      <TextField id={`${prefix}-password`} label="password" value={value.password} onChange={v => onChange({ password: v })} description="Database authentication password" />
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────

export function AgentRuntimePanel({
  currentProject,
  agentRuntimeConfig,
  updateAgentRuntimeConfig,
  agentLLMElements,
}: AgentRuntimePanelProps) {
  const [activeSection, setActiveSection] = useState<RuntimeSection>('runtime');

  // ── Form state (mirrors AgentConfigYamlEditor) ───────────
  const initialForm = useMemo<AgentConfigFormData>(() => {
    const d = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    if (d?.agentConfigForm) return d.agentConfigForm as unknown as AgentConfigFormData;
    return DEFAULT_AGENT_CONFIG_FORM;
  }, [currentProject]);

  const initialCustomYaml = useMemo<string>(() => {
    const d = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    if (typeof d?.agentConfigCustomYaml === 'string') return d.agentConfigCustomYaml;
    if (!d?.agentConfigForm && typeof d?.configYaml === 'string' && d.configYaml !== agentConfigFormToYaml(DEFAULT_AGENT_CONFIG_FORM)) {
      return d.configYaml;
    }
    return '';
  }, [currentProject]);

  const [form, setForm] = useState<AgentConfigFormData>(initialForm);
  const [customYaml, setCustomYaml] = useState<string>(initialCustomYaml);
  const [customYamlError, setCustomYamlError] = useState<string | null>(null);

  useEffect(() => { setForm(initialForm); }, [initialForm]);
  useEffect(() => { setCustomYaml(initialCustomYaml); }, [initialCustomYaml]);

  const generatedYaml = useMemo(() => buildConfigYaml(form, customYaml), [form, customYaml]);

  // ── Persistence ──────────────────────────────────────────
  const persist = useCallback((nextForm: AgentConfigFormData, nextCustomYaml: string) => {
    const project = ProjectStorageRepository.getCurrentProject();
    if (!project) return;
    const latest = ProjectStorageRepository.loadProject(project.id) || project;
    const diagram = getActiveDiagram(latest, 'AgentDiagram');
    if (!diagram) return;
    ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
      ...diagram,
      configYaml: buildConfigYaml(nextForm, nextCustomYaml),
      agentConfigForm: nextForm as unknown as Record<string, unknown>,
      agentConfigCustomYaml: nextCustomYaml,
    });
  }, []);

  const updateForm = useCallback((updater: (prev: AgentConfigFormData) => AgentConfigFormData) => {
    setForm(prev => {
      const next = updater(prev);
      persist(next, customYaml);
      return next;
    });
  }, [customYaml, persist]);

  const updateCustomYaml = useCallback((value: string) => {
    setCustomYaml(value);
    persist(form, value);
    try {
      if (value.trim()) (jsyaml as any).load(value);
      setCustomYamlError(null);
    } catch (e: any) {
      setCustomYamlError(e.message ?? String(e));
    }
  }, [form, persist]);

  // ── Section updaters ─────────────────────────────────────
  const setAgent = (v: Partial<AgentConfigFormData['agent']>) =>
    updateForm(f => ({ ...f, agent: { ...f.agent, ...v } }));
  const setNlp = (v: Partial<AgentConfigFormData['nlp']>) =>
    updateForm(f => ({ ...f, nlp: { ...f.nlp, ...v } }));
  const setWs = (v: Partial<AgentConfigFormData['platforms']['websocket']>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, websocket: { ...f.platforms.websocket, ...v } } }));
  const setTelegram = (v: Partial<AgentConfigFormData['platforms']['telegram']>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, telegram: { ...f.platforms.telegram, ...v } } }));
  const setGithub = (v: Partial<AgentConfigFormData['platforms']['github']>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, github: { ...f.platforms.github, ...v } } }));
  const setGitlab = (v: Partial<AgentConfigFormData['platforms']['gitlab']>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, gitlab: { ...f.platforms.gitlab, ...v } } }));
  const setA2a = (v: Partial<AgentConfigFormData['platforms']['a2a']>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, a2a: { ...f.platforms.a2a, ...v } } }));
  const setMonitoring = (v: Partial<AgentConfigFormData['db']['monitoring']>) =>
    updateForm(f => ({ ...f, db: { ...f.db, monitoring: { ...f.db.monitoring, ...v } } }));
  const setStreamlitDb = (v: Partial<AgentConfigFormData['db']['streamlit_db']>) =>
    updateForm(f => ({ ...f, db: { ...f.db, streamlit_db: { ...f.db.streamlit_db, ...v } } }));

  // ── Raw YAML CodeMirror ──────────────────────────────────
  const rawCmContainerRef = useRef<HTMLDivElement>(null);
  const rawCmInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (activeSection !== 'config-raw' || !rawCmContainerRef.current || rawCmInstanceRef.current) return;
    const cm = (CodeMirrorLib as any)(rawCmContainerRef.current, {
      value: generatedYaml,
      mode: 'yaml',
      lineNumbers: true,
      readOnly: true,
      lineWrapping: true,
      tabSize: 2,
    });
    rawCmInstanceRef.current = cm;
    return () => {
      if (rawCmInstanceRef.current) {
        rawCmInstanceRef.current.getWrapperElement().remove();
        rawCmInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  useEffect(() => {
    if (rawCmInstanceRef.current && rawCmInstanceRef.current.getValue() !== generatedYaml) {
      rawCmInstanceRef.current.setValue(generatedYaml);
    }
  }, [generatedYaml]);

  // ── Custom YAML CodeMirror ───────────────────────────────
  const customCmContainerRef = useRef<HTMLDivElement>(null);
  const customCmInstanceRef = useRef<any>(null);
  const updateCustomYamlRef = useRef(updateCustomYaml);
  useEffect(() => { updateCustomYamlRef.current = updateCustomYaml; }, [updateCustomYaml]);

  useEffect(() => {
    if (activeSection !== 'config-custom' || !customCmContainerRef.current || customCmInstanceRef.current) return;
    const cm = (CodeMirrorLib as any)(customCmContainerRef.current, {
      value: customYaml,
      mode: 'yaml',
      lineNumbers: true,
      lineWrapping: true,
      tabSize: 2,
    });
    cm.on('change', (instance: any) => {
      updateCustomYamlRef.current(instance.getValue());
    });
    customCmInstanceRef.current = cm;
    return () => {
      if (customCmInstanceRef.current) {
        customCmInstanceRef.current.getWrapperElement().remove();
        customCmInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  useEffect(() => {
    if (customCmInstanceRef.current && customCmInstanceRef.current.getValue() !== customYaml) {
      customCmInstanceRef.current.setValue(customYaml);
    }
  }, [customYaml]);

  // ── Platform sidebar items ───────────────────────────────
  const platformItems: Array<{
    key: RuntimeSection; label: string; enabled: boolean; onToggle: (v: boolean) => void;
  }> = [
    { key: 'config-platform-websocket', label: 'WebSocket', enabled: form.platforms.websocket.enabled, onToggle: v => setWs({ enabled: v }) },
    { key: 'config-platform-telegram', label: 'Telegram', enabled: form.platforms.telegram.enabled, onToggle: v => setTelegram({ enabled: v }) },
    { key: 'config-platform-github', label: 'GitHub', enabled: form.platforms.github.enabled, onToggle: v => setGithub({ enabled: v }) },
    { key: 'config-platform-gitlab', label: 'GitLab', enabled: form.platforms.gitlab.enabled, onToggle: v => setGitlab({ enabled: v }) },
    { key: 'config-platform-a2a', label: 'A2A', enabled: form.platforms.a2a.enabled, onToggle: v => setA2a({ enabled: v }) },
  ];

  function navBtn(key: RuntimeSection, label: string) {
    return (
      <button
        key={key}
        type="button"
        onClick={() => setActiveSection(key)}
        className={cn(
          'flex w-full items-center px-4 py-2 text-sm transition-colors',
          activeSection === key
            ? 'bg-accent text-accent-foreground font-medium'
            : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        )}
      >
        {label}
      </button>
    );
  }

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="flex-1 overflow-y-auto">
    <div className="mx-auto flex max-w-6xl min-h-full">

      {/* ── Left sidebar ─────────────────────────────────── */}
      <nav className="w-56 shrink-0 border-r border-border py-3">

        <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </p>

        {navBtn('runtime', 'Agent Runtime')}

        <div className="mt-4">
          <p className="px-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Config File
          </p>

          {navBtn('config-agent', 'Agent')}
          {navBtn('config-nlp', 'NLP')}

          <p className="px-4 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
            Platforms
          </p>

          {platformItems.map(p => (
            <div key={p.key} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveSection(p.key)}
                className={cn(
                  'flex flex-1 items-center py-2 pl-8 pr-2 text-sm transition-colors',
                  activeSection === p.key
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                {p.label}
              </button>
              <div className="pr-3 shrink-0">
                <Toggle value={p.enabled} onChange={p.onToggle} />
              </div>
            </div>
          ))}

          {navBtn('config-database', 'Database')}
          {navBtn('config-custom', 'Custom YAML')}
          {navBtn('config-raw', 'Raw YAML')}
        </div>
      </nav>

      {/* ── Main content ─────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="px-8 py-6 space-y-4">

          {/* Agent Runtime */}
          {activeSection === 'runtime' && (
            <>
              <SectionHeader
                title="Agent Runtime"
                description="Runtime settings for the active agent diagram. Persisted on the diagram itself, not in global storage."
              />
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="arp-platform">Platform</Label>
                    <select
                      id="arp-platform"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={agentRuntimeConfig.agentPlatform}
                      onChange={e => updateAgentRuntimeConfig({
                        agentPlatform: e.target.value,
                        agentPlatformUseStreamlit: e.target.value !== 'websocket' ? false : agentRuntimeConfig.agentPlatformUseStreamlit,
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
                          onChange={e => updateAgentRuntimeConfig({ agentPlatformUseStreamlit: e.target.checked })}
                        />
                        Use Streamlit UI
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="arp-intent">Intent Recognition</Label>
                    <select
                      id="arp-intent"
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                      value={agentRuntimeConfig.intentRecognitionTechnology}
                      onChange={e => updateAgentRuntimeConfig({
                        intentRecognitionTechnology: e.target.value as IntentRecognitionTechnology,
                      })}
                    >
                      <option value="classical">Classical</option>
                      <option value="llm-based">LLM-based</option>
                    </select>
                  </div>

                  {agentRuntimeConfig.intentRecognitionTechnology === 'llm-based' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="arp-llm">LLM</Label>
                      <select
                        id="arp-llm"
                        className="h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/20"
                        value={agentRuntimeConfig.agentLlmName}
                        onChange={e => updateAgentRuntimeConfig({ agentLlmName: e.target.value })}
                      >
                        <option value="">(use default)</option>
                        {agentLLMElements.map(entry => (
                          <option key={entry.id} value={entry.name}>
                            {entry.name || '(unnamed LLM)'}
                          </option>
                        ))}
                      </select>
                      {agentLLMElements.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Define LLMs in the <strong>Agent Components</strong> page.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Agent config */}
          {activeSection === 'config-agent' && (
            <>
              <SectionHeader title="Agent" description="Core agent execution settings." />
              <TextField
                id="cfg-agent-ctd"
                label="check_transitions_delay"
                value={form.agent.check_transitions_delay}
                onChange={v => setAgent({ check_transitions_delay: v })}
                description="Delay in seconds between each transition evaluation cycle."
              />
            </>
          )}

          {/* NLP config */}
          {activeSection === 'config-nlp' && (
            <>
              <SectionHeader title="NLP" description="Natural language processing settings for intent recognition." />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="cfg-nlp-lang" label="language" value={form.nlp.language} onChange={v => setNlp({ language: v })} description="Expected user language (ISO 639-1)." />
                  <TextField id="cfg-nlp-region" label="region" value={form.nlp.region} onChange={v => setNlp({ region: v })} description="Language region (ISO 3166-1 alpha-2)." />
                  <TextField id="cfg-nlp-tz" label="timezone" value={form.nlp.timezone} onChange={v => setNlp({ timezone: v })} description="Timezone for datetime operations." />
                  <TextField id="cfg-nlp-thresh" label="intent_threshold" value={form.nlp.intent_threshold} onChange={v => setNlp({ intent_threshold: v })} description="Confidence threshold for intent predictions." />
                </div>
                <BoolField id="cfg-nlp-prep" label="pre_processing" value={form.nlp.pre_processing} onChange={v => setNlp({ pre_processing: v })} description="Enables stemming to reduce words to base forms." />
                <div className="rounded-md border border-border p-3 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">API Keys</p>
                  <TextField id="cfg-nlp-hf-token" label="HuggingFace token" value={form.nlp.huggingface_token} onChange={v => setNlp({ huggingface_token: v })} description="API key for HuggingFace Inference API." />
                  <TextField id="cfg-nlp-oai-key" label="OpenAI api_key" value={form.nlp.openai_api_key} onChange={v => setNlp({ openai_api_key: v })} description="OpenAI API key for LLM access." />
                  <TextField id="cfg-nlp-rep-key" label="Replicate api_key" value={form.nlp.replicate_api_key} onChange={v => setNlp({ replicate_api_key: v })} description="Replicate API key for model inference." />
                </div>
              </div>
            </>
          )}

          {/* WebSocket platform */}
          {activeSection === 'config-platform-websocket' && (
            <>
              <SectionHeader title="WebSocket" description="WebSocket server and Streamlit UI configuration." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Enabled</Label>
                  <Toggle value={form.platforms.websocket.enabled} onChange={v => setWs({ enabled: v })} />
                </div>
                {form.platforms.websocket.enabled && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField id="cfg-ws-host" label="host" value={form.platforms.websocket.host} onChange={v => setWs({ host: v })} description="Server address for WebSocket connections." />
                      <TextField id="cfg-ws-port" label="port" value={form.platforms.websocket.port} onChange={v => setWs({ port: v })} description="Port number for WebSocket server." />
                    </div>
                    <div className="rounded-md border border-border p-3 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">Streamlit</p>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField id="cfg-ws-st-host" label="host" value={form.platforms.websocket.streamlit_host} onChange={v => setWs({ streamlit_host: v })} description="Host address for Streamlit UI." />
                        <TextField id="cfg-ws-st-port" label="port" value={form.platforms.websocket.streamlit_port} onChange={v => setWs({ streamlit_port: v })} description="Port for Streamlit UI." />
                      </div>
                      <div className="rounded-md border border-border/60 p-3 space-y-3">
                        <p className="text-xs font-medium text-muted-foreground">Chat</p>
                        <div className="grid grid-cols-2 gap-3">
                          <TextField id="cfg-ws-chat-size" label="size" value={form.platforms.websocket.chat_size} onChange={v => setWs({ chat_size: v })} description="Default font size for chat." />
                          <TextField id="cfg-ws-chat-font" label="font" value={form.platforms.websocket.chat_font} onChange={v => setWs({ chat_font: v })} description="Font family for chat text." />
                          <TextField id="cfg-ws-chat-ls" label="line_spacing" value={form.platforms.websocket.chat_line_spacing} onChange={v => setWs({ chat_line_spacing: v })} description="Line height multiplier." />
                          <TextField id="cfg-ws-chat-align" label="alignment" value={form.platforms.websocket.chat_alignment} onChange={v => setWs({ chat_alignment: v })} description="Horizontal text alignment." />
                          <TextField id="cfg-ws-chat-color" label="color" value={form.platforms.websocket.chat_color} onChange={v => setWs({ chat_color: v })} description="Text color setting." />
                          <TextField id="cfg-ws-chat-contrast" label="contrast" value={form.platforms.websocket.chat_contrast} onChange={v => setWs({ chat_contrast: v })} description="Contrast level for readability." />
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {/* Telegram platform */}
          {activeSection === 'config-platform-telegram' && (
            <>
              <SectionHeader title="Telegram" description="Telegram bot integration settings." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Enabled</Label>
                  <Toggle value={form.platforms.telegram.enabled} onChange={v => setTelegram({ enabled: v })} />
                </div>
                {form.platforms.telegram.enabled && (
                  <TextField id="cfg-tg-token" label="token" value={form.platforms.telegram.token} onChange={v => setTelegram({ token: v })} description="Bot authentication token for Telegram API." />
                )}
              </div>
            </>
          )}

          {/* GitHub platform */}
          {activeSection === 'config-platform-github' && (
            <>
              <SectionHeader title="GitHub" description="GitHub webhook integration settings." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Enabled</Label>
                  <Toggle value={form.platforms.github.enabled} onChange={v => setGithub({ enabled: v })} />
                </div>
                {form.platforms.github.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField id="cfg-gh-pt" label="personal_token" value={form.platforms.github.personal_token} onChange={v => setGithub({ personal_token: v })} description="Personal Access Token for GitHub API." />
                    <TextField id="cfg-gh-wt" label="webhook_token" value={form.platforms.github.webhook_token} onChange={v => setGithub({ webhook_token: v })} description="Secret token for webhook verification." />
                    <TextField id="cfg-gh-wp" label="webhook_port" value={form.platforms.github.webhook_port} onChange={v => setGithub({ webhook_port: v })} description="Local server port exposed to GitHub." />
                  </div>
                )}
              </div>
            </>
          )}

          {/* GitLab platform */}
          {activeSection === 'config-platform-gitlab' && (
            <>
              <SectionHeader title="GitLab" description="GitLab webhook integration settings." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Enabled</Label>
                  <Toggle value={form.platforms.gitlab.enabled} onChange={v => setGitlab({ enabled: v })} />
                </div>
                {form.platforms.gitlab.enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <TextField id="cfg-gl-pt" label="personal_token" value={form.platforms.gitlab.personal_token} onChange={v => setGitlab({ personal_token: v })} description="Personal Access Token for GitLab API." />
                    <TextField id="cfg-gl-wt" label="webhook_token" value={form.platforms.gitlab.webhook_token} onChange={v => setGitlab({ webhook_token: v })} description="Secret token for webhook verification." />
                    <TextField id="cfg-gl-wp" label="webhook_port" value={form.platforms.gitlab.webhook_port} onChange={v => setGitlab({ webhook_port: v })} description="Local server port exposed to GitLab." />
                  </div>
                )}
              </div>
            </>
          )}

          {/* A2A platform */}
          {activeSection === 'config-platform-a2a' && (
            <>
              <SectionHeader title="A2A" description="Agent-to-agent communication settings." />
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Label className="text-xs font-medium">Enabled</Label>
                  <Toggle value={form.platforms.a2a.enabled} onChange={v => setA2a({ enabled: v })} />
                </div>
                {form.platforms.a2a.enabled && (
                  <TextField id="cfg-a2a-port" label="port" value={form.platforms.a2a.port} onChange={v => setA2a({ port: v })} description="Local port for inter-agent communication." />
                )}
              </div>
            </>
          )}

          {/* Database */}
          {activeSection === 'config-database' && (
            <>
              <SectionHeader title="Database" description="Database connections for monitoring and Streamlit." />
              <div className="space-y-4">
                <div className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Monitoring</p>
                    <Toggle value={form.db.monitoring.enabled} onChange={v => setMonitoring({ enabled: v })} />
                  </div>
                  {form.db.monitoring.enabled && (
                    <DbFields prefix="cfg-mon" value={form.db.monitoring} onChange={v => setMonitoring(v)} />
                  )}
                </div>
                <div className="rounded-md border border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Streamlit</p>
                    <Toggle value={form.db.streamlit_db.enabled} onChange={v => setStreamlitDb({ enabled: v })} />
                  </div>
                  {form.db.streamlit_db.enabled && (
                    <DbFields prefix="cfg-stdb" value={form.db.streamlit_db} onChange={v => setStreamlitDb(v)} />
                  )}
                </div>
              </div>
            </>
          )}

          {/* Custom YAML */}
          {activeSection === 'config-custom' && (
            <>
              <SectionHeader
                title="Custom YAML"
                description="Additional YAML properties appended at the end of the generated config.yaml."
              />
              <div className="space-y-2">
                {customYamlError && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    <span className="font-semibold">YAML syntax error:</span> {customYamlError}
                  </div>
                )}
                <div
                  ref={customCmContainerRef}
                  className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[200px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm"
                />
              </div>
            </>
          )}

          {/* Raw YAML */}
          {activeSection === 'config-raw' && (
            <>
              <SectionHeader
                title="Raw YAML"
                description="Read-only view of the full generated config.yaml. Edit individual sections or add custom YAML."
              />
              <div
                ref={rawCmContainerRef}
                className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[400px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm [&_.CodeMirror]:bg-muted/30"
              />
            </>
          )}

        </div>
      </div>
    </div>
    </div>
  );
}
