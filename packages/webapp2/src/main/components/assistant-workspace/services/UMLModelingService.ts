import { updateDiagramModelThunk } from '../../../services/workspace/workspaceSlice';
import type { AppDispatch } from '../../../store/store';
import { ConverterFactory } from './converters';
import type { DiagramType } from './shared-types';
import { ModifierFactory, ModelModification } from './modifiers';

// Re-export ModelModification for backward compatibility
export type { ModelModification };

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

export interface BESSERModel {
  version: string;
  type: string; // DiagramType: ClassDiagram, ObjectDiagram, StateMachineDiagram, AgentDiagram
  size: { width: number; height: number };
  elements: Record<string, any>;
  relationships: Record<string, any>;
  interactive: { elements: Record<string, any>; relationships: Record<string, any> };
  assessments: Record<string, any>;
}

/**
 * Service class for handling UML modeling operations
 * Centralizes all model manipulation logic
 * Supports all diagram types: ClassDiagram, ObjectDiagram, StateMachineDiagram,
 * AgentDiagram, QuantumCircuitDiagram, GUINoCodeDiagram
 */
export class UMLModelingService {
  private readonly layoutStartX = -940;
  private readonly layoutStartY = -600;
  private readonly layoutStepX = 360;
  private readonly layoutStepY = 280;
  private readonly layoutColumns = 3;

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
    this.currentDiagramType = model.type || 'ClassDiagram';
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
      return this.editor.model;
    }

    // Return default model structure with current diagram type
    return {
      version: "3.0.0",
      type: this.currentDiagramType,
      size: { width: 1400, height: 740 },
      elements: {},
      relationships: {},
      interactive: { elements: {}, relationships: {} },
      assessments: {}
    };
  }

  /**
   * Process a simple class specification - now supports all diagram types
   */
  processSimpleClassSpec(spec: any, diagramType?: string): ModelUpdate {
    try {
      const type = (diagramType || this.currentDiagramType) as DiagramType;
      const converter = ConverterFactory.getConverter(type);
      const currentModel = this.getCurrentModel();
      const insertPosition = this.hasPositionHint(spec) ? undefined : this.getNextLayoutPosition(currentModel);
      const completeElement = converter.convertSingleElement(spec, insertPosition);
      
      return {
        type: 'single_element',
        data: completeElement,
        message: `✨ Created element in ${type}`
      };
    } catch (error) {
      throw new Error(`Failed to process element specification: ${error}`);
    }
  }

  /**
   * Process a complete system specification - now supports all diagram types
   */
  processSystemSpec(systemSpec: any, diagramType?: string, replaceExisting?: boolean): ModelUpdate {
    try {
      const type = (diagramType || this.currentDiagramType) as DiagramType;
      const converter = ConverterFactory.getConverter(type);
      const completeSystem = converter.convertCompleteSystem(systemSpec);
      const shouldKeepExplicitLayout = this.hasExplicitSystemLayout(systemSpec, type);
      const shiftedSystem = shouldKeepExplicitLayout
        ? completeSystem
        : (() => {
            const currentModel = this.getCurrentModel();
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
      throw new Error(`Failed to process system specification: ${error}`);
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
      
      // Generate success message
      const targetName = modification.target.className || 
                        modification.target.stateName || 
                        modification.target.objectName || 
                        'element';
      
      return {
        type: 'modification',
        data: updatedModel,
        message: `✅ Applied ${modification.action} to ${targetName} in ${diagramType}`
      };
    } catch (error) {
      throw new Error(`Failed to apply modification: ${error instanceof Error ? error.message : error}`);
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
        await this.editor.nextRender;
        this.editor.model = { ...updatedModel };
        await this.editor.nextRender;
      } else {
        console.warn('[UMLModelingService] No editor reference — model saved to Redux only');
      }

      // Update our current model reference
      this.updateCurrentModel(updatedModel);

      return true;
    } catch (error) {
      console.error('[UMLModelingService] Error injecting to editor:', error);
      throw error; // Re-throw to let caller handle it
    }
  }

  async replaceModel(model: Partial<BESSERModel>): Promise<boolean> {
    if (!model || typeof model !== 'object') {
      throw new Error('Invalid model payload');
    }

    const currentModel = this.getCurrentModel();
    const mergedModel: BESSERModel = {
      ...currentModel,
      ...model,
      version: typeof model.version === 'string' ? model.version : currentModel.version || '3.0.0',
      type: typeof model.type === 'string' ? model.type : currentModel.type || this.currentDiagramType,
      size: model.size || currentModel.size,
      elements: model.elements || currentModel.elements || {},
      relationships: model.relationships || currentModel.relationships || {},
      interactive: model.interactive || currentModel.interactive || { elements: {}, relationships: {} },
      assessments: model.assessments || currentModel.assessments || {}
    };

    if (!mergedModel.elements || typeof mergedModel.elements !== 'object' || Array.isArray(mergedModel.elements)) {
      throw new Error('Model elements must be provided as a keyed object');
    }

    if (Object.keys(mergedModel.elements).length === 0) {
      throw new Error('Model payload does not include any elements to render');
    }

    // Persist to Redux store first, then update editor
    await this.dispatch(updateDiagramModelThunk({
      model: mergedModel as any,
    })).unwrap();

    if (this.editor) {
      await this.editor.nextRender;
      this.editor.model = { ...mergedModel };
      await this.editor.nextRender;
    } else {
      console.warn('[UMLModelingService] No editor reference — model saved to Redux only');
    }

    this.updateCurrentModel(mergedModel);

    return true;
  }

  /**
   * Get all top-level diagram elements with coordinates.
   */
  private getTopLevelElements(model: Partial<BESSERModel> | null | undefined): Array<{ id: string; bounds: { x: number; y: number } }> {
    if (!model?.elements || typeof model.elements !== 'object') {
      return [];
    }

    return Object.entries(model.elements)
      .filter(([, element]) => {
        const candidate = element as any;
        if (!candidate || typeof candidate !== 'object') {
          return false;
        }
        if (candidate.owner !== null && candidate.owner !== undefined) {
          return false;
        }
        const bounds = candidate.bounds;
        return bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number';
      })
      .map(([id, element]) => ({
        id,
        bounds: {
          x: (element as any).bounds.x,
          y: (element as any).bounds.y,
        },
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
   * Shift system elements (and relationship geometry) by an offset.
   */
  private offsetSystemLayout(systemData: any, offset: { x: number; y: number }): any {
    if (!systemData || !systemData.elements || (offset.x === 0 && offset.y === 0)) {
      return systemData;
    }

    const shiftedElements = Object.fromEntries(
      Object.entries(systemData.elements).map(([elementId, element]) => {
        const candidate = element as any;
        if (!candidate?.bounds) {
          return [elementId, candidate];
        }
        return [
          elementId,
          {
            ...candidate,
            bounds: {
              ...candidate.bounds,
              x: candidate.bounds.x + offset.x,
              y: candidate.bounds.y + offset.y,
            },
          },
        ];
      }),
    );

    const shiftedRelationships = Object.fromEntries(
      Object.entries(systemData.relationships || {}).map(([relationshipId, relationship]) => {
        const candidate = relationship as any;
        if (!candidate || typeof candidate !== 'object') {
          return [relationshipId, candidate];
        }

        const shiftBounds = (bounds: any) =>
          bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number'
            ? { ...bounds, x: bounds.x + offset.x, y: bounds.y + offset.y }
            : bounds;

        const shiftedPath = Array.isArray(candidate.path)
          ? candidate.path.map((point: any) =>
              point && typeof point.x === 'number' && typeof point.y === 'number'
                ? { ...point, x: point.x + offset.x, y: point.y + offset.y }
                : point,
            )
          : candidate.path;

        return [
          relationshipId,
          {
            ...candidate,
            bounds: shiftBounds(candidate.bounds),
            path: shiftedPath,
            source: candidate.source ? { ...candidate.source, bounds: shiftBounds(candidate.source.bounds) } : candidate.source,
            target: candidate.target ? { ...candidate.target, bounds: shiftBounds(candidate.target.bounds) } : candidate.target,
          },
        ];
      }),
    );

    return {
      ...systemData,
      elements: shiftedElements,
      relationships: shiftedRelationships,
    };
  }

  /**
   * Merge single element into existing model
   */
  private mergeElementIntoModel(currentModel: BESSERModel, elementData: any): BESSERModel {
    const updatedElements = { ...(currentModel.elements || {}) };
    const updatedRelationships = { ...(currentModel.relationships || {}) };

    // Handle different diagram types - each has different main element
    // ClassDiagram: class, attributes, methods
    // ObjectDiagram: object, attributes
    // StateMachineDiagram: state, bodies
    // AgentDiagram: state/intent, bodies
    
    // Find the main element (the one without an owner)
    const mainElement = elementData.class || elementData.object || elementData.state || 
                       elementData.intent || elementData.initialNode;
    
    if (!mainElement) {
      throw new Error('No main element found in elementData');
    }
    
    // Add main element
    updatedElements[mainElement.id] = mainElement;

    // Add child elements (attributes, methods, bodies, etc.)
    if (elementData.attributes) {
      Object.assign(updatedElements, elementData.attributes);
    }
    
    if (elementData.methods) {
      Object.assign(updatedElements, elementData.methods);
    }

    if (elementData.bodies) {
      Object.assign(updatedElements, elementData.bodies);
    }

    if (elementData.relationships) {
      Object.assign(updatedRelationships, elementData.relationships);
    }

    return {
      ...currentModel,
      elements: updatedElements,
      relationships: updatedRelationships
    };
  }

  /**
   * Merge complete system into existing model
   */
  private mergeSystemIntoModel(currentModel: BESSERModel, systemData: any): BESSERModel {
    return {
      ...currentModel,
      elements: {
        ...currentModel.elements,
        ...systemData.elements
      },
      relationships: {
        ...currentModel.relationships,
        ...systemData.relationships
      },
      size: systemData.size || currentModel.size
    };
  }

}
