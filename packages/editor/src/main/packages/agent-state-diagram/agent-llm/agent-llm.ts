import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import * as Apollon from '../../../typings';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary } from '../../../utils/geometry/boundary';
import { UMLElementType } from '../../uml-element-type';

export type AgentLLMProviderType = 'openai' | 'huggingface' | 'huggingface_api' | 'replicate';

export interface IAgentLLM extends IUMLElement {
  provider: AgentLLMProviderType;
  parameters: Record<string, unknown>;
  num_previous_messages: number;
  global_context: string;
}

export class AgentLLM extends UMLElement implements IAgentLLM {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: false,
    droppable: false,
    selectable: false,
    movable: false,
    hoverable: false,
    connectable: false,
    updatable: false,
  };

  type: UMLElementType = AgentElementType.AgentLLM;
  provider: AgentLLMProviderType = 'openai';
  parameters: Record<string, unknown> = {};
  num_previous_messages: number = 1;
  global_context: string = '';

  bounds: IBoundary = { x: 0, y: 0, width: 0, height: 0 };

  constructor(values?: DeepPartial<IAgentLLM>) {
    super(values);
    assign<IAgentLLM>(this, values);
    if (!this.name) {
      this.name = '';
    }
    if (!this.provider) {
      this.provider = 'openai';
    }
    if (!this.parameters || typeof this.parameters !== 'object') {
      this.parameters = {};
    }
    if (typeof this.num_previous_messages !== 'number') {
      this.num_previous_messages = 1;
    }
    if (typeof this.global_context !== 'string') {
      this.global_context = '';
    }
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  serialize(children?: UMLElement[]): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      provider: this.provider,
      parameters: this.parameters,
      num_previous_messages: this.num_previous_messages,
      global_context: this.global_context,
    } as Apollon.UMLModelElement & {
      provider: AgentLLMProviderType;
      parameters: Record<string, unknown>;
      num_previous_messages: number;
      global_context: string;
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      provider?: AgentLLMProviderType;
      parameters?: Record<string, unknown>;
      num_previous_messages?: number;
      global_context?: string | null;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.provider = (values.provider as AgentLLMProviderType) || 'openai';
    this.parameters =
      values.parameters && typeof values.parameters === 'object' ? values.parameters : {};
    this.num_previous_messages =
      typeof values.num_previous_messages === 'number' ? values.num_previous_messages : 1;
    this.global_context = values.global_context == null ? '' : String(values.global_context);
    this.bounds = { x: 0, y: 0, width: 0, height: 0 };
  }

  render(layer: ILayer): ILayoutable[] {
    return [];
  }
}
