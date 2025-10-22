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
      'modify_object',
      'add_link',
      'remove_element'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'modify_object':
        return this.modifyObject(updatedModel, modification);
      case 'add_link':
        return this.addLink(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ObjectDiagram: ${modification.action}`);
    }
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
