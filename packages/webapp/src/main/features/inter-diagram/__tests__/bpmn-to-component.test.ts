import { describe, it, expect } from 'vitest';
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';
import { bpmnModelToComponentModel, resolveBodyLlmName, resolveEdgeKind } from '../bpmn-to-component';
import { absBox, field, makeModel, makeNode, nameOf, nodeById, nodesOfType } from './v4-helpers';
import flatNoPools from './fixtures/flat-no-pools.json';
import singlePoolNoLanes from './fixtures/single-pool-no-lanes.json';
import minimalAgentic from './fixtures/minimal-agentic.json';
import gatewayRouted from './fixtures/gateway-routed.json';
import multiPoolMessage from './fixtures/multi-pool-message.json';
import divergeMerge from './fixtures/diverge-merge.json';
import poolMessage from './fixtures/pool-message.json';

const fixture = (f: unknown): UMLModel => structuredClone(f) as UMLModel;

const stereoOf = (x: BesserNode | BesserEdge | undefined): string | undefined => field<string | undefined>(x, 'stereotype');
const components = (m: UMLModel): BesserNode[] => nodesOfType(m, 'component');
const subsystems = (m: UMLModel): BesserNode[] => nodesOfType(m, 'componentSubsystem');
const byStereo = (m: UMLModel, s: string): BesserNode[] => m.nodes.filter((n) => stereoOf(n) === s);
const edgesByStereo = (m: UMLModel, s: string): BesserEdge[] => m.edges.filter((e) => stereoOf(e) === s);

// ── v4 BPMN / Agent builders (positions are parent-relative) ──
const pool = (id: string, name: string, width = 400, height = 200): BesserNode =>
  makeNode(id, 'bpmnPool', { name }, { x: 0, y: 0, width, height });
const lane = (id: string, parentId: string, data: Record<string, unknown>, y = 0, width = 380, height = 200): BesserNode =>
  makeNode(id, 'bpmnSwimlane', data, { x: 20, y, width, height }, parentId);
const task = (id: string, parentId: string, data: Record<string, unknown>): BesserNode =>
  makeNode(id, 'bpmnTask', data, { x: 20, y: 20, width: 100, height: 60 }, parentId);
const bpmnModel = (...nodes: BesserNode[]): UMLModel => makeModel('BPMNDiagram', nodes);
const agentDiagram = (nodes: BesserNode[], extra: Partial<UMLModel> = {}): UMLModel =>
  makeModel('AgentDiagram', nodes, [], extra);
const cap = (type: string, name: string, id: string): BesserNode => makeNode(id, type, { name }, { x: 0, y: 0, width: 1, height: 1 });

