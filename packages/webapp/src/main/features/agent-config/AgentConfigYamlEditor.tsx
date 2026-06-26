import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getActiveDiagram } from '../../shared/types/project';
import type { BesserProject } from '../../shared/types/project';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
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

export interface AgentConfigFormData {
  agent: { check_transitions_delay: string };
  nlp: {
    language: string;
    region: string;
    timezone: string;
    pre_processing: boolean;
    intent_threshold: string;
    huggingface_token: string;
    openai_api_key: string;
    replicate_api_key: string;
  };
  platforms: {
    websocket: {
      enabled: boolean;
      host: string;
      port: string;
      streamlit_host: string;
      streamlit_port: string;
      chat_size: string;
      chat_font: string;
      chat_line_spacing: string;
      chat_alignment: string;
      chat_color: string;
      chat_contrast: string;
    };
    telegram: { enabled: boolean; token: string };
    github: { enabled: boolean; personal_token: string; webhook_token: string; webhook_port: string };
    gitlab: { enabled: boolean; personal_token: string; webhook_token: string; webhook_port: string };
    a2a: { enabled: boolean; port: string };
  };
  db: {
    monitoring: { enabled: boolean; dialect: string; host: string; port: string; database: string; username: string; password: string };
    streamlit_db: { enabled: boolean; dialect: string; host: string; port: string; database: string; username: string; password: string };
  };
}

export const DEFAULT_AGENT_CONFIG_FORM: AgentConfigFormData = {
  agent: { check_transitions_delay: '5' },
  nlp: {
    language: 'en',
    region: 'US',
    timezone: 'Europe/Madrid',
    pre_processing: true,
    intent_threshold: '0.4',
    huggingface_token: 'YOUR-TOKEN',
    openai_api_key: 'YOUR-API-KEY',
    replicate_api_key: 'YOUR-API-KEY',
  },
  platforms: {
    websocket: {
      enabled: true,
      host: 'localhost',
      port: '8765',
      streamlit_host: 'localhost',
      streamlit_port: '5000',
      chat_size: '16',
      chat_font: 'sans',
      chat_line_spacing: '1.5',
      chat_alignment: 'left',
      chat_color: 'inherit',
      chat_contrast: 'medium',
    },
    telegram: { enabled: true, token: 'YOUR-BOT-TOKEN' },
    github: { enabled: true, personal_token: 'YOUR-PERSONAL-TOKEN', webhook_token: 'YOUR-WEBHOOK-TOKEN', webhook_port: '8901' },
    gitlab: { enabled: true, personal_token: 'YOUR-PERSONAL-TOKEN', webhook_token: 'YOUR-WEBHOOK-TOKEN', webhook_port: '8901' },
    a2a: { enabled: true, port: '8000' },
  },
  db: {
    monitoring: { enabled: true, dialect: 'postgresql', host: 'YOUR-DB-HOST', port: '5432', database: 'YOUR-DB-NAME', username: 'YOUR-DB-USERNAME', password: 'YOUR-DB-PASSWORD' },
    streamlit_db: { enabled: true, dialect: 'postgresql', host: 'YOUR-DB-HOST', port: '5432', database: 'YOUR-DB-NAME', username: 'YOUR-DB-USERNAME', password: 'YOUR-DB-PASSWORD' },
  },
};

// ─────────────────────────────────────────────────────────────
// YAML generation
// ─────────────────────────────────────────────────────────────

// Render a user-supplied scalar safely for YAML. Bare numbers pass through
// unquoted and a conservative set of plain tokens stays unquoted (so default
// values are emitted exactly as before); anything containing YAML-significant
// characters, a leading indicator, or whitespace is single-quoted so values
// like passwords or tokens can't break or inject structure into the config.
function yamlValue(v: string): string {
  const t = v.trim();
  if (t === '') return "''";
  if (!isNaN(Number(t))) return t;
  if (/^[A-Za-z0-9][A-Za-z0-9_.\-/]*$/.test(t)) return t;
  return `'${t.replace(/'/g, "''")}'`;
}

