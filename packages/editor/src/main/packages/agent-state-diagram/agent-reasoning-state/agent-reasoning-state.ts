import { DeepPartial } from 'redux';
import { AgentElementType, AgentRelationshipType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLContainer, UMLContainer } from '../../../services/uml-container/uml-container';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';
import { GeneralRelationshipType } from '../../uml-relationship-type';

const REASONING_STATE_MIN_WIDTH = 120;
const REASONING_STATE_MAX_AUTO_WIDTH = 420;

const clampWidth = (value: number) =>
  Math.max(REASONING_STATE_MIN_WIDTH, Math.min(REASONING_STATE_MAX_AUTO_WIDTH, value));

export interface IAgentReasoningState extends IUMLContainer {
  initial: boolean;
  llm_name: string;
  max_steps: number;
  enable_task_planning: boolean;
  stream_steps: boolean;
  system_prompt: string;
  fallback_message: string;
}

export class AgentReasoningState extends UMLContainer implements IAgentReasoningState {
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    droppable: false,
    resizable: 'WIDTH',
  };
  static headerHeight = 50;
  static supportedRelationships = [
    AgentRelationshipType.AgentStateTransition,
    AgentRelationshipType.AgentStateTransitionInit,
    GeneralRelationshipType.Link,
  ];

  type: UMLElementType = AgentElementType.AgentReasoningState;
  initial: boolean = false;
  llm_name: string = '';
  max_steps: number = 8;
  enable_task_planning: boolean = true;
  stream_steps: boolean = true;
  system_prompt: string = '';
  fallback_message: string = '';

  constructor(values?: DeepPartial<IAgentReasoningState>) {
    super();
    assign<IAgentReasoningState>(this, values);
  }

  serialize(children: UMLElement[] = []): Apollon.UMLModelElement {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      initial: this.initial,
      llm_name: this.llm_name,
      max_steps: this.max_steps,
      enable_task_planning: this.enable_task_planning,
      stream_steps: this.stream_steps,
      system_prompt: this.system_prompt,
      fallback_message: this.fallback_message,
    } as Apollon.UMLModelElement & {
      initial: boolean;
      llm_name: string;
      max_steps: number;
      enable_task_planning: boolean;
      stream_steps: boolean;
      system_prompt: string;
      fallback_message: string;
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      initial?: boolean;
      llm_name?: string;
      max_steps?: number;
      enable_task_planning?: boolean;
      stream_steps?: boolean;
      system_prompt?: string;
      fallback_message?: string;
    },
    children?: Apollon.UMLModelElement[],
  ): void {
    super.deserialize(values, children);
    this.initial = values.initial !== undefined ? values.initial : false;
    this.llm_name = values.llm_name || '';
    this.max_steps = values.max_steps !== undefined ? values.max_steps : 8;
    this.enable_task_planning = values.enable_task_planning !== undefined ? values.enable_task_planning : true;
    this.stream_steps = values.stream_steps !== undefined ? values.stream_steps : true;
    this.system_prompt = values.system_prompt || '';
    this.fallback_message = values.fallback_message || '';
  }

  render(layer: ILayer, _children: ILayoutable[] = []): ILayoutable[] {
    const radix = 10;
    const initialWidth = Math.round(this.bounds.width / radix) * radix;
    const titleWidth = Text.size(layer, this.name, { fontWeight: 'bold' }).width + 80;
    const llmLabel = this.llm_name ? `LLM: ${this.llm_name}` : 'LLM: (set llm_name)';
    const llmWidth = Text.size(layer, llmLabel, { fontWeight: 'normal' }).width + 60;
    const computed = Math.max(
      initialWidth,
      Math.round(titleWidth / radix) * radix,
      Math.round(llmWidth / radix) * radix,
    );
    this.bounds.width = clampWidth(computed);
    this.bounds.height = AgentReasoningState.headerHeight + 30;
    return [this];
  }
}
