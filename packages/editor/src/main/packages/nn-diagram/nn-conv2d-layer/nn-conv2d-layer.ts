import { NNElementType, NNRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement } from '../../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';
import { NNBaseLayer } from '../nn-base-layer';

// Conv2D Layer implementation
export class Conv2DLayer extends NNBaseLayer {
  type: UMLElementType = NNElementType.Conv2DLayer;

  // Do NOT redeclare `name` with a class-field initializer. In TS it runs
  // *after* super(values), overwriting whatever the caller passed in. Leave
  // naming to the constructor fallback below.

  constructor(values?: DeepPartial<Conv2DLayer>) {
    super(values);

    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 0, height: 0 };
    }
    if (!values?.name) {
      this.name = 'Conv2D Layer';
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
