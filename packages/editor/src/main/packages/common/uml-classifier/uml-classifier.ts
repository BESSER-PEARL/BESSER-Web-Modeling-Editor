import { DeepPartial } from 'redux';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLContainer, UMLContainer } from '../../../services/uml-container/uml-container';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementFeatures } from '../../../services/uml-element/uml-element-features';
import * as Apollon from '../../../typings';
import { assign } from '../../../utils/fx/assign';
import { Text } from '../../../utils/svg/text';
import { UMLElementType } from '../../uml-element-type';
import { UMLClassifierAttribute } from './uml-classifier-attribute';
import { UMLClassifierMethod } from './uml-classifier-method';
import { UMLClassifierMember } from './uml-classifier-member';

export const CLASSIFIER_MIN_WIDTH = 80;
export const CLASSIFIER_MAX_AUTO_WIDTH = 420;

const clampClassifierWidth = (value: number) =>
  Math.max(CLASSIFIER_MIN_WIDTH, Math.min(CLASSIFIER_MAX_AUTO_WIDTH, value));

export interface IUMLClassifier extends IUMLContainer {
  italic: boolean;
  underline: boolean;
  stereotype: string | null;
  deviderPosition: number;
  hasAttributes: boolean;
  hasMethods: boolean;
}

export abstract class UMLClassifier extends UMLContainer implements IUMLClassifier {
  static features: UMLElementFeatures = {
    ...UMLContainer.features,
    droppable: false,
    resizable: 'WIDTH',
  };
  static stereotypeHeaderHeight = 50;
  static nonStereotypeHeaderHeight = 40;

  italic: boolean = false;
  underline: boolean = false;
  stereotype: string | null = null;
  deviderPosition: number = 0;
  hasAttributes: boolean = false;
  hasMethods: boolean = false;
  className?: string;

  get headerHeight() {
    return this.stereotype ? UMLClassifier.stereotypeHeaderHeight : UMLClassifier.nonStereotypeHeaderHeight;
  }

  constructor(values?: DeepPartial<IUMLClassifier>) {
    super();
    assign<IUMLClassifier>(this, values);
  }

  abstract reorderChildren(children: IUMLElement[]): string[];

  serialize(children: UMLElement[] = []): Apollon.UMLClassifier {
    return {
      ...super.serialize(children),
      type: this.type as UMLElementType,
      attributes: children.filter((x) => x instanceof UMLClassifierAttribute).map((x) => x.id),
      methods: children.filter((x) => x instanceof UMLClassifierMethod).map((x) => x.id),
    };
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);

    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;
    const radix = 10;
    const userWidth = Math.round(this.bounds.width / radix) * radix;

    // Compute the minimum width needed to fit all text without clipping.
    // This is used as a suggestion, but the user can resize smaller — text
    // will be clipped visually instead of forcing the box wider.
    let textFitWidth = CLASSIFIER_MIN_WIDTH;
    for (let i = 0; i < [this, ...attributes, ...methods].length; i++) {
      const child = [this, ...attributes, ...methods][i];
      const displayText = child instanceof UMLClassifierMember
        ? (this.stereotype === 'enumeration' ? child.name : child.displayName)
        : child.name;
      const rawWidth = Text.size(layer, displayText, i === 0 ? { fontWeight: 'bold' } : undefined).width + 20;
      const roundedWidth = Math.round(rawWidth / radix) * radix;
      textFitWidth = Math.max(textFitWidth, roundedWidth);
    }

    if (this.className) {
      const isUserModelElement = this.type === UMLElementType.UserModelName;
      const text = isUserModelElement
        ? this.className
        : this.name + (this.className ? ': ' + this.className : '');
      const rawClassLabelWidth = Text.size(layer, text).width + 40; // add some padding
      const roundedClassLabelWidth = Math.round(rawClassLabelWidth / radix) * radix;
      textFitWidth = Math.max(textFitWidth, roundedClassLabelWidth);
    }

    // Use the larger of user width and min width, but DON'T force wider than
    // the user's current width. This allows the user to resize smaller than
    // the text — overflow is clipped visually by the SVG viewports.
    this.bounds.width = Math.max(CLASSIFIER_MIN_WIDTH, userWidth);

    let y = this.headerHeight;
    for (const attribute of attributes) {
      attribute.bounds.x = 0.5;
      attribute.bounds.y = y + 0.5;
      attribute.bounds.width = this.bounds.width - 1;
      y += attribute.bounds.height;
    }
    this.deviderPosition = y;
    for (const method of methods) {
      method.bounds.x = 0.5;
      method.bounds.y = y + 0.5;
      method.bounds.width = this.bounds.width - 1;
      y += method.bounds.height;
    }
    this.bounds.height = y;
    return [this, ...attributes, ...methods];
  }
}
