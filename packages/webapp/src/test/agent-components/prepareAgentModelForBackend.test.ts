import { describe, it, expect, beforeEach } from 'vitest';
import { UMLDiagramType, UMLModel } from '@besser/wme';
import {
  buildProjectPayloadForBackend,
  getAgentComponents,
  prepareAgentModelForBackend,
} from '../../main/shared/utils/projectExportUtils';
import { ProjectStorageRepository } from '../../main/shared/services/storage/ProjectStorageRepository';
import { createDefaultProject, createEmptyDiagram, ProjectDiagram } from '../../main/shared/types/project';

const STATE = {
  id: 'state-1',
  type: 'AgentState',
  position: { x: 0, y: 0 },
  width: 200,
  height: 70,
  measured: { width: 200, height: 70 },
  data: { name: 'Idle', bodies: [], fallbackBodies: [] },
} as unknown as UMLModel['nodes'][number];

const LLM = { id: 'llm-1', name: 'gpt-4o', type: 'AgentLLM', owner: null, provider: 'openai' };

function agentModel(extra: Partial<UMLModel> = {}): UMLModel {
  const model = createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram).model as UMLModel;
  return { ...model, nodes: [STATE], ...extra };
}

function agentDiagram(model: UMLModel, extra: Record<string, unknown> = {}): ProjectDiagram {
  return { ...createEmptyDiagram('Agent', UMLDiagramType.AgentDiagram), model, ...extra };
}

describe('prepareAgentModelForBackend', () => {
  beforeEach(() => localStorage.clear());

  it('keeps components already on the model', () => {
    const model = agentModel({ components: { [LLM.id]: LLM } as UMLModel['components'] });
    const prepared = prepareAgentModelForBackend(model, null);
    expect(prepared.components).toEqual({ [LLM.id]: LLM });
    expect(prepared.nodes.find((n) => n.id === STATE.id)).toBeDefined();
  });

  it('attaches the stored diagram components to a canvas snapshot without components', () => {
    const stored = agentModel({ components: { [LLM.id]: LLM } as UMLModel['components'] });
    const prepared = prepareAgentModelForBackend(agentModel(), agentDiagram(stored));
    expect(prepared.components).toEqual({ [LLM.id]: LLM });
  });

  it('migrates legacy diagram-level agentComponents, stripping bounds', () => {
    const legacy = { [LLM.id]: { ...LLM, bounds: { x: 0, y: 0, width: 0, height: 0 } } };
    const prepared = prepareAgentModelForBackend(agentModel(), agentDiagram(agentModel(), { agentComponents: legacy }));
    expect(prepared.components).toEqual({ [LLM.id]: LLM });
    expect((prepared as { agentComponents?: unknown }).agentComponents).toBeUndefined();
  });

  it('moves legacy component nodes out of the canvas nodes', () => {
    const model = agentModel();
    const { id, type, ...data } = LLM;
    model.nodes.push({
      id,
      type,
      position: { x: 1, y: 1 },
      width: 1,
      height: 1,
      measured: { width: 1, height: 1 },
      data,
    } as unknown as UMLModel['nodes'][number]);
    const prepared = prepareAgentModelForBackend(model, null);
    expect(prepared.nodes.find((n) => n.id === LLM.id)).toBeUndefined();
    expect(prepared.components?.[LLM.id]).toEqual(LLM);
  });

  it('defaults to the active AgentDiagram of the current project in storage', () => {
    const project = createDefaultProject('P', '', 'me');
    project.diagrams.AgentDiagram[0] = agentDiagram(
      agentModel({ components: { [LLM.id]: LLM } as UMLModel['components'] }),
    );
    ProjectStorageRepository.saveProject(project);

    expect(prepareAgentModelForBackend(agentModel()).components).toEqual({ [LLM.id]: LLM });
  });

  it('is idempotent and leaves non-agent models alone', () => {
    const model = agentModel({ components: { [LLM.id]: LLM } as UMLModel['components'] });
    const once = prepareAgentModelForBackend(model, null);
    expect(prepareAgentModelForBackend(once, null)).toEqual(once);

    const classModel = createEmptyDiagram('C', UMLDiagramType.ClassDiagram).model as UMLModel;
    expect(prepareAgentModelForBackend(classModel, null)).toBe(classModel);
  });
});

describe('getAgentComponents', () => {
  it('reads model.components, falling back to the legacy diagram field', () => {
    expect(getAgentComponents(agentDiagram(agentModel({ components: { [LLM.id]: LLM } as UMLModel['components'] })))).toEqual({
      [LLM.id]: LLM,
    });
    expect(getAgentComponents(agentDiagram(agentModel(), { agentComponents: { [LLM.id]: LLM } }))).toEqual({ [LLM.id]: LLM });
    expect(getAgentComponents(null)).toEqual({});
  });
});

describe('buildProjectPayloadForBackend', () => {
  it('sends every agent diagram with its components in model.components', () => {
    const project = createDefaultProject('P', '', 'me');
    project.diagrams.AgentDiagram[0] = agentDiagram(agentModel(), { agentComponents: { [LLM.id]: LLM } });

    const payload = buildProjectPayloadForBackend(project) as { diagrams: { AgentDiagram: ProjectDiagram[] } };
    const sent = payload.diagrams.AgentDiagram[0].model as UMLModel;
    expect(sent.components).toEqual({ [LLM.id]: LLM });
    expect(sent.nodes.find((n) => n.id === STATE.id)).toBeDefined();
  });
});
