import { BPMNElementType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { ResizeFrom, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLPackage } from '../../common/uml-package/uml-package';
import { BPMNSwimlane } from '../bpmn-swimlane/bpmn-swimlane';

export class BPMNPool extends UMLPackage {
  static MIN_WIDTH = 80;
  static MIN_HEIGHT = 80;
  static HEADER_WIDTH = 40;

  static features: UMLElementFeatures = {
    ...UMLElement.features,
    droppable: true,
    movable: true,
    resizable: 'WIDTH',
    connectable: true,
  };

  type: UMLElementType = BPMNElementType.BPMNPool;

  // Last synchronized content width (pool width minus header).
  // We use it to infer which side initiated a resize in the current frame.
  private syncedLaneContentWidth = BPMNPool.MIN_WIDTH - BPMNPool.HEADER_WIDTH;
  
  hasSwimlanes = (children: ILayoutable[]): boolean =>
    children.some((child: ILayoutable & { type?: UMLElementType }) => child.type === BPMNElementType.BPMNSwimlane);

  render(layer: ILayer, children: UMLElement[] = [], calculateWithoutChildren?: boolean): UMLElement[] {
    console.log('[pool.render] id=' + this.id + ' children=' + children.length, {
      ownedElements: this.ownedElements,
      childrenIds: children.map((c) => c.id),
      swimlaneYs: children
        .filter((c) => (c as any).type === BPMNElementType.BPMNSwimlane)
        .map((c) => ({ id: c.id, y: c.bounds.y, x: c.bounds.x })),
    });
    const MIN_POOL_WIDTH = BPMNPool.HEADER_WIDTH + BPMNSwimlane.MIN_WIDTH;
    if (this.bounds.width < MIN_POOL_WIDTH) {
      this.bounds.width = MIN_POOL_WIDTH;
    }
    // if (this.bounds.height < BPMNPool.MIN_HEIGHT) {
    //   this.bounds.height = BPMNPool.MIN_HEIGHT;
    // }

    const swimlanes = children.filter((child): child is BPMNSwimlane => child.type === BPMNElementType.BPMNSwimlane);
    if (swimlanes.length === 0) {
      return [this, ...children];
    }

    // 2. The pool dictates the horizontal span. 
    // Calculate what the lane widths should be based on current pool width.
    // We also fix the reference for X and Y
    const expectedLaneWidth = this.bounds.width - BPMNPool.HEADER_WIDTH;
    const poolX = this.bounds.x;
    const poolY = this.bounds.y;

    // 3. Sort lanes top-to-bottom to preserve order
    const orderedSwimlanes = [...swimlanes].sort((a, b) => a.bounds.y - b.bounds.y);

    let currentY = 0;

    // 3. Force exact local positioning for all lanes
    for (const lane of orderedSwimlanes) {
      // Lock x strictly to the inner edge of the header (local coordinate)
      lane.bounds.x = BPMNPool.HEADER_WIDTH;
      // Stack Y sequentially (local coordinate)
      lane.bounds.y = currentY;
      // Lock width strictly to the pool's remaining width
      lane.bounds.width = expectedLaneWidth;
      
      // Placements bounds clamping
      if (lane.bounds.height < BPMNSwimlane.MIN_HEIGHT) {
        lane.bounds.height = BPMNSwimlane.MIN_HEIGHT;
      }
      
      currentY += lane.bounds.height;
      
      // Override layouter logic that offsets coordinates during active dragging
      lane.resizeFrom = ResizeFrom.BOTTOMRIGHT; 
    }
    console.log('[pool.render] after-stack', orderedSwimlanes.map((s) => ({
      id: s.id, x: s.bounds.x, y: s.bounds.y, w: s.bounds.width, h: s.bounds.height,
    })));

    // 4. Force pool height to exactly fit lanes
    const totalHeight = currentY;
    this.bounds.height = Math.max(totalHeight, BPMNPool.MIN_HEIGHT);

    return [this, ...orderedSwimlanes, ...children.filter((child) => child.type !== BPMNElementType.BPMNSwimlane)];
  }
}
