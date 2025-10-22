import { ClassRelationshipType } from '..';
import { UMLAssociation } from '../../common/uml-association/uml-association';

export class UMLClassOCLLink extends UMLAssociation {
  type = ClassRelationshipType.ClassOCLLink;
}
