import { ObjectElementType, ObjectRelationshipType } from '..';
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
import { settingsService } from '../../../services/settings/settings-service';
import { GeneralRelationshipType } from '../../uml-relationship-type';

export interface IUMLObjectName extends IUMLClassifier {
  classId?: string; // ID of the class from the library this object is based on
  className?: string; // Name of the class from the library this object is based on
  icon?: string; // Optional icon for the object
}

export class UMLObjectName extends UMLClassifier implements IUMLObjectName {
  type: UMLElementType = ObjectElementType.ObjectName;
  underline: boolean = true;
  classId?: string; // Store the ID of the class from the library
  className?: string;
  icon?: string; // Optional icon for the object

  static supportedRelationships = [
    ObjectRelationshipType.ObjectLink,
    GeneralRelationshipType.Link,
  ];
  constructor(values?: DeepPartial<IUMLObjectName>) {
    super(values);
    if (values?.classId) {
      this.classId = values.classId;
    }
    if (values?.className) {
      this.className = values.className;
    }
    if (values?.icon) {
      this.icon = values.icon;
    }
  }
  serialize(children: UMLElement[] = []): Apollon.UMLClassifier & { classId?: string, className?: string, icon?: string } {
    const iconChild = children.find(child => (child as any).type === ObjectElementType.ObjectIcon);
    return {
      ...super.serialize(children),
      classId: this.classId,
      className: this.className,
      icon: iconChild ? iconChild.id : undefined,
    };
  }

  deserialize<T extends Apollon.UMLModelElement>(values: T, children?: Apollon.UMLModelElement[]): void {
    super.deserialize(values, children);
    if ('classId' in values && typeof values.classId === 'string') {
      this.classId = values.classId;
    }
    if ('className' in values && typeof values.className === 'string') {
      this.className = values.className;
    }
    if ('icon' in values && typeof values.icon === 'string') {
      this.icon = values.icon;
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
    if (!svgString || typeof svgString !== 'string' || svgString.trim() === '') {
      return { width: 50, height: 50 };
    }
    
    try {
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
    } catch (error) {
      console.warn('Error parsing SVG:', error);
      return { width: 50, height: 50 };
    }
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
    const iconContent = (icon as any).icon;
    if (iconContent && typeof iconContent === 'string' && iconContent.trim() !== '') {
      const size = UMLObjectName.extractSvgSize(iconContent);
      svgWidth = size.width;
      svgHeight = size.height;
    }
    icon.bounds.width = svgWidth;
    icon.bounds.height = svgHeight;
    return { width: svgWidth, height: svgHeight };
  }

  private static finalizeBounds(
    element: UMLObjectName,
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
    // Check if we should show icon view or normal view
    const shouldShowIconView = settingsService.shouldShowIconView();

    if (shouldShowIconView) {
      // Check if there's actually an ObjectIcon with content before using icon view
      const hasValidIcon = children.some((x: any) => 
        x.type === ObjectElementType.ObjectIcon && 
        x.icon && 
        typeof x.icon === 'string' && 
        x.icon.trim() !== ''
      );
      
      if (hasValidIcon) {
        return this.renderIconView(layer, children);
      } else {
        return this.renderNormalView(layer, children);
      }
    } else {
      return this.renderNormalView(layer, children);
    }
  }

  private renderIconView(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
    
    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;
    let y = this.headerHeight;

    this.bounds.height = y;

    const icon = children.find((x: any) => x.type === ObjectElementType.ObjectIcon) as any;
    
    let iconSize = { width: 0, height: 0 };
    if (icon && icon.icon && typeof icon.icon === 'string' && icon.icon.trim() !== '') {
      // Only process the icon if it exists and has valid content
      try {
        iconSize = UMLObjectName.setupIconBounds(icon, this.bounds.height, 50, 50);
        UMLObjectName.finalizeBounds(this, layer, icon, iconSize, y);
      } catch (error) {
        // Fall back to text-only rendering if icon processing fails
        const text = this.name + (this.className ? ": " + this.className : "");
        const textWidth = Text.size(layer, text).width + 40;
        this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
      }
    } else {
      // No icon exists or icon content is invalid - just render text
      const text = this.name + (this.className ? ": " + this.className : "");
      const textWidth = Text.size(layer, text).width + 40;
      this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
    }
    
    // Only include icon in return if it exists and has valid content
    return (icon && icon.icon && typeof icon.icon === 'string' && icon.icon.trim() !== '')
      ? [this, icon]
      : [this];
  }

  private renderNormalView(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    // Use the standard UMLClassifier render method for normal view
    return super.render(layer, children);
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
      iconSize = UMLObjectName.setupIconBounds(icon, this.bounds.height, 50, 50);
      UMLObjectName.finalizeBounds(this, layer, icon, iconSize, y);
    }

    return [this, ...attributes, ...methods, icon];
  }
}
