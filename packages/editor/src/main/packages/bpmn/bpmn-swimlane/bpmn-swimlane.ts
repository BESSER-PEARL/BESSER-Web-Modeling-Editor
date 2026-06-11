import { BPMNElementType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLContainer } from '../../../services/uml-container/uml-container';

export class BPMNSwimlane extends UMLContainer {
  static DEFAULT_HEIGHT = 80;
  static MIN_WIDTH = 80;
  static MIN_HEIGHT = 80;
  // Header strip width (canvas coords within the lane). Children must keep
  // bounds.x >= lane.bounds.x + LANE_HEADER_WIDTH so the rotated lane name
  // stays readable.
  static LANE_HEADER_WIDTH = 30;

  static features: UMLElementFeatures = {
    ...UMLElement.features,
    droppable: true,
    movable: false,
    connectable: false,
    updatable: false,
    resizable: 'HEIGHT',
  };

  type: UMLElementType = BPMNElementType.BPMNSwimlane;

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    if (this.bounds.width < BPMNSwimlane.MIN_WIDTH) {
      this.bounds.width = BPMNSwimlane.MIN_WIDTH;
    }

    if (this.bounds.height < BPMNSwimlane.MIN_HEIGHT) {
      this.bounds.height = BPMNSwimlane.MIN_HEIGHT;
    }
    // Keep child elements out of the header strip so the lane name stays
    // readable. Children whose left edge would land inside the header are
    // snapped to the body's left edge on the next layout pass.
    const minChildX = this.bounds.x + BPMNSwimlane.LANE_HEADER_WIDTH;
    for (const child of children) {
      if (child === this) continue;
      if (child.bounds.x < minChildX) {
        child.bounds.x = minChildX;
      }
    }
    return [this, ...children];
  }
}
