/**
 * State Machine Modifier (v4-native)
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * v4 State diagram: State has `data.bodies[]` and `data.fallbackBodies[]` rows
 * (StateBody/StateFallbackBody collapse onto the parent state — they are NOT
 * separate nodes). Initial / Final / Code-Block nodes remain top-level.
 *
 * Transitions keep trigger, guard and effect apart: `data.name` (the event),
 * `data.guard`, and `data.code`. The backend builds an Event from `name`, so a
 * folded "trigger [guard] / effect" label is rejected.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';

type BodyRow = { id: string; name: string };

/** Row prefixes the converter writes for entry / do / exit actions. */
const ACTION_ROWS: Array<{ field: 'entryAction' | 'doActivity' | 'exitAction'; prefix: string }> = [
  { field: 'entryAction', prefix: 'entry' },
  { field: 'doActivity', prefix: 'do' },
  { field: 'exitAction', prefix: 'exit' },
];

const INITIAL_KEYWORDS = new Set(['initial', 'start', '[*]']);
const FINAL_KEYWORDS = new Set(['final', 'end', '[*]']);

const stateHeight = (rows: number) => Math.max(100, 41 + rows * 30);

export class StateMachineModifier implements DiagramModifier {
  getDiagramType() {
    return 'StateMachineDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_state',
      'modify_state',
      'add_transition',
      'modify_transition',
      'remove_element',
      'remove_transition',
      'add_code_block'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_state':         return this.addState(updatedModel, modification);
      case 'modify_state':      return this.modifyState(updatedModel, modification);
      case 'add_transition':    return this.addTransition(updatedModel, modification);
      case 'modify_transition': return this.modifyTransition(updatedModel, modification);
      case 'remove_transition': return this.removeTransition(updatedModel, modification);
      case 'add_code_block':    return this.addCodeBlock(updatedModel, modification);
      case 'remove_element':    return this.removeElement(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for StateMachineDiagram: ${modification.action}`);
    }
  }

  private nextPosition(model: BESSERModel): { x: number; y: number } {
    let maxY = 0;
    for (const node of ModifierHelpers.nodes(model)) {
      const bottom = (node.position?.y || 0) + (node.height || 0);
      if (bottom > maxY) maxY = bottom;
    }
    return { x: 100, y: maxY + 40 };
  }

  private addState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const stateType = (changes.stateType || changes.name || '').toLowerCase();
    const pos = this.nextPosition(model);
    const stateId = ModifierHelpers.generateUniqueId('state');

    if (stateType === 'initial') {
      const node: BesserNode = {
        id: stateId,
        type: 'StateInitialNode' as any,
        position: pos,
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, node);
      return model;
    }

    if (stateType === 'final') {
      const node: BesserNode = {
        id: stateId,
        type: 'StateFinalNode' as any,
        position: pos,
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, node);
      return model;
    }

    const bodies: BodyRow[] = [];
    const fallbackBodies: BodyRow[] = [];
    if (changes.entryAction) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `entry / ${changes.entryAction}` });
    if (changes.doActivity) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `do / ${changes.doActivity}` });
    if (changes.exitAction) bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `exit / ${changes.exitAction}` });

    const totalHeight = Math.max(100, 41 + bodies.length * 30);
    const stateName = modification.target.stateName || changes.name || '';
    const node: BesserNode = {
      id: stateId,
      type: 'State' as any,
      position: pos,
      width: 160,
      height: totalHeight,
      measured: { width: 160, height: totalHeight },
      data: {
        name: stateName,
        bodies,
        fallbackBodies,
      },
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  /** A regular state by exact (then case-insensitive) name. Never matches an empty name. */
  private findStateByName(model: BESSERModel, name: string | undefined | null): BesserNode | undefined {
    if (!name || !name.trim()) return undefined;
    return ModifierHelpers.findNodeByName(model, name, 'State');
  }

  /**
   * A transition endpoint: a named state, or the initial / final pseudo-state
   * by keyword ("initial" as a source, "final" as a target).
   */
  private findEndpoint(
    model: BESSERModel,
    name: string | undefined | null,
    role: 'source' | 'target',
  ): BesserNode | undefined {
    const byName = this.findStateByName(model, name);
    if (byName) return byName;
    const key = (name ?? '').trim().toLowerCase();
    if (role === 'source' && INITIAL_KEYWORDS.has(key)) {
      return ModifierHelpers.findNodesByType(model, 'StateInitialNode')[0];
    }
    if (role === 'target' && FINAL_KEYWORDS.has(key)) {
      return ModifierHelpers.findNodesByType(model, 'StateFinalNode')[0];
    }
    return undefined;
  }

  /** The agent names endpoints on `target.sourceState` / `target.targetState`; `changes.source` / `changes.target` are accepted too. */
  private endpointNames(modification: ModelModification): { source?: string; target?: string } {
    const target = modification.target || {};
    const changes = modification.changes || {};
    return {
      source: target.sourceState ?? target.sourceStateName ?? changes.source,
      target: target.targetState ?? target.targetStateName ?? changes.target,
    };
  }

  /** Transitions picked by `target.transitionId`, else every edge from the named source to the named target. */
  private findTransitions(model: BESSERModel, modification: ModelModification): BesserEdge[] {
    const { transitionId } = modification.target || {};
    if (transitionId) {
      const edge = ModifierHelpers.findEdgeById(model, transitionId);
      return edge ? [edge] : [];
    }
    const names = this.endpointNames(modification);
    const source = this.findEndpoint(model, names.source, 'source');
    const target = this.findEndpoint(model, names.target, 'target');
    if (!source || !target) return [];
    return ModifierHelpers.edges(model).filter(
      (e) => (e.type as string) === 'StateTransition' && e.source === source.id && e.target === target.id,
    );
  }

  /** Trigger → `name` (+ `label`), guard → `guard`, effect → `code`. An empty string clears the field. */
  private applyTransitionFields(data: Record<string, any>, changes: ModelModification['changes']): void {
    const trigger = changes.trigger ?? changes.label ?? changes.name;
    if (typeof trigger === 'string') {
      data.name = trigger;
      data.label = trigger;
    }
    if (typeof changes.guard === 'string') {
      if (changes.guard) data.guard = changes.guard;
      else delete data.guard;
    }
    if (typeof changes.effect === 'string') {
      if (changes.effect) data.code = changes.effect;
      else delete data.code;
    }
  }

  private buildTransition(sourceId: string, targetId: string, changes: ModelModification['changes']): BesserEdge {
    const data: BesserEdge['data'] & Record<string, any> = {
      name: '',
      params: {},
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      isManuallyLayouted: false,
    };
    this.applyTransitionFields(data, changes);
    return {
      id: ModifierHelpers.generateUniqueId('transition'),
      source: sourceId,
      target: targetId,
      type: 'StateTransition' as any,
      sourceHandle: 'right',
      targetHandle: 'left',
      data,
    };
  }

  private modifyState(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { stateId, stateName } = modification.target;
    const changes = modification.changes || {};
    let target: BesserNode | undefined;
    if (stateId) target = ModifierHelpers.findNodeById(model, stateId);
    if (!target) target = this.findStateByName(model, stateName);
    if (!target) {
      throw new Error(`State '${stateName ?? stateId}' not found.`);
    }
    const data = target.data as any;
    if (changes.name) data.name = changes.name;

    if ((target.type as string) !== 'State') return model;

    const bodies: BodyRow[] = Array.isArray(data.bodies) ? data.bodies : [];
    for (const { field, prefix } of ACTION_ROWS) {
      const value = changes[field];
      if (typeof value !== 'string') continue;
      const index = bodies.findIndex((b) => new RegExp(`^${prefix}\\s*/`, 'i').test(b.name ?? ''));
      if (!value) {
        if (index >= 0) bodies.splice(index, 1);
      } else if (index >= 0) {
        bodies[index] = { ...bodies[index], name: `${prefix} / ${value}` };
      } else {
        bodies.push({ id: ModifierHelpers.generateUniqueId('body'), name: `${prefix} / ${value}` });
      }
    }
    data.bodies = bodies;
    const rows = bodies.length + (Array.isArray(data.fallbackBodies) ? data.fallbackBodies.length : 0);
    target.height = Math.max(target.height ?? 0, stateHeight(rows));
    target.measured = { width: target.width ?? 160, height: target.height };

    // v4 has no initial/final flag on a State: it is initial when the initial
    // pseudo-state points at it, final when it leads to the final one.
    const stateType = (changes.stateType || '').toLowerCase();
    if (stateType === 'initial') this.makeInitial(model, target);
    if (stateType === 'final') this.makeFinal(model, target);
    return model;
  }

  /** Point the initial pseudo-state at `state` (its only transition), creating it if missing. */
  private makeInitial(model: BESSERModel, state: BesserNode): void {
    let initial = ModifierHelpers.findNodesByType(model, 'StateInitialNode')[0];
    if (!initial) {
      initial = {
        id: ModifierHelpers.generateUniqueId('state'),
        type: 'StateInitialNode' as any,
        position: { x: (state.position?.x ?? 0) - 120, y: state.position?.y ?? 0 },
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, initial);
    }
    const initialId = initial.id;
    (model as any).edges = ModifierHelpers.edges(model).filter((e) => e.source !== initialId);
    ModifierHelpers.addEdge(model, this.buildTransition(initialId, state.id, {}));
  }

  /** Give `state` a transition into the final pseudo-state, creating it if missing. */
  private makeFinal(model: BESSERModel, state: BesserNode): void {
    let final = ModifierHelpers.findNodesByType(model, 'StateFinalNode')[0];
    if (!final) {
      final = {
        id: ModifierHelpers.generateUniqueId('state'),
        type: 'StateFinalNode' as any,
        position: { x: (state.position?.x ?? 0) + 240, y: state.position?.y ?? 0 },
        width: 45,
        height: 45,
        measured: { width: 45, height: 45 },
        data: { name: '' },
      };
      ModifierHelpers.addNode(model, final);
    }
    const finalId = final.id;
    const exists = ModifierHelpers.edges(model).some((e) => e.source === state.id && e.target === finalId);
    if (!exists) ModifierHelpers.addEdge(model, this.buildTransition(state.id, finalId, {}));
  }

  private addTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const names = this.endpointNames(modification);
    // An explicit empty source means "from the start" (legacy spec shape).
    const sourceNode = names.source === ''
      ? ModifierHelpers.findNodesByType(model, 'StateInitialNode')[0]
      : this.findEndpoint(model, names.source, 'source');
    const targetNode = this.findEndpoint(model, names.target, 'target');

    if (!sourceNode || !targetNode) {
      throw new Error(`Could not locate source (${names.source}) or target (${names.target}) state for transition.`);
    }

    ModifierHelpers.addEdge(model, this.buildTransition(sourceNode.id, targetNode.id, modification.changes || {}));
    return model;
  }

  private modifyTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const [edge] = this.findTransitions(model, modification);
    if (!edge) {
      const names = this.endpointNames(modification);
      throw new Error(`No transition from '${names.source}' to '${names.target}'.`);
    }
    const data = { ...edge.data } as BesserEdge['data'] & Record<string, any>;
    this.applyTransitionFields(data, modification.changes || {});
    edge.data = data;
    return model;
  }

  private removeTransition(model: BESSERModel, modification: ModelModification): BESSERModel {
    const doomed = new Set(this.findTransitions(model, modification).map((e) => e.id));
    if (doomed.size === 0) return model;
    (model as any).edges = ModifierHelpers.edges(model).filter((e) => !doomed.has(e.id));
    return model;
  }

  private addCodeBlock(model: BESSERModel, modification: ModelModification): BESSERModel {
    const changes = modification.changes;
    const pos = this.nextPosition(model);
    const codeBlockId = ModifierHelpers.generateUniqueId('codeblock');
    const node: BesserNode = {
      id: codeBlockId,
      type: 'StateCodeBlock' as any,
      position: pos,
      width: 200,
      height: 150,
      measured: { width: 200, height: 150 },
      data: {
        name: changes.name || modification.target.stateName || 'Code',
        code: changes.code || '',
        language: changes.language || 'python',
      },
    };
    ModifierHelpers.addNode(model, node);
    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const target = modification.target || {};
    // A transition is named by its id or both endpoints; a state by its name.
    const names = this.endpointNames(modification);
    if (target.transitionId || (names.source && names.target && !target.stateName && !target.stateId)) {
      return this.removeTransition(model, modification);
    }
    let state: BesserNode | undefined;
    if (target.stateId) state = ModifierHelpers.findNodeById(model, target.stateId);
    if (!state) state = this.findStateByName(model, target.stateName);
    if (state) return ModifierHelpers.removeNodeWithChildren(model, state.id);
    return model;
  }
}
