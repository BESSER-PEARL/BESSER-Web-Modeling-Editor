import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import * as Apollon from '../../../typings';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';

export interface IAgentSkill extends IUMLElement {
  content: string;
  description: string;
}

export class AgentSkill extends UMLElement implements IAgentSkill {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentSkill;
  content: string = '';
  description: string = '';

  bounds: IBoundary = {
    ...this.bounds,
    width: 160,
    height: 80,
  };

  constructor(values?: DeepPartial<IAgentSkill>) {
    super(values);
    assign<IAgentSkill>(this, values);
    if (!this.name) {
      this.name = '';
    }
  }

  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      content: this.content,
      description: this.description,
    } as Apollon.UMLModelElement & { content: string; description: string };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { content?: string; description?: string },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.content = values.content || '';
    this.description = values.description || '';
  }

  render(layer: ILayer): ILayoutable[] {
    const minWidth = Math.max(140, Text.size(layer, this.name, { fontWeight: 'bold' }).width + 40);
    this.bounds.width = Math.max(this.bounds.width, minWidth);
    this.bounds.height = Math.max(this.bounds.height, 80);
    return [this];
  }
}
