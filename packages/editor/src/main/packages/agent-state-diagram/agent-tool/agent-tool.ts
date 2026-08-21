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

const AGENT_TOOL_MIN_WIDTH = 120;
const AGENT_TOOL_DEFAULT_WIDTH = 160;
const AGENT_TOOL_MAX_AUTO_WIDTH = 360;
const AGENT_TOOL_MIN_HEIGHT = 50;

export interface IAgentTool extends IUMLElement {
  description: string;
  code: string;
}

export class AgentTool extends UMLElement implements IAgentTool {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentTool;
  description: string = '';
  code: string = 'def tool_name():\n    pass\n';

  bounds: IBoundary = {
    ...this.bounds,
    width: 160,
    height: 80,
  };

  constructor(values?: DeepPartial<IAgentTool>) {
    super(values);
    assign<IAgentTool>(this, values);
    if (!this.name) {
      this.name = '';
    }
  }

  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      description: this.description,
      code: this.code,
    } as Apollon.UMLModelElement & { description: string; code: string };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { description?: string; code?: string },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.description = values.description || '';
    this.code = values.code || 'def tool_name():\n    pass\n';
  }

  render(layer: ILayer): ILayoutable[] {
    if (!this.isManuallyLayouted) {
      const titleWidth = Text.size(layer, this.name, { fontWeight: 'bold' }).width + 40;
      const descriptionWidth = Text.size(layer, this.description, { fontWeight: 'normal' }).width + 40;
      const autoWidth = Math.max(AGENT_TOOL_DEFAULT_WIDTH, titleWidth, descriptionWidth);
      this.bounds.width = Math.max(AGENT_TOOL_MIN_WIDTH, Math.min(AGENT_TOOL_MAX_AUTO_WIDTH, autoWidth));
      this.bounds.height = Math.max(this.bounds.height, 80);
    } else {
      this.bounds.width = Math.max(this.bounds.width, AGENT_TOOL_MIN_WIDTH);
      this.bounds.height = Math.max(this.bounds.height, AGENT_TOOL_MIN_HEIGHT);
    }
    return [this];
  }
}
