import { DeepPartial } from 'redux';
import * as Apollon from '../../../typings';
import { UMLClassifier, IUMLClassifier, CLASSIFIER_MAX_AUTO_WIDTH, CLASSIFIER_MIN_WIDTH } from '../../common/uml-classifier/uml-classifier';
import { UMLClassifierAttribute } from '../../common/uml-classifier/uml-classifier-attribute';
import { UMLClassifierMethod } from '../../common/uml-classifier/uml-classifier-method';
import { UserModelElementType, UserModelRelationshipType } from '..';
import { UMLElementType } from '../../uml-element-type';
import { ILayer } from '../../../services/layouter/layer';
import { ILayoutable } from '../../../services/layouter/layoutable';
import { IUMLElement, UMLElement } from '../../../services/uml-element/uml-element';
import { Text } from '../../../utils/svg/text';
import { settingsService } from '../../../services/settings/settings-service';
import { GeneralRelationshipType } from '../../uml-relationship-type';
import { UserPersonalizationSpec, isUserPersonalizationSpec } from '../personalization-spec';
import { resolveUserModelChipIcon } from '../attribute-palette-config';

export interface IUMLUserModelName extends IUMLClassifier {
  classId?: string;
  className?: string;
  icon?: string;
  displayLabel?: string;
  personalization?: UserPersonalizationSpec;
}

export class UMLUserModelName extends UMLClassifier implements IUMLUserModelName {
  type: UMLElementType = UserModelElementType.UserModelName;
  underline: boolean = true;
  classId?: string;
  className?: string;
  icon?: string;
  /**
   * Optional header override. Used by attribute-level palette chips (e.g. a
   * `gender` chip) so the node can display the attribute name while still being
   * a real instance of its container class (`classId`/`className` unchanged) —
   * keeping serialization and downstream generation intact.
   */
  displayLabel?: string;
  /**
   * Profile-level personalization spec (content / presentation / modality).
   * Set on the root `User` box; the webapp aggregation collapses it plus the
   * attribute-level specs into the agent configuration. See personalization-spec.ts.
   */
  personalization?: UserPersonalizationSpec;

  static supportedRelationships = [
    UserModelRelationshipType.UserModelLink,
    GeneralRelationshipType.Link,
  ];

  constructor(values?: DeepPartial<IUMLUserModelName>) {
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
    if (values?.displayLabel) {
      this.displayLabel = values.displayLabel;
    }
    if (isUserPersonalizationSpec(values?.personalization)) {
      this.personalization = values!.personalization as UserPersonalizationSpec;
    }
  }

