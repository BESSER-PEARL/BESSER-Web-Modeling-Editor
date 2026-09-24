import React, { useCallback } from 'react';
import { AgentComponentType, UMLModelComponent } from '@besser/wme';

import { useAppSelector } from '../../../app/store/hooks';
import { selectActiveDiagram, selectProject } from '../../../app/store/workspaceSlice';
import { ProjectStorageRepository } from '../../../shared/services/storage/ProjectStorageRepository';
import { getActiveDiagram, isUMLModel } from '../../../shared/types/project';
import { getAgentComponents, normalizeStoredAgentModel } from '../../../shared/utils/projectExportUtils';
import type { SqlDatabaseEntry } from '../../agent-config/AgentConfigYamlEditor';
import { DEFAULT_AGENT_CONFIG_FORM, buildConfigYaml } from '../../agent-config/AgentConfigYamlEditor';
import {
  AgentComponents,
  CreatableComponentType,
  addIntentBody,
  componentsOfType,
  createAgentComponent,
  defaultLlmAfterRename,
  removeComponent,
  removeIntentBody,
  stripBounds,
} from '../agentComponentModel';

const EMPTY_SQL_DATABASE: SqlDatabaseEntry = {
  name: '',
  dialect: 'postgresql',
  database: '',
  host: 'localhost',
  port: '5432',
  username: '',
  password: '',
};

/**
 * Read/write access to the active AgentDiagram's components, SQL databases and default LLM.
 *
 * Reads come from Redux (the stored diagram, normalized); writes go to project storage, whose
 * change notification flows back into Redux — and from there into the diagram bridge, which
 * ApollonEditorComponent keeps in sync.
 */