describe('Inter-diagram — bpmnModelToComponentModel', () => {
  describe('refusals', () => {
    it('refuses with `no-pools` on a flat BPMN', () => {
      const r = bpmnModelToComponentModel(fixture(flatNoPools));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('no-pools');
    });

    it('refuses with `no-lanes-in-any-pool` when a pool has no lanes', () => {
      const r = bpmnModelToComponentModel(fixture(singlePoolNoLanes));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('no-lanes-in-any-pool');
    });

    it('refuses on a non-BPMN model', () => {
      const r = bpmnModelToComponentModel(makeModel('ClassDiagram'));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-a-bpmn-diagram');
    });
  });

  describe('minimal-agentic — manager → worker', () => {
    const r = bpmnModelToComponentModel(fixture(minimalAgentic));
    it('produces a ComponentDiagram model', () => {
      expect(r.ok).toBe(true);
      if (r.ok) {
        expect(r.model.type).toBe('ComponentDiagram');
      }
    });
    it('emits 1 Subsystem + 2 agent-Components (no skills, no has edges)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystems(r.model)).toHaveLength(1);
      const comps = components(r.model);
      expect(comps).toHaveLength(2);
      // the lane-role mapping: lane role flows to Component stereotype
      expect(comps.filter((c) => stereoOf(c) === 'solution')).toHaveLength(1);
      expect(comps.filter((c) => stereoOf(c) === 'supervision')).toHaveLength(1);
    });
    it('emits exactly 1 `supervises` edge (manager → worker, T1d; no `has` edges)', () => {
      if (!r.ok) throw new Error('expected ok');
      const stereotypes = r.model.edges.map((e) => stereoOf(e)).sort();
      expect(stereotypes).toEqual(['supervises']);
    });
  });

  describe('gateway-routed — manager → leader-driven merging gateway → 2 workers', () => {
    const r = bpmnModelToComponentModel(fixture(gatewayRouted));
    it('emits 2 `supervises` edges (one per worker)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(edgesByStereo(r.model, 'supervises')).toHaveLength(2);
    });
  });

  describe('multi-pool-message — message flow to a non-agentic pool is dropped', () => {
    const r = bpmnModelToComponentModel(fixture(multiPoolMessage));
    it('drops the non-agentic Pool B entirely (no Subsystem, no external Component)', () => {
      if (!r.ok) throw new Error('expected ok');
      // A Subsystem is emitted only for a pool
      // with an agentic lane — never via a message flow. Pool B's only lane is
      // non-agentic, so it disappears; only SwarmA + its Coordinator remain.
      const subs = subsystems(r.model);
      expect(subs).toHaveLength(1);
      expect(nameOf(subs[0])).toBe('SwarmA');
      const externalComps = components(r.model).filter((c) => stereoOf(c) === 'external');
      expect(externalComps).toHaveLength(0);
    });
    it('drops the message flow that targeted the non-agentic pool', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(edgesByStereo(r.model, 'delegates')).toHaveLength(0);
    });
    it('only warns about the tasks of the dropped non-agentic lane', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings.every((w) => w.kind === 'dropped-task-in-non-agentic-lane')).toBe(true);
    });

    it('drops a POOL-targeted message flow too (real-editor case: flow attaches to the pool, not the lane)', () => {
      // BPMN message flows commonly attach pool-to-pool, so the endpoint
      // resolves to the pool (not a lane). A pool with lanes but no agentic
      // lane must still NOT be synthesised as a Subsystem.
      const model = fixture(multiPoolMessage);
      model.edges.find((e) => e.id === 'msg-flow')!.target = 'pool-b';
      const r2 = bpmnModelToComponentModel(model);
      if (!r2.ok) throw new Error('expected ok');
      const subs = subsystems(r2.model);
      expect(subs).toHaveLength(1);
      expect(nameOf(subs[0])).toBe('SwarmA');
      expect(edgesByStereo(r2.model, 'delegates')).toHaveLength(0);
    });
  });

  describe('edge de-duplication', () => {
    it('two parallel manager→worker flows collapse to one `supervises` edge', () => {
      const model = fixture(minimalAgentic);
      const existingFlow = model.edges.find((e) => e.type === 'BPMNSequenceFlow');
      if (!existingFlow) throw new Error('fixture should contain a sequence flow');
      model.edges.push({ ...existingFlow, id: `${existingFlow.id}-dup` });

      const r = bpmnModelToComponentModel(model);
      if (!r.ok) throw new Error('expected ok');
      expect(edgesByStereo(r.model, 'supervises')).toHaveLength(1);
    });
  });

  describe('diverge-then-merge — surfaces supervises + revises + delegates', () => {
    const r = bpmnModelToComponentModel(fixture(divergeMerge));

    it('produces a ComponentDiagram with 1 Subsystem + 2 Components (non-agentic lane skipped)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystems(r.model)).toHaveLength(1);
      expect(components(r.model)).toHaveLength(2);
    });

    it('maps lane roles to Component stereotypes and skips the non-agentic lane', () => {
      if (!r.ok) throw new Error('expected ok');
      const comps = components(r.model)
        .map((c) => stereoOf(c))
        .sort();
      // lane-mgr → supervision, lane-wkr → solution (the lane-role mapping)
      expect(comps).toEqual(['solution', 'supervision']);
    });

    it('emits one revises + one supervises edge (the delegate-to-Maintainer is gone)', () => {
      if (!r.ok) throw new Error('expected ok');
      const stereotypes = r.model.edges.map((e) => stereoOf(e)).sort();
      expect(stereotypes).toEqual(['revises', 'supervises']);
    });

    it('derives no Component from the non-agentic Maintainer lane', () => {
      if (!r.ok) throw new Error('expected ok');
      const comps = components(r.model);
      const AGENTIC_STEREOS = new Set(['solution', 'supervision']);
      expect(comps.every((c) => AGENTIC_STEREOS.has(stereoOf(c) ?? ''))).toBe(true);
      expect(comps.some((c) => nameOf(c) === 'Maintainer')).toBe(false);
    });
  });

  describe('processModelRefs auto-derive (agentic Component → BPMN diagram)', () => {
    it('T-P1 stamps processModelRefs on agentic Components when sourceDiagramId is passed', () => {
      const r = bpmnModelToComponentModel(fixture(minimalAgentic), {
        sourceDiagramId: 'bpmn-42',
      });
      if (!r.ok) throw new Error('expected ok');
      const agents = components(r.model).filter((c) => stereoOf(c) === 'solution');
      expect(agents.length).toBeGreaterThan(0);
      for (const a of agents) {
        expect(field(a, 'processModelRefs')).toEqual(['bpmn-42']);
      }
    });

    it('T-P2 skips non-agentic lanes; every emitted Component is a stamped agent', () => {
      const r = bpmnModelToComponentModel(fixture(divergeMerge), {
        sourceDiagramId: 'bpmn-42',
      });
      if (!r.ok) throw new Error('expected ok');
      const comps = components(r.model);
      // Only agentic lanes become Components.
      // The lane-role mapping uses the two agentic profile stereotypes.
      const AGENTIC_STEREOS = new Set(['solution', 'supervision']);
      const nonAgentic = comps.filter((c) => !AGENTIC_STEREOS.has(stereoOf(c) ?? ''));
      expect(nonAgentic).toHaveLength(0);
      expect(comps.length).toBeGreaterThan(0);
      for (const a of comps) {
        expect(field(a, 'processModelRefs')).toEqual(['bpmn-42']);
      }
    });

    it('T-P3 emits no processModelRefs without sourceDiagramId (back-compat)', () => {
      const r = bpmnModelToComponentModel(fixture(minimalAgentic));
      if (!r.ok) throw new Error('expected ok');
      for (const n of r.model.nodes) {
        expect(field(n, 'processModelRefs')).toBeUndefined();
      }
    });
  });

  describe('pool-connected message flows target the Subsystem', () => {
    const r = bpmnModelToComponentModel(fixture(poolMessage));

    it('emits 3 Subsystems incl. a synthesised external for the laneless pool', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = subsystems(r.model);
      expect(subs).toHaveLength(3);
      expect(subs.map((s) => nameOf(s)).sort()).toEqual(['LegacySystem', 'SwarmA', 'SwarmB']);
    });

    it('does NOT emit any external-stereotyped Component (pools are Subsystems)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(components(r.model).filter((c) => stereoOf(c) === 'external')).toHaveLength(0);
    });

    it('routes a pool→pool message flow as Subsystem → Subsystem', () => {
      if (!r.ok) throw new Error('expected ok');
      const edge = r.model.edges.find((e) => r.elementMapping[e.id] === 'mf-1');
      expect(edge).toBeDefined();
      const src = nodeById(r.model, edge!.source)!;
      const tgt = nodeById(r.model, edge!.target)!;
      expect(src.type).toBe('componentSubsystem');
      expect(tgt.type).toBe('componentSubsystem');
      expect(stereoOf(edge)).toBe('delegates');
    });

    it('routes a lane→black-box-pool message flow as Component → Subsystem', () => {
      if (!r.ok) throw new Error('expected ok');
      const edge = r.model.edges.find((e) => r.elementMapping[e.id] === 'mf-2');
      expect(edge).toBeDefined();
      const src = nodeById(r.model, edge!.source)!;
      const tgt = nodeById(r.model, edge!.target)!;
      expect(src.type).toBe('component');
      expect(tgt.type).toBe('componentSubsystem');
      expect(nameOf(tgt)).toBe('LegacySystem');
    });
  });

  describe('message-flow de-duplication', () => {
    it('collapses several message flows between the same endpoints into one dependency', () => {
      const model = fixture(poolMessage);
      const original = model.edges.find((e) => e.id === 'mf-1')!;
      model.edges.push({ ...original, id: 'mf-1-again' });
      const r = bpmnModelToComponentModel(model);
      if (!r.ok) throw new Error('expected ok');
      const edges = r.model.edges.filter(
        (e) => r.elementMapping[e.id] === 'mf-1' || r.elementMapping[e.id] === 'mf-1-again',
      );
      expect(edges).toHaveLength(1);
    });
  });

  describe('Subsystem sizing', () => {
    it('grows a pool Subsystem so all of its lane Components fit inside', () => {
      const model = fixture(minimalAgentic);
      const firstLane = model.nodes.find((n) => n.type === 'bpmnSwimlane')!;
      for (let i = 0; i < 6; i++) {
        model.nodes.push({ ...firstLane, id: `extra-${i}`, data: { ...firstLane.data, name: `Agent ${i}` } });
      }
      const r = bpmnModelToComponentModel(model);
      if (!r.ok) throw new Error('expected ok');
      const subsystem = subsystems(r.model)[0];
      const comps = components(r.model);
      expect(comps.length).toBeGreaterThanOrEqual(7);
      const sub = absBox(r.model, subsystem);
      expect(sub.width).toBeGreaterThan(640);
      for (const c of comps) {
        const b = absBox(r.model, c);
        expect(b.x + b.width).toBeLessThanOrEqual(sub.x + sub.width);
      }
    });
  });

  describe('tools/skills as capability Components (opt-in)', () => {
    // A self-contained BPMN: one agentic worker lane with a task linking
    // an Agent diagram. The derivation matches `type: 'AgentTool'` by
    // string, so this exercises the full path without the editor element.
    const makeBpmn = (laneOverrides: Record<string, unknown> = {}, taskRef = 'ad1') =>
      bpmnModel(
        pool('P1', 'Swarm'),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution', ...laneOverrides }),
        task('T1', 'L1', { name: 'Search', agentDiagramRef: taskRef }),
      );

    const agentModel = agentDiagram([
      cap('AgentTool', 'WebSearch', 'tlA'),
      cap('AgentTool', 'WebSearch', 'tlB'), // dup name
      cap('AgentSkill', 'Summarise', 'skA'),
    ]);
    const agentDiagramsById = new Map([['ad1', agentModel]]);

    const capStereos = (m: UMLModel) =>
      m.nodes.map((n) => stereoOf(n)).filter((s) => s === 'tool' || s === 'skill');

    it('T-U1 — default (no opts): emits no tool/skill Components (clean swarm)', () => {
      const r = bpmnModelToComponentModel(makeBpmn());
      if (!r.ok) throw new Error('expected ok');
      expect(capStereos(r.model)).toHaveLength(0);
    });

    it('T-U2 — opt-in: one `tool` (deduped) + one `skill`, with `uses` and `has` edges', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const tools = byStereo(r.model, 'tool');
      const skills = byStereo(r.model, 'skill');
      expect(tools).toHaveLength(1); // WebSearch deduped (tool deduplication)
      expect(nameOf(tools[0])).toBe('WebSearch');
      expect(skills).toHaveLength(1);
      expect(nameOf(skills[0])).toBe('Summarise');
      const edgeStereos = r.model.edges
        .map((e) => stereoOf(e))
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
      const tool = byStereo(r.model, 'tool')[0];
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

  describe('grouped capability mode (Skills / Tools zones)', () => {
    // Single agentic lane → ad1 (tools WebSearch ×2 dup, skill Summarise).
    const makeBpmn = () =>
      bpmnModel(
        pool('P1', 'Swarm'),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'Search', agentDiagramRef: 'ad1' }),
      );

    // Two agentic lanes → ad1 + ad2; both list a tool named "WebSearch".
    const makeTwoAgentBpmn = () =>
      bpmnModel(
        pool('P1', 'Swarm', 400, 400),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'Search', agentDiagramRef: 'ad1' }),
        lane('L2', 'P1', { name: 'Analyst', isAgentic: true, role: 'solution' }, 200),
        task('T2', 'L2', { name: 'Analyse', agentDiagramRef: 'ad2' }),
      );

    const ad1 = agentDiagram([
      cap('AgentTool', 'WebSearch', 't1a'),
      cap('AgentTool', 'WebSearch', 't1b'),
      cap('AgentSkill', 'Summarise', 's1'),
    ]);
    const ad2 = agentDiagram([cap('AgentTool', 'WebSearch', 't2a'), cap('AgentTool', 'Calculator', 't2b')]);
    const byId1 = new Map([['ad1', ad1]]);
    const byId2 = new Map([
      ['ad1', ad1],
      ['ad2', ad2],
    ]);
    const grouped = { includeCapabilities: true } as const;

    const subsystemsNamed = (m: UMLModel) => subsystems(m).map((s) => nameOf(s));

    it('T-G1 — emits named Skills + Tools Subsystems holding the capabilities', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId1, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemsNamed(r.model).sort()).toEqual(['Skills', 'Swarm', 'Tools']);
      expect(byStereo(r.model, 'tool')).toHaveLength(1); // WebSearch (dup collapsed)
      expect(byStereo(r.model, 'skill')).toHaveLength(1); // Summarise
      // capability Components are owned by a zone Subsystem, not the swarm
      const tool = byStereo(r.model, 'tool')[0];
      const parent = nodeById(r.model, tool.parentId)!;
      expect(nameOf(parent)).toBe('Tools');
      expect(edgesByStereo(r.model, 'uses')).toHaveLength(1);
      expect(edgesByStereo(r.model, 'has')).toHaveLength(1);
    });

    it('T-G2 — cross-agent global dedup: shared tool = 1 Component, N edges (D1)', () => {
      const r = bpmnModelToComponentModel(makeTwoAgentBpmn(), { agentDiagramsById: byId2, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const tools = byStereo(r.model, 'tool');
      expect(tools.map((t) => nameOf(t)).sort()).toEqual(['Calculator', 'WebSearch']); // 2 unique
      const webSearch = tools.filter((t) => nameOf(t) === 'WebSearch');
      expect(webSearch).toHaveLength(1); // shared name → ONE box
      // ad1→WebSearch, ad2→WebSearch, ad2→Calculator = 3 `uses`
      expect(edgesByStereo(r.model, 'uses')).toHaveLength(3);
      const intoWebSearch = r.model.edges.filter((e) => e.target === webSearch[0].id);
      expect(intoWebSearch).toHaveLength(2); // two agents point at the one box
    });

    it('T-G3 — lineage: a grouped capability maps to a contributing BPMNTask', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById: byId1, ...grouped });
      if (!r.ok) throw new Error('expected ok');
      const tool = byStereo(r.model, 'tool')[0];
      expect(r.elementMapping[tool.id]).toBe('T1');
    });
  });

  describe('capability-heavy-agent warning', () => {
    // One agentic worker lane → one task → an Agent diagram with `n` tools.
    const makeBpmn = () =>
      bpmnModel(
        pool('P1', 'Swarm'),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'Search', agentDiagramRef: 'ad1' }),
      );

    const agentModelWithTools = (n: number) =>
      agentDiagram(Array.from({ length: n }, (_, i) => cap('AgentTool', `Tool${i}`, `t${i}`)));

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
      expect(byStereo(r.model, 'tool')).toHaveLength(11);
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
      const adB = agentDiagram(Array.from({ length: 6 }, (_, i) => cap('AgentTool', `Other${i}`, `o${i}`)));
      const bpmn = bpmnModel(
        pool('P1', 'Swarm', 400, 400),
        lane('L1', 'P1', { name: 'A', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'a', agentDiagramRef: 'adA' }),
        lane('L2', 'P1', { name: 'B', isAgentic: true, role: 'solution' }, 200),
        task('T2', 'L2', { name: 'b', agentDiagramRef: 'adB' }),
      );
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
      const bs = r.model.nodes.map((n) => absBox(r.model, n));
      const minX = Math.min(...bs.map((b) => b.x));
      const maxX = Math.max(...bs.map((b) => b.x + b.width));
      const minY = Math.min(...bs.map((b) => b.y));
      const maxY = Math.max(...bs.map((b) => b.y + b.height));
      expect(Math.abs((minX + maxX) / 2)).toBeLessThanOrEqual(0.5);
      expect(Math.abs((minY + maxY) / 2)).toBeLessThanOrEqual(0.5);
    });
  });

  describe('dangling agentDiagramRef warning', () => {
    // One agentic worker lane → one task. `taskRef` is the ref under test;
    // the agent map below only contains 'ad1', so any other ref dangles.
    const makeBpmn = (taskRef: string) =>
      bpmnModel(
        pool('P1', 'Swarm'),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'Search', agentDiagramRef: taskRef }),
      );

    // BPMN whose single task carries NO agentDiagramRef at all.
    const makeBpmnNoRef = () => {
      const m = makeBpmn('x');
      delete m.nodes.find((n) => n.id === 'T1')!.data.agentDiagramRef;
      return m;
    };

    const agentModel = agentDiagram([cap('AgentTool', 'WebSearch', 't1')]);
    const byId = new Map([['ad1', agentModel]]);

    const danglingWarnings = (m: { warnings: Array<{ kind: string }> }) =>
      m.warnings.filter((w) => w.kind === 'dangling-agent-ref');
    const capStereos = (m: UMLModel) =>
      m.nodes.map((n) => stereoOf(n)).filter((s) => s === 'tool' || s === 'skill');

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

  describe('element-mapping output', () => {
    it('maps derived Subsystem → source Pool, Component → source Lane, ComponentDependency → source BPMN flow', () => {
      const source = fixture(minimalAgentic);
      const r = bpmnModelToComponentModel(source);
      if (!r.ok) throw new Error('expected ok');

      // Pull source ids from the fixture.
      const sourcePoolId = source.nodes.find((n) => n.type === 'bpmnPool')?.id;
      const sourceLaneIds = nodesOfType(source, 'bpmnSwimlane').map((n) => n.id);
      const sourceFlowId = source.edges.find((e) => e.type === 'BPMNSequenceFlow')?.id;
      expect(sourcePoolId).toBeDefined();
      expect(sourceLaneIds.length).toBeGreaterThan(0);
      expect(sourceFlowId).toBeDefined();

      // The Subsystem points at the Pool.
      const subsystem = subsystems(r.model)[0];
      expect(subsystem).toBeDefined();
      expect(r.elementMapping[subsystem!.id]).toBe(sourcePoolId);

      // Each lane-derived Component points at its source Lane.
      const mappedLaneIds = components(r.model)
        .map((c) => r.elementMapping[c.id])
        .filter(Boolean);
      for (const mid of mappedLaneIds) {
        expect(sourceLaneIds).toContain(mid);
      }

      // The emitted ComponentDependency points at the source sequence flow.
      const dep = r.model.edges.find((e) => e.type === 'ComponentDependency');
      expect(dep).toBeDefined();
      expect(r.elementMapping[dep!.id]).toBe(sourceFlowId);
    });
  });

  describe('LLM/DB/RAG resources as capability Components', () => {
    const makeBpmn = (taskRef = 'res1') =>
      bpmnModel(
        pool('P1', 'Swarm'),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, role: 'solution' }),
        task('T1', 'L1', { name: 'Answer', agentDiagramRef: taskRef }),
      );

    const b = (id: string, replyType: string, extra: Record<string, unknown> = {}) => ({
      id,
      name: '',
      replyType,
      ...extra,
    });

    const resourceAgent = agentDiagram([
      makeNode('st', 'AgentState', {
        name: 'Answer',
        bodies: [
          b('b1', 'llm'),
          b('b2', 'llm'), // dup → one shared LLM (peer-name resolution)
          b('b3', 'rag', { ragDatabaseName: 'kb' }),
          b('b4', 'db_reply', { dbCustomName: 'orders' }),
          b('b5', 'text'), // plain reply → ignored
          b('b6', 'code'), // Python → ignored (deferred)
        ],
        // fallback body, duplicate kb resource deduped
        fallbackBodies: [b('fb', 'rag', { ragDatabaseName: 'kb' })],
      }),
    ]);
    const agentDiagramsById = new Map([['res1', resourceAgent]]);

    it('T-U6 — derives one llm + one db + one rag Component; text & code ignored', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(byStereo(r.model, 'llm')).toHaveLength(1);
      expect(nameOf(byStereo(r.model, 'llm')[0])).toBe('LLM');
      expect(byStereo(r.model, 'rag')).toHaveLength(1);
      expect(nameOf(byStereo(r.model, 'rag')[0])).toBe('kb');
      expect(byStereo(r.model, 'db')).toHaveLength(1);
      expect(nameOf(byStereo(r.model, 'db')[0])).toBe('orders');
      // text + code never become Components
      expect(byStereo(r.model, 'text')).toHaveLength(0);
      expect(byStereo(r.model, 'code')).toHaveLength(0);
    });

    it('T-U7 — all resource edges are `uses`', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      expect(edgesByStereo(r.model, 'uses')).toHaveLength(3); // llm, rag, db
      expect(r.model.edges.some((e) => stereoOf(e) === 'has')).toBe(false);
    });

    it('T-U8 — resource zones sit to the LEFT of the agent Component (DQ-4)', () => {
      const r = bpmnModelToComponentModel(makeBpmn(), { agentDiagramsById, includeCapabilities: true });
      if (!r.ok) throw new Error('expected ok');
      const agentX = absBox(r.model, byStereo(r.model, 'solution')[0]).x;
      const xOf = (s: string) => absBox(r.model, byStereo(r.model, s)[0]).x;
      // recenter shifts everything by one delta, so relative order is preserved
      expect(xOf('llm')).toBeLessThan(agentX);
      expect(xOf('rag')).toBeLessThan(agentX);
      expect(xOf('db')).toBeLessThan(agentX);
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
      const m = makeBpmn();
      m.nodes.find((n) => n.id === 'L1')!.data.agentDiagramRef = 'res1'; // link at the lane
      delete m.nodes.find((n) => n.id === 'T1')!.data.agentDiagramRef; // … and NOT at the task
      return m;
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

  describe('agentModelRef threading (BPMN→Component)', () => {
    it('stamps agentModelRef on the lane-Component from lane.agentDiagramRef', () => {
      const bpmn = bpmnModel(
        pool('P1', 'Swarm', 600, 200),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true, agentDiagramRef: 'agent-uuid-123' }, 0, 600, 100),
      );

      const r = bpmnModelToComponentModel(bpmn);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const comp = components(r.model).find((c) => nameOf(c) === 'Researcher');
      expect(comp).toBeDefined();
      expect(field(comp, 'agentModelRef')).toBe('agent-uuid-123');
    });

    it('omits agentModelRef when the lane has no agentDiagramRef', () => {
      const bpmn = bpmnModel(
        pool('P1', 'Swarm', 600, 200),
        lane('L1', 'P1', { name: 'Researcher', isAgentic: true }, 0, 600, 100),
      );

      const r = bpmnModelToComponentModel(bpmn);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const comp = components(r.model).find((c) => nameOf(c) === 'Researcher');
      expect(comp).toBeDefined();
      expect(field(comp, 'agentModelRef')).toBeUndefined();
    });
  });

  describe('configured Agent resources after the Components page move', () => {
    const linkedBpmn = () => {
      const model = fixture(minimalAgentic);
      model.nodes.find((n) => n.id === 'lane-worker')!.data.agentDiagramRef = 'agent-1';
      return model;
    };

    const component = (id: string, type: string, name: string) => ({ id, type, name, owner: null });
    const agentModel = agentDiagram([], {
      components: {
        tool: component('tool', 'AgentTool', 'Web search'),
        skill: component('skill', 'AgentSkill', 'Summarise'),
        llm: component('llm', 'AgentLLM', 'GPT model'),
        rag: component('rag', 'AgentRagElement', 'Knowledge base'),
        gui: component('gui', 'AgentGUI', 'Dashboard'),
        workspace: component('workspace', 'AgentWorkspace', 'Files'),
        unnamed: component('unnamed', 'AgentSkill', '  '),
      } as UMLModel['components'],
    });

    /** One AgentState carrying an LLM reply body with an empty llm_name. */
    const llmBodyState = () =>
      makeNode('state', 'AgentState', { name: 'S', bodies: [{ id: 'body', name: '', replyType: 'llm', llm_name: '' }] });

    it('derives named tools, skills, LLMs, RAGs and SQL databases with the existing edges and lane lineage', () => {
      const result = bpmnModelToComponentModel(linkedBpmn(), {
        agentDiagramsById: new Map([['agent-1', agentModel]]),
        sqlDatabasesByAgentId: new Map([['agent-1', [{ name: 'Orders' }, { name: '  ' }]]]),
        includeCapabilities: true,
      });
      if (!result.ok) throw new Error('expected ok');

      const resources = result.model.nodes.filter((n) => ['tool', 'skill', 'llm', 'rag', 'db'].includes(stereoOf(n) ?? ''));
      expect(resources.map((n) => [nameOf(n), stereoOf(n)]).sort()).toEqual([
        ['GPT model', 'llm'],
        ['Knowledge base', 'rag'],
        ['Orders', 'db'],
        ['Summarise', 'skill'],
        ['Web search', 'tool'],
      ]);
      for (const resource of resources) expect(result.elementMapping[resource.id]).toBe('lane-worker');
      expect(result.model.edges.map((e) => stereoOf(e)).sort()).toEqual([
        'has',
        'supervises',
        'uses',
        'uses',
        'uses',
        'uses',
      ]);
      expect(result.model.nodes.some((n) => nameOf(n) === 'Dashboard' || nameOf(n) === 'Files')).toBe(false);
    });

    it('keeps reply-body resources and deduplicates them against configured resources', () => {
      const model = structuredClone(agentModel);
      model.nodes = [llmBodyState()];
      model.components = { ...model.components, llm: component('llm', 'AgentLLM', 'gpt-6-luna') } as UMLModel['components'];
      const result = bpmnModelToComponentModel(linkedBpmn(), {
        agentDiagramsById: new Map([['agent-1', model]]),
        includeCapabilities: true,
      });
      if (!result.ok) throw new Error('expected ok');
      expect(byStereo(result.model, 'llm')).toHaveLength(1);
    });

    it('resolves explicit, valid-default, first-registered and unconfigured LLM names', () => {
      const model = structuredClone(agentModel);
      model.components = {
        ...model.components,
        other: component('other', 'AgentLLM', 'other-model'),
      } as UMLModel['components'];
      // A fallback-body row whose prompt text is not a model name.
      const body = {
        id: 'body',
        name: 'Prompt content is not a model name',
        llm_name: '',
      };
      const explicitBody = { ...body, llm_name: 'explicit-model' };

      expect(resolveBodyLlmName(model, body, 'other-model')).toBe('other-model');
      expect(resolveBodyLlmName(model, body, 'missing-model')).toBe('GPT model');
      expect(resolveBodyLlmName(model, body)).toBe('GPT model');
      expect(resolveBodyLlmName(model, explicitBody, 'other-model')).toBe('explicit-model');
      expect(resolveBodyLlmName({ ...model, components: {} } as UMLModel, body)).toBe('LLM');
    });

    it('shares one named LLM between two agents without adding generic LLM', () => {
      const bpmn = linkedBpmn();
      bpmn.nodes.find((n) => n.id === 'lane-manager')!.data.agentDiagramRef = 'agent-2';
      const model = structuredClone(agentModel);
      model.components = {
        ...model.components,
        llm: component('llm', 'AgentLLM', 'gpt-6-luna'),
      } as UMLModel['components'];
      model.nodes = [llmBodyState()];
      const result = bpmnModelToComponentModel(bpmn, {
        agentDiagramsById: new Map([
          ['agent-1', model],
          ['agent-2', structuredClone(model)],
        ]),
        defaultLlmNamesByAgentId: new Map([
          ['agent-1', 'gpt-6-luna'],
          ['agent-2', 'gpt-6-luna'],
        ]),
        includeCapabilities: true,
      });
      if (!result.ok) throw new Error('expected ok');

      const llms = byStereo(result.model, 'llm');
      expect(llms.map((n) => nameOf(n))).toEqual(['gpt-6-luna']);
      const uses = result.model.edges.filter((e) => e.target === llms[0].id && stereoOf(e) === 'uses');
      expect(uses).toHaveLength(2);
    });

    it('leaves room below two-line Subsystem titles', () => {
      const result = bpmnModelToComponentModel(linkedBpmn(), {
        agentDiagramsById: new Map([['agent-1', agentModel]]),
        includeCapabilities: true,
      });
      if (!result.ok) throw new Error('expected ok');
      for (const child of components(result.model)) {
        const parent = nodeById(result.model, child.parentId)!;
        expect(parent?.type).toBe('componentSubsystem');
        expect(absBox(result.model, child).y - absBox(result.model, parent).y).toBeGreaterThanOrEqual(50);
      }
    });

    it('uses HAS for skills and USES for tools, LLMs, RAGs, and databases', () => {
      const result = bpmnModelToComponentModel(linkedBpmn(), {
        agentDiagramsById: new Map([['agent-1', agentModel]]),
        sqlDatabasesByAgentId: new Map([['agent-1', [{ name: 'Orders' }]]]),
        includeCapabilities: true,
      });
      if (!result.ok) throw new Error('expected ok');
      const agent = result.model.nodes.find((n) => nameOf(n) === 'Worker')!;
      const expected: Record<string, string> = { skill: 'has', tool: 'uses', llm: 'uses', rag: 'uses', db: 'uses' };
      for (const [stereo, edgeStereo] of Object.entries(expected)) {
        const resource = byStereo(result.model, stereo)[0];
        const edge = result.model.edges.find((e) => e.source === agent.id && e.target === resource.id);
        expect(stereoOf(edge)).toBe(edgeStereo);
      }
    });
  });

  describe('resolveEdgeKind — profile vocabulary and compatibility', () => {
    const lane = (role: string, isAgentic = true) => ({ isAgentic, role });

    it('supervision → solution ⟹ supervises (old manager → worker)', () => {
      expect(resolveEdgeKind(lane('supervision'), lane('solution'))).toBe('supervises');
    });
    it('solution → supervision ⟹ revises (old worker → manager)', () => {
      expect(resolveEdgeKind(lane('solution'), lane('supervision'))).toBe('revises');
    });
    it('non-agentic endpoint ⟹ delegates (fallback)', () => {
      expect(resolveEdgeKind(lane('solution', false), lane('supervision'))).toBe('delegates');
    });
  });
  describe('two-profile lane roles', () => {
    const lane = (role: string, isAgentic = true) => ({ isAgentic, role });

    it('maps supervision and solution pairs to the intended Component relationships', () => {
      expect(resolveEdgeKind(lane('supervision'), lane('solution'))).toBe('supervises');
      expect(resolveEdgeKind(lane('solution'), lane('supervision'))).toBe('revises');
      expect(resolveEdgeKind(lane('solution'), lane('solution'))).toBe('collaborates');
    });

    it('derives supervision to the Component supervision stereotype', () => {
      const model = fixture(minimalAgentic);
      const firstLane = model.nodes.find((n) => n.type === 'bpmnSwimlane')!;
      firstLane.data.role = 'supervision';
      const result = bpmnModelToComponentModel(model);
      if (!result.ok) throw new Error('expected component derivation');
      const stereotypes = components(result.model).map((c) => stereoOf(c));
      expect(stereotypes).toContain('supervision');
    });
  });
});
