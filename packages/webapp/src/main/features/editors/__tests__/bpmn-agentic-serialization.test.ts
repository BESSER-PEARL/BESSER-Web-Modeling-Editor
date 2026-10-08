import { describe, it, expect } from 'vitest';
import { BPMNTask } from '../../../../../../editor/src/main/packages/bpmn/bpmn-task/bpmn-task';
import { BPMNGateway } from '../../../../../../editor/src/main/packages/bpmn/bpmn-gateway/bpmn-gateway';
import { BPMNSwimlane } from '../../../../../../editor/src/main/packages/bpmn/bpmn-swimlane/bpmn-swimlane';

const AGENTIC_KEYS = ['isAgentic', 'reflectionMode', 'trustScore', 'gatewayRole', 'governanceDsl', 'role', 'multiplicity'];

const agenticKeysOf = (serialized: object) => Object.keys(serialized).filter((key) => AGENTIC_KEYS.includes(key));

describe('agentic BPMN serialization', () => {
  it('writes no agentic fields for plain tasks, gateways and lanes', () => {
    expect(agenticKeysOf(new BPMNTask({ name: 'Plain' }).serialize())).toEqual([]);
    expect(agenticKeysOf(new BPMNGateway({ name: 'Plain' }).serialize())).toEqual([]);
    expect(agenticKeysOf(new BPMNSwimlane({ name: 'Plain' }).serialize())).toEqual([]);
  });

  it('writes the agentic fields of agentic elements and reads them back', () => {
    const task = new BPMNTask({ name: 'Plan', isAgentic: true, reflectionMode: 'self', trustScore: 40 });
    const restoredTask = new BPMNTask();
    restoredTask.deserialize(task.serialize());
    expect(restoredTask).toMatchObject({ isAgentic: true, reflectionMode: 'self', trustScore: 40 });

    const lane = new BPMNSwimlane({ name: 'Coder', isAgentic: true, role: 'supervision', multiplicity: 3 });
    const restoredLane = new BPMNSwimlane();
    restoredLane.deserialize(lane.serialize());
    expect(restoredLane).toMatchObject({ isAgentic: true, role: 'supervision', multiplicity: 3 });
  });

  it('restores the defaults when a plain element is read back', () => {
    const restored = new BPMNGateway();
    restored.deserialize(new BPMNGateway({ name: 'Plain', gatewayType: 'parallel' }).serialize());
    expect(restored).toMatchObject({ isAgentic: false, gatewayRole: 'diverging', trustScore: 0 });
  });

  it('keeps an Agent diagram link on a task that is no longer agentic', () => {
    const task = new BPMNTask({ name: 'Plan', agentDiagramRef: 'agent-1' });
    expect(task.serialize().agentDiagramRef).toBe('agent-1');
  });
});
