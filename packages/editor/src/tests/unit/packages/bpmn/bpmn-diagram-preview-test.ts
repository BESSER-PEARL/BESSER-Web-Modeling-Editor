import { composeBPMNPreview } from '../../../../main/packages/bpmn/bpmn-diagram-preview';
import { BPMNSwimlane } from '../../../../main/packages/bpmn/bpmn-swimlane/bpmn-swimlane';
import { BPMNPool } from '../../../../main/packages/bpmn/bpmn-pool/bpmn-pool';
import { BPMNTask } from '../../../../main/packages/bpmn/bpmn-task/bpmn-task';
import { BPMNGateway } from '../../../../main/packages/bpmn/bpmn-gateway/bpmn-gateway';

describe('composeBPMNPreview', () => {
  const mockTranslate = (key: string) => key;

  it('should return an array of preview elements', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    expect(Array.isArray(preview)).toBe(true);
    expect(preview.length).toBeGreaterThan(0);
  });

  it('should include BPMNSwimlane in the preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const swimlaneExists = preview.some((element) => element instanceof BPMNSwimlane);
    expect(swimlaneExists).toBe(true);
  });

  it('should include BPMNPool in the preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const poolExists = preview.some((element) => element instanceof BPMNPool);
    expect(poolExists).toBe(true);
  });

  it('should include BPMNTask in the preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const taskExists = preview.some((element) => element instanceof BPMNTask);
    expect(taskExists).toBe(true);
  });

  it('should include BPMNGateway in the preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const gatewayExists = preview.some((element) => element instanceof BPMNGateway);
    expect(gatewayExists).toBe(true);
  });

  // We could test all elements as well

  it('should set default bounds for Task preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const task = preview.find((element) => element instanceof BPMNTask) as BPMNTask;
    expect(task.bounds.width).toBe(160);
    expect(task.bounds.height).toBe(60);
  });

  it('should set default bounds for Swimlane preview', () => {
    const preview = composeBPMNPreview({} as any, mockTranslate);
    const swimlane = preview.find((element) => element instanceof BPMNSwimlane) as BPMNSwimlane;
    expect(swimlane.bounds.width).toBe(160);
    expect(swimlane.bounds.height).toBe(80);
  });
});