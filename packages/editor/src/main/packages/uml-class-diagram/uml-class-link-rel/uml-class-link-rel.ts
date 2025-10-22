import { ClassRelationshipType } from '..';
import { UMLAssociation } from '../../common/uml-association/uml-association';

export class UMLClassLinkRel extends UMLAssociation {
  type = ClassRelationshipType.ClassLinkRel;
}
