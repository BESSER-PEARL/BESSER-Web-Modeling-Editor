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
    return ['add_node', 'add_artifact', 'add_component', 'add_dependency', 'modify_element', 'remove_element', 'remove_dependency'].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updated = ModifierHelpers.cloneModel(model);
    if (!updated.relationships) updated.relationships = {};
    switch (modification.action) {
      case 'add_node': return this.addNode(updated, modification);
      case 'add_artifact': return this.addArtifact(updated, modification);
      case 'add_component': return this.addComponent(updated, modification);
      case 'add_dependency': return this.addDependency(updated, modification);
      case 'modify_element': return this.modifyElement(updated, modification);
      case 'remove_element': return this.removeElement(updated, modification);
      case 'remove_dependency': return this.removeDependency(updated, modification);
      default: throw new Error(`Unsupported action for DeploymentDiagram: ${modification.action}`);
    }
  }

  private nextPosition(model: BESSERModel, type?: string): { x: number; y: number } {
    let maxRight = 0, sumY = 0, count = 0;
    for (const el of Object.values(model.elements)) {
      const elType = (el as any).type;
      if (type && elType !== type) continue;
      if (!type && !DEPLOY_TYPES.includes(elType)) continue;
      const b = (el as any).bounds || {};
      maxRight = Math.max(maxRight, (b.x || 0) + (b.width || 0));
      sumY += b.y || 0;
      count++;
    }
    return { x: count ? maxRight + 40 : 0, y: count ? Math.round(sumY / count) : 0 };
  }

  private resolveElement(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    if (model.elements[ref] && DEPLOY_TYPES.includes((model.elements[ref] as any).type)) return ref;
    const lower = ref.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if (DEPLOY_TYPES.includes((el as any).type) && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private resolveNode(model: BESSERModel, ref?: string): string | null {
    if (!ref) return null;
    if (model.elements[ref]?.type === 'DeploymentNode') return ref;
    const lower = ref.toLowerCase();
    for (const [id, el] of Object.entries(model.elements)) {
      if ((el as any).type === 'DeploymentNode' && ((el as any).name || '').toLowerCase() === lower) return id;
    }
    return null;
  }

  private addNode(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model, 'DeploymentNode');
    const id = ModifierHelpers.generateUniqueId('dnode');
    const name = (m.target as any).elementName || m.changes?.name || 'Node';
    model.elements[id] = {
      id, type: 'DeploymentNode', name, owner: null,
      bounds: { x, y, width: 280, height: 160 },
      stereotype: (m.changes as any)?.stereotype || 'node', displayStereotype: true,
    };
    return model;
  }

  private addArtifact(model: BESSERModel, m: ModelModification): BESSERModel {
    const id = ModifierHelpers.generateUniqueId('dart');
    const name = (m.target as any).elementName || m.changes?.name || 'Artifact';
    const owner = this.resolveNode(model, (m.changes as any)?.owner);
    let x = 0, y = 0;
    if (owner && model.elements[owner]) {
      const nb = (model.elements[owner] as any).bounds || {};
      // Stack below existing artifacts inside this node
      let maxArtY = nb.y + 50;
      for (const el of Object.values(model.elements)) {
        if ((el as any).owner === owner && (el as any).type === 'DeploymentArtifact') {
          const b = (el as any).bounds || {};
          maxArtY = Math.max(maxArtY, b.y + b.height + 15);
        }
      }
      x = nb.x + 30;
      y = maxArtY;
    } else {
      const pos = this.nextPosition(model, 'DeploymentArtifact');
      x = pos.x; y = pos.y;
    }
    model.elements[id] = {
      id, type: 'DeploymentArtifact', name, owner,
      bounds: { x, y, width: 160, height: 60 }, manifests: [],
    };
    return model;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model, 'DeploymentComponent');
    const id = ModifierHelpers.generateUniqueId('dcomp');
    const name = (m.target as any).elementName || m.changes?.name || 'Component';
    model.elements[id] = {
      id, type: 'DeploymentComponent', name, owner: null,
      bounds: { x, y: y + 200, width: 160, height: 60 },
      stereotype: (m.changes as any)?.stereotype || 'solution', displayStereotype: true,
    };
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const srcId = this.resolveElement(model, m.changes?.source);
    const tgtId = this.resolveElement(model, m.changes?.target);
    if (!srcId || !tgtId) throw new Error('Could not locate source or target for the dependency.');
    const id = ModifierHelpers.generateUniqueId('ddep');
    model.relationships[id] = {
      id, type: 'DeploymentDependency', name: (m.changes as any)?.label || '', owner: null,
      bounds: { x: 0, y: 0, width: 100, height: 1 },
      path: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      source: { element: srcId, direction: 'Right' },
      target: { element: tgtId, direction: 'Left' },
      isManuallyLayouted: false,
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
