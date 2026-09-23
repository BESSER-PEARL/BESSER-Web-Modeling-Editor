import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { componentModelToDeploymentModel } from '../component-to-deployment';

function makeBaseModel(): UMLModel {
  return {
    version: '3.0.0',
    type: 'ComponentDiagram',
    size: { width: 800, height: 600 },
    elements: {},
    interactive: { elements: {}, relationships: {} },
    relationships: {},
    assessments: {},
  } as unknown as UMLModel;
}

function el(
  id: string,
  type: string,
  name: string,
  owner: string | null,
  stereotype?: string,
): Record<string, unknown> {
  return {
    id,
    name,
    type,
    owner,
    bounds: { x: 0, y: 0, width: 100, height: 60 },
    stereotype: stereotype ?? (type === 'Component' ? 'component' : type === 'Subsystem' ? 'subsystem' : ''),
    displayStereotype: true,
  };
}

function dep(id: string, srcId: string, tgtId: string, stereotype?: string): Record<string, unknown> {
  return {
    id,
    name: '',
    type: 'ComponentDependency',
    owner: null,
    bounds: { x: 0, y: 0, width: 100, height: 60 },
    path: [],
    source: { element: srcId, direction: 'Right' },
    target: { element: tgtId, direction: 'Left' },
    ...(stereotype ? { stereotype } : {}),
  };
}

// node-kind predicates. WME stores a DeploymentNode's kind in `stereotype`.
type R = ReturnType<typeof componentModelToDeploymentModel>;
const elementsOf = (r: R) => (r.ok ? Object.values(r.model.elements) : []);
const nodesOf = (r: R, stereo: string) =>
  elementsOf(r).filter(
    (e) => e.type === 'DeploymentNode' && (e as unknown as { stereotype?: string }).stereotype === stereo,
  );