export function agentConfigFormToYaml(form: AgentConfigFormData): string {
  const lines: string[] = [];

  // ── Agent ──────────────────────────────────
  lines.push('agent:');
  if (form.agent.check_transitions_delay.trim())
    lines.push(`  check_transitions_delay: ${yamlValue(form.agent.check_transitions_delay)}`);
  lines.push('');

  // ── NLP ────────────────────────────────────
  lines.push('nlp:');
  if (form.nlp.language) lines.push(`  language: ${yamlValue(form.nlp.language)}`);
  if (form.nlp.region) lines.push(`  region: ${yamlValue(form.nlp.region)}`);
  if (form.nlp.timezone) lines.push(`  timezone: ${yamlValue(form.nlp.timezone)}`);
  lines.push(`  pre_processing: ${form.nlp.pre_processing ? 'True' : 'False'}`);
  if (form.nlp.intent_threshold.trim()) lines.push(`  intent_threshold: ${yamlValue(form.nlp.intent_threshold)}`);
  if (form.nlp.huggingface_token) { lines.push('  huggingface:'); lines.push(`    token: ${yamlValue(form.nlp.huggingface_token)}`); }
  if (form.nlp.openai_api_key) { lines.push('  openai:'); lines.push(`    api_key: ${yamlValue(form.nlp.openai_api_key)}`); }
  if (form.nlp.replicate_api_key) { lines.push('  replicate:'); lines.push(`    api_key: ${yamlValue(form.nlp.replicate_api_key)}`); }
  lines.push('');

  // ── Platforms ──────────────────────────────
  const { websocket: ws, telegram, github, gitlab, a2a } = form.platforms;
  const anyPlatform = ws.enabled || telegram.enabled || github.enabled || gitlab.enabled || a2a.enabled;
  if (anyPlatform) {
    lines.push('platforms:');
    if (ws.enabled) {
      lines.push('  websocket:');
      if (ws.host) lines.push(`    host: ${yamlValue(ws.host)}`);
      if (ws.port.trim()) lines.push(`    port: ${yamlValue(ws.port)}`);
      lines.push('    streamlit:');
      if (ws.streamlit_host) lines.push(`      host: ${yamlValue(ws.streamlit_host)}`);
      if (ws.streamlit_port.trim()) lines.push(`      port: ${yamlValue(ws.streamlit_port)}`);
      lines.push('      chat:');
      if (ws.chat_size.trim()) lines.push(`        size: ${yamlValue(ws.chat_size)}`);
      if (ws.chat_font) lines.push(`        font: ${yamlValue(ws.chat_font)}`);
      if (ws.chat_line_spacing.trim()) lines.push(`        line_spacing: ${yamlValue(ws.chat_line_spacing)}`);
      if (ws.chat_alignment) lines.push(`        alignment: ${yamlValue(ws.chat_alignment)}`);
      if (ws.chat_color) lines.push(`        color: ${yamlValue(ws.chat_color)}`);
      if (ws.chat_contrast) lines.push(`        contrast: ${yamlValue(ws.chat_contrast)}`);
    }
    if (telegram.enabled) {
      lines.push('  telegram:');
      if (telegram.token) lines.push(`    token: ${yamlValue(telegram.token)}`);
    }
    if (github.enabled) {
      lines.push('  github:');
      if (github.personal_token) lines.push(`    personal_token: ${yamlValue(github.personal_token)}`);
      if (github.webhook_token) lines.push(`    webhook_token: ${yamlValue(github.webhook_token)}`);
      if (github.webhook_port.trim()) lines.push(`    webhook_port: ${yamlValue(github.webhook_port)}`);
    }
    if (gitlab.enabled) {
      lines.push('  gitlab:');
      if (gitlab.personal_token) lines.push(`    personal_token: ${yamlValue(gitlab.personal_token)}`);
      if (gitlab.webhook_token) lines.push(`    webhook_token: ${yamlValue(gitlab.webhook_token)}`);
      if (gitlab.webhook_port.trim()) lines.push(`    webhook_port: ${yamlValue(gitlab.webhook_port)}`);
    }
    if (a2a.enabled) {
      lines.push('  a2a:');
      if (a2a.port.trim()) lines.push(`    port: ${yamlValue(a2a.port)}`);
    }
    lines.push('');
  }

  // ── DB ─────────────────────────────────────
  const { monitoring, streamlit_db } = form.db;
  if (monitoring.enabled || streamlit_db.enabled) {
    lines.push('db:');
    if (monitoring.enabled) {
      lines.push('  monitoring:');
      lines.push(`    enabled: True`);
      if (monitoring.dialect) lines.push(`    dialect: ${yamlValue(monitoring.dialect)}`);
      if (monitoring.host) lines.push(`    host: ${yamlValue(monitoring.host)}`);
      if (monitoring.port.trim()) lines.push(`    port: ${yamlValue(monitoring.port)}`);
      if (monitoring.database) lines.push(`    database: ${yamlValue(monitoring.database)}`);
      if (monitoring.username) lines.push(`    username: ${yamlValue(monitoring.username)}`);
      if (monitoring.password) lines.push(`    password: ${yamlValue(monitoring.password)}`);
    }
    if (streamlit_db.enabled) {
      lines.push('  streamlit:');
      lines.push(`    enabled: True`);
      if (streamlit_db.dialect) lines.push(`    dialect: ${yamlValue(streamlit_db.dialect)}`);
      if (streamlit_db.host) lines.push(`    host: ${yamlValue(streamlit_db.host)}`);
      if (streamlit_db.port.trim()) lines.push(`    port: ${yamlValue(streamlit_db.port)}`);
      if (streamlit_db.database) lines.push(`    database: ${yamlValue(streamlit_db.database)}`);
      if (streamlit_db.username) lines.push(`    username: ${yamlValue(streamlit_db.username)}`);
      if (streamlit_db.password) lines.push(`    password: ${yamlValue(streamlit_db.password)}`);
    }
  }

  return lines.join('\n').trimEnd();
}

