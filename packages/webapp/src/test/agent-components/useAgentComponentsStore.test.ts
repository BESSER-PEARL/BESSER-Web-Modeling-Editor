import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AgentComponentType, UMLModel } from '@besser/wme';
import { ProjectStorageRepository } from '../../main/shared/services/storage/ProjectStorageRepository';
import { BesserProject, createDefaultProject, getActiveDiagram } from '../../main/shared/types/project';

// The hook reads the project / active diagram from Redux. Serve both straight from
// storage so every write made by the hook is visible on the next render.
let projectId = '';
const loadProject = () => ProjectStorageRepository.loadProject(projectId);

vi.mock('../../main/app/store/workspaceSlice', () => ({
  selectProject: () => loadProject(),
  selectActiveDiagram: () => {
    const project = loadProject();
    return project ? getActiveDiagram(project, 'AgentDiagram') : undefined;
  },
}));
vi.mock('../../main/app/store/hooks', () => ({
  useAppSelector: (selector: () => unknown) => selector(),
}));

import { useAgentComponentsStore } from '../../main/features/agent-components/hooks/useAgentComponentsStore';

const storedAgentDiagram = () => getActiveDiagram(loadProject() as BesserProject, 'AgentDiagram')!;

describe('useAgentComponentsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    const project = createDefaultProject('P', '', 'me');
    project.currentDiagramType = 'AgentDiagram';
    ProjectStorageRepository.saveProject(project);
    projectId = project.id;
  });

  it('writes new components to model.components without bounds', () => {
    const { result, rerender } = renderHook(() => useAgentComponentsStore());
    let id = '';
    act(() => { id = result.current.addComponent(AgentComponentType.AgentTool); });
    rerender();

    const model = storedAgentDiagram().model as UMLModel;
    expect(model.components?.[id]).toMatchObject({ type: 'AgentTool', name: '' });
    expect(model.components?.[id].bounds).toBeUndefined();
    expect(result.current.tools.map((tool) => tool.id)).toEqual([id]);
  });

  it('makes the first LLM added the default once it is named, and follows its renames', () => {
    const { result, rerender } = renderHook(() => useAgentComponentsStore());
    let first = '';
    let second = '';
    act(() => { first = result.current.addComponent(AgentComponentType.AgentLLM); });
    rerender();
    act(() => { second = result.current.addComponent(AgentComponentType.AgentLLM); });
    rerender();
    expect(result.current.defaultLlmName).toBe('');

    act(() => result.current.updateComponent(second, { name: 'mistral' }));
    rerender();
    expect(result.current.defaultLlmName).toBe('');

    act(() => result.current.updateComponent(first, { name: 'g' }));
    rerender();
    expect(result.current.defaultLlmName).toBe('g');
    act(() => result.current.updateComponent(first, { name: 'gpt-4o' }));
    rerender();
    expect(result.current.defaultLlmName).toBe('gpt-4o');
    expect(storedAgentDiagram().config?.default_llm_name).toBe('gpt-4o');

    act(() => result.current.removeComponent(first));
    rerender();
    expect(result.current.defaultLlmName).toBe('');
    expect(result.current.llms.map((l) => l.id)).toEqual([second]);
  });

  it('migrates legacy diagram-level agentComponents into model.components on the first write', () => {
    const project = loadProject() as BesserProject;
    const legacyLlm = { id: 'legacy', name: 'old', type: 'AgentLLM', owner: null, bounds: { x: 0, y: 0, width: 0, height: 0 } };
    project.diagrams.AgentDiagram[0] = { ...project.diagrams.AgentDiagram[0], agentComponents: { legacy: legacyLlm } } as never;
    ProjectStorageRepository.saveProject(project);

    const { result, rerender } = renderHook(() => useAgentComponentsStore());
    expect(result.current.llms.map((l) => l.id)).toEqual(['legacy']);

    act(() => { result.current.addComponent(AgentComponentType.AgentSkill); });
    rerender();
    const components = (storedAgentDiagram().model as UMLModel).components ?? {};
    expect(components.legacy).toMatchObject({ name: 'old', type: 'AgentLLM' });
    expect(components.legacy.bounds).toBeUndefined();
    expect(Object.values(components).map((c) => c.type).sort()).toEqual(['AgentLLM', 'AgentSkill']);
  });
});
