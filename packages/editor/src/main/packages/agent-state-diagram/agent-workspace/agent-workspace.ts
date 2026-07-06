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

const AGENT_WORKSPACE_MIN_WIDTH = 120;
const AGENT_WORKSPACE_DEFAULT_WIDTH = 160;
const AGENT_WORKSPACE_MAX_AUTO_WIDTH = 380;
const AGENT_WORKSPACE_MIN_HEIGHT = 50;

export interface IAgentWorkspace extends IUMLElement {
  path: string;
  description: string;
  writable: boolean;
  max_read_bytes: number;
}

export class AgentWorkspace extends UMLElement implements IAgentWorkspace {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentWorkspace;
  path: string = '';
  description: string = '';
  writable: boolean = true;
  max_read_bytes: number = 200000;

  bounds: IBoundary = {
    ...this.bounds,
    width: 160,
    height: 80,
  };

  constructor(values?: DeepPartial<IAgentWorkspace>) {
    super(values);
    assign<IAgentWorkspace>(this, values);
    if (!this.name) {
      this.name = '';
    }
  }

  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      path: this.path,
      description: this.description,
      writable: this.writable,
      max_read_bytes: this.max_read_bytes,
    } as Apollon.UMLModelElement & {
      path: string;
      description: string;
      writable: boolean;
      max_read_bytes: number;
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & { path?: string; description?: string; writable?: boolean; max_read_bytes?: number },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.path = values.path || '';
    this.description = values.description || '';
    this.writable = values.writable !== undefined ? values.writable : true;
    this.max_read_bytes = values.max_read_bytes !== undefined ? values.max_read_bytes : 200000;
  }

  render(layer: ILayer): ILayoutable[] {
    if (!this.isManuallyLayouted) {
      const titleWidth = Text.size(layer, this.name, { fontWeight: 'bold' }).width + 40;
      const detailSource = this.description || this.path;
      const detailWidth = Text.size(layer, detailSource, { fontWeight: 'normal' }).width + 40;
      const autoWidth = Math.max(AGENT_WORKSPACE_DEFAULT_WIDTH, titleWidth, detailWidth);
      this.bounds.width = Math.max(AGENT_WORKSPACE_MIN_WIDTH, Math.min(AGENT_WORKSPACE_MAX_AUTO_WIDTH, autoWidth));
      this.bounds.height = Math.max(this.bounds.height, 80);
    } else {
      this.bounds.width = Math.max(this.bounds.width, AGENT_WORKSPACE_MIN_WIDTH);
      this.bounds.height = Math.max(this.bounds.height, AGENT_WORKSPACE_MIN_HEIGHT);
    }
    return [this];
  }
}
