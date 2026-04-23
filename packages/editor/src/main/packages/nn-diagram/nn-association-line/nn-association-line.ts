import { UMLAssociation } from '../../common/uml-association/uml-association';
import { NNRelationshipType } from '../index';

// Plain association line for Dataset <-> NNContainer — no arrows, no diamond, no label.
export class NNAssociation extends UMLAssociation {
  type = NNRelationshipType.NNAssociation;
  name: string = '';
}