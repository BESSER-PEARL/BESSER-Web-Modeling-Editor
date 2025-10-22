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
      bodies: children.filter((x) => x instanceof AgentIntentBody).map((x) => x.id)
    };
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const bodies = children.filter((x): x is AgentIntentBody => x instanceof AgentIntentBody);

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

    let y = this.headerHeight;
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
