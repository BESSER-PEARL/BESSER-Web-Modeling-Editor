import { describe, expect, it } from 'vitest';
import type { UMLModel } from '@besser/wme';
import { createDefaultProject, ensureProjectMigrated, type DiagramLineage } from '../project';
import { hashLegacyV3Model, hashUmlModel } from '../../utils/lineageHash';

// A v3 BPMN source as the v3 editor stored it.
const v3Bpmn = {
  version: '3.0.0',
  type: 'BPMNDiagram',
  size: { width: 900, height: 300 },
  interactive: { elements: {}, relationships: {} },
  assessments: {},
  elements: {
    pool: {
      id: 'pool',
      name: 'Team',
      type: 'BPMNPool',
      owner: null,
      bounds: { x: 0, y: 0, width: 800.4, height: 200 },
    },
    lane: {
      id: 'lane',
      name: 'Coder',
      type: 'BPMNSwimlane',
      owner: 'pool',
      bounds: { x: 40, y: 0, width: 760.4, height: 200 },
      isAgentic: true,
      role: 'solution',
      trustScore: 70,
      multiplicity: 1,
    },
    task: {
      id: 'task',
      name: 'Fix bug',
      type: 'BPMNTask',
      owner: null,
      bounds: { x: 140.6, y: 70, width: 140, height: 60 },
      taskType: 'default',
      marker: 'none',
    },
  },
  relationships: {},
};
// What the v3 editor's hashUmlModel returned for `v3Bpmn` (computed with its code).
const V3_EDITOR_HASH = '50ccb281';

const lineage = (sourceDiagramId: string, sourceModelHash: string): DiagramLineage => ({
  sourceDiagramId,
  sourceDiagramType: 'BPMN',
  derivationKind: 'bpmn-to-component',
  derivedAt: '2026-10-05T08:00:00.000Z',
  sourceModelHash,
});

const v3EraProject = () => {
  const project = createDefaultProject('P', '', '');
  project.schemaVersion = 5;
  const bpmn = project.diagrams.BPMN[0];
  bpmn.model = structuredClone(v3Bpmn) as unknown as UMLModel;
  project.diagrams.ComponentDiagram[0].derivedFrom = lineage(bpmn.id, V3_EDITOR_HASH);
  project.diagrams.AgentDiagram[0].derivedFrom = lineage(bpmn.id, 'deadbeef');
  return project;
};

describe('lineage hashes across the v3 -> v4 lift', () => {
  it('hashLegacyV3Model reproduces the v3 editor hash', () => {
    expect(hashLegacyV3Model(v3Bpmn)).toBe(V3_EDITOR_HASH);
  });

  it('keeps a derived diagram that was in sync with its v3 source in sync after the lift', () => {
    const project = ensureProjectMigrated(v3EraProject());
    const lifted = project.diagrams.BPMN[0].model as UMLModel;
    expect(lifted.nodes.length).toBeGreaterThan(0);
    expect(project.diagrams.ComponentDiagram[0].derivedFrom?.sourceModelHash).toBe(hashUmlModel(lifted));
  });

  it('leaves a derived diagram that was already stale stale', () => {
    const project = ensureProjectMigrated(v3EraProject());
    expect(project.diagrams.AgentDiagram[0].derivedFrom?.sourceModelHash).toBe('deadbeef');
  });
});
