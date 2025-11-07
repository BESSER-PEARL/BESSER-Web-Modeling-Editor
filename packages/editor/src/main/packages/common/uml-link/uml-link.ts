import { GeneralRelationshipType } from './general-relationship-type';
import { UMLAssociation } from '../uml-association/uml-association';

export class UMLLink extends UMLAssociation {
  type = GeneralRelationshipType.Link;
}
