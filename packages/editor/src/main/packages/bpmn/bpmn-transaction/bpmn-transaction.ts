import { BPMNElementType, BPMNRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { calculateNameBounds } from '../../../utils/name-bounds';
import { UMLElementType } from '../../uml-element-type';
import { UMLPackage } from '../../common/uml-package/uml-package';
import { DeepPartial } from 'redux';
import { assign } from '../../../utils/fx/assign';
import * as Apollon from '../../../typings';

export class BPMNTransaction extends UMLPackage {
  static supportedRelationships = [BPMNRelationshipType.BPMNFlow];
  type: UMLElementType = BPMNElementType.BPMNTransaction;

  isExpanded: boolean = false;

  constructor(values?: DeepPartial<BPMNTransaction>) {
    super(values);
    assign<BPMNTransaction>(this, values);
    this.isExpanded = values?.isExpanded ?? false;
  }

  serialize(): Apollon.BPMNTransaction {
    return {
      ...super.serialize(),
      type: this.type as keyof typeof BPMNElementType,
      isExpanded: this.isExpanded,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { isExpanded?: boolean },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.isExpanded = values.isExpanded ?? false;
  }

  render(canvas: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    if (!this.isExpanded) {
      this.bounds = calculateNameBounds(this, canvas);
      return [this];
    }
    return super.render(canvas, children);
  }
}
