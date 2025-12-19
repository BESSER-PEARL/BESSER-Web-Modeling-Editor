import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';

export interface IAgentRagElement extends IUMLElement {}

export class AgentRagElement extends UMLElement implements IAgentRagElement {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentRagElement;

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

  render(layer: ILayer): ILayoutable[] {
    const minWidth = Math.max(120, Text.size(layer, this.name, { fontWeight: 'normal' }).width + 40);
    this.bounds.width = Math.max(this.bounds.width, minWidth);
    this.bounds.height = Math.max(this.bounds.height, 110);
    return [this];
  }
}
