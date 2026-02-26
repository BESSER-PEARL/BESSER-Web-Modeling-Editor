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
import { AgentIntentBody } from '../agent-intent-body/agent-intent-body';
import { AGENT_INTENT_DESCRIPTION_HEIGHT } from '../agent-intent-description/agent-intent-description';

export interface IUMLState extends IUMLContainer {
  italic: boolean;
  underline: boolean;
  stereotype: string | null;
  deviderPosition: number;
  hasBody: boolean;
}

export class AgentIntent extends UMLContainer implements IUMLState {
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    droppable: false,
    resizable: 'WIDTH',
  };
  static stereotypeHeaderHeight = 50;
  static nonStereotypeHeaderHeight = 40;

  type: UMLElementType = AgentElementType.AgentIntent;
  italic: boolean = false;
  underline: boolean = false;
  stereotype: string | null = null;
  deviderPosition: number = 0;
  hasBody: boolean = false;
  intent_description: string = "";
  get headerHeight() {
    return this.stereotype ? AgentIntent.stereotypeHeaderHeight : AgentIntent.nonStereotypeHeaderHeight;
  }

  constructor(values?: DeepPartial<IUMLState>) {
    super();
    assign<IUMLState>(this, values);
  }

  reorderChildren(children: IUMLElement[]): string[] {
    const bodies = children.filter((x): x is AgentIntentBody => x.type === AgentElementType.AgentIntentBody);
    return [...bodies.map((element) => element.id)];
  }

  serialize(children: UMLElement[] = []): Apollon.AgentIntent {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      bodies: children.filter((x) => x instanceof AgentIntentBody).map((x) => x.id),
      intent_description: this.intent_description
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(
      values: T & { intent_description?: string },
      children?: Apollon.UMLModelElement[],
    ): void {
      super.deserialize(values, children);
      this.intent_description = values.intent_description || "";
      
    }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const bodies = children.filter((x): x is AgentIntentBody => x instanceof AgentIntentBody);

    const hasIntentDescription = this.intent_description.trim().length > 0;

    this.hasBody = bodies.length > 0;

    const radix = 10;
    this.bounds.width = [this, ...bodies].reduce(
      (current, child, index) =>
        Math.max(
          current,
          Math.round(
            (Text.size(layer, child.name, index === 0 ? { fontWeight: 'bold' } : undefined).width + 110) / radix,
          ) * radix,
        ),
      Math.round(this.bounds.width / radix) * radix,
    );

    if (hasIntentDescription) {
      const descriptionWidth = Math.round(
        (Text.size(layer, this.intent_description, { fontWeight: 'normal' }).width + 110) / radix,
      ) * radix;
      this.bounds.width = Math.max(this.bounds.width, descriptionWidth);
    }

    let y = this.headerHeight;
    if (hasIntentDescription) {
      y += AGENT_INTENT_DESCRIPTION_HEIGHT;
    }
    for (const body of bodies) {
      body.bounds.x = 0.5;
      body.bounds.y = y + 0.5;
      body.bounds.width = this.bounds.width - 1;
      y += body.bounds.height;
    }
   
    this.deviderPosition = y;


    this.bounds.height = y;
    return [this, ...bodies];
  }
}
