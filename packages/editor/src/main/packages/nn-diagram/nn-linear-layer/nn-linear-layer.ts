import { NNElementType, NNRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';
import { NNBaseLayer } from '../nn-base-layer';

export class LinearLayer extends NNBaseLayer {
  type: UMLElementType = NNElementType.LinearLayer;
  name: string = 'LinearLayer';

  constructor(values?: DeepPartial<LinearLayer>) {
    super(values);

    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    }
    if (!values?.name) {
      this.name = 'Linear Layer';
    }
    if (values?.ownedElements) {
      this.ownedElements = values.ownedElements.filter((id): id is string => id !== undefined);
    }
  }

  static supportedRelationships = [
    NNRelationshipType.NNNext,
  ];

  reorderChildren(children: IUMLElement[]): string[] {
    // Preserve all children as-is, no reordering
    return children.filter(child => child && child.id).map(child => child.id);
  }
}
