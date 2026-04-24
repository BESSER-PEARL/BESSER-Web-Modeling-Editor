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
    // The constructor already supplies the default label, so don't re-coerce
    // an empty name back to 'next' here — an empty label means the user
    // explicitly cleared it in the popup and we should export what they see.
    return {
      ...super.serialize(),
      name: this.name,
    };
  }
}
