import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import { assign } from '../../../utils/fx/assign';
import { IBoundary, computeDimension } from '../../../utils/geometry/boundary';
import { Text } from '../../../utils/svg/text';
import * as Apollon from '../../../typings';

export abstract class AgentStateMember extends UMLElement {
  static features: UMLElementFeatures = {
    ...UMLElement.features,
    hoverable: false,
    selectable: false,
    movable: false,
    resizable: false,
    connectable: false,
    droppable: false,
    updatable: false,
  };

  bounds: IBoundary = { ...this.bounds, height: computeDimension(1.0, 30) };
  replyType: string = "text";
  
  constructor(values?: DeepPartial<IUMLElement>) {
    super(values);
    assign<IUMLElement>(this, values);
    
  }


  /** Serializes an `UMLElement` to an `Apollon.UMLElement` */
  serialize(children?: UMLElement[]): Apollon.AgentModelElement {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      owner: this.owner,
      bounds: this.bounds,
      highlight: this.highlight,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      textColor: this.textColor,
      assessmentNote: this.assessmentNote,
      replyType: this.replyType,
    };
  }

    deserialize<T extends Apollon.UMLModelElement>(values: T & { replyType : string }) {
      this.id = values.id;
      this.name = values.name;
      this.type = values.type;
      this.owner = values.owner || null;
      this.bounds = { ...values.bounds };
      this.highlight = values.highlight;
      this.fillColor = values.fillColor;
      this.strokeColor = values.strokeColor;
      this.textColor = values.textColor;
      this.assessmentNote = values.assessmentNote;
      this.replyType = values.replyType;
    }

  render(layer: ILayer): ILayoutable[] {
    const radix = 10;
    const width = Text.size(layer, this.name).width + 20;
    this.bounds.width = Math.max(this.bounds.width, Math.round(width / radix) * radix);
    return [this];
  }
} 