import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { UMLElementType } from '../../uml-element-type';
import { UMLContainer } from '../../../services/uml-container/uml-container';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { DeepPartial } from 'redux';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';

export class BPMNCallActivity extends UMLContainer {
  // CallActivity references an external process — it is not an inner container.
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    droppable: false,
  };

  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];
  type: UMLElementType = BPMNElementType.BPMNCallActivity;

  calledElement: string = '';

  constructor(values?: DeepPartial<BPMNCallActivity>) {
    super(values);
    assign<BPMNCallActivity>(this, values);
    this.calledElement = values?.calledElement ?? '';
  }

  serialize(): Apollon.BPMNCallActivity {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof BPMNElementType,
      calledElement: this.calledElement,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { calledElement?: string },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.calledElement = values.calledElement ?? '';
  }

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
