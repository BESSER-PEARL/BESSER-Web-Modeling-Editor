import { DeepPartial } from 'redux';
import { ObjectRelationshipType } from '..';
import { UMLRelationship, IUMLRelationship } from '../../../services/uml-relationship/uml-relationship';
import * as Apollon from '../../../typings';
import { IUMLObjectLink } from '../../../typings';

export class UMLObjectLink extends UMLRelationship implements IUMLObjectLink {
  type = ObjectRelationshipType.ObjectLink;
  associationId?: string;

  constructor(values?: DeepPartial<IUMLObjectLink>) {
    super(values);
    if (values?.associationId) {
      this.associationId = values.associationId;
    }
  }

  serialize(): Apollon.UMLRelationship & { associationId?: string } {
    return {
      ...super.serialize(),
      associationId: this.associationId,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]) {
    super.deserialize(values, children);
    if ('associationId' in values && typeof values.associationId === 'string') {
      this.associationId = values.associationId;
    }
  }
}
