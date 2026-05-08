import { updateDiagramModelThunk } from '../../../app/store/workspaceSlice';
import type { AppDispatch } from '../../../app/store/store';
import { ConverterFactory } from './converters';
import type { DiagramType } from './shared-types';
import { ModifierFactory, ModelModification } from './modifiers';
import { LAYOUT_COLUMNS, LAYOUT_H_GAP, LAYOUT_V_GAP, LAYOUT_START_X, LAYOUT_START_Y } from './shared/layoutUtils';
import { pushUndoSnapshot } from './undoStack';
import type { BesserEdge, BesserNode, UMLModel } from '@besser/wme';

// Re-export ModelModification for backward compatibility
export type { ModelModification };

// Re-export undo functions for backward compatibility.
// New code should import directly from './undoStack'.
export { pushUndoSnapshot, popUndo, canUndo, getLastUndoDescription, clearUndoStack, getUndoStackSize } from './undoStack';

// Enhanced interfaces for better type safety
export interface ClassSpec {
  className: string;
  position?: { x: number; y: number };
  attributes: Array<{
    name: string;
    type: string;
    visibility: 'public' | 'private' | 'protected';
  }>;
  methods: Array<{
    name: string;
    returnType: string;
    visibility: 'public' | 'private' | 'protected';
    parameters: Array<{ name: string; type: string; }>;
  }>;
}

export interface SystemSpec {
  systemName: string;
  classes: ClassSpec[];
  relationships: Array<{
    type: 'Association' | 'Inheritance' | 'Composition' | 'Aggregation';
    sourceClass: string;
    targetClass: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    name?: string;
  }>;
}

export interface ModelUpdate {
  type: 'single_element' | 'complete_system' | 'modification';
  data: any;
  message: string;
  replaceExisting?: boolean;
}

/**
 * SA-7b.1: webapp internals consume v4 directly. `BESSERModel` is now a thin
 * alias for the lib's v4 `UMLModel`. Modifiers, converters, and
 * UMLModelingService walk `nodes[]` / `edges[]` natively — no v3 detour.
 *
 * Some `data` fields per-diagram are not exhaustively typed by the lib (it
 * uses `[key: string]: unknown`), so individual modifier files narrow with
 * `as any` casts at access sites where needed.
 */
export type BESSERModel = UMLModel;

/**
 * Service class for handling UML modeling operations
 * Centralizes all model manipulation logic
 * Supports all diagram types: ClassDiagram, ObjectDiagram, StateMachineDiagram,
 * AgentDiagram, QuantumCircuitDiagram, GUINoCodeDiagram
 */
export class UMLModelingService {
  private readonly layoutStartX = LAYOUT_START_X;
  private readonly layoutStartY = LAYOUT_START_Y;
  private readonly layoutStepX = LAYOUT_H_GAP;
  private readonly layoutStepY = LAYOUT_V_GAP;
  private readonly layoutColumns = LAYOUT_COLUMNS;

  private editor: any;
  private dispatch: AppDispatch;
  private currentModel: BESSERModel | null = null;
  private currentDiagramType: string = 'ClassDiagram';

  constructor(editor: any, dispatch: AppDispatch) {
    this.editor = editor;
    this.dispatch = dispatch;
  }

  /**
   * Update editor reference (important for when editor gets recreated)
   */
  updateEditorReference(editor: any) {
    this.editor = editor;
  }

  /**
   * Update the current model reference
   */
  updateCurrentModel(model: BESSERModel) {
    this.currentModel = model;
    this.currentDiagramType = (model as any).type || 'ClassDiagram';
  }

  /**
   * Get current diagram type
   */
  getCurrentDiagramType(): string {
    return this.currentDiagramType;
  }

  /**
   * Get the current model from editor, Redux, or create default
   */
  getCurrentModel(): BESSERModel {
    if (this.currentModel) {
      return this.currentModel;
    }

    if (this.editor?.model) {
      // SA-7b.1: editor.model is v4; consume directly.
      return this.editor.model as BESSERModel;
    }

    // Default empty v4 model.
    return this.createEmptyModel(this.currentDiagramType);
  }

  private createEmptyModel(type: string): BESSERModel {
    return {
      version: '4.0.0',
      id: '',
      title: '',
      type: type as any,
      nodes: [],
      edges: [],
      assessments: {},
    } as unknown as BESSERModel;
  }

