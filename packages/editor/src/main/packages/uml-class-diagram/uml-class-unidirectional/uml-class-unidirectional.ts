import { DeepPartial } from 'redux';
import { ClassRelationshipType } from '..';
import { IUMLAssociation, UMLAssociation } from '../../common/uml-association/uml-association';

/**
 * Legacy "unidirectional association". The type is no longer offered in the
 * editor: an instance built from legacy data becomes a plain association
 * (`ClassBidirectional`) whose source end is not navigable and whose target end
 * is navigable, unless the data already carries explicit `navigable` flags.
 */
export class UMLClassUnidirectional extends UMLAssociation {
  type = ClassRelationshipType.ClassBidirectional;

  constructor(values?: DeepPartial<IUMLAssociation>) {
    super(values);
    this.type = ClassRelationshipType.ClassBidirectional;
    if (typeof values?.source?.navigable !== 'boolean') {
      this.source.navigable = false;
    }
    if (!this.source.navigable && !this.target.navigable) {
      this.target.navigable = true;
    }
  }
}
