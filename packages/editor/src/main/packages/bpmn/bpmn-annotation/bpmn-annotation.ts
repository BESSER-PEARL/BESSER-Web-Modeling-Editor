import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { UMLContainer } from '../../../services/uml-container/uml-container';

export class BPMNAnnotation extends UMLContainer {
  static features: UMLElementFeatures = { ...UMLContainer.features };
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];

  type: UMLElementType = BPMNElementType.BPMNAnnotation;

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
