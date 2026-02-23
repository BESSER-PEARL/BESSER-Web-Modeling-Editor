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

  serialize(children: UMLElement[] = []): Apollon.UMLState {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      bodies: children.filter((x) => x instanceof AgentStateBody).map((x) => x.id),
      fallbackBodies: children.filter((x) => x instanceof AgentStateFallbackBody).map((x) => x.id),
    };
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const bodies = children.filter((x): x is AgentStateBody => x instanceof AgentStateBody);
    const fallbackBodies = children.filter((x): x is AgentStateFallbackBody => x instanceof AgentStateFallbackBody);

    this.hasBody = bodies.length > 0;
    this.hasFallbackBody = fallbackBodies.length > 0;

    const radix = 10;
    const initialWidth = Math.round(this.bounds.width / radix) * radix;
    const computedWidth = [this, ...bodies, ...fallbackBodies].reduce(
      (current, child, index) => {
        const measured = Text.size(layer, child.name, index === 0 ? { fontWeight: 'bold' } : undefined).width + 60;
        const rounded = Math.round(measured / radix) * radix;
        return Math.max(current, rounded);
      },
      initialWidth,
    );

    this.bounds.width = clampAgentStateWidth(computedWidth);

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

    this.bounds.height = y;
    return [this, ...bodies, ...fallbackBodies];
  }
}
