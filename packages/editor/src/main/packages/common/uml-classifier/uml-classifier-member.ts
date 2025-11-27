import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary, computeDimension } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import * as Apollon from '../../../typings';

export interface IUMLClassifierMember extends IUMLElement {
  code?: string;
}

export abstract class UMLClassifierMember extends UMLElement implements IUMLClassifierMember {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    hoverable: false,
    selectable: false,
    movable: false,
    resizable: false,
    connectable: false,
    droppable: false,
    updatable: false,
  };

  bounds: IBoundary = { ...this.bounds, height: computeDimension(1.0, 30) };
  code: string = '';

  constructor(values?: DeepPartial<IUMLClassifierMember>) {
    super(values);
    assign<IUMLClassifierMember>(this, values);
  }

  /** Serializes an `UMLClassifierMember` to an `Apollon.UMLModelElement` */
  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      code: this.code,
    } as Apollon.UMLModelElement;
  }

  /** Deserializes an `Apollon.UMLModelElement` to an `UMLClassifierMember` */
  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]) {
    super.deserialize(values, children);
    const valuesWithCode = values as T & { code?: string };
    this.code = valuesWithCode.code || '';
  }

  render(layer: ILayer): ILayoutable[] {
    const radix = 10;
    const width = Text.size(layer, this.name).width + 20;
    this.bounds.width = Math.max(this.bounds.width, Math.round(width / radix) * radix);
    return [this];
  }
}
