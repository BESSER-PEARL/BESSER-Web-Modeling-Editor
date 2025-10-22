import { ObjectElementType } from '..';
import { UMLClassifier, IUMLClassifier } from '../../common/uml-classifier/uml-classifier';
import { UMLElementType } from '../../uml-element-type';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLClassifierMethod } from '../../common/uml-classifier/uml-classifier-method';
import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';

import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { Text } from '../../../utils/svg/text';


export interface IUMLObjectName extends IUMLClassifier {
  classId?: string; // ID of the class from the library this object is based on
  className?: string; // Name of the class from the library
  icon?: string; // Optional icon for the object
}

export class UMLIconObjectName extends UMLClassifier implements IUMLObjectName {
  type: UMLElementType = ObjectElementType.ObjectName;
  underline: boolean = true;
  classId?: string; // Store the ID of the class from the library
  declare className?: string; // Declare to avoid overwrite warning
  icon?: string = undefined; // Initialize to avoid overwrite warning

  constructor(values?: DeepPartial<IUMLObjectName>) {
    super(values);
    if (values?.classId) {
      this.classId = values.classId;
    }
    if (values?.icon) {
      this.icon = values.icon;
    }
    if (values?.className) {
      this.className = values.className;
    }
  }
  serialize(children: UMLElement[] = []): Apollon.UMLClassifier & { classId?: string } & { className?: string } & { icon?: string } {
    return {
      ...super.serialize(children),
      classId: this.classId,
      className: this.className,
      icon: children.find(child => (child as any).type === 'ObjectIcon')?.id,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    super.deserialize(values, children);
    if ('classId' in values && typeof values.classId === 'string') {
      this.classId = values.classId;
    }
    if ('icon' in values && typeof values.icon === 'string') {
      this.icon = values.icon;
    }
    if ('className' in values && typeof values.className === 'string') {
      this.className = values.className;
    }
  }

  reorderChildren(children: IUMLElement[]): string[] {
    const attributes = children.filter(
      (x): x is UMLClassifierAttribute => x.type === ObjectElementType.ObjectAttribute,
    );
    const methods = children.filter((x): x is UMLClassifierMethod => x.type === ObjectElementType.ObjectMethod);
    return [...attributes.map((element) => element.id), ...methods.map((element) => element.id)];
  }

  private static extractSvgSize(svgString: string): { width: number; height: number } {
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    let width = 0, height = 0;
    if (svgElement) {
      const widthAttr = svgElement.getAttribute('width');
      const heightAttr = svgElement.getAttribute('height');
      if (widthAttr) width = parseFloat(widthAttr);
      if (heightAttr) height = parseFloat(heightAttr);
      if ((!width || !height) && svgElement.hasAttribute('viewBox')) {
        const viewBox = svgElement.getAttribute('viewBox')!.split(' ');
        if (viewBox.length === 4) {
          width = width || parseFloat(viewBox[2]);
          height = height || parseFloat(viewBox[3]);
        }
      }
    }
    return {
      width: width || 50,
      height: height || 50,
    };
  }

  private static setupIconBounds(
    icon: ILayoutable,
    baseY: number,
    minWidth: number,
    minHeight: number
  ): { width: number; height: number } {
    icon.bounds.x = 0.5;
    icon.bounds.y = baseY + 0.5 + 5;
    let svgWidth = minWidth, svgHeight = minHeight;
    if ((icon as any).icon && typeof (icon as any).icon === 'string') {
      const size = UMLIconObjectName.extractSvgSize((icon as any).icon);
      svgWidth = size.width;
      svgHeight = size.height;
    }
    icon.bounds.width = svgWidth;
    icon.bounds.height = svgHeight;
    return { width: svgWidth, height: svgHeight };
  }

  private static finalizeBounds(
    element: UMLIconObjectName,
    layer: ILayer,
    icon: ILayoutable | undefined,
    iconSize: { width: number; height: number },
    y: number
  ) {
    // Ensure minimum width/height and add padding
    // Calculate the width of the name + ": " + className text
    const text = element.name + (element.className ? ": " + element.className : "");
    const textWidth = Text.size(layer, text).width + 40; // add some padding

    element.bounds.width = Math.max(element.bounds.width, iconSize.width + 10, textWidth);
    element.bounds.height = y + iconSize.height + 10;
    if (icon) {
      icon.bounds.width = element.bounds.width;
    }
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;
    let y = this.headerHeight;

    this.bounds.height = y;

    const icon = children.find((x: any) => x.type === 'ObjectIcon');
    let iconSize = { width: 0, height: 0 };
    if (icon) {
      iconSize = UMLIconObjectName.setupIconBounds(icon, this.bounds.height, 50, 50);
      UMLIconObjectName.finalizeBounds(this, layer, icon, iconSize, y);
    } else {
      const text = this.name + (this.className ? ": " + this.className : "");
      const textWidth = Text.size(layer, text).width + 40; // add some padding
      this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
    }

    return icon
      ? [this, ...attributes, ...methods, icon]
      : [this, ...attributes, ...methods];
  }

  renderObject(layer: ILayer, children: ILayoutable[] = [], icon: ILayoutable): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;
    let y = this.headerHeight;

    this.bounds.height = y;

    let iconSize = { width: 0, height: 0 };
    if (icon) {
      iconSize = UMLIconObjectName.setupIconBounds(icon, this.bounds.height, 50, 50);
      UMLIconObjectName.finalizeBounds(this, layer, icon, iconSize, y);
    }

    return [this, ...attributes, ...methods, icon];
  }
}
