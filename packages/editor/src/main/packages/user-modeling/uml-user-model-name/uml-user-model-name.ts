import { DeepPartial } from 'redux';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLIconObjectName, IUMLObjectName } from '../uml-icon-object-name/uml-icon-object-name';

// Wrapper to give user-modeling its own named element while reusing object rendering
export class UMLUserModelName extends UMLIconObjectName {
  constructor(values?: DeepPartial<IUMLObjectName>) {
    super(values);
  }
}

// Keep the same shape as the underlying object name without duplicating UMLElement members
export type IUMLUserModelName = IUMLObjectName;
