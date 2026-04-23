import { DeepPartial } from 'redux';
import { NNElementType, NNRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { computeBoundingBoxForElements } from '../../../utils/geometry/boundary';
import { calculateNameBounds } from '../../../utils/name-bounds';

export class NNContainer extends UMLContainer {
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    resizable: true,
    droppable: true,
  };

  type: UMLElementType = NNElementType.NNContainer;

  static supportedRelationships = [
    NNRelationshipType.NNComposition,
    NNRelationshipType.NNAssociation,
  ];

  // Minimum dimensions for the container
  static minWidth = 200;
  static minHeight = 150;
  // Default horizontal size when dropped on canvas (layers side by side)
  static defaultWidth = 800;
  static defaultHeight = 200;

  constructor(values?: Partial<NNContainer>) {
    super();
    this.name = 'NeuralNetwork';
    this.bounds = { x: 0, y: 0, width: NNContainer.defaultWidth, height: NNContainer.defaultHeight };

    if (values) {
      Object.assign(this, values);
    }
  }

  /**
   * Override clone to set tall bounds when dropped from sidebar
   * This allows the sidebar preview to be compact while the dropped element is tall
   */
  clone<T extends UMLElement>(override?: DeepPartial<IUMLElement>): T {
    const cloned = super.clone<T>(override);
    // Set to default tall size when cloned (dropped from sidebar)
    cloned.bounds = {
      ...cloned.bounds,
      width: NNContainer.defaultWidth,
      height: NNContainer.defaultHeight,
    };
    return cloned;
  }

  render(layer: ILayer, children: ILayoutable[] = [], calculateWithoutChildren?: boolean): ILayoutable[] {
    const calculatedNamedBounds = calculateNameBounds(this, layer);

    const absoluteElements = children.map((element) => {
      element.bounds.x += this.bounds.x;
      element.bounds.y += this.bounds.y;
      return element;
    });

    let bounds = computeBoundingBoxForElements([{ bounds: calculatedNamedBounds }, ...absoluteElements]);

    if (calculateWithoutChildren) {
      bounds = calculatedNamedBounds;
    }

    // Ensure minimum dimensions
    bounds.width = Math.max(bounds.width, NNContainer.minWidth);
    bounds.height = Math.max(bounds.height, NNContainer.minHeight);

    const relativeElements = absoluteElements.map((element) => {
      element.bounds.x -= this.bounds.x;
      element.bounds.y -= this.bounds.y;
      return element;
    });

    const deltaX = bounds.x - this.bounds.x;
    const deltaY = bounds.y - this.bounds.y;

    relativeElements.forEach((child) => {
      child.bounds.x -= deltaX;
      child.bounds.y -= deltaY;
    });

    this.bounds = bounds;
    return [this, ...relativeElements];
  }
}
