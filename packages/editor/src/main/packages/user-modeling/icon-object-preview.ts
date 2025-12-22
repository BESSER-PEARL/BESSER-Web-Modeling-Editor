import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { computeDimension } from '../../utils/geometry/boundary';
import { ComposePreview } from '../compose-preview';
import { UMLObjectAttribute } from './uml-object-attribute/uml-object-attribute';
import { UMLObjectIcon } from './uml-object-icon/uml-object-icon';
import { UMLIconObjectName } from './uml-icon-object-name/uml-icon-object-name';
import { diagramBridge } from '../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../services/settings/settings-service';

// Mirrors the object-diagram preview but uses the user-modeling element classes.
export const composeIconObjectPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  // Reuse the same toggle logic as object diagrams
  const shouldShowIconView = settingsService.shouldShowIconView();
  return shouldShowIconView
    ? composeIconView(layer, translate)
    : composeNormalView(layer, translate);
};

const composeIconView = (layer: ILayer, translate: (id: string) => string): UMLElement[] => {
  const elements: UMLElement[] = [];

  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) {
    return elements;
  }

  const availableClasses = diagramBridge.getAvailableClasses();
  let currentX = 0;

  availableClasses.forEach((classInfo) => {
    const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
    const instanceObject = new UMLIconObjectName({
      name: instanceName,
      classId: classInfo.id,
      className: classInfo.name,
      icon: classInfo.icon,
    });

    instanceObject.bounds = {
      ...instanceObject.bounds,
      x: currentX,
      y: 0,
      width: computeDimension(1.0, 100),
      height: computeDimension(1.0, 25),
    };

    const instanceAttributes: UMLObjectAttribute[] = [];
    let iconElement: UMLObjectIcon | null = null;

    if (instanceObject.icon) {
      iconElement = new UMLObjectIcon({
        name: 'icon',
        owner: instanceObject.id,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        icon: instanceObject.icon,
      });
    }

    classInfo.attributes.forEach((attr) => {
      const objectAttribute = new UMLObjectAttribute({
        name: `${attr.name} = `,
        owner: instanceObject.id,
        bounds: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      });
      instanceAttributes.push(objectAttribute);
    });

    if (instanceAttributes.length === 0) {
      instanceAttributes.push(
        new UMLObjectAttribute({
          name: translate('sidebar.objectAttribute'),
          owner: instanceObject.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        }),
      );
    }

    instanceObject.ownedElements = instanceAttributes.map((attr) => attr.id);
    if (iconElement) {
      instanceObject.ownedElements.push(iconElement.id);
      elements.push(...(instanceObject.renderObject(layer, instanceAttributes, iconElement) as UMLElement[]));
    } else {
      elements.push(...(instanceObject.render(layer, instanceAttributes) as UMLElement[]));
    }

    currentX += instanceObject.bounds.width + 50;
  });

  return elements;
};

const composeNormalView = (layer: ILayer, translate: (id: string) => string): UMLElement[] => {
  const elements: UMLElement[] = [];

  const umlObject = new UMLIconObjectName({ name: translate('packages.ObjectDiagram.ObjectName') });
  umlObject.bounds = { ...umlObject.bounds, width: umlObject.bounds.width, height: umlObject.bounds.height };

  const umlObjectMember = new UMLObjectAttribute({
    name: translate('sidebar.objectAttribute'),
    owner: umlObject.id,
    bounds: {
      x: 0,
      y: 0,
      width: computeDimension(1.0, 200),
      height: computeDimension(1.0, 25),
    },
  });
  umlObject.ownedElements = [umlObjectMember.id];
  elements.push(...(umlObject.render(layer, [umlObjectMember]) as UMLElement[]));

  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) {
    return elements;
  }

  const availableClasses = diagramBridge.getAvailableClasses();
  let currentX = umlObject.bounds.x + umlObject.bounds.width + 50;

  availableClasses.forEach((classInfo) => {
    const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
    const instanceObject = new UMLIconObjectName({
      name: instanceName,
      classId: classInfo.id,
      className: classInfo.name,
      icon: classInfo.icon,
    });

    instanceObject.bounds = {
      ...instanceObject.bounds,
      x: currentX,
      y: umlObject.bounds.y,
      width: umlObject.bounds.width,
      height: umlObject.bounds.height,
    };

    const instanceAttributes: UMLObjectAttribute[] = [];
    let iconElement: UMLObjectIcon | null = null;

    if (instanceObject.icon) {
      iconElement = new UMLObjectIcon({
        name: 'icon',
        owner: instanceObject.id,
        bounds: { x: 0, y: 0, width: 0, height: 0 },
        icon: instanceObject.icon,
      });
    }

    classInfo.attributes.forEach((attr, index) => {
      const objectAttribute = new UMLObjectAttribute({
        name: `${attr.name} = `,
        owner: instanceObject.id,
        bounds: {
          x: 0,
          y: index * 25,
          width: computeDimension(1.0, 200),
          height: computeDimension(1.0, 25),
        },
      });
      instanceAttributes.push(objectAttribute);
    });

    instanceObject.ownedElements = instanceAttributes.map((attr) => attr.id);
    if (iconElement) {
      instanceObject.ownedElements.push(iconElement.id);
      elements.push(...(instanceObject.renderObject(layer, instanceAttributes, iconElement) as UMLElement[]));
    } else {
      elements.push(...(instanceObject.render(layer, instanceAttributes) as UMLElement[]));
    }

    currentX += instanceObject.bounds.width + 50;
  });

  return elements;
};
