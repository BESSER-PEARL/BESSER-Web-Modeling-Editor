import { describe, it, expect } from 'vitest';
import type { BesserNode, UMLModel } from '@besser/wme';
import { migrateUMLModelV3ToV4 } from '../../../shared/services/storage/migrate-uml-v3-to-v4';

/**
 * Regression guard for Component and Deployment fields on the load path:
 * a stored v3 model lifted to v4 must keep `stereotype` next to the header
 * switch, Artifact `manifests` and Component `processModelRefs`.
 */

const bounds = { x: 0, y: 0, width: 200, height: 100 };

const v3Model = (type: 'ComponentDiagram' | 'DeploymentDiagram', elements: Record<string, object>) => ({
  version: '3.0.0',
  type,
  size: { width: 800, height: 600 },
  interactive: { elements: {}, relationships: {} },
  elements: Object.fromEntries(
    Object.entries(elements).map(([id, el]) => [id, { id, owner: null, bounds, ...el }]),
  ),
  relationships: {},
  assessments: {},
});

const nodeData = (model: UMLModel, id: string): Record<string, unknown> => {
  const node = model.nodes.find((n: BesserNode) => n.id === id);
  expect(node).toBeDefined();
  return node!.data as Record<string, unknown>;
};

describe('Component/Deployment stereotype survives the v3 → v4 lift', () => {
  it('keeps a Component stereotype and its header switch', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('ComponentDiagram', {
        c1: { type: 'Component', name: 'Planner', stereotype: 'solution', displayStereotype: true },
      }),
      'ComponentDiagram',
    );
    expect(nodeData(model, 'c1')).toMatchObject({ stereotype: 'solution', isComponentHeaderShown: true });
  });

  it('keeps a Deployment component stereotype and its header switch', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('DeploymentDiagram', {
        d1: { type: 'DeploymentComponent', name: 'EdgeRuntime', stereotype: 'local', displayStereotype: true },
      }),
      'DeploymentDiagram',
    );
    expect(nodeData(model, 'd1')).toMatchObject({ stereotype: 'local', isComponentHeaderShown: true });
  });
});

describe('models saved before the stereotype was serialized', () => {
  // The default «component» label is the renderer's: the lift adds no key.
  it('lifts a Component without a stereotype key unchanged', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('ComponentDiagram', { c1: { type: 'Component', name: 'Legacy', displayStereotype: true } }),
      'ComponentDiagram',
    );
    expect(nodeData(model, 'c1').stereotype).toBeUndefined();
    expect(nodeData(model, 'c1').isComponentHeaderShown).toBe(true);
  });

  it('lifts a Deployment component without a stereotype key unchanged', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('DeploymentDiagram', {
        d1: { type: 'DeploymentComponent', name: 'Legacy', displayStereotype: true },
      }),
      'DeploymentDiagram',
    );
    expect(nodeData(model, 'd1').stereotype).toBeUndefined();
  });
});

describe('Deployment Artifact manifests survives the lift', () => {
  it('keeps manifests and the agent model link', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('DeploymentDiagram', {
        a1: { type: 'DeploymentArtifact', name: 'OrderAgent', manifests: ['cmp-1', 'cmp-2'], agentModelRef: 'agent-1' },
      }),
      'DeploymentDiagram',
    );
    expect(nodeData(model, 'a1')).toMatchObject({ manifests: ['cmp-1', 'cmp-2'], agentModelRef: 'agent-1' });
  });

  it('adds no manifests key to an Artifact saved before manifests existed', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('DeploymentDiagram', { a1: { type: 'DeploymentArtifact', name: 'X' } }),
      'DeploymentDiagram',
    );
    expect(nodeData(model, 'a1').manifests).toBeUndefined();
  });
});

describe('Component processModelRefs survives the lift', () => {
  it('keeps processModelRefs, realizes and the agent model link', () => {
    const model = migrateUMLModelV3ToV4(
      v3Model('ComponentDiagram', {
        c1: {
          type: 'Component',
          name: 'Planner',
          stereotype: 'solution',
          processModelRefs: ['bpmn-1', 'bpmn-2'],
          realizes: ['class-1'],
          agentModelRef: 'agent-1',
        },
      }),
      'ComponentDiagram',
    );
    expect(nodeData(model, 'c1')).toMatchObject({
      processModelRefs: ['bpmn-1', 'bpmn-2'],
      realizes: ['class-1'],
      agentModelRef: 'agent-1',
    });
  });
});
