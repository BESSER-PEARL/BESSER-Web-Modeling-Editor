import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { computeDimension } from '../../utils/geometry/boundary';
import { ComposePreview } from '../compose-preview';
import { UMLUserModelAttribute } from './uml-user-model-attribute/uml-user-model-attribute';
import { UMLUserModelIcon } from './uml-user-model-icon/uml-user-model-icon';
import { UMLUserModelName } from './uml-user-model-name/uml-user-model-name';
import { diagramBridge } from '../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../services/settings/settings-service';
import { getAttributePaletteConfig } from './attribute-palette-config';
import { isHiddenUserModelContainer } from './hidden-containers';
import { IClassInfo, IAttributeInfo } from '../../services/diagram-bridge/diagram-bridge-service';

// User-model preview based on the object-diagram logic but using user-modeling elements.
export const composeUserModelPreview: ComposePreview = (
  layer: ILayer,
): UMLElement[] => {
  const shouldShowIconView = settingsService.shouldShowIconView();
  return shouldShowIconView ? composeIconView(layer) : composeNormalView(layer);
};

/**
 * Attributes of a class that are exposed as their own draggable palette chip
 * (via ATTRIBUTE_PALETTE_CONFIG). A class with at least one is "decomposed"
 * into chips instead of being drawn as a single grouping box.
 */
const configuredAttributes = (classInfo: IClassInfo): IAttributeInfo[] =>
  classInfo.attributes.filter((attr) => getAttributePaletteConfig(classInfo.name, attr.name));

/**
 * Build one draggable attribute chip: a real `UMLUserModelName` instance of the
 * container class carrying a single attribute + its icon. `displayLabel` makes
 * the header show the attribute label (e.g. "gender") rather than the class
 * name — the serialized element is otherwise identical to a class node, so the
 * B-UML model is unchanged.
 */
const buildAttributeChip = (
  layer: ILayer,
  classInfo: IClassInfo,
  attr: IAttributeInfo,
  x: number,
  width: number,
  height: number,
): UMLElement[] => {
  const config = getAttributePaletteConfig(classInfo.name, attr.name)!;
  const chip = new UMLUserModelName({
    name: `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`,
    classId: classInfo.id,
    className: classInfo.name,
    displayLabel: config.label,
    icon: config.icons.default,
  });
  chip.bounds = { ...chip.bounds, x, y: 0, width, height };

  const attribute = new UMLUserModelAttribute({
    name: `${attr.name} = `,
    owner: chip.id,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    attributeId: attr.id,
  });
  const iconElement = new UMLUserModelIcon({
    name: 'icon',
    owner: chip.id,
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    icon: config.icons.default,
  });

  chip.ownedElements = [attribute.id, iconElement.id];
  return chip.renderObject(layer, [attribute], iconElement) as UMLElement[];
};

const composeIconView = (layer: ILayer): UMLElement[] => {
  const elements: UMLElement[] = [];
  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) return elements;

  // Empty container groupings (Competence/Accessibility) carry no attributes and
  // are hidden from the canvas — skip them in the palette too.
  const availableClasses = diagramBridge
    .getAvailableClasses()
    .filter((classInfo) => !isHiddenUserModelContainer(classInfo.name));
  const width = computeDimension(1.0, 100);
  const height = computeDimension(1.0, 25);
  let currentX = 0;

  availableClasses.forEach((classInfo) => {
    // Classes with configured attributes (Personal_Information) are exposed as
    // one chip per attribute (age, gender, nationality). Everything else stays
    // a single grouping box with its original class icon.
    const chips = configuredAttributes(classInfo);
    if (chips.length > 0) {
      chips.forEach((attr) => {
        elements.push(...buildAttributeChip(layer, classInfo, attr, currentX, width, height));
        currentX += width + 50;
      });
      return;
    }

    const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
    const instanceUser = new UMLUserModelName({
      name: instanceName,
      classId: classInfo.id,
      className: classInfo.name,
      icon: classInfo.icon,
    });

    instanceUser.bounds = {
      ...instanceUser.bounds,
      x: currentX,
      y: 0,
      width,
      height,
    };

    const instanceAttributes: UMLUserModelAttribute[] = [];
    let iconElement: UMLUserModelIcon | null = null;

    if (instanceUser.icon) {
      iconElement = new UMLUserModelIcon({
        name: 'icon',
        owner: instanceUser.id,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        icon: instanceUser.icon,
      });
    }

    classInfo.attributes.forEach((attr) => {
      const attribute = new UMLUserModelAttribute({
        name: `${attr.name} = `,
        owner: instanceUser.id,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        attributeId: attr.id,
      });
      instanceAttributes.push(attribute);
    });

    instanceUser.ownedElements = instanceAttributes.map((attr) => attr.id);
    if (iconElement) {
      instanceUser.ownedElements.push(iconElement.id);
      elements.push(...(instanceUser.renderObject(layer, instanceAttributes, iconElement) as UMLElement[]));
    } else {
      elements.push(...(instanceUser.render(layer, instanceAttributes) as UMLElement[]));
    }

    currentX += instanceUser.bounds.width + 50;
  });

  return elements;
};

const composeNormalView = (layer: ILayer): UMLElement[] => {
  const elements: UMLElement[] = [];

  const userModel = new UMLUserModelName({ name: 'Object' });
  userModel.bounds = { ...userModel.bounds, width: userModel.bounds.width, height: userModel.bounds.height };


  userModel.ownedElements = [];


  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) return elements;

  const availableClasses = diagramBridge
    .getAvailableClasses()
    .filter((classInfo) => !isHiddenUserModelContainer(classInfo.name));
  let currentX = userModel.bounds.x + userModel.bounds.width + 50;

  availableClasses.forEach((classInfo) => {
    // Same decomposition as the icon view: configured classes become chips.
    const chips = configuredAttributes(classInfo);
    if (chips.length > 0) {
      chips.forEach((attr) => {
        elements.push(
          ...buildAttributeChip(layer, classInfo, attr, currentX, userModel.bounds.width, userModel.bounds.height),
        );
        currentX += userModel.bounds.width + 50;
      });
      return;
    }

    const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
    const instanceUser = new UMLUserModelName({
      name: instanceName,
      classId: classInfo.id,
      className: classInfo.name,
      icon: classInfo.icon,
    });

    instanceUser.bounds = {
      ...instanceUser.bounds,
      x: currentX,
      y: userModel.bounds.y,
      width: userModel.bounds.width,
      height: userModel.bounds.height,
    };

    const instanceAttributes: UMLUserModelAttribute[] = [];

    classInfo.attributes.forEach((attr, index) => {
      const attribute = new UMLUserModelAttribute({
        name: `${attr.name} = `,
        owner: instanceUser.id,
        bounds: {
          x: 0,
          y: index * 25,
          width: computeDimension(1.0, 200),
          height: computeDimension(1.0, 25),
        },
        attributeId: attr.id,
      });
      instanceAttributes.push(attribute);
    });

    instanceUser.ownedElements = instanceAttributes.map((attr) => attr.id);

    elements.push(...(instanceUser.render(layer, instanceAttributes) as UMLElement[]));


    currentX += instanceUser.bounds.width + 50;
  });

  return elements;
};
