import { BPMNTask } from '../../../../../main/packages/bpmn/bpmn-task/bpmn-task';
import { BPMNRelationshipType } from '../../../../../main/packages/bpmn';

describe('BPMNTask - Supported Relationships', () => {
  it('should have supportedRelationships property defined', () => {
    expect(BPMNTask.supportedRelationships).toBeDefined();
  });

  it('should include BPMNFlow in supportedRelationships', () => {
    expect(BPMNTask.supportedRelationships).toContain(BPMNRelationshipType.BPMNFlow);
  });

  it('should have BPMNFlow as the only supported relationship type', () => {
    expect(BPMNTask.supportedRelationships).toEqual([BPMNRelationshipType.BPMNFlow]);
  });

  it('should create task instances with correct type', () => {
    const task = new BPMNTask({ name: 'Test Task' });
    expect(task.name).toBe('Test Task');
    expect(task.type).toBeDefined();
  });
});