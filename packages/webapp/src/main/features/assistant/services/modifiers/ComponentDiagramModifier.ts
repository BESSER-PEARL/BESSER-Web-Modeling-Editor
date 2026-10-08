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
    return [
      'add_component',
      'add_subsystem',
      'add_dependency',
      'modify_element',
      'remove_element',
      'remove_dependency',
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);
    if (!updated.relationships) updated.relationships = {};
    switch (modification.action) {
      case 'add_component':
        return this.addComponent(updated, modification);
      case 'add_subsystem':
        return this.addSubsystem(updated, modification);
      case 'add_dependency':
        return this.addDependency(updated, modification);
      case 'modify_element':
        return this.modifyElement(updated, modification);
      case 'remove_element':
        return this.removeElement(updated, modification);
      case 'remove_dependency':
        return this.removeDependency(updated, modification);
      default:
        throw new Error(`Unsupported action for ComponentDiagram: ${modification.action}`);
    }
  }

  /** Place new elements to the right of existing content, near the vertical mean. */
  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxRight = 0;
    let sumY = 0;
    let count = 0;
    for (const el of Object.values(model.elements)) {
      if (!COMPONENT_TYPES.includes(el.type)) continue;
      maxRight = Math.max(maxRight, el.bounds.x + el.bounds.width);
      sumY += el.bounds.y;
      count += 1;
    }
    return { x: count ? maxRight + 40 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private requireElement(model: BESSERModel, m: ModelModification): string {
    const id =
      ModifierHelpers.resolveElementRef(model, m.target.elementId, COMPONENT_TYPES) ??
      ModifierHelpers.resolveElementRef(model, m.target.elementName, COMPONENT_TYPES);
    if (!id) {
      throw new Error(`Element '${m.target.elementName ?? m.target.elementId ?? ''}' not found in the model.`);
    }
    return id;
  }

  /** The Subsystem a new element goes into; a named Subsystem that does not exist is an error. */
  private ownerSubsystem(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    const id = ModifierHelpers.resolveElementRef(model, ref, ['Subsystem']);
    if (!id) throw new Error(`Subsystem '${ref}' not found in the model.`);
    return id;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = ModifierHelpers.generateUniqueId('comp');
    model.elements[id] = {
      id,
      type: 'Component',
      name: m.target.elementName || m.changes.name || 'Component',
      owner: this.ownerSubsystem(model, m.changes.owner),
      stereotype: m.changes.stereotype || 'solution',
      displayStereotype: true,
      bounds: { x, y, width: 160, height: 80 },
      realizes: [],
      processModelRefs: [],
    };
    return model;
  }

  private addSubsystem(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model);
    const id = ModifierHelpers.generateUniqueId('sub');
    model.elements[id] = {
      id,
      type: 'Subsystem',
      name: m.target.elementName || m.changes.name || 'Subsystem',
      owner: this.ownerSubsystem(model, m.changes.owner),
      stereotype: 'subsystem',
      displayStereotype: true,
      bounds: { x, y, width: 300, height: 160 },
    };
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = ModifierHelpers.resolveElementRef(model, m.changes.source, COMPONENT_TYPES);
    const tgtId = ModifierHelpers.resolveElementRef(model, m.changes.target, COMPONENT_TYPES);
    if (!srcId || !tgtId) throw new Error('Could not locate source or target element for the dependency.');
    const id = ModifierHelpers.generateUniqueId('cdep');
    model.relationships[id] = {
      id,
      type: 'ComponentDependency',
      name: '',
      owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      source: { element: srcId, direction: 'Right' },
      target: { element: tgtId, direction: 'Left' },
      isManuallyLayouted: false,
      stereotype: m.changes.dependencyStereotype || 'uses',
    };
    return model;
  }

  private modifyElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const el = model.elements[this.requireElement(model, m)];
    if (m.changes.name) el.name = m.changes.name;
    if (m.changes.stereotype) el.stereotype = m.changes.stereotype;
    return model;
  }

  /** Removes the element, everything it owns and every dependency touching them. */
  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    return ModifierHelpers.removeElementWithChildren(model, this.requireElement(model, m));
  }

  private removeDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = ModifierHelpers.resolveElementRef(model, m.changes.source, COMPONENT_TYPES);
    const tgtId = ModifierHelpers.resolveElementRef(model, m.changes.target, COMPONENT_TYPES);
    const relId = Object.keys(model.relationships).find(
      (rid) =>
        model.relationships[rid].source?.element === srcId && model.relationships[rid].target?.element === tgtId,
    );
    if (!srcId || !tgtId || !relId) {
      throw new Error(`No dependency from '${m.changes.source ?? ''}' to '${m.changes.target ?? ''}' found.`);
    }
    delete model.relationships[relId];
    return model;
  }
}
