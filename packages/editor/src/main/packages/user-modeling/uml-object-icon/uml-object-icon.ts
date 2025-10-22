import { ObjectElementType } from '..';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLElementType } from '../../uml-element-type';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';

export interface IUMLObjectAttribute extends IUMLElement {
  attributeId?: string; // ID of the attribute from the library class
}

export class UMLObjectIcon extends UMLElement {
  type: UMLElementType = ObjectElementType.ObjectIcon;
  icon?: string; // Optional icon for the object
  static features = {
    ...UMLElement.features,
    hoverable: false,
    selectable: false,
    movable: false,
    connectable: false,
    droppable: false,
    updatable: false,
  };

  constructor(values?: DeepPartial<IUMLElement & { icon?: string }>) {
    super(values);
    if (values?.icon) {
      this.icon = values.icon
    }
  }
  serialize() {
    return {
      ...super.serialize(),
      icon: this.icon,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    super.deserialize(values, children);
    if ('icon' in values && typeof values.icon === 'string') {
      this.icon = values.icon;
    }
  }

  render(layer: ILayer): ILayoutable[] {
    const radix = 10;
    const width = 20;
    this.bounds.width = Math.max(this.bounds.width, Math.round(width / radix) * radix);
    return [this];
  }
}
