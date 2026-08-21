/**
 * GUI (No-Code) Diagram Modifier
 * Handles modification operations for GUINoCodeDiagram.
 *
 * Supported actions:
 *  - add_component     — insert a GUI component (page, section, button, …)
 *  - modify_component  — rename, resize, or update props of an existing component
 *  - remove_element    — remove a component and its children
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const SUPPORTED_ACTIONS = ['add_component', 'modify_component', 'remove_element'] as const;

export class GUIDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'GUINoCodeDiagram' as const;
  }

  canHandle(action: string): boolean {
    return (SUPPORTED_ACTIONS as readonly string[]).includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_component' as any:
        return this.addComponent(updatedModel, modification);
      case 'modify_component' as any:
        return this.modifyComponent(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for GUINoCodeDiagram: ${modification.action}`);
    }
  }

  private addComponent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes as any;
    const compId = ModifierHelpers.generateUniqueId('gui');
    const compType = changes.componentType || 'Section';

    const defaultSizes: Record<string, { w: number; h: number }> = {
      Page: { w: 800, h: 600 },
      Section: { w: 700, h: 200 },
      Button: { w: 120, h: 40 },
      Input: { w: 260, h: 40 },
      Text: { w: 200, h: 30 },
      Image: { w: 200, h: 150 },
      Card: { w: 300, h: 200 },
      Form: { w: 400, h: 300 },
      NavBar: { w: 800, h: 60 },
    };
    const size = defaultSizes[compType] ?? { w: 200, h: 100 };

    model.elements[compId] = {
      id: compId,
      name: changes.name || compType,
      type: `GUI${compType}`,
      owner: null,
      bounds: {
        x: changes.x ?? 50,
        y: changes.y ?? 50,
        width: changes.width ?? size.w,
        height: changes.height ?? size.h,
      },
      label: changes.label || changes.name || '',
      props: changes.props || {},
    };

    return model;
  }

  private modifyComponent(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target as any;
    const targetId =
      target.componentId ??
      target.classId ??
      this.findComponentByName(model, target.className ?? target.componentName ?? '');

    if (targetId && model.elements[targetId]) {
      const el = model.elements[targetId];
      if (modification.changes.name) el.name = modification.changes.name;
      if ((modification.changes as any).label) el.label = (modification.changes as any).label;
      if ((modification.changes as any).props) el.props = { ...el.props, ...(modification.changes as any).props };
      if ((modification.changes as any).width) el.bounds.width = (modification.changes as any).width;
      if ((modification.changes as any).height) el.bounds.height = (modification.changes as any).height;
    }

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target as any;
    const targetId =
      target.componentId ??
      target.classId ??
      this.findComponentByName(model, target.className ?? target.componentName ?? '');

    if (targetId) {
      return ModifierHelpers.removeElementWithChildren(model, targetId);
    }
    return model;
  }

  private findComponentByName(model: BESSERModel, name: string): string | null {
    if (!name) return null;
    for (const [id, element] of Object.entries(model.elements)) {
      if (
        element.name === name &&
        (typeof element.type === 'string' && element.type.startsWith('GUI'))
      ) {
        return id;
      }
    }
    return null;
  }
}