export function useAgentComponentsStore() {
  const activeDiagram = useAppSelector(selectActiveDiagram);
  const project = useAppSelector(selectProject);

  const components = React.useMemo(() => getAgentComponents(activeDiagram), [activeDiagram]);

  const byType = React.useMemo(
    () => ({
      llms: componentsOfType(components, AgentComponentType.AgentLLM),
      intents: componentsOfType(components, AgentComponentType.AgentIntent),
      tools: componentsOfType(components, AgentComponentType.AgentTool),
      skills: componentsOfType(components, AgentComponentType.AgentSkill),
      workspaces: componentsOfType(components, AgentComponentType.AgentWorkspace),
      rags: componentsOfType(components, AgentComponentType.AgentRagElement),
      guis: componentsOfType(components, AgentComponentType.AgentGUI),
    }),
    [components],
  );

  const sqlDatabases: SqlDatabaseEntry[] = React.useMemo(() => {
    const dbs = (activeDiagram?.agentConfigForm as { db?: { sqlDatabases?: unknown } } | undefined)?.db?.sqlDatabases;
    return Array.isArray(dbs) ? (dbs as SqlDatabaseEntry[]) : [];
  }, [activeDiagram]);

  const llmNames = React.useMemo(
    () => byType.llms.map((llm) => llm.name).filter(Boolean) as string[],
    [byType.llms],
  );

  const defaultLlmName = String(activeDiagram?.config?.default_llm_name || '');

  const hasReasoningState = React.useMemo(() => {
    const elements = activeDiagram && isUMLModel(activeDiagram.model) ? activeDiagram.model.elements || {} : {};
    return Object.values(elements).some(
      (element) => element.type === 'AgentState' && (element as { stateType?: string }).stateType === 'reasoning',
    );
  }, [activeDiagram]);

  // ── Write helpers (always against the latest stored diagram) ────────────

  const loadLatestDiagram = useCallback(() => {
    if (!project) return null;
    const latest = ProjectStorageRepository.loadProject(project.id) || project;
    return getActiveDiagram(latest, 'AgentDiagram') ?? null;
  }, [project]);

  const writeComponents = useCallback(
    (updater: (current: AgentComponents) => AgentComponents) => {
      const diagram = loadLatestDiagram();
      if (!project || !diagram) return;
      const baseModel = normalizeStoredAgentModel(diagram);
      const next = stripBounds(updater({ ...getAgentComponents(diagram) }));
      ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
        ...diagram,
        model: baseModel ? { ...baseModel, components: next } : diagram.model,
        lastUpdate: new Date().toISOString(),
      });
    },
    [project, loadLatestDiagram],
  );

  const writeConfig = useCallback(
    (updater: (config: Record<string, unknown>) => Record<string, unknown>) => {
      const diagram = loadLatestDiagram();
      if (!project || !diagram) return;
      ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
        ...diagram,
        config: updater({ ...(diagram.config || {}) }),
        lastUpdate: new Date().toISOString(),
      });
    },
    [project, loadLatestDiagram],
  );

  const writeSqlDatabases = useCallback(
    (updater: (dbs: SqlDatabaseEntry[]) => SqlDatabaseEntry[]) => {
      const diagram = loadLatestDiagram();
      if (!project || !diagram) return;
      const currentForm = (diagram.agentConfigForm as typeof DEFAULT_AGENT_CONFIG_FORM | undefined) || {
        ...DEFAULT_AGENT_CONFIG_FORM,
      };
      const currentDbs: SqlDatabaseEntry[] = Array.isArray(currentForm?.db?.sqlDatabases) ? currentForm.db.sqlDatabases : [];
      const nextForm = {
        ...DEFAULT_AGENT_CONFIG_FORM,
        ...currentForm,
        db: { ...(currentForm.db || DEFAULT_AGENT_CONFIG_FORM.db), sqlDatabases: updater(currentDbs) },
      };
      const customYaml = typeof diagram.agentConfigCustomYaml === 'string' ? diagram.agentConfigCustomYaml : '';
      ProjectStorageRepository.updateDiagram(project.id, 'AgentDiagram', {
        ...diagram,
        agentConfigForm: nextForm as unknown as Record<string, unknown>,
        configYaml: buildConfigYaml(nextForm, customYaml),
        lastUpdate: new Date().toISOString(),
      });
    },
    [project, loadLatestDiagram],
  );

  // ── Component actions ─────────────────────────────────────────────────

  /** Add a new component of `type`; returns its id. */
  const addComponent = useCallback(
    (type: CreatableComponentType): string => {
      const component = createAgentComponent(type);
      writeComponents((current) => ({ ...current, [component.id]: component }));
      return component.id;
    },
    [writeComponents],
  );

  const updateComponent = useCallback(
    (id: string, updates: Partial<UMLModelComponent>) => {
      const target = components[id];
      if (target && (target.type as string) === AgentComponentType.AgentLLM && typeof updates.name === 'string') {
        const nextDefault = defaultLlmAfterRename(defaultLlmName, byType.llms, id, updates.name);
        if (nextDefault !== defaultLlmName) {
          writeConfig((config) => ({ ...config, default_llm_name: nextDefault }));
        }
      }
      writeComponents((current) => ({ ...current, [id]: { ...current[id], ...updates } }));
    },
    [components, byType.llms, defaultLlmName, writeComponents, writeConfig],
  );

  /** Remove a component (and what it owns). Removing the default LLM clears the default. */
  const removeAgentComponent = useCallback(
    (id: string) => {
      const target = components[id];
      writeComponents((current) => removeComponent(current, id));
      if (target && (target.type as string) === AgentComponentType.AgentLLM && target.name && target.name === defaultLlmName) {
        writeConfig((config) => ({ ...config, default_llm_name: '' }));
      }
    },
    [components, defaultLlmName, writeComponents, writeConfig],
  );

  const setDefaultLlm = useCallback(
    (llmName: string) => writeConfig((config) => ({ ...config, default_llm_name: llmName })),
    [writeConfig],
  );

  const addTrainingSentence = useCallback(
    (intentId: string) => writeComponents((current) => addIntentBody(current, intentId)),
    [writeComponents],
  );

  const removeTrainingSentence = useCallback(
    (intentId: string, bodyId: string) => writeComponents((current) => removeIntentBody(current, intentId, bodyId)),
    [writeComponents],
  );

  const updateTrainingSentence = useCallback(
    (bodyId: string, name: string) => writeComponents((current) => ({ ...current, [bodyId]: { ...current[bodyId], name } })),
    [writeComponents],
  );

  // ── SQL databases (live in the agent config form, not in components) ──

  /** Append an empty SQL database; returns its index. */
  const addSqlDatabase = useCallback((): number => {
    writeSqlDatabases((dbs) => [...dbs, { ...EMPTY_SQL_DATABASE }]);
    return sqlDatabases.length;
  }, [writeSqlDatabases, sqlDatabases.length]);

  const removeSqlDatabase = useCallback(
    (index: number) => writeSqlDatabases((dbs) => dbs.filter((_, i) => i !== index)),
    [writeSqlDatabases],
  );

  const updateSqlDatabase = useCallback(
    (index: number, updates: Partial<SqlDatabaseEntry>) =>
      writeSqlDatabases((dbs) => dbs.map((db, i) => (i === index ? { ...db, ...updates } : db))),
    [writeSqlDatabases],
  );

  return {
    activeDiagram,
    components,
    ...byType,
    sqlDatabases,
    llmNames,
    defaultLlmName,
    hasReasoningState,
    addComponent,
    updateComponent,
    removeComponent: removeAgentComponent,
    setDefaultLlm,
    addTrainingSentence,
    removeTrainingSentence,
    updateTrainingSentence,
    addSqlDatabase,
    removeSqlDatabase,
    updateSqlDatabase,
  };
}

export type AgentComponentsStore = ReturnType<typeof useAgentComponentsStore>;
