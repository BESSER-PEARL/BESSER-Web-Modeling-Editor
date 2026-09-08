import { BPMNPool } from '../../../../../main/packages/bpmn/bpmn-pool/bpmn-pool';
import { BPMNSwimlane } from '../../../../../main/packages/bpmn/bpmn-swimlane/bpmn-swimlane';
import { ResizeFrom } from '../../../../../main/services/uml-element/uml-element';

describe('BPMNPool + BPMNSwimlane interaction', () => {
  it('detects swimlane-only children as swimlane pool', () => {
    const pool = new BPMNPool();
    const lane1 = new BPMNSwimlane({ bounds: { x: 0, y: 0, width: 100, height: 80 } });
    const lane2 = new BPMNSwimlane({ bounds: { x: 0, y: 80, width: 100, height: 120 } });

    expect(pool.hasSwimlanes([lane1, lane2])).toBe(true);
  });

  it('repositions swimlanes and enforces pool header width offset', () => {
    const pool = new BPMNPool({ bounds: { x: 0, y: 0, width: 240, height: 50 } });
    const lane1 = new BPMNSwimlane({ id: 'lane-1', bounds: { x: 0, y: 0, width: 10, height: 80 } });
    const lane2 = new BPMNSwimlane({ id: 'lane-2', bounds: { x: 0, y: 0, width: 10, height: 90 } });

    const result = pool.render({} as any, [lane1, lane2]);
    const lanes = result.slice(1) as BPMNSwimlane[];

    lanes.forEach((lane) => {
      expect(lane.bounds.x).toBe(BPMNPool.HEADER_WIDTH);
      expect(lane.bounds.width).toBe(pool.bounds.width - BPMNPool.HEADER_WIDTH);
      expect(lane.resizeFrom).toBe(ResizeFrom.BOTTOMRIGHT);
    });
  });

  it('enforces minimum swimlane height on render', () => {
    const lane = new BPMNSwimlane({ bounds: { x: 0, y: 0, width: 100, height: 20 } });
    lane.render({} as any, []);
    expect(lane.bounds.height).toBe(BPMNSwimlane.MIN_HEIGHT);
  });
});