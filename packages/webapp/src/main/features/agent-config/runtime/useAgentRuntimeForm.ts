import { useCallback, useEffect, useMemo, useState } from 'react';
// @ts-ignore
import * as jsyaml from 'js-yaml';
import { getActiveDiagram } from '../../../shared/types/project';
import type { BesserProject } from '../../../shared/types/project';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import {
  AgentConfigFormData,
  DEFAULT_AGENT_CONFIG_FORM,
  buildConfigYaml,
  agentConfigFormToYaml,
} from '../AgentConfigYamlEditor';

type Platforms = AgentConfigFormData['platforms'];
type Db = AgentConfigFormData['db'];

/**
 * The agent config-file form of the active AgentDiagram (mirrors AgentConfigYamlEditor):
 * form + custom YAML state, persisted to the diagram on every change.
 */
export function useAgentRuntimeForm(currentProject: BesserProject | null) {
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

  const setPlatform = <K extends keyof Platforms>(key: K, v: Partial<Platforms[K]>) =>
    updateForm(f => ({ ...f, platforms: { ...f.platforms, [key]: { ...f.platforms[key], ...v } } }));
  const setDb = <K extends keyof Db>(key: K, v: Partial<Db[K]>) =>
    updateForm(f => ({ ...f, db: { ...f.db, [key]: { ...(f.db[key] as object), ...v } } }));

  return {
    form,
    customYaml,
    customYamlError,
    generatedYaml,
    updateCustomYaml,
    setAgent: (v: Partial<AgentConfigFormData['agent']>) => updateForm(f => ({ ...f, agent: { ...f.agent, ...v } })),
    setNlp: (v: Partial<AgentConfigFormData['nlp']>) => updateForm(f => ({ ...f, nlp: { ...f.nlp, ...v } })),
    setWs: (v: Partial<Platforms['websocket']>) => setPlatform('websocket', v),
    setTelegram: (v: Partial<Platforms['telegram']>) => setPlatform('telegram', v),
    setGithub: (v: Partial<Platforms['github']>) => setPlatform('github', v),
    setGitlab: (v: Partial<Platforms['gitlab']>) => setPlatform('gitlab', v),
    setA2a: (v: Partial<Platforms['a2a']>) => setPlatform('a2a', v),
    setMonitoring: (v: Partial<Db['monitoring']>) => setDb('monitoring', v),
    setStreamlitDb: (v: Partial<Db['streamlit_db']>) => setDb('streamlit_db', v),
  };
}

export type AgentRuntimeForm = ReturnType<typeof useAgentRuntimeForm>;
