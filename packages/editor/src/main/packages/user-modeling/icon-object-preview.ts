import { ILayer } from '../../services/layouter/layer';
import { UMLElement } from '../../services/uml-element/uml-element';
import { computeDimension } from '../../utils/geometry/boundary';
import { ComposePreview } from '../compose-preview';
import { UMLObjectAttribute } from './uml-object-attribute/uml-object-attribute';
import { UMLObjectIcon } from './uml-object-icon/uml-object-icon';
import { UMLObjectName } from './uml-object-name/uml-object-name';
import { diagramBridge } from '../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../services/settings/settings-service';

export const composeIconObjectPreview: ComposePreview = (
  layer: ILayer,
  translate: (id: string) => string,
): UMLElement[] => {
  const elements: UMLElement[] = [];

  // First object - Generic object

  // Check if we should show instantiated objects based on user settings and available data
  const shouldShowInstances = settingsService.shouldShowInstancedObjects() &&
    diagramBridge.hasClassDiagramData();

  if (shouldShowInstances) {
    // Additional objects - Instantiated from available classes
    const availableClasses = diagramBridge.getAvailableClasses();
    let currentX = 0
    // Show all available classes
    const classesToShow = availableClasses;
    classesToShow.forEach((classInfo, classIndex) => {
      // Create an object instance of the available class
      const instanceName = `${classInfo.name.charAt(0).toLowerCase() + classInfo.name.slice(1)}_1`;
      const instanceObject = new UMLIconObjectName({
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
        })
      }
      // using 1111111111 avoids the attributes to be rendered in the icon object diagram
      // it is a bit of cheating but works for now
      classInfo.attributes.forEach((attr, index) => {
        const objectAttribute = new UMLObjectAttribute({
          name: `${attr.name} = `,
          owner: instanceObject.id,
          bounds: {
            x: 1111111111,
            y: 1111111111,
            width: 0,
            height: 0,
          },
        });
        instanceAttributes.push(objectAttribute);
      });

      // If no attributes, add a placeholder
      if (instanceAttributes.length === 0) {
        const placeholderAttribute = new UMLObjectAttribute({
          name: translate('sidebar.objectAttribute'),
          owner: instanceObject.id,
          bounds: {
            x: 1111111111,
            y: 1111111111,
            width: 0,
            height: 0,
          },
        });
        instanceAttributes.push(placeholderAttribute);
      }

      instanceObject.ownedElements = instanceAttributes.map(attr => attr.id)

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
