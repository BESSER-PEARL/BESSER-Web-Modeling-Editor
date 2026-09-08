import { DeepPartial } from 'redux';
import { AgentElementType } from '..';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLContainer, UMLContainer } from '../../../services/uml-container/uml-container';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';
import { AgentStateBody } from '../agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from '../agent-state-fallback-body/agent-state-fallback-body';
import { AgentRelationshipType } from '..';
import { GeneralRelationshipType } from '../../uml-relationship-type';

const AGENT_STATE_MIN_WIDTH = 80;
const AGENT_STATE_MAX_AUTO_WIDTH = 420;

const clampAgentStateWidth = (value: number) =>
  Math.max(AGENT_STATE_MIN_WIDTH, Math.min(AGENT_STATE_MAX_AUTO_WIDTH, value));

export interface IUMLState extends IUMLContainer {
  italic: boolean;
  underline: boolean;
  stereotype: string | null;
  dividerPosition: number;
  hasBody: boolean;
  hasFallbackBody: boolean;
  stateType: string;
  fallbackBodyEnabled: boolean;
  // Reasoning-state fields (only used when stateType = 'reasoning')
  llm_name: string;
  max_steps: number;
  enable_task_planning: boolean;
  stream_steps: boolean;
  system_prompt: string;
  fallback_message: string;
}

export class AgentState extends UMLContainer implements IUMLState {
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    droppable: false,
    resizable: 'WIDTH',
  };
  static stereotypeHeaderHeight = 50;
  static nonStereotypeHeaderHeight = 40;
  static supportedRelationships = [AgentRelationshipType.AgentStateTransition, AgentRelationshipType.AgentStateTransitionInit, GeneralRelationshipType.Link];

  type: UMLElementType = AgentElementType.AgentState;
  italic: boolean = false;
  underline: boolean = false;
  stereotype: string | null = null;
  dividerPosition: number = 0;
  hasBody: boolean = false;
  hasFallbackBody: boolean = false;
  stateType: string = 'standard';
  fallbackBodyEnabled: boolean = false;
  llm_name: string = '';
  max_steps: number = 8;
  enable_task_planning: boolean = true;
  stream_steps: boolean = true;
  system_prompt: string = '';
  fallback_message: string = '';

  get headerHeight() {
    return this.stereotype ? AgentState.stereotypeHeaderHeight : AgentState.nonStereotypeHeaderHeight;
  }

  constructor(values?: DeepPartial<IUMLState>) {
    super();
    assign<IUMLState>(this, values);
  }

  reorderChildren(children: IUMLElement[]): string[] {
    const bodies = children.filter((x): x is AgentStateBody => x.type === AgentElementType.AgentStateBody);
    const fallbackBodies = children.filter((x): x is AgentStateFallbackBody => x.type === AgentElementType.AgentStateFallbackBody);
    return [...bodies.map((element) => element.id), ...fallbackBodies.map((element) => element.id)];
  }

  serialize(children: UMLElement[] = []): Apollon.AgentState {
    const base = super.serialize(children);
    const bodyIds = children.filter((x) => x instanceof AgentStateBody).map((x) => x.id);
    const fallbackIds = children.filter((x) => x instanceof AgentStateFallbackBody).map((x) => x.id);
    const result: Apollon.AgentState = {
      ...base,
      type: this.type as UMLElementType,
      stateType: this.stateType,
      fallbackBodyEnabled: this.fallbackBodyEnabled,
      actions: bodyIds,
      fallbackActions: fallbackIds,
      // Backward-compat aliases so old backend code (if any) still sees the old keys.
      bodies: bodyIds,
      fallbackBodies: fallbackIds,
    };
    if (this.stateType === 'reasoning') {
      result.llm_name = this.llm_name;
      result.max_steps = this.max_steps;
      result.enable_task_planning = this.enable_task_planning;
      result.stream_steps = this.stream_steps;
      result.system_prompt = this.system_prompt;
      result.fallback_message = this.fallback_message;
    }
    return result;
  }

  deserialize<T extends Apollon.UMLModelElement>(
    values: T & {
      stateType?: string;
      fallbackBodyEnabled?: boolean;
      // new keys
      actions?: string[];
      fallbackActions?: string[];
      // old keys (backward compat)
      bodies?: string[];
      fallbackBodies?: string[];
      // reasoning-state fields
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
    this.stateType = values.stateType ?? 'standard';
    this.fallbackBodyEnabled = values.fallbackBodyEnabled !== undefined ? values.fallbackBodyEnabled : true;
    this.llm_name = values.llm_name ?? '';
    this.max_steps = values.max_steps !== undefined ? values.max_steps : 8;
    this.enable_task_planning = values.enable_task_planning !== undefined ? values.enable_task_planning : true;
    this.stream_steps = values.stream_steps !== undefined ? values.stream_steps : true;
    this.system_prompt = values.system_prompt ?? '';
    this.fallback_message = values.fallback_message ?? '';
  }

  static reasoningStateHeight = 80;

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const bodies = children.filter((x): x is AgentStateBody => x instanceof AgentStateBody);
    const fallbackBodies = children.filter((x): x is AgentStateFallbackBody => x instanceof AgentStateFallbackBody);

    this.hasBody = bodies.length > 0;
    this.hasFallbackBody = fallbackBodies.length > 0;

    const radix = 10;

    // Reasoning states have a fixed size — body children are not shown.
    if (this.stateType === 'reasoning') {
      if (!this.isManuallyLayouted) {
        const nameWidth = Text.size(layer, this.name, { fontWeight: 'bold' }).width + 60;
        this.bounds.width = clampAgentStateWidth(Math.round(nameWidth / radix) * radix);
        this.bounds.height = AgentState.reasoningStateHeight;
      }
      this.bounds.width = Math.max(this.bounds.width, AGENT_STATE_MIN_WIDTH);
      this.bounds.height = Math.max(this.bounds.height, 50);
      return [this];
    }

    if (!this.isManuallyLayouted) {
      const initialWidth = Math.round(this.bounds.width / radix) * radix;
      const computedWidth = [this, ...bodies, ...fallbackBodies].reduce(
        (current, child, index) => {
          const styles = index === 0 ? { fontWeight: 'bold' } : undefined;
          const lines = child.name.split('\n');
          const maxLineWidth = lines.reduce((max, line) => {
            return Math.max(max, Text.size(layer, line, styles).width);
          }, 0);
          const measured = maxLineWidth + 60;
          const rounded = Math.round(measured / radix) * radix;
          return Math.max(current, rounded);
        },
        initialWidth,
      );

      this.bounds.width = clampAgentStateWidth(computedWidth);
    } else {
      this.bounds.width = Math.max(this.bounds.width, AGENT_STATE_MIN_WIDTH);
    }

    let y = this.headerHeight;
    for (const body of bodies) {
      body.bounds.x = 0.5;
      body.bounds.y = y + 0.5;
      body.bounds.width = this.bounds.width - 1;
      y += body.bounds.height;
    }
    this.dividerPosition = y;
    for (const fallbackBody of fallbackBodies) {
      fallbackBody.bounds.x = 0.5;
      fallbackBody.bounds.y = y + 0.5;
      fallbackBody.bounds.width = this.bounds.width - 1;
      y += fallbackBody.bounds.height;
    }

    // State height should always follow the current body/fallback rows.
    this.bounds.height = Math.max(y, this.headerHeight);
    return [this, ...bodies, ...fallbackBodies];
  }
}
