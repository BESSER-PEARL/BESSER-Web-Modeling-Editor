/**
 * Object Diagram Modifier
 * Handles all modification operations for Object Diagrams
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

export class ObjectDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'ObjectDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_object',
      'modify_object',
      'modify_attribute_value',
      'add_link',
      'remove_element'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_object':
        return this.addObject(updatedModel, modification);
      case 'modify_object':
        return this.modifyObject(updatedModel, modification);
      case 'modify_attribute_value':
        return this.modifyAttributeValue(updatedModel, modification);
      case 'add_link':
        return this.addLink(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ObjectDiagram: ${modification.action}`);
    }
  }

  private addObject(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const target = modification.target;

    let objectName = changes.objectName || target.objectName || changes.name || 'object';
    const className = changes.className || '';

    // Sanitize objectName: strip any ": ClassName" suffix the LLM may have included
    if (objectName.includes(':')) {
      objectName = objectName.split(':')[0].trim();
    }

    // If objectName is empty or equals className, generate a proper instance name
    if (!objectName || (className && objectName.toLowerCase() === className.toLowerCase())) {
      let count = 1;
      for (const el of Object.values(model.elements)) {
        if (el.type === 'ObjectName' && typeof el.name === 'string' && el.name.includes(`: ${className}`)) {
          count++;
        }
      }
      objectName = `${className.charAt(0).toLowerCase()}${className.slice(1)}${count}`;
    }

    // Auto-position: find max Y of existing elements and place below
    let maxY = 0;
    for (const element of Object.values(model.elements)) {
      const bottom = (element.bounds?.y || 0) + (element.bounds?.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    const pos = { x: 100, y: maxY + 40 };

    const objectId = ModifierHelpers.generateUniqueId('object');
    const attrs = changes.attributes || [];
    const baseHeight = 80;
    const attrHeight = attrs.length * 30;
    const totalHeight = baseHeight + attrHeight;

    // Create ObjectName element
    const objectElement: any = {
      type: 'ObjectName',
      id: objectId,
      name: `${objectName}: ${className}`,
      owner: null,
      bounds: { x: pos.x, y: pos.y, width: 240, height: totalHeight },
      attributes: [] as string[],
      methods: []
    };

    // Create ObjectAttribute children
    let currentY = pos.y + 60;
    for (const attr of attrs) {
      const attrId = ModifierHelpers.generateUniqueId('attr');
      objectElement.attributes.push(attrId);

      model.elements[attrId] = {
        id: attrId,
        name: `${attr.name} = ${attr.value || ''}`,
        type: 'ObjectAttribute',
        owner: objectId,
        bounds: { x: pos.x + 1, y: currentY, width: 238, height: 30 }
      };
      currentY += 30;
    }

    model.elements[objectId] = objectElement;

    return model;
  }

  private modifyObject(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { objectId, objectName } = modification.target;
    const targetId = objectId || ModifierHelpers.findElementByName(model, objectName!, 'ObjectName');

    if (targetId && model.elements[targetId]) {
      if (modification.changes.name) {
        model.elements[targetId].name = modification.changes.name;
      }
    }

    return model;
  }

  /**
   * Modify an attribute value on an existing object.
   * Finds the ObjectAttribute child whose name starts with the target attributeName
   * and updates its display string to "attributeName = newValue".
   */
  private modifyAttributeValue(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { objectName, attributeName } = modification.target;
    const newValue = modification.changes.value;

    if (!objectName || !attributeName || newValue === undefined) {
      throw new Error('modify_attribute_value requires target.objectName, target.attributeName, and changes.value');
    }

    // Find the owner object by name
    const objectId = ModifierHelpers.findElementByName(model, objectName, 'ObjectName');
    if (!objectId) {
      throw new Error(`Object '${objectName}' not found in the model.`);
    }

    // Search for the ObjectAttribute child owned by this object
    let found = false;
    for (const [, element] of Object.entries(model.elements)) {
      if (
        element.type === 'ObjectAttribute' &&
        element.owner === objectId &&
        element.name?.split('=')[0]?.trim() === attributeName
      ) {
        element.name = `${attributeName} = ${newValue}`;
        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`Attribute '${attributeName}' not found on object '${objectName}'.`);
    }

    return model;
  }

  private addLink(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const sourceId = modification.target.objectId || 
                     ModifierHelpers.findElementByName(model, modification.changes.source!, 'ObjectName');
    const targetId = ModifierHelpers.findElementByName(model, modification.changes.target!, 'ObjectName');

    if (!sourceId || !targetId) {
      throw new Error('Could not locate source or target object for link.');
    }

    const linkId = ModifierHelpers.generateUniqueId('link');

    model.relationships[linkId] = {
      id: linkId,
      type: 'ObjectLink',
      source: {
        element: sourceId,
        direction: 'Left'
      },
      target: {
        element: targetId,
        direction: 'Right'
      },
      name: modification.changes.name || '',
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      path: [{ x: 100, y: 10 }, { x: 0, y: 10 }],
      isManuallyLayouted: false
    };

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { objectId, objectName } = modification.target;
    const targetId = objectId || ModifierHelpers.findElementByName(model, objectName!, 'ObjectName');

    if (targetId) {
      return ModifierHelpers.removeElementWithChildren(model, targetId);
    }

    return model;
  }
}
