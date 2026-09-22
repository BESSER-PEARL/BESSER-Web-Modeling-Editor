import { BPMNFlow } from '../../../../../main/packages/bpmn/bpmn-flow/bpmn-flow';

describe('BPMNFlow - isDefault (Phase A construct gaps)', () => {
  it('should default isDefault to false when not provided', () => {
    const flow = new BPMNFlow();
    expect(flow.isDefault).toBe(false);
  });

  it('should accept isDefault=true when provided', () => {
    const flow = new BPMNFlow({ isDefault: true });
    expect(flow.isDefault).toBe(true);
  });

  it('should round-trip isDefault through serialize/deserialize', () => {
    const flow = new BPMNFlow({ flowType: 'sequence', isDefault: true });
    const serialized = flow.serialize();
    expect(serialized.isDefault).toBe(true);

    const restored = new BPMNFlow();
    restored.deserialize(serialized);
    expect(restored.isDefault).toBe(true);
  });

  it('should round-trip isDefault=false through serialize/deserialize', () => {
    const flow = new BPMNFlow({ flowType: 'sequence', isDefault: false });
    const serialized = flow.serialize();
    expect(serialized.isDefault).toBe(false);

    const restored = new BPMNFlow();
    restored.deserialize(serialized);
    expect(restored.isDefault).toBe(false);
  });

  it('should be independent of flowType', () => {
    const flow = new BPMNFlow({ flowType: 'message', isDefault: true });
    expect(flow.flowType).toBe('message');
    expect(flow.isDefault).toBe(true);
  });
});
