import { beforeAll, describe, expect, it } from 'vitest';
import { Direction, UMLDiagramType } from '@besser/wme';
import type { UMLElement, UMLModel } from '@besser/wme';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { componentModelToDeploymentModel } from '../component-to-deployment';
import { renderInEditor } from './render-in-editor';
import agenticStarter from '../../../templates/pattern/bpmn/agentic_starter.json';

// Layout of the derived Deployment diagram: boxes wide enough for their
// names, and associations whose routed path stays inside the Docker Host.

type Box = UMLElement['bounds'];

const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** Component diagram of the agentic starter template, plus AgentCoder's swarm size (2 in the template). */
function starterComponents(): { model: UMLModel; multiplicity: Record<string, number> } {
  const r = bpmnModelToComponentModel(agenticStarter as unknown as UMLModel);
  if (!r.ok) throw new Error('component derivation refused');
  const coder = Object.values(r.model.elements).find((e) => e.type === 'Component' && e.name === 'AgentCoder')!;
  return { model: r.model, multiplicity: { [coder.id]: 2 } };
}

function deploy(model: UMLModel, multiplicity: Record<string, number> = {}): UMLModel {
  const r = componentModelToDeploymentModel(model, multiplicity);
  if (!r.ok) throw new Error(`deployment derivation refused: ${r.reason}`);
  return r.model;
}

const byType = (model: UMLModel, type: string) => Object.values(model.elements).filter((e) => e.type === type);
const nodes = (model: UMLModel, stereotype: string) =>
  byType(model, 'DeploymentNode').filter((e) => (e as { stereotype?: string }).stereotype === stereotype);

// A name rendered bold at ~9 px per glyph, centred, must clear the icon drawn
// in the box's top-right corner (26 px for an Artifact, 31 px for a Component).
const fitsCentredName = (box: UMLElement, iconBand: number) => box.bounds.width >= box.name.length * 9 + 2 * iconBand;

describe('componentModelToDeploymentModel layout', () => {
  it('sizes every Artifact, ExecutionEnvironment and Component to its name', () => {
    const { model, multiplicity } = starterComponents();
    const out = deploy(model, multiplicity);
    const artifacts = byType(out, 'DeploymentArtifact');
    expect(artifacts.map((a) => a.name).sort()).toEqual(['AgentCoder [2]', 'AgentReviewer']);

    for (const artifact of artifacts) {
      expect(fitsCentredName(artifact, 26), `${artifact.name} fits`).toBe(true);
      const execEnv = out.elements[artifact.owner!];
      expect(contains(execEnv.bounds, artifact.bounds), `${artifact.name} inside its ExecutionEnvironment`).toBe(true);
      const host = out.elements[execEnv.owner!];
      expect(contains(host.bounds, execEnv.bounds), `${execEnv.name} inside the Docker Host`).toBe(true);
    }
    for (const component of byType(out, 'DeploymentComponent')) {
      expect(fitsCentredName(component, 31), `${component.name} fits`).toBe(true);
    }
  });

  it('widens the boxes for long names and keeps the ExecutionEnvironments apart', () => {
    const { model } = starterComponents();
    const coder = Object.values(model.elements).find((e) => e.name === 'AgentCoder')!;
    coder.name = 'AgentCoderForTheBackendRepository';
    const out = deploy(model, { [coder.id]: 12 });

    const artifact = byType(out, 'DeploymentArtifact').find((a) => a.name.startsWith('AgentCoderFor'))!;
    expect(artifact.name).toBe('AgentCoderForTheBackendRepository [12]');
    expect(fitsCentredName(artifact, 26)).toBe(true);
    expect(contains(out.elements[artifact.owner!].bounds, artifact.bounds)).toBe(true);

    const [a, b] = nodes(out, 'executionEnvironment').sort((x, y) => x.bounds.x - y.bounds.x);
    expect(a.bounds.x + a.bounds.width).toBeLessThan(b.bounds.x);
  });

  it('points each association out of the side facing the other node', () => {
    const { model } = starterComponents();
    const out = deploy(model);
    const associations = Object.values(out.relationships).filter((r) => r.type === 'DeploymentAssociation');
    expect(associations).toHaveLength(1);
    for (const assoc of associations) {
      const src = out.elements[assoc.source.element].bounds;
      const tgt = out.elements[assoc.target.element].bounds;
      const srcIsLeft = src.x < tgt.x;
      expect(assoc.source.direction).toBe(srcIsLeft ? Direction.Right : Direction.Left);
      expect(assoc.target.direction).toBe(srcIsLeft ? Direction.Left : Direction.Right);
    }
  });

  it('does not draw an association between a node and the node it is nested in', () => {
    const model = {
      version: '3.0.0',
      type: 'ComponentDiagram',
      size: { width: 800, height: 600 },
      interactive: { elements: {}, relationships: {} },
      assessments: {},
      elements: {
        S: { id: 'S', name: 'Swarm', type: 'Subsystem', owner: null, bounds: { x: 0, y: 0, width: 400, height: 200 } },
        A: { id: 'A', name: 'Agent', type: 'Component', owner: 'S', bounds: { x: 20, y: 60, width: 160, height: 80 } },
      },
      relationships: {
        d: {
          id: 'd',
          name: '',
          type: 'ComponentDependency',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
          path: [],
          source: { element: 'A', direction: 'Right' },
          target: { element: 'S', direction: 'Left' },
        },
      },
    } as unknown as UMLModel;
    const out = deploy(model);
    expect(Object.values(out.relationships).filter((r) => r.type === 'DeploymentAssociation')).toEqual([]);
  });
});

describe('componentModelToDeploymentModel layout, rendered by the Deployment editor', () => {
  beforeAll(() => {
    // jsdom has no SVG layout; measure text at 9 px per glyph. (Each test file
    // runs in its own environment, so the stub does not leak.)
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value(this: SVGElement) {
        return { x: 0, y: 0, width: (this.textContent ?? '').length * 9, height: 16 };
      },
    });
  });

  it('keeps the agent-to-agent association inside the Docker Host and the names unclipped', async () => {
    const { model, multiplicity } = starterComponents();
    const derived = deploy(model, multiplicity);
    const rendered = await renderInEditor(UMLDiagramType.DeploymentDiagram, derived);
    const [host] = nodes(rendered, 'docker host');
    const associations = Object.values(rendered.relationships).filter((r) => r.type === 'DeploymentAssociation');
    expect(associations).toHaveLength(1);
    for (const assoc of associations) {
      for (const p of assoc.path) {
        const point = { x: assoc.bounds.x + p.x, y: assoc.bounds.y + p.y, width: 0, height: 0 };
        expect(contains(host.bounds, point), `path point ${point.x},${point.y} inside the Docker Host`).toBe(true);
      }
    }
    for (const artifact of byType(rendered, 'DeploymentArtifact')) {
      expect(artifact.bounds.width).toBe(derived.elements[artifact.id].bounds.width);
      expect(contains(rendered.elements[artifact.owner!].bounds, artifact.bounds)).toBe(true);
    }
  });
});
