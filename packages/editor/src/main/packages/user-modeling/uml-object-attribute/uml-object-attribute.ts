import { ObjectElementType } from '..';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLElementType } from '../../uml-element-type';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { IUMLElement } from '../../../services/uml-element/uml-element';

export interface IUMLObjectAttribute extends IUMLElement {
  attributeId?: string; // ID of the attribute from the library class
}

export class UMLObjectAttribute extends UMLClassifierAttribute {
  type: UMLElementType = ObjectElementType.ObjectAttribute;
  attributeId?: string; // Store the ID of the attribute from the library class

  

  constructor(values?: DeepPartial<IUMLElement & { attributeId?: string }>) {
    super(values);
    if (values?.attributeId) {
      this.attributeId = values.attributeId;
    }
  }
  serialize() {
    return {
      ...super.serialize(),
      attributeId: this.attributeId,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    super.deserialize(values, children);
    if ('attributeId' in values && typeof values.attributeId === 'string') {
      this.attributeId = values.attributeId;
    }
  }
}
