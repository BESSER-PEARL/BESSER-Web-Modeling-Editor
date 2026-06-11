import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';

export interface IAgentRagElement extends IUMLElement {
  llm_name: string;
}

export class AgentRagElement extends UMLElement implements IAgentRagElement {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentRagElement;
  llm_name: string = '';

  bounds: IBoundary = {
    ...this.bounds,
    width: 140,
    height: 120,
  };

  constructor(values?: DeepPartial<IAgentRagElement>) {
    super(values);
    assign<IAgentRagElement>(this, values);
    if (!this.name) {
      this.name = '';
    }
  }

  serialize(children: UMLElement[] = []): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      llm_name: this.llm_name,
    } as Apollon.UMLModelElement & { llm_name: string };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { llm_name?: string },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.llm_name = values.llm_name || '';
  }

  render(layer: ILayer): ILayoutable[] {
    const minWidth = Math.max(120, Text.size(layer, this.name, { fontWeight: 'normal' }).width + 40);
    this.bounds.width = Math.max(this.bounds.width, minWidth);
    this.bounds.height = Math.max(this.bounds.height, 110);
    return [this];
  }
}