export function buildConfigYaml(form: AgentConfigFormData, customYaml: string): string {
  const base = agentConfigFormToYaml(form);
  const extra = customYaml.trim();
  if (!extra) return base;
  return base + '\n\n' + extra;
}

// ─────────────────────────────────────────────────────────────
// Helper sub-components
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

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
  indent?: boolean;
}

function Section({ title, defaultOpen = true, right, children, indent = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={cn('rounded-md border border-border', indent && 'ml-4')}>
        <CollapsibleTrigger asChild>
          <div className="flex cursor-pointer select-none items-center justify-between px-3 py-2 hover:bg-muted/40 transition-colors rounded-t-md">
            <div className="flex items-center gap-2">
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
              <span className="text-sm font-medium">{title}</span>
            </div>
            {right && <div onClick={e => e.stopPropagation()}>{right}</div>}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 px-3 pb-3 pt-2">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface FieldProps {
  id: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}

function Field({ id, label, description, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium text-foreground/80">
        {label}
      </Label>
      {children}
      {description && <p className="text-[11px] leading-snug text-muted-foreground/70">{description}</p>}
    </div>
  );
}

function TextField({
  id, label, description, value, onChange, placeholder,
}: {
  id: string; label: string; description?: string; value: string; onChange: (v: string) => void; placeholder?: string;
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

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface AgentConfigYamlEditorProps {
  currentProject: BesserProject | null;
}

export function AgentConfigYamlEditor({ currentProject }: AgentConfigYamlEditorProps) {
  // ── Initial values from diagram ───────────────────────────
  const initialForm = useMemo<AgentConfigFormData>(() => {
    const d = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    if (d?.agentConfigForm) return d.agentConfigForm as unknown as AgentConfigFormData;
    return DEFAULT_AGENT_CONFIG_FORM;
  }, [currentProject]);

  const initialCustomYaml = useMemo<string>(() => {
    const d = currentProject ? getActiveDiagram(currentProject, 'AgentDiagram') : null;
    if (typeof d?.agentConfigCustomYaml === 'string') return d.agentConfigCustomYaml;
    // Migration: if hand-written configYaml exists but no form data, move it to custom YAML.
    if (!d?.agentConfigForm && typeof d?.configYaml === 'string' && d.configYaml !== agentConfigFormToYaml(DEFAULT_AGENT_CONFIG_FORM)) {
      return d.configYaml;
    }
    return '';
  }, [currentProject]);

  const [form, setForm] = useState<AgentConfigFormData>(initialForm);
  const [customYaml, setCustomYaml] = useState<string>(initialCustomYaml);
  const [activeTab, setActiveTab] = useState<'form' | 'raw'>('form');
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

  // ── Raw YAML tab — read-only CodeMirror ──────────────────
  const rawCmContainerRef = useRef<HTMLDivElement>(null);
  const rawCmInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (activeTab !== 'raw' || !rawCmContainerRef.current || rawCmInstanceRef.current) return;
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
  }, [activeTab]);

  useEffect(() => {
    if (rawCmInstanceRef.current && rawCmInstanceRef.current.getValue() !== generatedYaml) {
      rawCmInstanceRef.current.setValue(generatedYaml);
    }
  }, [generatedYaml]);

  // ── Custom YAML — editable CodeMirror ────────────────────
  const customCmContainerRef = useRef<HTMLDivElement>(null);
  const customCmInstanceRef = useRef<any>(null);
  const updateCustomYamlRef = useRef(updateCustomYaml);
  useEffect(() => { updateCustomYamlRef.current = updateCustomYaml; }, [updateCustomYaml]);

  useEffect(() => {
    if (activeTab !== 'form' || !customCmContainerRef.current || customCmInstanceRef.current) return;
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
  }, [activeTab]);

  useEffect(() => {
    if (customCmInstanceRef.current && customCmInstanceRef.current.getValue() !== customYaml) {
      customCmInstanceRef.current.setValue(customYaml);
    }
  }, [customYaml]);

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

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex rounded-md border border-input bg-muted/40 p-0.5 w-fit">
        {(['form', 'raw'] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-3 py-1 text-xs rounded-sm transition-colors',
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab === 'form' ? 'Form' : 'Raw YAML'}
          </button>
        ))}
      </div>

      {/* ── FORM TAB ─────────────────────────────────── */}
      {activeTab === 'form' && (
        <div className="space-y-3">

          {/* Agent */}
          <Section title="Agent" defaultOpen>
            <TextField
              id="agent-ctd"
              label="check_transitions_delay"
              value={form.agent.check_transitions_delay}
              onChange={v => setAgent({ check_transitions_delay: v })}
              description="Delay in seconds between each transition evaluation cycle."
            />
          </Section>

          {/* NLP */}
          <Section title="NLP" defaultOpen>
            <div className="grid grid-cols-2 gap-3">
              <TextField id="nlp-lang" label="language" value={form.nlp.language} onChange={v => setNlp({ language: v })} description="Expected user language (ISO 639-1). Impacts NLP quality." />
              <TextField id="nlp-region" label="region" value={form.nlp.region} onChange={v => setNlp({ region: v })} description="Language region (ISO 3166-1 alpha-2) for enhanced NLP processing." />
              <TextField id="nlp-tz" label="timezone" value={form.nlp.timezone} onChange={v => setNlp({ timezone: v })} description="Timezone for datetime operations (tz database format)." />
              <TextField id="nlp-thresh" label="intent_threshold" value={form.nlp.intent_threshold} onChange={v => setNlp({ intent_threshold: v })} description="Confidence threshold below which predictions fall back to fallback scenarios." />
            </div>
            <BoolField id="nlp-prep" label="pre_processing" value={form.nlp.pre_processing} onChange={v => setNlp({ pre_processing: v })} description="Enables stemming to reduce words to base forms, improving generalization of user inputs." />
            <Section title="HuggingFace" defaultOpen={false} indent>
              <TextField id="nlp-hf-token" label="token" value={form.nlp.huggingface_token} onChange={v => setNlp({ huggingface_token: v })} description="API key needed to access the HuggingFace Inference API for LLM functionality." />
            </Section>
            <Section title="OpenAI" defaultOpen={false} indent>
              <TextField id="nlp-oai-key" label="api_key" value={form.nlp.openai_api_key} onChange={v => setNlp({ openai_api_key: v })} description="OpenAI API key for LLM access." />
            </Section>
            <Section title="Replicate" defaultOpen={false} indent>
              <TextField id="nlp-rep-key" label="api_key" value={form.nlp.replicate_api_key} onChange={v => setNlp({ replicate_api_key: v })} description="Replicate API key for model inference." />
            </Section>
          </Section>

          {/* Platforms */}
          <Section title="Platforms" defaultOpen>

            {/* WebSocket */}
            <Section
              title="websocket"
              defaultOpen={form.platforms.websocket.enabled}
              indent
              right={<Toggle value={form.platforms.websocket.enabled} onChange={v => setWs({ enabled: v })} />}
            >
              {form.platforms.websocket.enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <TextField id="ws-host" label="host" value={form.platforms.websocket.host} onChange={v => setWs({ host: v })} description="Server address for WebSocket connections." />
                    <TextField id="ws-port" label="port" value={form.platforms.websocket.port} onChange={v => setWs({ port: v })} description="Port number for WebSocket server." />
                  </div>
                  <Section title="streamlit" defaultOpen={false} indent>
                    <div className="grid grid-cols-2 gap-3">
                      <TextField id="ws-st-host" label="host" value={form.platforms.websocket.streamlit_host} onChange={v => setWs({ streamlit_host: v })} description="Host address for Streamlit UI deployment." />
                      <TextField id="ws-st-port" label="port" value={form.platforms.websocket.streamlit_port} onChange={v => setWs({ streamlit_port: v })} description="Port for accessing Streamlit UI." />
                    </div>
                    <Section title="chat" defaultOpen={false} indent>
                      <div className="grid grid-cols-2 gap-3">
                        <TextField id="ws-chat-size" label="size" value={form.platforms.websocket.chat_size} onChange={v => setWs({ chat_size: v })} description="Default font size for chat messages in Streamlit." />
                        <TextField id="ws-chat-font" label="font" value={form.platforms.websocket.chat_font} onChange={v => setWs({ chat_font: v })} description="Font family identifier for chat text." />
                        <TextField id="ws-chat-ls" label="line_spacing" value={form.platforms.websocket.chat_line_spacing} onChange={v => setWs({ chat_line_spacing: v })} description="Line height multiplier for chat messages." />
                        <TextField id="ws-chat-align" label="alignment" value={form.platforms.websocket.chat_alignment} onChange={v => setWs({ chat_alignment: v })} description="Horizontal text alignment in chat interface." />
                        <TextField id="ws-chat-color" label="color" value={form.platforms.websocket.chat_color} onChange={v => setWs({ chat_color: v })} description="Text color setting for chat display." />
                        <TextField id="ws-chat-contrast" label="contrast" value={form.platforms.websocket.chat_contrast} onChange={v => setWs({ chat_contrast: v })} description="Contrast level for text readability." />
                      </div>
                    </Section>
                  </Section>
                </>
              )}
            </Section>

            {/* Telegram */}
            <Section
              title="telegram"
              defaultOpen={form.platforms.telegram.enabled}
              indent
              right={<Toggle value={form.platforms.telegram.enabled} onChange={v => setTelegram({ enabled: v })} />}
            >
              {form.platforms.telegram.enabled && (
                <TextField id="tg-token" label="token" value={form.platforms.telegram.token} onChange={v => setTelegram({ token: v })} description="Bot authentication token for Telegram API." />
              )}
            </Section>

            {/* GitHub */}
            <Section
              title="github"
              defaultOpen={form.platforms.github.enabled}
              indent
              right={<Toggle value={form.platforms.github.enabled} onChange={v => setGithub({ enabled: v })} />}
            >
              {form.platforms.github.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="gh-pt" label="personal_token" value={form.platforms.github.personal_token} onChange={v => setGithub({ personal_token: v })} description="Personal Access Token for GitHub API authentication." />
                  <TextField id="gh-wt" label="webhook_token" value={form.platforms.github.webhook_token} onChange={v => setGithub({ webhook_token: v })} description="Secret token defined during webhook creation." />
                  <TextField id="gh-wp" label="webhook_port" value={form.platforms.github.webhook_port} onChange={v => setGithub({ webhook_port: v })} description="Local server port exposed/proxied to GitHub." />
                </div>
              )}
            </Section>

            {/* GitLab */}
            <Section
              title="gitlab"
              defaultOpen={form.platforms.gitlab.enabled}
              indent
              right={<Toggle value={form.platforms.gitlab.enabled} onChange={v => setGitlab({ enabled: v })} />}
            >
              {form.platforms.gitlab.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <TextField id="gl-pt" label="personal_token" value={form.platforms.gitlab.personal_token} onChange={v => setGitlab({ personal_token: v })} description="Personal Access Token for GitLab API authentication." />
                  <TextField id="gl-wt" label="webhook_token" value={form.platforms.gitlab.webhook_token} onChange={v => setGitlab({ webhook_token: v })} description="Secret token for webhook verification." />
                  <TextField id="gl-wp" label="webhook_port" value={form.platforms.gitlab.webhook_port} onChange={v => setGitlab({ webhook_port: v })} description="Local server port exposed/proxied to GitLab." />
                </div>
              )}
            </Section>

            {/* A2A */}
            <Section
              title="a2a"
              defaultOpen={form.platforms.a2a.enabled}
              indent
              right={<Toggle value={form.platforms.a2a.enabled} onChange={v => setA2a({ enabled: v })} />}
            >
              {form.platforms.a2a.enabled && (
                <TextField id="a2a-port" label="port" value={form.platforms.a2a.port} onChange={v => setA2a({ port: v })} description="Local port for inter-agent communication network." />
              )}
            </Section>
          </Section>

          {/* Database */}
          <Section title="Database (db)" defaultOpen={false}>
            {/* Monitoring */}
            <Section
              title="monitoring"
              defaultOpen={form.db.monitoring.enabled}
              indent
              right={<Toggle value={form.db.monitoring.enabled} onChange={v => setMonitoring({ enabled: v })} />}
            >
              {form.db.monitoring.enabled && (
                <DbFields
                  prefix="mon"
                  value={form.db.monitoring}
                  onChange={v => setMonitoring(v)}
                />
              )}
            </Section>

            {/* Streamlit DB */}
            <Section
              title="streamlit"
              defaultOpen={form.db.streamlit_db.enabled}
              indent
              right={<Toggle value={form.db.streamlit_db.enabled} onChange={v => setStreamlitDb({ enabled: v })} />}
            >
              {form.db.streamlit_db.enabled && (
                <DbFields
                  prefix="stdb"
                  value={form.db.streamlit_db}
                  onChange={v => setStreamlitDb(v)}
                />
              )}
            </Section>
          </Section>

          {/* Custom YAML */}
          <div className="space-y-1.5">
            {customYamlError && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span className="font-semibold">YAML syntax error:</span> {customYamlError}
              </div>
            )}
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Additional custom YAML properties
            </Label>
            <p className="text-[11px] text-muted-foreground/70">
              Any valid YAML added here is appended at the end of the generated <code>config.yaml</code>.
            </p>
            <div
              ref={customCmContainerRef}
              className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[80px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm"
            />
          </div>
        </div>
      )}

      {/* ── RAW YAML TAB ─────────────────────────────── */}
      {activeTab === 'raw' && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground/70">
            Read-only view of the generated <code>config.yaml</code> content. Edit using the Form tab.
          </p>
          <div
            ref={rawCmContainerRef}
            className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[400px] [&_.CodeMirror]:font-mono [&_.CodeMirror]:text-sm [&_.CodeMirror]:bg-muted/30"
          />
        </div>
      )}
    </div>
  );
}
