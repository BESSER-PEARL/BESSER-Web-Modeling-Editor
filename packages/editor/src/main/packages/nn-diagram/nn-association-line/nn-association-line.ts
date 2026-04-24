import { UMLAssociation, IUMLAssociation } from '../../common/uml-association/uml-association';
import { NNRelationshipType } from '../index';
import { DeepPartial } from 'redux';

// Plain association line for Dataset <-> NNContainer — no arrows, no diamond, no label.
export class NNAssociation extends UMLAssociation {
  type = NNRelationshipType.NNAssociation;

  constructor(values?: DeepPartial<IUMLAssociation>) {
    super(values);
    // Do NOT redeclare `name` as a class field: in TS, field initializers run
    // after super(values), and would silently overwrite caller-supplied names.
    if (!values?.name) {
      this.name = '';
    }
  }
}