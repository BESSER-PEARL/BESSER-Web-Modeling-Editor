import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLContainer } from '../../../services/uml-container/uml-container';

export class BPMNCallActivity extends UMLContainer {
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];
  type: UMLElementType = BPMNElementType.BPMNCallActivity;

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
