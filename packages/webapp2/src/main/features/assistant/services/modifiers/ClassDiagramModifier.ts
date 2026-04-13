/**
 * Class Diagram Modifier
 * Handles all modification operations for Class Diagrams
 */

import { DiagramModifier, ModelModification, ModifierHelpers } from './base';
import { BESSERModel } from '../UMLModelingService';
import { normalizeType } from '../shared/typeNormalization';

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
      'add_enum'
    ].includes(action);
  }

  applyModification(model: BESSERModel, modification: ModelModification): BESSERModel {
    // Validate required fields before proceeding
    if (!modification.action) {
      throw new Error('Modification is missing required "action" field');
    }

    // Refactoring actions use top-level fields instead of target/changes
    const refactoringActions = ['extract_class', 'split_class', 'merge_classes', 'promote_attribute', 'add_enum'];
    const isRefactoring = refactoringActions.includes(modification.action);

    if (!isRefactoring) {
      if (!modification.target || typeof modification.target !== 'object') {
        throw new Error(`Modification "${modification.action}" is missing required "target" object`);
      }
      // changes is required for all actions except remove_element.
      // For modify_relationship without changes, skip silently (no-op from cascading renames).
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
      case 'add_class':
        return this.addClass(updatedModel, modification);
      case 'modify_class':
        return this.modifyClass(updatedModel, modification);
      case 'add_attribute':
        return this.addAttribute(updatedModel, modification);
      case 'modify_attribute':
        return this.modifyAttribute(updatedModel, modification);
      case 'add_method':
        return this.addMethod(updatedModel, modification);
      case 'modify_method':
        return this.modifyMethod(updatedModel, modification);
      case 'add_relationship':
        return this.addRelationship(updatedModel, modification);
      case 'modify_relationship':
        return this.modifyRelationship(updatedModel, modification);
      case 'remove_element':
        return this.removeElement(updatedModel, modification);
      case 'extract_class':
        return this.extractClass(updatedModel, modification);
      case 'split_class':
        return this.splitClass(updatedModel, modification);
      case 'merge_classes':
        return this.mergeClasses(updatedModel, modification);
      case 'promote_attribute':
        return this.promoteAttribute(updatedModel, modification);
      case 'add_enum':
        return this.addEnum(updatedModel, modification);
      default:
        throw new Error(`Unsupported action for ClassDiagram: ${modification.action}`);
    }
  }

  private addClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const className = modification.changes?.className || modification.target?.className;
    if (!className) {
      throw new Error('add_class requires a className in target or changes.');
    }

    // Check if class already exists
    const existingId = this.findClassIdByName(model, className);
    if (existingId) {
      console.warn(`[ClassDiagramModifier] addClass: class '${className}' already exists, skipping.`);
      return model;
    }

    // Find position: to the right of the rightmost existing class
    let posX = 0;
    let posY = 0;
    for (const el of Object.values(model.elements)) {
      if (el.type === 'Class' || el.type === 'AbstractClass' || el.type === 'Interface' || el.type === 'Enumeration') {
        const right = (el.bounds?.x ?? 0) + (el.bounds?.width ?? 220);
        if (right + 80 > posX) {
          posX = right + 80;
          posY = el.bounds?.y ?? 0;
        }
      }
    }

    const classId = ModifierHelpers.generateUniqueId('class');
    model.elements[classId] = {
      id: classId,
      name: className,
      type: 'Class',
      owner: null,
      bounds: { x: posX, y: posY, width: 220, height: 90 },
      attributes: [],
      methods: [],
    };

    // Handle abstract class
    const classIsAbstract = modification.changes?.isAbstract ??
      (modification as any).isAbstract;
    if (classIsAbstract) {
      model.elements[classId].type = 'AbstractClass';
      model.elements[classId].italic = true;
      model.elements[classId].stereotype = 'abstract';
    }

    // Handle enumeration
    const classIsEnumeration = modification.changes?.isEnumeration ??
      (modification as any).isEnumeration;
    if (classIsEnumeration) {
      model.elements[classId].type = 'Enumeration';
      model.elements[classId].stereotype = 'enumeration';
    }

    // Handle interface
    const classIsInterface = modification.changes?.isInterface ??
      (modification as any).isInterface;
    if (classIsInterface) {
      model.elements[classId].type = 'Interface';
      model.elements[classId].italic = true;
      model.elements[classId].stereotype = 'interface';
    }

    // Collect all class names for type resolution
    const classNames = new Set<string>();
    for (const el of Object.values(model.elements)) {
      if (el.type === 'Class' || el.type === 'AbstractClass' || el.type === 'Interface' || el.type === 'Enumeration') classNames.add(el.name);
    }
    classNames.add(className);

    // Add attributes from changes
    const attributes = modification.changes?.attributes || [];
    for (let i = 0; i < attributes.length; i++) {
      const attrSpec = attributes[i];
      const attrId = ModifierHelpers.generateUniqueId('attr');
      const attrY = posY + 50 + i * 25;
      const visibility = attrSpec.visibility || 'public';
      const visSymbol = visibility === 'private' ? '-' : visibility === 'protected' ? '#' : '+';
      const type = normalizeType(attrSpec.type, classNames);

      const attrElement: any = {
        id: attrId,
        name: attrSpec.name,
        type: 'ClassAttribute',
        owner: classId,
        bounds: { x: posX + 1, y: attrY, width: 218, height: 25 },
        visibility: visibility,
        attributeType: type,
      };

      if (attrSpec.isDerived) {
        attrElement.isDerived = true;
      }
      if (attrSpec.defaultValue !== undefined && attrSpec.defaultValue !== null) {
        attrElement.defaultValue = attrSpec.defaultValue;
      }
      if (attrSpec.isOptional) {
        attrElement.isOptional = true;
      }

      model.elements[attrId] = attrElement;
      model.elements[classId].attributes.push(attrId);
    }

    // Add methods from changes
    const methods = modification.changes?.methods || [];
    const attrCount = attributes.length;
    for (let i = 0; i < methods.length; i++) {
      const methodSpec = methods[i];
      const methodId = ModifierHelpers.generateUniqueId('method');
      const methodY = posY + 50 + attrCount * 25 + 10 + i * 25;
      const visSymbol = methodSpec.visibility === 'private' ? '-' : methodSpec.visibility === 'protected' ? '#' : '+';
      const paramStr = methodSpec.parameters?.map((p: any) => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
      const returnType = normalizeType(methodSpec.returnType || 'any');

      model.elements[methodId] = {
        id: methodId,
        name: `${methodSpec.name}(${paramStr})`,
        type: 'ClassMethod',
        owner: classId,
        bounds: { x: posX + 1, y: methodY, width: 218, height: 25 },
        visibility: methodSpec.visibility || 'public',
        attributeType: returnType,
      };
      model.elements[classId].methods.push(methodId);
    }

    this.recalculateClassHeight(model.elements[classId]);

    return model;
  }

  private modifyClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { classId, className } = modification.target;
    const targetId = classId || this.findClassIdByName(model, className!);

    if (!targetId || !model.elements[targetId]) {
      throw new Error(`Class '${className || classId}' not found in the model.`);
    }

    const element = model.elements[targetId];

    if (modification.changes.name) {
      element.name = modification.changes.name;
    }

    // Support additional class-level properties the LLM may send
    if (modification.changes.visibility) {
      element.visibility = modification.changes.visibility;
    }
    if (typeof (modification.changes as any).isAbstract === 'boolean') {
      const isAbstract = (modification.changes as any).isAbstract;
      element.italic = isAbstract;
      if (isAbstract) {
        element.type = 'AbstractClass';
        element.stereotype = 'abstract';
      } else {
        element.type = 'Class';
        delete element.stereotype;
      }
    }
    if (typeof (modification.changes as any).isEnumeration === 'boolean') {
      const isEnumeration = (modification.changes as any).isEnumeration;
      if (isEnumeration) {
        element.type = 'Enumeration';
        element.stereotype = 'enumeration';
        delete element.italic;
      } else if (element.type === 'Enumeration') {
        element.type = 'Class';
        delete element.stereotype;
      }
    }
    if (typeof (modification.changes as any).isInterface === 'boolean') {
      const isInterface = (modification.changes as any).isInterface;
      if (isInterface) {
        element.type = 'Interface';
        element.italic = true;
        element.stereotype = 'interface';
      } else if (element.type === 'Interface') {
        element.type = 'Class';
        delete element.stereotype;
        delete element.italic;
      }
    }
    if ((modification.changes as any).stereotype !== undefined) {
      element.stereotype = (modification.changes as any).stereotype;
    }

    return model;
  }

  private addAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { className } = modification.target;
    if (!className) {
      throw new Error('add_attribute requires a target className.');
    }

    const classId = this.findClassIdByName(model, className);
    if (!classId || !model.elements[classId]) {
      throw new Error(`Class '${className}' not found in the model.`);
    }

    const classElement = model.elements[classId];
    if (!classElement.attributes) {
      classElement.attributes = [];
    }

    const name = modification.changes.name || 'newAttribute';

    // Skip if attribute with the same name already exists on this class
    const existingAttr = classElement.attributes.some((attrId: string) => {
      const attr = model.elements[attrId];
      return attr && (attr.name === name || attr.name?.toLowerCase() === name.toLowerCase());
    });
    if (existingAttr) {
      console.warn(`[ClassDiagramModifier] addAttribute: '${name}' already exists on '${className}', skipping.`);
      return model;
    }

    const attrId = ModifierHelpers.generateUniqueId('attr');
    const visibility = modification.changes.visibility || 'public';
    const type = normalizeType(modification.changes.type) || 'str';

    // Compute bounds: place below last existing attribute
    const classBounds = classElement.bounds || { x: 0, y: 0, width: 220, height: 90 };
    const existingAttrCount = classElement.attributes.length;
    const attrY = classBounds.y + 50 + existingAttrCount * 25; // header(50) + rows

    const attrElement: any = {
      id: attrId,
      name: name,
      type: 'ClassAttribute',
      owner: classId,
      bounds: { x: classBounds.x + 1, y: attrY, width: (classBounds.width || 220) - 2, height: 25 },
      visibility: visibility,
      attributeType: type,
    };

    if (modification.changes.isDerived) {
      attrElement.isDerived = true;
    }
    if (modification.changes.defaultValue !== undefined && modification.changes.defaultValue !== null) {
      attrElement.defaultValue = modification.changes.defaultValue;
    }
    if (modification.changes.isOptional) {
      attrElement.isOptional = true;
    }

    model.elements[attrId] = attrElement;

    classElement.attributes.push(attrId);

    // Expand class height to fit the new attribute
    if (classBounds.height) {
      classBounds.height = Math.max(classBounds.height, 50 + (existingAttrCount + 1) * 25 + 15);
    }

    return model;
  }

  private addMethod(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { className } = modification.target;
    if (!className) {
      throw new Error('add_method requires a target className.');
    }

    const classId = this.findClassIdByName(model, className);
    if (!classId || !model.elements[classId]) {
      throw new Error(`Class '${className}' not found in the model.`);
    }

    const classElement = model.elements[classId];
    if (!classElement.methods) {
      classElement.methods = [];
    }

    const methodId = ModifierHelpers.generateUniqueId('method');
    const visibilitySymbol = modification.changes.visibility === 'private' ? '-' :
                              modification.changes.visibility === 'protected' ? '#' : '+';
    const name = modification.changes.name || 'newMethod';
    const returnType = normalizeType(modification.changes.returnType || 'any');
    const paramStr = modification.changes.parameters?.map(p => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
    const classBounds = classElement.bounds || { x: 0, y: 0, width: 220, height: 90 };
    const existingAttrCount = (classElement.attributes || []).length;
    const existingMethodCount = classElement.methods.length;
    const methodY = classBounds.y + 50 + existingAttrCount * 25 + 10 + existingMethodCount * 25;

    const methodElement: any = {
      id: methodId,
      name: `${name}(${paramStr})`,
      type: 'ClassMethod',
      owner: classId,
      bounds: { x: classBounds.x + 1, y: methodY, width: (classBounds.width || 220) - 2, height: 25 },
      visibility: modification.changes.visibility || 'public',
      attributeType: returnType,
    };

    if (modification.changes.code) {
      methodElement.code = modification.changes.code;
      if (!modification.changes.implementationType) {
        methodElement.implementationType = 'code';
      }
    }

    if (modification.changes.implementationType) {
      methodElement.implementationType = modification.changes.implementationType;
    }

    model.elements[methodId] = methodElement;

    classElement.methods.push(methodId);

    // Expand class height
    if (classBounds.height) {
      const totalRows = existingAttrCount + existingMethodCount + 1;
      classBounds.height = Math.max(classBounds.height, 50 + totalRows * 25 + 25);
    }

    return model;
  }

  private modifyAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { attributeId, attributeName, className } = modification.target;
    let targetId = attributeId;

    if (!targetId && className) {
      const candidates = [
        attributeName,
        modification.changes.previousName,
        modification.target.attributeName,
        modification.changes.name
      ].filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const foundId = this.findAttributeIdByClassAndName(model, className, candidate);
        if (foundId) {
          targetId = foundId;
          break;
        }
      }
    }

    if (!targetId && className) {
      const classId = this.findClassIdByName(model, className);
      if (classId) {
        const classElement = model.elements[classId];
        const normalizedTarget = this.normalizeAttributeName(attributeName || modification.changes.name || '');
        const fallbackId = classElement?.attributes?.find((attrId: string) => {
          const attr = model.elements[attrId];
          const normalized = attr?.name ? this.normalizeAttributeName(attr.name) : '';
          return normalizedTarget && normalized.toLowerCase() === normalizedTarget.toLowerCase();
        });
        if (fallbackId) {
          targetId = fallbackId;
        }
      }
    }

    if (targetId && model.elements[targetId]) {
      const element = model.elements[targetId];
      const parsed = this.parseAttributeLabel(element.name || '');

      if (modification.changes.name) {
        element.name = modification.changes.name;
      } else if (parsed.name) {
        element.name = parsed.name;
      }
      if (modification.changes.visibility) {
        element.visibility = modification.changes.visibility;
      }
      if (modification.changes.type) {
        element.attributeType = normalizeType(modification.changes.type);
      }

      if (typeof modification.changes.isDerived === 'boolean') {
        element.isDerived = modification.changes.isDerived;
      }
      if (modification.changes.defaultValue !== undefined) {
        element.defaultValue = modification.changes.defaultValue;
      }
      if (typeof modification.changes.isOptional === 'boolean') {
        element.isOptional = modification.changes.isOptional;
      }
    } else {
      console.warn(
        `[ClassDiagramModifier] modifyAttribute: could not find attribute '${attributeName || attributeId}' in class '${className}'`
      );
    }

    return model;
  }

  private modifyMethod(model: BESSERModel, modification: ModelModification): BESSERModel {
    const { methodId, methodName, className } = modification.target;
    let targetId = methodId;

    if (!targetId && className) {
      const candidates = [
        methodName,
        modification.changes.previousName,
        modification.target.methodName,
        modification.changes.name
      ].filter((value): value is string => Boolean(value));

      for (const candidate of candidates) {
        const foundId = this.findMethodIdByClassAndName(model, className, candidate);
        if (foundId) {
          targetId = foundId;
          break;
        }
      }
    }

    if (!targetId && className) {
      const classId = this.findClassIdByName(model, className);
      if (classId) {
        const classElement = model.elements[classId];
        const normalizedTarget = this.normalizeMethodName(methodName || modification.changes.name || '');
        const fallbackId = classElement?.methods?.find((methodRef: string) => {
          const methodElement = model.elements[methodRef];
          const normalized = methodElement?.name ? this.normalizeMethodName(methodElement.name) : '';
          return normalizedTarget && normalized.toLowerCase() === normalizedTarget.toLowerCase();
        });
        if (fallbackId) {
          targetId = fallbackId;
        }
      }
    }

    if (targetId && model.elements[targetId]) {
      const element = model.elements[targetId];
      const parsed = this.parseMethodLabel(element.name || '');
      const visibilitySymbol =
        this.visibilityToSymbol(modification.changes.visibility) || parsed.visibilitySymbol || '+';
      const name = modification.changes.name || parsed.name || this.normalizeMethodName(element.name || '');
      const returnType = normalizeType(modification.changes.returnType || parsed.returnType || 'any');
      const parameters =
        modification.changes.parameters?.map(p => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name) || parsed.parameters;
      const paramStr = parameters.join(', ');

      element.name = `${visibilitySymbol} ${name}(${paramStr}): ${returnType}`;

      if (modification.changes.code) {
        element.code = modification.changes.code;
        if (!modification.changes.implementationType) {
          element.implementationType = 'code';
        }
      }

      if (modification.changes.implementationType) {
        element.implementationType = modification.changes.implementationType;
      }
    } else {
      console.warn(
        `[ClassDiagramModifier] modifyMethod: could not find method '${methodName || methodId}' in class '${className}'`
      );
    }

    return model;
  }

  private addRelationship(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      model.relationships = {};
    }

    const changes = modification.changes;
    const target = modification.target;

    const sourceClassName = changes.sourceClass || target.sourceClass || target.className;
    const targetClassName = changes.targetClass || target.targetClass;

    if (!sourceClassName || !targetClassName) {
      throw new Error('Relationship modifications require both source and target class names.');
    }

    let sourceClassId = this.findClassIdByName(model, sourceClassName);
    let targetClassId = this.findClassIdByName(model, targetClassName);

    // Auto-create missing classes so "add a class linked to X" works
    if (!sourceClassId) {
      sourceClassId = this.createMinimalClass(model, sourceClassName, targetClassId);
    }
    if (!targetClassId) {
      targetClassId = this.createMinimalClass(model, targetClassName, sourceClassId);
    }

    const relationshipId = ModifierHelpers.generateUniqueId('rel');
    // Accept both 'relationshipType' and 'type' for compatibility with backend
    const relType = changes.relationshipType || (changes as any).type || 'Association';
    const relationshipType = this.mapRelationshipType(relType);
    const sourceMultiplicity = changes.sourceMultiplicity || '1';
    const targetMultiplicity = changes.targetMultiplicity || '*';
    const relationshipName = changes.name || changes.roleName || target.relationshipName || '';

    model.relationships[relationshipId] = {
      id: relationshipId,
      type: relationshipType,
      source: {
        element: sourceClassId,
        direction: 'Left',
        multiplicity: sourceMultiplicity,
        role: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      target: {
        element: targetClassId,
        direction: 'Right',
        multiplicity: targetMultiplicity,
        role: relationshipName,
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      name: relationshipName,
      path: [
        { x: 100, y: 10 },
        { x: 0, y: 10 }
      ],
      isManuallyLayouted: false
    };

    return model;
  }

  /**
   * Modify an existing relationship (multiplicity, type, name/role).
   * Finds the relationship by id, name, or source+target class pair.
   */
  private modifyRelationship(model: BESSERModel, modification: ModelModification): BESSERModel {
    if (!model.relationships) {
      throw new Error('No relationships exist in the model to modify.');
    }

    const changes = modification.changes;
    const target = modification.target;

    // --- Locate the relationship ---
    let matchedRelId: string | null = null;

    // 1. By explicit relationship ID
    if (target.relationshipId && model.relationships[target.relationshipId]) {
      matchedRelId = target.relationshipId;
    }

    // 2. By relationship name
    if (!matchedRelId && target.relationshipName) {
      const normalizedName = target.relationshipName.trim().toLowerCase();
      for (const [relId, rel] of Object.entries(model.relationships)) {
        if ((rel.name || '').trim().toLowerCase() === normalizedName) {
          matchedRelId = relId;
          break;
        }
      }
    }

    // 3. By source + target class names
    if (!matchedRelId) {
      const sourceClassName = changes.sourceClass || target.sourceClass || target.className;
      const targetClassName = changes.targetClass || target.targetClass;

      if (sourceClassName && targetClassName) {
        const sourceClassId = this.findClassIdByName(model, sourceClassName);
        const targetClassId = this.findClassIdByName(model, targetClassName);

        if (sourceClassId && targetClassId) {
          for (const [relId, rel] of Object.entries(model.relationships)) {
            const relSource = rel.source?.element;
            const relTarget = rel.target?.element;
            // Match in either direction
            if (
              (relSource === sourceClassId && relTarget === targetClassId) ||
              (relSource === targetClassId && relTarget === sourceClassId)
            ) {
              matchedRelId = relId;
              break;
            }
          }
        }
      }
    }

    if (!matchedRelId) {
      throw new Error(
        'Could not find the relationship to modify. Provide relationshipId, relationshipName, or sourceClass + targetClass.'
      );
    }

    const rel = model.relationships[matchedRelId];

    // --- Apply changes ---
    if (changes.relationshipType || (changes as any).type) {
      const newType = this.mapRelationshipType(changes.relationshipType || (changes as any).type);
      rel.type = newType;
    }

    if (changes.sourceMultiplicity !== undefined && rel.source) {
      rel.source.multiplicity = changes.sourceMultiplicity;
    }

    if (changes.targetMultiplicity !== undefined && rel.target) {
      rel.target.multiplicity = changes.targetMultiplicity;
    }

    if (changes.name !== undefined) {
      rel.name = changes.name;
    }

    if (changes.roleName !== undefined && rel.target) {
      rel.target.role = changes.roleName;
    }

    return model;
  }

  private removeElement(model: BESSERModel, modification: ModelModification): BESSERModel {
    let { classId, className, attributeId, attributeName, methodId, methodName, relationshipId, relationshipName } =
      modification.target;

    // Defensive fallback: some LLMs misplace the class name into other fields
    // (e.g. target.name, target.element) or leave className undefined even
    // when the action is clearly removing a class. Scan the target object for
    // any string value and try to match it as a class name if we have nothing.
    if (!className && !classId && !relationshipId && !relationshipName && !attributeId && !attributeName && !methodId && !methodName) {
      const candidates = Object.values(modification.target || {}).filter(
        (v): v is string => typeof v === 'string' && v.trim().length > 0
      );
      for (const cand of candidates) {
        if (this.findClassIdByName(model, cand)) {
          className = cand;
          break;
        }
      }
      // Also check modification.changes (some LLMs put the target name there)
      if (!className && modification.changes) {
        const changeCandidates = Object.values(modification.changes).filter(
          (v): v is string => typeof v === 'string' && v.trim().length > 0
        );
        for (const cand of changeCandidates) {
          if (this.findClassIdByName(model, cand)) {
            className = cand;
            break;
          }
        }
      }
    }

    // Remove relationship
    if (relationshipId || relationshipName) {
      if (relationshipId && model.relationships?.[relationshipId]) {
        delete model.relationships[relationshipId];
      } else if (relationshipName && model.relationships) {
        for (const [relId, rel] of Object.entries(model.relationships)) {
          if (rel.name === relationshipName) {
            delete model.relationships[relId];
            break;
          }
        }
      }
      return model;
    }

    // Remove attribute
    if ((attributeId || attributeName) && className) {
      const classElementId = classId || this.findClassIdByName(model, className);
      if (classElementId) {
        const classElement = model.elements[classElementId];
        if (classElement?.attributes) {
          const resolvedAttrId =
            attributeId ||
            this.findAttributeIdByClassAndName(model, className, attributeName || modification.changes.name);
          if (resolvedAttrId) {
            classElement.attributes = classElement.attributes.filter((attr: string) => attr !== resolvedAttrId);
            delete model.elements[resolvedAttrId];
          }
        }
      }
      return model;
    }

    // Remove method
    if ((methodId || methodName) && className) {
      const classElementId = classId || this.findClassIdByName(model, className);
      if (classElementId) {
        const classElement = model.elements[classElementId];
        if (classElement?.methods) {
          const resolvedMethodId =
            methodId ||
            this.findMethodIdByClassAndName(model, className, methodName || modification.changes.name);
          if (resolvedMethodId) {
            classElement.methods = classElement.methods.filter((method: string) => method !== resolvedMethodId);
            delete model.elements[resolvedMethodId];
          }
        }
      }
      return model;
    }

    // Remove entire class
    const targetClassId = classId || this.findClassIdByName(model, className!);
    if (targetClassId) {
      return ModifierHelpers.removeElementWithChildren(model, targetClassId);
    }

    throw new Error(`Cannot remove: class '${className || classId}' not found in the model.`);
  }

  // ─── Refactoring action handlers ───────────────────────────────────────────

  /**
   * Extract attributes from a source class into a new class and create a relationship.
   *
   * Payload shape:
   * { action: "extract_class", sourceClass: "User", newClass: "Address",
   *   attributes: ["street", "city", "zip"], relationshipType: "ClassComposition" }
   */
  private extractClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const newClassName = modification.newClass;
    const attributeNames = modification.attributes || [];
    const relType = modification.relationshipType || 'ClassComposition';

    if (!sourceClassName) throw new Error('extract_class requires a "sourceClass" field.');
    if (!newClassName) throw new Error('extract_class requires a "newClass" field.');
    if (attributeNames.length === 0) throw new Error('extract_class requires a non-empty "attributes" array.');

    const sourceClassId = this.findClassIdByName(model, sourceClassName);
    if (!sourceClassId) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourceElement = model.elements[sourceClassId];
    const sourceBounds = sourceElement.bounds || { x: 0, y: 0, width: 220, height: 90 };

    // Collect matching attributes from the source class
    const extractedAttrs: Array<{ id: string; element: any }> = [];
    const remainingAttrIds: string[] = [];

    for (const attrId of (sourceElement.attributes || [])) {
      const attr = model.elements[attrId];
      if (!attr) { remainingAttrIds.push(attrId); continue; }
      const normalizedName = this.normalizeAttributeName(attr.name || '');
      if (attributeNames.some(name => name.toLowerCase() === normalizedName.toLowerCase())) {
        extractedAttrs.push({ id: attrId, element: attr });
      } else {
        remainingAttrIds.push(attrId);
      }
    }

    // Update source class: remove the extracted attributes
    sourceElement.attributes = remainingAttrIds;
    for (const extracted of extractedAttrs) {
      delete model.elements[extracted.id];
    }
    // Shrink source class height
    this.recalculateClassHeight(sourceElement);

    // Create new class positioned to the right of the source
    const newClassId = ModifierHelpers.generateUniqueId('class');
    const newClassX = sourceBounds.x + (sourceBounds.width || 220) + 400;
    const newClassY = sourceBounds.y;

    model.elements[newClassId] = {
      id: newClassId,
      name: newClassName,
      type: 'Class',
      owner: null,
      bounds: { x: newClassX, y: newClassY, width: 220, height: 90 },
      attributes: [],
      methods: [],
    };

    // Re-create extracted attributes under the new class
    for (let i = 0; i < extractedAttrs.length; i++) {
      const original = extractedAttrs[i].element;
      const attrId = ModifierHelpers.generateUniqueId('attr');
      const attrY = newClassY + 50 + i * 25;
      model.elements[attrId] = {
        id: attrId,
        name: original.name,
        type: 'ClassAttribute',
        owner: newClassId,
        bounds: { x: newClassX + 1, y: attrY, width: 218, height: 25 },
        visibility: original.visibility || 'public',
        attributeType: original.attributeType || 'str',
      };
      model.elements[newClassId].attributes.push(attrId);
    }
    this.recalculateClassHeight(model.elements[newClassId]);

    // Create relationship from source to new class
    this.createRelationship(model, sourceClassId, newClassId, relType);

    return model;
  }

  /**
   * Split a class into two (or more) new classes.
   *
   * Payload shape:
   * { action: "split_class", sourceClass: "User",
   *   newClasses: [{ name: "UserProfile", attributes: [...] }, { name: "UserAuth", attributes: [...] }],
   *   inheritFrom: "User" }
   *
   * If inheritFrom is specified, the source class is kept as a parent with inheritance relationships.
   * Otherwise, the source class is removed and replaced by the new classes.
   */
  private splitClass(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const newClassSpecs = modification.newClasses || [];
    const inheritFrom = modification.inheritFrom;

    if (!sourceClassName) throw new Error('split_class requires a "sourceClass" field.');
    if (newClassSpecs.length === 0) throw new Error('split_class requires a non-empty "newClasses" array.');

    const sourceClassId = this.findClassIdByName(model, sourceClassName);
    if (!sourceClassId) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourceElement = model.elements[sourceClassId];
    const sourceBounds = sourceElement.bounds || { x: 0, y: 0, width: 220, height: 90 };

    // Collect all existing relationships involving the source class (for reconnection if needed)
    const existingRelationships: Array<{ relId: string; rel: any; direction: 'source' | 'target' }> = [];
    if (model.relationships) {
      for (const [relId, rel] of Object.entries(model.relationships)) {
        if (rel.source?.element === sourceClassId) {
          existingRelationships.push({ relId, rel, direction: 'source' });
        } else if (rel.target?.element === sourceClassId) {
          existingRelationships.push({ relId, rel, direction: 'target' });
        }
      }
    }

    // Create new classes
    const newClassIds: string[] = [];
    for (let ci = 0; ci < newClassSpecs.length; ci++) {
      const spec = newClassSpecs[ci];
      const newClassId = ModifierHelpers.generateUniqueId('class');
      const offsetX = (ci - (newClassSpecs.length - 1) / 2) * 300;
      const newX = sourceBounds.x + offsetX;
      const newY = inheritFrom ? sourceBounds.y + 250 : sourceBounds.y;

      model.elements[newClassId] = {
        id: newClassId,
        name: spec.name,
        type: 'Class',
        owner: null,
        bounds: { x: newX, y: newY, width: 220, height: 90 },
        attributes: [],
        methods: [],
      };

      // Add attributes
      if (spec.attributes) {
        for (let ai = 0; ai < spec.attributes.length; ai++) {
          const attrSpec = spec.attributes[ai];
          const attrId = ModifierHelpers.generateUniqueId('attr');
          const attrY = newY + 50 + ai * 25;
          model.elements[attrId] = {
            id: attrId,
            name: attrSpec.name,
            visibility: attrSpec.visibility || 'public',
            attributeType: normalizeType(attrSpec.type),
            type: 'ClassAttribute',
            owner: newClassId,
            bounds: { x: newX + 1, y: attrY, width: 218, height: 25 },
          };
          model.elements[newClassId].attributes.push(attrId);
        }
      }

      // Add methods
      if (spec.methods) {
        for (let mi = 0; mi < spec.methods.length; mi++) {
          const methodSpec = spec.methods[mi];
          const methodId = ModifierHelpers.generateUniqueId('method');
          const attrCount = (spec.attributes || []).length;
          const methodY = newY + 50 + attrCount * 25 + 10 + mi * 25;
          const paramStr = methodSpec.parameters?.map(p => p.type ? `${p.name}: ${normalizeType(p.type)}` : p.name).join(', ') || '';
          const returnType = normalizeType(methodSpec.returnType || 'any');
          model.elements[methodId] = {
            id: methodId,
            name: `${methodSpec.name}(${paramStr})`,
            type: 'ClassMethod',
            owner: newClassId,
            bounds: { x: newX + 1, y: methodY, width: 218, height: 25 },
            visibility: methodSpec.visibility || 'public',
            attributeType: returnType,
          };
          model.elements[newClassId].methods.push(methodId);
        }
      }

      this.recalculateClassHeight(model.elements[newClassId]);
      newClassIds.push(newClassId);
    }

    if (inheritFrom) {
      // Keep source class, create inheritance relationships from new classes to source
      for (const newClassId of newClassIds) {
        this.createRelationship(model, newClassId, sourceClassId, 'ClassInheritance');
      }
    } else {
      // Remove source class and reconnect existing relationships to the first new class
      // (best-effort: attributes mentioned in a new class determine reconnection)
      for (const { relId, rel, direction } of existingRelationships) {
        // Reconnect to the first new class by default
        if (direction === 'source') {
          rel.source.element = newClassIds[0];
        } else {
          rel.target.element = newClassIds[0];
        }
      }
      // Remove the source class and its children
      ModifierHelpers.removeElementWithChildren(model, sourceClassId);
      // Re-add relationships that were removed by removeElementWithChildren
      for (const { relId, rel } of existingRelationships) {
        if (!model.relationships[relId]) {
          model.relationships[relId] = rel;
        }
      }
    }

    return model;
  }

  /**
   * Merge two or more classes into a single class.
   *
   * Payload shape:
   * { action: "merge_classes", classes: ["Address", "Location"], targetName: "Address" }
   */
  private mergeClasses(model: BESSERModel, modification: ModelModification): BESSERModel {
    const classNames = modification.classes || [];
    const targetName = modification.targetName;

    if (classNames.length < 2) throw new Error('merge_classes requires at least two class names in "classes".');
    if (!targetName) throw new Error('merge_classes requires a "targetName" field.');

    // Resolve class IDs
    const classEntries: Array<{ id: string; element: any }> = [];
    for (const name of classNames) {
      const classId = this.findClassIdByName(model, name);
      if (!classId) throw new Error(`Class '${name}' not found in the model.`);
      classEntries.push({ id: classId, element: model.elements[classId] });
    }

    // Compute position: midpoint of all classes being merged
    let sumX = 0, sumY = 0;
    for (const entry of classEntries) {
      const bounds = entry.element.bounds || { x: 0, y: 0 };
      sumX += bounds.x;
      sumY += bounds.y;
    }
    const mergedX = Math.round(sumX / classEntries.length);
    const mergedY = Math.round(sumY / classEntries.length);

    // Collect all attributes and methods (deduplicate attributes by normalized name)
    const seenAttrNames = new Set<string>();
    const collectedAttrs: any[] = [];
    const collectedMethods: any[] = [];
    const seenMethodNames = new Set<string>();

    for (const entry of classEntries) {
      for (const attrId of (entry.element.attributes || [])) {
        const attr = model.elements[attrId];
        if (!attr) continue;
        const normalizedName = this.normalizeAttributeName(attr.name || '').toLowerCase();
        if (!seenAttrNames.has(normalizedName)) {
          seenAttrNames.add(normalizedName);
          collectedAttrs.push({ ...attr });
        }
      }
      for (const methodId of (entry.element.methods || [])) {
        const method = model.elements[methodId];
        if (!method) continue;
        const normalizedName = this.normalizeMethodName(method.name || '').toLowerCase();
        if (!seenMethodNames.has(normalizedName)) {
          seenMethodNames.add(normalizedName);
          collectedMethods.push({ ...method });
        }
      }
    }

    // Collect all relationships involving any of the merged classes
    const affectedRelationships: Array<{ relId: string; rel: any }> = [];
    const mergedClassIds = new Set(classEntries.map(e => e.id));
    if (model.relationships) {
      for (const [relId, rel] of Object.entries(model.relationships)) {
        const srcId = rel.source?.element;
        const tgtId = rel.target?.element;
        // Skip relationships that are between two classes being merged
        if (mergedClassIds.has(srcId) && mergedClassIds.has(tgtId)) {
          continue;
        }
        if (mergedClassIds.has(srcId) || mergedClassIds.has(tgtId)) {
          affectedRelationships.push({ relId, rel: { ...rel, source: { ...rel.source }, target: { ...rel.target } } });
        }
      }
    }

    // Remove all old classes (and their children and relationships)
    for (const entry of classEntries) {
      ModifierHelpers.removeElementWithChildren(model, entry.id);
    }

    // Create merged class
    const mergedClassId = ModifierHelpers.generateUniqueId('class');
    model.elements[mergedClassId] = {
      id: mergedClassId,
      name: targetName,
      type: 'Class',
      owner: null,
      bounds: { x: mergedX, y: mergedY, width: 220, height: 90 },
      attributes: [],
      methods: [],
    };

    // Re-create attributes under the merged class
    for (let i = 0; i < collectedAttrs.length; i++) {
      const original = collectedAttrs[i];
      const attrId = ModifierHelpers.generateUniqueId('attr');
      const attrY = mergedY + 50 + i * 25;
      model.elements[attrId] = {
        id: attrId,
        name: original.name,
        type: 'ClassAttribute',
        owner: mergedClassId,
        bounds: { x: mergedX + 1, y: attrY, width: 218, height: 25 },
        visibility: original.visibility || 'public',
        attributeType: original.attributeType || 'str',
      };
      model.elements[mergedClassId].attributes.push(attrId);
    }

    // Re-create methods under the merged class
    const attrCount = collectedAttrs.length;
    for (let i = 0; i < collectedMethods.length; i++) {
      const original = collectedMethods[i];
      const methodId = ModifierHelpers.generateUniqueId('method');
      const methodY = mergedY + 50 + attrCount * 25 + 10 + i * 25;
      model.elements[methodId] = {
        id: methodId,
        name: original.name,
        type: 'ClassMethod',
        owner: mergedClassId,
        bounds: { x: mergedX + 1, y: methodY, width: 218, height: 25 },
      };
      model.elements[mergedClassId].methods.push(methodId);
    }
    this.recalculateClassHeight(model.elements[mergedClassId]);

    // Re-add affected relationships, pointing to the merged class
    if (!model.relationships) model.relationships = {};
    for (const { relId, rel } of affectedRelationships) {
      if (mergedClassIds.has(rel.source.element)) {
        rel.source.element = mergedClassId;
      }
      if (mergedClassIds.has(rel.target.element)) {
        rel.target.element = mergedClassId;
      }
      model.relationships[relId] = rel;
    }

    return model;
  }

  /**
   * Promote an attribute from a class into its own class with a composition relationship.
   *
   * Payload shape:
   * { action: "promote_attribute", sourceClass: "User", attribute: "address",
   *   newClass: "Address", newAttributes: [{ name: "street", type: "str" }, ...] }
   */
  private promoteAttribute(model: BESSERModel, modification: ModelModification): BESSERModel {
    const sourceClassName = modification.sourceClass;
    const attributeName = modification.attribute;
    const newClassName = modification.newClass;
    const newAttributes = modification.newAttributes || [];

    if (!sourceClassName) throw new Error('promote_attribute requires a "sourceClass" field.');
    if (!attributeName) throw new Error('promote_attribute requires an "attribute" field.');
    if (!newClassName) throw new Error('promote_attribute requires a "newClass" field.');

    const sourceClassId = this.findClassIdByName(model, sourceClassName);
    if (!sourceClassId) throw new Error(`Source class '${sourceClassName}' not found in the model.`);

    const sourceElement = model.elements[sourceClassId];
    const sourceBounds = sourceElement.bounds || { x: 0, y: 0, width: 220, height: 90 };

    // Find and remove the attribute from the source class
    const attrId = this.findAttributeIdByClassAndName(model, sourceClassName, attributeName);
    if (attrId) {
      sourceElement.attributes = (sourceElement.attributes || []).filter((id: string) => id !== attrId);
      delete model.elements[attrId];
      this.recalculateClassHeight(sourceElement);
    }

    // Create the new class positioned to the right of the source
    const newClassId = ModifierHelpers.generateUniqueId('class');
    const newClassX = sourceBounds.x + (sourceBounds.width || 220) + 400;
    const newClassY = sourceBounds.y;

    model.elements[newClassId] = {
      id: newClassId,
      name: newClassName,
      type: 'Class',
      owner: null,
      bounds: { x: newClassX, y: newClassY, width: 220, height: 90 },
      attributes: [],
      methods: [],
    };

    // Add new attributes to the new class
    for (let i = 0; i < newAttributes.length; i++) {
      const attrSpec = newAttributes[i];
      const newAttrId = ModifierHelpers.generateUniqueId('attr');
      const attrY = newClassY + 50 + i * 25;
      const visibility = attrSpec.visibility || 'public';
      const visSymbol = visibility === 'private' ? '-' : visibility === 'protected' ? '#' : '+';
      const type = normalizeType(attrSpec.type);

      model.elements[newAttrId] = {
        id: newAttrId,
        name: attrSpec.name,
        type: 'ClassAttribute',
        owner: newClassId,
        bounds: { x: newClassX + 1, y: attrY, width: 218, height: 25 },
        visibility: visibility,
        attributeType: type,
      };
      model.elements[newClassId].attributes.push(newAttrId);
    }
    this.recalculateClassHeight(model.elements[newClassId]);

    // Create composition relationship from source to new class
    this.createRelationship(model, sourceClassId, newClassId, 'ClassComposition');

    return model;
  }

  /**
   * Add an Enumeration element and optionally update class attributes to use it.
   *
   * Payload shape:
   * { action: "add_enum", enumName: "OrderStatus",
   *   values: ["PENDING", "SHIPPED", "DELIVERED"],
   *   usedBy: [{ className: "Order", attributeName: "status" }] }
   */
  private addEnum(model: BESSERModel, modification: ModelModification): BESSERModel {
    const enumName = modification.enumName;
    const values = modification.values || [];
    const usedBy = modification.usedBy || [];

    if (!enumName) throw new Error('add_enum requires an "enumName" field.');
    if (values.length === 0) throw new Error('add_enum requires a non-empty "values" array.');

    // Determine position: near the classes that use it, or fall back to a default spot
    let posX = 0;
    let posY = 0;

    if (usedBy.length > 0) {
      let count = 0;
      for (const usage of usedBy) {
        const classId = this.findClassIdByName(model, usage.className);
        if (classId && model.elements[classId]) {
          const bounds = model.elements[classId].bounds || { x: 0, y: 0 };
          posX += bounds.x;
          posY += bounds.y;
          count++;
        }
      }
      if (count > 0) {
        posX = Math.round(posX / count) + 400;
        posY = Math.round(posY / count) - 100;
      }
    } else {
      // Place after the rightmost element
      for (const el of Object.values(model.elements)) {
        if (el.type === 'Class' || el.type === 'AbstractClass' || el.type === 'Interface' || el.type === 'Enumeration') {
          const right = (el.bounds?.x ?? 0) + (el.bounds?.width ?? 220);
          if (right + 80 > posX) {
            posX = right + 80;
            posY = el.bounds?.y ?? 0;
          }
        }
      }
    }

    // Create the Enumeration element
    const enumId = ModifierHelpers.generateUniqueId('enum');
    const enumWidth = 220;
    const headerHeight = 50;
    const valueHeight = 25;
    const totalHeight = headerHeight + values.length * valueHeight + 10;

    model.elements[enumId] = {
      id: enumId,
      name: enumName,
      type: 'Enumeration',
      owner: null,
      bounds: { x: posX, y: posY, width: enumWidth, height: totalHeight },
      attributes: [],
      methods: [],
    };

    // Add enumeration literals as attributes
    for (let i = 0; i < values.length; i++) {
      const literalId = ModifierHelpers.generateUniqueId('literal');
      const literalY = posY + headerHeight + i * valueHeight;

      model.elements[literalId] = {
        id: literalId,
        name: values[i],
        type: 'EnumerationLiteral',
        owner: enumId,
        bounds: { x: posX + 1, y: literalY, width: enumWidth - 2, height: valueHeight },
      };
      model.elements[enumId].attributes.push(literalId);
    }

    // Update attribute types in classes that use this enum
    for (const usage of usedBy) {
      const classId = this.findClassIdByName(model, usage.className);
      if (!classId) continue;

      const classElement = model.elements[classId];
      if (!classElement?.attributes) continue;

      for (const attrId of classElement.attributes) {
        const attr = model.elements[attrId];
        if (!attr) continue;

        const normalizedName = this.normalizeAttributeName(attr.name || '');
        if (normalizedName.toLowerCase() === usage.attributeName.toLowerCase()) {
          // Update the attribute type to the enum name
          const parsed = this.parseAttributeLabel(attr.name || '');
          attr.name = `${parsed.visibilitySymbol} ${parsed.name}: ${enumName}`;
          attr.attributeType = enumName;
        }
      }
    }

    return model;
  }

  // ─── Shared helpers for refactoring actions ──────────────────────────────────

  /**
   * Recalculate a class element's height based on its current attributes and methods.
   */
  private recalculateClassHeight(classElement: any): void {
    const attrCount = (classElement.attributes || []).length;
    const methodCount = (classElement.methods || []).length;
    const headerHeight = 50;
    const rowHeight = 25;
    const methodGap = methodCount > 0 ? 10 : 0;
    const padding = 15;
    classElement.bounds.height = Math.max(
      90,
      headerHeight + attrCount * rowHeight + methodGap + methodCount * rowHeight + padding
    );
  }

  /**
   * Create a relationship between two classes and add it to the model.
   */
  private createRelationship(
    model: BESSERModel,
    sourceClassId: string,
    targetClassId: string,
    relationshipType: string,
    name: string = ''
  ): string {
    if (!model.relationships) model.relationships = {};

    const relId = ModifierHelpers.generateUniqueId('rel');
    model.relationships[relId] = {
      id: relId,
      type: relationshipType,
      source: {
        element: sourceClassId,
        direction: 'Left',
        multiplicity: '1',
        role: '',
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      target: {
        element: targetClassId,
        direction: 'Right',
        multiplicity: '*',
        role: name,
        bounds: { x: 0, y: 0, width: 0, height: 0 }
      },
      bounds: { x: 0, y: 0, width: 0, height: 0 },
      name: name,
      path: [
        { x: 100, y: 10 },
        { x: 0, y: 10 }
      ],
      isManuallyLayouted: false
    };

    return relId;
  }

  // ─── Lookup helpers ──────────────────────────────────────────────────────────

  // Helper methods
  private findClassIdByName(model: BESSERModel, className: string): string | null {
    // Search across all class-like types (Class, AbstractClass, Interface, Enumeration)
    return ModifierHelpers.findElementByName(model, className, 'Class')
      ?? ModifierHelpers.findElementByName(model, className, 'AbstractClass')
      ?? ModifierHelpers.findElementByName(model, className, 'Interface')
      ?? ModifierHelpers.findElementByName(model, className, 'Enumeration');
  }

  /**
   * Create a minimal Class element so that add_relationship can reference it.
   * Positions the new class near an optional neighbour if provided.
   */
  private createMinimalClass(model: BESSERModel, className: string, neighbourId?: string | null): string {
    const classId = ModifierHelpers.generateUniqueId('class');
    // Place the new class to the right of (or below) the neighbour, or at origin
    let x = 0;
    let y = 0;
    if (neighbourId && model.elements[neighbourId]) {
      const nb = model.elements[neighbourId];
      x = (nb.bounds?.x ?? 0) + (nb.bounds?.width ?? 250) + 80;
      y = nb.bounds?.y ?? 0;
    } else {
      // Fallback: find the rightmost class and place to its right
      for (const el of Object.values(model.elements)) {
        if (el.type === 'Class' || el.type === 'AbstractClass' || el.type === 'Interface' || el.type === 'Enumeration') {
          const right = (el.bounds?.x ?? 0) + (el.bounds?.width ?? 250);
          if (right + 80 > x) {
            x = right + 80;
            y = el.bounds?.y ?? 0;
          }
        }
      }
    }
    model.elements[classId] = {
      id: classId,
      name: className,
      type: 'Class',
      owner: null,
      bounds: { x, y, width: 220, height: 90 },
      attributes: [],
      methods: [],
    };
    return classId;
  }

  private findAttributeIdByClassAndName(model: BESSERModel, className: string, attributeName?: string): string | null {
    if (!attributeName) return null;
    const classId = this.findClassIdByName(model, className);
    if (!classId) return null;

    const classElement = model.elements[classId];
    if (!classElement?.attributes) return null;

    const normalizedTarget = this.normalizeAttributeName(attributeName);

    for (const attrId of classElement.attributes) {
      const attr = model.elements[attrId];
      if (!attr?.name) continue;
      const normalizedAttr = this.normalizeAttributeName(attr.name);
      if (normalizedAttr.toLowerCase() === normalizedTarget.toLowerCase()) {
        return attrId;
      }
      if (attr.name.toLowerCase().includes(attributeName.toLowerCase())) {
        return attrId;
      }
    }
    return null;
  }

  private findMethodIdByClassAndName(model: BESSERModel, className: string, methodName?: string): string | null {
    if (!methodName) return null;
    const classId = this.findClassIdByName(model, className);
    if (!classId) return null;

    const classElement = model.elements[classId];
    if (!classElement?.methods) return null;

    const normalizedTarget = this.normalizeMethodName(methodName);

    for (const methodId of classElement.methods) {
      const method = model.elements[methodId];
      if (!method?.name) continue;
      const normalizedMethod = this.normalizeMethodName(method.name);
      if (normalizedMethod.toLowerCase() === normalizedTarget.toLowerCase()) {
        return methodId;
      }
      if (method.name.toLowerCase().includes(methodName.toLowerCase())) {
        return methodId;
      }
    }
    return null;
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
    return {
      visibilitySymbol,
      name: namePart || '',
      type: typePart || ''
    };
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

    const parameterList = params
      ? params.split(',').map(param => param.trim()).filter(Boolean)
      : [];

    return {
      visibilitySymbol,
      name: namePart?.trim() || '',
      returnType: returnTypePart || '',
      parameters: parameterList
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
