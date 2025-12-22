import { DeepPartial } from 'redux';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { UMLObjectIcon } from '../uml-object-icon/uml-object-icon';

// Thin wrapper so user-model code can reference a dedicated icon element
export class UMLUserModelIcon extends UMLObjectIcon {
  constructor(values?: DeepPartial<IUMLElement & { icon?: string }>) {
    super(values);
  }
}

export interface IUMLUserModelIcon extends IUMLElement {
  icon?: string;
}
