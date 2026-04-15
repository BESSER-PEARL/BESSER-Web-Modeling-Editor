import { NNElementType, NNRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';
import { NNBaseLayer } from '../nn-base-layer';

export class PoolingLayer extends NNBaseLayer {
  type: UMLElementType = NNElementType.PoolingLayer;
  name: string = 'PoolingLayer';

  constructor(values?: DeepPartial<PoolingLayer>) {
    super(values);

    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    }
    if (!values?.name) {
      this.name = 'Pooling Layer';
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
