/**
 * Component Diagram Modifier
 * Handles incremental modify_model operations for ComponentDiagram.
 *
 * Actions: add_component, add_subsystem, add_dependency,
 *          modify_element, remove_element, remove_dependency.
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const COMPONENT_TYPES = ['Component', 'Subsystem'];

export class ComponentDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'ComponentDiagram' as const;
  }

  canHandle(action: string): boolean {
    return ['add_component', 'add_subsystem', 'add_dependency', 'modify_element', 'remove_element', 'remove_dependency'].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);
    if (!updated.relationships) updated.relationships = {};
    switch (modification.action) {
      case 'add_component': return this.addComponent(updated, modification);
      case 'add_subsystem': return this.addSubsystem(updated, modification);
      case 'add_dependency': return this.addDependency(updated, modification);
      case 'modify_element': return this.modifyElement(updated, modification);
      case 'remove_element': return this.removeElement(updated, modification);
      case 'remove_dependency': return this.removeDependency(updated, modification);
      default: throw new Error(`Unsupported action for ComponentDiagram: ${modification.action}`);
    }
  }

  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxRight = 0, sumY = 0, count = 0;
    for (const el of Object.values(model.elements)) {
      if (!COMPONENT_TYPES.includes((el as any).type)) continue;
      const b = (el as any).bounds || {};
      maxRight = Math.max(maxRight, (b.x || 0) + (b.width || 0));
      sumY += b.y || 0;
      count++;
    }
    return { x: count ? maxRight + 40 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private resolveElement(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    // Direct id lookup
    if (model.elements[ref] && COMPONENT_TYPES.includes((model.elements[ref] as any).type)) return ref;
    // Name lookup (case-insensitive)
    const lower = ref.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if (COMPONENT_TYPES.includes((el as any).type) && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private resolveOwner(model: BESSERModel, ownerRef?: string): string | null {
    if (!ownerRef) return null;
    if (model.elements[ownerRef]?.type === 'Subsystem') return ownerRef;
    const lower = ownerRef.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if ((el as any).type === 'Subsystem' && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = ModifierHelpers.generateUniqueId('comp');
    const name = (m.target as any).elementName || m.changes?.name || 'Component';
    const stereotype = (m.changes as any)?.stereotype || 'solution';
    const owner = this.resolveOwner(model, (m.changes as any)?.owner);
    model.elements[id] = {
      id, type: 'Component', name, owner, stereotype, displayStereotype: true,
      bounds: { x, y, width: 160, height: 80 }, realizes: [], processModelRefs: [],
    };
    return model;
  }

  private addSubsystem(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = ModifierHelpers.generateUniqueId('sub');
    const name = (m.target as any).elementName || m.changes?.name || 'Subsystem';
    const owner = this.resolveOwner(model, (m.changes as any)?.owner);
    model.elements[id] = {
      id, type: 'Subsystem', name, owner, stereotype: 'subsystem', displayStereotype: true,
      bounds: { x, y, width: 300, height: 160 },
    };
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = this.resolveElement(model, m.changes?.source);
    const tgtId = this.resolveElement(model, m.changes?.target);
    if (!srcId || !tgtId) throw new Error('Could not locate source or target element for the dependency.');
    const id = ModifierHelpers.generateUniqueId('cdep');
    model.relationships[id] = {
      id, type: 'ComponentDependency', name: '', owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      source: { element: srcId, direction: 'Right' },
      target: { element: tgtId, direction: 'Left' },
      isManuallyLayouted: false,
      stereotype: (m.changes as any)?.dependencyStereotype || 'uses',
    };
    return model;
  }

  private modifyElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.resolveElement(model, (m.target as any)?.elementId)
            ?? this.resolveElement(model, (m.target as any)?.elementName);
    if (id && model.elements[id]) {
      const el = model.elements[id] as any;
      if (m.changes?.name) el.name = m.changes.name;
      if ((m.changes as any)?.stereotype) el.stereotype = (m.changes as any).stereotype;
    }
    return model;
  }

  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = this.resolveElement(model, (m.target as any)?.elementId)
            ?? this.resolveElement(model, (m.target as any)?.elementName);
    if (!id) throw new Error(`Could not find element "${(m.target as any)?.elementName ?? (m.target as any)?.elementId}" to remove.`);
    return ModifierHelpers.removeElementWithChildren(model, id);
  }

  private removeDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = this.resolveElement(model, m.changes?.source);
    const tgtId = this.resolveElement(model, m.changes?.target);
    if (srcId && tgtId && model.relationships) {
      for (const [rid, rel] of Object.entries(model.relationships)) {
        if ((rel as any).source?.element === srcId && (rel as any).target?.element === tgtId) {
          delete model.relationships[rid];
          break;
        }
      }
    }
    return model;
  }
}
