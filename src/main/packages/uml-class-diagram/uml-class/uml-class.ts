import { ClassElementType } from '..';
import { UMLClassifier } from '../../common/uml-classifier/uml-classifier';
import { UMLElementType } from '../../uml-element-type';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLClassifierMethod } from '../../common/uml-classifier/uml-classifier-method';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { ClassRelationshipType } from '..';
export class UMLClass extends UMLClassifier {
  type: UMLElementType = ClassElementType.Class;

  static supportedRelationships = [
    ClassRelationshipType.ClassBidirectional,
    ClassRelationshipType.ClassOCLLink,
    ClassRelationshipType.ClassAggregation,
    ClassRelationshipType.ClassDependency,
    ClassRelationshipType.ClassComposition,
    ClassRelationshipType.ClassUnidirectional,
    ClassRelationshipType.ClassInheritance,
    ClassRelationshipType.ClassRealization,
  ];

  reorderChildren(children: IUMLElement[]): string[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x.type === ClassElementType.ClassAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x.type === ClassElementType.ClassMethod);
    return [...attributes.map((element) => element.id), ...methods.map((element) => element.id)];
  }
}
