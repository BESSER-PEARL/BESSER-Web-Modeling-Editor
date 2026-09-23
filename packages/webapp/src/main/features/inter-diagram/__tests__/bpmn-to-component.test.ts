import { describe, it, expect } from 'vitest';
import type { UMLModel, UMLElement } from '@besser/wme';
import { bpmnModelToComponentModel, resolveEdgeKind } from '../bpmn-to-component';
import flatNoPools from './fixtures/flat-no-pools.json';
import singlePoolNoLanes from './fixtures/single-pool-no-lanes.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import divergeMerge from './fixtures/diverge-merge.json';
import poolMessage from './fixtures/pool-message.json';

describe('Inter-diagram — bpmnModelToComponentModel', () => {
  describe('refusals', () => {
    it('refuses with `no-pools` on a flat BPMN', () => {
      const r = bpmnModelToComponentModel(flatNoPools as unknown as UMLModel);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('no-pools');
    });

    it('refuses with `no-lanes-in-any-pool` when a pool has no lanes', () => {
      const r = bpmnModelToComponentModel(singlePoolNoLanes as unknown as UMLModel);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('no-lanes-in-any-pool');
    });

    it('refuses on a non-BPMN model', () => {
      const r = bpmnModelToComponentModel({
        version: '3.0.0',
        type: 'ClassDiagram',
        size: { width: 800, height: 600 },
        elements: {},
        interactive: { elements: {}, relationships: {} },
        relationships: {},
        assessments: {},
      } as unknown as UMLModel);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-a-bpmn-diagram');
    });
  });

  describe('minimal-agentic — manager → worker', () => {
    const r = bpmnModelToComponentModel(minimalAgentic as unknown as UMLModel);
    it('produces a ComponentDiagram model', () => {
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.model.type).toBe('ComponentDiagram');
      }
    });
    it('emits 1 Subsystem + 2 agent-Components (no skills, no has edges)', () => {
      if (!r.ok) throw new Error('expected ok');
      const els = Object.values(r.model.elements);
      expect(els.filter((e) => e.type === 'Subsystem')).toHaveLength(1);
      const components = els.filter((e) => e.type === 'Component');
      expect(components).toHaveLength(2);
      // the lane-role mapping: lane role flows to Component stereotype
      const solutions = components.filter((c) => (c as unknown as { stereotype?: string }).stereotype === 'solution');
      const supervisions = components.filter(
        (c) => (c as unknown as { stereotype?: string }).stereotype === 'supervision',
      );
      expect(solutions).toHaveLength(1);
      expect(supervisions).toHaveLength(1);
    });
    it('emits exactly 1 `supervises` edge (manager → worker, T1d; no `has` edges)', () => {
      if (!r.ok) throw new Error('expected ok');
      const rels = Object.values(r.model.relationships);
      const stereotypes = rels.map((rel) => (rel as unknown as { stereotype?: string }).stereotype).sort();
      expect(stereotypes).toEqual(['supervises']);
    });
  });

  describe('gateway-routed — manager → leader-driven merging gateway → 2 workers', () => {
    const r = bpmnModelToComponentModel(gatewayRouted as unknown as UMLModel);
    it('emits 2 `supervises` edges (one per worker)', () => {
      if (!r.ok) throw new Error('expected ok');
      const rels = Object.values(r.model.relationships);
      const supervises = rels.filter((rel) => (rel as unknown as { stereotype?: string }).stereotype === 'supervises');
      expect(supervises).toHaveLength(2);
    });
  });

  describe('multi-pool-message — message flow to a non-agentic pool is dropped', () => {
    const r = bpmnModelToComponentModel(multiPoolMessage as unknown as UMLModel);
    it('drops the non-agentic Pool B entirely (no Subsystem, no external Component)', () => {
      if (!r.ok) throw new Error('expected ok');
      // A Subsystem is emitted only for a pool
      // with an agentic lane — never via a message flow. Pool B's only lane is
      // non-agentic, so it disappears; only SwarmA + its Coordinator remain.
      const subsystems = Object.values(r.model.elements).filter((e) => e.type === 'Subsystem');
      expect(subsystems).toHaveLength(1);
      expect(subsystems[0].name).toBe('SwarmA');
      const externalComps = Object.values(r.model.elements).filter(
        (e) => e.type === 'Component' && (e as unknown as { stereotype?: string }).stereotype === 'external',
      );
      expect(externalComps).toHaveLength(0);
    });
    it('drops the message flow that targeted the non-agentic pool', () => {
      if (!r.ok) throw new Error('expected ok');
      const delegates = Object.values(r.model.relationships).filter(
        (rel) => (rel as unknown as { stereotype?: string }).stereotype === 'delegates',
      );
      expect(delegates).toHaveLength(0);
    });
    it('does NOT surface an `inferred-external-component` warning', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings.some((w) => w.kind === 'inferred-external-component')).toBe(false);
    });

    it('drops a POOL-targeted message flow too (real-editor case: flow attaches to the pool, not the lane)', () => {
      // BPMN message flows commonly attach pool-to-pool, so the endpoint
      // resolves to the pool (not a lane). A pool with lanes but no agentic
      // lane must still NOT be synthesised as a Subsystem.
      const model = JSON.parse(JSON.stringify(multiPoolMessage));
      model.relationships['msg-flow'].target.element = 'pool-b';
      const r2 = bpmnModelToComponentModel(model as unknown as UMLModel);
      if (!r2.ok) throw new Error('expected ok');
      const subsystems = Object.values(r2.model.elements).filter((e) => e.type === 'Subsystem');
      expect(subsystems).toHaveLength(1);
      expect(subsystems[0].name).toBe('SwarmA');
      const delegates = Object.values(r2.model.relationships).filter(
        (rel) => (rel as unknown as { stereotype?: string }).stereotype === 'delegates',
      );
      expect(delegates).toHaveLength(0);
    });
  });

  describe('edge de-duplication', () => {
    it('two parallel manager→worker flows collapse to one `supervises` edge', () => {
      const model = JSON.parse(JSON.stringify(minimalAgentic));
      const existingFlow = Object.values(model.relationships).find(
        (rel: unknown) => (rel as { type?: string; flowType?: string }).type === 'BPMNFlow',
      ) as { id: string };
      if (!existingFlow) throw new Error('fixture should contain a sequence flow');
      const dup = { ...existingFlow, id: `${existingFlow.id}-dup` };
      model.relationships[dup.id] = dup;

      const r = bpmnModelToComponentModel(model as unknown as UMLModel);
      if (!r.ok) throw new Error('expected ok');
      const supervises = Object.values(r.model.relationships).filter(
        (rel) => (rel as unknown as { stereotype?: string }).stereotype === 'supervises',
      );
      expect(supervises).toHaveLength(1);
    });
  });

  describe('diverge-then-merge — surfaces supervises + revises + delegates (guide 13/14)', () => {
    const r = bpmnModelToComponentModel(divergeMerge as unknown as UMLModel);

    it('produces a ComponentDiagram with 1 Subsystem + 2 Components (non-agentic lane skipped)', () => {
      if (!r.ok) throw new Error('expected ok');
      const els = Object.values(r.model.elements);
      expect(els.filter((e) => e.type === 'Subsystem')).toHaveLength(1);
      expect(els.filter((e) => e.type === 'Component')).toHaveLength(2);
    });

    it('maps lane roles to Component stereotypes and skips the non-agentic lane', () => {
      if (!r.ok) throw new Error('expected ok');
      const comps = Object.values(r.model.elements)
        .filter((e) => e.type === 'Component')
        .map((c) => (c as unknown as { stereotype?: string }).stereotype)
        .sort();
      // lane-mgr → supervision, lane-wkr → solution (the lane-role mapping)
      expect(comps).toEqual(['solution', 'supervision']);
    });

    it('emits one revises + one supervises edge (the delegate-to-Maintainer is gone)', () => {
      if (!r.ok) throw new Error('expected ok');
      const stereotypes = Object.values(r.model.relationships)
        .map((rel) => (rel as unknown as { stereotype?: string }).stereotype)
        .sort();
      expect(stereotypes).toEqual(['revises', 'supervises']);
    });

    it('derives no Component from the non-agentic Maintainer lane', () => {
      if (!r.ok) throw new Error('expected ok');
      const comps = Object.values(r.model.elements).filter((e) => e.type === 'Component');
      const AGENTIC_STEREOS = new Set(['solution', 'supervision']);
      expect(comps.every((c) => AGENTIC_STEREOS.has((c as unknown as { stereotype?: string }).stereotype ?? ''))).toBe(
        true,
      );
      expect(comps.some((c) => c.name === 'Maintainer')).toBe(false);
    });
  });

  describe('21 — processModelRefs auto-derive (agentic Component → BPMN diagram)', () => {
    it('T-P1 stamps processModelRefs on agentic Components when sourceDiagramId is passed', () => {
      const r = bpmnModelToComponentModel(minimalAgentic as unknown as UMLModel, {
        sourceDiagramId: 'bpmn-42',
      });
      if (!r.ok) throw new Error('expected ok');
      const agents = Object.values(r.model.elements).filter(
        (e) => e.type === 'Component' && (e as unknown as { stereotype?: string }).stereotype === 'solution',
      );
      expect(agents.length).toBeGreaterThan(0);
      for (const a of agents) {
        expect((a as unknown as { processModelRefs?: string[] }).processModelRefs).toEqual(['bpmn-42']);
      }
    });

    it('T-P2 skips non-agentic lanes; every emitted Component is a stamped agent', () => {
      const r = bpmnModelToComponentModel(divergeMerge as unknown as UMLModel, {
        sourceDiagramId: 'bpmn-42',
      });
      if (!r.ok) throw new Error('expected ok');
      const components = Object.values(r.model.elements).filter((e) => e.type === 'Component');
      // Only agentic lanes become Components.
      // The lane-role mapping uses the two agentic profile stereotypes.
      const AGENTIC_STEREOS = new Set(['solution', 'supervision']);
      const nonAgentic = components.filter(
        (e) => !AGENTIC_STEREOS.has((e as unknown as { stereotype?: string }).stereotype ?? ''),
      );
      expect(nonAgentic).toHaveLength(0);
      expect(components.length).toBeGreaterThan(0);
      for (const a of components) {
        expect((a as unknown as { processModelRefs?: string[] }).processModelRefs).toEqual(['bpmn-42']);
      }
    });

    it('T-P3 emits no processModelRefs without sourceDiagramId (back-compat)', () => {
      const r = bpmnModelToComponentModel(minimalAgentic as unknown as UMLModel);
      if (!r.ok) throw new Error('expected ok');
      for (const e of Object.values(r.model.elements)) {
        expect((e as unknown as { processModelRefs?: string[] }).processModelRefs).toBeUndefined();
      }
    });
  });

  describe('pool-connected message flows target the Subsystem (14-FU2 / M9a+c)', () => {
    const r = bpmnModelToComponentModel(poolMessage as unknown as UMLModel);

    it('emits 3 Subsystems incl. a synthesised external for the laneless pool', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = Object.values(r.model.elements).filter((e) => e.type === 'Subsystem');
      expect(subs).toHaveLength(3);
      expect(subs.map((s) => s.name).sort()).toEqual(['LegacySystem', 'SwarmA', 'SwarmB']);
    });

    it('does NOT emit any external-stereotyped Component (pools are Subsystems)', () => {
      if (!r.ok) throw new Error('expected ok');
      const externalComps = Object.values(r.model.elements).filter(
        (e) => e.type === 'Component' && (e as unknown as { stereotype?: string }).stereotype === 'external',
      );
      expect(externalComps).toHaveLength(0);
    });

    it('routes a pool→pool message flow as Subsystem → Subsystem', () => {
      if (!r.ok) throw new Error('expected ok');
      const edge = Object.values(r.model.relationships).find((rel) => r.elementMapping[rel.id] === 'mf-1');
      expect(edge).toBeDefined();
      const src = r.model.elements[(edge as unknown as { source: { element: string } }).source.element];
      const tgt = r.model.elements[(edge as unknown as { target: { element: string } }).target.element];
      expect(src.type).toBe('Subsystem');
      expect(tgt.type).toBe('Subsystem');
      expect((edge as unknown as { stereotype?: string }).stereotype).toBe('delegates');
    });

    it('routes a lane→black-box-pool message flow as Component → Subsystem', () => {
      if (!r.ok) throw new Error('expected ok');
      const edge = Object.values(r.model.relationships).find((rel) => r.elementMapping[rel.id] === 'mf-2');
      expect(edge).toBeDefined();
      const src = r.model.elements[(edge as unknown as { source: { element: string } }).source.element];
      const tgt = r.model.elements[(edge as unknown as { target: { element: string } }).target.element];
      expect(src.type).toBe('Component');
      expect(tgt.type).toBe('Subsystem');
      expect(tgt.name).toBe('LegacySystem');
    });
  });

  describe('16 — tools/skills as capability Components (opt-in)', () => {
    // A self-contained BPMN: one agentic worker lane with a task linking
    // an Agent diagram. The derivation matches `type: 'AgentTool'` by
    // string, so this exercises the full path without the editor element.
    const makeBpmn = (laneOverrides: Record<string, unknown> = {}, taskRef = 'ad1') =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 200 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
            ...laneOverrides,
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Search',
            owner: 'L1',
            agentDiagramRef: taskRef,
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const agentModel = {
      version: '3.0.0',
      type: 'AgentDiagram',
      size: { width: 100, height: 100 },
      elements: {
        tlA: {
          id: 'tlA',
          type: 'AgentTool',
          name: 'WebSearch',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
        },
        tlB: {
          id: 'tlB',
          type: 'AgentTool',
          name: 'WebSearch',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
        }, // dup name
        skA: {
          id: 'skA',
          type: 'AgentSkill',
          name: 'Summarise',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    } as unknown as UMLModel;
    const agentDiagramsById = new Map([['ad1', agentModel]]);

    const capStereos = (m: UMLModel) =>
      Object.values(m.elements)
        .map((e) => (e as unknown as { stereotype?: string }).stereotype)
        .filter((s) => s === 'tool' || s === 'skill');

    it('T-U1 — default (no opts): emits no tool/skill Components (clean swarm)', () => {
      const r = bpmnModelToComponentModel(makeBpmn());
      if (!r.ok) throw new Error('expected ok');
      expect(capStereos(r.model)).toHaveLength(0);
    });

    it('T-U2 — opt-in: one `tool` (deduped) + one `skill`, with `uses` and `has` edges', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const tools = Object.values(r.model.elements).filter(
        (e) => (e as unknown as { stereotype?: string }).stereotype === 'tool',
      );
      const skills = Object.values(r.model.elements).filter(
        (e) => (e as unknown as { stereotype?: string }).stereotype === 'skill',
      );
      expect(tools).toHaveLength(1); // WebSearch deduped (tool deduplication)
      expect(tools[0].name).toBe('WebSearch');
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('Summarise');
      const edgeStereos = Object.values(r.model.relationships)
        .map((rel) => (rel as unknown as { stereotype?: string }).stereotype)
        .filter((s) => s === 'uses' || s === 'has')
        .sort();
      expect(edgeStereos).toEqual(['has', 'uses']); // relationship direction
    });

    it('T-U3 — dangling agentDiagramRef: no capabilities, no throw', () => {
      const r = bpmnModelToComponentModel(makeBpmn({}, 'gone'), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(capStereos(r.model)).toHaveLength(0);
    });

    it('T-U4 — lineage: a capability Component maps to the linking BPMNTask id', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const tool = Object.values(r.model.elements).find(
        (e) => (e as unknown as { stereotype?: string }).stereotype === 'tool',
      );
      expect(tool).toBeDefined();
      expect(r.elementMapping[tool!.id]).toBe('T1');
    });

    it('T-U5 — non-agentic lane: no capabilities even with includeCapabilities', () => {
      const r = bpmnModelToComponentModel(makeBpmn({ isAgentic: false, role: undefined }), {
        agentDiagramsById,
        includeCapabilities: true,
      });
      if (!r.ok) throw new Error('expected ok');
      expect(capStereos(r.model)).toHaveLength(0);
    });
  });

  describe('16-FU2 — grouped capability mode (Skills / Tools zones)', () => {
    // Single agentic lane → ad1 (tools WebSearch ×2 dup, skill Summarise).
    const makeBpmn = () =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 200 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Search',
            owner: 'L1',
            agentDiagramRef: 'ad1',
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    // Two agentic lanes → ad1 + ad2; both list a tool named "WebSearch".
    const makeTwoAgentBpmn = () =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 400 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Search',
            owner: 'L1',
            agentDiagramRef: 'ad1',
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
          L2: {
            id: 'L2',
            type: 'BPMNSwimlane',
            name: 'Analyst',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 200, width: 380, height: 200 },
          },
          T2: {
            id: 'T2',
            type: 'BPMNTask',
            name: 'Analyse',
            owner: 'L2',
            agentDiagramRef: 'ad2',
            bounds: { x: 40, y: 220, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const cap = (type: string, name: string, id: string) => ({
      id,
      type,
      name,
      owner: null,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    });
    const agentModel = (...els: Array<ReturnType<typeof cap>>) =>
      ({
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 100, height: 100 },
        elements: Object.fromEntries(els.map((e) => [e.id, e])),
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const ad1 = agentModel(
      cap('AgentTool', 'WebSearch', 't1a'),
      cap('AgentTool', 'WebSearch', 't1b'),
      cap('AgentSkill', 'Summarise', 's1'),
    );
    const ad2 = agentModel(cap('AgentTool', 'WebSearch', 't2a'), cap('AgentTool', 'Calculator', 't2b'));
    const byId1 = new Map([['ad1', ad1]]);
    const byId2 = new Map([
      ['ad1', ad1],
      ['ad2', ad2],
    ]);
    const grouped = { includeCapabilities: true } as const;

    const subsystemsNamed = (m: UMLModel) =>
      Object.values(m.elements)
        .filter((e) => e.type === 'Subsystem')
        .map((e) => e.name);
    const byStereo = (m: UMLModel, s: string) =>
      Object.values(m.elements).filter((e) => (e as unknown as { stereotype?: string }).stereotype === s);
    const edgesByStereo = (m: UMLModel, s: string) =>
      Object.values(m.relationships).filter((r) => (r as unknown as { stereotype?: string }).stereotype === s);

    it('T-G1 — emits named Skills + Tools Subsystems holding the capabilities', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId1, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemsNamed(r.model).sort()).toEqual(['Skills', 'Swarm', 'Tools']);
      expect(byStereo(r.model, 'tool')).toHaveLength(1); // WebSearch (dup collapsed)
      expect(byStereo(r.model, 'skill')).toHaveLength(1); // Summarise
      // capability Components are owned by a zone Subsystem, not the swarm
      const tool = byStereo(r.model, 'tool')[0];
      const owner = r.model.elements[(tool as unknown as { owner: string }).owner];
      expect(owner.name).toBe('Tools');
      expect(edgesByStereo(r.model, 'uses')).toHaveLength(1);
      expect(edgesByStereo(r.model, 'has')).toHaveLength(1);
    });

    it('T-G2 — cross-agent global dedup: shared tool = 1 Component, N edges (D1)', () => {
      const r = bpmnModelToComponentModel(makeTwoAgentBpmn(), { agentDiagramsById: byId2, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const tools = byStereo(r.model, 'tool');
      expect(tools.map((t) => t.name).sort()).toEqual(['Calculator', 'WebSearch']); // 2 unique
      const webSearch = tools.filter((t) => t.name === 'WebSearch');
      expect(webSearch).toHaveLength(1); // shared name → ONE box
      // ad1→WebSearch, ad2→WebSearch, ad2→Calculator = 3 `uses`
      expect(edgesByStereo(r.model, 'uses')).toHaveLength(3);
      const intoWebSearch = Object.values(r.model.relationships).filter(
        (rel) => (rel as unknown as { target: { element: string } }).target.element === webSearch[0].id,
      );
      expect(intoWebSearch).toHaveLength(2); // two agents point at the one box
    });

    it('T-G3 — lineage: a grouped capability maps to a contributing BPMNTask', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId1, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const tool = byStereo(r.model, 'tool')[0];
      expect(r.elementMapping[tool.id]).toBe('T1');
    });
  });

  describe('16-FU3 — capability-heavy-agent warning (P2)', () => {
    // One agentic worker lane → one task → an Agent diagram with `n` tools.
    const makeBpmn = () =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 200 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Search',
            owner: 'L1',
            agentDiagramRef: 'ad1',
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const cap = (type: string, name: string, id: string) => ({
      id,
      type,
      name,
      owner: null,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
    });
    const agentModelWithTools = (n: number) =>
      ({
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 100, height: 100 },
        elements: Object.fromEntries(
          Array.from({ length: n }, (_, i) => {
            const e = cap('AgentTool', `Tool${i}`, `t${i}`);
            return [e.id, e];
          }),
        ),
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const grouped = { includeCapabilities: true } as const;
    const heavyWarnings = (m: { warnings: Array<{ kind: string }> }) =>
      m.warnings.filter((w) => w.kind === 'capability-heavy-agent');

    it('T-H1 — > threshold (11 tools) trips one capability-heavy-agent warning', () => {
      const byId = new Map([['ad1', agentModelWithTools(11)]]);
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const heavy = heavyWarnings(r);
      expect(heavy).toHaveLength(1);
      expect(heavy[0]).toMatchObject({ kind: 'capability-heavy-agent', laneId: 'L1', count: 11 });
      // D1 — nothing truncated: all 11 tool Components still emitted.
      expect(
        Object.values(r.model.elements).filter((e) => (e as { stereotype?: string }).stereotype === 'tool'),
      ).toHaveLength(11);
    });

    it('T-H2 — == threshold (10 tools) does NOT warn (boundary is strict >)', () => {
      const byId = new Map([['ad1', agentModelWithTools(10)]]);
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      expect(heavyWarnings(r)).toHaveLength(0);
    });

    it('T-H3 — plain mode (includeCapabilities off) never warns', () => {
      const byId = new Map([['ad1', agentModelWithTools(11)]]);
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId });
      if (!r.ok) throw new Error('expected ok');
      expect(heavyWarnings(r)).toHaveLength(0);
    });

    const zoneWarnings = (m: { warnings: Array<{ kind: string }> }) =>
      m.warnings.filter((w) => w.kind === 'capability-heavy-zone');

    it('T-H4 — > zone threshold (13 unique tools across agents) trips capability-heavy-zone', () => {
      // 7 + 6 = 13 distinct tool names, split 7/6 across two lanes so NO
      // single agent exceeds the per-agent threshold of 10 (the MH2 case).
      const adA = agentModelWithTools(7); // Tool0..Tool6
      const adB = {
        version: '3.0.0',
        type: 'AgentDiagram',
        size: { width: 100, height: 100 },
        elements: Object.fromEntries(
          Array.from({ length: 6 }, (_, i) => {
            const e = cap('AgentTool', `Other${i}`, `o${i}`);
            return [e.id, e];
          }),
        ),
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      } as unknown as UMLModel;
      const bpmn = {
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 400 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'A',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'a',
            owner: 'L1',
            agentDiagramRef: 'adA',
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
          L2: {
            id: 'L2',
            type: 'BPMNSwimlane',
            name: 'B',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 200, width: 380, height: 200 },
          },
          T2: {
            id: 'T2',
            type: 'BPMNTask',
            name: 'b',
            owner: 'L2',
            agentDiagramRef: 'adB',
            bounds: { x: 40, y: 220, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      } as unknown as UMLModel;
      const byId = new Map([
        ['adA', adA],
        ['adB', adB],
      ]);
      const r = bpmnModelToComponentModel(bpmn, { agentDiagramsById: byId, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      expect(heavyWarnings(r)).toHaveLength(0); // no single heavy agent (7, 6)
      const zone = zoneWarnings(r);
      expect(zone).toHaveLength(1);
      expect(zone[0]).toMatchObject({ kind: 'capability-heavy-zone', zone: 'Tools', count: 13 });
    });

    it('T-H5 — == zone threshold (12) does NOT warn (strict >)', () => {
      const byId = new Map([['ad1', agentModelWithTools(12)]]);
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      expect(zoneWarnings(r)).toHaveLength(0);
      // a single 12-tool agent DOES trip the per-agent warning — that's > 10
      expect(heavyWarnings(r)).toHaveLength(1);
    });

    it('T-H6 — grouped output is re-centered on the origin (scroll fix)', () => {
      const byId = new Map([['ad1', agentModelWithTools(12)]]); // tall Tools zone
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const bs = Object.values(r.model.elements).map(
        (e) => (e as unknown as { bounds: { x: number; y: number; width: number; height: number } }).bounds,
      );
      const minX = Math.min(...bs.map((b) => b.x));
      const maxX = Math.max(...bs.map((b) => b.x + b.width));
      const minY = Math.min(...bs.map((b) => b.y));
      const maxY = Math.max(...bs.map((b) => b.y + b.height));
      expect(Math.abs((minX + maxX) / 2)).toBeLessThanOrEqual(0.5);
      expect(Math.abs((minY + maxY) / 2)).toBeLessThanOrEqual(0.5);
    });
  });

  describe('16-FU4 — dangling agentDiagramRef warning (P3)', () => {
    // One agentic worker lane → one task. `taskRef` is the ref under test;
    // the agent map below only contains 'ad1', so any other ref dangles.
    const makeBpmn = (taskRef: string) =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 200 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Search',
            owner: 'L1',
            agentDiagramRef: taskRef,
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    // BPMN whose single task carries NO agentDiagramRef at all.
    const makeBpmnNoRef = () => {
      const m = makeBpmn('x') as unknown as { elements: Record<string, { agentDiagramRef?: string }> };
      delete m.elements.T1.agentDiagramRef;
      return m as unknown as UMLModel;
    };

    const agentModel = {
      version: '3.0.0',
      type: 'AgentDiagram',
      size: { width: 100, height: 100 },
      elements: {
        t1: {
          id: 't1',
          type: 'AgentTool',
          name: 'WebSearch',
          owner: null,
          bounds: { x: 0, y: 0, width: 1, height: 1 },
        },
      },
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    } as unknown as UMLModel;
    const byId = new Map([['ad1', agentModel]]);

    const danglingWarnings = (m: { warnings: Array<{ kind: string }> }) =>
      m.warnings.filter((w) => w.kind === 'dangling-agent-ref');
    const capStereos = (m: UMLModel) =>
      Object.values(m.elements)
        .map((e) => (e as unknown as { stereotype?: string }).stereotype)
        .filter((s) => s === 'tool' || s === 'skill');

    it('T-D1 — dangling ref in capability mode → one dangling-agent-ref warning, no caps', () => {
      const r = bpmnModelToComponentModel(makeBpmn('gone'), { agentDiagramsById: byId, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const dangling = danglingWarnings(r);
      expect(dangling).toHaveLength(1);
      expect(dangling[0]).toMatchObject({ kind: 'dangling-agent-ref', taskId: 'T1', taskName: 'Search' });
      // warn-only: still no capability Components (behaviour unchanged).
      expect(capStereos(r.model)).toHaveLength(0);
    });

    it('T-D2 — valid ref → no dangling-agent-ref warning', () => {
      const r = bpmnModelToComponentModel(makeBpmn('ad1'), { agentDiagramsById: byId, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(danglingWarnings(r)).toHaveLength(0);
      // (and the tool IS emitted — proves the valid path is untouched)
      expect(capStereos(r.model)).toHaveLength(1);
    });

    it('T-D3 — plain mode (includeCapabilities off) never warns, even with a dangling ref', () => {
      const r = bpmnModelToComponentModel(makeBpmn('gone'), { agentDiagramsById: byId });
      if (!r.ok) throw new Error('expected ok');
      expect(danglingWarnings(r)).toHaveLength(0);
    });

    it('T-D4 — task with no agentDiagramRef is not "dangling" (no warning)', () => {
      const r = bpmnModelToComponentModel(makeBpmnNoRef(), { agentDiagramsById: byId, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(danglingWarnings(r)).toHaveLength(0);
    });
  });

  describe('06-v2 — element-mapping output', () => {
    it('maps derived Subsystem → source Pool, Component → source Lane, ComponentDependency → source BPMNFlow', () => {
      const r = bpmnModelToComponentModel(minimalAgentic as unknown as UMLModel);
      if (!r.ok) throw new Error('expected ok');

      // Pull source ids from the fixture.
      const sourcePoolId = Object.values((minimalAgentic as unknown as UMLModel).elements).find(
        (e) => e.type === 'BPMNPool',
      )?.id;
      const sourceLaneIds = Object.values((minimalAgentic as unknown as UMLModel).elements)
        .filter((e) => e.type === 'BPMNSwimlane')
        .map((e) => e.id);
      const sourceFlowId = Object.values((minimalAgentic as unknown as UMLModel).relationships).find(
        (rel) => rel.type === 'BPMNFlow' && (rel as unknown as { flowType?: string }).flowType === 'sequence',
      )?.id;
      expect(sourcePoolId).toBeDefined();
      expect(sourceLaneIds.length).toBeGreaterThan(0);
      expect(sourceFlowId).toBeDefined();

      // The Subsystem points at the Pool.
      const subsystem = Object.values(r.model.elements).find((e) => e.type === 'Subsystem');
      expect(subsystem).toBeDefined();
      expect(r.elementMapping[subsystem!.id]).toBe(sourcePoolId);

      // Each lane-derived Component points at its source Lane.
      const components = Object.values(r.model.elements).filter((e) => e.type === 'Component');
      const mappedLaneIds = components.map((c) => r.elementMapping[c.id]).filter(Boolean);
      for (const mid of mappedLaneIds) {
        expect(sourceLaneIds).toContain(mid);
      }

      // The emitted ComponentDependency points at the source BPMNFlow.
      const dep = Object.values(r.model.relationships).find((rel) => rel.type === 'ComponentDependency');
      expect(dep).toBeDefined();
      expect(r.elementMapping[dep!.id]).toBe(sourceFlowId);
    });
  });

  describe('32 — LLM/DB/RAG resources as capability Components', () => {
    const makeBpmn = (taskRef = 'res1') =>
      ({
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 400, height: 200 },
          },
          L1: {
            id: 'L1',
            type: 'BPMNSwimlane',
            name: 'Researcher',
            owner: 'P1',
            isAgentic: true,
            role: 'solution',
            bounds: { x: 20, y: 0, width: 380, height: 200 },
          },
          T1: {
            id: 'T1',
            type: 'BPMNTask',
            name: 'Answer',
            owner: 'L1',
            agentDiagramRef: taskRef,
            bounds: { x: 40, y: 20, width: 100, height: 60 },
          },
        },
        relationships: {},
        interactive: { elements: {}, relationships: {} },
        assessments: {},
      }) as unknown as UMLModel;

    const b = (id: string, replyType: string, extra: Record<string, unknown> = {}, type = 'AgentStateBody') => ({
      id,
      type,
      name: '',
      owner: 'st',
      replyType,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      ...extra,
    });

    const resourceAgent = {
      version: '3.0.0',
      type: 'AgentDiagram',
      size: { width: 100, height: 100 },
      elements: {
        st: { id: 'st', type: 'AgentState', name: 'Answer', owner: null, bounds: { x: 0, y: 0, width: 1, height: 1 } },
        b1: b('b1', 'llm'),
        b2: b('b2', 'llm'), // dup → one shared LLM (peer-name resolution)
        b3: b('b3', 'rag', { ragDatabaseName: 'kb' }),
        b4: b('b4', 'db_reply', { dbCustomName: 'orders' }),
        b5: b('b5', 'text'), // plain reply → ignored
        b6: b('b6', 'code'), // Python → ignored (deferred)
        fb: b('fb', 'rag', { ragDatabaseName: 'kb' }, 'AgentStateFallbackBody'), // fallback body, duplicate kb resource deduped
      },
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {},
    } as unknown as UMLModel;
    const agentDiagramsById = new Map([['res1', resourceAgent]]);

    const byStereo = (m: UMLModel, s: string) =>
      Object.values(m.elements).filter((e) => (e as unknown as { stereotype?: string }).stereotype === s);

    it('T-U6 — derives one llm + one db + one rag Component; text & code ignored', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(byStereo(r.model, 'llm')).toHaveLength(1);
      expect(byStereo(r.model, 'llm')[0].name).toBe('LLM');
      expect(byStereo(r.model, 'rag')).toHaveLength(1);
      expect(byStereo(r.model, 'rag')[0].name).toBe('kb');
      expect(byStereo(r.model, 'db')).toHaveLength(1);
      expect(byStereo(r.model, 'db')[0].name).toBe('orders');
      // text + code never become Components
      expect(byStereo(r.model, 'text')).toHaveLength(0);
      expect(byStereo(r.model, 'code')).toHaveLength(0);
    });

    it('T-U7 — all resource edges are `uses`', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const uses = Object.values(r.model.relationships).filter(
        (rel) => (rel as unknown as { stereotype?: string }).stereotype === 'uses',
      );
      expect(uses).toHaveLength(3); // llm, rag, db
      expect(
        Object.values(r.model.relationships).some(
          (rel) => (rel as unknown as { stereotype?: string }).stereotype === 'has',
        ),
      ).toBe(false);
    });

    it('T-U8 — resource zones sit to the LEFT of the agent Component (DQ-4)', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const agent = byStereo(r.model, 'solution')[0];
      const xOf = (s: string) => (byStereo(r.model, s)[0].bounds as { x: number }).x;
      // recenter shifts everything by one delta, so relative order is preserved
      expect(xOf('llm')).toBeLessThan((agent.bounds as { x: number }).x);
      expect(xOf('rag')).toBeLessThan((agent.bounds as { x: number }).x);
      expect(xOf('db')).toBeLessThan((agent.bounds as { x: number }).x);
    });

    it('T-U9 — resource Component lineage maps to the linking BPMNTask', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const llm = byStereo(r.model, 'llm')[0];
      expect(r.elementMapping[llm.id]).toBe('T1');
    });

    it('T-U10 — default (no opts): no resource Components (clean swarm)', () => {
      const r = bpmnModelToComponentModel(makeBpmn());
      if (!r.ok) throw new Error('expected ok');
      expect(byStereo(r.model, 'llm')).toHaveLength(0);
      expect(byStereo(r.model, 'rag')).toHaveLength(0);
      expect(byStereo(r.model, 'db')).toHaveLength(0);
    });

    // FU1 — the agent can be linked at the LANE level (popup "Define agent
    // behavior" on the lane), not only per-task. A lane-level link must still
    // surface the agent's resources, with lineage to the LANE.
    const makeLaneLinkedBpmn = () => {
      const m = makeBpmn() as unknown as { elements: Record<string, Record<string, unknown>> };
      m.elements.L1.agentDiagramRef = 'res1'; // link at the lane
      delete m.elements.T1.agentDiagramRef; // … and NOT at the task
      return m as unknown as UMLModel;
    };

    it('T-U11 — a LANE-level agent link surfaces resources, lineage → lane', () => {
      const r = bpmnModelToComponentModel(makeLaneLinkedBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(byStereo(r.model, 'llm')).toHaveLength(1);
      expect(byStereo(r.model, 'rag')).toHaveLength(1);
      expect(byStereo(r.model, 'db')).toHaveLength(1);
      // lineage of a lane-level resource maps to the LANE, not a task
      expect(r.elementMapping[byStereo(r.model, 'llm')[0].id]).toBe('L1');
    });
  });

  describe('33 (6b-1) — agentModelRef threading (BPMN→Component)', () => {
    it('stamps agentModelRef on the lane-Component from lane.agentDiagramRef', () => {
      const bpmn = {
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 600, height: 200 },
          },
          L1: {
            id: 'L1',
            name: 'Researcher',
            type: 'BPMNSwimlane',
            owner: 'P1',
            bounds: { x: 0, y: 0, width: 600, height: 100 },
            isAgentic: true,
            agentDiagramRef: 'agent-uuid-123',
          },
        },
        interactive: { elements: {}, relationships: {} },
        relationships: {},
        assessments: {},
      } as unknown as UMLModel;

      const r = bpmnModelToComponentModel(bpmn);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const comp = Object.values(r.model.elements).find(
        (e) => e.type === 'Component' && e.name === 'Researcher',
      ) as unknown as { agentModelRef?: string };
      expect(comp).toBeDefined();
      expect(comp.agentModelRef).toBe('agent-uuid-123');
    });

    it('omits agentModelRef when the lane has no agentDiagramRef', () => {
      const bpmn = {
        version: '3.0.0',
        type: 'BPMNDiagram',
        size: { width: 800, height: 600 },
        elements: {
          P1: {
            id: 'P1',
            type: 'BPMNPool',
            name: 'Swarm',
            owner: null,
            bounds: { x: 0, y: 0, width: 600, height: 200 },
          },
          L1: {
            id: 'L1',
            name: 'Researcher',
            type: 'BPMNSwimlane',
            owner: 'P1',
            bounds: { x: 0, y: 0, width: 600, height: 100 },
            isAgentic: true,
          },
        },
        interactive: { elements: {}, relationships: {} },
        relationships: {},
        assessments: {},
      } as unknown as UMLModel;

      const r = bpmnModelToComponentModel(bpmn);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const comp = Object.values(r.model.elements).find(
        (e) => e.type === 'Component' && e.name === 'Researcher',
      ) as unknown as { agentModelRef?: string };
      expect(comp).toBeDefined();
      expect(comp.agentModelRef).toBeUndefined();
    });
  });

  describe('resolveEdgeKind — profile vocabulary and compatibility', () => {
    const lane = (role: string): UMLElement =>
      ({ id: role, type: 'BPMNSwimlane', isAgentic: true, role }) as unknown as UMLElement;

    it('supervision → solution ⟹ supervises (old manager → worker)', () => {
      expect(resolveEdgeKind(lane('supervision'), lane('solution'), undefined)).toBe('supervises');
    });
    it('solution → supervision ⟹ revises (old worker → manager)', () => {
      expect(resolveEdgeKind(lane('solution'), lane('supervision'), undefined)).toBe('revises');
    });
    it('non-agentic endpoint ⟹ delegates (fallback)', () => {
      const plain = { id: 'x', type: 'BPMNSwimlane', isAgentic: false, role: 'solution' } as unknown as UMLElement;
      expect(resolveEdgeKind(plain, lane('supervision'), undefined)).toBe('delegates');
    });
  });
  describe('two-profile lane roles', () => {
    const lane = (role: string) => ({ id: role, type: 'BPMNSwimlane', isAgentic: true, role }) as unknown as UMLElement;

    it('maps supervision and solution pairs to the intended Component relationships', () => {
      expect(resolveEdgeKind(lane('supervision'), lane('solution'), undefined)).toBe('supervises');
      expect(resolveEdgeKind(lane('solution'), lane('supervision'), undefined)).toBe('revises');
      expect(resolveEdgeKind(lane('solution'), lane('solution'), undefined)).toBe('collaborates');
    });

    it('derives supervision to the Component supervision stereotype', () => {
      const model = JSON.parse(JSON.stringify(minimalAgentic));
      const lane = Object.values(model.elements).find(
        (element: unknown) => (element as { type?: string }).type === 'BPMNSwimlane',
      ) as { role?: string };
      lane.role = 'supervision';
      const result = bpmnModelToComponentModel(model as UMLModel);
      if (!result.ok) throw new Error('expected component derivation');
      const stereotypes = Object.values(result.model.elements)
        .filter((element) => element.type === 'Component')
        .map((element) => (element as unknown as { stereotype?: string }).stereotype);
      expect(stereotypes).toContain('supervision');
    });
  });
});
