import { UMLElement } from '../../services/uml-element/uml-element';
import { DeepPartial } from 'redux';
import * as Apollon from '../../typings';
import { NNElementType } from './index';
import { UMLElementType } from '../uml-element-type';

// Section Title Element - renders as a title in the sidebar
export class NNSectionTitle extends UMLElement {
  type: UMLElementType = NNElementType.NNSectionTitle;

  constructor(values?: DeepPartial<UMLElement>) {
    super(values);
    // Set default bounds if not provided
    if (!values?.bounds) {
      this.bounds = { x: 0, y: 0, width: 100, height: 40 };
    }
    // Ensure name is set
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
    // Return empty array to prevent this element from being placed on canvas
    return [];
  }
}

// Section Separator Element - renders as a divider line in the sidebar
export class NNSectionSeparator extends UMLElement {
  type: UMLElementType = NNElementType.NNSectionSeparator;

  constructor(values?: DeepPartial<UMLElement>) {
    super(values);
    this.bounds = { x: 0, y: 0, width: 100, height: 15 };
  }

  render() {
    // Return empty array to prevent this element from being placed on canvas
    return [];
  }
}
