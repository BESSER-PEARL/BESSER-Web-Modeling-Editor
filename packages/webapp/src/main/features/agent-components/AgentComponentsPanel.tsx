import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Plus,
  Trash2,
  Cpu,
  Wrench,
  BookOpen,
  FolderOpen,
  Database,
  Server,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// @ts-ignore
import CodeMirrorLib from 'codemirror';
import 'codemirror/lib/codemirror.css';
// @ts-ignore
import 'codemirror/mode/python/python';

import { useAppSelector } from '../../app/store/hooks';
import { selectActiveDiagram, selectProject } from '../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram, isUMLModel } from '../../shared/types/project';
import type { SqlDatabaseEntry } from '../agent-config/AgentConfigYamlEditor';
import { DEFAULT_AGENT_CONFIG_FORM, buildConfigYaml } from '../agent-config/AgentConfigYamlEditor';

// ─────────────────────────────────────────────────────────────
// Element type constants
// ─────────────────────────────────────────────────────────────

const ELEMENT_TYPES = {
  AgentLLM: 'AgentLLM',
  AgentTool: 'AgentTool',
  AgentSkill: 'AgentSkill',
  AgentWorkspace: 'AgentWorkspace',
  AgentRagElement: 'AgentRagElement',
  AgentIntent: 'AgentIntent',
  AgentIntentBody: 'AgentIntentBody',
} as const;

type ActiveSection = 'llms' | 'intents' | 'tools' | 'skills' | 'workspaces' | 'rags' | 'sql';
type LLMProvider = 'openai' | 'huggingface' | 'huggingface_api' | 'replicate' | 'ollama';
type RagEmbeddingProvider = 'openai' | 'ollama';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function generateUUID(): string {
  return uuidv4();
}

function makeElementBase(type: string, extra: Record<string, unknown>) {
  return {
    id: generateUUID(),
    type,
    name: '',
    owner: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    ...extra,
  };
}

