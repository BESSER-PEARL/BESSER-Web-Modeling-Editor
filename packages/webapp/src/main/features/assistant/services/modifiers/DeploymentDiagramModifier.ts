/**
 * Deployment Diagram Modifier (v4-native)
 * Handles incremental modify_model operations for DeploymentDiagram.
 *
 * Actions: add_node, add_artifact, add_component, add_dependency,
 *          modify_element, remove_element, remove_dependency.
 * Elements are referenced by node id or name; `changes.owner` names the
 * Node an artifact goes into.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { buildV4Edge, buildV4Node } from '../shared/v4Builders';

const DEPLOY_TYPES = ['deploymentNode', 'deploymentArtifact', 'deploymentComponent'];
// Inner layout of a Node (matches the converter).
const NODE_PADDING = 30;
const NODE_TOP = 50;
const ARTIFACT_GAP = 15;

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

  /** Place a new top-level element of `type` right of the existing ones, near their vertical mean. */
  private nextPosition(model: BESSERModel, type: string): { x: number; y: number } {
    const peers = ModifierHelpers.nodes(model).filter((n) => n.type === type && !n.parentId);
    if (!peers.length) return { x: 0, y: 0 };
    const maxRight = Math.max(...peers.map((n) => n.position.x + (n.width || 0)));
    const meanY = peers.reduce((sum, n) => sum + n.position.y, 0) / peers.length;
    return { x: maxRight + 40, y: Math.round(meanY) };
  }

  private requireElement(model: BESSERModel, m: ModelModification): BesserNode {
    const node =
      ModifierHelpers.resolveNodeRef(model, m.target.elementId, DEPLOY_TYPES) ??
      ModifierHelpers.resolveNodeRef(model, m.target.elementName, DEPLOY_TYPES);
    if (!node) {
      throw new Error(`Element '${m.target.elementName ?? m.target.elementId ?? ''}' not found in the model.`);
    }
    return node;
  }

  /** The Node an artifact goes into; a named Node that does not exist is an error. */
  private ownerNode(model: BESSERModel, ref?: string): string | undefined {
    if (!ref) return undefined;
    const node = ModifierHelpers.resolveNodeRef(model, ref, ['deploymentNode']);
    if (!node) throw new Error(`Node '${ref}' not found in the model.`);
    return node.id;
  }

  private addNode(model: BESSERModel, m: ModelModification): BESSERModel {
    ModifierHelpers.addNode(
      model,
      buildV4Node(
        ModifierHelpers.generateUniqueId('dnode'),
        'deploymentNode',
        this.nextPosition(model, 'deploymentNode'),
        { width: 280, height: 160 },
        {
          name: m.target.elementName || m.changes.name || 'Node',
          stereotype: m.changes.stereotype || 'node',
          isComponentHeaderShown: true,
        },
      ),
    );
    return model;
  }

  private addArtifact(model: BESSERModel, m: ModelModification): BESSERModel {
    const parentId = this.ownerNode(model, m.changes.owner);
    let position = this.nextPosition(model, 'deploymentArtifact');
    if (parentId) {
      // Stack below the artifacts already inside this node (node-relative).
      let y = NODE_TOP;
      for (const n of ModifierHelpers.nodes(model)) {
        if (n.parentId === parentId && n.type === 'deploymentArtifact') {
          y = Math.max(y, n.position.y + (n.height || 0) + ARTIFACT_GAP);
        }
      }
      position = { x: NODE_PADDING, y };
    }
    const artifact = buildV4Node(
      ModifierHelpers.generateUniqueId('dart'),
      'deploymentArtifact',
      position,
      { width: 160, height: 60 },
      { name: m.target.elementName || m.changes.name || 'Artifact', manifests: [] },
      parentId,
    );
    ModifierHelpers.addNode(model, artifact);
    ModifierHelpers.growParentToFit(model, artifact, NODE_PADDING);
    return model;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const { x, y } = this.nextPosition(model, 'deploymentComponent');
    ModifierHelpers.addNode(
      model,
      buildV4Node(
        ModifierHelpers.generateUniqueId('dcomp'),
        'deploymentComponent',
        { x, y: y + 200 },
        { width: 160, height: 60 },
        {
          name: m.target.elementName || m.changes.name || 'Component',
          stereotype: m.changes.stereotype || 'solution',
          isComponentHeaderShown: true,
        },
      ),
    );
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = ModifierHelpers.resolveNodeRef(model, m.changes.source, DEPLOY_TYPES);
    const target = ModifierHelpers.resolveNodeRef(model, m.changes.target, DEPLOY_TYPES);
    if (!source || !target) throw new Error('Could not locate source or target for the dependency.');
    const name = m.changes.label || '';
    ModifierHelpers.addEdge(
      model,
      buildV4Edge(
        ModifierHelpers.generateUniqueId('ddep'),
        'DeploymentDependency',
        source.id,
        target.id,
        { source: 'right', target: 'left' },
        { name, label: name },
      ),
    );
    return model;
  }

  private modifyElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const data = this.requireElement(model, m).data;
    if (m.changes.name) data.name = m.changes.name;
    if (m.changes.stereotype) data.stereotype = m.changes.stereotype;
    return model;
  }

  /** Removes the element, everything it contains and every relationship touching them. */
  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    return ModifierHelpers.removeNodeWithChildren(model, this.requireElement(model, m).id);
  }

  private removeDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = ModifierHelpers.resolveNodeRef(model, m.changes.source, DEPLOY_TYPES);
    const target = ModifierHelpers.resolveNodeRef(model, m.changes.target, DEPLOY_TYPES);
    const edge =
      source && target
        ? ModifierHelpers.edges(model).find((e) => e.source === source.id && e.target === target.id)
        : undefined;
    if (!edge) {
      throw new Error(`No dependency from '${m.changes.source ?? ''}' to '${m.changes.target ?? ''}' found.`);
    }
    model.edges = ModifierHelpers.edges(model).filter((e: BesserEdge) => e.id !== edge.id);
    return model;
  }
}
