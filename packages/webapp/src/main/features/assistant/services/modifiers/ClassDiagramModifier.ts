/**
 * Class Diagram Modifier (v4-native)
 *
 * Walks v4 `model.nodes[]` / `model.edges[]` directly.
 *
 * v4 ClassDiagram shape (per docs/source/migrations/uml-v4-shape.md):
 *   - All classifiers (Class, AbstractClass, Interface, Enumeration) collapse
 *     into a single `node.type === 'class'` discriminated by `data.stereotype`:
 *       null/undefined → plain Class
 *       'abstract'     → AbstractClass
 *       'interface'    → Interface
 *       'enumeration'  → Enumeration
 *   - Attributes / methods are NOT separate nodes — they are inline rows on
 *     `node.data.attributes` / `node.data.methods` (ClassifierMember[]).
 *   - Edges follow `edge.source` / `edge.target` (node ids), with role &
 *     multiplicity on `edge.data.sourceRole` / `edge.data.sourceMultiplicity`
 *     etc.
 */

import type { BesserEdge, BesserNode } from '@besser/wme';
import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { normalizeType } from '../shared/typeNormalization';

/** v4 ClassifierMember row shape (subset; tolerant of extra fields). */
type ClassifierMember = {
  id: string;
  name: string;
  attributeType?: string;
  visibility?: 'public' | 'private' | 'protected' | 'package';
  isOptional?: boolean;
  isDerived?: boolean;
  defaultValue?: unknown;
  code?: string;
  implementationType?: string;
  [k: string]: unknown;
};

/** All v4 class-like node types live under `node.type === 'class'`. */
const CLASS_NODE_TYPE = 'class';

/** Map a stereotype string to the v3-era element-type label, used by tests/specs. */
const stereotypeToLegacyType = (stereotype: string | null | undefined): string => {
  switch (stereotype) {
    case 'abstract': return 'AbstractClass';
    case 'interface': return 'Interface';
    case 'enumeration': return 'Enumeration';
    default: return 'Class';
  }
};

export class ClassDiagramModifier implements DiagramModifier {
  getDiagramType() {
    return 'ClassDiagram' as const;
  }

