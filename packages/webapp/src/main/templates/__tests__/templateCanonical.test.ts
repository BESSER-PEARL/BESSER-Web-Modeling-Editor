import { describe, expect, it } from 'vitest';
import { isV4Format, normalizeV4Model } from '@besser/wme';
import {
  TemplateFactory,
  canonicalizeTemplateModel,
} from '../../features/project/create-diagram-from-template-modal/template-factory';
import { SoftwarePatternType } from '../../features/project/create-diagram-from-template-modal/software-pattern/software-pattern-types';

// Every bundled template is regenerated from smart-generator's v3 source
// through the real migrator (convert + normalizeV4Model). They must therefore
// already be canonical v4: normalizing again changes nothing.
const templates = import.meta.glob('../pattern/**/*.json', { eager: true, import: 'default' }) as Record<string, any>;

const umlModels = (): Array<[string, any]> => {
  const out: Array<[string, any]> = [];
  for (const [path, json] of Object.entries(templates)) {
    if (path.includes('/gui/')) continue; // GrapesJS, not a UML model
    if (json?.project) {
      for (const [bucket, list] of Object.entries(json.project.diagrams ?? {})) {
        if (bucket === 'GUINoCodeDiagram' || bucket === 'QuantumCircuitDiagram') continue;
        (list as any[]).forEach((d, i) => out.push([`${path} ${bucket}[${i}]`, d.model]));
      }
      Object.entries(json.agentBaseModels ?? {}).forEach(([k, m]) => out.push([`${path} agentBaseModels.${k}`, m]));
    } else {
      out.push([path, json]);
    }
  }
  return out;
};

const allNodes = (model: any): any[] => (Array.isArray(model?.nodes) ? model.nodes : []);

describe('bundled templates are canonical v4', () => {
  it.each(umlModels())('%s', (_label, model) => {
    expect(isV4Format(model)).toBe(true);
    expect(model.elements).toBeUndefined();
    expect(JSON.parse(JSON.stringify(normalizeV4Model(structuredClone(model))))).toEqual(model);
    // No body rows left as separate child nodes (the backend ignores those).
    const orphanTypes = new Set(['AgentStateBody', 'AgentStateFallbackBody', 'StateBody', 'StateFallbackBody']);
    expect(allNodes(model).filter((n) => orphanTypes.has(n.type))).toEqual([]);
    // OCL nodes use the registered (PascalCase) type.
    expect(allNodes(model).filter((n) => String(n.type).toLowerCase() === 'classoclconstraint' && n.type !== 'ClassOCLConstraint')).toEqual([]);
  });

  it('Library_Complete keeps its OCL invariant inv1', () => {
    const model = templates['../pattern/structural/Library_Complete.json'];
    const ocl = allNodes(model).filter((n) => n.type === 'ClassOCLConstraint');
    expect(ocl.map((n) => n.data.expression)).toContain('context Book inv inv1: self.pages> 10');
  });

  it('traficlight states carry their bodies inline', () => {
    const model = templates['../pattern/statemachine/traficlight.json'];
    const states = allNodes(model).filter((n) => n.type === 'State');
    expect(states.length).toBeGreaterThan(0);
    expect(states.some((s) => Array.isArray(s.data.bodies) && s.data.bodies.length > 0)).toBe(true);
  });

  it('dbagent keeps its DB action body inline on the state', () => {
    const model = templates['../pattern/agent/dbagent.json'];
    const withBodies = allNodes(model).filter(
      (n) => n.type === 'AgentState' && Array.isArray(n.data.bodies) && n.data.bodies.length > 0,
    );
    expect(withBodies.length).toBeGreaterThan(0);
  });
});

describe('TemplateFactory canonicalizes on instantiation', () => {
  const umlTypes = Object.values(SoftwarePatternType).filter(
    (t) => TemplateFactory.createSoftwarePattern(t).isUMLDiagram,
  );

  it.each(umlTypes)('%s yields a canonical v4 model', (type) => {
    const template = TemplateFactory.createSoftwarePattern(type);
    expect(isV4Format(template.diagram)).toBe(true);
  });

  it('never mutates the shared imported JSON', () => {
    const a = TemplateFactory.createSoftwarePattern(SoftwarePatternType.LIBRARY).diagram as any;
    a.nodes.length = 0;
    const b = TemplateFactory.createSoftwarePattern(SoftwarePatternType.LIBRARY).diagram as any;
    expect(b.nodes.length).toBeGreaterThan(0);
  });

  it('lifts a stale template (v3 shape / legacy v4 child nodes) to canonical v4', () => {
    const v3 = {
      version: '3.0.0',
      type: 'StateMachineDiagram',
      size: { width: 0, height: 0 },
      interactive: { elements: {}, relationships: {} },
      elements: {
        s1: { id: 's1', name: 'Red', type: 'State', owner: null, bounds: { x: 0, y: 0, width: 160, height: 100 } },
        b1: { id: 'b1', name: 'print(1)', type: 'StateBody', owner: 's1', bounds: { x: 0, y: 30, width: 160, height: 30 } },
      },
      relationships: {},
      assessments: {},
    };
    const out = canonicalizeTemplateModel(v3) as any;
    expect(isV4Format(out)).toBe(true);
    const state = out.nodes.find((n: any) => n.id === 's1');
    expect(state.data.bodies.map((b: any) => b.id)).toEqual(['b1']);
    expect(out.nodes.find((n: any) => n.id === 'b1')).toBeUndefined();
    // Input untouched.
    expect(v3.elements.b1).toBeDefined();
  });
});
