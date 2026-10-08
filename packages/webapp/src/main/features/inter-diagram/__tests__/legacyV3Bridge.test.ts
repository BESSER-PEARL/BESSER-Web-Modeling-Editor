import { describe, expect, it } from 'vitest';
import type { UMLModel as V4UMLModel } from '@besser/wme';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { componentModelToDeploymentModel } from '../component-to-deployment';
import { laneToAgentModel } from '../lane-to-agent';
import {
  deriveAgentModel,
  deriveComponentModel,
  deriveDeploymentModel,
  fromLegacyV3,
  toLegacyV3,
  type UMLModel,
} from '../legacyV3Bridge';
import agenticStarterTemplate from '../../../templates/pattern/bpmn/agentic_starter.json';
import divergeMerge from './fixtures/diverge-merge.json';
import minimalAgentic from './fixtures/minimal-agentic.json';

// The bundled template is canonical v4; these transforms read v3.
const agenticStarter = toLegacyV3(agenticStarterTemplate as unknown as V4UMLModel);

const v3 = (fixture: unknown) => structuredClone(fixture) as UMLModel;

/** Order-free structural view: element types / names / owners, relationship ends and stereotypes. */
function signature(model: UMLModel): { elements: string[]; relationships: string[] } {
  const nameOf = (id: string | null) => (id ? (model.elements[id]?.name ?? '?') : '-');
  const stereotypeOf = (x: object) => (x as { stereotype?: string }).stereotype ?? '';
  return {
    elements: Object.values(model.elements)
      .map((e) => `${e.type}:${e.name}:${nameOf(e.owner)}:${stereotypeOf(e)}`)
      .sort(),
    relationships: Object.values(model.relationships)
      .map((r) => `${r.type}:${nameOf(r.source.element)}->${nameOf(r.target.element)}:${stereotypeOf(r)}`)
      .sort(),
  };
}

describe('toLegacyV3 / fromLegacyV3', () => {
  it('rebuilds the v3 BPMN shape: types, owners, absolute bounds, agentic fields, flows', () => {
    const source = v3(minimalAgentic);
    const legacy = toLegacyV3(fromLegacyV3(source));

    for (const [id, el] of Object.entries(source.elements)) {
      expect(legacy.elements[id], id).toMatchObject({
        type: el.type,
        name: el.name,
        owner: el.owner,
        bounds: el.bounds,
      });
    }
    expect(legacy.elements['lane-manager']).toMatchObject({ isAgentic: true, role: 'supervision', trustScore: 80 });
    const flow = Object.values(legacy.relationships)[0];
    expect(flow).toMatchObject({
      type: 'BPMNFlow',
      flowType: 'sequence',
      source: { element: 'task-mgr', direction: 'Down' },
      target: { element: 'task-wkr', direction: 'Up' },
    });
  });

  it('maps the Component header switch onto displayStereotype', () => {
    const model = {
      version: '4.0.0',
      id: 'c',
      title: 'C',
      type: 'ComponentDiagram',
      nodes: [
        {
          id: 's',
          type: 'componentSubsystem',
          position: { x: 10, y: 20 },
          width: 400,
          height: 300,
          data: { name: 'S', isComponentSubsystemHeaderShown: true },
        },
        {
          id: 'k',
          type: 'component',
          parentId: 's',
          position: { x: 30, y: 40 },
          width: 160,
          height: 80,
          data: { name: 'K', isComponentHeaderShown: false, stereotype: 'agent' },
        },
      ],
      edges: [],
      assessments: {},
    } as unknown as V4UMLModel;
    const legacy = toLegacyV3(model);
    expect(legacy.elements.s).toMatchObject({ type: 'Subsystem', displayStereotype: true });
    expect(legacy.elements.k).toMatchObject({
      type: 'Component',
      owner: 's',
      displayStereotype: false,
      stereotype: 'agent',
      bounds: { x: 40, y: 60, width: 160, height: 80 },
    });
    expect(legacy.elements.k).not.toHaveProperty('isComponentHeaderShown');
  });

  it('never throws on dangling parents, dangling edge ends or missing points', () => {
    const model = {
      version: '4.0.0',
      id: 'b',
      title: 'B',
      type: 'BPMNDiagram',
      nodes: [
        { id: 't', type: 'bpmnTask', parentId: 'gone', position: { x: 5, y: 5 }, width: 10, height: 10, data: {} },
      ],
      edges: [
        {
          id: 'f',
          type: 'BPMNMessageFlow',
          source: 't',
          target: 'gone',
          sourceHandle: '',
          targetHandle: 'top-left',
          data: {},
        },
      ],
      assessments: {},
    } as unknown as V4UMLModel;
    const legacy = toLegacyV3(model);
    expect(legacy.elements.t).toMatchObject({ owner: null, name: '', bounds: { x: 5, y: 5 } });
    expect(legacy.relationships.f).toMatchObject({
      type: 'BPMNFlow',
      flowType: 'message',
      target: { direction: 'Up' },
    });
    expect(legacy.relationships.f.path).toHaveLength(2);
    expect(() => fromLegacyV3(legacy)).not.toThrow();
  });
});

