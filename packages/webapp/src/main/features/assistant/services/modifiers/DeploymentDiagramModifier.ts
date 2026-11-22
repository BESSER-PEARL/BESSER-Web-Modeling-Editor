/**
 * Deployment Diagram Modifier
 * Handles incremental modify_model operations for DeploymentDiagram.
 *
 * Actions: add_node, add_artifact, add_component, add_dependency,
 *          modify_element, remove_element, remove_dependency.
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

const DEPLOY_TYPES = ['DeploymentNode', 'DeploymentArtifact', 'DeploymentComponent'];

export class DeploymentDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'DeploymentDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_node',
      'add_artifact',
      'add_component',
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
      case 'add_node':
        return this.addNode(updated, modification);
      case 'add_artifact':
        return this.addArtifact(updated, modification);
      case 'add_component':
        return this.addComponent(updated, modification);
      case 'add_dependency':
        return this.addDependency(updated, modification);
      case 'modify_element':
        return this.modifyElement(updated, modification);
      case 'remove_element':
        return this.removeElement(updated, modification);
      case 'remove_dependency':
        return this.removeDependency(updated, modification);
      default:
        throw new Error(`Unsupported action for DeploymentDiagram: ${modification.action}`);
    }
  }

  /** Place new elements of `types` to the right of the existing ones, near their vertical mean. */
  private nextPosition(model: BESSERModel, types: string[]): { x: number; y: number } {
    let maxRight = 0;
    let sumY = 0;
    let count = 0;
    for (const el of Object.values(model.elements)) {
      if (!types.includes(el.type)) continue;
      maxRight = Math.max(maxRight, el.bounds.x + el.bounds.width);
      sumY += el.bounds.y;
      count += 1;
    }
    return { x: count ? maxRight + 40 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private requireElement(model: BESSERModel, m: ModelModification): string {
    const id =
      ModifierHelpers.resolveElementRef(model, m.target.elementId, DEPLOY_TYPES) ??
      ModifierHelpers.resolveElementRef(model, m.target.elementName, DEPLOY_TYPES);
    if (!id) {
      throw new Error(`Element '${m.target.elementName ?? m.target.elementId ?? ''}' not found in the model.`);
    }
    return id;
  }

  /** The Node an artifact goes into; a named Node that does not exist is an error. */
  private ownerNode(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    const id = ModifierHelpers.resolveElementRef(model, ref, ['DeploymentNode']);
    if (!id) throw new Error(`Node '${ref}' not found in the model.`);
    return id;
  }

  private addNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model, ['DeploymentNode']);
    const id = ModifierHelpers.generateUniqueId('dnode');
    model.elements[id] = {
      id,
      type: 'DeploymentNode',
      name: m.target.elementName || m.changes.name || 'Node',
      owner: null,
      bounds: { x, y, width: 280, height: 160 },
      stereotype: m.changes.stereotype || 'node',
      displayStereotype: true,
    };
    return model;
  }

  private addArtifact(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = ModifierHelpers.generateUniqueId('dart');
    const owner = this.ownerNode(model, m.changes.owner);
    let { x, y } = this.nextPosition(model, ['DeploymentArtifact']);
    if (owner) {
      // Stack below the artifacts already inside this node.
      const nodeBounds = model.elements[owner].bounds;
      y = nodeBounds.y + 50;
      for (const el of Object.values(model.elements)) {
        if (el.owner === owner && el.type === 'DeploymentArtifact') {
          y = Math.max(y, el.bounds.y + el.bounds.height + 15);
        }
      }
      x = nodeBounds.x + 30;
    }
    model.elements[id] = {
      id,
      type: 'DeploymentArtifact',
      name: m.target.elementName || m.changes.name || 'Artifact',
      owner,
      bounds: { x, y, width: 160, height: 60 },
      manifests: [],
    };
    return model;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model, ['DeploymentComponent']);
    const id = ModifierHelpers.generateUniqueId('dcomp');
    model.elements[id] = {
      id,
      type: 'DeploymentComponent',
      name: m.target.elementName || m.changes.name || 'Component',
      owner: null,
      bounds: { x, y: y + 200, width: 160, height: 60 },
      stereotype: m.changes.stereotype || 'solution',
      displayStereotype: true,
    };
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = ModifierHelpers.resolveElementRef(model, m.changes.source, DEPLOY_TYPES);
    const tgtId = ModifierHelpers.resolveElementRef(model, m.changes.target, DEPLOY_TYPES);
    if (!srcId || !tgtId) throw new Error('Could not locate source or target for the dependency.');
    const id = ModifierHelpers.generateUniqueId('ddep');
    model.relationships[id] = {
      id,
      type: 'DeploymentDependency',
      name: m.changes.label || '',
      owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      source: { element: srcId, direction: 'Right' },
      target: { element: tgtId, direction: 'Left' },
      isManuallyLayouted: false,
    };
    return model;
  }

  private modifyElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const el = model.elements[this.requireElement(model, m)];
    if (m.changes.name) el.name = m.changes.name;
    if (m.changes.stereotype) el.stereotype = m.changes.stereotype;
    return model;
  }

  /** Removes the element, everything it owns and every relationship touching them. */
  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    return ModifierHelpers.removeElementWithChildren(model, this.requireElement(model, m));
  }

  private removeDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = ModifierHelpers.resolveElementRef(model, m.changes.source, DEPLOY_TYPES);
    const tgtId = ModifierHelpers.resolveElementRef(model, m.changes.target, DEPLOY_TYPES);
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
