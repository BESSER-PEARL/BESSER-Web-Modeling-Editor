import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { computeDimension } from '../../utils/geometry/boundary';
import { ComposePreview } from '../compose-preview';
import { UMLObjectAttribute } from './uml-object-attribute/uml-object-attribute';
import { UMLObjectName } from './uml-object-name/uml-object-name';
import { UMLObjectIcon } from './uml-object-icon/uml-object-icon';
import { diagramBridge } from '../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../services/settings/settings-service';

export const composeObjectPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const elements: UMLElement[] = [];

  // Check if we should show icon view or normal view
  const shouldShowIconView = settingsService.shouldShowIconView();

  if (shouldShowIconView) {
    return composeIconObjectPreview(layer, translate);
  } else {
    return composeNormalObjectPreview(layer, translate);
  }
};

const composeIconObjectPreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const elements: UMLElement[] = [];

  // Check if we should show instantiated objects based on user settings and available data
  const shouldShowInstances = settingsService.shouldShowInstancedObjects() &&
    diagramBridge.hasClassDiagramData();

  if (shouldShowInstances) {
    // Additional objects - Instantiated from available classes
    const availableClasses = diagramBridge.getAvailableClasses();
    let currentX = 0;
    
    // Show all available classes
    const classesToShow = availableClasses;
    classesToShow.forEach((classInfo, classIndex) => {
      // Create an object instance of the available class
      const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
      const instanceObject = new UMLObjectName({
        name: instanceName,
        classId: classInfo.id,
        className: classInfo.name,
        icon: classInfo.icon, // Use the class icon if available
      });

      // Position it next to the previous object
      instanceObject.bounds = {
        ...instanceObject.bounds,
        x: currentX,
        y: 0,
        width: computeDimension(1.0, 100),
        height: computeDimension(1.0, 25),
      };

      // Create attributes based on the class attributes with empty values
      const instanceAttributes: UMLObjectAttribute[] = [];
      let iconElement: UMLObjectIcon | null = null;

      if (instanceObject.icon) {
        iconElement = new UMLObjectIcon({
          name: "i am icon",
          owner: instanceObject.id,
          bounds: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
          icon: instanceObject.icon, // Use the class icon
        });
      }
      // Create attributes based on the class attributes with empty values
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



      instanceObject.ownedElements = instanceAttributes.map(attr => attr.id);

      if (iconElement) {
        instanceObject.ownedElements.push(iconElement.id);
        elements.push(...(instanceObject.renderObject(layer, instanceAttributes, iconElement) as UMLElement[]));
      } else {
        elements.push(...(instanceObject.render(layer, instanceAttributes) as UMLElement[]));
      }

      // Update position for next object
      currentX += instanceObject.bounds.width + 50;
    });
  }

  return elements;
};

const composeNormalObjectPreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const elements: UMLElement[] = [];

  // First object - Generic object
  const umlObject = new UMLObjectName({ name: translate('packages.ObjectDiagram.ObjectName') });
  umlObject.bounds = {
    ...umlObject.bounds,
    width: umlObject.bounds.width,
    height: umlObject.bounds.height,
  };
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

  // Check if we should show instantiated objects based on user settings and available data
  const shouldShowInstances = settingsService.shouldShowInstancedObjects() && 
                              diagramBridge.hasClassDiagramData();
  
  if (shouldShowInstances) {
    // Additional objects - Instantiated from available classes
    const availableClasses = diagramBridge.getAvailableClasses();
    let currentX = umlObject.bounds.x + umlObject.bounds.width + 50;
    
    // Show all available classes
    const classesToShow = availableClasses;    
    classesToShow.forEach((classInfo, classIndex) => {
      // Create an object instance of the available class
      const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
      const instanceObject = new UMLObjectName({ 
        name: instanceName,
        classId: classInfo.id,
        className: classInfo.name,
        icon: classInfo.icon,
      });
      
      // Position it next to the previous object
      instanceObject.bounds = {
        ...instanceObject.bounds,
        x: currentX,
        y: umlObject.bounds.y,
        width: umlObject.bounds.width,
        height: umlObject.bounds.height,
      };

      // Create attributes based on the class attributes with empty values
      const instanceAttributes: UMLObjectAttribute[] = [];
      let iconElement: UMLObjectIcon | null = null;

      // Create icon element if the class has an icon
      if (instanceObject.icon) {
        iconElement = new UMLObjectIcon({
          name: "icon",
          owner: instanceObject.id,
          bounds: {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
          },
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

  

      instanceObject.ownedElements = instanceAttributes.map(attr => attr.id);
      
      // Add icon to owned elements if it exists
      if (iconElement) {
        instanceObject.ownedElements.push(iconElement.id);
        elements.push(...(instanceObject.renderObject(layer, instanceAttributes, iconElement) as UMLElement[]));
      } else {
        elements.push(...(instanceObject.render(layer, instanceAttributes) as UMLElement[]));
      }
      
      // Update position for next object
      currentX += instanceObject.bounds.width + 50;
    });
  }

  return elements;
};
