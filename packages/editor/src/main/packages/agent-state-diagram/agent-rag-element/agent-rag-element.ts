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

const AGENT_RAG_MIN_WIDTH = 100;
const AGENT_RAG_DEFAULT_WIDTH = 140;
const AGENT_RAG_MAX_AUTO_WIDTH = 340;
const AGENT_RAG_MIN_HEIGHT = 70;

export interface IAgentRagElement extends IUMLElement {
  llm_name: string;
  llm_prompt: string;
  k: number;
  num_previous_messages: number;
}

export class AgentRagElement extends UMLElement implements IAgentRagElement {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    resizable: true,
    droppable: false,
  };

  type: UMLElementType = AgentElementType.AgentRagElement;
  llm_name: string = '';
  llm_prompt: string = '';
  k: number = 4;
  num_previous_messages: number = 0;

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
    if (!this.llm_name) {
      this.llm_name = '';
    }
    if (!this.llm_prompt) {
      this.llm_prompt = '';
    }
    if (typeof this.k !== 'number' || Number.isNaN(this.k) || this.k <= 0) {
      this.k = 4;
    }
    if (
      typeof this.num_previous_messages !== 'number' ||
      Number.isNaN(this.num_previous_messages) ||
      this.num_previous_messages < 0
    ) {
      this.num_previous_messages = 0;
    }
  }

  serialize(children: UMLElement[] = []): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      llm_name: this.llm_name,
      llm_prompt: this.llm_prompt,
      k: this.k,
      num_previous_messages: this.num_previous_messages,
    } as Apollon.UMLModelElement & { llm_name: string };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      llm_name?: string;
      llm_prompt?: string;
      k?: number;
      num_previous_messages?: number;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.llm_name = values.llm_name || '';
    this.llm_prompt = values.llm_prompt || '';
    this.k = typeof values.k === 'number' && values.k > 0 ? values.k : 4;
    this.num_previous_messages =
      typeof values.num_previous_messages === 'number' && values.num_previous_messages >= 0
        ? values.num_previous_messages
        : 0;
  }

  render(layer: ILayer): ILayoutable[] {
    if (!this.isManuallyLayouted) {
      const nameWidth = Text.size(layer, this.name, { fontWeight: 'normal' }).width + 40;
      const autoWidth = Math.max(AGENT_RAG_DEFAULT_WIDTH, nameWidth);
      this.bounds.width = Math.max(AGENT_RAG_MIN_WIDTH, Math.min(AGENT_RAG_MAX_AUTO_WIDTH, autoWidth));
      this.bounds.height = Math.max(this.bounds.height, 110);
    } else {
      this.bounds.width = Math.max(this.bounds.width, AGENT_RAG_MIN_WIDTH);
      this.bounds.height = Math.max(this.bounds.height, AGENT_RAG_MIN_HEIGHT);
    }
    return [this];
  }
}
