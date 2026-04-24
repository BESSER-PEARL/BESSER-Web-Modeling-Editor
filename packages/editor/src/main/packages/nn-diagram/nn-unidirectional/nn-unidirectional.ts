import { UMLAssociation, IUMLAssociation } from '../../common/uml-association/uml-association';
import { NNRelationshipType } from '../index';
import { DeepPartial } from 'redux';

export class NNNext extends UMLAssociation {
  type = NNRelationshipType.NNNext;

  constructor(values?: DeepPartial<IUMLAssociation>) {
    super(values);
    // Always default to "next" if no name is provided
    if (!values?.name) {
      this.name = 'next';
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      name: this.name || 'next',
    };
  }
}
