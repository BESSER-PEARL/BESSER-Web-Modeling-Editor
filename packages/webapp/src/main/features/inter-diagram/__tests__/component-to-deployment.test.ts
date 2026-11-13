import { describe, it, expect } from 'vitest';
import type { BesserNode, UMLModel } from '@besser/wme';
import { componentModelToDeploymentModel } from '../component-to-deployment';
import { bpmnModelToComponentModel } from '../bpmn-to-component';
import { makeEdge, makeModel, makeNode, nameOf, nodeById } from './v4-helpers';
import poolMessage from './fixtures/pool-message.json';

const V4_TYPE: Record<string, string> = { Component: 'component', Subsystem: 'componentSubsystem' };

function makeBaseModel(nodes: BesserNode[] = [], edges: UMLModel['edges'] = []): UMLModel {
  return makeModel('ComponentDiagram', nodes, edges);
}

/** A `component` / `componentSubsystem` node (`type` given by its UML name); position 0,0 relative to `parentId`. */
function el(
  id: string,
  type: 'Component' | 'Subsystem',
  name: string,
  parentId: string | null,
  stereotype?: string,
  extra: Record<string, unknown> = {},
): BesserNode {
  const headerFlag = type === 'Subsystem' ? 'isComponentSubsystemHeaderShown' : 'isComponentHeaderShown';
  return makeNode(
    id,
    V4_TYPE[type],
    {
      name,
      stereotype: stereotype ?? (type === 'Component' ? 'component' : 'subsystem'),
      [headerFlag]: true,
      ...extra,
    },
    { x: 0, y: 0, width: 100, height: 60 },
    parentId ?? undefined,
  );
}

function dep(id: string, srcId: string, tgtId: string, stereotype?: string) {
  return makeEdge(id, 'ComponentDependency', srcId, tgtId, stereotype ? { stereotype } : {});
}

// node-kind predicates. WME stores a deploymentNode's kind in `data.stereotype`.
type R = ReturnType<typeof componentModelToDeploymentModel>;
const nodesOfR = (r: R) => (r.ok ? r.model.nodes : []);
const edgesOfR = (r: R) => (r.ok ? r.model.edges : []);
const stereotypeOf = (x: { data: Record<string, unknown> }) => x.data.stereotype as string | undefined;
const nodesOf = (r: R, stereo: string) =>
  nodesOfR(r).filter((e) => e.type === 'deploymentNode' && stereotypeOf(e) === stereo);
const subsystemNodes = (r: R) => nodesOf(r, 'node'); // kept Subsystem (and bare placeholders)
const hostNodes = (r: R) => nodesOf(r, 'docker host');
const execEnvNodes = (r: R) => nodesOf(r, 'executionEnvironment');
const artifactsOf = (r: R) => nodesOfR(r).filter((e) => e.type === 'deploymentArtifact');
const componentsOf = (r: R) => nodesOfR(r).filter((e) => e.type === 'deploymentComponent');
const deploymentNodesOf = (r: R) => nodesOfR(r).filter((e) => e.type === 'deploymentNode');
const associationsOf = (r: R) => edgesOfR(r).filter((x) => x.type === 'DeploymentAssociation');
const manifestEdgesOf = (r: R) => edgesOfR(r).filter((x) => x.type === 'DeploymentDependency');