  /**
   * Process a simple class specification - now supports all diagram types
   */
  processSimpleClassSpec(spec: any, diagramType?: string): ModelUpdate {
    try {
      const type = (diagramType || this.currentDiagramType) as DiagramType;
      const converter = ConverterFactory.getConverter(type);
      const currentModel = this.getCurrentModel();

      // Snapshot before changes
      const elementName = spec?.className || spec?.name || spec?.stateName || spec?.objectName || 'element';
      pushUndoSnapshot(currentModel, `Add ${elementName}`);

      const insertPosition = this.hasPositionHint(spec) ? undefined : this.getNextLayoutPosition(currentModel);
      const completeElement = converter.convertSingleElement(spec, insertPosition);

      return {
        type: 'single_element',
        data: completeElement,
        message: `✨ Created element in ${type}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const elementName = spec?.className || spec?.name || spec?.stateName || spec?.objectName || 'element';

      if (errorMessage.includes('not found')) {
        throw new Error(
          `Could not find the element "${elementName}". Make sure it exists in the current diagram.`
        );
      }
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        throw new Error(
          `An element named "${elementName}" already exists. Try a different name.`
        );
      }
      throw new Error(`Failed to process element specification: ${errorMessage}`);
    }
  }

  /**
   * Process a complete system specification - now supports all diagram types
   */
  processSystemSpec(systemSpec: any, diagramType?: string, replaceExisting?: boolean): ModelUpdate {
    try {
      const type = (diagramType || this.currentDiagramType) as DiagramType;
      const converter = ConverterFactory.getConverter(type);
      const currentModel = this.getCurrentModel();

      // Build a descriptive label for undo
      const systemName = systemSpec?.systemName || systemSpec?.name || type;
      const classCount =
        (Array.isArray(systemSpec?.classes) ? systemSpec.classes.length : 0) ||
        (Array.isArray(systemSpec?.states) ? systemSpec.states.length : 0) ||
        (Array.isArray(systemSpec?.objects) ? systemSpec.objects.length : 0);
      const undoLabel = classCount
        ? `Create ${systemName} (${classCount} elements)`
        : `Create ${systemName} system`;
      pushUndoSnapshot(currentModel, undoLabel);

      const completeSystem = converter.convertCompleteSystem(systemSpec);
      const shouldKeepExplicitLayout = this.hasExplicitSystemLayout(systemSpec, type);
      const shiftedSystem = shouldKeepExplicitLayout
        ? completeSystem
        : (() => {
            const nextPosition = replaceExisting
              ? { x: 0, y: 0 }
              : this.getNextLayoutPosition(currentModel);
            const anchorPosition = this.getLayoutAnchor(completeSystem);
            return this.offsetSystemLayout(completeSystem, {
              x: nextPosition.x - anchorPosition.x,
              y: nextPosition.y - anchorPosition.y,
            });
          })();

      return {
        type: 'complete_system',
        data: shiftedSystem,
        message: replaceExisting
          ? `🔄 Replaced with new ${type} system`
          : `✨ Created complete ${type} system`,
        replaceExisting: !!replaceExisting,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const systemName = systemSpec?.systemName || systemSpec?.name || 'system';

      if (errorMessage.includes('not found')) {
        throw new Error(
          `Could not find a referenced element while building "${systemName}". Verify all class/state names are consistent.`
        );
      }
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        throw new Error(
          `A duplicate element name was detected in "${systemName}". Each element must have a unique name.`
        );
      }
      throw new Error(`Failed to process system specification: ${errorMessage}`);
    }
  }

  /**
   * Process model modifications (edit existing elements)
   * Uses ModifierFactory to delegate to diagram-specific modifiers
   */
  processModelModification(modification: ModelModification): ModelUpdate {
    try {
      const currentModel = this.getCurrentModel();
      const diagramType = this.currentDiagramType as DiagramType;

      const targetName = modification.target.className ||
                        modification.target.stateName ||
                        modification.target.objectName ||
                        'element';

      // Snapshot before changes
      pushUndoSnapshot(currentModel, `Modify ${targetName}`);

      // Get diagram-specific modifier
      const modifier = ModifierFactory.getModifier(diagramType);

      // Validate action is supported for this diagram type
      if (!modifier.canHandle(modification.action)) {
        throw new Error(
          `Action '${modification.action}' is not supported for ${diagramType} diagrams.`
        );
      }

      // Apply modification using diagram-specific logic
      const updatedModel = modifier.applyModification(currentModel, modification);

      return {
        type: 'modification',
        data: updatedModel,
        message: `✅ Applied ${modification.action} to ${targetName} in ${diagramType}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const targetName = modification.target.className ||
                        modification.target.stateName ||
                        modification.target.objectName ||
                        'element';

      if (errorMessage.includes('not found')) {
        throw new Error(
          `Could not find the element "${targetName}". Make sure it exists in the current diagram.`
        );
      }
      if (errorMessage.includes('duplicate') || errorMessage.includes('already exists')) {
        throw new Error(
          `An element named "${targetName}" already exists. Try a different name.`
        );
      }
      if (errorMessage.includes('not supported')) {
        throw new Error(errorMessage);
      }
      throw new Error(`Failed to apply modification to "${targetName}": ${errorMessage}`);
    }
  }

  /**
   * Process multiple model modifications in a single batch.
   * Each modification is applied sequentially on the result of the previous one.
   */
  processModelModifications(modifications: ModelModification[]): ModelUpdate {
    if (!modifications.length) {
      throw new Error('No modifications provided');
    }

    let latestModel = this.getCurrentModel();
    const diagramType = this.currentDiagramType as DiagramType;
    const modifier = ModifierFactory.getModifier(diagramType);
    const applied: string[] = [];

    // Snapshot before the batch
    pushUndoSnapshot(latestModel, `Batch modify (${modifications.length} changes)`);

    for (const mod of modifications) {
      if (!modifier.canHandle(mod.action)) {
        continue;
      }
      latestModel = modifier.applyModification(latestModel, mod);
      applied.push(mod.action);
    }

    return {
      type: 'modification',
      data: latestModel,
      message: `✅ Applied ${applied.length} modification(s) in ${diagramType}: ${applied.join(', ')}`
    };
  }

  /**
   * Inject a ModelUpdate into the live editor and persist to Redux.
   */
  async injectToEditor(update: ModelUpdate): Promise<boolean> {
    try {
      const currentModel = this.getCurrentModel();
      let updatedModel: BESSERModel;

      switch (update.type) {
        case 'single_element':
          updatedModel = this.mergeElementIntoModel(currentModel, update.data);
          break;
        case 'complete_system':
          updatedModel = update.replaceExisting
            ? update.data  // Replace: use system data as the entire model
            : this.mergeSystemIntoModel(currentModel, update.data);
          break;
        case 'modification':
          updatedModel = update.data;
          break;
        default:
          throw new Error(`Unknown update type: ${update.type}`);
      }

      // Persist to Redux store first, then update editor
      await this.dispatch(updateDiagramModelThunk({
        model: updatedModel as any,
      })).unwrap();

      if (this.editor) {
        await this.editor.ready;
        this.editor.model = { ...(updatedModel as any) };
        await this.editor.ready;
      } else {
        console.warn('[UMLModelingService] No editor reference — model saved to Redux only');
      }

      // Update our current model reference
      this.updateCurrentModel(updatedModel);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[UMLModelingService] Error injecting to editor:', error);

      if (errorMessage.includes('No main element')) {
        throw new Error(
          'The generated element data is incomplete. The assistant produced an invalid structure — please try again.'
        );
      }
      if (errorMessage.includes('dispatch') || errorMessage.includes('Redux') || errorMessage.includes('thunk')) {
        throw new Error(
          `Failed to persist the model update to the editor store: ${errorMessage}`
        );
      }
      throw new Error(`Failed to apply change to editor: ${errorMessage}`);
    }
  }

  async replaceModel(model: Partial<BESSERModel>): Promise<boolean> {
    if (!model || typeof model !== 'object') {
      throw new Error('Invalid model payload');
    }

    const currentModel = this.getCurrentModel();

    // Snapshot before full replacement
    pushUndoSnapshot(currentModel, 'Replace entire model');

    const m = model as any;
    const cur = currentModel as any;
    const mergedModel = {
      ...cur,
      ...m,
      version: typeof m.version === 'string' ? m.version : cur.version || '4.0.0',
      type: typeof m.type === 'string' ? m.type : cur.type || this.currentDiagramType,
      nodes: Array.isArray(m.nodes) ? m.nodes : cur.nodes || [],
      edges: Array.isArray(m.edges) ? m.edges : cur.edges || [],
      assessments: m.assessments || cur.assessments || {},
    } as BESSERModel;

    if (!Array.isArray((mergedModel as any).nodes)) {
      throw new Error('Model nodes must be provided as an array');
    }

    if ((mergedModel as any).nodes.length === 0) {
      throw new Error('Model payload does not include any nodes to render');
    }

    // Persist to Redux store first, then update editor
    await this.dispatch(updateDiagramModelThunk({
      model: mergedModel as any,
    })).unwrap();

    if (this.editor) {
      await this.editor.ready;
      this.editor.model = { ...(mergedModel as any) };
      await this.editor.ready;
    } else {
      console.warn('[UMLModelingService] No editor reference — model saved to Redux only');
    }

    this.updateCurrentModel(mergedModel);

    return true;
  }

  /**
   * Get all top-level diagram nodes with positions (no parentId).
   */
  private getTopLevelElements(model: Partial<BESSERModel> | null | undefined): Array<{ id: string; bounds: { x: number; y: number } }> {
    const m = model as any;
    if (!Array.isArray(m?.nodes)) {
      return [];
    }

    return (m.nodes as BesserNode[])
      .filter((n) => {
        if (!n || typeof n !== 'object') return false;
        if (n.parentId) return false;
        const pos = n.position;
        return pos && typeof pos.x === 'number' && typeof pos.y === 'number';
      })
      .map((n) => ({
        id: n.id,
        bounds: { x: n.position.x, y: n.position.y },
      }));
  }

  /**
   * Compute the next free grid coordinate based on existing top-level elements.
   */
  private getNextLayoutPosition(model: BESSERModel): { x: number; y: number } {
    const topLevelElements = this.getTopLevelElements(model);
    const occupied = new Set<string>();

    topLevelElements.forEach(({ bounds }) => {
      const col = Math.max(0, Math.round((bounds.x - this.layoutStartX) / this.layoutStepX));
      const row = Math.max(0, Math.round((bounds.y - this.layoutStartY) / this.layoutStepY));
      occupied.add(`${col}:${row}`);
    });

    const maxRowsToScan = Math.max(8, Math.ceil((topLevelElements.length + 1) / this.layoutColumns) + 6);
    for (let row = 0; row < maxRowsToScan; row += 1) {
      for (let col = 0; col < this.layoutColumns; col += 1) {
        const key = `${col}:${row}`;
        if (!occupied.has(key)) {
          return {
            x: this.layoutStartX + col * this.layoutStepX,
            y: this.layoutStartY + row * this.layoutStepY,
          };
        }
      }
    }

    const fallbackRow = Math.ceil(topLevelElements.length / this.layoutColumns);
    return {
      x: this.layoutStartX,
      y: this.layoutStartY + fallbackRow * this.layoutStepY,
    };
  }

  private hasPositionHint(spec: any): boolean {
    if (!spec || typeof spec !== 'object') {
      return false;
    }
    const nested = spec.position;
    const x = nested && typeof nested === 'object' ? nested.x : spec.x;
    const y = nested && typeof nested === 'object' ? nested.y : spec.y;
    const parsedX = typeof x === 'string' ? Number(x) : x;
    const parsedY = typeof y === 'string' ? Number(y) : y;
    return Number.isFinite(parsedX) && Number.isFinite(parsedY);
  }

  private hasExplicitSystemLayout(systemSpec: any, diagramType: DiagramType): boolean {
    if (!systemSpec || typeof systemSpec !== 'object') {
      return false;
    }

    if (diagramType === 'ClassDiagram') {
      return Array.isArray(systemSpec.classes) && systemSpec.classes.some((item: any) => this.hasPositionHint(item));
    }

    if (diagramType === 'ObjectDiagram') {
      return Array.isArray(systemSpec.objects) && systemSpec.objects.some((item: any) => this.hasPositionHint(item));
    }

    if (diagramType === 'StateMachineDiagram') {
      return Array.isArray(systemSpec.states) && systemSpec.states.some((item: any) => this.hasPositionHint(item));
    }

    if (diagramType === 'AgentDiagram') {
      const stateHints = Array.isArray(systemSpec.states) && systemSpec.states.some((item: any) => this.hasPositionHint(item));
      const intentHints = Array.isArray(systemSpec.intents) && systemSpec.intents.some((item: any) => this.hasPositionHint(item));
      const initialHint = this.hasPositionHint(systemSpec.initialNode) || this.hasPositionHint({ position: systemSpec.initialPosition });
      return Boolean(stateHints || intentHints || initialHint);
    }

    if (diagramType === 'QuantumCircuitDiagram') {
      return Array.isArray(systemSpec.gates) && systemSpec.gates.some((item: any) => item.column != null);
    }

    if (diagramType === 'GUINoCodeDiagram') {
      const pageHints = Array.isArray(systemSpec.pages) && systemSpec.pages.some((p: any) =>
        Array.isArray(p.components) && p.components.some((c: any) => this.hasPositionHint(c))
      );
      const compHints = Array.isArray(systemSpec.components) && systemSpec.components.some((c: any) => this.hasPositionHint(c));
      return Boolean(pageHints || compHints);
    }

    return false;
  }

  /**
   * Anchor used to offset generated systems into a free area in the current canvas.
   */
  private getLayoutAnchor(systemData: any): { x: number; y: number } {
    const topLevelElements = this.getTopLevelElements(systemData as Partial<BESSERModel>);
    if (!topLevelElements.length) {
      return { x: this.layoutStartX, y: this.layoutStartY };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    topLevelElements.forEach(({ bounds }) => {
      if (bounds.x < minX) {
        minX = bounds.x;
      }
      if (bounds.y < minY) {
        minY = bounds.y;
      }
    });

    return { x: minX, y: minY };
  }

  /**
   * Shift v4 nodes (and edge geometry) by an offset.
   */
  private offsetSystemLayout(systemData: any, offset: { x: number; y: number }): any {
    if (!systemData || (offset.x === 0 && offset.y === 0)) {
      return systemData;
    }

    const nodes = Array.isArray(systemData.nodes) ? systemData.nodes : [];
    const edges = Array.isArray(systemData.edges) ? systemData.edges : [];

    const shiftedNodes = (nodes as BesserNode[]).map((node) => {
      if (!node?.position) return node;
      // Only shift root-level nodes; child nodes are positioned relative to their parent.
      if (node.parentId) return node;
      return {
        ...node,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
      };
    });

    const shiftedEdges = (edges as BesserEdge[]).map((edge) => {
      if (!edge?.data?.points) return edge;
      const shiftedPoints = Array.isArray(edge.data.points)
        ? edge.data.points.map((p: any) =>
            p && typeof p.x === 'number' && typeof p.y === 'number'
              ? { ...p, x: p.x + offset.x, y: p.y + offset.y }
              : p,
          )
        : edge.data.points;
      return {
        ...edge,
        data: {
          ...edge.data,
          points: shiftedPoints,
        },
      };
    });

    return {
      ...systemData,
      nodes: shiftedNodes,
      edges: shiftedEdges,
    };
  }

  /**
   * Merge single-element converter output into existing v4 model.
   * Single-element output may be either:
   *   - {nodes: BesserNode[], edges?: BesserEdge[]} (canonical v4 partial)
   *   - a single BesserNode (no wrapper)
   */
  private mergeElementIntoModel(currentModel: BESSERModel, elementData: any): BESSERModel {
    const cur = currentModel as any;
    const baseNodes = Array.isArray(cur.nodes) ? cur.nodes : [];
    const baseEdges = Array.isArray(cur.edges) ? cur.edges : [];

    let newNodes: BesserNode[] = [];
    let newEdges: BesserEdge[] = [];

    if (Array.isArray(elementData)) {
      newNodes = elementData.filter((n: any) => n && typeof n === 'object' && n.id);
    } else if (elementData && typeof elementData === 'object') {
      if (Array.isArray(elementData.nodes)) {
        newNodes = elementData.nodes;
      } else if (elementData.id && elementData.type && elementData.position) {
        newNodes = [elementData];
      }
      if (Array.isArray(elementData.edges)) {
        newEdges = elementData.edges;
      }
    }

    if (newNodes.length === 0 && newEdges.length === 0) {
      throw new Error('No main element found in elementData');
    }

    return {
      ...cur,
      nodes: [...baseNodes, ...newNodes],
      edges: [...baseEdges, ...newEdges],
    } as BESSERModel;
  }

  /**
   * Merge complete system (v4 model) into existing v4 model.
   */
  private mergeSystemIntoModel(currentModel: BESSERModel, systemData: any): BESSERModel {
    const cur = currentModel as any;
    return {
      ...cur,
      nodes: [...(cur.nodes ?? []), ...((systemData?.nodes as BesserNode[]) ?? [])],
      edges: [...(cur.edges ?? []), ...((systemData?.edges as BesserEdge[]) ?? [])],
    } as BESSERModel;
  }
}
