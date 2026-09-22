import { BPMNTask, BPMNTaskType } from '../../../../../main/packages/bpmn/bpmn-task/bpmn-task';

describe('BPMNTask - taskType (Phase A construct gaps)', () => {
  it('should accept service as a valid task type', () => {
    const task = new BPMNTask({ taskType: 'service' as BPMNTaskType });
    expect(task.taskType).toBe('service');
  });

  it('should round-trip service through serialize/deserialize', () => {
    const task = new BPMNTask({ taskType: 'service' as BPMNTaskType, name: 'Call billing' });
    const serialized = task.serialize();
    expect(serialized.taskType).toBe('service');

    const restored = new BPMNTask();
    restored.deserialize(serialized);
    expect(restored.taskType).toBe('service');
  });
});