const subsystemNodes = (r: R) => nodesOf(r, 'node'); // kept Subsystem (and bare placeholders)
const hostNodes = (r: R) => nodesOf(r, 'docker host');
const execEnvNodes = (r: R) => nodesOf(r, 'executionEnvironment');
const artifactsOf = (r: R) => elementsOf(r).filter((e) => e.type === 'DeploymentArtifact');
const componentsOf = (r: R) => elementsOf(r).filter((e) => e.type === 'DeploymentComponent');
const associationsOf = (r: R) =>
  r.ok ? Object.values(r.model.relationships).filter((x) => x.type === 'DeploymentAssociation') : [];

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
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Order', null),
      s2: el('s2', 'Subsystem', 'Shipping', null),
      c1: el('c1', 'Component', 'OrderAgent', 's1', 'solution'),
      c2: el('c2', 'Component', 'ShippingAgent', 's2', 'solution'),
    });
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 'c1', 'c2', 'delegates'),
    });
    const r = componentModelToDeploymentModel(m);

    it('produces a DeploymentDiagram model', () => {
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.model.type).toBe('DeploymentDiagram');
    });
    it('emits 2 Subsystem nodes named Order/Shipping (38: + a Docker Host + an ExecEnv each)', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = subsystemNodes(r);
      expect(subs.map((n) => n.name).sort()).toEqual(['Order', 'Shipping']);
      expect(subs.find((n) => n.name === 'Default Host')).toBeUndefined();
      // One Docker Host per Subsystem, one ExecutionEnvironment per agent.
      expect(hostNodes(r)).toHaveLength(2);
      expect(execEnvNodes(r)).toHaveLength(2);
    });
    it('emits 2 DeploymentComponents, one per Node', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcs = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentComponent');
      expect(dcs).toHaveLength(2);
    });
    it('04-FU3 — emits 2 DeploymentComponents OUTSIDE the Nodes (owner=null)', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcs = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentComponent');
      expect(dcs).toHaveLength(2);
      expect(dcs.every((d) => d.owner === null)).toBe(true);
    });
    it('04-FU3 — emits 2 DeploymentArtifacts INSIDE the matching Nodes (owner=nodeId)', () => {
      if (!r.ok) throw new Error('expected ok');
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(2);
      const nodeIds = new Set(
        Object.values(r.model.elements)
          .filter((e) => e.type === 'DeploymentNode')
          .map((n) => n.id),
      );
      expect(artifacts.every((a) => nodeIds.has(a.owner ?? ''))).toBe(true);
    });
    it('04-FU3 — emits 1 structural DeploymentAssociation cross-Node', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentAssociation');
      expect(structural).toHaveLength(1);
    });
    it('04-FU3 — emits 2 DeploymentDependencies (manifest, dashed) — no stereotype label', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifests = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentDependency');
      expect(manifests).toHaveLength(2);
      expect(manifests.every((m) => (m as unknown as { stereotype?: string }).stereotype === undefined)).toBe(true);
    });
    it('04-FU3 — each manifest edge runs Artifact (source) → Component (target)', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifests = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentDependency');
      const artifactIds = new Set(
        Object.values(r.model.elements)
          .filter((e) => e.type === 'DeploymentArtifact')
          .map((a) => a.id),
      );
      const componentIds = new Set(
        Object.values(r.model.elements)
          .filter((e) => e.type === 'DeploymentComponent')
          .map((c) => c.id),
      );
      for (const m of manifests) {
        expect(artifactIds.has(m.source.element)).toBe(true);
        expect(componentIds.has(m.target.element)).toBe(true);
      }
    });
    it('emits no warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([]);
    });
  });

  describe('27/38 — swarm multiplicity stamps [N] on the Artifact inside its ExecEnv', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Coding', null),
      c1: el('c1', 'Component', 'Coder', 's1', 'solution'), // ×3 swarm
      c2: el('c2', 'Component', 'Reviewer', 's1', 'supervision'), // ×1
    });

    it('emits one ExecEnv per agent (plain name); Artifact name carries [N] for the swarm', () => {
      const r = componentModelToDeploymentModel(m, { c1: 3 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        execEnvNodes(r)
          .map((n) => n.name)
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
      expect(
        artifactsOf(r)
          .map((a) => a.name)
          .sort(),
      ).toEqual(['Coder [3]', 'Reviewer']);
    });

    it('DeploymentComponent name stays count-free (logical projection, no [N])', () => {
      const r = componentModelToDeploymentModel(m, { c1: 3 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        componentsOf(r)
          .map((c) => c.name)
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
    });

    it('[N] suffix only when N>1; N==1 / absent map → plain Artifact name', () => {
      const r = componentModelToDeploymentModel(m, { c1: 1 });
      if (!r.ok) throw new Error('expected ok');
      expect(
        artifactsOf(r)
          .map((a) => a.name)
          .sort(),
      ).toEqual(['Coder', 'Reviewer']);
    });

    it('is a no-op with no map argument (back-compat)', () => {
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');
      expect(artifactsOf(r).every((a) => !/\[\d+\]/.test(a.name as string))).toBe(true);
    });
  });

  describe('flat-scaffold — no Subsystems', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      c1: el('c1', 'Component', 'A', null),
      c2: el('c2', 'Component', 'B', null),
      c3: el('c3', 'Component', 'C', null),
    });
    const r = componentModelToDeploymentModel(m);

    it('38 — emits 1 top-level Docker Host (no Subsystem) wrapping 3 ExecEnvs', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(0);
      const hosts = hostNodes(r);
      expect(hosts).toHaveLength(1);
      expect(hosts[0].name).toBe('Docker Host');
      expect(hosts[0].owner).toBeNull();
      const ee = execEnvNodes(r);
      expect(ee).toHaveLength(3);
      // Each ExecEnv is owned by the Docker Host; each Artifact by its ExecEnv.
      expect(ee.every((n) => n.owner === hosts[0].id)).toBe(true);
      const eeIds = new Set(ee.map((n) => n.id));
      const artifacts = artifactsOf(r);
      expect(artifacts).toHaveLength(3);
      expect(artifacts.every((a) => eeIds.has(a.owner ?? ''))).toBe(true);
      // 3 logical Components, all outside the nodes.
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(3);
      expect(dcs.every((d) => d.owner === null)).toBe(true);
    });

    it('Docker Host has displayStereotype: true', () => {
      if (!r.ok) throw new Error('expected ok');
      expect((hostNodes(r)[0] as unknown as { displayStereotype?: boolean }).displayStereotype).toBe(true);
    });

    it('emits exactly the `flat-scaffold` warning', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([{ kind: 'flat-scaffold' }]);
    });
  });

  describe('intra-subsystem-collapse — silent', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Order', null),
      c1: el('c1', 'Component', 'Receiver', 's1'),
      c2: el('c2', 'Component', 'Validator', 's1'),
    });
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 'c1', 'c2'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits 1 Subsystem node, 2 DeploymentComponents (owner=null), 1 STRUCTURAL association (ExecEnv→ExecEnv), 0 warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(1);
      const dcs = componentsOf(r);
      expect(dcs).toHaveLength(2);
      expect(dcs.every((d) => d.owner === null)).toBe(true);
      // 48 (D2): intra-pool dep now draws between ExecEnv nodes, not outer node.
      expect(associationsOf(r)).toHaveLength(1);
      expect(r.warnings).toEqual([]);
    });
    it('04-FU3 — still emits 2 manifest DeploymentDependencies (one per Component-Artifact pair)', () => {
      if (!r.ok) throw new Error('expected ok');
      const manifest = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentDependency');
      expect(manifest).toHaveLength(2);
    });
  });

  describe('48 — intra-pool agent-to-agent → ExecEnv CommunicationPath', () => {
    // Three agents in ONE pool → ONE outer Subsystem → previously all deps collapsed.
    // After 48, each has its own ExecEnv; intra-pool deps emit between ExecEnvs.
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Swarm', null),
      sup: el('sup', 'Component', 'Supervisor', 's1', 'supervision'),
      cod: el('cod', 'Component', 'Coder', 's1', 'solution'),
      rev: el('rev', 'Component', 'Reviewer', 's1', 'solution'),
    });
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 'sup', 'cod', 'supervises'),
      r2: dep('r2', 'cod', 'rev', 'collaborates'),
      r3: dep('r3', 'rev', 'sup', 'revises'),
    });
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
        const asR = a as unknown as { source: { element: string }; target: { element: string } };
        expect(eeIds.has(asR.source.element)).toBe(true);
        expect(eeIds.has(asR.target.element)).toBe(true);
      }
    });

    it('emits no warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(r.warnings).toEqual([]);
    });

    it('cross-pool deps still produce associations between the two groups ExecEnv nodes', () => {
      const m2 = makeBaseModel();
      Object.assign(m2.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Pool A', null),
        s2: el('s2', 'Subsystem', 'Pool B', null),
        c1: el('c1', 'Component', 'Agent A', 's1', 'solution'),
        c2: el('c2', 'Component', 'Agent B', 's2', 'solution'),
      });
      Object.assign(m2.relationships as Record<string, unknown>, {
        r1: dep('r1', 'c1', 'c2', 'delegates'),
      });
      const r2 = componentModelToDeploymentModel(m2);
      if (!r2.ok) throw new Error('expected ok');
      const assocs = associationsOf(r2);
      expect(assocs).toHaveLength(1);
      const eeIds = new Set(execEnvNodes(r2).map((n) => n.id));
      const a = assocs[0] as unknown as { source: { element: string }; target: { element: string } };
      expect(eeIds.has(a.source.element)).toBe(true);
      expect(eeIds.has(a.target.element)).toBe(true);
    });

    it('bidirectional ComponentDependency (A→B + B→A) collapses to 1 DeploymentAssociation', () => {
      const m3 = makeBaseModel();
      Object.assign(m3.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Swarm', null),
        c1: el('c1', 'Component', 'Supervisor', 's1', 'supervision'),
        c2: el('c2', 'Component', 'Coder', 's1', 'solution'),
      });
      Object.assign(m3.relationships as Record<string, unknown>, {
        r1: dep('r1', 'c1', 'c2', 'supervises'),
        r2: dep('r2', 'c2', 'c1', 'revises'),
      });
      const r3 = componentModelToDeploymentModel(m3);
      if (!r3.ok) throw new Error('expected ok');
      expect(associationsOf(r3)).toHaveLength(1);
    });
  });

  describe('agentic-edge-dropped — silent', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'A', null),
      s2: el('s2', 'Subsystem', 'B', null),
      c1: el('c1', 'Component', 'Manager', 's1', 'solution'),
      c2: el('c2', 'Component', 'Worker', 's2', 'solution'),
    });
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 'c1', 'c2', 'delegates'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation with no stereotype and 0 warnings', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentAssociation');
      expect(structural).toHaveLength(1);
      expect((structural[0] as unknown as { stereotype?: string }).stereotype).toBeUndefined();
      expect(r.warnings).toEqual([]);
    });
  });

  describe('nested-subsystems-flatten (OQ-1)', () => {
    const m = makeBaseModel();
    // A contains B contains C; D is orphan; dep D→C.
    Object.assign(m.elements as Record<string, unknown>, {
      sa: el('sa', 'Subsystem', 'A', null),
      sb: el('sb', 'Subsystem', 'B', 'sa'),
      c: el('c', 'Component', 'C', 'sb'),
      d: el('d', 'Component', 'D', null),
    });
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 'd', 'c'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits Subsystem nodes A and B as siblings under root (A is a bare placeholder)', () => {
      if (!r.ok) throw new Error('expected ok');
      const subs = subsystemNodes(r);
      expect(subs.map((n) => n.name).sort()).toEqual(['A', 'B']);
      expect(subs.every((n) => n.owner === null)).toBe(true);
    });

    it('38 — Component C lives below its outer node (owner=null); its Artifact is inside an ExecEnv named C', () => {
      if (!r.ok) throw new Error('expected ok');
      const dcC = componentsOf(r).find((e) => e.name === 'C')!;
      expect(dcC.owner).toBeNull();
      const eeC = execEnvNodes(r).find((e) => e.name === 'C')!;
      const artifactC = artifactsOf(r).find((e) => e.name === 'C')!;
      expect(artifactC.owner).toBe(eeC.id);
    });

    it('emits 1 STRUCTURAL DeploymentAssociation (orphan Docker Host → Subsystem B)', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(associationsOf(r)).toHaveLength(1);
    });
  });

  describe('04-FU2 — Subsystem-to-Subsystem dependency', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Order', null),
      s2: el('s2', 'Subsystem', 'Shipping', null),
      c1: el('c1', 'Component', 'Inner1', 's1'),
      c2: el('c2', 'Component', 'Inner2', 's2'),
    });
    // Dep at the Subsystem level (not between Components).
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 's1', 's2'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation between the two Nodes (FU2 fix)', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentAssociation');
      expect(structural).toHaveLength(1);
      const nodeOrder = Object.values(r.model.elements).find((e) => e.type === 'DeploymentNode' && e.name === 'Order')!;
      const nodeShipping = Object.values(r.model.elements).find(
        (e) => e.type === 'DeploymentNode' && e.name === 'Shipping',
      )!;
      const e = structural[0] as unknown as {
        source: { element: string };
        target: { element: string };
      };
      expect(e.source.element).toBe(nodeOrder.id);
      expect(e.target.element).toBe(nodeShipping.id);
    });
  });

  describe('04-FU2 — mixed Subsystem↔Component dependency', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'A', null),
      s2: el('s2', 'Subsystem', 'B', null),
      c1: el('c1', 'Component', 'Ca', 's1'),
      c2: el('c2', 'Component', 'Cb', 's2'),
    });
    // Dep from a Subsystem to a Component in a *different* Subsystem.
    Object.assign(m.relationships as Record<string, unknown>, {
      r1: dep('r1', 's1', 'c2'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits 1 STRUCTURAL DeploymentAssociation A → B', () => {
      if (!r.ok) throw new Error('expected ok');
      const structural = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentAssociation');
      expect(structural).toHaveLength(1);
    });
  });

  describe('06-v2 — element-mapping output', () => {
    it('maps DeploymentNode → source Subsystem, DeploymentComponent → source Component, DeploymentAssociation → source ComponentDependency', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Order', null),
        s2: el('s2', 'Subsystem', 'Shipping', null),
        c1: el('c1', 'Component', 'OrderAgent', 's1'),
        c2: el('c2', 'Component', 'ShippingAgent', 's2'),
      });
      Object.assign(m.relationships as Record<string, unknown>, {
        r1: dep('r1', 'c1', 'c2'),
      });
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      // Only the kept Subsystem nodes map back to their source Subsystem;
      // the Docker Host + ExecutionEnvironment nodes are synthetic (synthetic deployment nodes).
      for (const node of subsystemNodes(r)) {
        const sourceId = r.elementMapping[node.id];
        expect(sourceId).toBe(node.name === 'Order' ? 's1' : 's2');
      }
      for (const node of [...hostNodes(r), ...execEnvNodes(r)]) {
        expect(r.elementMapping[node.id]).toBeUndefined();
      }

      // Only the DeploymentComponent maps to the source Component
      // (the lineage sidecar derivation). The paired Artifact has no source
      // counterpart — it is the physical manifestation, not a
      // projection of any source element.
      const dcs = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentComponent');
      for (const dc of dcs) {
        const expected = dc.name === 'OrderAgent' ? 'c1' : 'c2';
        expect(r.elementMapping[dc.id]).toBe(expected);
      }

      // The structural DeploymentAssociation maps to the source dep.
      const structural = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentAssociation');
      expect(structural).toHaveLength(1);
      expect(r.elementMapping[structural[0].id]).toBe('r1');
    });

    it('DeploymentArtifacts are absent from elementMapping (06-v2 FU — Artifacts have no source counterpart)', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Order', null),
        c1: el('c1', 'Component', 'OrderAgent', 's1'),
      });
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(1);
      for (const a of artifacts) {
        expect(r.elementMapping[a.id]).toBeUndefined();
      }
    });

    it('synthetic emissions (Default Host, manifest DeploymentDependency) are absent from elementMapping', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        c1: el('c1', 'Component', 'Orphan1', null),
        c2: el('c2', 'Component', 'Orphan2', null),
      });
      const r = componentModelToDeploymentModel(m);
      if (!r.ok) throw new Error('expected ok');

      // The synthetic orphan Docker Host has no entry.
      const host = hostNodes(r).find((e) => e.name === 'Docker Host');
      expect(host).toBeDefined();
      expect(r.elementMapping[host!.id]).toBeUndefined();

      // Manifest DeploymentDependencies have no entry either.
      const manifests = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentDependency');
      expect(manifests.length).toBeGreaterThan(0);
      for (const m2 of manifests) {
        expect(r.elementMapping[m2.id]).toBeUndefined();
      }
    });
  });

  describe('20 — Artifact.manifests auto-derive', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Order', null),
      s2: el('s2', 'Subsystem', 'Shipping', null),
      c1: el('c1', 'Component', 'OrderAgent', 's1'),
      c2: el('c2', 'Component', 'ShippingAgent', 's2'),
    });
    const r = componentModelToDeploymentModel(m);

    it('T-M1 — every DeploymentArtifact carries manifests = [a source Component id]', () => {
      if (!r.ok) throw new Error('expected ok');
      const sourceComponentIds = new Set(
        Object.values(m.elements as Record<string, { id: string; type: string }>)
          .filter((e) => e.type === 'Component')
          .map((e) => e.id),
      );
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts.length).toBeGreaterThan(0);
      for (const a of artifacts) {
        const manifests = (a as unknown as { manifests?: string[] }).manifests;
        expect(manifests).toHaveLength(1);
        expect(sourceComponentIds.has(manifests![0])).toBe(true);
      }
    });

    it('T-M2 — an Artifact manifests the same source Component its paired DeploymentComponent projects', () => {
      if (!r.ok) throw new Error('expected ok');
      // Pair Artifact↔Component via the manifest DeploymentDependency
      // (source = artifactId, target = componentId — see the reverse manifest edge).
      const manifestEdges = Object.values(r.model.relationships).filter((rel) => rel.type === 'DeploymentDependency');
      const elementById = r.model.elements as Record<string, { manifests?: string[] }>;
      expect(manifestEdges.length).toBeGreaterThan(0);
      for (const edge of manifestEdges) {
        const artifactId = (edge as unknown as { source: { element: string } }).source.element;
        const componentId = (edge as unknown as { target: { element: string } }).target.element;
        const artifactManifests = elementById[artifactId].manifests;
        expect(artifactManifests).toHaveLength(1);
        // elementMapping lineages each DeploymentComponent to its source
        // Component (the lineage sidecar). The Artifact must manifest that same source id.
        expect(artifactManifests![0]).toBe(r.elementMapping[componentId]);
      }
    });
  });

  describe('33 (6b-1) — agentModelRef threading (Component→Deployment)', () => {
    it('copies agentModelRef from the source Component onto its Artifact', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Order', null),
        c1: { ...el('c1', 'Component', 'OrderAgent', 's1', 'solution'), agentModelRef: 'agent-uuid-123' },
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifact = Object.values(r.model.elements).find((e) => e.type === 'DeploymentArtifact') as unknown as {
        agentModelRef?: string;
      };
      expect(artifact).toBeDefined();
      expect(artifact.agentModelRef).toBe('agent-uuid-123');
    });

    it('omits agentModelRef on the Artifact when the source Component has none', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Order', null),
        c1: el('c1', 'Component', 'OrderAgent', 's1', 'solution'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifact = Object.values(r.model.elements).find((e) => e.type === 'DeploymentArtifact') as unknown as {
        agentModelRef?: string;
      };
      expect(artifact).toBeDefined();
      expect(artifact.agentModelRef).toBeUndefined();
    });
  });

  describe('35 / Bug 18b — capability Components excluded from Deployment artifacts', () => {
    it('Component with capability stereotype is not emitted as a DeploymentArtifact', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Agents', null),
        agent: el('agent', 'Component', 'MyAgent', 's1', 'solution'),
        llm: el('llm', 'Component', 'LLMNode', 's1', 'llm'),
        rag: el('rag', 'Component', 'RAGStore', 's1', 'rag'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].name).toBe('MyAgent');
    });

    it('all five capability stereotypes are excluded: skill, tool, llm, db, rag', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'S', null),
        a: el('a', 'Component', 'Agent', 's1', 'solution'),
        b: el('b', 'Component', 'Skill1', 's1', 'skill'),
        c: el('c', 'Component', 'Tool1', 's1', 'tool'),
        d: el('d', 'Component', 'LLM1', 's1', 'llm'),
        e: el('e', 'Component', 'DB1', 's1', 'db'),
        f: el('f', 'Component', 'RAG1', 's1', 'rag'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].name).toBe('Agent');
    });
  });

  describe('35 / Bug 18a — capability-only Subsystem does not emit a DeploymentNode', () => {
    it('Subsystem containing only capability Components is skipped (no empty Node)', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        agents: el('agents', 'Subsystem', 'AgentPool', null),
        caps: el('caps', 'Subsystem', 'Capabilities', null),
        c1: el('c1', 'Component', 'Agent1', 'agents', 'solution'),
        c2: el('c2', 'Component', 'LLMNode', 'caps', 'llm'),
        c3: el('c3', 'Component', 'SkillBot', 'caps', 'skill'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const subs = subsystemNodes(r);
      expect(subs).toHaveLength(1);
      expect(subs[0].name).toBe('AgentPool');
      // The capability-only "Capabilities" Subsystem produced no node at all.
      expect(subsystemNodes(r).find((n) => n.name === 'Capabilities')).toBeUndefined();
    });

    it('two distinct agent Components produce exactly two artifacts — no duplicates', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Pool', null),
        c1: el('c1', 'Component', 'Alpha', 's1', 'solution'),
        c2: el('c2', 'Component', 'Beta', 's1', 'supervision'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(2);
      const names = new Set(artifacts.map((a) => a.name));
      expect(names.size).toBe(2);
      expect(names.has('Alpha')).toBe(true);
      expect(names.has('Beta')).toBe(true);
    });
  });

  describe('35 / Bug 16 — multiplicity not applied to capability-stereotyped artifacts', () => {
    it('agent gets [N] suffix on its Artifact; capability is excluded entirely', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'A', null),
        agent: el('agent', 'Component', 'Solver', 's1', 'solution'),
        llm: el('llm', 'Component', 'LLM', 's1', 'llm'),
      });
      const r = componentModelToDeploymentModel(m, { agent: 3, llm: 5 });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      // One ExecEnv per agent; the Artifact carries [N] when multiplicity > 1.
      // The capability (llm) is excluded entirely (no artifact, no [M] notation).
      const artifacts = artifactsOf(r);
      expect(artifacts.map((a) => a.name).sort()).toEqual(['Solver [3]']);
    });

    it('agent without multiplicity entry produces a clean (no [N]) artifact name', () => {
      const m = makeBaseModel();
      Object.assign(m.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'A', null),
        agent: el('agent', 'Component', 'Worker', 's1', 'solution'),
        tool: el('tool', 'Component', 'MyTool', 's1', 'tool'),
      });
      const r = componentModelToDeploymentModel(m);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const artifacts = Object.values(r.model.elements).filter((e) => e.type === 'DeploymentArtifact');
      expect(artifacts).toHaveLength(1);
      expect(artifacts[0].name).toBe('Worker');
    });
  });

  describe('38 — per-agent ExecutionEnvironment nesting', () => {
    const m = makeBaseModel();
    Object.assign(m.elements as Record<string, unknown>, {
      s1: el('s1', 'Subsystem', 'Pool', null),
      a: el('a', 'Component', 'Planner', 's1', 'solution'),
      b: el('b', 'Component', 'Solver', 's1', 'supervision'),
    });
    const r = componentModelToDeploymentModel(m);

    it('emits Subsystem › Docker Host › one ExecEnv per agent', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(subsystemNodes(r)).toHaveLength(1);
      expect(hostNodes(r)).toHaveLength(1);
      expect(
        execEnvNodes(r)
          .map((n) => n.name)
          .sort(),
      ).toEqual(['Planner', 'Solver']);
    });

    it('wires the ownership chain Subsystem ← Docker Host ← ExecEnv ← Artifact', () => {
      if (!r.ok) throw new Error('expected ok');
      const sub = subsystemNodes(r)[0];
      const host = hostNodes(r)[0];
      expect(host.owner).toBe(sub.id);
      for (const ee of execEnvNodes(r)) {
        expect(ee.owner).toBe(host.id);
        const art = artifactsOf(r).find((x) => x.owner === ee.id);
        expect(art).toBeDefined();
        expect(art!.name).toBe(ee.name);
      }
    });

    it('per-agent ExecEnv carries the «executionEnvironment» stereotype; host carries «docker host»', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(
        execEnvNodes(r).every((n) => (n as unknown as { stereotype?: string }).stereotype === 'executionEnvironment'),
      ).toBe(true);
      expect((hostNodes(r)[0] as unknown as { stereotype?: string }).stereotype).toBe('docker host');
    });

    it('keeps one logical DeploymentComponent + one manifest edge per agent', () => {
      if (!r.ok) throw new Error('expected ok');
      expect(componentsOf(r)).toHaveLength(2);
      const manifests = Object.values(r.model.relationships).filter((x) => x.type === 'DeploymentDependency');
      expect(manifests).toHaveLength(2);
    });

    it('threads agentModelRef from the source Component onto its single Artifact (with [N] suffix)', () => {
      const m2 = makeBaseModel();
      Object.assign(m2.elements as Record<string, unknown>, {
        s1: el('s1', 'Subsystem', 'Pool', null),
        a: { ...el('a', 'Component', 'Coder', 's1', 'solution'), agentModelRef: 'agent-xyz' },
      });
      const r2 = componentModelToDeploymentModel(m2, { a: 2 });
      if (!r2.ok) throw new Error('expected ok');
      const arts = artifactsOf(r2);
      expect(arts).toHaveLength(1); // single Artifact named "Coder [2]"
      expect(arts[0].name).toBe('Coder [2]');
      expect((arts[0] as unknown as { agentModelRef?: string }).agentModelRef).toBe('agent-xyz');
    });
  });
});
