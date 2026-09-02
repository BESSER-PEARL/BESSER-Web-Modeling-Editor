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

const AGENT_SKILL_MIN_WIDTH = 120;
const AGENT_SKILL_DEFAULT_WIDTH = 160;
const AGENT_SKILL_MAX_AUTO_WIDTH = 360;
const AGENT_SKILL_MIN_HEIGHT = 50;

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

  render(_layer: ILayer): ILayoutable[] {
    return [];
  }
}
