import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { computeDimension } from '../../utils/geometry/boundary';
import { ComposePreview } from '../compose-preview';
import { UMLUserModelAttribute } from './uml-user-model-attribute/uml-user-model-attribute';
import { UMLUserModelIcon } from './uml-user-model-icon/uml-user-model-icon';
import { UMLUserModelName } from './uml-user-model-name/uml-user-model-name';
import { diagramBridge } from '../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../services/settings/settings-service';

// User-model preview based on the object-diagram logic but using user-modeling elements.
export const composeUserModelPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const shouldShowIconView = settingsService.shouldShowIconView();
  return shouldShowIconView ? composeIconView(layer, translate) : composeNormalView(layer, translate);
};

const composeIconView = (layer: ILayer, translate: (id: string) => string): UMLElement[] => {
  const elements: UMLElement[] = [];
  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) return elements;

  const availableClasses = diagramBridge.getAvailableClasses();
  let currentX = 0;

  availableClasses.forEach((classInfo) => {
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
      width: computeDimension(1.0, 100),
      height: computeDimension(1.0, 25),
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

    if (instanceAttributes.length === 0) {
      instanceAttributes.push(
        new UMLUserModelAttribute({
          name: translate('sidebar.objectAttribute'),
          owner: instanceUser.id,
          bounds: { x: 0, y: 0, width: 0, height: 0 },
        }),
      );
    }

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

const composeNormalView = (layer: ILayer, translate: (id: string) => string): UMLElement[] => {
  const elements: UMLElement[] = [];

  const userModel = new UMLUserModelName({ name: translate('packages.ObjectDiagram.ObjectName') });
  userModel.bounds = { ...userModel.bounds, width: userModel.bounds.width, height: userModel.bounds.height };


  userModel.ownedElements = [];


  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && diagramBridge.hasClassDiagramData();
  if (!shouldShowInstances) return elements;

  const availableClasses = diagramBridge.getAvailableClasses();
  let currentX = userModel.bounds.x + userModel.bounds.width + 50;

  availableClasses.forEach((classInfo) => {
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
    let iconElement: UMLUserModelIcon | null = null;

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