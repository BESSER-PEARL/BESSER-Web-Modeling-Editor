import { BPMNElementType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { IUMLElement, ResizeFrom, UMLElement } from '../../../services/uml-element/uml-element';
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
    // Both axes allowed at the gesture level; the real constraint is enforced
    // per-instance in render(): an empty pool resizes vertically, a laned pool
    // stays lane-driven (its height delta is rejected). See guide 15.
    resizable: true,
    connectable: true,
  };

  type: UMLElementType = BPMNElementType.BPMNPool;

  // Last synchronized content width (pool width minus header).
  // We use it to infer which side initiated a resize in the current frame.
  private syncedLaneContentWidth = BPMNPool.MIN_WIDTH - BPMNPool.HEADER_WIDTH;

  hasSwimlanes = (children: ILayoutable[]): boolean =>
    children.some((child: ILayoutable & { type?: UMLElementType }) => child.type === BPMNElementType.BPMNSwimlane);

  // Swimlanes must paint before non-lane children so their background rect sits
  // behind tasks/events. SVG renders later elements on top; putting lanes first
  // in ownedElements ensures tasks always appear above lane backgrounds. (Guide 16.)
  reorderChildren(children: IUMLElement[]): string[] {
    const lanes = children.filter((c) => c.type === BPMNElementType.BPMNSwimlane);
    const rest = children.filter((c) => c.type !== BPMNElementType.BPMNSwimlane);
    return [...lanes, ...rest].map((c) => c.id);
  }

  render(layer: ILayer, children: UMLElement[] = [], calculateWithoutChildren?: boolean): UMLElement[] {
    const MIN_POOL_WIDTH = BPMNPool.HEADER_WIDTH + BPMNSwimlane.MIN_WIDTH;
    if (this.bounds.width < MIN_POOL_WIDTH) {
      this.bounds.width = MIN_POOL_WIDTH;
    }
    const swimlanes = children.filter((child): child is BPMNSwimlane => child.type === BPMNElementType.BPMNSwimlane);
    if (swimlanes.length === 0) {
      // No lanes: nothing drives the pool's height, so the pool itself is the
      // vertically resizable element (features.resizable === true). Respect the
      // user's dragged height; only enforce a sensible floor. (Guide 15.)
      if (this.bounds.height < BPMNPool.MIN_HEIGHT) {
        this.bounds.height = BPMNPool.MIN_HEIGHT;
      }
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

    // 3a. If the user is dragging the bottom edge up (pool wants to be shorter
    // than its current lanes), shrink the last lane to absorb the delta.
    // Gated on bottom-edge ResizeFrom so the top-edge y-shift path (phase 4,
    // lines 113-115) is not disturbed — a top-edge drag also produces
    // this.bounds.height < currentTotalHeight but already has its own handler.
    if (
      (this.resizeFrom === ResizeFrom.BOTTOMRIGHT || this.resizeFrom === ResizeFrom.BOTTOMLEFT) &&
      orderedSwimlanes.length > 0
    ) {
      const currentTotalHeight = orderedSwimlanes.reduce((sum, l) => sum + l.bounds.height, 0);
      if (this.bounds.height < currentTotalHeight) {
        const lastLane = orderedSwimlanes[orderedSwimlanes.length - 1];
        const shrinkBy = currentTotalHeight - this.bounds.height;
        lastLane.bounds.height = Math.max(lastLane.bounds.height - shrinkBy, BPMNSwimlane.MIN_HEIGHT);
      }
    }

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

    // 4a. If the stacked lane total is shorter than the pool's current height
    // (e.g. first lane dropped on a tall empty pool), expand the last lane to
    // fill instead of snapping the pool down. (Guide 16.)
    if (currentY < this.bounds.height && orderedSwimlanes.length > 0) {
      const lastLane = orderedSwimlanes[orderedSwimlanes.length - 1];
      lastLane.bounds.height += this.bounds.height - currentY;
      currentY = this.bounds.height;
    }

    // 4. Force pool height to exactly fit lanes. With features.resizable === true
    // the pool also accepts vertical drags, but a laned pool's height is fully
    // lane-driven, so any height delta is spurious. A top-edge drag (TOPLEFT /
    // TOPRIGHT) additionally shifted the pool's y by the same delta (see
    // ResizingReducer.getUpdatedPosition); undo that shift so rejecting the
    // height change doesn't drift the pool upward. Bottom-edge drags change
    // height only — y is untouched, so no correction there. (Guide 15.)
    const totalHeight = currentY;
    const desiredHeight = Math.max(totalHeight, BPMNPool.MIN_HEIGHT);
    if (this.resizeFrom === ResizeFrom.TOPLEFT || this.resizeFrom === ResizeFrom.TOPRIGHT) {
      this.bounds.y += this.bounds.height - desiredHeight;
    }
    this.bounds.height = desiredHeight;

    return [this, ...orderedSwimlanes, ...children.filter((child) => child.type !== BPMNElementType.BPMNSwimlane)];
  }
}