describe('derivation wrappers', () => {
  it.each([
    ['minimal-agentic', minimalAgentic],
    ['diverge-merge', divergeMerge],
    ['agentic_starter template', agenticStarter],
  ])('derive the same Component diagram from the stored v4 BPMN as from v3: %s', (_, fixture) => {
    const direct = bpmnModelToComponentModel(v3(fixture));
    const wrapped = deriveComponentModel(fromLegacyV3(v3(fixture)));
    if (!direct.ok || !wrapped.ok) throw new Error('derivation refused');
    expect(wrapped.model.version).toMatch(/^4\./);
    expect(signature(toLegacyV3(wrapped.model))).toEqual(signature(direct.model));
    // Lineage keys are the derived node / edge ids, which the v4 model keeps.
    expect(Object.values(wrapped.elementMapping).sort()).toEqual(Object.values(direct.elementMapping).sort());
    const ids = new Set([...wrapped.model.nodes, ...wrapped.model.edges].map((x) => x.id));
    for (const id of Object.keys(wrapped.elementMapping)) expect(ids.has(id), id).toBe(true);
  });

  it('stores derived edges without points, so the editor routes them', () => {
    const r = deriveComponentModel(fromLegacyV3(v3(agenticStarter)));
    if (!r.ok) throw new Error('derivation refused');
    expect(r.model.edges.length).toBeGreaterThan(0);
    for (const edge of r.model.edges) expect(edge.data.points).toEqual([]);
  });

  it('derives the Deployment diagram from a stored v4 Component diagram', () => {
    const component = bpmnModelToComponentModel(v3(agenticStarter));
    if (!component.ok) throw new Error('derivation refused');
    const direct = componentModelToDeploymentModel(component.model);
    const wrapped = deriveDeploymentModel(fromLegacyV3(component.model));
    if (!direct.ok || !wrapped.ok) throw new Error('derivation refused');
    expect(signature(toLegacyV3(wrapped.model))).toEqual(signature(direct.model));
  });

  it('derives an Agent diagram from a lane of the stored v4 BPMN', () => {
    const source = v3(agenticStarter);
    const laneId = Object.values(source.elements).find((e) => e.name === 'AgentReviewer')!.id;
    const direct = laneToAgentModel(source, laneId);
    const wrapped = deriveAgentModel(fromLegacyV3(source), laneId);
    if (!direct.ok || !wrapped.ok) throw new Error('derivation refused');
    const states = (names: string[]) => names.sort();
    expect(states(wrapped.model.nodes.filter((n) => n.type === 'AgentState').map((n) => String(n.data.name)))).toEqual(
      states(
        Object.values(direct.model.elements)
          .filter((e) => e.type === 'AgentState')
          .map((e) => e.name),
      ),
    );
  });

  it('passes refusals through unchanged', () => {
    const notBpmn = fromLegacyV3({ ...v3(minimalAgentic), type: 'ClassDiagram' } as UMLModel);
    expect(deriveComponentModel(notBpmn)).toEqual({ ok: false, reason: 'not-a-bpmn-diagram', warnings: [] });
  });
});
