/**
 * Component Diagram Modifier (v4-native)
 * Handles incremental modify_model operations for ComponentDiagram.
 *
 * Actions: add_component, add_subsystem, add_dependency,
 *          modify_element, remove_element, remove_dependency.
 * Elements are referenced by node id or name; `changes.owner` names the
 * Subsystem a new element goes into.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { buildV4Edge, buildV4Node } from '../shared/v4Builders';

const COMPONENT_TYPES = ['component', 'componentSubsystem'];
// Inner layout of a Subsystem (matches the converter).
const SUBSYSTEM_PADDING = 30;
const TOP_PADDING = 40;
const CHILD_GAP = 20;

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

  /**
   * Top-level elements go right of the existing ones, near their vertical
   * mean; inside a Subsystem they stack below its children (Subsystem-relative).
   */
  private nextPosition(model: BESSERModel, parentId?: string): { x: number; y: number } {
    const siblings = ModifierHelpers.nodes(model).filter(
      (n) => COMPONENT_TYPES.includes(n.type) && n.parentId === parentId,
    );
    if (parentId) {
      const bottom = Math.max(TOP_PADDING - CHILD_GAP, ...siblings.map((n) => n.position.y + (n.height || 0)));
      return { x: SUBSYSTEM_PADDING, y: bottom + CHILD_GAP };
    }
    if (!siblings.length) return { x: 0, y: 0 };
    const maxRight = Math.max(...siblings.map((n) => n.position.x + (n.width || 0)));
    const meanY = siblings.reduce((sum, n) => sum + n.position.y, 0) / siblings.length;
    return { x: maxRight + 40, y: Math.round(meanY) };
  }

  private addChild(model: BESSERModel, node: BesserNode): void {
    ModifierHelpers.addNode(model, node);
    ModifierHelpers.growParentToFit(model, node, SUBSYSTEM_PADDING);
  }

  private requireElement(model: BESSERModel, m: ModelModification): BesserNode {
    const node =
      ModifierHelpers.resolveNodeRef(model, m.target.elementId, COMPONENT_TYPES) ??
      ModifierHelpers.resolveNodeRef(model, m.target.elementName, COMPONENT_TYPES);
    if (!node) {
      throw new Error(`Element '${m.target.elementName ?? m.target.elementId ?? ''}' not found in the model.`);
    }
    return node;
  }

  /** The Subsystem a new element goes into; a named Subsystem that does not exist is an error. */
  private ownerSubsystem(model: BESSERModel, ref?: string): string | undefined {
    if (!ref) return undefined;
    const node = ModifierHelpers.resolveNodeRef(model, ref, ['componentSubsystem']);
    if (!node) throw new Error(`Subsystem '${ref}' not found in the model.`);
    return node.id;
  }

  private addComponent(model: BESSERModel, m: ModelModification): BESSERModel {
    const parentId = this.ownerSubsystem(model, m.changes.owner);
    this.addChild(
      model,
      buildV4Node(
        ModifierHelpers.generateUniqueId('comp'),
        'component',
        this.nextPosition(model, parentId),
        { width: 160, height: 80 },
        {
          name: m.target.elementName || m.changes.name || 'Component',
          stereotype: m.changes.stereotype || 'solution',
          isComponentHeaderShown: true,
          realizes: [],
          processModelRefs: [],
        },
        parentId,
      ),
    );
    return model;
  }

  private addSubsystem(model: BESSERModel, m: ModelModification): BESSERModel {
    const parentId = this.ownerSubsystem(model, m.changes.owner);
    this.addChild(
      model,
      buildV4Node(
        ModifierHelpers.generateUniqueId('sub'),
        'componentSubsystem',
        this.nextPosition(model, parentId),
        { width: 300, height: 160 },
        {
          name: m.target.elementName || m.changes.name || 'Subsystem',
          stereotype: 'subsystem',
          isComponentSubsystemHeaderShown: true,
        },
        parentId,
      ),
    );
    return model;
  }

  private addDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = ModifierHelpers.resolveNodeRef(model, m.changes.source, COMPONENT_TYPES);
    const target = ModifierHelpers.resolveNodeRef(model, m.changes.target, COMPONENT_TYPES);
    if (!source || !target) throw new Error('Could not locate source or target element for the dependency.');
    ModifierHelpers.addEdge(
      model,
      buildV4Edge(
        ModifierHelpers.generateUniqueId('cdep'),
        'ComponentDependency',
        source.id,
        target.id,
        { source: 'right', target: 'left' },
        { name: '', label: '', stereotype: m.changes.dependencyStereotype || 'uses' },
      ),
    );
    return model;
  }

  private modifyElement(model: BESSERModel, m: ModelModification): BESSERModel {
    const data = this.requireElement(model, m).data as any;
    if (m.changes.name) data.name = m.changes.name;
    if (m.changes.stereotype) data.stereotype = m.changes.stereotype;
    return model;
  }

  /** Removes the element, everything it contains and every dependency touching them. */
  private removeElement(model: BESSERModel, m: ModelModification): BESSERModel {
    return ModifierHelpers.removeNodeWithChildren(model, this.requireElement(model, m).id);
  }

  private removeDependency(model: BESSERModel, m: ModelModification): BESSERModel {
    const source = ModifierHelpers.resolveNodeRef(model, m.changes.source, COMPONENT_TYPES);
    const target = ModifierHelpers.resolveNodeRef(model, m.changes.target, COMPONENT_TYPES);
    const edge =
      source && target
        ? ModifierHelpers.edges(model).find((e) => e.source === source.id && e.target === target.id)
        : undefined;
    if (!edge) {
      throw new Error(`No dependency from '${m.changes.source ?? ''}' to '${m.changes.target ?? ''}' found.`);
    }
    (model as any).edges = ModifierHelpers.edges(model).filter((e: BesserEdge) => e.id !== edge.id);
    return model;
  }
}