describe('Inter-diagram — componentModelToDeploymentModel', () => {
  describe('refusals', () => {
    it('refuses on a non-Component model', () => {
      const m = makeBaseModel();
      (m as unknown as { type: string }).type = 'BPMN';
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('not-a-component-diagram');
    });

    it('refuses on an empty Component diagram', () => {
      const r = componentModelToDeploymentModel(makeBaseModel());
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.reason).toBe('no-components');
    });
  });

  describe('minimal-2-subsystems-1-edge', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Order', null),
        s2: el('s2', 'Subsystem', 'Shipping', null),
        c1: el('c1', 'Component', 'OrderAgent', 's1', 'solution'),
        c2: el('c2', 'Component', 'ShippingAgent', 's2', 'solution'),
      }),
    );
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 'c1', 'c2', 'delegates'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('produces a DeploymentDiagram model', () => {
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.model.type).toBe('DeploymentDiagram');
    });
    it('emits 2 Subsystem nodes named Order/Shipping (38: + a Docker Host + an ExecEnv each)', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = subsystemNodes(r);
      expect(subs.map((n) => nameOf(n)).sort()).toEqual(['Order', 'Shipping']);
      expect(subs.find((n) => nameOf(n) === 'Default Host')).toBeUndefined();
      // One Docker Host per Subsystem, one ExecutionEnvironment per agent.
      expect(hostNodes(r)).toHaveLength(2);
      expect(execEnvNodes(r)).toHaveLength(2);
    });
    it('emits 2 DeploymentComponents, one per Node', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(2);
    });
    it('04-FU3 — emits 2 DeploymentComponents OUTSIDE the Nodes (no parent)', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(2);
      expect(dcs.every((d) => d.parentId === undefined)).toBe(true);
    });
    it('04-FU3 — emits 2 DeploymentArtifacts INSIDE the matching Nodes (parent = a Node)', () => {
      if (!r.ok) throw new Error('expected ok');
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(2);
      const nodeIds = new Set(deploymentNodesOf(r).map((n) => n.id));
      expect(artifacts.every((a) => nodeIds.has(a.parentId ?? ''))).toBe(true);
    });
    it('04-FU3 — emits 1 structural DeploymentAssociation cross-Node', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = associationsOf(r);
      expect(structural).toHaveLength(1);
    });
    it('04-FU3 — emits 2 DeploymentDependencies (manifest, dashed) — no stereotype label', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifests = manifestEdgesOf(r);
      expect(manifests).toHaveLength(2);
      expect(manifests.every((m) => stereotypeOf(m) === undefined)).toBe(true);
    });
    it('04-FU3 — each manifest edge runs Artifact (source) → Component (target)', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifests = manifestEdgesOf(r);
      const artifactIds = new Set(artifactsOf(r).map((a) => a.id));
      const componentIds = new Set(componentsOf(r).map((c) => c.id));
      for (const m of manifests) {
        expect(artifactIds.has(m.source)).toBe(true);
        expect(componentIds.has(m.target)).toBe(true);
      }
    });
    it('emits no warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([]);
    });
  });

  describe('27/38 — swarm multiplicity stamps [N] on the Artifact inside its ExecEnv', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Coding', null),
        c1: el('c1', 'Component', 'Coder', 's1', 'solution'), // ×3 swarm
        c2: el('c2', 'Component', 'Reviewer', 's1', 'supervision'), // ×1
      }),
    );

    it('emits one ExecEnv per agent (plain name); Artifact name carries [N] for the swarm', () => {
      const r = componentModelToDeploymentModel(m, { c1: 3 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        execEnvNodes(r)
          .map((n) => nameOf(n))
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
      expect(
        artifactsOf(r)
          .map((a) => nameOf(a))
          .sort(),
      ).toEqual(['Coder [3]', 'Reviewer']);
    });

    it('DeploymentComponent name stays count-free (logical projection, no [N])', () => {
      const r = componentModelToDeploymentModel(m, { c1: 3 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        componentsOf(r)
          .map((c) => nameOf(c))
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
    });

    it('[N] suffix only when N>1; N==1 / absent map → plain Artifact name', () => {
      const r = componentModelToDeploymentModel(m, { c1: 1 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        artifactsOf(r)
          .map((a) => nameOf(a))
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
    });

    it('is a no-op with no map argument (back-compat)', () => {
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');
      expect(artifactsOf(r).every((a) => !/\[\d+\]/.test(nameOf(a)))).toBe(true);
    });
  });

  describe('flat-scaffold — no Subsystems', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        c1: el('c1', 'Component', 'A', null),
        c2: el('c2', 'Component', 'B', null),
        c3: el('c3', 'Component', 'C', null),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('38 — emits 1 top-level Docker Host (no Subsystem) wrapping 3 ExecEnvs', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(0);
      const hosts = hostNodes(r);
      expect(hosts).toHaveLength(1);
      expect(nameOf(hosts[0])).toBe('Docker Host');
      expect(hosts[0].parentId).toBeUndefined();
      const ee = execEnvNodes(r);
      expect(ee).toHaveLength(3);
      // Each ExecEnv is owned by the Docker Host; each Artifact by its ExecEnv.
      expect(ee.every((n) => n.parentId === hosts[0].id)).toBe(true);
      const eeIds = new Set(ee.map((n) => n.id));
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(3);
      expect(artifacts.every((a) => eeIds.has(a.parentId ?? ''))).toBe(true);
      // 3 logical Components, all outside the nodes.
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(3);
      expect(dcs.every((d) => d.parentId === undefined)).toBe(true);
    });

    it('Docker Host shows its stereotype header (isComponentHeaderShown: true)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(hostNodes(r)[0].data.isComponentHeaderShown).toBe(true);
    });

    it('emits exactly the `flat-scaffold` warning', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([{ kind: 'flat-scaffold' }]);
    });
  });

  describe('intra-subsystem-collapse — silent', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Order', null),
        c1: el('c1', 'Component', 'Receiver', 's1'),
        c2: el('c2', 'Component', 'Validator', 's1'),
      }),
    );
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 'c1', 'c2'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits 1 Subsystem node, 2 DeploymentComponents (no parent), 1 STRUCTURAL association (ExecEnv→ExecEnv), 0 warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(1);
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(2);
      expect(dcs.every((d) => d.parentId === undefined)).toBe(true);
      // 48 (D2): intra-pool dep now draws between ExecEnv nodes, not outer node.
      expect(associationsOf(r)).toHaveLength(1);
      expect(r.warnings).toEqual([]);
    });
    it('04-FU3 — still emits 2 manifest DeploymentDependencies (one per Component-Artifact pair)', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifest = manifestEdgesOf(r);
      expect(manifest).toHaveLength(2);
    });
  });

  describe('48 — intra-pool agent-to-agent → ExecEnv CommunicationPath', () => {
    // Three agents in ONE pool → ONE outer Subsystem → previously all deps collapsed.
    // After 48, each has its own ExecEnv; intra-pool deps emit between ExecEnvs.
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Swarm', null),
        sup: el('sup', 'Component', 'Supervisor', 's1', 'supervision'),
        cod: el('cod', 'Component', 'Coder', 's1', 'solution'),
        rev: el('rev', 'Component', 'Reviewer', 's1', 'solution'),
      }),
    );
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 'sup', 'cod', 'supervises'),
        r2: dep('r2', 'cod', 'rev', 'collaborates'),
        r3: dep('r3', 'rev', 'sup', 'revises'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits 3 ExecEnv nodes (one per agent) under one Docker Host', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(execEnvNodes(r)).toHaveLength(3);
      expect(hostNodes(r)).toHaveLength(1);
    });

    it('emits 3 DeploymentAssociations between ExecEnv nodes (not outer Subsystem node)', () => {
      if (!r.ok) throw new Error('expected ok');
      const assocs = associationsOf(r);
      expect(assocs).toHaveLength(3);
      const eeIds = new Set(execEnvNodes(r).map((n) => n.id));
      for (const a of assocs) {
        expect(eeIds.has(a.source)).toBe(true);
        expect(eeIds.has(a.target)).toBe(true);
      }
    });

    it('emits no warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([]);
    });

    it('cross-pool deps still produce associations between the two groups ExecEnv nodes', () => {
      const m2 = makeBaseModel();
      m2.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Pool A', null),
          s2: el('s2', 'Subsystem', 'Pool B', null),
          c1: el('c1', 'Component', 'Agent A', 's1', 'solution'),
          c2: el('c2', 'Component', 'Agent B', 's2', 'solution'),
        }),
      );
      m2.edges.push(
        ...Object.values({
          r1: dep('r1', 'c1', 'c2', 'delegates'),
        }),
      );
      const r2 = componentModelToDeploymentModel(m2);
      if (!r2.ok) throw new Error('expected ok');
      const assocs = associationsOf(r2);
      expect(assocs).toHaveLength(1);
      const eeIds = new Set(execEnvNodes(r2).map((n) => n.id));
      const a = assocs[0];
      expect(eeIds.has(a.source)).toBe(true);
      expect(eeIds.has(a.target)).toBe(true);
    });

    it('bidirectional ComponentDependency (A→B + B→A) collapses to 1 DeploymentAssociation', () => {
      const m3 = makeBaseModel();
      m3.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Swarm', null),
          c1: el('c1', 'Component', 'Supervisor', 's1', 'supervision'),
          c2: el('c2', 'Component', 'Coder', 's1', 'solution'),
        }),
      );
      m3.edges.push(
        ...Object.values({
          r1: dep('r1', 'c1', 'c2', 'supervises'),
          r2: dep('r2', 'c2', 'c1', 'revises'),
        }),
      );
      const r3 = componentModelToDeploymentModel(m3);
      if (!r3.ok) throw new Error('expected ok');
      expect(associationsOf(r3)).toHaveLength(1);
    });
  });

  describe('agentic-edge-dropped — silent', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'A', null),
        s2: el('s2', 'Subsystem', 'B', null),
        c1: el('c1', 'Component', 'Manager', 's1', 'solution'),
        c2: el('c2', 'Component', 'Worker', 's2', 'solution'),
      }),
    );
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 'c1', 'c2', 'delegates'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation with no stereotype and 0 warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = associationsOf(r);
      expect(structural).toHaveLength(1);
      expect(stereotypeOf(structural[0])).toBeUndefined();
      expect(r.warnings).toEqual([]);
    });
  });

  describe('nested-subsystems-flatten (OQ-1)', () => {
    const m = makeBaseModel();
    // A contains B contains C; D is orphan; dep D→C.
    m.nodes.push(
      ...Object.values({
        sa: el('sa', 'Subsystem', 'A', null),
        sb: el('sb', 'Subsystem', 'B', 'sa'),
        c: el('c', 'Component', 'C', 'sb'),
        d: el('d', 'Component', 'D', null),
      }),
    );
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 'd', 'c'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits Subsystem nodes A and B as siblings under root (A is a bare placeholder)', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = subsystemNodes(r);
      expect(subs.map((n) => nameOf(n)).sort()).toEqual(['A', 'B']);
      expect(subs.every((n) => n.parentId === undefined)).toBe(true);
    });

    it('38 — Component C lives below its outer node (no parent); its Artifact is inside an ExecEnv named C', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcC = componentsOf(r).find((e) => nameOf(e) === 'C')!;
      expect(dcC.parentId).toBeUndefined();
      const eeC = execEnvNodes(r).find((e) => nameOf(e) === 'C')!;
      const artifactC = artifactsOf(r).find((e) => nameOf(e) === 'C')!;
      expect(artifactC.parentId).toBe(eeC.id);
    });

    it('emits 1 STRUCTURAL DeploymentAssociation (orphan Docker Host → Subsystem B)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(associationsOf(r)).toHaveLength(1);
    });
  });

  describe('04-FU2 — Subsystem-to-Subsystem dependency', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Order', null),
        s2: el('s2', 'Subsystem', 'Shipping', null),
        c1: el('c1', 'Component', 'Inner1', 's1'),
        c2: el('c2', 'Component', 'Inner2', 's2'),
      }),
    );
    // Dep at the Subsystem level (not between Components).
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 's1', 's2'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation between the two Nodes (FU2 fix)', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = associationsOf(r);
      expect(structural).toHaveLength(1);
      const nodeOrder = deploymentNodesOf(r).find((e) => nameOf(e) === 'Order')!;
      const nodeShipping = deploymentNodesOf(r).find((e) => nameOf(e) === 'Shipping')!;
      const e = structural[0];
      expect(e.source).toBe(nodeOrder.id);
      expect(e.target).toBe(nodeShipping.id);
    });
  });

  describe('04-FU2 — mixed Subsystem↔Component dependency', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'A', null),
        s2: el('s2', 'Subsystem', 'B', null),
        c1: el('c1', 'Component', 'Ca', 's1'),
        c2: el('c2', 'Component', 'Cb', 's2'),
      }),
    );
    // Dep from a Subsystem to a Component in a *different* Subsystem.
    m.edges.push(
      ...Object.values({
        r1: dep('r1', 's1', 'c2'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation A → B', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = associationsOf(r);
      expect(structural).toHaveLength(1);
    });
  });

  describe('element-mapping output', () => {
    it('maps DeploymentNode → source Subsystem, DeploymentComponent → source Component, DeploymentAssociation → source ComponentDependency', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Order', null),
          s2: el('s2', 'Subsystem', 'Shipping', null),
          c1: el('c1', 'Component', 'OrderAgent', 's1'),
          c2: el('c2', 'Component', 'ShippingAgent', 's2'),
        }),
      );
      m.edges.push(
        ...Object.values({
          r1: dep('r1', 'c1', 'c2'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      // Only the kept Subsystem nodes map back to their source Subsystem;
      // the Docker Host + ExecutionEnvironment nodes are synthetic (synthetic deployment nodes).
      for (const node of subsystemNodes(r)) {
        const sourceId = r.elementMapping[node.id];
        expect(sourceId).toBe(nameOf(node) === 'Order' ? 's1' : 's2');
      }
      for (const node of [...hostNodes(r), ...execEnvNodes(r)]) {
        expect(r.elementMapping[node.id]).toBeUndefined();
      }

      // Only the DeploymentComponent maps to the source Component
      // (the lineage sidecar derivation). The paired Artifact has no source
      // counterpart — it is the physical manifestation, not a
      // projection of any source element.
      const dcs = componentsOf(r);
      for (const dc of dcs) {
        const expected = nameOf(dc) === 'OrderAgent' ? 'c1' : 'c2';
        expect(r.elementMapping[dc.id]).toBe(expected);
      }

      // The structural DeploymentAssociation maps to the source dep.
      const structural = associationsOf(r);
      expect(structural).toHaveLength(1);
      expect(r.elementMapping[structural[0].id]).toBe('r1');
    });

    it('DeploymentArtifacts are absent from elementMapping (06-v2 FU — Artifacts have no source counterpart)', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Order', null),
          c1: el('c1', 'Component', 'OrderAgent', 's1'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(1);
      for (const a of artifacts) {
        expect(r.elementMapping[a.id]).toBeUndefined();
      }
    });

    it('synthetic emissions (Default Host, manifest DeploymentDependency) are absent from elementMapping', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          c1: el('c1', 'Component', 'Orphan1', null),
          c2: el('c2', 'Component', 'Orphan2', null),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      // The synthetic orphan Docker Host has no entry.
      const host = hostNodes(r).find((e) => nameOf(e) === 'Docker Host');
      expect(host).toBeDefined();
      expect(r.elementMapping[host!.id]).toBeUndefined();

      // Manifest DeploymentDependencies have no entry either.
      const manifests = manifestEdgesOf(r);
      expect(manifests.length).toBeGreaterThan(0);
      for (const m2 of manifests) {
        expect(r.elementMapping[m2.id]).toBeUndefined();
      }
    });
  });

  describe('Artifact.manifests auto-derive', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Order', null),
        s2: el('s2', 'Subsystem', 'Shipping', null),
        c1: el('c1', 'Component', 'OrderAgent', 's1'),
        c2: el('c2', 'Component', 'ShippingAgent', 's2'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('T-M1 — every DeploymentArtifact carries manifests = [a source Component id]', () => {
      if (!r.ok) throw new Error('expected ok');
      const sourceComponentIds = new Set(m.nodes.filter((e) => e.type === 'component').map((e) => e.id));
      const artifacts = artifactsOf(r);
      expect(artifacts.length).toBeGreaterThan(0);
      for (const a of artifacts) {
        const manifests = a.data.manifests as string[] | undefined;
        expect(manifests).toHaveLength(1);
        expect(sourceComponentIds.has(manifests![0])).toBe(true);
      }
    });

    it('T-M2 — an Artifact manifests the same source Component its paired DeploymentComponent projects', () => {
      if (!r.ok) throw new Error('expected ok');
      // Pair Artifact↔Component via the manifest DeploymentDependency
      // (source = artifactId, target = componentId — see the reverse manifest edge).
      const manifestEdges = manifestEdgesOf(r);
      expect(manifestEdges.length).toBeGreaterThan(0);
      for (const edge of manifestEdges) {
        const artifactId = edge.source;
        const componentId = edge.target;
        const artifactManifests = nodeById(r.model, artifactId)!.data.manifests as string[] | undefined;
        expect(artifactManifests).toHaveLength(1);
        // elementMapping lineages each DeploymentComponent to its source
        // Component (the lineage sidecar). The Artifact must manifest that same source id.
        expect(artifactManifests![0]).toBe(r.elementMapping[componentId]);
      }
    });
  });

  describe('agentModelRef threading (Component→Deployment)', () => {
    it('copies agentModelRef from the source Component onto its Artifact', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Order', null),
          c1: el('c1', 'Component', 'OrderAgent', 's1', 'solution', { agentModelRef: 'agent-uuid-123' }),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifact = artifactsOf(r)[0];
      expect(artifact).toBeDefined();
      expect(artifact.data.agentModelRef).toBe('agent-uuid-123');
    });

    it('omits agentModelRef on the Artifact when the source Component has none', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Order', null),
          c1: el('c1', 'Component', 'OrderAgent', 's1', 'solution'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifact = artifactsOf(r)[0];
      expect(artifact).toBeDefined();
      expect(artifact.data.agentModelRef).toBeUndefined();
    });
  });

  describe('35 / Bug 18b — capability Components excluded from Deployment artifacts', () => {
    it('Component with capability stereotype is not emitted as a DeploymentArtifact', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Agents', null),
          agent: el('agent', 'Component', 'MyAgent', 's1', 'solution'),
          llm: el('llm', 'Component', 'LLMNode', 's1', 'llm'),
          rag: el('rag', 'Component', 'RAGStore', 's1', 'rag'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(1);
      expect(nameOf(artifacts[0])).toBe('MyAgent');
    });

    it('all five capability stereotypes are excluded: skill, tool, llm, db, rag', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'S', null),
          a: el('a', 'Component', 'Agent', 's1', 'solution'),
          b: el('b', 'Component', 'Skill1', 's1', 'skill'),
          c: el('c', 'Component', 'Tool1', 's1', 'tool'),
          d: el('d', 'Component', 'LLM1', 's1', 'llm'),
          e: el('e', 'Component', 'DB1', 's1', 'db'),
          f: el('f', 'Component', 'RAG1', 's1', 'rag'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(1);
      expect(nameOf(artifacts[0])).toBe('Agent');
    });
  });

  describe('35 / Bug 18a — capability-only Subsystem does not emit a DeploymentNode', () => {
    it('Subsystem containing only capability Components is skipped (no empty Node)', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          agents: el('agents', 'Subsystem', 'AgentPool', null),
          caps: el('caps', 'Subsystem', 'Capabilities', null),
          c1: el('c1', 'Component', 'Agent1', 'agents', 'solution'),
          c2: el('c2', 'Component', 'LLMNode', 'caps', 'llm'),
          c3: el('c3', 'Component', 'SkillBot', 'caps', 'skill'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const subs = subsystemNodes(r);
      expect(subs).toHaveLength(1);
      expect(nameOf(subs[0])).toBe('AgentPool');
      // The capability-only "Capabilities" Subsystem produced no node at all.
      expect(subsystemNodes(r).find((n) => nameOf(n) === 'Capabilities')).toBeUndefined();
    });

    it('two distinct agent Components produce exactly two artifacts — no duplicates', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Pool', null),
          c1: el('c1', 'Component', 'Alpha', 's1', 'solution'),
          c2: el('c2', 'Component', 'Beta', 's1', 'supervision'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(2);
      const names = new Set(artifacts.map((a) => nameOf(a)));
      expect(names.size).toBe(2);
      expect(names.has('Alpha')).toBe(true);
      expect(names.has('Beta')).toBe(true);
    });
  });

  describe('35 / Bug 16 — multiplicity not applied to capability-stereotyped artifacts', () => {
    it('agent gets [N] suffix on its Artifact; capability is excluded entirely', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'A', null),
          agent: el('agent', 'Component', 'Solver', 's1', 'solution'),
          llm: el('llm', 'Component', 'LLM', 's1', 'llm'),
        }),
      );
      const r = componentModelToDeploymentModel(m, { agent: 3, llm: 5 });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // One ExecEnv per agent; the Artifact carries [N] when multiplicity > 1.
      // The capability (llm) is excluded entirely (no artifact, no [M] notation).
      const artifacts = artifactsOf(r);
      expect(artifacts.map((a) => nameOf(a)).sort()).toEqual(['Solver [3]']);
    });

    it('agent without multiplicity entry produces a clean (no [N]) artifact name', () => {
      const m = makeBaseModel();
      m.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'A', null),
          agent: el('agent', 'Component', 'Worker', 's1', 'solution'),
          tool: el('tool', 'Component', 'MyTool', 's1', 'tool'),
        }),
      );
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(1);
      expect(nameOf(artifacts[0])).toBe('Worker');
    });
  });

  describe('38 — per-agent ExecutionEnvironment nesting', () => {
    const m = makeBaseModel();
    m.nodes.push(
      ...Object.values({
        s1: el('s1', 'Subsystem', 'Pool', null),
        a: el('a', 'Component', 'Planner', 's1', 'solution'),
        b: el('b', 'Component', 'Solver', 's1', 'supervision'),
      }),
    );
    const r = componentModelToDeploymentModel(m);

    it('emits Subsystem › Docker Host › one ExecEnv per agent', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(1);
      expect(hostNodes(r)).toHaveLength(1);
      expect(
        execEnvNodes(r)
          .map((n) => nameOf(n))
          .sort(),
      ).toEqual(['Planner', 'Solver']);
    });

    it('wires the ownership chain Subsystem ← Docker Host ← ExecEnv ← Artifact', () => {
      if (!r.ok) throw new Error('expected ok');
      const sub = subsystemNodes(r)[0];
      const host = hostNodes(r)[0];
      expect(host.parentId).toBe(sub.id);
      for (const ee of execEnvNodes(r)) {
        expect(ee.parentId).toBe(host.id);
        const art = artifactsOf(r).find((x) => x.parentId === ee.id);
        expect(art).toBeDefined();
        expect(nameOf(art)).toBe(nameOf(ee));
      }
    });

    it('per-agent ExecEnv carries the «executionEnvironment» stereotype; host carries «docker host»', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(execEnvNodes(r).every((n) => stereotypeOf(n) === 'executionEnvironment')).toBe(true);
      expect(stereotypeOf(hostNodes(r)[0])).toBe('docker host');
    });

    it('keeps one logical DeploymentComponent + one manifest edge per agent', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(componentsOf(r)).toHaveLength(2);
      const manifests = manifestEdgesOf(r);
      expect(manifests).toHaveLength(2);
    });

    it('threads agentModelRef from the source Component onto its single Artifact (with [N] suffix)', () => {
      const m2 = makeBaseModel();
      m2.nodes.push(
        ...Object.values({
          s1: el('s1', 'Subsystem', 'Pool', null),
          a: el('a', 'Component', 'Coder', 's1', 'solution', { agentModelRef: 'agent-xyz' }),
        }),
      );
      const r2 = componentModelToDeploymentModel(m2, { a: 2 });
      if (!r2.ok) throw new Error('expected ok');
      const arts = artifactsOf(r2);
      expect(arts).toHaveLength(1); // single Artifact named "Coder [2]"
      expect(nameOf(arts[0])).toBe('Coder [2]');
      expect(arts[0].data.agentModelRef).toBe('agent-xyz');
    });
  });

  describe('Subsystems that are dependency endpoints', () => {
    it('emits a node and a CommunicationPath for an external black-box Subsystem', () => {
      const components = bpmnModelToComponentModel(poolMessage as UMLModel);
      if (!components.ok) throw new Error('expected component derivation');
      const r = componentModelToDeploymentModel(components.model);
      if (!r.ok) throw new Error('expected ok');
      const legacy = deploymentNodesOf(r).find((e) => nameOf(e) === 'LegacySystem');
      expect(legacy).toBeDefined();
      const paths = associationsOf(r).filter((rel) => rel.source === legacy!.id || rel.target === legacy!.id);
      expect(paths.length).toBeGreaterThan(0);
    });
  });
});
