import { describe, expect, it } from 'vitest';
import type { UMLModel } from '@besser/wme';
import bundle from '../../../../templates/pattern/multi-agent/bug_fixing.json';
import { describeLineageSource } from '../lineageSource';

// The multi-agent template's Component diagram is derived from its BPMN
// diagram: lane Components and has/uses dependencies map to lanes, agent →
// agent dependencies to the (unnamed) BPMN flow they were derived from.
const project = (bundle as any).project;
const bpmn = project.diagrams.BPMN[0].model as UMLModel;
const component = project.diagrams.ComponentDiagram[0];
const mapping: Record<string, string> = project.elementLineage[component.id];
const dependencySources = (component.model as UMLModel).edges
  .filter((e) => e.type === 'ComponentDependency' && mapping[e.id])
  .map((e) => describeLineageSource(bpmn, mapping[e.id]));

describe('describeLineageSource', () => {
  it('names a lane source with the editor type name, not the React Flow node type', () => {
    expect(dependencySources).toContainEqual({ name: 'AgentCoder', type: 'BPMNSwimlane' });
  });

  it('names an unnamed flow source by its endpoints (an unnamed gateway by its lane)', () => {
    const flows = dependencySources.filter((s) => s.type === 'BPMNSequenceFlow');
    expect(flows.length).toBeGreaterThan(0);
    expect(flows).toContainEqual({ name: 'AgentReviewer → Reproduce and fix bug', type: 'BPMNSequenceFlow' });
  });

  it('returns nothing for an element the source model no longer has', () => {
    expect(describeLineageSource(bpmn, 'gone')).toEqual({});
    expect(describeLineageSource(null, 'gone')).toEqual({});
  });
});