  serialize(children: UMLElement[] = []): Apollon.UMLClassifier & {
    classId?: string;
    className?: string;
    icon?: string;
    displayLabel?: string;
    personalization?: UserPersonalizationSpec;
  } {
    const iconChild = children.find((child) => child.type === UserModelElementType.UserModelIcon);
    return {
      ...super.serialize(children),
      classId: this.classId,
      className: this.className,
      icon: iconChild ? iconChild.id : undefined,
      displayLabel: this.displayLabel,
      personalization: this.personalization,
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
    if ('displayLabel' in values && typeof (values as any).displayLabel === 'string') {
      this.displayLabel = (values as any).displayLabel;
    }
    if ('personalization' in values && isUserPersonalizationSpec((values as any).personalization)) {
      this.personalization = (values as any).personalization;
    }
  }

  reorderChildren(children: IUMLElement[]): string[] {
    const attributes = children.filter(
      (x): x is UMLClassifierAttribute => x.type === UserModelElementType.UserModelAttribute,
    );
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
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
      let width = 0;
      let height = 0;
      if (svgElement) {
        const widthAttr = svgElement.getAttribute('width');
        const heightAttr = svgElement.getAttribute('height');
        if (widthAttr) {
          width = parseFloat(widthAttr);
        }
        if (heightAttr) {
          height = parseFloat(heightAttr);
        }
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
      return { width: 50, height: 50 };
    }
  }

  private static setupIconBounds(
    icon: ILayoutable,
    baseY: number,
    minWidth: number,
    minHeight: number,
    contentOverride?: string,
  ): { width: number; height: number } {
    icon.bounds.x = 0.5;
    icon.bounds.y = baseY + 0.5 + 5;
    let svgWidth = minWidth;
    let svgHeight = minHeight;
    // Prefer the actually-rendered SVG (a value-cue composite is taller/wider
    // than the stored glyph) so the box grows to fit exactly what is drawn.
    const iconContent =
      contentOverride && contentOverride.trim() !== '' ? contentOverride : (icon as any).icon;
    if (iconContent && typeof iconContent === 'string' && iconContent.trim() !== '') {
      const size = UMLUserModelName.extractSvgSize(iconContent);
      svgWidth = size.width;
      svgHeight = size.height;
    }
    icon.bounds.width = svgWidth;
    icon.bounds.height = svgHeight;
    return { width: svgWidth, height: svgHeight };
  }

  private static finalizeBounds(
    element: UMLUserModelName,
    layer: ILayer,
    icon: ILayoutable | undefined,
    iconSize: { width: number; height: number },
    y: number,
  ) {
    const text = element.className || element.name;
    const textWidth = Text.size(layer, text).width + 40;

    element.bounds.width = Math.max(element.bounds.width, iconSize.width + 10, textWidth);
    element.bounds.height = y + iconSize.height + 10;
    if (icon) {
      icon.bounds.width = element.bounds.width;
    }

    element.bounds.width = Math.max(
      CLASSIFIER_MIN_WIDTH,
      Math.min(CLASSIFIER_MAX_AUTO_WIDTH, element.bounds.width),
    );
  }

  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const shouldShowIconView = settingsService.shouldShowIconView();

    if (shouldShowIconView) {
      const hasValidIcon = children.some(
        (x: any) =>
          x.type === UserModelElementType.UserModelIcon &&
          x.icon &&
          typeof x.icon === 'string' &&
          x.icon.trim() !== '',
      );

      if (hasValidIcon) {
        return this.renderIconView(layer, children);
      }
      return this.renderNormalView(layer, children);
    }

    return this.renderNormalView(layer, children);
  }

  private renderIconView(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);
    this.hasAttributes = attributes.length > 0;
    this.hasMethods = methods.length > 0;
    let y = this.headerHeight;

    this.bounds.height = y;

    const icon = children.find((x: any) => x.type === UserModelElementType.UserModelIcon) as any;

    // The rendered icon may be a value-cue composite (glyph + value text) that is
    // taller/wider than the stored glyph. Resolve it here with the same helper the
    // React component uses, so the box is sized to fit exactly what gets drawn.
    const composite = resolveUserModelChipIcon({
      className: this.className,
      displayLabel: this.displayLabel,
      fallbackIcon: icon && typeof icon.icon === 'string' ? icon.icon : undefined,
      attributeNames: attributes
        .map((attribute) => attribute.name)
        .filter((name): name is string => typeof name === 'string'),
    });

    let iconSize = { width: 0, height: 0 };
    if (icon && icon.icon && typeof icon.icon === 'string' && icon.icon.trim() !== '') {
      try {
        iconSize = UMLUserModelName.setupIconBounds(icon, this.bounds.height, 50, 50, composite ?? undefined);
        UMLUserModelName.finalizeBounds(this, layer, icon, iconSize, y);
      } catch (error) {
        const text = this.className || this.name;
        const textWidth = Text.size(layer, text).width + 40;
        this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
      }
    } else {
      const text = this.className || this.name;
      const textWidth = Text.size(layer, text).width + 40;
      this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
    }

    return icon && icon.icon && typeof icon.icon === 'string' && icon.icon.trim() !== '' ? [this, icon] : [this];
  }

  private renderNormalView(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
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
      iconSize = UMLUserModelName.setupIconBounds(icon, this.bounds.height, 50, 50);
      UMLUserModelName.finalizeBounds(this, layer, icon, iconSize, y);
    }

    return [this, ...attributes, ...methods, icon];
  }
}
