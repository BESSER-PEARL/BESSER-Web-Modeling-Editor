import { DeepPartial } from 'redux';
import { UMLElement } from '../../services/uml-element/uml-element';
import * as Apollon from '../../typings';
import { UMLElementType } from '../uml-element-type';
import { AgentElementType } from './index';

// Palette-only elements used to split the agent sidebar into titled sections,
// mirroring the NN diagram. Both return [] from render() so they never get
// placed on the canvas — they only appear in the preview/palette.

export class AgentSectionTitle extends UMLElement {
  type: UMLElementType = AgentElementType.AgentSectionTitle;

  constructor(values?: DeepPartial<UMLElement>) {
    super(values);
    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 100, height: 40 };
    }
    if (values?.name !== undefined) {
      this.name = values.name;
    }
  }

  serialize(): Apollon.UMLModelElement {
    return {
      ...super.serialize(),
      name: this.name,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T) {
    super.deserialize(values);
    this.name = values.name || '';
  }

  render() {
    return [];
  }
}

export class AgentSectionSeparator extends UMLElement {
  type: UMLElementType = AgentElementType.AgentSectionSeparator;

  constructor(values?: DeepPartial<UMLElement>) {
    super(values);
    this.bounds = { x: 0, y: 0, width: 100, height: 15 };
  }

  render() {
    return [];
  }
}
