import { beforeAll, describe, expect, it } from 'vitest';
import { UMLDiagramType, type BesserNode, type UMLModel } from '@besser/wme';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { componentModelToDeploymentModel } from '../component-to-deployment';
import { drawnRoute, renderInEditor } from './render-in-editor';
import {
  absBox,
  makeEdge,
  makeModel,
  makeNode,
  nameOf,
  nodeById,
  nodeNamed,
  nodesOfType,
  type Box,
} from './v4-helpers';
import agenticStarterTemplate from '../../../templates/pattern/bpmn/agentic_starter.json';

const agenticStarter = agenticStarterTemplate as unknown as UMLModel;

// Layout of the derived Deployment diagram: boxes wide enough for their
// names, and associations whose routed path stays inside the Docker Host.

const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.width <= outer.x + outer.width &&
  inner.y + inner.height <= outer.y + outer.height;

/** Component diagram of the agentic starter template, plus AgentCoder's swarm size (2 in the template). */
function starterComponents(): { model: UMLModel; multiplicity: Record<string, number> } {
  const r = bpmnModelToComponentModel(agenticStarter);
  if (!r.ok) throw new Error('component derivation refused');
  const coder = nodeNamed(r.model, 'AgentCoder', 'component')!;
  return { model: r.model, multiplicity: { [coder.id]: 2 } };
}

function deploy(model: UMLModel, multiplicity: Record<string, number> = {}): UMLModel {
  const r = componentModelToDeploymentModel(model, multiplicity);
  if (!r.ok) throw new Error(`deployment derivation refused: ${r.reason}`);
  return r.model;
}

const deploymentNodes = (model: UMLModel, stereotype: string) =>
  nodesOfType(model, 'deploymentNode').filter((n) => n.data.stereotype === stereotype);

// A name rendered bold at ~9 px per glyph, centred, must clear the icon drawn
// in the box's top-right corner (26 px for an Artifact, 31 px for a Component).
const fitsCentredName = (box: BesserNode, iconBand: number) => box.width >= nameOf(box).length * 9 + 2 * iconBand;

describe('componentModelToDeploymentModel layout', () => {
  it('sizes every Artifact, ExecutionEnvironment and Component to its name', () => {
    const { model, multiplicity } = starterComponents();
    const out = deploy(model, multiplicity);
    const artifacts = nodesOfType(out, 'deploymentArtifact');
    expect(artifacts.map(nameOf).sort()).toEqual(['AgentCoder [2]', 'AgentReviewer']);

    for (const artifact of artifacts) {
      expect(fitsCentredName(artifact, 26), `${nameOf(artifact)} fits`).toBe(true);
      const execEnv = nodeById(out, artifact.parentId)!;
      expect(contains(absBox(out, execEnv), absBox(out, artifact)), `${nameOf(artifact)} inside its ExecutionEnvironment`).toBe(
        true,
      );
      const host = nodeById(out, execEnv.parentId)!;
      expect(contains(absBox(out, host), absBox(out, execEnv)), `${nameOf(execEnv)} inside the Docker Host`).toBe(true);
    }
    for (const component of nodesOfType(out, 'deploymentComponent')) {
      expect(fitsCentredName(component, 31), `${nameOf(component)} fits`).toBe(true);
    }
  });

  it('widens the boxes for long names and keeps the ExecutionEnvironments apart', () => {
    const { model } = starterComponents();
    const coder = nodeNamed(model, 'AgentCoder')!;
    coder.data.name = 'AgentCoderForTheBackendRepository';
    const out = deploy(model, { [coder.id]: 12 });

    const artifact = nodesOfType(out, 'deploymentArtifact').find((a) => nameOf(a).startsWith('AgentCoderFor'))!;
    expect(nameOf(artifact)).toBe('AgentCoderForTheBackendRepository [12]');
    expect(fitsCentredName(artifact, 26)).toBe(true);
    expect(contains(absBox(out, nodeById(out, artifact.parentId)!), absBox(out, artifact))).toBe(true);

    const [a, b] = deploymentNodes(out, 'executionEnvironment')
      .map((n) => absBox(out, n))
      .sort((x, y) => x.x - y.x);
    expect(a.x + a.width).toBeLessThan(b.x);
  });

  it('points each association out of the side facing the other node', () => {
    const { model } = starterComponents();
    const out = deploy(model);
    const associations = out.edges.filter((e) => e.type === 'DeploymentAssociation');
    expect(associations).toHaveLength(1);
    for (const assoc of associations) {
      const src = absBox(out, nodeById(out, assoc.source)!);
      const tgt = absBox(out, nodeById(out, assoc.target)!);
      const srcIsLeft = src.x < tgt.x;
      expect(assoc.sourceHandle).toBe(srcIsLeft ? 'right' : 'left');
      expect(assoc.targetHandle).toBe(srcIsLeft ? 'left' : 'right');
    }
  });

  it('does not draw an association between a node and the node it is nested in', () => {
    const model = makeModel(
      'ComponentDiagram',
      [
        makeNode('S', 'componentSubsystem', { name: 'Swarm' }, { x: 0, y: 0, width: 400, height: 200 }),
        makeNode('A', 'component', { name: 'Agent' }, { x: 20, y: 60, width: 160, height: 80 }, 'S'),
      ],
      [makeEdge('d', 'ComponentDependency', 'A', 'S')],
    );
    const out = deploy(model);
    expect(out.edges.filter((e) => e.type === 'DeploymentAssociation')).toEqual([]);
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
    const [host] = deploymentNodes(rendered, 'docker host');
    const hostBox = absBox(rendered, host);
    const associations = rendered.edges.filter((e) => e.type === 'DeploymentAssociation');
    expect(associations).toHaveLength(1);
    for (const assoc of associations) {
      for (const p of drawnRoute(rendered, assoc)) {
        const point = { ...p, width: 0, height: 0 };
        expect(contains(hostBox, point), `path point ${point.x},${point.y} inside the Docker Host`).toBe(true);
      }
    }
    for (const artifact of nodesOfType(rendered, 'deploymentArtifact')) {
      expect(artifact.width).toBe(nodeById(derived, artifact.id)!.width);
      expect(contains(absBox(rendered, nodeById(rendered, artifact.parentId)!), absBox(rendered, artifact))).toBe(true);
    }
  });
});
