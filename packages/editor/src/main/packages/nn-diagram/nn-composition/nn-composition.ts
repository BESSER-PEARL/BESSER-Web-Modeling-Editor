import { UMLAssociation, IUMLAssociation } from '../../common/uml-association/uml-association';
import { NNRelationshipType } from '../index';
import { DeepPartial } from 'redux';

export class NNComposition extends UMLAssociation {
  type = NNRelationshipType.NNComposition;
}
