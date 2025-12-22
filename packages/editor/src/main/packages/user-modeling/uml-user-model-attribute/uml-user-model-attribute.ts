import { ObjectElementType } from '..';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLElementType } from '../../uml-element-type';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { IUMLElement } from '../../../services/uml-element/uml-element';

export interface IUMLUserModelAttribute extends IUMLElement {
  attributeId?: string;
}

export class UMLUserModelAttribute extends UMLClassifierAttribute {
  type: UMLElementType = ObjectElementType.ObjectAttribute;
  attributeId?: string;

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
