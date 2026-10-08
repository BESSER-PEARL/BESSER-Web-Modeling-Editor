import { describe, expect, it } from 'vitest';
import { BPMNDiagramConverter } from '../converters/BPMNDiagramConverter';
import { BPMNDiagramModifier } from '../modifiers/BPMNDiagramModifier';
import type { ModelModification } from '../modifiers/base';
import type { BESSERModel } from '../UMLModelingService';

// Shape of the modeling agent's agentic BPMN contract (lane roles
// solution/supervision, integer multiplicity, reviewer lane by spec lane id).
const agenticSpec = {
  systemName: 'Document Review Swarm',
  pools: [
    {
      id: 'swarm',
      name: 'Review Swarm',
      lanes: [
        { id: 'writer', name: 'Writer Agent', isAgentic: true, role: 'solution', trustScore: 75, multiplicity: 1, agentDiagramRef: null },
        { id: 'reviewers', name: 'Reviewer Agents', isAgentic: true, role: 'solution', trustScore: 80, multiplicity: 3, agentDiagramRef: null },
        { id: 'supervisor', name: 'Supervisor Agent', isAgentic: true, role: 'supervision', trustScore: 90, multiplicity: 1, agentDiagramRef: null },
      ],
    },
    { id: 'author', name: 'Author', lanes: [] },
  ],
  nodes: [
    { id: 'submitted', name: 'Document submitted', type: 'startEvent', poolId: 'author', laneId: null },
    {
      id: 'draft',
      name: 'Draft Summary',
      type: 'task',
      taskType: 'service',
      poolId: 'swarm',
      laneId: 'writer',
      isAgentic: true,
      reflectionMode: 'cross',
      reflectionReviewerLaneId: 'supervisor',
      trustScore: 75,
    },
    {
      id: 'review',
      name: 'Review Summary',
      type: 'task',
      poolId: 'swarm',
      laneId: 'reviewers',
      isAgentic: true,
      reflectionMode: 'cross',
      reflectionReviewerLaneId: 'Supervisor Agent',
    },
    {
      id: 'orphan',
      name: 'Orphan Review',
      type: 'task',
      poolId: 'swarm',
      laneId: 'reviewers',
      isAgentic: true,
      reflectionMode: 'cross',
      reflectionReviewerLaneId: 'no-such-lane',
    },
  ],
  flows: [
    { source: 'submitted', target: 'draft', name: '' },
    { source: 'draft', target: 'review', name: '' },
  ],
};

const byName = (model: BESSERModel, name: string) => Object.values(model.elements).find((el) => el.name === name);

describe('reflectionReviewerLaneId from the modeling agent', () => {
  it('maps the converter spec lane reference (id or name) to the editor lane id', () => {
    const model = new BPMNDiagramConverter().convertCompleteSystem(agenticSpec) as BESSERModel;
    const supervisor = byName(model, 'Supervisor Agent');
    expect(supervisor).toMatchObject({ type: 'BPMNSwimlane', role: 'supervision', multiplicity: 1 });
    expect(byName(model, 'Reviewer Agents')).toMatchObject({ multiplicity: 3, role: 'solution' });

    expect(byName(model, 'Draft Summary')?.reflectionReviewerLaneId).toBe(supervisor?.id);
    expect(byName(model, 'Review Summary')?.reflectionReviewerLaneId).toBe(supervisor?.id);
    expect(byName(model, 'Orphan Review')).not.toHaveProperty('reflectionReviewerLaneId');
  });

  it('maps the modifier lane reference and drops one that does not resolve', () => {
    const modifier = new BPMNDiagramModifier();
    const base = new BPMNDiagramConverter().convertCompleteSystem(agenticSpec) as BESSERModel;
    const reviewersLane = byName(base, 'Reviewer Agents')!;

    const modify = (changes: ModelModification['changes']): BESSERModel =>
      modifier.applyModification(base, { action: 'modify_node', target: { nodeName: 'Orphan Review' }, changes });
    expect(byName(modify({ reflectionReviewerLaneId: 'Reviewer Agents' }), 'Orphan Review')?.reflectionReviewerLaneId).toBe(
      reviewersLane.id,
    );
    expect(byName(modify({ reflectionReviewerLaneId: 'lane-fact-checker' }), 'Orphan Review')).not.toHaveProperty(
      'reflectionReviewerLaneId',
    );

    const added = modifier.applyModification(base, {
      action: 'add_task',
      target: { nodeName: 'Check Facts' },
      changes: { owner: 'Writer Agent', reflectionMode: 'cross', reflectionReviewerLaneId: reviewersLane.id },
    });
    expect(byName(added, 'Check Facts')?.reflectionReviewerLaneId).toBe(reviewersLane.id);
  });
});
