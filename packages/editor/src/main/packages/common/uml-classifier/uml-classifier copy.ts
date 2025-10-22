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

  get headerHeight() {
    return this.stereotype ? UMLClassifier.stereotypeHeaderHeight : UMLClassifier.nonStereotypeHeaderHeight;
  }

  constructor(values?: DeepPartial<IUMLClassifier>) {
    super();
    assign<IUMLClassifier>(this, values);
  }

  abstract reorderChildren(children: IUMLElement[]): string[];

  serialize(children: UMLElement[] = []): Apollon.UMLClassifier {
    for (const child of children) {
      if (String(child.type) == "ObjectIcon") {
        return {
          ...super.serialize(children),
          type: this.type as UMLElementType,
          attributes: children.filter((x) => x instanceof UMLClassifierAttribute).map((x) => x.id),
          methods: children.filter((x) => x instanceof UMLClassifierMethod).map((x) => x.id),
          // i think this is wrong
          icon: (child as any).id ? (child as any).id : undefined, // Assuming icon is a property of the child
        };

      }
    }
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
    this.bounds.width = [this, ...attributes, ...methods].reduce(
      (current, child, index) =>
        Math.max(
          current,
          Math.round(
            (Text.size(layer, child.name, index === 0 ? { fontWeight: 'bold' } : undefined).width + 20) / radix,
          ) * radix,
        ),
      Math.round(this.bounds.width / radix) * radix,
    );

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

    const icon = children.find((x: any) => x.type === 'ObjectIcon');
    if (icon) {
      icon.bounds.x = 0.5;
      icon.bounds.y = this.bounds.height + 0.5 + 5;

      if ((icon as any).icon && typeof (icon as any).icon === 'string') {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString((icon as any).icon, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        if (svgElement) {
          let svgWidth = 0;
          let svgHeight = 0;
          const widthAttr = svgElement.getAttribute('width');
          const heightAttr = svgElement.getAttribute('height');
          if (widthAttr) {
            svgWidth = parseFloat(widthAttr);
          }
          if (heightAttr) {
            svgHeight = parseFloat(heightAttr);
          }
          if ((!svgWidth || !svgHeight) && svgElement.hasAttribute('viewBox')) {
            const viewBox = svgElement.getAttribute('viewBox')!.split(' ');
            if (viewBox.length === 4) {
              svgWidth = svgWidth || parseFloat(viewBox[2]);
              svgHeight = svgHeight || parseFloat(viewBox[3]);
            }
          }
          icon.bounds.height = svgHeight;
          console.log("icon bounds width", icon.bounds.width)
          this.bounds.height += svgHeight + 10;
          if(svgWidth > this.bounds.width) {
            this.bounds.width = svgWidth + 10;
            icon.bounds.width = svgWidth;
          } else {
            icon.bounds.width = this.bounds.width - 10;
          }
          console.log(this.bounds.width, icon.bounds.width);
        }
      }
    }
    if (icon) {
      return [this, ...attributes, ...methods, icon];
    }
    return [this, ...attributes, ...methods];
  }

  renderObject(layer: ILayer, children: ILayoutable[] = [], icon: ILayoutable): ILayoutable[] {
    //const icon = children.find((x) => x instanceof UMLElement && x.icon);
    console.log("renderObjectIcon ")
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;

    const radix = 10;
    this.bounds.width = [this, ...attributes, ...methods].reduce(
      (current, child, index) =>
        Math.max(
          current,
          Math.round(
            (Text.size(layer, child.name, index === 0 ? { fontWeight: 'bold' } : undefined).width + 20) / radix,
          ) * radix,
        ),
      Math.round(this.bounds.width / radix) * radix,
    );

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

    icon.bounds.x = 0.5;
    icon.bounds.y = y + 0.5;
    icon.bounds.width = Math.max(icon.bounds.width, 50);
    icon.bounds.height = Math.max(icon.bounds.height, 50);
    this.bounds.width = Math.max(this.bounds.width, icon.bounds.width + 10);
    icon.bounds.width = this.bounds.width;
    this.bounds.x = 0.5;


    this.bounds.height = y;
    if (icon && (icon as any).icon && typeof (icon as any).icon === 'string') {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString((icon as any).icon, 'image/svg+xml');
      const svgElement = svgDoc.querySelector('svg');
      if (svgElement) {
        // Try to get width and height from attributes
        let svgWidth = 0;
        let svgHeight = 0;
        const widthAttr = svgElement.getAttribute('width');
        const heightAttr = svgElement.getAttribute('height');
        if (widthAttr) {
          svgWidth = parseFloat(widthAttr);
        }
        if (heightAttr) {
          svgHeight = parseFloat(heightAttr);
        }
        // If width/height not set, try viewBox
        if ((!svgWidth || !svgHeight) && svgElement.hasAttribute('viewBox')) {
          const viewBox = svgElement.getAttribute('viewBox')!.split(' ');
          if (viewBox.length === 4) {
            svgWidth = svgWidth || parseFloat(viewBox[2]);
            svgHeight = svgHeight || parseFloat(viewBox[3]);
          }
        }
        // Fallback to minimum size if still not set
        svgWidth = svgWidth || 50;
        svgHeight = svgHeight || 50;
        icon.bounds.width = svgWidth;
        icon.bounds.height = svgHeight;

        this.bounds.width = Math.max(this.bounds.width, svgWidth + 10);
        this.bounds.height += svgHeight + 10;
        icon.bounds.width = this.bounds.width;
      }
    }

    return [this, ...attributes, ...methods, icon];
  }
}
