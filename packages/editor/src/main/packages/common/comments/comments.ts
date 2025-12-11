import { DeepPartial } from 'redux';
import { CommentsElementType } from '.';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementType } from '../../uml-element-type';
import { GeneralRelationshipType } from '../../uml-relationship-type';

export class Comments extends UMLElement {
  type: UMLElementType = CommentsElementType.Comments;

  static supportedRelationships = [
    GeneralRelationshipType.Link
  ];

  constructor(values?: DeepPartial<IUMLElement>) {
    super(values && !values.bounds ? { ...values, bounds: { x: 0, y: 0, width: 160, height: 50 } } : values);
  }

  render(canvas: ILayer): ILayoutable[] {
    return [this];
  }
}