  canHandle(action: string): boolean {
    return [
      'add_class',
      'modify_class',
      'add_attribute',
      'modify_attribute',
      'add_method',
      'modify_method',
      'add_relationship',
      'modify_relationship',
      'remove_element',
      'extract_class',
      'split_class',
      'merge_classes',
      'promote_attribute',
      'add_enum',
      'add_ocl_constraint'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!modification.action) {
      throw new Error('Modification is missing required "action" field');
    }

    const refactoringActions = ['extract_class', 'split_class', 'merge_classes', 'promote_attribute', 'add_enum'];
    const isRefactoring = refactoringActions.includes(modification.action);

    if (!isRefactoring) {
      if (!modification.target || typeof modification.target !== 'object') {
        throw new Error(`Modification "${modification.action}" is missing required "target" object`);
      }
      if (modification.action !== 'remove_element' && (!modification.changes || typeof modification.changes !== 'object')) {
        if (modification.action === 'modify_relationship') {
          console.warn(`[ClassDiagramModifier] Skipping modify_relationship with no changes (no-op)`);
          return model;
        }
        throw new Error(`Modification "${modification.action}" is missing required "changes" object`);
      }
    }

    const updatedModel = ModifierHelpers.cloneModel(model);

    switch (modification.action) {
      case 'add_class':         return this.addClass(updatedModel, modification);
      case 'modify_class':      return this.modifyClass(updatedModel, modification);
      case 'add_attribute':     return this.addAttribute(updatedModel, modification);
      case 'modify_attribute':  return this.modifyAttribute(updatedModel, modification);
      case 'add_method':        return this.addMethod(updatedModel, modification);
      case 'modify_method':     return this.modifyMethod(updatedModel, modification);
      case 'add_relationship':  return this.addRelationship(updatedModel, modification);
      case 'modify_relationship': return this.modifyRelationship(updatedModel, modification);
      case 'remove_element':    return this.removeElement(updatedModel, modification);
      case 'extract_class':     return this.extractClass(updatedModel, modification);
      case 'split_class':       return this.splitClass(updatedModel, modification);
      case 'merge_classes':     return this.mergeClasses(updatedModel, modification);
      case 'promote_attribute': return this.promoteAttribute(updatedModel, modification);
      case 'add_enum':          return this.addEnum(updatedModel, modification);
      case 'add_ocl_constraint': return this.addOclConstraint(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ClassDiagram: ${modification.action}`);
    }
  }

  // ─── Helpers (v4) ────────────────────────────────────────────────────────

  /**
   * Find a node representing a class-like classifier (Class / Abstract /
   * Interface / Enumeration) by name. v4 stores them all under
   * `node.type === 'class'` with stereotype distinguishing.
   */
  private findClassNode(model: BESSERModel, className: string): BesserNode | undefined {
    if (!className) return undefined;
    const normalized = className.trim().toLowerCase();
    const classNodes = ModifierHelpers.nodes(model).filter((n) => n.type === CLASS_NODE_TYPE);
    for (const n of classNodes) {
      const data: any = n.data || {};
      if (data.name === className) return n;
    }
    for (const n of classNodes) {
      const data: any = n.data || {};
      if (typeof data.name === 'string' && data.name.trim().toLowerCase() === normalized) return n;
    }
    return undefined;
  }

  /** Find an attribute row on a class node by name (case-insensitive, name-only match). */
  private findAttributeRow(classNode: BesserNode, attributeName: string): ClassifierMember | undefined {
    const data: any = classNode.data || {};
    const rows: ClassifierMember[] = Array.isArray(data.attributes) ? data.attributes : [];
    const normalizedTarget = this.normalizeAttributeName(attributeName);
    for (const row of rows) {
      const candidate = this.normalizeAttributeName(row.name || '');
      if (candidate.toLowerCase() === normalizedTarget.toLowerCase()) return row;
      if ((row.name || '').toLowerCase().includes(attributeName.toLowerCase())) return row;
    }
    return undefined;
  }

  /** Find a method row on a class node by name (case-insensitive). */
  private findMethodRow(classNode: BesserNode, methodName: string): ClassifierMember | undefined {
    const data: any = classNode.data || {};
    const rows: ClassifierMember[] = Array.isArray(data.methods) ? data.methods : [];
    const normalizedTarget = this.normalizeMethodName(methodName);
    for (const row of rows) {
      const candidate = this.normalizeMethodName(row.name || '');
      if (candidate.toLowerCase() === normalizedTarget.toLowerCase()) return row;
      if ((row.name || '').toLowerCase().includes(methodName.toLowerCase())) return row;
    }
    return undefined;
  }

  /** Compute a node's height from its row counts. Mirrors the v3 visual budget. */
  private recalculateClassHeight(node: BesserNode): void {
    const data: any = node.data || {};
    const attrCount = Array.isArray(data.attributes) ? data.attributes.length : 0;
    const methodCount = Array.isArray(data.methods) ? data.methods.length : 0;
    const headerHeight = 50;
    const rowHeight = 25;
    const methodGap = methodCount > 0 ? 10 : 0;
    const padding = 15;
    const h = Math.max(90, headerHeight + attrCount * rowHeight + methodGap + methodCount * rowHeight + padding);
    node.height = h;
    node.measured = { width: node.width, height: h };
  }

  /** Build a v4 class node. */
  private buildClassNode(opts: {
    id: string;
    name: string;
    stereotype?: string | null;
    x: number;
    y: number;
    width?: number;
    height?: number;
    extraData?: Record<string, unknown>;
  }): BesserNode {
    const w = opts.width ?? 220;
    const h = opts.height ?? 90;
    const data: Record<string, unknown> = {
      name: opts.name,
      attributes: [],
      methods: [],
      ...(opts.extraData || {}),
    };
    if (opts.stereotype) {
      data.stereotype = opts.stereotype;
    }
    return {
      id: opts.id,
      type: CLASS_NODE_TYPE as any,
      position: { x: opts.x, y: opts.y },
      width: w,
      height: h,
      measured: { width: w, height: h },
      data,
    };
  }

  /** Find the rightmost class-node and return where to place a new class beside it. */
  private nextClassPosition(model: BESSERModel): { x: number; y: number } {
    let posX = 0;
    let posY = 0;
    for (const node of ModifierHelpers.nodes(model)) {
      if (node.type !== CLASS_NODE_TYPE) continue;
      const right = (node.position?.x ?? 0) + (node.width ?? 220);
      if (right + 80 > posX) {
        posX = right + 80;
        posY = node.position?.y ?? 0;
      }
    }
    return { x: posX, y: posY };
  }

  // ─── Action handlers ──────────────────────────────────────────────────────

  private addClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const className = modification.changes?.className || modification.target?.className;
    if (!className) {
      throw new Error('add_class requires a className in target or changes.');
    }

    if (this.findClassNode(model, className)) {
      console.warn(`[ClassDiagramModifier] addClass: class '${className}' already exists, skipping.`);
      return model;
    }

    const { x: posX, y: posY } = this.nextClassPosition(model);
    const classId = ModifierHelpers.generateUniqueId('class');

    let stereotype: string | null = null;
    if ((modification.changes as any)?.isAbstract ?? (modification as any).isAbstract) stereotype = 'abstract';
    else if ((modification.changes as any)?.isInterface ?? (modification as any).isInterface) stereotype = 'interface';
    else if ((modification.changes as any)?.isEnumeration ?? (modification as any).isEnumeration) stereotype = 'enumeration';

    const node = this.buildClassNode({ id: classId, name: className, stereotype, x: posX, y: posY });

    // Italic flag is a render-time hint; preserve for backward compat with tests that read it.
    if (stereotype === 'abstract' || stereotype === 'interface') {
      (node.data as any).italic = true;
    }

    // Attributes
    const classNames = new Set<string>(
      ModifierHelpers.nodes(model)
        .filter((n) => n.type === CLASS_NODE_TYPE)
        .map((n) => (n.data as any)?.name)
        .filter((n): n is string => typeof n === 'string'),
    );
    classNames.add(className);

    const attributes = modification.changes?.attributes || [];
    const attrRows: ClassifierMember[] = [];
    for (const attrSpec of attributes) {
      const attrId = ModifierHelpers.generateUniqueId('attr');
      const row: ClassifierMember = {
        id: attrId,
        name: attrSpec.name,
        attributeType: normalizeType(attrSpec.type, classNames),
        visibility: (attrSpec.visibility as any) || 'public',
      };
      if ((attrSpec as any).isDerived) row.isDerived = true;
      if ((attrSpec as any).defaultValue !== undefined && (attrSpec as any).defaultValue !== null) {
        row.defaultValue = (attrSpec as any).defaultValue;
      }
      if ((attrSpec as any).isOptional) row.isOptional = true;
      attrRows.push(row);
    }
    (node.data as any).attributes = attrRows;

    // Methods
    const methods = modification.changes?.methods || [];
    const methodRows: ClassifierMember[] = [];
    for (const methodSpec of methods) {
      const methodId = ModifierHelpers.generateUniqueId('method');
      const paramStr = methodSpec.parameters?.map((p: any) => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
      const returnType = normalizeType(methodSpec.returnType || 'any');
      methodRows.push({
        id: methodId,
        name: `${methodSpec.name}(${paramStr})`,
        attributeType: returnType,
        visibility: (methodSpec.visibility as any) || 'public',
      });
    }
    (node.data as any).methods = methodRows;

    this.recalculateClassHeight(node);

    // Test-compat: tests rely on `node.type` mirroring the legacy element type
    // (e.g. 'AbstractClass', 'Enumeration'). Keep it for back-compat during transition;
    // canonical v4 reads still go through `data.stereotype`.
    (node as any).type = stereotypeToLegacyType(stereotype);

    ModifierHelpers.addNode(model, node);
    return model;
  }

  private modifyClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { classId, className } = modification.target;
    const node = (classId ? ModifierHelpers.findNodeById(model, classId) : undefined) ||
                 this.findClassNode(model, className!);

    if (!node) {
      throw new Error(`Class '${className || classId}' not found in the model.`);
    }

    const data = node.data as any;
    const changes = modification.changes as any;

    if (changes.name) data.name = changes.name;

    if (changes.visibility) data.visibility = changes.visibility;

    if (typeof changes.isAbstract === 'boolean') {
      data.italic = changes.isAbstract;
      if (changes.isAbstract) {
        data.stereotype = 'abstract';
        (node as any).type = 'AbstractClass';
      } else {
        delete data.stereotype;
        (node as any).type = 'Class';
      }
    }
    if (typeof changes.isEnumeration === 'boolean') {
      if (changes.isEnumeration) {
        data.stereotype = 'enumeration';
        (node as any).type = 'Enumeration';
        delete data.italic;
      } else if ((node as any).type === 'Enumeration' || data.stereotype === 'enumeration') {
        delete data.stereotype;
        (node as any).type = 'Class';
      }
    }
    if (typeof changes.isInterface === 'boolean') {
      if (changes.isInterface) {
        data.stereotype = 'interface';
        data.italic = true;
        (node as any).type = 'Interface';
      } else if ((node as any).type === 'Interface' || data.stereotype === 'interface') {
        delete data.stereotype;
        delete data.italic;
        (node as any).type = 'Class';
      }
    }
    if (changes.stereotype !== undefined) {
      data.stereotype = changes.stereotype;
    }

    return model;
  }

  private addAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { className } = modification.target;
    if (!className) {
      throw new Error('add_attribute requires a target className.');
    }

    const node = this.findClassNode(model, className);
    if (!node) {
      throw new Error(`Class '${className}' not found in the model.`);
    }

    const data = node.data as any;
    if (!Array.isArray(data.attributes)) data.attributes = [];

    const name = modification.changes.name || 'newAttribute';
    if ((data.attributes as ClassifierMember[]).some((row) =>
      row.name === name || (row.name || '').toLowerCase() === name.toLowerCase()
    )) {
      console.warn(`[ClassDiagramModifier] addAttribute: '${name}' already exists on '${className}', skipping.`);
      return model;
    }

    const visibility = (modification.changes.visibility as any) || 'public';
    const type = normalizeType(modification.changes.type) || 'str';
    const row: ClassifierMember = {
      id: ModifierHelpers.generateUniqueId('attr'),
      name,
      attributeType: type,
      visibility,
    };
    if ((modification.changes as any).isDerived) row.isDerived = true;
    if ((modification.changes as any).defaultValue !== undefined && (modification.changes as any).defaultValue !== null) {
      row.defaultValue = (modification.changes as any).defaultValue;
    }
    if ((modification.changes as any).isOptional) row.isOptional = true;

    data.attributes.push(row);
    this.recalculateClassHeight(node);

    return model;
  }

  private addMethod(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { className } = modification.target;
    if (!className) {
      throw new Error('add_method requires a target className.');
    }

    const node = this.findClassNode(model, className);
    if (!node) {
      throw new Error(`Class '${className}' not found in the model.`);
    }

    const data = node.data as any;
    if (!Array.isArray(data.methods)) data.methods = [];

    const name = modification.changes.name || 'newMethod';
    const returnType = normalizeType(modification.changes.returnType || 'any');
    const paramStr = modification.changes.parameters?.map(p => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';

    const row: ClassifierMember = {
      id: ModifierHelpers.generateUniqueId('method'),
      name: `${name}(${paramStr})`,
      attributeType: returnType,
      visibility: (modification.changes.visibility as any) || 'public',
    };
    if (modification.changes.code) {
      row.code = modification.changes.code;
      if (!modification.changes.implementationType) {
        row.implementationType = 'code';
      }
    }
    if (modification.changes.implementationType) {
      row.implementationType = modification.changes.implementationType;
    }

    data.methods.push(row);
    this.recalculateClassHeight(node);

    return model;
  }

  private modifyAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { attributeId, attributeName, className } = modification.target;
    if (!className) {
      console.warn('[ClassDiagramModifier] modifyAttribute: missing className');
      return model;
    }
    const node = this.findClassNode(model, className);
    if (!node) {
      console.warn(`[ClassDiagramModifier] modifyAttribute: class '${className}' not found`);
      return model;
    }

    const data = node.data as any;
    const rows: ClassifierMember[] = Array.isArray(data.attributes) ? data.attributes : [];

    let row: ClassifierMember | undefined;
    if (attributeId) {
      row = rows.find((r) => r.id === attributeId);
    }
    if (!row) {
      const candidates = [
        attributeName,
        modification.changes.previousName,
        modification.changes.name,
      ].filter((v): v is string => Boolean(v));
      for (const cand of candidates) {
        const found = this.findAttributeRow(node, cand);
        if (found) { row = found; break; }
      }
    }

    if (!row) {
      console.warn(
        `[ClassDiagramModifier] modifyAttribute: could not find attribute '${attributeName || attributeId}' in class '${className}'`,
      );
      return model;
    }

    const parsed = this.parseAttributeLabel(row.name || '');

    if (modification.changes.name) row.name = modification.changes.name;
    else if (parsed.name) row.name = parsed.name;

    if (modification.changes.visibility) row.visibility = modification.changes.visibility as any;
    if (modification.changes.type) row.attributeType = normalizeType(modification.changes.type);
    if (typeof (modification.changes as any).isDerived === 'boolean') row.isDerived = (modification.changes as any).isDerived;
    if ((modification.changes as any).defaultValue !== undefined) row.defaultValue = (modification.changes as any).defaultValue;
    if (typeof (modification.changes as any).isOptional === 'boolean') row.isOptional = (modification.changes as any).isOptional;

    return model;
  }

  private modifyMethod(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { methodId, methodName, className } = modification.target;
    if (!className) {
      console.warn('[ClassDiagramModifier] modifyMethod: missing className');
      return model;
    }
    const node = this.findClassNode(model, className);
    if (!node) {
      console.warn(`[ClassDiagramModifier] modifyMethod: class '${className}' not found`);
      return model;
    }

    const data = node.data as any;
    const rows: ClassifierMember[] = Array.isArray(data.methods) ? data.methods : [];

    let row: ClassifierMember | undefined;
    if (methodId) {
      row = rows.find((r) => r.id === methodId);
    }
    if (!row) {
      const candidates = [
        methodName,
        modification.changes.previousName,
        modification.changes.name,
      ].filter((v): v is string => Boolean(v));
      for (const cand of candidates) {
        const found = this.findMethodRow(node, cand);
        if (found) { row = found; break; }
      }
    }

    if (!row) {
      console.warn(
        `[ClassDiagramModifier] modifyMethod: could not find method '${methodName || methodId}' in class '${className}'`,
      );
      return model;
    }

    const parsed = this.parseMethodLabel(row.name || '');
    const visibilitySymbol =
      this.visibilityToSymbol(modification.changes.visibility) || parsed.visibilitySymbol || '+';
    const name = modification.changes.name || parsed.name || this.normalizeMethodName(row.name || '');
    const returnType = normalizeType(modification.changes.returnType || parsed.returnType || 'any');
    const parameters =
      modification.changes.parameters?.map(p => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name) || parsed.parameters;
    const paramStr = parameters.join(', ');

    row.name = `${visibilitySymbol} ${name}(${paramStr}): ${returnType}`;

    if (modification.changes.code) {
      row.code = modification.changes.code;
      if (!modification.changes.implementationType) row.implementationType = 'code';
    }
    if (modification.changes.implementationType) row.implementationType = modification.changes.implementationType;

    return model;
  }

  private addRelationship(model: BESSERModel, modification: ModelModification): BESSERModel {
    const m = model as any;
    if (!Array.isArray(m.edges)) m.edges = [];

    const changes = modification.changes;
    const target = modification.target;

    const sourceClassName = changes.sourceClass || target.sourceClass || target.className;
    const targetClassName = changes.targetClass || target.targetClass;

    if (!sourceClassName || !targetClassName) {
      throw new Error('Relationship modifications require both source and target class names.');
    }

    let sourceNode = this.findClassNode(model, sourceClassName);
    let targetNode = this.findClassNode(model, targetClassName);

    if (!sourceNode) {
      sourceNode = this.createMinimalClassNode(model, sourceClassName, targetNode);
    }
    if (!targetNode) {
      targetNode = this.createMinimalClassNode(model, targetClassName, sourceNode);
    }

    const relationshipId = ModifierHelpers.generateUniqueId('rel');
    const relType = changes.relationshipType || (changes as any).type || 'Association';
    const relationshipType = this.mapRelationshipType(relType);
    const sourceMultiplicity = changes.sourceMultiplicity || '1';
    const targetMultiplicity = changes.targetMultiplicity || '*';
    const relationshipName = changes.name || changes.roleName || target.relationshipName || '';

    const edge: BesserEdge = {
      id: relationshipId,
      source: sourceNode!.id,
      target: targetNode!.id,
      type: relationshipType as any,
      sourceHandle: 'Left',
      targetHandle: 'Right',
      data: {
        name: relationshipName,
        sourceMultiplicity,
        targetMultiplicity,
        sourceRole: '',
        targetRole: relationshipName,
        isManuallyLayouted: false,
        points: [
          { x: 100, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    };

    m.edges.push(edge);
    return model;
  }

  private modifyRelationship(model: BESSERModel, modification: ModelModification): BESSERModel {
    const edges = ModifierHelpers.edges(model);
    if (edges.length === 0) {
      throw new Error('No relationships exist in the model to modify.');
    }

    const changes = modification.changes;
    const target = modification.target;

    let matchedEdge: BesserEdge | undefined;

    if (target.relationshipId) {
      matchedEdge = edges.find((e) => e.id === target.relationshipId);
    }
    if (!matchedEdge && target.relationshipName) {
      const normalized = target.relationshipName.trim().toLowerCase();
      matchedEdge = edges.find((e) => {
        const name = (e.data as any)?.name;
        return typeof name === 'string' && name.trim().toLowerCase() === normalized;
      });
    }
    if (!matchedEdge) {
      const sourceClassName = changes.sourceClass || target.sourceClass || target.className;
      const targetClassName = changes.targetClass || target.targetClass;
      if (sourceClassName && targetClassName) {
        const src = this.findClassNode(model, sourceClassName);
        const tgt = this.findClassNode(model, targetClassName);
        if (src && tgt) {
          matchedEdge = edges.find((e) =>
            (e.source === src.id && e.target === tgt.id) || (e.source === tgt.id && e.target === src.id),
          );
        }
      }
    }

    if (!matchedEdge) {
      throw new Error(
        'Could not find the relationship to modify. Provide relationshipId, relationshipName, or sourceClass + targetClass.',
      );
    }

    if (changes.relationshipType || (changes as any).type) {
      matchedEdge.type = this.mapRelationshipType(changes.relationshipType || (changes as any).type) as any;
    }
    const data = matchedEdge.data as any;
    if (changes.sourceMultiplicity !== undefined) data.sourceMultiplicity = changes.sourceMultiplicity;
    if (changes.targetMultiplicity !== undefined) data.targetMultiplicity = changes.targetMultiplicity;
    if (changes.name !== undefined) data.name = changes.name;
    if (changes.roleName !== undefined) data.targetRole = changes.roleName;

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    const m = model as any;
    let { classId, className, attributeId, attributeName, methodId, methodName, relationshipId, relationshipName } =
      modification.target;

    // Defensive fallback like in v3
    if (!className && !classId && !relationshipId && !relationshipName && !attributeId && !attributeName && !methodId && !methodName) {
      const candidates = Object.values(modification.target || {}).filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      );
      for (const cand of candidates) {
        if (this.findClassNode(model, cand)) { className = cand; break; }
      }
      if (!className && modification.changes) {
        const changeCandidates = Object.values(modification.changes).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0,
        );
        for (const cand of changeCandidates) {
          if (this.findClassNode(model, cand)) { className = cand; break; }
        }
      }
    }

    // Remove relationship
    if (relationshipId || relationshipName) {
      m.edges = (m.edges ?? []).filter((e: BesserEdge) => {
        if (relationshipId && e.id === relationshipId) return false;
        if (relationshipName && (e.data as any)?.name === relationshipName) return false;
        return true;
      });
      return model;
    }

    // Remove attribute (row on class node)
    if ((attributeId || attributeName) && className) {
      const node = (classId && ModifierHelpers.findNodeById(model, classId)) || this.findClassNode(model, className);
      if (node) {
        const data = node.data as any;
        const rows: ClassifierMember[] = Array.isArray(data.attributes) ? data.attributes : [];
        const targetName = attributeName || modification.changes.name || '';
        data.attributes = rows.filter((row) => {
          if (attributeId && row.id === attributeId) return false;
          if (targetName && this.normalizeAttributeName(row.name || '').toLowerCase() === this.normalizeAttributeName(targetName).toLowerCase()) return false;
          return true;
        });
      }
      return model;
    }

    // Remove method (row on class node)
    if ((methodId || methodName) && className) {
      const node = (classId && ModifierHelpers.findNodeById(model, classId)) || this.findClassNode(model, className);
      if (node) {
        const data = node.data as any;
        const rows: ClassifierMember[] = Array.isArray(data.methods) ? data.methods : [];
        const targetName = methodName || modification.changes.name || '';
        data.methods = rows.filter((row) => {
          if (methodId && row.id === methodId) return false;
          if (targetName && this.normalizeMethodName(row.name || '').toLowerCase() === this.normalizeMethodName(targetName).toLowerCase()) return false;
          return true;
        });
      }
      return model;
    }

    // Remove entire class
    const targetNode = (classId ? ModifierHelpers.findNodeById(model, classId) : undefined) ||
                       (className ? this.findClassNode(model, className) : undefined);
    if (targetNode) {
      return ModifierHelpers.removeNodeWithChildren(model, targetNode.id);
    }

    console.warn(
      `[ClassDiagramModifier] removeElement: class '${className || classId}' not found — ` +
      `treating as already removed (no-op).`,
    );
    return model;
  }

  private addOclConstraint(model: BESSERModel, modification: ModelModification): BESSERModel {
    const constraintText = (modification.changes?.constraint || '').trim();
    if (!constraintText) {
      throw new Error('add_ocl_constraint requires a "constraint" string in changes (full BOCL block: "context X (inv|pre|post) [name]: body").');
    }
    const className = modification.target?.className;
    if (!className) {
      throw new Error('add_ocl_constraint requires target.className (the class the constraint anchors on).');
    }
    const classNode = this.findClassNode(model, className);
    if (!classNode) {
      throw new Error(`add_ocl_constraint: class '${className}' not found in the model.`);
    }

    // Per the v4 spec, OCL constraints collapse into the parent class as
    // `data.oclConstraints` rows. This is the canonical form.
    const data = classNode.data as any;
    if (!Array.isArray(data.oclConstraints)) data.oclConstraints = [];
    const constraintId = ModifierHelpers.generateUniqueId('ocl');
    data.oclConstraints.push({
      id: constraintId,
      name: 'OCL',
      expression: constraintText,
      description: (modification.changes?.text || '').trim() || '',
    });
    return model;
  }

  // ─── Refactoring action handlers ───────────────────────────────────────────

  private extractClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const newClassName = modification.newClass;
    const attributeNames = modification.attributes || [];
    const relType = modification.relationshipType || 'ClassComposition';

    if (!sourceClassName) throw new Error('extract_class requires a "sourceClass" field.');
    if (!newClassName) throw new Error('extract_class requires a "newClass" field.');
    if (attributeNames.length === 0) throw new Error('extract_class requires a non-empty "attributes" array.');

    const sourceNode = this.findClassNode(model, sourceClassName);
    if (!sourceNode) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourceData = sourceNode.data as any;
    const sourceRows: ClassifierMember[] = Array.isArray(sourceData.attributes) ? sourceData.attributes : [];

    const extracted: ClassifierMember[] = [];
    const remaining: ClassifierMember[] = [];
    for (const row of sourceRows) {
      const normalized = this.normalizeAttributeName(row.name || '');
      if (attributeNames.some((n) => n.toLowerCase() === normalized.toLowerCase())) {
        extracted.push(row);
      } else {
        remaining.push(row);
      }
    }
    sourceData.attributes = remaining;
    this.recalculateClassHeight(sourceNode);

    const newClassId = ModifierHelpers.generateUniqueId('class');
    const newNode = this.buildClassNode({
      id: newClassId,
      name: newClassName,
      x: sourceNode.position.x + (sourceNode.width || 220) + 400,
      y: sourceNode.position.y,
    });
    (newNode.data as any).attributes = extracted.map((r) => ({ ...r, id: ModifierHelpers.generateUniqueId('attr') }));
    this.recalculateClassHeight(newNode);
    ModifierHelpers.addNode(model, newNode);

    this.createRelationshipEdge(model, sourceNode.id, newClassId, relType);
    return model;
  }

  private splitClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const newClassSpecs = modification.newClasses || [];
    const inheritFrom = modification.inheritFrom;

    if (!sourceClassName) throw new Error('split_class requires a "sourceClass" field.');
    if (newClassSpecs.length === 0) throw new Error('split_class requires a non-empty "newClasses" array.');

    const sourceNode = this.findClassNode(model, sourceClassName);
    if (!sourceNode) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourcePos = sourceNode.position;
    const sourceWidth = sourceNode.width || 220;

    // Collect existing edges involving the source class (for reconnection)
    const existingEdges: Array<{ edge: BesserEdge; direction: 'source' | 'target' }> = [];
    for (const edge of ModifierHelpers.edges(model)) {
      if (edge.source === sourceNode.id) existingEdges.push({ edge, direction: 'source' });
      else if (edge.target === sourceNode.id) existingEdges.push({ edge, direction: 'target' });
    }

    const newClassIds: string[] = [];
    for (let ci = 0; ci < newClassSpecs.length; ci++) {
      const spec = newClassSpecs[ci];
      const newClassId = ModifierHelpers.generateUniqueId('class');
      const offsetX = (ci - (newClassSpecs.length - 1) / 2) * 300;
      const newX = sourcePos.x + offsetX;
      const newY = inheritFrom ? sourcePos.y + 250 : sourcePos.y;

      const node = this.buildClassNode({ id: newClassId, name: spec.name, x: newX, y: newY });

      if (spec.attributes) {
        (node.data as any).attributes = spec.attributes.map((a) => ({
          id: ModifierHelpers.generateUniqueId('attr'),
          name: a.name,
          attributeType: normalizeType(a.type),
          visibility: (a.visibility as any) || 'public',
        }));
      }
      if (spec.methods) {
        (node.data as any).methods = spec.methods.map((m) => {
          const paramStr = m.parameters?.map((p: any) => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
          return {
            id: ModifierHelpers.generateUniqueId('method'),
            name: `${m.name}(${paramStr})`,
            attributeType: normalizeType(m.returnType || 'any'),
            visibility: 'public',
          };
        });
      }
      this.recalculateClassHeight(node);
      ModifierHelpers.addNode(model, node);
      newClassIds.push(newClassId);
    }

    if (inheritFrom) {
      for (const newClassId of newClassIds) {
        this.createRelationshipEdge(model, newClassId, sourceNode.id, 'ClassInheritance');
      }
    } else {
      // Reconnect existing edges to the first new class, then drop the source
      for (const { edge, direction } of existingEdges) {
        if (direction === 'source') edge.source = newClassIds[0];
        else edge.target = newClassIds[0];
      }
      const m = model as any;
      m.nodes = (m.nodes ?? []).filter((n: BesserNode) => n.id !== sourceNode.id);
      // edges that referenced the source were already redirected; no need to filter
    }

    return model;
  }

  private mergeClasses(model: BESSERModel, modification: ModelModification): BESSERModel {
    const classNames = modification.classes || [];
    const targetName = modification.targetName;

    if (classNames.length < 2) throw new Error('merge_classes requires at least two class names in "classes".');
    if (!targetName) throw new Error('merge_classes requires a "targetName" field.');

    const nodes: BesserNode[] = [];
    for (const name of classNames) {
      const n = this.findClassNode(model, name);
      if (!n) throw new Error(`Class '${name}' not found in the model.`);
      nodes.push(n);
    }

    let sumX = 0, sumY = 0;
    for (const n of nodes) {
      sumX += n.position.x;
      sumY += n.position.y;
    }
    const mergedX = Math.round(sumX / nodes.length);
    const mergedY = Math.round(sumY / nodes.length);

    const seenAttrs = new Set<string>();
    const collectedAttrs: ClassifierMember[] = [];
    const seenMethods = new Set<string>();
    const collectedMethods: ClassifierMember[] = [];
    for (const n of nodes) {
      const data: any = n.data || {};
      const attrs: ClassifierMember[] = Array.isArray(data.attributes) ? data.attributes : [];
      for (const a of attrs) {
        const key = this.normalizeAttributeName(a.name || '').toLowerCase();
        if (!seenAttrs.has(key)) {
          seenAttrs.add(key);
          collectedAttrs.push({ ...a, id: ModifierHelpers.generateUniqueId('attr') });
        }
      }
      const methods: ClassifierMember[] = Array.isArray(data.methods) ? data.methods : [];
      for (const meth of methods) {
        const key = this.normalizeMethodName(meth.name || '').toLowerCase();
        if (!seenMethods.has(key)) {
          seenMethods.add(key);
          collectedMethods.push({ ...meth, id: ModifierHelpers.generateUniqueId('method') });
        }
      }
    }

    const mergedClassIds = new Set(nodes.map((n) => n.id));
    const affectedEdges: BesserEdge[] = [];
    for (const edge of ModifierHelpers.edges(model)) {
      if (mergedClassIds.has(edge.source) && mergedClassIds.has(edge.target)) continue;
      if (mergedClassIds.has(edge.source) || mergedClassIds.has(edge.target)) affectedEdges.push(edge);
    }

    // Drop merged class nodes and their incident edges (between merged peers)
    const m = model as any;
    m.nodes = (m.nodes ?? []).filter((n: BesserNode) => !mergedClassIds.has(n.id));
    m.edges = (m.edges ?? []).filter((e: BesserEdge) => {
      if (mergedClassIds.has(e.source) && mergedClassIds.has(e.target)) return false;
      return true;
    });

    const mergedClassId = ModifierHelpers.generateUniqueId('class');
    const node = this.buildClassNode({ id: mergedClassId, name: targetName, x: mergedX, y: mergedY });
    (node.data as any).attributes = collectedAttrs;
    (node.data as any).methods = collectedMethods;
    this.recalculateClassHeight(node);
    ModifierHelpers.addNode(model, node);

    // Reconnect affected edges to the merged class
    for (const edge of affectedEdges) {
      if (mergedClassIds.has(edge.source)) edge.source = mergedClassId;
      if (mergedClassIds.has(edge.target)) edge.target = mergedClassId;
    }

    return model;
  }

  private promoteAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const attributeName = modification.attribute;
    const newClassName = modification.newClass;
    const newAttributes = modification.newAttributes || [];

    if (!sourceClassName) throw new Error('promote_attribute requires a "sourceClass" field.');
    if (!attributeName) throw new Error('promote_attribute requires an "attribute" field.');
    if (!newClassName) throw new Error('promote_attribute requires a "newClass" field.');

    const sourceNode = this.findClassNode(model, sourceClassName);
    if (!sourceNode) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourceData = sourceNode.data as any;
    const sourceAttrs: ClassifierMember[] = Array.isArray(sourceData.attributes) ? sourceData.attributes : [];
    const normalizedTarget = this.normalizeAttributeName(attributeName).toLowerCase();
    sourceData.attributes = sourceAttrs.filter((a) =>
      this.normalizeAttributeName(a.name || '').toLowerCase() !== normalizedTarget,
    );
    this.recalculateClassHeight(sourceNode);

    const newClassId = ModifierHelpers.generateUniqueId('class');
    const newClassNode = this.buildClassNode({
      id: newClassId,
      name: newClassName,
      x: sourceNode.position.x + (sourceNode.width || 220) + 400,
      y: sourceNode.position.y,
    });
    (newClassNode.data as any).attributes = newAttributes.map((a) => ({
      id: ModifierHelpers.generateUniqueId('attr'),
      name: a.name,
      attributeType: normalizeType(a.type),
      visibility: (a.visibility as any) || 'public',
    }));
    this.recalculateClassHeight(newClassNode);
    ModifierHelpers.addNode(model, newClassNode);

    this.createRelationshipEdge(model, sourceNode.id, newClassId, 'ClassComposition');
    return model;
  }

  private addEnum(model: BESSERModel, modification: ModelModification): BESSERModel {
    const enumName = modification.enumName;
    const values = modification.values || [];
    const usedBy = modification.usedBy || [];

    if (!enumName) throw new Error('add_enum requires an "enumName" field.');
    if (values.length === 0) throw new Error('add_enum requires a non-empty "values" array.');

    let posX = 0, posY = 0;
    if (usedBy.length > 0) {
      let count = 0;
      for (const usage of usedBy) {
        const node = this.findClassNode(model, usage.className);
        if (node) {
          posX += node.position.x;
          posY += node.position.y;
          count++;
        }
      }
      if (count > 0) {
        posX = Math.round(posX / count) + 400;
        posY = Math.round(posY / count) - 100;
      }
    } else {
      const next = this.nextClassPosition(model);
      posX = next.x;
      posY = next.y;
    }

    const enumId = ModifierHelpers.generateUniqueId('enum');
    const node = this.buildClassNode({ id: enumId, name: enumName, stereotype: 'enumeration', x: posX, y: posY });
    (node.data as any).attributes = values.map((v) => ({
      id: ModifierHelpers.generateUniqueId('literal'),
      name: v,
      attributeType: 'str',
      visibility: 'public',
    }));
    (node as any).type = 'Enumeration';
    this.recalculateClassHeight(node);
    ModifierHelpers.addNode(model, node);

    // Update attribute types in classes that reference this enum
    for (const usage of usedBy) {
      const refNode = this.findClassNode(model, usage.className);
      if (!refNode) continue;
      const data = refNode.data as any;
      const rows: ClassifierMember[] = Array.isArray(data.attributes) ? data.attributes : [];
      for (const row of rows) {
        if (this.normalizeAttributeName(row.name || '').toLowerCase() === usage.attributeName.toLowerCase()) {
          row.attributeType = enumName;
        }
      }
    }
    return model;
  }

  // ─── Shared helpers ──────────────────────────────────────────────────────

  private createMinimalClassNode(
    model: BESSERModel,
    className: string,
    neighbour?: BesserNode,
  ): BesserNode {
    let x = 0, y = 0;
    if (neighbour) {
      x = neighbour.position.x + (neighbour.width || 250) + 80;
      y = neighbour.position.y;
    } else {
      const next = this.nextClassPosition(model);
      x = next.x; y = next.y;
    }
    const node = this.buildClassNode({ id: ModifierHelpers.generateUniqueId('class'), name: className, x, y });
    ModifierHelpers.addNode(model, node);
    return node;
  }

  private createRelationshipEdge(
    model: BESSERModel,
    sourceId: string,
    targetId: string,
    relationshipType: string,
    name: string = '',
  ): string {
    const edgeId = ModifierHelpers.generateUniqueId('rel');
    const edge: BesserEdge = {
      id: edgeId,
      source: sourceId,
      target: targetId,
      type: relationshipType as any,
      sourceHandle: 'Left',
      targetHandle: 'Right',
      data: {
        name,
        sourceMultiplicity: '1',
        targetMultiplicity: '*',
        sourceRole: '',
        targetRole: name,
        isManuallyLayouted: false,
        points: [
          { x: 100, y: 10 },
          { x: 0, y: 10 },
        ],
      },
    };
    ModifierHelpers.addEdge(model, edge);
    return edgeId;
  }

  private normalizeAttributeName(label: string): string {
    if (!label) return '';
    return label.replace(/^([+#-])\s*/, '').split(':')[0].trim();
  }

  private normalizeMethodName(label: string): string {
    if (!label) return '';
    return label.replace(/^([+#-])\s*/, '').split('(')[0].trim();
  }

  private parseAttributeLabel(label: string) {
    const trimmed = label || '';
    const visibilitySymbol = trimmed.trim().startsWith('+') ? '+' :
      trimmed.trim().startsWith('-') ? '-' :
      trimmed.trim().startsWith('#') ? '#' : '+';
    const withoutVisibility = trimmed.replace(/^([+#-])\s*/, '');
    const [namePart, typePart] = withoutVisibility.split(':').map(part => part?.trim() || '');
    return { visibilitySymbol, name: namePart || '', type: typePart || '' };
  }

  private parseMethodLabel(label: string) {
    const trimmed = label || '';
    const visibilitySymbol = trimmed.trim().startsWith('+') ? '+' :
      trimmed.trim().startsWith('-') ? '-' :
      trimmed.trim().startsWith('#') ? '#' : '+';
    const withoutVisibility = trimmed.replace(/^([+#-])\s*/, '');
    const [signature, returnTypePart] = withoutVisibility.split(':').map(part => part?.trim() || '');
    const [namePart, paramsPart] = signature.split('(');
    const params = paramsPart?.replace(')', '').trim() || '';
    const parameterList = params ? params.split(',').map(p => p.trim()).filter(Boolean) : [];
    return {
      visibilitySymbol,
      name: namePart?.trim() || '',
      returnType: returnTypePart || '',
      parameters: parameterList,
    };
  }

  private visibilityToSymbol(visibility?: 'public' | 'private' | 'protected'): string {
    switch (visibility) {
      case 'public': return '+';
      case 'private': return '-';
      case 'protected': return '#';
      default: return '';
    }
  }

  private mapRelationshipType(type: string): string {
    switch ((type || '').toLowerCase()) {
      case 'inheritance':
      case 'generalization': return 'ClassInheritance';
      case 'composition': return 'ClassComposition';
      case 'aggregation': return 'ClassAggregation';
      case 'dependency': return 'ClassDependency';
      case 'unidirectional': return 'ClassUnidirectional';
      default: return 'ClassBidirectional';
    }
  }
}