function makeVisibleElementBase(type: string, _existingCount: number, extra: Record<string, unknown>) {
  return {
    id: generateUUID(),
    type,
    name: '',
    owner: null,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────
// UI components
// ─────────────────────────────────────────────────────────────

interface ItemRowProps {
  id: string;
  name: string;
  badge?: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  children: React.ReactNode;
}

function ItemRow({ id, name, badge, expanded, onToggle, onDelete, children }: ItemRowProps) {
  return (
    <div className="rounded-md border border-border bg-background">
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-sm font-medium truncate">
            {name || <span className="text-muted-foreground italic">Unnamed</span>}
          </span>
          {badge && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
              {badge}
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="ml-2 shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Remove"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="border-t border-border/60 px-4 py-4 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

function Field({ id, label, description, children }: {
  id: string; label: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      {children}
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  );
}

function TextField({ id, label, description, value, onChange, placeholder, multiline }: {
  id: string; label: string; description?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  return (
    <Field id={id} label={label} description={description}>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
      )}
    </Field>
  );
}

function NumberField({ id, label, description, value, onChange, min }: {
  id: string; label: string; description?: string; value: number; onChange: (v: number) => void; min?: number;
}) {
  return (
    <Field id={id} label={label} description={description}>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        onChange={e => onChange(Number(e.target.value))}
        className="h-8 text-sm"
      />
    </Field>
  );
}

function SelectField({ id, label, description, value, onChange, options }: {
  id: string; label: string; description?: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field id={id} label={label} description={description}>
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </Field>
  );
}

function CheckboxField({ id, label, description, value, onChange }: {
  id: string; label: string; description?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5"
      />
      <div>
        <Label htmlFor={id} className="text-xs font-medium cursor-pointer">{label}</Label>
        {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

function JsonField({ id, label, description, value, onChange }: {
  id: string; label: string; description?: string;
  value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const t = e.target.value;
    setText(t);
    try {
      const parsed = JSON.parse(t);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setError('Must be a JSON object');
        return;
      }
      setError(null);
      onChange(parsed);
    } catch {
      setError('Invalid JSON');
    }
  };

  return (
    <Field id={id} label={label} description={description}>
      <textarea
        id={id}
        value={text}
        onChange={handleChange}
        rows={5}
        className={cn(
          'w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring',
          error ? 'border-destructive' : 'border-input',
        )}
        placeholder="{}"
      />
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </Field>
  );
}

function PythonCodeEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cmRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || cmRef.current) return;
    const cm = (CodeMirrorLib as any)(containerRef.current, {
      value,
      mode: 'python',
      lineNumbers: true,
      lineWrapping: false,
      tabSize: 4,
      indentWithTabs: true,
      theme: 'default',
    });
    cm.on('change', (instance: any) => { onChangeRef.current(instance.getValue()); });
    cmRef.current = cm;
    return () => {
      if (cmRef.current) { cmRef.current.getWrapperElement().remove(); cmRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cmRef.current && cmRef.current.getValue() !== value) cmRef.current.setValue(value);
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md border border-input [&_.CodeMirror]:min-h-[140px] [&_.CodeMirror]:text-sm [&_.CodeMirror]:font-mono"
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Section page wrapper
// ─────────────────────────────────────────────────────────────

function SectionPage({ title, description, onAdd, addLabel, children }: {
  title: string; description: string; onAdd: () => void; addLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <Button type="button" size="sm" onClick={onAdd} className="shrink-0 gap-1.5">
          <Plus className="h-3.5 w-3.5" /> {addLabel}
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/20 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LLM provider options
// ─────────────────────────────────────────────────────────────

const LLM_PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'huggingface', label: 'HuggingFace (local)' },
  { value: 'huggingface_api', label: 'HuggingFace API' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'ollama', label: 'Ollama (local)' },
];

// ─────────────────────────────────────────────────────────────
// Main panel
// ─────────────────────────────────────────────────────────────

export function AgentComponentsPanel() {
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const project = useAppSelector(selectProject);
  const [activeSection, setActiveSection] = useState<ActiveSection>('llms');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // model.elements is only used for canvas-side checks (AgentState detection).
  const elements: Record<string, any> = React.useMemo(() => {
    if (activeDiagram && isUMLModel(activeDiagram.model)) return activeDiagram.model.elements || {};
    return {};
  }, [activeDiagram]);

  // Agent components are stored outside model.elements so they never touch the canvas.
  const agentComponents: Record<string, any> = React.useMemo(() => {
    return (activeDiagram as any)?.agentComponents || {};
  }, [activeDiagram]);

  const llms      = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentLLM), [agentComponents]);
  const intents   = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentIntent), [agentComponents]);
  const tools     = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentTool), [agentComponents]);
  const skills    = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentSkill), [agentComponents]);
  const workspaces = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentWorkspace), [agentComponents]);
  const rags      = React.useMemo(() => Object.values(agentComponents).filter((e: any) => e.type === ELEMENT_TYPES.AgentRagElement), [agentComponents]);

  const sqlDatabases: SqlDatabaseEntry[] = React.useMemo(() => {
    const form = activeDiagram?.agentConfigForm as any;
    const dbs = form?.db?.sqlDatabases;
    return Array.isArray(dbs) ? dbs : [];
  }, [activeDiagram]);

  const llmNames = React.useMemo(() => llms.map((e: any) => e.name).filter(Boolean) as string[], [llms]);

  const hasReasoningState = React.useMemo(
    () => Object.values(elements).some((el: any) => el.type === 'AgentState' && el.stateType === 'reasoning'),
    [elements],
  );

  const NAV_ITEMS: Array<{ key: ActiveSection; label: string; icon: React.ReactNode; count: number }> = [
    { key: 'llms',       label: 'LLMs',          icon: <Cpu className="h-4 w-4" />,         count: llms.length },
    { key: 'intents',    label: 'Intents',        icon: <MessageSquare className="h-4 w-4" />, count: intents.length },
    { key: 'tools',      label: 'Tools',          icon: <Wrench className="h-4 w-4" />,       count: tools.length },
    { key: 'skills',     label: 'Skills',         icon: <BookOpen className="h-4 w-4" />,     count: skills.length },
    { key: 'workspaces', label: 'Workspaces',     icon: <FolderOpen className="h-4 w-4" />,   count: workspaces.length },
    { key: 'rags',       label: 'RAG Databases',  icon: <Database className="h-4 w-4" />,     count: rags.length },
    { key: 'sql',        label: 'SQL Databases',  icon: <Server className="h-4 w-4" />,       count: sqlDatabases.length },
  ];

  // ── Write helpers ────────────────────────────────────────────

  const writeComponents = useCallback(
    (updater: (els: Record<string, any>) => Record<string, any>) => {
      if (!project) return;
      const latest = ProjectStorageRepository.loadProject(project.id) || project;
      const diagram = getActiveDiagram(latest, 'AgentDiagram');
      if (!diagram) return;
      const current = (diagram as any).agentComponents || {};
      const next = updater({ ...current });
      ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
        ...diagram,
        agentComponents: next,
        lastUpdate: new Date().toISOString(),
      });
    },
    [project],
  );

  const writeSqlDatabases = useCallback(
    (updater: (dbs: SqlDatabaseEntry[]) => SqlDatabaseEntry[]) => {
      if (!project) return;
      const latest = ProjectStorageRepository.loadProject(project.id) || project;
      const diagram = getActiveDiagram(latest, 'AgentDiagram');
      if (!diagram) return;
      const currentForm = (diagram.agentConfigForm as any) || { ...DEFAULT_AGENT_CONFIG_FORM };
      const currentDbs: SqlDatabaseEntry[] = Array.isArray(currentForm?.db?.sqlDatabases) ? currentForm.db.sqlDatabases : [];
      const nextDbs = updater(currentDbs);
      const nextForm = {
        ...DEFAULT_AGENT_CONFIG_FORM,
        ...currentForm,
        db: { ...(currentForm.db || DEFAULT_AGENT_CONFIG_FORM.db), sqlDatabases: nextDbs },
      };
      const customYaml = typeof diagram.agentConfigCustomYaml === 'string' ? diagram.agentConfigCustomYaml : '';
      ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
        ...diagram,
        agentConfigForm: nextForm,
        configYaml: buildConfigYaml(nextForm, customYaml),
        lastUpdate: new Date().toISOString(),
      });
    },
    [project],
  );

  const addElement = useCallback(
    (type: string, extra: Record<string, unknown>, existingOfType: any[]) => {
      const el = type === ELEMENT_TYPES.AgentLLM
        ? makeElementBase(type, extra)
        : makeVisibleElementBase(type, existingOfType.length, extra);
      writeComponents(els => ({ ...els, [el.id]: el }));
      setExpandedId(el.id);
    },
    [writeComponents],
  );

  const removeElement = useCallback(
    (id: string) => {
      writeComponents(els => { const next = { ...els }; delete next[id]; return next; });
      if (expandedId === id) setExpandedId(null);
    },
    [writeComponents, expandedId],
  );

  const updateElement = useCallback(
    (id: string, updates: Record<string, unknown>) => {
      writeComponents(els => ({ ...els, [id]: { ...els[id], ...updates } }));
    },
    [writeComponents],
  );

  const removeIntent = useCallback(
    (intentId: string) => {
      writeComponents(els => {
        const next = { ...els };
        Object.keys(next).forEach(key => { if (next[key].owner === intentId) delete next[key]; });
        delete next[intentId];
        return next;
      });
      if (expandedId === intentId) setExpandedId(null);
    },
    [writeComponents, expandedId],
  );

  const addTrainingSentence = useCallback(
    (intentId: string) => {
      const bodyEl = {
        id: generateUUID(),
        type: ELEMENT_TYPES.AgentIntentBody,
        name: '',
        owner: intentId,
        bounds: { x: 0, y: 0, width: 160, height: 30 },
        ownedElements: [],
      };
      writeComponents(els => {
        const intent = els[intentId];
        if (!intent) return els;
        return {
          ...els,
          [bodyEl.id]: bodyEl,
          [intentId]: {
            ...intent,
            ownedElements: Array.isArray(intent.ownedElements) ? [...intent.ownedElements, bodyEl.id] : [bodyEl.id],
          },
        };
      });
    },
    [writeComponents],
  );

  const removeTrainingSentence = useCallback(
    (intentId: string, bodyId: string) => {
      writeComponents(els => {
        const intent = els[intentId];
        if (!intent) return els;
        const next = { ...els };
        delete next[bodyId];
        next[intentId] = {
          ...intent,
          ownedElements: (intent.ownedElements || []).filter((id: string) => id !== bodyId),
        };
        return next;
      });
    },
    [writeComponents],
  );

  const updateTrainingSentence = useCallback(
    (bodyId: string, name: string) => {
      writeComponents(els => ({ ...els, [bodyId]: { ...els[bodyId], name } }));
    },
    [writeComponents],
  );

  const sqlItemId = (index: number) => `sql-item-${index}`;

  const addSqlDatabase = useCallback(() => {
    const newIndex = sqlDatabases.length;
    writeSqlDatabases(dbs => [...dbs, { name: '', dialect: 'postgresql', database: '', host: 'localhost', port: '5432', username: '', password: '' }]);
    setExpandedId(sqlItemId(newIndex));
  }, [writeSqlDatabases, sqlDatabases.length]);

  const removeSqlDatabase = useCallback(
    (index: number) => writeSqlDatabases(dbs => dbs.filter((_, i) => i !== index)),
    [writeSqlDatabases],
  );

  const updateSqlDatabase = useCallback(
    (index: number, updates: Partial<SqlDatabaseEntry>) =>
      writeSqlDatabases(dbs => dbs.map((db, i) => (i === index ? { ...db, ...updates } : db))),
    [writeSqlDatabases],
  );

  const toggle = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  // ── Add handlers ─────────────────────────────────────────────

  const handleAddLLM = () =>
    addElement(ELEMENT_TYPES.AgentLLM, { provider: 'openai', parameters: {}, num_previous_messages: 1, global_context: '' }, llms);

  const handleAddIntent = () => {
    const el = makeVisibleElementBase(ELEMENT_TYPES.AgentIntent, intents.length, { intent_description: '', ownedElements: [] });
    writeComponents(els => ({ ...els, [el.id]: el }));
    setExpandedId(el.id);
  };

  const handleAddTool = () =>
    addElement(ELEMENT_TYPES.AgentTool, { description: '', code: 'def tool_name(session):\n    pass\n' }, tools);

  const handleAddSkill = () =>
    addElement(ELEMENT_TYPES.AgentSkill, { description: '', content: '' }, skills);

  const handleAddWorkspace = () =>
    addElement(ELEMENT_TYPES.AgentWorkspace, { path: '', description: '', writable: true, max_read_bytes: 200000 }, workspaces);

  const handleAddRag = () =>
    addElement(ELEMENT_TYPES.AgentRagElement, { llm_name: '', llm_prompt: '', k: 4, num_previous_messages: 0, embedding_provider: 'openai', embedding_base_url: '', embedding_model: '' }, rags);

  // ── Render ───────────────────────────────────────────────────

  if (!activeDiagram) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No active agent diagram.
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left sidebar ──────────────────────────────────────── */}
      <nav className="w-52 shrink-0 border-r border-border overflow-y-auto py-3">
        <p className="px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Components
        </p>
        {NAV_ITEMS.map(item => (
          <button
            key={item.key}
            type="button"
            onClick={() => { setActiveSection(item.key); setExpandedId(null); }}
            className={cn(
              'flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-colors',
              activeSection === item.key
                ? 'bg-accent text-accent-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <span className="shrink-0">{item.icon}</span>
            <span className="flex-1 text-left">{item.label}</span>
            {item.count > 0 && (
              <Badge
                variant={activeSection === item.key ? 'default' : 'secondary'}
                className="text-[10px] h-4 px-1.5"
              >
                {item.count}
              </Badge>
            )}
          </button>
        ))}
      </nav>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-8 py-6 max-w-2xl">

          {/* ── LLMs ──────────────────────────────────────────── */}
          {activeSection === 'llms' && (
            <SectionPage
              title="LLMs"
              description="Language models available to the agent. LLMs are referenced by name from states and RAG databases."
              onAdd={handleAddLLM}
              addLabel="Add LLM"
            >
              {llms.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No LLMs defined yet.</p>
              )}
              {llms.map((el: any) => (
                <ItemRow
                  key={el.id}
                  id={el.id}
                  name={el.name}
                  badge={el.provider}
                  expanded={expandedId === el.id}
                  onToggle={() => toggle(el.id)}
                  onDelete={() => removeElement(el.id)}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <TextField
                      id={`llm-name-${el.id}`}
                      label="Model Name"
                      value={el.name || ''}
                      onChange={v => updateElement(el.id, { name: v })}
                      placeholder="e.g. main_llm"
                      description="Identifier used to reference this LLM."
                    />
                    <SelectField
                      id={`llm-provider-${el.id}`}
                      label="Provider"
                      value={el.provider || 'openai'}
                      onChange={v => updateElement(el.id, { provider: v })}
                      options={LLM_PROVIDERS}
                    />
                  </div>
                  <NumberField
                    id={`llm-npm-${el.id}`}
                    label="Num previous messages"
                    value={el.num_previous_messages ?? 1}
                    onChange={v => updateElement(el.id, { num_previous_messages: Math.max(0, v) })}
                    min={0}
                  />
                  <JsonField
                    id={`llm-params-${el.id}`}
                    label="Parameters"
                    description='Provider-specific parameters as a JSON object (e.g. {"model": "gpt-4o-mini"} or {"base_url": "http://localhost:11434", "model": "llama3"} for Ollama).'
                    value={(el.parameters || {}) as Record<string, unknown>}
                    onChange={v => updateElement(el.id, { parameters: v })}
                  />
                  <TextField
                    id={`llm-ctx-${el.id}`}
                    label="Global context"
                    value={el.global_context || ''}
                    onChange={v => updateElement(el.id, { global_context: v })}
                    placeholder="Optional system-level instructions for this LLM"
                    multiline
                  />
                </ItemRow>
              ))}
            </SectionPage>
          )}

          {/* ── Intents ───────────────────────────────────────── */}
          {activeSection === 'intents' && (
            <SectionPage
              title="Intents"
              description="User intents recognized by the agent. Each intent can have training sentences to improve recognition."
              onAdd={handleAddIntent}
              addLabel="Add Intent"
            >
              {intents.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No intents defined yet.</p>
              )}
              {intents.map((el: any) => {
                const bodies = (el.ownedElements || [])
                  .map((id: string) => agentComponents[id])
                  .filter((b: any) => b && b.type === ELEMENT_TYPES.AgentIntentBody);
                const sentenceCount = bodies.length;
                return (
                  <ItemRow
                    key={el.id}
                    id={el.id}
                    name={el.name}
                    badge={sentenceCount > 0 ? `${sentenceCount} sentence${sentenceCount > 1 ? 's' : ''}` : undefined}
                    expanded={expandedId === el.id}
                    onToggle={() => toggle(el.id)}
                    onDelete={() => removeIntent(el.id)}
                  >
                    <TextField
                      id={`intent-name-${el.id}`}
                      label="Intent name"
                      value={el.name || ''}
                      onChange={v => updateElement(el.id, { name: v })}
                      placeholder="e.g. greet_user"
                    />
                    <TextField
                      id={`intent-desc-${el.id}`}
                      label="Description (optional)"
                      value={el.intent_description || ''}
                      onChange={v => updateElement(el.id, { intent_description: v })}
                      placeholder="Brief description of what this intent captures"
                      multiline
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-medium">Training sentences</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs px-2"
                          onClick={() => addTrainingSentence(el.id)}
                        >
                          <Plus className="h-3 w-3" /> Add sentence
                        </Button>
                      </div>
                      {bodies.length === 0 && (
                        <p className="text-[11px] text-muted-foreground italic">
                          No training sentences yet. Add some to improve intent recognition.
                        </p>
                      )}
                      {bodies.map((body: any) => (
                        <div key={body.id} className="flex items-center gap-2">
                          <Input
                            value={body.name || ''}
                            onChange={e => updateTrainingSentence(body.id, e.target.value)}
                            placeholder="e.g. Hello there"
                            className="h-7 text-sm flex-1"
                          />
                          <button
                            type="button"
                            onClick={() => removeTrainingSentence(el.id, body.id)}
                            className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </ItemRow>
                );
              })}
            </SectionPage>
          )}

          {/* ── Tools ─────────────────────────────────────────── */}
          {activeSection === 'tools' && (
            <SectionPage
              title="Tools"
              description="Python functions callable by reasoning states during agent execution."
              onAdd={handleAddTool}
              addLabel="Add Tool"
            >
              {!hasReasoningState && (
                <WarningBanner message="Tools can only be used by a reasoning state. Add a reasoning state to the agent diagram to use tools." />
              )}
              {tools.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No tools defined yet.</p>
              )}
              {tools.map((el: any) => (
                <ItemRow
                  key={el.id}
                  id={el.id}
                  name={el.name}
                  expanded={expandedId === el.id}
                  onToggle={() => toggle(el.id)}
                  onDelete={() => removeElement(el.id)}
                >
                  <TextField
                    id={`tool-name-${el.id}`}
                    label="Tool name"
                    value={el.name || ''}
                    onChange={v => updateElement(el.id, { name: v })}
                    placeholder="e.g. search_web"
                  />
                  <TextField
                    id={`tool-desc-${el.id}`}
                    label="Description"
                    value={el.description || ''}
                    onChange={v => updateElement(el.id, { description: v })}
                    placeholder="Short description shown to the LLM"
                    multiline
                  />
                  <Field id={`tool-code-${el.id}`} label="Python code" description="Use `session` parameter for agent session access.">
                    <PythonCodeEditor
                      value={el.code || 'def tool_name(session):\n    pass\n'}
                      onChange={v => updateElement(el.id, { code: v })}
                    />
                  </Field>
                </ItemRow>
              ))}
            </SectionPage>
          )}

          {/* ── Skills ────────────────────────────────────────── */}
          {activeSection === 'skills' && (
            <SectionPage
              title="Skills"
              description="Markdown knowledge documents provided to reasoning states."
              onAdd={handleAddSkill}
              addLabel="Add Skill"
            >
              {!hasReasoningState && (
                <WarningBanner message="Skills can only be used by a reasoning state. Add a reasoning state to the agent diagram to use skills." />
              )}
              {skills.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No skills defined yet.</p>
              )}
              {skills.map((el: any) => (
                <ItemRow
                  key={el.id}
                  id={el.id}
                  name={el.name}
                  expanded={expandedId === el.id}
                  onToggle={() => toggle(el.id)}
                  onDelete={() => removeElement(el.id)}
                >
                  <TextField
                    id={`skill-name-${el.id}`}
                    label="Skill name"
                    value={el.name || ''}
                    onChange={v => updateElement(el.id, { name: v })}
                    placeholder="e.g. product_knowledge"
                  />
                  <TextField
                    id={`skill-desc-${el.id}`}
                    label="Description"
                    value={el.description || ''}
                    onChange={v => updateElement(el.id, { description: v })}
                    placeholder="Optional short description"
                    multiline
                  />
                  <TextField
                    id={`skill-content-${el.id}`}
                    label="Markdown content"
                    value={el.content || ''}
                    onChange={v => updateElement(el.id, { content: v })}
                    placeholder={'# Skill\n\nInstructions in markdown...'}
                    multiline
                  />
                </ItemRow>
              ))}
            </SectionPage>
          )}

          {/* ── Workspaces ────────────────────────────────────── */}
          {activeSection === 'workspaces' && (
            <SectionPage
              title="Workspaces"
              description="Filesystem directories the agent can read or write during reasoning."
              onAdd={handleAddWorkspace}
              addLabel="Add Workspace"
            >
              {!hasReasoningState && (
                <WarningBanner message="Workspaces can only be used by a reasoning state. Add a reasoning state to the agent diagram to use workspaces." />
              )}
              {workspaces.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No workspaces defined yet.</p>
              )}
              {workspaces.map((el: any) => (
                <ItemRow
                  key={el.id}
                  id={el.id}
                  name={el.name}
                  badge={el.writable ? 'writable' : 'read-only'}
                  expanded={expandedId === el.id}
                  onToggle={() => toggle(el.id)}
                  onDelete={() => removeElement(el.id)}
                >
                  <TextField
                    id={`ws-name-${el.id}`}
                    label="Workspace name"
                    value={el.name || ''}
                    onChange={v => updateElement(el.id, { name: v })}
                    placeholder="e.g. project_files"
                  />
                  <TextField
                    id={`ws-path-${el.id}`}
                    label="Filesystem path"
                    value={el.path || ''}
                    onChange={v => updateElement(el.id, { path: v })}
                    placeholder="/path/to/workspace"
                    description="Absolute path to the directory on the host system."
                  />
                  <TextField
                    id={`ws-desc-${el.id}`}
                    label="Description"
                    value={el.description || ''}
                    onChange={v => updateElement(el.id, { description: v })}
                    placeholder="Optional description"
                    multiline
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <CheckboxField
                      id={`ws-writable-${el.id}`}
                      label="Writable"
                      value={el.writable ?? true}
                      onChange={v => updateElement(el.id, { writable: v })}
                      description="Allow the agent to create or modify files."
                    />
                    <NumberField
                      id={`ws-maxbytes-${el.id}`}
                      label="Max read bytes"
                      value={el.max_read_bytes ?? 200000}
                      onChange={v => updateElement(el.id, { max_read_bytes: Math.max(0, v) })}
                      min={0}
                    />
                  </div>
                </ItemRow>
              ))}
            </SectionPage>
          )}

          {/* ── RAG Databases ─────────────────────────────────── */}
          {activeSection === 'rags' && (
            <SectionPage
              title="RAG Databases"
              description="Vector databases for retrieval-augmented generation."
              onAdd={handleAddRag}
              addLabel="Add RAG Database"
            >
              {rags.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No RAG databases defined yet.</p>
              )}
              {rags.map((el: any) => (
                <ItemRow
                  key={el.id}
                  id={el.id}
                  name={el.name}
                  badge={el.embedding_provider}
                  expanded={expandedId === el.id}
                  onToggle={() => toggle(el.id)}
                  onDelete={() => removeElement(el.id)}
                >
                  <div className="grid grid-cols-2 gap-4">
                    <TextField
                      id={`rag-name-${el.id}`}
                      label="Name"
                      value={el.name || ''}
                      onChange={v => updateElement(el.id, { name: v })}
                      placeholder="e.g. faq_db"
                    />
                    <SelectField
                      id={`rag-llm-${el.id}`}
                      label="LLM"
                      value={el.llm_name || ''}
                      onChange={v => updateElement(el.id, { llm_name: v })}
                      options={[
                        { value: '', label: '(use default)' },
                        ...llmNames.map(n => ({ value: n, label: n })),
                      ]}
                      description="LLM used to answer retrieved content."
                    />
                  </div>
                  <TextField
                    id={`rag-prompt-${el.id}`}
                    label="LLM prompt prefix"
                    value={el.llm_prompt || ''}
                    onChange={v => updateElement(el.id, { llm_prompt: v })}
                    placeholder="Optional prompt prefix for the LLM"
                    multiline
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <NumberField
                      id={`rag-k-${el.id}`}
                      label="K (retrieved chunks)"
                      value={el.k ?? 4}
                      onChange={v => updateElement(el.id, { k: Math.max(1, v) })}
                      min={1}
                      description="Document chunks retrieved per query."
                    />
                    <NumberField
                      id={`rag-npm-${el.id}`}
                      label="Num previous messages"
                      value={el.num_previous_messages ?? 0}
                      onChange={v => updateElement(el.id, { num_previous_messages: Math.max(0, v) })}
                      min={0}
                    />
                  </div>
                  <SelectField
                    id={`rag-emb-${el.id}`}
                    label="Embedding provider"
                    value={el.embedding_provider || 'openai'}
                    onChange={v => {
                      const updates: Record<string, unknown> = { embedding_provider: v as RagEmbeddingProvider };
                      if (v === 'ollama' && !el.embedding_base_url) updates.embedding_base_url = 'http://localhost:11434';
                      updateElement(el.id, updates);
                    }}
                    options={[
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'ollama', label: 'Ollama (local)' },
                    ]}
                  />
                  {el.embedding_provider === 'ollama' && (
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        id={`rag-emb-url-${el.id}`}
                        label="Embedding base URL"
                        value={el.embedding_base_url || 'http://localhost:11434'}
                        onChange={v => updateElement(el.id, { embedding_base_url: v })}
                        placeholder="http://localhost:11434"
                      />
                      <TextField
                        id={`rag-emb-model-${el.id}`}
                        label="Embedding model"
                        value={el.embedding_model || ''}
                        onChange={v => updateElement(el.id, { embedding_model: v })}
                        placeholder="e.g. nomic-embed-text"
                      />
                    </div>
                  )}
                </ItemRow>
              ))}
            </SectionPage>
          )}

          {/* ── SQL Databases ─────────────────────────────────── */}
          {activeSection === 'sql' && (
            <SectionPage
              title="SQL Databases"
              description="SQL database connections written to db.sql in config.yaml."
              onAdd={addSqlDatabase}
              addLabel="Add SQL Database"
            >
              {sqlDatabases.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No SQL databases defined yet.</p>
              )}
              {sqlDatabases.map((db, index) => {
                const itemId = sqlItemId(index);
                return (
                  <ItemRow
                    key={itemId}
                    id={itemId}
                    name={db.name}
                    badge={db.dialect || undefined}
                    expanded={expandedId === itemId}
                    onToggle={() => toggle(itemId)}
                    onDelete={() => removeSqlDatabase(index)}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        id={`sql-name-${index}`}
                        label="Name"
                        value={db.name}
                        onChange={v => updateSqlDatabase(index, { name: v })}
                        placeholder="e.g. my_database"
                        description="Used as the key in config.yaml."
                      />
                      <SelectField
                        id={`sql-dialect-${index}`}
                        label="Dialect"
                        value={db.dialect}
                        onChange={v => updateSqlDatabase(index, { dialect: v })}
                        options={[
                          { value: 'postgresql', label: 'PostgreSQL' },
                          { value: 'sqlite', label: 'SQLite' },
                          { value: 'mysql', label: 'MySQL' },
                          { value: 'mariadb', label: 'MariaDB' },
                          { value: 'mssql', label: 'Microsoft SQL Server' },
                          { value: 'oracle', label: 'Oracle' },
                        ]}
                      />
                    </div>
                    <TextField
                      id={`sql-database-${index}`}
                      label={db.dialect === 'sqlite' ? 'Database file path' : 'Database name'}
                      value={db.database}
                      onChange={v => updateSqlDatabase(index, { database: v })}
                      placeholder={db.dialect === 'sqlite' ? '/path/to/local.db' : 'YOUR-DB-NAME'}
                    />
                    {db.dialect !== 'sqlite' && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <TextField
                            id={`sql-host-${index}`}
                            label="Host"
                            value={db.host}
                            onChange={v => updateSqlDatabase(index, { host: v })}
                            placeholder="localhost"
                          />
                          <TextField
                            id={`sql-port-${index}`}
                            label="Port"
                            value={db.port}
                            onChange={v => updateSqlDatabase(index, { port: v })}
                            placeholder="5432"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <TextField
                            id={`sql-user-${index}`}
                            label="Username"
                            value={db.username}
                            onChange={v => updateSqlDatabase(index, { username: v })}
                            placeholder="YOUR-DB-USERNAME"
                          />
                          <TextField
                            id={`sql-pass-${index}`}
                            label="Password"
                            value={db.password}
                            onChange={v => updateSqlDatabase(index, { password: v })}
                            placeholder="YOUR-DB-PASSWORD"
                          />
                        </div>
                      </>
                    )}
                  </ItemRow>
                );
              })}
            </SectionPage>
          )}

        </div>
      </div>
    </div>
  );
}
