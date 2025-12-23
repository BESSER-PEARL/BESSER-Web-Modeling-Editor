import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UserModelElementType } from '..';
import { UMLElementType } from '../../uml-element-type';

export interface IUMLUserModelIcon extends IUMLElement {
  icon?: string;
}

export class UMLUserModelIcon extends UMLElement {
  type: UMLElementType = UserModelElementType.UserModelIcon;
  icon?: string;

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
      this.icon = values.icon;
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
